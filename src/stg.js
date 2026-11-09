/* ---------- Home Assistant entities (St. Gilgen) ---------- */
const ROOMS = [["living_room", "Living room"], ["kitchen", "Dining room"], ["hall", "Hall"], ["bathroom", "Bathroom"], ["bedroom", "Bedroom"]];
const RN = Object.fromEntries(ROOMS);
const E = {
  mode: "input_select.stg_heating_mode", auto: "input_text.stg_heating_auto_state",
  arr: "input_datetime.stg_arrival", dep: "input_datetime.stg_departure", planned: "input_boolean.stg_arrival_planned",
  stay: "binary_sensor.stg_stay_active", start: "sensor.stg_heating_start", stop: "sensor.stg_heating_stop",
  gap: "sensor.stg_heating_gap", preheat: "sensor.stg_pre_heat_time", rate: "input_number.stg_warm_up_rate", last: "input_text.stg_last_warm_up",
  away: "input_number.stg_away_temperature", drop: "input_number.stg_out_for_the_day_drop", boostInc: "input_number.stg_boost_increase",
  boostDur: "input_number.stg_boost_duration", margin: "input_number.stg_pre_heat_safety_margin", stopBefore: "input_number.stg_stop_heating_before_departure",
  boostTimer: "timer.stg_heating_boost", price: "sensor.st_gilgen_electricity_price",
  people: [["person.mike", "Mike"], ["person.irene", "Irene"], ["person.oli", "Oli"]],
  climate: r => `climate.${r}_floor_heating`, comfort: r => `number.${r}_floor_heating_comfort_temperature`,
  online: r => `binary_sensor.${r}_floor_heating_online`, wifi: r => `sensor.${r}_floor_heating_wifi_signal`,
  floor: r => `sensor.${r}_floor_temperature`, energy: r => `sensor.${r}_floor_heating_energy_30_days`,
  night: r => `input_number.stg_night_${r}`, rateR: r => `input_number.stg_rate_${r}`,
  nightOn: "binary_sensor.stg_night", nightEn: "input_boolean.stg_night_enabled", warming: "input_boolean.stg_night_warming",
  air: { kitchen: ["sensor.indoor_stg_humidity", "sensor.indoor_stg_carbon_dioxide"], bathroom: ["sensor.indoor_stg_bedroom_humidity", "sensor.indoor_stg_bedroom_carbon_dioxide"], bedroom: ["sensor.indoor_stg_bedroom_humidity_2", "sensor.indoor_stg_bedroom_carbon_dioxide_2"] },
  outT: "sensor.indoor_stg_outdoor_stg_temperature",
  bench: "climate.bench_warmer", benchOn: "binary_sensor.stg_bench_heating", bSw: "input_boolean.stg_bench_switch",
  bPlan: "input_boolean.stg_bench_plan", bOnAt: "input_datetime.stg_bench_on", bOffAt: "input_datetime.stg_bench_off", bTemp: "input_number.stg_bench_plan_temp", bRep: "input_select.stg_bench_repeat", benchW: "input_number.stg_bench_power", benchE: "sensor.stg_bench_energy",
  co2On: "input_boolean.stg_co2_alert", co2Limit: "input_number.stg_co2_limit",
  pushDev: [["mhh17", "Mike's iPhone", "iPhone 17"], ["mike_m4", "Mike's iPad", "iPad Pro M4"]],
  nStart: "input_datetime.stg_night_start", nEnd: "input_datetime.stg_night_end", wakeStart: "sensor.stg_morning_warm_up_start",
};
const SEG = [["Auto", "Auto"], ["Home", "Home"], ["Eco", "Out"], ["Away", "Away"]];
const NAV = [
  ["home", "Home", '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ["rooms", "Rooms", '<path d="M3 4h18v16H3zM3 12h8V4M11 12v8M15 12h6"/>'],
  ["bench", "Bench", '<path d="M3 13h18M5 13V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M4 13v6M20 13v6M4 17h16"/><path d="M9 4c0 1-1 1-1 2M12 4c0 1-1 1-1 2M15 4c0 1-1 1-1 2"/>'],
  ["stay", "Stays", '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
  ["insights", "Insights", '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>'],
  ["settings", "Settings", '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'],
];

/* ---------- example data (shown until the app runs on the NAS) ---------- */
const H = 3600e3;
const at = (d, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x; };
const haDT = d => { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`; };
const demo = {};
const S = (id, state, attributes = {}) => { demo[id] = { entity_id: id, state: String(state), attributes }; };
(function seed() {
  const arr = at(-1, 18), dep = at(6, 12);
  S(E.mode, "Auto"); S(E.auto, "Home"); S(E.arr, haDT(arr)); S(E.dep, haDT(dep)); S(E.planned, "on"); S(E.stay, "on");
  S(E.start, new Date(arr - 3 * H).toISOString()); S(E.stop, new Date(dep - H).toISOString());
  S(E.gap, "0.3"); S(E.preheat, "1.6"); S(E.rate, "0.55"); S(E.last, "");
  S(E.away, "5"); S(E.drop, "2"); S(E.boostInc, "2"); S(E.boostDur, "2"); S(E.margin, "1"); S(E.stopBefore, "1"); S(E.boostTimer, "idle");
  S(E.air.kitchen[0], 61); S(E.air.kitchen[1], 1480); S(E.air.bathroom[0], 58); S(E.air.bathroom[1], 820); S(E.air.bedroom[0], 52); S(E.air.bedroom[1], 760); S(E.outT, 8.4);
  S(E.bench, "heat", { current_temperature: 21.5, temperature: 24, hvac_modes: ["off", "heat"], min_temp: 5, max_temp: 40 }); S(E.benchOn, "on"); S(E.bSw, "on"); S(E.benchW, 520); S(E.benchE, 3.2);
  { const a = new Date(); a.setDate(a.getDate() + 1); a.setHours(7, 0, 0, 0); const o = new Date(a); o.setHours(8); S(E.bPlan, "on"); S(E.bOnAt, haDT(a)); S(E.bOffAt, haDT(o)); S(E.bTemp, 25); S(E.bRep, "Once"); }
  S(E.co2On, "on"); S(E.co2Limit, 1400); for (const [d] of E.pushDev) S(`input_boolean.stg_co2_push_${d}`, "on");
  S(E.nightOn, "off"); S(E.nightEn, "on"); S(E.warming, "off"); S(E.nStart, "22:00:00"); S(E.nEnd, "08:00:00"); S(E.wakeStart, at(1, 5, 10).toISOString());
  S(E.price, "0.4176", { supplier: "Salzburg AG", valid_from: "2026-09-01" });
  S("person.mike", "home"); S("person.irene", "home"); S("person.oli", "not_home");
  const d = { living_room: [21.8, 22, 22, 24.6, -58, 84], kitchen: [20.2, 20, 20, 23.1, -61, 41], hall: [19.1, 20, 20, 22.8, -55, 38], bathroom: [20.4, 20, 20, 25.2, -63, 52], bedroom: [18.6, 19, 19, 22.0, -73, 61] };
  for (const [r, n] of ROOMS) {
    const [cur, tgt, cf, fl, wf, kwh] = d[r];
    S(E.climate(r), "heat", { current_temperature: cur, temperature: tgt, preset_mode: "MANUAL", hvac_action: cur < tgt - .2 ? "heating" : "idle" });
    S(E.comfort(r), cf); S(E.night(r), r === "bedroom" ? cf : cf - 1.5); S(E.rateR(r), .5); S(E.online(r), "on"); S(E.wifi(r), wf); S(E.floor(r), fl); S(E.energy(r), kwh);
    S(`switch.demo_window_${r}`, "on", { friendly_name: `${n} Floor Heating Switch Window detection` });
  }
})();

/* ---------- data: live from the NAS server, or the example data ---------- */
let states = demo, live = false, haUp = false, costData = null;
const st = id => states[id]?.state, attr = (id, a) => states[id]?.attributes?.[a];
const num = (id, f = 0) => { const v = parseFloat(st(id)); return isNaN(v) ? f : v; };
const parseHA = s => s && s !== "unknown" ? new Date(s.replace(" ", "T")) : null;

async function call(domain, service, data) {
  if (live) {
    const r = await fetch("api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain, service, data }) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast(e.error || "That didn't work. Please try again."); throw new Error(e.error); }
    return;
  }
  const id = data.entity_id;
  if (domain === "input_select") { S(id, data.option); demoMode(data.option); }
  else if (domain === "climate" && id === E.bench) { const c = demo[E.bench]; if (service === "set_hvac_mode") { c.state = data.hvac_mode; S(E.bSw, data.hvac_mode === "heat" ? "on" : "off"); } else c.attributes = { ...c.attributes, temperature: data.temperature }; S(E.benchOn, c.state === "heat" && c.attributes.current_temperature < c.attributes.temperature ? "on" : "off"); }
  else if (domain === "climate") setTarget(id.split(".")[1].replace("_floor_heating", ""), data.temperature);
  else if (domain === "number" || domain === "input_number") { S(id, data.value, states[id]?.attributes); if (domain === "number") { const r = id.split(".")[1].replace("_floor_heating_comfort_temperature", ""); if (st(E.mode) === "Home" || st(E.mode) === "Auto") setTarget(r, data.value); } }
  else if (domain === "input_datetime") { S(id, data.datetime || data.time); demoStay(); }
  else if (domain === "input_boolean") { S(id, service === "turn_on" ? "on" : "off"); demoStay(); }
  else if (domain === "switch") S(id, service === "turn_on" ? "on" : "off", states[id]?.attributes);
  render();
}
function setTarget(r, t) { const c = demo[E.climate(r)]; c.attributes = { ...c.attributes, temperature: t, hvac_action: c.attributes.current_temperature < t - .2 ? "heating" : "idle" }; }
function demoMode(m) {
  for (const [r] of ROOMS) {
    const cf = num(E.comfort(r), 20);
    setTarget(r, m === "Eco" ? cf - num(E.drop, 2) : m === "Away" ? num(E.away, 5) : m === "Frost protection" ? 5 : m === "Boost" ? cf + num(E.boostInc, 2) : cf);
    demo[E.climate(r)].attributes.preset_mode = m === "Eco" || m === "Away" ? "VACATION" : m === "Frost protection" ? "PAUSE" : "MANUAL";
  }
  if (m === "Auto") S(E.auto, "Home");
  S(E.boostTimer, m === "Boost" ? "active" : "idle", m === "Boost" ? { finishes_at: new Date(Date.now() + num(E.boostDur, 2) * H).toISOString() } : {});
}
function demoStay() {
  const a = parseHA(st(E.arr)), d = parseHA(st(E.dep));
  S(E.start, new Date(a - num(E.preheat, 3) * H).toISOString()); S(E.stop, new Date(d - num(E.stopBefore, 1) * H).toISOString());
  S(E.stay, st(E.planned) === "on" && Date.now() >= a - num(E.preheat, 3) * H && Date.now() < d - num(E.stopBefore, 1) * H ? "on" : "off");
}
async function goLive() {
  const h = await fetch("api/health", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!h || !h.ok) return;
  let q = false; const soon = () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; render(); }); } };
  const es = new EventSource("api/events");
  es.addEventListener("snapshot", e => { const d = JSON.parse(e.data); states = { ...d.states }; haUp = d.connected; live = true; soon(); });
  es.addEventListener("state", e => { const s = JSON.parse(e.data); states[s.entity_id] = s; soon(); });
  es.addEventListener("removed", e => { delete states[JSON.parse(e.data).entity_id]; soon(); });
  es.addEventListener("status", e => { haUp = JSON.parse(e.data).connected; soon(); });
  es.onerror = () => { haUp = false; soon(); };
  const costs = () => fetch("api/costs").then(r => r.ok ? r.json() : null).then(d => { if (d) { costData = d; renderInsights(); renderHome(); } }).catch(() => {});
  costs(); setInterval(costs, 15 * 60e3);
  const weather = () => fetch("api/weather").then(r => r.ok ? r.json() : null).then(d => { if (d) { wx = d; renderWeather(); } }).catch(() => {});
  weather(); setInterval(weather, 20 * 60e3);
}


function room(r) {
  const c = states[E.climate(r)], cur = c?.attributes?.current_temperature, tgt = c?.attributes?.temperature;
  const cf = num(E.comfort(r), 20), online = st(E.online(r)) !== "off" && c && c.state !== "unavailable";
  const heating = c?.attributes?.hvac_action === "heating", lowered = typeof tgt === "number" && tgt < cf - .4;
  const state = !online ? "off" : heating ? "hot" : lowered ? "low" : "ok";
  let text = { off: "Offline", hot: "Heating", low: "Lowered", ok: "Comfortable" }[state];
  const by = warmBy(); if (state === "hot" && by) text = `Heating · warm by ${by}`;
  const [hId, cId] = E.air[r] || [], hum = num(hId, NaN), co2 = num(cId, NaN);
  return { r, name: RN[r], cur, tgt, cf, online, heating, lowered, state, text, preset: c?.attributes?.preset_mode, hum, co2 };
}
// when heating has a deadline: the morning "warm by" time, or the arrival during pre-heating
function warmBy() {
  if (st(E.mode) !== "Auto") return "";
  if (st(E.auto) === "Pre-heating") { const a = parseHA(st(E.arr)); return a ? fmtT(a) : ""; }
  if (st(E.warming) === "on") return hm(st(E.nEnd));
  return "";
}
// show the switch at once; Home Assistant confirms through the "StG bench switched on" helper
function benchLocal(on) { states[E.bSw] = { ...(states[E.bSw] || { entity_id: E.bSw, attributes: {} }), state: on ? "on" : "off" }; renderBench(); }
function bench() {
  const c = states[E.bench], on = c?.state === "heat" || st(E.bSw) === "on", cur = c?.attributes?.current_temperature, tgt = c?.attributes?.temperature;
  const online = !!c && c.state !== "unavailable", heating = st(E.benchOn) === "on";
  const state = !online ? "off" : !on ? "idle" : heating ? "hot" : "ok";
  const text = { off: "Offline", idle: "Off", hot: "Warming up", ok: "Warm" }[state];
  return { on, cur, tgt, online, heating, state, text, watts: num(E.benchW, 520) };
}
const co2Limit = () => num(E.co2Limit, 1400);
const SHORT = [["bedroom", "Bed"], ["bathroom", "Bath"], ["hall", "Hall"], ["kitchen", "Dining"], ["living_room", "Living"]];
function airLine(x) {
  let out = "";
  if (Number.isFinite(x.hum)) out += `<span class="air">${Math.round(x.hum)}% humidity</span>`;
  if (Number.isFinite(x.co2)) out += x.co2 >= co2Limit() ? `<span class="air warn">CO₂ ${Math.round(x.co2).toLocaleString("en-GB")} ppm · air it</span>` : `<span class="air">CO₂ ${Math.round(x.co2).toLocaleString("en-GB")} ppm</span>`;
  return out;
}
function picture(id) {
  const p = attr(id, "entity_picture");
  return live && p ? `api/picture/${encodeURIComponent(id)}?v=${encodeURIComponent(p.slice(-12))}` : null;
}
function presence(id) {
  const s = st(id);
  if (!s || s === "unknown") return ["", "Not tracked yet"];
  if (s === "home") return ["here", "In the flat"];
  if (/near/i.test(s)) return ["way", "On the way"];
  return ["", "Away"];
}

/* ---------- render ---------- */
function render() {
  for (const id of ["#conn-top", "#conn-rail"]) {
    const el = $(id); el.classList.toggle("live", live && haUp);
    el.querySelector("span").textContent = !live ? "Example data" : haUp ? "Live" : "Reconnecting";
  }
  renderHome(); renderRooms(); renderStay(); renderInsights(); renderSettings(); renderBench();
  if (sheetRoom) renderSheet();
}

function situation() {
  const m = st(E.mode), a = st(E.auto) || "", drop = num(E.drop, 2), away = num(E.away, 5);
  const heating = ROOMS.map(([r]) => room(r)).filter(x => x.heating).map(x => x.name.toLowerCase());
  const hs = heating.length ? `Heating ${heating.join(", ")}.` : "Every room is at temperature.";
  if (m === "Auto") {
    if (a === "Pre-heating") return ["Warming up", "hot", `Started ${fmtT(new Date(st(E.start)))}, comfortable by ${fmtT(parseHA(st(E.arr)))}.`, "Follows your stays and who's here."];
    if (a === "Night") { const w = st(E.wakeStart); return ["Night", "low", `Rooms at their night temperatures. Warm-up starts ${w ? fmtT(new Date(w)) : "…"}, warm by ${hm(st(E.nEnd))}.`, "Follows your stays, who's here and the night times."]; }
    if (a.startsWith("Home") && st(E.warming) === "on") return ["Warming for the morning", "hot", `Every room back to day temperature by ${hm(st(E.nEnd))}.`, "Follows your stays, who's here and the night times."];
    if (a.startsWith("Home")) return ["Comfortable", heating.length ? "hot" : "ok", hs, "Follows your stays and who's here."];
    if (a === "Out for the day") return ["Out, kept cosy", "low", `Each room ${drop} °C lower until someone is back.`, "Follows your stays and who's here."];
    return [`Resting at ${away} °C`, "low", "No stay running. It warms up by itself before your next arrival.", "Follows your stays and who's here."];
  }
  if (m === "Home") return ["Comfortable", heating.length ? "hot" : "ok", hs, "Comfort in every room, whoever is here."];
  if (m === "Eco") return ["Out, kept cosy", "low", `Each room ${drop} °C lower.`, "Stays like this until you pick Auto again."];
  if (m === "Away") return [`Holding ${away} °C`, "low", "The floors stay frost-safe.", "Until you change it or a planned stay starts."];
  if (m === "Frost protection") return ["Frost protection", "low", "Thermostats paused, floors kept from freezing.", "Until you change it."];
  if (m === "Boost") { const f = attr(E.boostTimer, "finishes_at"); return [`Boost +${num(E.boostInc, 2)} °C`, "hot", `Until ${f ? fmtT(new Date(f)) : "…"}, then back to before.`, "Ends by itself."]; }
  return [m || "…", "ok", "", ""];
}

/* ---------- bench warmer ---------- */
const BX = { kind: lsGet("bx.kind") || "week", anchor: new Date(), data: null, req: 0 };
const BT = { dirty: false };
const REP = [["Once", "Once"], ["Every day", "Daily"], ["Weekdays", "Weekdays"], ["Weekends", "Weekends"]];
function benchPlan() {
  const on = st(E.bPlan) === "on", a = parseHA(st(E.bOnAt)), o = parseHA(st(E.bOffAt)), rep = st(E.bRep) || "Once", temp = num(E.bTemp, 25);
  const day = d => { const t = new Date(); t.setHours(0, 0, 0, 0); const x = new Date(d); x.setHours(0, 0, 0, 0); const n = Math.round((x - t) / 864e5);
    return n === 0 ? "Today" : n === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
  const when = a && o ? (rep === "Once" ? `${day(a)}, ${fmtT(a)}–${fmtT(o)}` : `${{ "Every day": "Every day", Weekdays: "Weekdays", Weekends: "Weekends" }[rep]}, ${fmtT(a)}–${fmtT(o)}`) : "";
  return { on, a, o, rep, temp, when, valid: !!(a && o && o > a && o > new Date()) };
}
function renderBench() {
  if (!$("#v-bench") || $("#v-bench").hidden) return;
  const b = bench();
  $("#b-temp").innerHTML = typeof b.cur === "number" ? `${t1(b.cur)}<sup>°C</sup>` : "–";
  $("#b-dot").className = b.state === "hot" ? "hot" : b.state === "ok" ? "" : "low"; $("#b-status").textContent = b.text;
  $("#b-sub").textContent = !b.online ? "The thermostat isn't reachable right now." : b.on ? (b.heating ? `Warming the bench to ${t1(b.tgt)} °C, about ${b.watts} W while it heats.` : `Holding ${t1(b.tgt)} °C. It switches on again when the bench cools.`) : "Switched off. Tap On to warm the bench.";
  $("#b-power").innerHTML = [["off", "Off"], ["heat", "On"]].map(([v, l]) => `<button data-bmode="${v}" aria-pressed="${(b.on ? "heat" : "off") === v}">${l}</button>`).join("");
  $("#b-set").innerHTML = `<button data-bstep="-0.5" aria-label="Cooler">−</button><output class="num">${t1(b.tgt ?? 0)}°</output><button data-bstep="0.5" aria-label="Warmer">+</button>`;
  $("#b-presets").innerHTML = [22, 25, 28].map(v => `<button class="pill" data-bset="${v}" aria-pressed="${b.on && Math.abs((b.tgt ?? 0) - v) < .1}">${v}°</button>`).join("");
  $("#b-watts").textContent = `${Math.round(b.watts)} W`;
  if (!BT.dirty && !document.activeElement?.closest?.("#b-timer")) {
    const P = benchPlan(), def = (() => { const a = new Date(); if (a.getHours() >= 7) a.setDate(a.getDate() + 1); a.setHours(7, 0, 0, 0); return a; })();
    const a = P.a && P.valid ? P.a : def, o = P.o && P.valid ? P.o : new Date(a.getTime() + 3600e3);
    const hhmm = d => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    $("#b-timer").innerHTML = `<div class="setting" style="border-top:0;padding-top:0"><div><b>Timer</b><p>${P.on && P.valid ? `<span class="tm-on">● ${P.when} · ${t1(P.temp)}°</span>` : "Warm the bench at a set time, e.g. tomorrow morning."}</p></div><label class="switch"><input type="checkbox" id="bt-on" aria-label="Bench timer" ${P.on && P.valid ? "checked" : ""}><span></span></label></div>
      <div class="bt-grid"><label class="field">Start<input type="datetime-local" id="bt-start" value="${toInput(a)}"></label><label class="field">Off at<input type="time" class="time" id="bt-end" value="${hhmm(o)}"></label></div>
      <div class="setting"><div><b>Temperature</b></div><div class="stepper sm"><button data-btt="-0.5" aria-label="Cooler">−</button><output class="num" id="bt-temp">${t1(P.temp)}°</output><button data-btt="0.5" aria-label="Warmer">+</button></div></div>
      <div class="seg seg4 mini" role="group" aria-label="Repeat" id="bt-rep" style="margin-top:12px">${REP.map(([v, l]) => `<button data-btrep="${v}" aria-pressed="${P.rep === v}">${l}</button>`).join("")}</div>
      <button class="btn" id="bt-save" style="margin-top:14px;width:100%">${P.on && P.valid ? "Update timer" : "Set timer"}</button>`;
  }
  if (!BX.data) bxLoad(); else bxRender();
}
async function bxLoad() {
  const R = hxRange(BX.kind, BX.anchor), id = ++BX.req;
  $("#bx-label").textContent = R.label; $("#bx-next").disabled = R.e > new Date();
  document.querySelectorAll("#bx-seg button").forEach(x => x.setAttribute("aria-pressed", x.dataset.bx === BX.kind));
  let d = null;
  if (!live) { const k = [], t = []; R.buckets.forEach((b, i) => { if (b > new Date()) return; const h = b.getHours(), on = R.bucket === "hour" ? (h >= 7 && h < 10) || (h >= 18 && h < 22) : true;
      k.push([b.getTime(), +(on ? (R.bucket === "hour" ? .1 : R.bucket === "day" ? .45 + (i % 3) * .2 : 12) : 0).toFixed(2)]); t.push([b.getTime(), +(on ? 24 + (i % 4) * .5 : 19).toFixed(1), 18.5, 26]); });
    d = { bench: k, series: { bench_temp: t }, prev: { bench: 3.1 }, price: .4176 }; }
  else { const q = new URLSearchParams({ start: R.s.toISOString(), end: R.e.toISOString(), pstart: R.ps.toISOString(), bucket: R.bucket }); d = await fetch("api/history?" + q).then(r => r.ok ? r.json() : null).catch(() => null); }
  if (id !== BX.req) return;
  BX.data = d; BX.range = R; bxRender();
}
function bxRender() {
  const R = BX.range, d = BX.data; if (!R) return;
  if (!d) { $("#bx-chart").innerHTML = `<p class="hx-empty">Couldn't load the history just now.</p>`; return; }
  const idx = new Map(R.buckets.map((b, i) => [b.getTime(), i]));
  const put = rows => { const a = Array(R.buckets.length).fill(null); for (const [t, ...v] of rows || []) { const i = idx.get(t); if (i !== undefined) a[i] = v.length === 1 ? v[0] : v; } return a; };
  const kwh = put(d.bench), tmp = put(d.series?.bench_temp), price = d.price || price0() || 0;
  const tk = kwh.reduce((a, v) => a + (v || 0), 0), w = bench().watts, hrs = w ? tk * 1000 / w : 0;
  const fmtH = h => { const m = Math.round(h * 60), H = Math.floor(m / 60), M = m % 60; return H ? `${H} h${M ? ` ${M} min` : ""}` : `${M} min`; };
  $("#bx-kpis").innerHTML = [
    ["Energy", tk ? `${tk.toFixed(tk >= 10 ? 1 : 2)}<small> kWh</small>` : "0<small> kWh</small>", d.prev?.bench ? `${d.prev.bench.toFixed(2)} kWh in ${R.prevName}` : "&nbsp;"],
    ["Cost", `€ ${(tk * price).toFixed(2)}`, `at € ${price.toFixed(4)}/kWh`],
    ["Heating time", hrs ? fmtH(hrs) : "–", `at ${Math.round(w)} W`],
  ].map(([l, v, sub]) => `<div class="stat"><span>${l}</span><b class="num">${v}</b><em>${sub}</em></div>`).join("");
  hxChart($("#bx-chart"), R, {
    bars: { vals: kwh, unit: "kWh", color: "var(--c-activity)" },
    lines: [{ key: "bench", vals: tmp.map(v => v && v[0]), color: "var(--c-measured)", name: "Bench", unit: "°C", right: true }],
    tip: i => [kwh[i] != null ? `<b>${(kwh[i] || 0).toFixed(2)} kWh</b> · € ${((kwh[i] || 0) * price).toFixed(2)}` : "No data", tmp[i] ? `<i style="background:var(--c-measured)"></i>Bench ${t1(tmp[i][0])}°` : ""],
  });
}
function bxShift(dir) { const a = new Date(BX.anchor); if (BX.kind === "day") a.setDate(a.getDate() + dir); else if (BX.kind === "week") a.setDate(a.getDate() + 7 * dir); else if (BX.kind === "month") { a.setDate(1); a.setMonth(a.getMonth() + dir); } else a.setFullYear(a.getFullYear() + dir); BX.anchor = a; bxLoad(); }

/* ---------- weather ---------- */
let wx = null;
const WXL = { "clear-night": "Clear", cloudy: "Cloudy", fog: "Fog", hail: "Hail", lightning: "Thunder", "lightning-rainy": "Thunderstorms", partlycloudy: "Partly cloudy", pouring: "Heavy rain", rainy: "Rain", snowy: "Snow", "snowy-rainy": "Sleet", sunny: "Sunny", windy: "Windy", "windy-variant": "Windy", exceptional: "Unusual" };
function wxIcon(c, night) {
  const cloud = '<path d="M7.5 18.5h9.25a3.75 3.75 0 0 0 .4-7.48A5.5 5.5 0 0 0 6.6 11.6 3.5 3.5 0 0 0 7.5 18.5z"/>';
  const sun = (x = 12, y = 12, r = 4) => `<g class="sun"><circle cx="${x}" cy="${y}" r="${r}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const t = a * Math.PI / 180, c1 = Math.cos(t), s1 = Math.sin(t); return `<path d="M${(x + c1 * (r + 2.2)).toFixed(1)} ${(y + s1 * (r + 2.2)).toFixed(1)}L${(x + c1 * (r + 4)).toFixed(1)} ${(y + s1 * (r + 4)).toFixed(1)}"/>`; }).join("")}</g>`;
  const moon = '<path class="sun" d="M16.5 14.5A6.5 6.5 0 0 1 9.5 5a6.5 6.5 0 1 0 7 9.5z"/>';
  const drops = n => [8.5, 12, 15.5].slice(0, n).map(x => `<path class="rain" d="M${x} 20.5l-.8 2"/>`).join("");
  const g = {
    sunny: sun(), "clear-night": moon,
    partlycloudy: (night ? '<path class="sun" d="M11 7.6A3.6 3.6 0 0 1 7.2 2.8 3.8 3.8 0 1 0 11 7.6z"/>' : sun(8, 7.5, 2.8)) + cloud,
    cloudy: cloud, fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
    rainy: cloud + drops(3), pouring: cloud + drops(3) + '<path class="rain" d="M10.3 20.5l-.8 2M13.8 20.5l-.8 2"/>',
    snowy: cloud + '<g class="rain"><circle cx="9" cy="21.5" r=".6"/><circle cx="12.5" cy="21.5" r=".6"/><circle cx="16" cy="21.5" r=".6"/></g>',
    "snowy-rainy": cloud + '<path class="rain" d="M9 20.5l-.8 2"/><circle class="rain" cx="13" cy="21.5" r=".6"/><path class="rain" d="M16 20.5l-.8 2"/>',
    lightning: cloud + '<path class="sun" d="M12.5 15l-2 3.5h3l-2 3.5"/>', "lightning-rainy": cloud + '<path class="sun" d="M12.5 15l-2 3.5h3l-2 3.5"/>' + drops(1),
    hail: cloud + '<g class="rain"><circle cx="9" cy="21.5" r=".8"/><circle cx="15" cy="21.5" r=".8"/></g>',
    windy: '<path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h8"/>',
  };
  return `<svg class="wxi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g[c] || g["windy-variant"] || cloud}</svg>`;
}
function demoWx() {
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); x.setHours(12, 0, 0, 0); return x.toISOString(); };
  const c = ["cloudy", "partlycloudy", "rainy", "partlycloudy", "sunny", "snowy-rainy"], hi = [9.7, 15.2, 13.3, 11.5, 7.7, 5.2], lo = [3.8, 3.3, 8.4, 6.1, 3.9, 0.4];
  const hourly = Array.from({ length: 24 }, (_, i) => { const x = new Date(); x.setMinutes(0, 0, 0); x.setHours(x.getHours() + i + 1); return { t: x.toISOString(), c: i < 5 ? "cloudy" : i < 12 ? "clear-night" : "partlycloudy", hi: +(9 - Math.sin(i / 4) * 4).toFixed(1) }; });
  return { now: { c: "cloudy", t: 8.9, h: 71, w: 19 }, daily: c.map((x, i) => ({ t: d(i), c: x, hi: hi[i], lo: lo[i], p: x.includes("rain") ? 2.4 : 0 })), hourly };
}
function renderWeather() {
  const el = $("#wx"); if (!el) return;
  const w = live ? wx : demoWx();
  if (!w || !w.daily?.length) { el.hidden = true; return; }
  el.hidden = false;
  const out = num(E.outT, NaN), cur = Number.isFinite(out) ? out : w.now?.t, today = w.daily[0];
  const hrs = (w.hourly || []).filter((_, i) => i % 2 === 1).slice(0, 8);
  const isNight = t => { const h = new Date(t).getHours(); return h < 7 || h >= 19; };
  el.innerHTML = `<div class="card-h"><h2>Weather</h2><span class="src">St. Gilgen · met.no</span></div>
    <div class="wx-grid">
      <div class="wx-now">${wxIcon(w.now?.c || today.c, isNight(Date.now()))}
        <div><div class="wx-t num">${typeof cur === "number" ? Math.round(cur) + "°" : "–"}</div><div class="wx-c">${WXL[w.now?.c || today.c] || ""}</div></div>
        <dl class="wx-kv"><dt>Today</dt><dd class="num">${Math.round(today.hi)}° / ${Math.round(today.lo)}°</dd>${w.now?.h != null ? `<dt>Humidity</dt><dd class="num">${Math.round(w.now.h)} %</dd>` : ""}${w.now?.w != null ? `<dt>Wind</dt><dd class="num">${Math.round(w.now.w)} km/h</dd>` : ""}</dl></div>
      <div class="wx-hours" aria-label="Next hours">${hrs.map(h => `<div><span>${new Date(h.t).toLocaleTimeString("en-GB", { hour: "2-digit" })}</span>${wxIcon(h.c, isNight(h.t))}<b class="num">${Math.round(h.hi)}°</b></div>`).join("")}</div>
      <div class="wx-days">${w.daily.slice(1, 6).map(d => `<div><span>${new Date(d.t).toLocaleDateString("en-GB", { weekday: "short" })}</span>${wxIcon(d.c)}<b class="num">${Math.round(d.hi)}°</b><em class="num">${Math.round(d.lo)}°</em>${d.p > 0.4 ? `<small class="num">${d.p.toFixed(d.p < 10 ? 1 : 0)} mm</small>` : `<small>&nbsp;</small>`}</div>`).join("")}</div>
    </div>`;
}
function renderToday() {
  const el = $("#today"); if (!el) return;
  const on = st(E.nightEn) === "on" && st(E.nStart) && st(E.nEnd);
  el.hidden = !on; if (!on) return;
  const mins = v => { const [h, m] = (v || "0:0").split(":").map(Number); return h * 60 + m; };
  const ns = mins(st(E.nStart)), ne = mins(st(E.nEnd));
  const wd = st(E.wakeStart) ? new Date(st(E.wakeStart)) : null, wk = wd ? wd.getHours() * 60 + wd.getMinutes() : ne;
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
  const pct = m => (m / 1440 * 100).toFixed(2) + "%";
  const seg = (a, b, c) => a <= b ? `<i class="${c}" style="left:${pct(a)};width:${pct(b - a)}"></i>` : `<i class="${c}" style="left:${pct(a)};width:${pct(1440 - a)}"></i><i class="${c}" style="left:0;width:${pct(b)}"></i>`;
  el.innerHTML = `<div class="card-h"><h2>Today</h2><button class="link" data-go="settings">Night</button></div>
    <div class="bar-wrap"><div class="bar">${seg(ns, wk, "n")}${seg(wk, ne, "w")}</div><span class="now" style="left:${pct(nm)}" aria-hidden="true"></span></div>
    <div class="ticks"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    <div class="keys"><div><i class="kn"></i>Night from<b class="num">${hm(st(E.nStart))}</b></div><div><i class="kw"></i>Warm-up<b class="num">${wd ? fmtT(wd) : "–"}</b></div><div><i class="kd"></i>Warm by<b class="num">${hm(st(E.nEnd))}</b></div></div>`;
}
function renderHome() {
  renderToday(); renderWeather();
  const rs = ROOMS.map(([r]) => room(r)).filter(x => typeof x.cur === "number");
  const avg = rs.reduce((a, x) => a + x.cur, 0) / (rs.length || 1);
  $("#h-temp").innerHTML = rs.length ? `${t1(avg)}<sup>°C</sup>` : "–";
  const [title, tone, sub, note] = situation();
  $("#h-status").textContent = title; $("#h-dot").className = tone === "ok" ? "" : tone;
  $("#h-sub").textContent = sub;
  const facts = [];
  const ot = num(E.outT, NaN), oel = $("#h-out"); oel.hidden = !Number.isFinite(ot); if (Number.isFinite(ot)) oel.querySelector("b").textContent = `${t1(ot)}°`;
  $("#h-rooms").innerHTML = SHORT.map(([r, n]) => { const x = room(r), bad = Number.isFinite(x.co2) && x.co2 >= co2Limit();
    return `<button data-room="${r}" aria-label="${x.name} ${typeof x.cur === "number" ? t1(x.cur) + " degrees" : ""}, ${x.text}"><span>${n}</span><b class="num">${typeof x.cur === "number" ? t1(x.cur) + "°" : "–"}</b><i class="${bad ? "air" : x.state}"></i></button>`; }).join("");
  { const b = bench(); $("#h-bench").innerHTML = `<button data-go="bench" class="bench-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h18M5 13V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M4 13v6M20 13v6M4 17h16"/></svg><span class="bn">Bench warmer<em>${b.on ? `${b.text} · set to ${t1(b.tgt ?? 0)}°` : (() => { const P = benchPlan(); return P.on && P.valid ? `Timer · ${P.when}` : b.text; })()}</em></span><b class="num">${typeof b.cur === "number" ? t1(b.cur) + "°" : "–"}</b><i class="${b.state}"></i><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></button>`; }
  const stuffy = ROOMS.map(([r]) => room(r)).filter(x => Number.isFinite(x.co2) && x.co2 >= co2Limit());
  const an = $("#h-air"); an.hidden = !stuffy.length;
  if (stuffy.length) { const names = stuffy.map(x => x.name.toLowerCase()), list = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0];
    an.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/></svg><span><b>Time to air the ${list}</b><br><em>CO₂ ${stuffy.map(x => Math.round(x.co2).toLocaleString("en-GB")).join(" · ")} ppm · a few minutes with the window open</em></span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>`; }
  const dd = (live ? (costData?.days || []) : demoDays()).filter(d => typeof d.eur === "number" && d.eur > 0);
  if (dd.length) { const d = dd[dd.length - 1], dt = new Date(d.start), yd = new Date(); yd.setDate(yd.getDate() - 1);
    const lbl = dt.toDateString() === yd.toDateString() ? "yesterday" : dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    facts.push(`<span><b class="num">€ ${d.eur.toFixed(2)}</b> ${lbl}</span>`); }
  $("#h-facts").innerHTML = facts.join("");
  $("#h-eyebrow").textContent = `St. Gilgen · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`;
  const m = st(E.mode);
  $("#seg").innerHTML = SEG.map(([v, l]) => `<button data-mode="${v}" aria-pressed="${m === v}">${l}</button>`).join("");
  $("#mode-note").textContent = note;
  $("#p-boost").setAttribute("aria-pressed", m === "Boost"); $("#p-frost").setAttribute("aria-pressed", m === "Frost protection");
  $("#p-boost-t").textContent = m === "Boost" ? "Stop boost" : `Boost +${num(E.boostInc, 2)}° · ${num(E.boostDur, 2)} h`;
  // people: avatars in the hero, list in the card
  const ava = (id, n, cls = "") => { const pic = picture(id), [pc] = presence(id); return `<div class="ava ${pc} ${cls}" ${pic ? `style="background-image:url('${pic}')"` : ""} title="${n}">${pic ? "" : n[0]}<b></b></div>`; };
  $("#h-people").innerHTML = E.people.filter(([id]) => st(id) && st(id) !== "unknown").map(([id, n]) => ava(id, n)).join("");
  void E.people.map(([id, n]) => `<div class="p">${ava(id, n)}<div><b style="font-weight:500">${n}</b><span>${presence(id)[1]}</span></div></div>`).join("");
  // stay timeline
  const planned = st(E.planned) === "on", arr = parseHA(st(E.arr)), dep = parseHA(st(E.dep)), start = new Date(st(E.start)), stop = new Date(st(E.stop)), now = Date.now();
  if (!planned || !arr || !dep) { $("#h-stay").innerHTML = `<p class="note">No stay planned. The flat rests at ${num(E.away, 5)} °C.</p>`; }
  else {
    const steps = [["Heat on", start], ["Arrive", arr], [`${num(E.away, 5)} °C`, stop], ["Leave", dep]];
    const idx = steps.filter(s => s[1] <= now).length;
    $("#h-stay").innerHTML = `<div class="tl"><i class="bar" style="width:calc(${Math.max(0, idx - 1) / 3 * 100}% - ${idx > 1 ? 4 : 0}px)"></i>${steps.map(([l, d], i) => `<div class="${i < idx ? "done" : ""}"><span>${l}</span><b class="num">${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b><span class="num">${fmtT(d)}</span></div>`).join("")}</div>`;
  }
  drawModel();
  if ($("#plan-home")) renderPlan($("#plan-home"), planLook(), { mini: true });
}

function planLook() {
  const look = r => {
    if (!r.heated) return {};
    const x = room(r.id);
    return { cls: `${x.state}${sheetRoom === r.id ? " sel" : ""}`, label: typeof x.cur === "number" ? `${t1(x.cur)}°` : "–", hot: x.heating };
  };
  look.fire = true;
  return look;
}

function drawModel() {
  const M = window.SW3D; if (!M) return;
  document.body.classList.add("has3d");
  const host = currentTab === "rooms" ? $("#m3d-rooms") : $("#m3d-home");
  if (!host || !host.offsetParent) return;
  host.querySelector(".m3d-labels").dataset.compact = host.clientWidth < 560 ? "1" : "";
  M.mount(host, { interactive: true });
  const looks = {};
  for (const [r] of ROOMS) { const x = room(r); looks[r] = { state: x.state, label: typeof x.cur === "number" ? `${t1(x.cur)}°` : "–", name: x.name, selected: sheetRoom === r, online: x.online, heating: x.heating }; }
  { const b = bench(); if (states[E.bench]) looks.bench = { state: b.state === "hot" ? "hot" : "", label: typeof b.cur === "number" ? `${t1(b.cur)}°` : "–", name: "Bench", small: true, go: "bench", online: b.online, heating: b.heating }; }
  M.update(looks);
}
addEventListener("m3d-ready", () => drawModel());
function renderRooms() {
  drawModel();
  renderPlan($("#plan-rooms"), planLook());
  $("#rooms").innerHTML = ROOMS.map(([r]) => {
    const x = room(r);
    const air = airLine(x);
    return `<button class="room" data-room="${r}"><b>${x.name}</b><span class="meta"><span class="st"><i class="dot ${x.state}"></i>${x.text}${x.online && !x.text.includes("warm by") ? `<span class="set"><span class="sep"> · </span>${t1(x.tgt)}°</span>` : ""}</span>${air}</span><span class="t num">${typeof x.cur === "number" ? t1(x.cur) + "°" : "–"}<small>now</small></span></button>`;
  }).join("");
}

/* room sheet */
let sheetRoom = null;
function openRoom(r) { sheetRoom = r; renderSheet(); const d = $("#sheet"); if (!d.open) d.showModal(); renderRooms(); renderHome(); }
function renderSheet() {
  const x = room(sheetRoom);
  $("#sheet-in").innerHTML = `<div class="grab"></div>
    <div class="row"><div><div class="eyebrow">${x.text}</div><h1 id="sh-name">${x.name}</h1></div><button class="link" data-close aria-label="Close">Done</button></div>
    <div class="row" style="align-items:flex-end"><div class="big num">${typeof x.cur === "number" ? t1(x.cur) : "–"}<span style="font-size:.4em;color:var(--ink-3)">°C</span></div><div class="small muted" style="text-align:right">floor ${t1(num(E.floor(x.r)))}°<br>comfort ${t1(x.cf)}°</div></div>
    <div class="row"><div><b style="font-weight:500">Set to</b><p class="note">For now. Auto may change it with the next situation.</p></div>
      <div class="stepper"><button data-step="-0.5" aria-label="Cooler">−</button><output class="num">${t1(x.tgt ?? 0)}°</output><button data-step="0.5" aria-label="Warmer">+</button></div></div>
    <dl class="kv"><dt>Thermostat</dt><dd>${{ MANUAL: "Manual", VACATION: "Lowered", PAUSE: "Frost-safe (lowered)", SCHEDULE: "Schedule", OVERRIDE: "Override" }[x.preset] || x.preset || "–"}</dd>
      <dt>Wi-Fi signal</dt><dd class="num" style="color:${num(E.wifi(x.r)) < -70 ? "var(--warn)" : "inherit"}">${num(E.wifi(x.r))} dBm${num(E.wifi(x.r)) < -70 ? " · weak" : ""}</dd>
      ${Number.isFinite(x.hum) ? `<dt>Humidity</dt><dd class="num">${Math.round(x.hum)} %</dd>` : ""}
      ${Number.isFinite(x.co2) ? `<dt>CO₂</dt><dd class="num" style="color:${x.co2 >= 1400 ? "var(--warn)" : "inherit"}">${Math.round(x.co2)} ppm${x.co2 >= 1400 ? " · open a window for a few minutes" : ""}</dd>` : ""}
      <dt>Energy, 30 days</dt><dd class="num">${Math.round(num(E.energy(x.r)))} kWh</dd></dl>
    <button class="btn ghost" data-go="settings" data-close>Change comfort temperature</button>`;
}

function renderStay() {
  if (document.activeElement?.closest?.("#v-stay")) return;
  $("#st-on").checked = st(E.planned) === "on";
  $("#st-arr").value = toInput(parseHA(st(E.arr)));
  $("#st-dep").value = toInput(parseHA(st(E.dep)));
  $("#st-away").textContent = `${num(E.away, 5)} °C`;
  stayPreview();
}
function stayPreview() {
  const a = new Date($("#st-arr").value), d = new Date($("#st-dep").value), ph = num(E.preheat, 3), sb = num(E.stopBefore, 1);
  const bad = !(a < d);
  $("#st-check").textContent = bad ? "Departure must be after arrival." : `${Math.round((d - a) / 864e5 * 10) / 10} days in the flat.`;
  $("#st-check").style.color = bad ? "var(--bad)" : "";
  $("#st-plan").innerHTML = bad ? "" : `<dt>Heating starts</dt><dd class="num">${fmtD(new Date(a - ph * H))}</dd><dt>Comfortable by</dt><dd class="num">${fmtD(a)}</dd>
    <dt>While you're out</dt><dd>each room −${num(E.drop, 2)} °C</dd><dt>Down to ${num(E.away, 5)} °C</dt><dd class="num">${fmtD(new Date(d - sb * H))}</dd><dt>Departure</dt><dd class="num">${fmtD(d)}</dd>`;
}

function price() { const p = live ? (costData?.price?.eur_per_kwh ?? parseFloat(st(E.price))) : parseFloat(st(E.price)); return isNaN(p) ? 0 : p; }
function demoDays() { const out = [], t = new Date(); t.setHours(0, 0, 0, 0); for (let i = 30; i >= 1; i--) { const home = i <= 2 || (i >= 12 && i <= 16), kwh = home ? 52 + (i % 3) * 4 : 1.4 + (i % 4) * .1; out.push({ start: +new Date(t - i * 864e5), kwh, eur: kwh * .4176 }); } return out; }
function renderInsights() {
  const rate = num(E.rate, .5), margin = num(E.margin, 1), away = num(E.away, 5), p = price();
  const comfort = ROOMS.reduce((a, [r]) => a + num(E.comfort(r), 20), 0) / ROOMS.length;
  const last = st(E.last);
  $("#in-curve").textContent = `The flat warms up by about ${rate.toFixed(2)} °C an hour. Each warm-up from a lowered temperature is measured and blended in, and the planner starts heating that much earlier, plus ${margin} h to be safe. ${last && last !== "unknown" ? "Last measurement: " + last + "." : "No warm-up measured yet."}`;
  $("#health").innerHTML = ROOMS.map(([r, n]) => { const x = room(r), w = num(E.wifi(r)); return `<dt>${n}</dt><dd style="color:${!x.online ? "var(--bad)" : w < -70 ? "var(--warn)" : "var(--ok)"}">${x.online ? "Online" : "Offline"} · <span class="num">${w} dBm</span></dd>`; }).join("");
  const weak = ROOMS.filter(([r]) => num(E.wifi(r)) < -70).map(x => x[1]);
  $("#health-note").textContent = weak.length ? `${weak.join(", ")}: weak Wi-Fi. An eero closer to it would stop the dropouts.` : "All thermostats have good Wi-Fi.";
}

const SETTINGS = [
  [E.away, "Away temperature", "Between stays and after departure.", 5, 12, .5, "°C"],
  [E.drop, "Out for the day", "How much each room drops while everyone is out.", .5, 6, .5, "°C"],
  [E.boostInc, "Boost", "Extra warmth after skiing or a swim.", 1, 5, .5, "°C"],
  [E.boostDur, "Boost length", "Then back to the previous mode.", .5, 6, .5, "h"],
  [E.margin, "Extra pre-heat time", "On top of the learned warm-up time.", 0, 6, .5, "h"],
  [E.stopBefore, "Stop before departure", "Floors stay warm for hours anyway.", 0, 6, .5, "h"],
];
function windowSwitches() { return Object.values(states).filter(s => s.entity_id.startsWith("switch.") && / Floor Heating Switch Window detection$/.test(s.attributes?.friendly_name || "")); }
function renderSettings() {
  if (document.activeElement?.closest?.("#settings,#comfort,#night,#co2set")) return;
  $("#settings").innerHTML = SETTINGS.map(([id, l, d, mi, ma, s, u], i) => `<div class="setting"><div><b>${l}</b><p>${d}</p></div><output class="num" id="o${i}">${num(id)} ${u}</output><input type="range" id="s${i}" aria-label="${l}" min="${mi}" max="${ma}" step="${s}" value="${num(id)}" data-set="${i}"></div>`).join("") +
    `<div class="setting"><div><b>Electricity price</b><p>From your income and expense app.</p></div><output class="num">${price() ? price().toFixed(4) : "–"} €/kWh</output></div>`;
  const stp = (r, n, kind, v) => `<div class="stepper sm"><button aria-label="${n} ${kind} cooler" data-${kind === "day" ? "comfort" : "night"}="-0.5" data-room="${r}">−</button><output class="num">${t1(v)}°</output><button aria-label="${n} ${kind} warmer" data-${kind === "day" ? "comfort" : "night"}="0.5" data-room="${r}">+</button></div>`;
  $("#comfort").innerHTML = `<div class="dn-head"><span></span><span>Day</span><span>Night</span></div>` + ROOMS.map(([r, n]) => `<div class="dn"><div><b>${n}</b><p>Warms ${t1(num(E.rateR(r), .5))} °C/h</p></div>${stp(r, n, "day", num(E.comfort(r)))}${stp(r, n, "night", num(E.night(r), 18))}</div>`).join("");
  const w = st(E.wakeStart), en = st(E.nightEn) !== "off";
  $("#night").innerHTML = `<div class="setting"><div><b>Night temperatures</b><p>During a stay, from night start until the morning warm-up.</p></div><label class="switch"><input type="checkbox" id="n-en" aria-label="Night temperatures" ${en ? "checked" : ""}><span></span></label></div>
    <div class="setting"><div><b>Night starts</b></div><input type="time" class="time" id="n-start" value="${hm(st(E.nStart))}" aria-label="Night starts"></div>
    <div class="setting"><div><b>Warm by</b><p>${w ? `Tonight the floors start warming at <b class="num">${fmtT(new Date(w))}</b>, worked out from each room's temperature and how fast it warms up.` : "When you get up."}</p></div><input type="time" class="time" id="n-end" value="${hm(st(E.nEnd))}" aria-label="Warm by"></div>`;
  const lim = co2Limit(), on = st(E.co2On) !== "off";
  $("#co2set").innerHTML = `<div class="setting"><div><b>CO₂ alert</b><p>A note on Home and a quiet push when a room stays above the limit for 10 minutes while someone is in the flat. Never 22:00–07:30, at most every 90 minutes.</p></div><label class="switch"><input type="checkbox" id="co2-on" aria-label="CO2 alert" ${on ? "checked" : ""}><span></span></label></div>
    <div class="setting"><div><b>Limit</b><p>Below 1,000 ppm is fresh; above 1,400 people feel tired.</p></div><div class="stepper sm"><button aria-label="Lower limit" data-co2lim="-100">−</button><output class="num">${Math.round(lim).toLocaleString("en-GB")}</output><button aria-label="Higher limit" data-co2lim="100">+</button></div></div>` +
    `<div style="padding-top:10px;font-size:12.5px;color:var(--ink-3)">Push to</div>` +
    E.pushDev.map(([d, n, m]) => `<div class="co2-dev"><div><b>${n}</b><p>${m}</p></div><label class="switch"><input type="checkbox" data-push="${d}" aria-label="Push to ${n} ${m}" ${st(`input_boolean.stg_co2_push_${d}`) !== "off" ? "checked" : ""} ${on ? "" : "disabled"}><span></span></label></div>`).join("");
  const th = lsGet("theme") || "auto";
  $("#theme-seg").innerHTML = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => `<button data-theme-pick="${v}" aria-pressed="${th === v}">${l}</button>`).join("");
  const ws = windowSwitches(); $("#set-window").checked = ws.length ? ws.every(s => s.state === "on") : true;
}

setTheme(lsGet("theme") || "auto");

/* ---------- Insights explorer: day / week / month / year ---------- */
const HXS = {
  out: ["Outside", "var(--s-out)"],
  air_kitchen: ["Dining room", "var(--s-dining)"], air_bathroom: ["Bathroom", "var(--s-bath)"], air_bedroom: ["Bedroom", "var(--s-bed)"],
  floor_living_room: ["Living room floor", "var(--s-living)", true], floor_kitchen: ["Dining room floor", "var(--s-dining)", true], floor_hall: ["Hall floor", "var(--s-hall)", true],
  floor_bathroom: ["Bathroom floor", "var(--s-bath)", true], floor_bedroom: ["Bedroom floor", "var(--s-bed)", true],
};
const HXA = { kitchen: ["Dining room", "var(--s-dining)"], bathroom: ["Bathroom", "var(--s-bath)"], bedroom: ["Bedroom", "var(--s-bed)"] };
const HX = { kind: lsGet("hx.kind") || "month", anchor: new Date(), data: null, air: lsGet("hx.air") || "hum", req: 0,
  tsel: new Set((lsGet("hx.t") || "out,air_kitchen,air_bedroom").split(",").filter(k => HXS[k])) };

function hxShift(dir) {
  const a = new Date(HX.anchor);
  if (HX.kind === "day") a.setDate(a.getDate() + dir); else if (HX.kind === "week") a.setDate(a.getDate() + 7 * dir);
  else if (HX.kind === "month") { a.setDate(1); a.setMonth(a.getMonth() + dir); } else a.setFullYear(a.getFullYear() + dir);
  HX.anchor = a; hxLoad();
}

function hxDemo(R) {
  const seed = i => (Math.sin(i * 12.9898) * 43758.5453) % 1, rnd = i => Math.abs(seed(i));
  const at = d => d.getTime(), now = Date.now();
  const kwh = [], eur = [], ser = Object.fromEntries(Object.keys(HXS).concat(["hum_kitchen", "hum_bathroom", "hum_bedroom", "co2_kitchen", "co2_bathroom", "co2_bedroom"]).map(k => [k, []]));
  R.buckets.forEach((b, i) => {
    if (at(b) > now) return;
    const per = R.bucket === "hour" ? 1 : R.bucket === "day" ? 24 : 24 * 30, hr = b.getHours(), m = b.getMonth();
    const cold = R.bucket === "month" ? [1, .9, .7, .4, .15, .05, .03, .03, .1, .35, .7, .95][m] : .55;
    const base = R.bucket === "hour" ? (hr >= 4 && hr < 8 ? 2.4 : hr >= 22 || hr < 4 ? .3 : .9) : per * .9 * cold * (.7 + rnd(i) * .6);
    const k = +(base * (R.bucket === "hour" ? .9 + rnd(i) * .3 : 1)).toFixed(2);
    kwh.push([at(b), k]); eur.push([at(b), +(k * .4176).toFixed(2)]);
    const out = R.bucket === "month" ? [0, 2, 6, 11, 15, 19, 21, 20, 16, 11, 5, 1][m] : R.bucket === "hour" ? 6 + 4 * Math.sin((hr - 9) / 24 * 2 * Math.PI) : 8 + 4 * Math.sin(i / 3);
    ser.out.push([at(b), +out.toFixed(1), +(out - 3).toFixed(1), +(out + 3).toFixed(1)]);
    for (const [key, base2] of [["air_kitchen", 20.2], ["air_bathroom", 20.1], ["air_bedroom", 18.3], ["floor_living_room", 23.5], ["floor_kitchen", 22.4], ["floor_hall", 22.8], ["floor_bathroom", 24.6], ["floor_bedroom", 21.2]]) {
      const v = base2 + (R.bucket === "hour" ? (hr >= 22 || hr < 5 ? -1.2 : hr < 8 ? -.4 : 0) : (rnd(i + key.length) - .5) * .8);
      ser[key].push([at(b), +v.toFixed(1), +(v - .5).toFixed(1), +(v + .5).toFixed(1)]);
    }
    for (const [key, h, c] of [["kitchen", 58, 1500], ["bathroom", 55, 900], ["bedroom", 52, 1100]]) {
      ser["hum_" + key].push([at(b), +(h + (rnd(i * 3 + h) - .5) * 8).toFixed(0)]);
      ser["co2_" + key].push([at(b), Math.round(c * (R.bucket === "hour" && hr >= 0 && hr < 7 && key === "bedroom" ? 1.4 : .8 + rnd(i * 7 + c) * .5))]);
    }
  });
  const pk = kwh.reduce((a, x) => a + x[1], 0) * (.8 + rnd(7) * .4);
  const share = { living_room: .34, kitchen: .14, hall: .27, bathroom: .14, bedroom: .11 };
  const rooms = Object.fromEntries(Object.entries(share).map(([r, f]) => [r, kwh.map(([t, k]) => [t, +(k * f * .9).toFixed(2)])]));
  const bench = kwh.map(([t, k]) => [t, +(k * .04).toFixed(2)]);
  return { kwh, eur, prev: { kwh: +pk.toFixed(1), eur: +(pk * .4176).toFixed(1), has: true }, series: ser, price: .4176, rooms, bench };
}

async function hxLoad() {
  const R = hxRange(HX.kind, HX.anchor), id = ++HX.req;
  $("#hx-label").textContent = R.label;
  $("#hx-next").disabled = R.e > new Date();
  document.querySelectorAll("#hx-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.hx === HX.kind));
  $("#v-insights").classList.add("hx-loading");
  let d = null;
  if (!live) d = hxDemo(R);
  else {
    const q = new URLSearchParams({ start: R.s.toISOString(), end: R.e.toISOString(), pstart: R.ps.toISOString(), bucket: R.bucket });
    d = await fetch("api/history?" + q).then(r => r.ok ? r.json() : null).catch(() => null);
  }
  if (id !== HX.req) return;
  HX.data = d; HX.range = R;
  $("#v-insights").classList.remove("hx-loading");
  hxRender();
}

function hxRender() {
  const R = HX.range, d = HX.data;
  if (!R || !$("#hx-kpis")) return;
  if (!d) { $("#hx-kpis").innerHTML = ""; ["#hx-energy", "#hx-temp", "#hx-air"].forEach(s => $(s).innerHTML = `<p class="hx-empty">Couldn't load the history just now.</p>`); return; }
  const idx = new Map(R.buckets.map((b, i) => [b.getTime(), i]));
  const put = rows => { const a = Array(R.buckets.length).fill(null); for (const [t, ...v] of rows || []) { const i = idx.get(t); if (i !== undefined) a[i] = v.length === 1 ? v[0] : v; } return a; };
  const kwh = put(d.kwh), eurRaw = put(d.eur), price = d.price || price0();
  const est = kwh.map((k, i) => k != null && eurRaw[i] == null);
  const eur = kwh.map((k, i) => eurRaw[i] ?? (k != null && price ? k * price : null));
  const tk = kwh.reduce((a, v) => a + (v || 0), 0), te = eur.reduce((a, v) => a + (v || 0), 0), anyEst = est.some(Boolean);
  const out = put(d.series.out), outMeans = out.filter(Boolean).map(v => v[0]).filter(v => v != null);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const inside = ["air_kitchen", "air_bathroom", "air_bedroom"].flatMap(k => put(d.series[k]).filter(Boolean).map(v => v[0])).filter(v => v != null);
  const days = R.bucket === "hour" ? 1 : R.bucket === "day" ? kwh.filter(v => v != null).length : null;
  const fmtE = v => v >= 100 ? Math.round(v).toLocaleString("en-GB") : v.toFixed(v >= 10 ? 1 : 2);
  const cmp = (cur, prev, unit) => !d.prev?.has || !prev ? "" : R.e > new Date()
    ? `${unit === "€" ? "€ " + fmtE(prev) : fmtE(prev) + " kWh"} in ${R.prevName}`
    : `<span class="${cur > prev ? "up" : "down"}">${cur > prev ? "▲" : "▼"} ${Math.abs(Math.round((cur - prev) / prev * 100))}%</span> vs ${R.prevName}`;
  $("#hx-kpis").innerHTML = [
    ["Electricity", tk ? `${fmtE(tk)}<small> kWh</small>` : "–", cmp(tk, d.prev?.kwh, "kWh")],
    ["Cost", te ? `${anyEst ? "≈ " : ""}€ ${fmtE(te)}` : "–", cmp(te, d.prev?.eur, "€")],
    ["Outside", outMeans.length ? `${t1(avg(outMeans))}<small> °C</small>` : "–", outMeans.length ? `low ${Math.round(Math.min(...out.filter(Boolean).map(v => v[1] ?? v[0])))}° · high ${Math.round(Math.max(...out.filter(Boolean).map(v => v[2] ?? v[0])))}°` : "average"],
    days && te ? ["Per day", `€ ${(te / days).toFixed(2)}`, `${fmtE(tk / days)} kWh a day`] : ["Inside", inside.length ? `${t1(avg(inside))}<small> °C</small>` : "–", "average, rooms with a sensor"],
  ].map(([l, v, sub]) => `<div class="stat"><span>${l}</span><b class="num">${v}</b><em>${sub || "&nbsp;"}</em></div>`).join("");
  { const eff = tk > 0 && te > 0 ? te / tk : price || 0;
    const rows = ROOMS.map(([r, n]) => [n, (d.rooms?.[r] || []).filter(([t]) => idx.has(t)).reduce((a, [, v]) => a + Math.max(0, v || 0), 0)]);
    const bk = (d.bench || []).filter(([t]) => idx.has(t)).reduce((a, [, v]) => a + Math.max(0, v || 0), 0);
    if (bk > 0) rows.push(["Bench", bk]);
    const sumR = rows.reduce((a, [, v]) => a + v, 0), max = Math.max(...rows.map(x => x[1]), .001);
    $("#in-price").textContent = `${R.label}${eff ? ` · € ${eff.toFixed(4).replace(/0+$/, "")}/kWh` : ""}`;
    $("#ebars").innerHTML = sumR > 0 ? rows.map(([n, v]) => `<div class="ebar"><span>${n}</span><div class="track"><div class="fill" style="width:${v / max * 100}%"></div></div><span class="v num">${v >= 10 ? Math.round(v) : v.toFixed(1)} kWh · €${(v * eff).toFixed(v * eff >= 10 ? 0 : 2)}</span></div>`).join("") +
      (tk > 0 ? `<p class="note" style="margin-top:10px">Floor heating is ${Math.round(Math.min(100, sumR / tk * 100))}% of the flat's electricity in this period${anyEst ? " (cost estimated)" : ""}.</p>` : "")
      : `<p class="hx-empty" style="padding:24px 0">No room data for this period.</p>`; }
  $("#hx-e-note").textContent = anyEst ? "≈ before Sept: kWh × current price" : "smart meter, a day behind";
  hxChart($("#hx-energy"), R, {
    bars: { vals: kwh, est, unit: "kWh", color: "var(--c-activity)" },
    lines: [{ key: "out", vals: out.map(v => v && v[0]), band: out.map(v => v && [v[1], v[2]]), color: "var(--s-out)", name: "Outside", unit: "°C", right: true }],
    tip: i => [kwh[i] != null ? `<b>${fmtE(kwh[i])} kWh</b> · ${est[i] ? "≈ " : ""}€ ${(eur[i] || 0).toFixed(2)}` : "No meter data", out[i] ? `<i style="background:var(--s-out)"></i>Outside ${t1(out[i][0])}°` : ""],
  });
  // temperatures
  $("#hx-tchips").innerHTML = Object.entries(HXS).map(([k, [n, c, floor]]) => `<button class="chip${floor ? " floor" : ""}" data-hxt="${k}" aria-pressed="${HX.tsel.has(k)}"><i style="background:${c}"></i>${n}</button>`).join("");
  const tl = [...HX.tsel].map(k => ({ key: k, vals: put(d.series[k]).map(v => v && v[0]), band: k === "out" ? put(d.series.out).map(v => v && [v[1], v[2]]) : null, color: HXS[k][1], name: HXS[k][0], dashed: !!HXS[k][2], unit: "°C" }));
  hxChart($("#hx-temp"), R, { lines: tl, tip: i => tl.map(l => l.vals[i] != null ? `<i style="background:${l.color}"></i>${l.name} ${t1(l.vals[i])}°` : "") });
  // air
  const ak = HX.air === "co2" ? "co2" : "hum";
  document.querySelectorAll("#hx-air-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.hxair === ak));
  const al = Object.entries(HXA).map(([r, [n, c]]) => ({ key: r, vals: put(d.series[`${ak}_${r}`]).map(v => Array.isArray(v) ? v[0] : v), color: c, name: n, unit: ak === "co2" ? "ppm" : "%" }));
  hxChart($("#hx-air"), R, { lines: al, threshold: ak === "co2" ? [1400, "Air it"] : null, fixed: ak === "hum" ? [20, 80] : null,
    tip: i => al.map(l => l.vals[i] != null ? `<i style="background:${l.color}"></i>${l.name} ${Math.round(l.vals[i])}${ak === "co2" ? " ppm" : " %"}` : "") });
  $("#hx-air-legend").innerHTML = al.map(l => `<span><i style="background:${l.color}"></i>${l.name}</span>`).join("");
}
function price0() { const p = parseFloat(st(E.price)); return isNaN(p) ? null : p; }

let hxRz; addEventListener("resize", () => { clearTimeout(hxRz); hxRz = setTimeout(() => { if (currentTab === "insights") hxRender(); if (currentTab === "bench") bxRender(); }, 160); });

/* ---------- navigation ---------- */
$("#tab-nav").innerHTML = navHTML(NAV); $("#rail-nav").innerHTML = navHTML(NAV);
let currentTab = "home";
function go(tab) {
  if (!NAV.some(n => n[0] === tab)) tab = "home";
  currentTab = tab;
  document.querySelectorAll(".nav").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "v-" + tab);
  lsSet("tab", tab); window.scrollTo(0, 0); render();
  if (tab === "insights") hxLoad();
  if (tab === "bench") { BX.data = null; BT.dirty = false; renderBench(); }
}

/* ---------- interaction ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("button,[data-room]");
  if (!t) { if (e.target === $("#sheet")) $("#sheet").close(); return; }
  if (t.dataset.tab) return go(t.dataset.tab);
  if (t.dataset.hx) { HX.kind = t.dataset.hx; lsSet("hx.kind", HX.kind); HX.anchor = new Date(); return hxLoad(); }
  if (t.dataset.bmode) { benchLocal(t.dataset.bmode === "heat"); await call("climate", "set_hvac_mode", { entity_id: E.bench, hvac_mode: t.dataset.bmode }); return toast(t.dataset.bmode === "heat" ? "Bench warmer on" : "Bench warmer off"); }
  if (t.dataset.bstep || t.dataset.bset) { const b = bench(), v = Math.min(40, Math.max(5, t.dataset.bset ? +t.dataset.bset : (b.tgt ?? 20) + parseFloat(t.dataset.bstep)));
    if (!b.on) { benchLocal(true); await call("climate", "set_hvac_mode", { entity_id: E.bench, hvac_mode: "heat" }); }
    if (states[E.bench]) { states[E.bench] = { ...states[E.bench], attributes: { ...states[E.bench].attributes, temperature: v } }; renderBench(); }
    await call("climate", "set_temperature", { entity_id: E.bench, temperature: v }); return toast(`Bench set to ${t1(v)} °C`); }
  if (t.dataset.btt) { const o = $("#bt-temp"), v = Math.min(40, Math.max(5, parseFloat(o.textContent) + parseFloat(t.dataset.btt))); o.textContent = `${t1(v)}°`; BT.dirty = true; return; }
  if (t.dataset.btrep) { document.querySelectorAll("#bt-rep button").forEach(x => x.setAttribute("aria-pressed", x === t)); BT.dirty = true; return; }
  if (t.id === "bt-save") {
    const a = new Date($("#bt-start").value), [h, m] = ($("#bt-end").value || "").split(":").map(Number);
    if (isNaN(a) || isNaN(h)) return toast("Pick a start and an end time");
    const o = new Date(a); o.setHours(h, m, 0, 0); if (o <= a) o.setDate(o.getDate() + 1);
    if (o <= new Date()) return toast("That time has already passed");
    const rep = document.querySelector('#bt-rep [aria-pressed="true"]')?.dataset.btrep || "Once", temp = parseFloat($("#bt-temp").textContent);
    await call("input_datetime", "set_datetime", { entity_id: E.bOnAt, datetime: haDT(a) });
    await call("input_datetime", "set_datetime", { entity_id: E.bOffAt, datetime: haDT(o) });
    await call("input_number", "set_value", { entity_id: E.bTemp, value: temp });
    await call("input_select", "select_option", { entity_id: E.bRep, option: rep });
    await call("input_boolean", "turn_on", { entity_id: E.bPlan });
    BT.dirty = false; t.blur(); renderBench(); return toast(`Timer set: ${benchPlan().when || `${fmtT(a)}–${fmtT(o)}`}`);
  }
  if (t.dataset.bx) { BX.kind = t.dataset.bx; lsSet("bx.kind", BX.kind); BX.anchor = new Date(); return bxLoad(); }
  if (t.id === "bx-prev") return bxShift(-1);
  if (t.id === "bx-next") return bxShift(1);
  if (t.id === "hx-prev") return hxShift(-1);
  if (t.id === "hx-next") return hxShift(1);
  if (t.dataset.hxt) { const k = t.dataset.hxt; HX.tsel.has(k) ? HX.tsel.delete(k) : HX.tsel.add(k); if (!HX.tsel.size) HX.tsel.add("out"); lsSet("hx.t", [...HX.tsel].join(",")); return hxRender(); }
  if (t.dataset.hxair) { HX.air = t.dataset.hxair; lsSet("hx.air", HX.air); return hxRender(); }
  if (t.dataset.themePick) { setTheme(t.dataset.themePick); return renderSettings(); }
  if (t.hasAttribute("data-close")) { $("#sheet").close(); }
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.mode) { await call("input_select", "select_option", { entity_id: E.mode, option: t.dataset.mode }); return toast(`Mode: ${SEG.find(s => s[0] === t.dataset.mode)[1]}`); }
  if (t.id === "p-boost") { const on = st(E.mode) === "Boost"; await call("input_select", "select_option", { entity_id: E.mode, option: on ? "Auto" : "Boost" }); return toast(on ? "Boost stopped" : `Boost +${num(E.boostInc, 2)} °C for ${num(E.boostDur, 2)} h`); }
  if (t.id === "p-frost") { const on = st(E.mode) === "Frost protection"; await call("input_select", "select_option", { entity_id: E.mode, option: on ? "Auto" : "Frost protection" }); return toast(on ? "Back to Auto" : "Frost protection only"); }
  if (t.dataset.step && sheetRoom) { const r = sheetRoom, v = Math.min(28, Math.max(5, (attr(E.climate(r), "temperature") || 20) + parseFloat(t.dataset.step))); await call("climate", "set_temperature", { entity_id: E.climate(r), temperature: v }); return toast(`${RN[r]} set to ${t1(v)} °C`); }
  if (t.dataset.comfort) { const r = t.dataset.room, v = Math.min(28, Math.max(10, num(E.comfort(r), 20) + parseFloat(t.dataset.comfort))); await call("number", "set_value", { entity_id: E.comfort(r), value: v }); t.blur(); renderSettings(); return toast(`${RN[r]} comfort ${t1(v)} °C`); }
  if (t.dataset.co2lim) { const v = Math.min(3000, Math.max(800, co2Limit() + parseFloat(t.dataset.co2lim))); await call("input_number", "set_value", { entity_id: E.co2Limit, value: v }); t.blur(); renderSettings(); return toast(`CO₂ limit ${v.toLocaleString("en-GB")} ppm`); }
  if (t.dataset.night) { const r = t.dataset.room, v = Math.min(25, Math.max(5, num(E.night(r), 18) + parseFloat(t.dataset.night))); await call("input_number", "set_value", { entity_id: E.night(r), value: v }); t.blur(); renderSettings(); return toast(`${RN[r]} at night ${t1(v)} °C`); }
  if (t.dataset.room) return openRoom(t.dataset.room);
  if (t.id === "st-save") { const a = new Date($("#st-arr").value), d = new Date($("#st-dep").value); if (!(a < d)) return toast("Departure must be after arrival");
    await call("input_datetime", "set_datetime", { entity_id: E.arr, datetime: haDT(a) }); await call("input_datetime", "set_datetime", { entity_id: E.dep, datetime: haDT(d) }); await call("input_boolean", "turn_on", { entity_id: E.planned }); t.blur(); renderStay(); return toast("Stay saved"); }
  if (t.id === "st-cancel") { await call("input_boolean", "turn_off", { entity_id: E.planned }); t.blur(); renderStay(); return toast("Stay cancelled"); }
  if (t.id === "st-leave") { $("#st-confirm").hidden = false; return; }
  if (t.id === "st-leave-no") { $("#st-confirm").hidden = true; return; }
  if (t.id === "st-leave-yes") { $("#st-confirm").hidden = true; await call("input_datetime", "set_datetime", { entity_id: E.dep, datetime: haDT(new Date()) }); await call("input_select", "select_option", { entity_id: E.mode, option: "Away" }); return toast(`Flat lowered to ${num(E.away, 5)} °C`); }
});
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".pin")) { e.preventDefault(); openRoom(e.target.dataset.room); } });
$("#sheet").addEventListener("close", () => { sheetRoom = null; renderRooms(); renderHome(); });
document.addEventListener("input", e => {
  const el = e.target;
  if (el.id === "st-arr" || el.id === "st-dep") stayPreview();
  if (el.dataset.set !== undefined) $("#o" + el.dataset.set).textContent = `${el.value} ${SETTINGS[el.dataset.set][6]}`;
});
document.addEventListener("change", async e => {
  const el = e.target;
  if (el.dataset.set !== undefined) { const [id, l] = SETTINGS[el.dataset.set]; await call("input_number", "set_value", { entity_id: id, value: parseFloat(el.value) }); el.blur(); toast(`${l} saved`); }
  if (el.id === "st-on") { await call("input_boolean", el.checked ? "turn_on" : "turn_off", { entity_id: E.planned }); toast(el.checked ? "Stay planned" : "Stay switched off"); }
  if (el.id === "bt-on") { if (el.checked) { el.checked = false; return $("#bt-save").click(); } await call("input_boolean", "turn_off", { entity_id: E.bPlan }); BT.dirty = false; el.blur(); renderBench(); return toast("Timer off"); }
  if (el.id === "bt-start" || el.id === "bt-end") BT.dirty = true;
  if (el.id === "co2-on") { await call("input_boolean", el.checked ? "turn_on" : "turn_off", { entity_id: E.co2On }); toast(el.checked ? "CO₂ alert on" : "CO₂ alert off"); }
  if (el.dataset.push) { await call("input_boolean", el.checked ? "turn_on" : "turn_off", { entity_id: `input_boolean.stg_co2_push_${el.dataset.push}` }); toast(`${el.checked ? "Pushes" : "No pushes"} to ${E.pushDev.find(x => x[0] === el.dataset.push)[1]}`); }
  if (el.id === "n-en") { await call("input_boolean", el.checked ? "turn_on" : "turn_off", { entity_id: E.nightEn }); toast(el.checked ? "Night temperatures on" : "Night temperatures off"); }
  if ((el.id === "n-start" || el.id === "n-end") && /^\d{2}:\d{2}$/.test(el.value)) { await call("input_datetime", "set_datetime", { entity_id: el.id === "n-start" ? E.nStart : E.nEnd, time: el.value + ":00" }); el.blur(); toast(el.id === "n-start" ? `Night from ${el.value}` : `Warm by ${el.value}`); }
  if (el.id === "set-window") { for (const sw of windowSwitches()) await call("switch", el.checked ? "turn_on" : "turn_off", { entity_id: sw.entity_id }); toast(`Open-window detection ${el.checked ? "on" : "off"}`); }
});

/* ---------- start ---------- */
go(location.hash.slice(1) || lsGet("tab") || "home");
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(render, 150); });
goLive().catch(console.warn);
setInterval(() => { if (!live) renderHome(); }, 60e3);
