// Wien Wärme: the shared Wärme app for the Vienna house.
//
// Vienna's heating is not controlled through Home Assistant. The Intellihome Bridge 2 add-on on the
// Home Assistant Green holds the only connection the controller accepts, and runs the weekly plans,
// warm-up learning, "warm by" and Boost itself. This server signs in to the bridge API with the
// panel password (kept here, never sent to the browser), forwards the heating data to the browser
// (Server-Sent Events) and passes on only the heating controls checked below.
//
// Started by server.js when BRIDGE_URL / BRIDGE_PASSWORD are set (St. Gilgen runs stg-server.js).
// Settings:    BRIDGE_URL       e.g. http://192.168.178.149:8098
//              BRIDGE_PASSWORD  the bridge's panel_password
//              ALLOWED_USERS    optional, comma-separated Tailscale logins
//              HA_URL, HA_TOKEN optional: Vienna Home Assistant (read-only) for the Tempest outside temperature

import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startUpdater } from "./updater.js";

const BRIDGE = (process.env.BRIDGE_URL || "http://192.168.178.149:8098").replace(/\/+$/, "");
let PASSWORD = process.env.BRIDGE_PASSWORD || "";
// Secrets can also be typed once in the app (Settings > Connection setup); they are kept on the NAS in
// data/secrets.json (readable only by this app) and never sent back to any browser.
const SECRETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "secrets.json");
const EMBEDDED = process.env.WIEN_EMBEDDED === "1";          // running inside the Seewärme container
const PORT = EMBEDDED ? 8081 : Number(process.env.PORT || 8080);
const ALLOWED_USERS = (process.env.ALLOWED_USERS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

process.on("uncaughtException", e => console.error("Unexpected error (app keeps running):", e));
process.on("unhandledRejection", e => console.error("Unexpected error (app keeps running):", e));

// ---------------------------------------------------------------- bridge API
let cookie = "", rejectedUntil = 0;
async function login() {
  if (!PASSWORD) throw new Error("BRIDGE_PASSWORD is not set");
  // after a wrong password, wait before trying again (never hammer the bridge's sign-in)
  if (Date.now() < rejectedUntil) throw new Error("the bridge rejected the password");
  const r = await fetch(BRIDGE + "/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }), signal: AbortSignal.timeout(15000),
  });
  if (r.status === 401 || r.status === 403) { rejectedUntil = Date.now() + 5 * 60e3; throw new Error("the bridge rejected the password"); }
  if (!r.ok) throw new Error(`login failed (HTTP ${r.status})`);
  const set = r.headers.getSetCookie?.() || [r.headers.get("set-cookie")].filter(Boolean);
  cookie = set.map(c => c.split(";")[0]).join("; ");
  console.log("Signed in to the Intellihome bridge");
}
async function bridge(p, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!cookie) await login();
    const r = await fetch(BRIDGE + "/api/" + p, {
      method: body ? "POST" : "GET", headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(body ? 30000 : 15000),
    });
    if (r.status === 401) { cookie = ""; continue; }       // session expired: sign in again once
    let data = null; try { data = await r.json(); } catch { }
    if (!r.ok) throw new Error(data?.error || `The bridge answered HTTP ${r.status}`);
    return data;
  }
  throw new Error("The bridge did not accept the sign-in");
}

// ---------------------------------------------------------------- live data
// house: heating zones and floors only (the bridge also knows lights, shutters, sockets: not ours)
const data = { connected: false, error: null, house: null, state: null, schedule: null, climate: null, outside: null };
let zones = new Set();
function trimHouse(h) {
  const fns = Object.fromEntries(Object.entries(h.functions || {}).filter(([, f]) => f.kind === "heating")
    .map(([k, f]) => [k, { slug: f.slug, name: f.name, room: f.room }]));
  zones = new Set(Object.keys(fns));
  const rooms = new Set(Object.values(fns).map(f => f.room));
  return {
    floors: (h.floors || []).map(f => ({ key: f.key, name: f.name, rooms: f.rooms.filter(r => rooms.has(r)) })).filter(f => f.rooms.length),
    functions: fns,
  };
}
function trimState(s) {
  const fns = {};
  for (const k of zones) {
    const e = s.functions?.[k]; if (!e) continue;
    const fields = Object.fromEntries((e.fields || []).map(x => [x.key, x.value]));
    fns[k] = { temperature: e.temperature ?? null, plausible: e.plausible !== false, at: e.at ?? null,
               disabled: fields.disabled === "Ja", day: fields.day ?? null, night: fields.night ?? null };
  }
  const b = s.bridge || {};
  return { bridge: { version: b.version, online: !!b.online, paused: !!b.paused, writes: !!b.writes, heating: b.heating }, functions: fns, time: s.time };
}

const clients = new Set();
const snapshot = () => JSON.stringify({ ...data, setup: { bridge: !!PASSWORD, ha: !!(HA_URL && HA_TOKEN), ha_error: haErr || enErr || null } });
function broadcast() {
  const msg = `event: snapshot\ndata: ${snapshot()}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 25000);

let lastErr = "";
async function poll(what) {
  try {
    if (what === "house") data.house = trimHouse(await bridge("house"));
    else if (!data.house) return;
    else if (what === "state") data.state = trimState(await bridge("state"));
    else if (what === "schedule") data.schedule = await bridge("schedule");
    else if (what === "climate") data.climate = await bridge("climate");
    if (!data.connected) console.log(`Connected to the Intellihome bridge at ${BRIDGE}`);
    data.connected = true; data.error = null; lastErr = "";
  } catch (e) {
    const m = e.cause?.code ? `${e.cause.code}: ${e.message}` : e.message;
    if (m !== lastErr) console.error(`Bridge (${what}): ${m}`);
    lastErr = m; data.connected = false; data.error = m;
  }
  broadcast();
}
// outside temperature for the main card: Open-Meteo (free, no account). Rounded position (about 10 km)
// so no exact address is stored; WEATHER_LAT / WEATHER_LON can override it.
const LAT = Number(process.env.WEATHER_LAT || 48.2), LON = Number(process.env.WEATHER_LON || 16.3);
let wxErr = "";
// Preferred: Mike's own Tempest weather station, read (read-only) from the Vienna Home Assistant.
// Needs HA_URL and HA_TOKEN; the weather service below is the fallback.
// Inside the Seewärme container, HA_URL / HA_TOKEN belong to St. Gilgen's Home Assistant: never use them for Vienna.
const ENV_HA_URL = EMBEDDED ? process.env.WIEN_HA_URL : process.env.HA_URL, ENV_HA_TOKEN = EMBEDDED ? process.env.WIEN_HA_TOKEN : process.env.HA_TOKEN;
let HA_URL = (ENV_HA_URL || "http://192.168.178.149:8123").replace(/\/+$/, ""), HA_TOKEN = ENV_HA_TOKEN || "";
const OUTSIDE = process.env.OUTSIDE_ENTITY || "sensor.ws_temperature";
let haErr = "";
async function tempest() {
  try {
    const r = await fetch(`${HA_URL}/api/states/${OUTSIDE}`, { headers: { Authorization: `Bearer ${HA_TOKEN}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status === 401 ? "Home Assistant rejected the token" : `Home Assistant answered HTTP ${r.status}`);
    const e = await r.json(), t = Number(e.state), at = Date.parse(e.last_reported || e.last_updated) / 1000;
    if (!Number.isFinite(t) || Date.now() / 1000 - at > 3600) throw new Error(`${OUTSIDE} has no recent reading (${e.state})`);
    data.outside = { temp: t, at, source: "Tempest" }; broadcast();
    if (haErr) console.log("Outside temperature: Tempest is back"); haErr = "";
    return true;
  } catch (e) { if (e.message !== haErr) console.error(`Tempest via Home Assistant: ${e.message}`); haErr = e.message; return false; }
}
let wxAt = 0;
async function weather() {
  if (HA_URL && HA_TOKEN && await tempest()) return;
  if (Date.now() - wxAt < 10 * 60e3 && data.outside?.source === "Open-Meteo") return;
  wxAt = Date.now();
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m&timezone=Europe%2FVienna`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const t = (await r.json())?.current?.temperature_2m;
    if (typeof t === "number") { data.outside = { temp: t, at: Date.now() / 1000, source: "Open-Meteo" }; broadcast(); }
    wxErr = "";
  } catch (e) { if (e.message !== wxErr) console.error(`Outside temperature: ${e.message}`); wxErr = e.message; }
}
// ---------------------------------------------------------------- heating energy and cost (Vienna Home Assistant, read-only)
// The NIBE heat pump (myUplink) reports the electricity it used in the past hour, for heating and for hot water,
// a few minutes after every full hour. The finance app keeps sensor.vienna_electricity_price up to date: the all-in
// price in EUR/kWh (energy, grid, levies, VAT, energy-community share already blended in). Cost = kWh x price.
// Kept here per hour in data/energy.json (Home Assistant only keeps about 10 days of history).
const E_HEAT = ["sensor.laundry_room_vvm_320_e_el_energy_used_for_heating_past_hour", "sensor.laundry_room_vvm_320_e_el_energy_used_by_additional_heater_for_heating_past_hour"];
const E_WATER = ["sensor.laundry_room_vvm_320_e_el_energy_used_for_hot_water_past_hour", "sensor.laundry_room_vvm_320_e_el_energy_used_by_additional_heater_for_hot_water_past_hour"];
const PRICE = process.env.PRICE_ENTITY || "sensor.vienna_electricity_price";
const STORE = path.join(path.dirname(PUBLIC), "data", "energy.json");
let store = { hours: {}, prices: [], price: null, synced: 0 };   // hours: { hourStart: { entity: kWh } }, prices: [[t, eur]]
let enErr = "";
const ha = async p => {
  const r = await fetch(HA_URL + p, { headers: { Authorization: `Bearer ${HA_TOKEN}` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(r.status === 401 ? "Home Assistant rejected the token" : `Home Assistant answered HTTP ${r.status}`);
  return r.json();
};
async function energySync() {
  if (!energyOn()) return;
  try {
    const now = Date.now(), from = Math.max(now - 60 * 86400e3, (store.synced || 0) - 6 * 3600e3);
    const ids = [...E_HEAT, ...E_WATER, PRICE];
    const hist = await ha(`/api/history/period/${new Date(from).toISOString()}?end_time=${encodeURIComponent(new Date(now).toISOString())}&filter_entity_id=${ids.join(",")}&minimal_response&no_attributes`);
    for (const series of hist || []) {
      const id = series[0]?.entity_id; if (!id) continue;
      for (const st of series) {
        const v = Number(st.state), t = Date.parse(st.last_changed || st.last_updated) / 1000;
        if (!Number.isFinite(v) || !Number.isFinite(t)) continue;       // "unavailable": skip, never count as 0
        if (id === PRICE) { if (!store.prices.some(p => p[0] === t)) store.prices.push([t, v]); continue; }
        const h = Math.floor(t / 3600) * 3600 - 3600;                   // the value is for the hour that just ended
        (store.hours[h] ||= {})[id] = v;
      }
    }
    store.prices.sort((a, b) => a[0] - b[0]);
    const p = await ha(`/api/states/${PRICE}`).catch(() => null);
    if (p && Number.isFinite(Number(p.state))) {
      const a = p.attributes || {};
      store.price = { eur: Number(p.state), supplier: a.supplier ?? null, tariff: a.tariff ?? null, valid_from: a.valid_from ?? null, last_synced: a.last_synced ?? null, community_share: a.community_share ?? null };
      const t = Date.parse(p.last_updated) / 1000; if (!store.prices.some(q => q[0] === t)) { store.prices.push([t, store.price.eur]); store.prices.sort((a, b) => a[0] - b[0]); }
    }                                                                     // unavailable: keep the last known price
    const cut = now / 1000 - 400 * 86400;
    for (const h of Object.keys(store.hours)) if (h < cut) delete store.hours[h];
    store.prices = store.prices.filter((q, i, a) => q[0] >= cut || i === a.length - 1);
    store.synced = now;
    await mkdir(path.dirname(STORE), { recursive: true }); await writeFile(STORE, JSON.stringify(store));
    if (enErr) console.log("Heating energy: back"); enErr = "";
  } catch (e) { if (e.message !== enErr) console.error(`Heating energy: ${e.message}`); enErr = e.message; }
}
function priceAt(t) {   // the price in force during that hour; before the first known price, the earliest one
  const ps = store.prices; if (!ps.length) return store.price?.eur ?? null;
  let v = ps[0][1]; for (const [pt, pv] of ps) { if (pt <= t + 3600) v = pv; else break; } return v;
}
function energyHours(days) {
  const from = Date.now() / 1000 - days * 86400;
  const sum = (o, ids) => { const v = ids.map(i => o[i]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  return Object.entries(store.hours).map(([h, o]) => [Number(h), sum(o, E_HEAT), sum(o, E_WATER)]).filter(r => r[0] >= from && (r[1] != null || r[2] != null))
    .sort((a, b) => a[0] - b[0]).map(([h, he, wa]) => [h, he, wa, priceAt(h)]);
}
const energyOn = () => !!(HA_URL && HA_TOKEN);

const every = (what, ms) => { poll(what); setInterval(() => poll(what), ms); };
async function loadSecrets() {
  try {
    const j = JSON.parse(await readFile(SECRETS, "utf8"));
    if (j.bridge_password) PASSWORD = j.bridge_password;
    if (j.ha_token) HA_TOKEN = j.ha_token;
    if (j.ha_url) HA_URL = j.ha_url;
  } catch { }
}
async function saveSecrets(b) {
  let j = {}; try { j = JSON.parse(await readFile(SECRETS, "utf8")); } catch { }
  if (b.bridge_password) j.bridge_password = PASSWORD = b.bridge_password;
  if (b.ha_token) j.ha_token = HA_TOKEN = b.ha_token;
  await mkdir(path.dirname(SECRETS), { recursive: true });
  await writeFile(SECRETS, JSON.stringify(j), { mode: 0o600 });
  if (b.bridge_password) { cookie = ""; rejectedUntil = 0; await poll("house"); poll("state"); poll("schedule"); poll("climate"); }
  if (b.ha_token) { haErr = ""; weather(); energySync(); }
}
async function start() {
  await loadSecrets();
  await poll("house");
  every("state", 10000); every("schedule", 20000); every("climate", 60000);
  weather(); setInterval(weather, 60e3);
  try { store = { ...store, ...JSON.parse(await readFile(STORE, "utf8")) }; } catch { }
  energySync(); setInterval(energySync, 15 * 60e3);
  setInterval(() => poll("house"), 3600e3);
}

// ---------------------------------------------------------------- controls (checked before passing on)
const isNum = (v, lo, hi, step) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi && (!step || Math.abs(v / step - Math.round(v / step)) < 1e-9);
const keysAre = (o, ...k) => Object.keys(o).sort().join(",") === k.sort().join(",");
const DAYS = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const SETTINGS = { preheat: v => typeof v === "boolean", margin_min: v => isNum(v, 0, 240, 5), max_lead_h: v => isNum(v, 1, 24, 1),
                   default_mpd: v => isNum(v, 15, 600, 5), boost_delta: v => isNum(v, 0.5, 5, 0.5), boost_hours: v => isNum(v, 0.5, 12, 0.5) };
function check(p, b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const zone = zones.has(b.slug);
  if (p === "heating") return zone && ((keysAre(b, "slug", "day", "night") && isNum(b.day, 5, 30, 0.5) && b.night === b.day)
                                    || (keysAre(b, "slug", "disabled") && typeof b.disabled === "boolean"));
  if (p === "boost") return zone && keysAre(b, "slug", "on") && typeof b.on === "boolean";
  if (p === "schedule") {
    if (keysAre(b, "enabled")) return typeof b.enabled === "boolean";
    if (keysAre(b, "settings")) { const e = Object.entries(b.settings || {}); return e.length === 1 && SETTINGS[e[0][0]]?.(e[0][1]); }
    if (keysAre(b, "slug", "enabled")) return zone && typeof b.enabled === "boolean";
    if (keysAre(b, "slug", "rules")) return zone && Array.isArray(b.rules) && b.rules.length <= 24 && b.rules.every(r =>
      r && keysAre(r, "days", "time", "temp") && Array.isArray(r.days) && r.days.length >= 1 && r.days.every(d => DAYS.includes(d)) && new Set(r.days).size === r.days.length
      && /^([01]\d|2[0-3]):[0-5][05]$/.test(r.time) && isNum(r.temp, 5, 30, 0.5));
  }
  return false;
}

// ---------------------------------------------------------------- web server
const SEC = {
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'",
};
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const json = (res, code, obj) => { res.writeHead(code, { ...SEC, "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
const who = req => (req.headers["tailscale-user-login"] || "").toString().toLowerCase();
const FILES = { "": "wien.html", "index.html": "wien.html", "manifest.json": "manifest-wien.json" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/healthz") return json(res, 200, { ok: true, connected: data.connected });
  if (ALLOWED_USERS.length && !ALLOWED_USERS.includes(who(req))) return json(res, 403, { error: "This app is only for the family. Open it through Tailscale with your own account." });
  try {
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, connected: data.connected, user: who(req) || null });
    if (url.pathname === "/api/events") {
      res.writeHead(200, { ...SEC, "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.write(`event: snapshot\ndata: ${snapshot()}\n\n`);
      clients.add(res); req.on("close", () => clients.delete(res));
      return;
    }
    if (url.pathname === "/api/energy") {
      const d = Number(url.searchParams.get("days"));
      if (!isNum(d, 0.25, 400)) return json(res, 400, { error: "Bad period" });
      if (!energyOn()) return json(res, 200, { enabled: false });
      return json(res, 200, { enabled: true, hours: energyHours(d), price: store.price, synced: store.synced, error: enErr || null });
    }
    if (url.pathname === "/api/history") {
      const d = Number(url.searchParams.get("days"));
      if (!isNum(d, 0.25, 60)) return json(res, 400, { error: "Bad period" });
      return json(res, 200, await bridge(`history/${d}`));
    }
    if (url.pathname === "/api/setup" && req.method === "POST") {
      let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 16384) return json(res, 413, { error: "Request too large" }); }
      let b; try { b = JSON.parse(body); } catch { return json(res, 400, { error: "Invalid request" }); }
      const ok = v => v === undefined || (typeof v === "string" && v.length >= 1 && v.length <= 4096 && !/[\r\n]/.test(v));
      if (!b || !ok(b.bridge_password) || !ok(b.ha_token) || (!b.bridge_password && !b.ha_token) || Object.keys(b).some(k => !["bridge_password", "ha_token"].includes(k)))
        return json(res, 400, { error: "Nothing to save" });
      await saveSecrets(b);
      console.log(`${who(req) || "local"}: connection setup changed (${Object.keys(b).join(", ")})`);
      return json(res, 200, { ok: true, connected: data.connected, error: data.error });
    }
    const ctl = url.pathname.match(/^\/api\/(heating|boost|schedule)$/);
    if (ctl && req.method === "POST") {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 16384) return json(res, 413, { error: "Request too large" }); }
      let b; try { b = JSON.parse(body); } catch { return json(res, 400, { error: "Invalid request" }); }
      if (!check(ctl[1], b)) return json(res, 403, { error: "That control is not available in this app." });
      const st = data.state?.bridge;
      if (st && (st.paused || !st.online || !st.writes)) return json(res, 409, { error: st.paused ? "The bridge is paused for HomeBuilder." : !st.online ? "The controller is not answering." : "Commands are switched off in the bridge." });
      const out = await bridge(ctl[1], b);
      console.log(`${who(req) || "local"}: ${ctl[1]} ${JSON.stringify(b).slice(0, 300)}`);
      poll(ctl[1] === "heating" ? "state" : "schedule").then(() => ctl[1] !== "heating" && poll("state"));
      return json(res, 200, out ?? { ok: true });
    }
    if (req.method !== "GET") return json(res, 405, { error: "Not allowed" });
    const p = decodeURIComponent(url.pathname.slice(1));
    const file = FILES[p] ?? p;
    if (!/^(?:(?:icons|fonts|img)\/(?:wien\/)?)?[a-z0-9_-]+(?:\.[a-z0-9]+)+$/i.test(file)) return json(res, 404, { error: "Not found" });
    const body = await readFile(path.join(PUBLIC, file)).catch(() => null);
    if (!body) return json(res, 404, { error: "Not found" });
    res.writeHead(200, { ...SEC, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": /\.(html|json)$/.test(file) ? "no-cache" : "max-age=604800" });
    res.end(body);
  } catch (e) {
    json(res, 502, { error: e.message });
  }
});

server.listen(PORT, EMBEDDED ? "127.0.0.1" : undefined, () => { console.log(`Wien Wärme listening on :${PORT}${EMBEDDED ? " (inside Seewärme, at /wien/)" : ""}`); if (!EMBEDDED) startUpdater(path.dirname(PUBLIC)); });
start();
if (!EMBEDDED) for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { server.close(); process.exit(0); });
