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

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startUpdater } from "./updater.js";

const BRIDGE = (process.env.BRIDGE_URL || "http://192.168.178.149:8098").replace(/\/+$/, "");
const PASSWORD = process.env.BRIDGE_PASSWORD || "";
const PORT = Number(process.env.PORT || 8080);
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
const data = { connected: false, error: null, house: null, state: null, schedule: null, climate: null };
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
function broadcast() {
  const msg = `event: snapshot\ndata: ${JSON.stringify(data)}\n\n`;
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
const every = (what, ms) => { poll(what); setInterval(() => poll(what), ms); };
async function start() {
  await poll("house");
  every("state", 10000); every("schedule", 20000); every("climate", 60000);
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
      res.write(`event: snapshot\ndata: ${JSON.stringify(data)}\n\n`);
      clients.add(res); req.on("close", () => clients.delete(res));
      return;
    }
    if (url.pathname === "/api/history") {
      const d = Number(url.searchParams.get("days"));
      if (!isNum(d, 0.25, 60)) return json(res, 400, { error: "Bad period" });
      return json(res, 200, await bridge(`history/${d}`));
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

server.listen(PORT, () => { console.log(`Wien Wärme listening on :${PORT}`); startUpdater(path.dirname(PUBLIC)); });
start();
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { server.close(); process.exit(0); });
