// Seewärme St. Gilgen: heating web app for the NAS.
//
// The browser never sees the Home Assistant token. This server keeps one
// WebSocket connection to the St. Gilgen Home Assistant, forwards the heating
// entities to the browser (Server-Sent Events) and accepts only the heating
// controls listed in ALLOWED below. No npm dependencies (Node 22+).

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HA_URL = (process.env.HA_URL || "").replace(/\/+$/, "");
const HA_TOKEN = process.env.HA_TOKEN || "";
const PORT = Number(process.env.PORT || 8080);
const ALLOWED_USERS = (process.env.ALLOWED_USERS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const COST_STAT = process.env.COST_STATISTIC || "salzburgnetz:cost_2197186";
const ENERGY_STAT = process.env.ENERGY_STATISTIC || "salzburgnetz:consumption_2197186";
const PRICE_SENSOR = process.env.PRICE_SENSOR || "sensor.st_gilgen_electricity_price";
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

if (!HA_URL || !HA_TOKEN) {
  console.error("Set HA_URL (e.g. https://your-home-assistant.your-tailnet.ts.net) and HA_TOKEN (a long-lived access token).");
  process.exit(1);
}

// ---------------------------------------------------------------- entities
const ROOMS = ["living_room", "kitchen", "hall", "bathroom", "bedroom"];
const R = `(${ROOMS.join("|")})`;
const RELEVANT = [
  new RegExp(`^climate\\.${R}_floor_heating$`),
  new RegExp(`^number\\.${R}_floor_heating_comfort_temperature$`),
  new RegExp(`^binary_sensor\\.${R}_floor_heating_online$`),
  new RegExp(`^sensor\\.${R}_floor_heating_(wifi_signal|energy_30_days)$`),
  new RegExp(`^sensor\\.${R}_floor_temperature$`),
  /^person\.(mike|irene|oli)$/,
  /^input_(select|text|datetime|boolean|number)\.stg_/,
  /^sensor\.stg_/, /^binary_sensor\.stg_stay_active$/, /^timer\.stg_heating_boost$/, /^zone\.home$/,
];
const isWindowSwitch = s => s.entity_id.startsWith("switch.") && / Floor Heating Switch Window detection$/.test(s.attributes?.friendly_name || "");
const relevant = s => s && (s.entity_id === PRICE_SENSOR || RELEVANT.some(r => r.test(s.entity_id)) || isWindowSwitch(s));

const MODES = ["Auto", "Home", "Eco", "Away", "Frost protection", "Boost"];
const SETTINGS = [
  "input_number.stg_away_temperature", "input_number.stg_out_for_the_day_drop", "input_number.stg_boost_increase",
  "input_number.stg_boost_duration", "input_number.stg_pre_heat_safety_margin", "input_number.stg_stop_heating_before_departure",
  "input_number.stg_warm_up_rate",
];
const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const DT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

// Every control the app may use. Anything else is refused.
function allowed(domain, service, data) {
  const id = data?.entity_id;
  const keys = Object.keys(data || {}).sort().join(",");
  switch (`${domain}.${service}`) {
    case "input_select.select_option":
      return id === "input_select.stg_heating_mode" && MODES.includes(data.option) && keys === "entity_id,option";
    case "climate.set_temperature":
      return new RegExp(`^climate\\.${R}_floor_heating$`).test(id) && num(data.temperature, 5, 28) && keys === "entity_id,temperature";
    case "number.set_value":
      return new RegExp(`^number\\.${R}_floor_heating_comfort_temperature$`).test(id) && num(data.value, 10, 28) && keys === "entity_id,value";
    case "input_datetime.set_datetime":
      return ["input_datetime.stg_arrival", "input_datetime.stg_departure"].includes(id) && DT.test(data.datetime) && keys === "datetime,entity_id";
    case "input_boolean.turn_on": case "input_boolean.turn_off":
      return id === "input_boolean.stg_arrival_planned" && keys === "entity_id";
    case "input_number.set_value":
      return SETTINGS.includes(id) && num(data.value, 0, 40) && keys === "entity_id,value";
    case "switch.turn_on": case "switch.turn_off":
      return !!states[id] && isWindowSwitch(states[id]) && keys === "entity_id";
    default:
      return false;
  }
}

// ---------------------------------------------------------------- Home Assistant
const states = {};
let ws = null, connected = false, nextId = 1, retry = 1;
const pending = new Map();

function haSend(msg) {
  return new Promise((resolve, reject) => {
    if (!connected) return reject(new Error("Home Assistant is not connected"));
    const id = nextId++;
    const t = setTimeout(() => { pending.delete(id); reject(new Error("Home Assistant did not answer")); }, 20000);
    pending.set(id, { resolve, reject, t });
    ws.send(JSON.stringify({ ...msg, id }));
  });
}

// Explains in the log why Home Assistant can't be reached (name not found, refused, certificate...).
async function diagnose() {
  try {
    const r = await fetch(HA_URL + "/api/", { headers: { Authorization: `Bearer ${HA_TOKEN}` }, signal: AbortSignal.timeout(10000) });
    if (r.status === 401) return "Home Assistant answered, but the token was rejected (create a new long-lived token)";
    return `Home Assistant answered with HTTP ${r.status}`;
  } catch (e) {
    const c = e.cause || e;
    return `${c.code || c.name || "error"}: ${c.message || e.message}`;
  }
}

function connect() {
  const url = HA_URL.replace(/^http/, "ws") + "/api/websocket";
  let sock;
  try { sock = new WebSocket(url); } catch (e) { console.error("Invalid HA_URL:", e.message); return scheduleRetry(); }
  ws = sock;
  let closed = false;
  const down = async () => {
    if (closed) return;          // close and error can both fire; handle the drop once
    closed = true;
    const wasConnected = connected;
    if (ws === sock) ws = null;
    connected = false; broadcast("status", { connected });
    for (const p of pending.values()) { clearTimeout(p.t); p.reject(new Error("Connection to Home Assistant lost")); }
    pending.clear();
    console.log(wasConnected ? "Home Assistant connection lost." : `Can't reach Home Assistant at ${HA_URL}: ${await diagnose()}`);
    scheduleRetry();
  };
  sock.addEventListener("close", down);
  sock.addEventListener("error", down);   // never call close() here: that re-fires error and loops
  sock.addEventListener("message", ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === "auth_required") sock.send(JSON.stringify({ type: "auth", access_token: HA_TOKEN }));
    else if (m.type === "auth_invalid") { console.error("Home Assistant rejected the token:", m.message); try { sock.close(); } catch {} }
    else if (m.type === "auth_ok") {
      connected = true; retry = 1; console.log(`Connected to ${HA_URL} (Home Assistant ${m.ha_version})`);
      haSend({ type: "subscribe_events", event_type: "state_changed" }).catch(() => {});
      haSend({ type: "get_states" }).then(list => {
        for (const k of Object.keys(states)) delete states[k];
        for (const s of list) if (relevant(s)) states[s.entity_id] = s;
        broadcast("snapshot", { connected, states });
      }).catch(e => console.error(e.message));
    } else if (m.type === "event" && m.event?.event_type === "state_changed") {
      const { entity_id, new_state } = m.event.data;
      if (new_state && relevant(new_state)) { states[entity_id] = new_state; broadcast("state", new_state); }
      else if (!new_state && states[entity_id]) { delete states[entity_id]; broadcast("removed", { entity_id }); }
    } else if (m.type === "result" && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t);
      m.success ? p.resolve(m.result) : p.reject(new Error(m.error?.message || "Home Assistant refused the request"));
    }
  });
}

function scheduleRetry() {
  const wait = Math.min(60, retry); retry *= 2;
  console.log(`Trying again in ${wait}s`);
  setTimeout(connect, wait * 1000);
}

// A failure talking to Home Assistant must never take the page down.
process.on("uncaughtException", e => console.error("Unexpected error (app keeps running):", e));
process.on("unhandledRejection", e => console.error("Unexpected error (app keeps running):", e));

// ---------------------------------------------------------------- browser side
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => { for (const res of clients) res.write(": ping\n\n"); }, 25000);

async function costs() {
  const end = new Date();
  const start = new Date(end.getTime() - 31 * 864e5);
  const r = await haSend({
    type: "recorder/statistics_during_period", start_time: start.toISOString(), end_time: end.toISOString(),
    statistic_ids: [COST_STAT, ENERGY_STAT], period: "day", types: ["change"],
  });
  const days = {};
  for (const [stat, rows] of Object.entries(r)) for (const row of rows) {
    const d = (days[row.start] ??= { start: row.start, eur: null, kwh: null });
    if (stat === COST_STAT) d.eur = row.change; else d.kwh = row.change;
  }
  const price = states[PRICE_SENSOR];
  return {
    days: Object.values(days).sort((a, b) => a.start - b.start),
    price: price && !isNaN(parseFloat(price.state)) ? { eur_per_kwh: parseFloat(price.state), ...price.attributes } : null,
  };
}

const SEC = {
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; manifest-src 'self'",
};
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".js": "text/javascript; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const json = (res, code, obj) => { res.writeHead(code, { ...SEC, "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };

function who(req) {
  return (req.headers["tailscale-user-login"] || "").toString().toLowerCase();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/healthz") return json(res, 200, { ok: true, connected });
  if (ALLOWED_USERS.length && !ALLOWED_USERS.includes(who(req))) {
    return json(res, 403, { error: "This app is only for the St. Gilgen family. Open it through Tailscale with your own account." });
  }
  try {
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, connected, user: who(req) || null });
    if (url.pathname === "/api/events") {
      res.writeHead(200, { ...SEC, "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.write(`event: snapshot\ndata: ${JSON.stringify({ connected, states })}\n\n`);
      clients.add(res); req.on("close", () => clients.delete(res));
      return;
    }
    if (url.pathname === "/api/costs") return json(res, 200, await costs());
    // Profile pictures of the people (Mike, Irene, Oli), fetched with the token so the browser never needs it
    const pic = url.pathname.match(/^\/api\/picture\/(person\.[a-z0-9_]+)$/);
    if (pic) {
      const p = states[pic[1]]?.attributes?.entity_picture;
      if (!p || !p.startsWith("/")) return json(res, 404, { error: "No picture" });
      const r = await fetch(HA_URL + p, { headers: { Authorization: `Bearer ${HA_TOKEN}` }, signal: AbortSignal.timeout(10000) });
      const type = r.headers.get("content-type") || "";
      if (!r.ok || !type.startsWith("image/")) return json(res, 404, { error: "No picture" });
      res.writeHead(200, { ...SEC, "Content-Type": type, "Cache-Control": "max-age=86400" });
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (url.pathname === "/api/call" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: "Request too large" }); }
      let p; try { p = JSON.parse(body); } catch { return json(res, 400, { error: "Invalid request" }); }
      if (!allowed(p.domain, p.service, p.data)) return json(res, 403, { error: "That control is not available in this app." });
      await haSend({ type: "call_service", domain: p.domain, service: p.service, service_data: p.data });
      console.log(`${who(req) || "local"}: ${p.domain}.${p.service} ${JSON.stringify(p.data)}`);
      return json(res, 200, { ok: true });
    }
    if (req.method !== "GET") return json(res, 405, { error: "Not allowed" });
    const file = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    if (!/^(?:(?:icons|fonts|vendor)\/)?[a-z0-9_-]+(?:\.[a-z0-9]+)+$/i.test(file)) return json(res, 404, { error: "Not found" });
    const data = await readFile(path.join(PUBLIC, file)).catch(() => null);
    if (!data) return json(res, 404, { error: "Not found" });
    res.writeHead(200, { ...SEC, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": file === "index.html" || file === "manifest.json" ? "no-cache" : "max-age=604800" });
    res.end(data);
  } catch (e) {
    json(res, 502, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Seewärme listening on :${PORT}`));
connect();
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { server.close(); ws?.close(); process.exit(0); });
