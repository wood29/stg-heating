/* Wien Wärme: the Vienna house on the shared Wärme framework.
   Data comes from the NAS server (bridge.js), which talks to the Intellihome bridge on the Home Assistant Green.
   The bridge runs the weekly plans, warm-up learning, "warm by" and Boost; this page shows and changes them. */

const NAV = [
  ["home", "Home", '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ["rooms", "Rooms", '<path d="M3 4h18v16H3zM3 12h8V4M11 12v8M15 12h6"/>'],
  ["plan", "Plan", '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3M8 17h6"/>'],
  ["insights", "Insights", '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>'],
  ["settings", "Settings", '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'],
];
const DAYS = [["MO", "Mon"], ["DI", "Tue"], ["MI", "Wed"], ["DO", "Thu"], ["FR", "Fri"], ["SA", "Sat"], ["SO", "Sun"]];
const DAY_EN = Object.fromEntries(DAYS);
const ROOM_SHORT = { "Living Area": "Living", "Office": "Office", "Bedroom": "Bed", "Bathroom": "Bath", "Sauna": "Sauna", "Oli's Room": "Oli", "Walk-In Cupboard": "Cupboard" };
const SERIES = ["var(--s-out)", "var(--s-dining)", "var(--s-bath)", "var(--s-bed)", "var(--s-living)", "var(--s-hall)", "var(--ember)"];

/* ---------- example data: shown until the page runs on the NAS (shapes as the bridge sends them) ---------- */
const DEMO = (() => {
  const Z = [["ground_floor_living_area_heating", "Living Area Heating", "Living Area", 21.3, 22, false],
             ["first_floor_office_heating", "Office Heating", "Office", 20, 21, false],
             ["first_floor_bedroom_heating", "Bedroom Heating", "Bedroom", 19.3, 18.5, false],
             ["first_floor_bathroom_heating", "Bathroom Heating", "Bathroom", 19.8, 22, false],
             ["basement_sauna_room_heating", "Sauna Room Heating", "Sauna", 19, 10, true],
             ["basement_oli_room_heating", "Oli Room Heating", "Oli's Room", 19.1, 10, true],
             ["basement_walk_in_cupboard_heating", "Walk-In Cupboard Heating", "Walk-In Cupboard", 21.8, 10, true]];
  const now = new Date(), next = new Date(now); next.setHours(19, 0, 0, 0); if (next < now) next.setDate(next.getDate() + 1);
  const dk = DAYS[(now.getDay() + 6) % 7][0], every = DAYS.map(d => d[0]);
  const zone = { enabled: false, rules: [], current: null, next: null, applied: null, preheat: null, minutes_per_degree: null };
  return {
    connected: true, error: null,
    house: { floors: [{ key: "basement", name: "Basement", rooms: ["Oli's Room", "Sauna", "Walk-In Cupboard"] }, { key: "ground", name: "Ground Floor", rooms: ["Living Area"] }, { key: "first", name: "First Floor", rooms: ["Bathroom", "Bedroom", "Office"] }],
             functions: Object.fromEntries(Z.map(([s, n, r]) => [s, { slug: s, name: n, room: r }])) },
    state: { bridge: { version: "example", online: true, paused: false, writes: true, heating: "control" },
             functions: Object.fromEntries(Z.map(([s, , , t, sp, off]) => [s, { temperature: t, plausible: true, disabled: off, day: sp, night: sp }])) },
    schedule: { enabled: true, timezone: "Europe/Vienna", settings: { preheat: true, margin_min: 30, max_lead_h: 8, default_mpd: 120, boost_delta: 2, boost_hours: 2 }, boosts: {},
                zones: Object.fromEntries(Z.map(([s]) => [s, s === "first_floor_office_heating" ? { ...zone, enabled: true,
                  rules: [{ days: every, time: "06:00", temp: 21 }, { days: every, time: "19:00", temp: 19 }],
                  current: { temp: 21, time: "06:00", day: dk }, next: { temp: 19, time: "19:00", day: dk, in_days: next.getDate() !== now.getDate() ? 1 : 0, at: next / 1000 } } : { ...zone }])) },
    climate: { warmup: Object.fromEntries(Z.map(([s], i) => [s, { minutes_per_degree: i < 2 ? [95, 140][i] : null, measured: [], measuring: i === 3 ? { t0: now / 1000 - 3000, temp0: 19.6, target: 22 } : null }])) },
  };
})();

/* ---------- data ---------- */
let D = DEMO, live = false, up = false, bridgeErr = null;
const pending = new Map();      // slug -> { value, t }   target changes waiting 1.2 s for more taps
let plan = { room: lsGet("plan.room"), rules: null, dirty: false };

const B = () => D.state?.bridge || {};
function canWrite() {
  if (live && !up) return "Not connected to the heating bridge right now.";
  const b = B();
  if (!b.version) return "Waiting for the heating bridge.";
  if (b.paused) return "The bridge is paused for HomeBuilder, so nothing can be changed.";
  if (!b.online) return "The heating controller is not answering.";
  if (b.heating !== "control") return "The bridge is not set to control the heating.";
  if (!b.writes) return "Commands are switched off in the bridge (Allow commands).";
  return null;
}
function slugs() {
  const h = D.house; if (!h) return [];
  const out = [];
  for (const fl of h.floors) for (const r of fl.rooms) for (const f of Object.values(h.functions)) if (f.room === r) out.push(f.slug);
  return out;
}
const roomName = f => f.room === "Sauna" ? "Sauna Room" : f.room === "Oli's Room" ? "Oli's Room" : f.room;
function zone(slug) {
  const f = D.house.functions[slug], e = D.state?.functions?.[slug] || {}, p = D.schedule?.zones?.[slug] || null;
  const w = D.climate?.warmup?.[slug] || {};
  const z = { slug, f, name: roomName(f), short: ROOM_SHORT[f.room] || f.room, temp: e.temperature ?? null, known: e.day != null && e.plausible !== false,
    off: !!e.disabled, day: e.day ?? null, pending: pending.get(slug)?.value ?? null, plan: p, planOn: !!(p?.enabled && D.schedule?.enabled),
    preheat: p?.preheat || null, mpd: p?.minutes_per_degree ?? w.minutes_per_degree ?? null, measuring: w.measuring || null, boost: D.schedule?.boosts?.[slug] || null,
    floor: D.house.floors.find(fl => fl.rooms.includes(f.room))?.name || "" };
  z.target = z.pending ?? z.day;
  z.state = !z.known ? "off" : z.off ? "off" : z.temp == null || z.target == null ? "ok" : z.temp < z.target - 0.3 ? "hot" : z.temp > z.target + 0.6 ? "low" : "ok";
  z.warming = !!(z.preheat && z.preheat.start * 1000 <= Date.now() && Date.now() < z.preheat.at * 1000);
  z.text = !z.known ? "Waiting for data" : z.off ? "Off" : z.boost ? "Boost" : z.warming ? "Warming up" : z.state === "hot" ? "Heating" : z.state === "low" ? "Cooling down" : "Comfortable";
  return z;
}
const zones = () => slugs().map(zone);
const clock = s => s ? new Date(s * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "–";
const fmt = v => v == null ? "–" : (Number.isInteger(v) ? String(v) : t1(v));
function planLine(z) {
  if (!D.schedule) return "";
  if (z.boost) return `Boost to ${fmt(z.boost.temp)}° until ${clock(z.boost.until)}`;
  if (!z.plan?.enabled) return "No plan · holds its temperature";
  if (!D.schedule.enabled) return "Plan paused (away)";
  if (z.warming) return `Warming up for ${fmt(z.preheat.temp)}° by ${z.preheat.time}`;
  const n = z.plan.next; if (!n) return "Plan on";
  const pre = z.preheat && z.preheat.at === n.at && z.preheat.lead_min > (D.schedule.settings?.margin_min ?? 30) ? ` · starts ${clock(z.preheat.start)}` : "";
  return `${fmt(n.temp)}° ${n.temp > (z.target ?? 0) ? "by" : "at"} ${n.in_days ? DAY_EN[n.day] + " " : ""}${n.time}${pre}`;
}

async function post(p, body, ok) {
  const why = canWrite(); if (why) { toast(why); return null; }
  if (!live) { demoApply(p, body); render(); if (ok) toast(ok); return {}; }
  try {
    const r = await fetch("api/" + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
    if (ok) toast(ok);
    return d;
  } catch (e) { toast(e.message); return null; }
}
function demoApply(p, b) {
  const st = D.state.functions[b.slug], sc = D.schedule;
  if (p === "heating") { if ("disabled" in b) st.disabled = b.disabled; else { st.day = st.night = b.day; } }
  if (p === "boost") { if (b.on) sc.boosts[b.slug] = { temp: (st.day || 20) + sc.settings.boost_delta, until: Date.now() / 1000 + sc.settings.boost_hours * 3600 }; else delete sc.boosts[b.slug]; }
  if (p === "schedule") {
    if ("settings" in b) Object.assign(sc.settings, b.settings);
    else if (b.slug && "rules" in b) sc.zones[b.slug].rules = b.rules;
    else if (b.slug) sc.zones[b.slug].enabled = b.enabled;
    else sc.enabled = b.enabled;
  }
}

// a change by hand: shown at once, sent 1.2 s after the last tap (the controller is slow and one connection only)
function nudge(slug, d) {
  const z = zone(slug); if (z.target == null) return;
  const v = Math.min(30, Math.max(5, Math.round((z.target + d) * 2) / 2));
  clearTimeout(pending.get(slug)?.t);
  const p = { value: v }; pending.set(slug, p); render();
  p.t = setTimeout(async () => {
    await post("heating", { slug, day: v, night: v }, `${z.name} set to ${fmt(v)}°`);
    setTimeout(() => { if (pending.get(slug) === p) { pending.delete(slug); render(); } }, live ? 12000 : 0);
  }, 1200);
}

/* ---------- render ---------- */
function render() {
  for (const id of ["#conn-top", "#conn-rail"]) {
    const el = $(id); el.classList.toggle("live", live && up);
    el.querySelector("span").textContent = bridgeErr ? "Not connected" : !live ? "Example data" : up ? "Live" : "Reconnecting";
  }
  if (!D.house) return;
  renderHome(); renderRooms(); renderPlan(); renderSettings(); renderInsightsSide();
  if (sheetSlug) renderSheet();
}

function renderHome() {
  const zs = zones(), on = zs.filter(z => !z.off && z.known), withT = on.filter(z => z.temp != null);
  const avg = withT.reduce((a, z) => a + z.temp, 0) / (withT.length || 1);
  $("#h-temp").innerHTML = withT.length ? `${t1(avg)}<sup>°C</sup>` : "–";
  $("#h-eyebrow").textContent = `Vienna · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`;
  const heating = on.filter(z => z.state === "hot" || z.boost), warming = on.filter(z => z.warming), away = D.schedule && !D.schedule.enabled;
  const list = a => { const n = a.map(z => z.name.toLowerCase()); return n.length > 1 ? n.slice(0, -1).join(", ") + " and " + n.at(-1) : n[0]; };
  const [title, tone] = away ? ["Away", "low"] : warming.length ? ["Warming up", "hot"] : heating.length ? ["Heating", "hot"] : ["Comfortable", "ok"];
  $("#h-status").textContent = title; $("#h-dot").className = tone === "ok" ? "" : tone;
  $("#h-sub").textContent = away ? "Weekly plans are paused; every room holds its temperature." :
    warming.length ? `Warming the ${list(warming)} for the next plan time.` : heating.length ? `Heating the ${list(heating)}.` : on.length ? "Every heated room is at its temperature." : "Heating is off in every room.";
  const why = bridgeErr ? `The app can't reach the heating bridge: ${bridgeErr}. Showing example data.` : live ? canWrite() : null, al = $("#h-alert"); al.hidden = !why;
  if (why) al.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 3 2 20h20zM12 10v4M12 17h.01"/></svg><span><b>${bridgeErr ? "Not connected" : "Changes are on hold"}</b><br><em>${esc(why)}</em></span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>`;
  $("#h-facts").innerHTML = `<span><b class="num">${on.length}</b> of ${zs.length} rooms heated</span>`;
  $("#h-rooms").innerHTML = zs.map(z => `<button data-zone="${z.slug}" aria-label="${z.name} ${z.temp != null ? t1(z.temp) + " degrees" : ""}, ${z.text}"><span>${z.short}</span><b class="num">${z.temp != null ? t1(z.temp) + "°" : "–"}</b><i class="${z.off ? "off" : z.state}"></i></button>`).join("");
  $("#seg").innerHTML = [["plans", "Plans"], ["away", "Away"]].map(([v, l]) => `<button data-away="${v === "away"}" aria-pressed="${(v === "away") === !!away}">${l}</button>`).join("");
  $("#mode-note").textContent = away ? "Away pauses every weekly plan. Rooms keep their temperature." : "Weekly plans run in the bridge, even with no app open.";
  const pre = !!D.schedule?.settings?.preheat;
  $("#p-warmby").setAttribute("aria-pressed", pre);
  // coming up: plan switches today and tomorrow
  const nexts = zs.filter(z => z.planOn && z.plan.next).sort((a, b) => a.plan.next.at - b.plan.next.at);
  $("#today").innerHTML = `<div class="card-h"><h2>Coming up</h2><button class="link" data-go="plan">Plans</button></div>` +
    (nexts.length ? `<dl class="kv">${nexts.map(z => { const n = z.plan.next, s = z.preheat && z.preheat.at === n.at ? z.preheat.start : null;
      return `<dt>${z.name}</dt><dd class="num"><b>${fmt(n.temp)}°</b> ${n.temp > (z.target ?? 0) ? "by" : "at"} ${n.in_days ? DAY_EN[n.day] + " " : ""}${n.time}${s && s * 1000 > Date.now() ? ` · warm-up from ${clock(s)}` : ""}</dd>`; }).join("")}</dl>`
      : `<p class="note">${away ? "Plans are paused." : "No plan switches coming up. Rooms hold their temperature."}</p>`);
  // warm-ups
  const meas = zs.filter(z => z.measuring), learned = zs.filter(z => z.mpd != null);
  $("#h-warm").innerHTML = `<div class="card-h"><h2>Warm-up learning</h2><button class="link" data-go="insights">Speeds</button></div>` +
    `<p class="note">${learned.length ? `Learned for ${learned.map(z => `${z.name.toLowerCase()} (${Math.round(z.mpd)} min/°C)`).join(", ")}.` : "No room has a learned warm-up speed yet."}` +
    `${meas.length ? ` Measuring now: ${meas.map(z => z.name.toLowerCase()).join(", ")}.` : ""}</p>`;
}

function roomButton(z) {
  return `<button class="room" data-zone="${z.slug}"><b>${z.name}</b><span class="meta"><span class="st"><i class="dot ${z.off ? "" : z.state}"></i>${z.text}${!z.off && z.target != null ? `<span class="set"><span class="sep"> · </span>${t1(z.target)}°</span>` : ""}</span><span class="air">${esc(planLine(z))}</span></span><span class="t num">${z.temp != null ? t1(z.temp) + "°" : "–"}<small>now</small></span></button>`;
}
function renderRooms() {
  const zs = zones();
  $("#floors").innerHTML = D.house.floors.slice().reverse().map(fl => {
    const fz = zs.filter(z => fl.rooms.includes(z.f.room)); if (!fz.length) return "";
    return `<div><div class="eyebrow" style="margin:4px 4px 8px">${fl.name}</div><div class="card rooms-card"><div class="rooms">${fz.map(roomButton).join("")}</div></div></div>`;
  }).join("");
}

/* room sheet */
let sheetSlug = null;
function openZone(slug) { sheetSlug = slug; renderSheet(); const d = $("#sheet"); if (!d.open) d.showModal(); }
function renderSheet() {
  const z = zone(sheetSlug), st = D.schedule?.settings || {};
  if (document.activeElement?.closest?.("#sheet") && document.activeElement.type === "checkbox") return;
  $("#sheet-in").innerHTML = `<div class="grab"></div>
    <div class="row"><div><div class="eyebrow">${z.floor} · ${z.text}</div><h1 id="sh-name">${z.name}</h1></div><button class="link" data-close aria-label="Close">Done</button></div>
    <div class="row" style="align-items:flex-end"><div class="big num">${z.temp != null ? t1(z.temp) : "–"}<span style="font-size:.4em;color:var(--ink-3)">°C</span></div><div class="small muted" style="text-align:right">${esc(planLine(z))}</div></div>
    <div class="row"><div><b style="font-weight:600">Set to</b><p class="note">${z.planOn ? "Holds until the next plan time." : "Holds until you change it."}</p></div>
      <div class="stepper"><button data-znudge="-0.5" aria-label="Cooler" ${z.off ? "disabled" : ""}>−</button><output class="num">${z.target != null ? t1(z.target) : "–"}°</output><button data-znudge="0.5" aria-label="Warmer" ${z.off ? "disabled" : ""}>+</button></div></div>
    <div class="setting"><div><b>Heating</b><p>Off keeps the valve closed whatever the temperature.</p></div><label class="switch"><input type="checkbox" id="z-on" ${z.off ? "" : "checked"} aria-label="Heating on"><span></span></label></div>
    <div class="setting"><div><b>Weekly plan</b><p>${z.plan?.rules?.length ? `${z.plan.rules.length} switch time${z.plan.rules.length > 1 ? "s" : ""}` : "No switch times yet"}</p></div><label class="switch"><input type="checkbox" id="z-plan" ${z.plan?.enabled ? "checked" : ""} aria-label="Weekly plan"><span></span></label></div>
    <div class="btns"><button class="btn ${z.boost ? "ghost" : "warm"}" data-zboost="${!z.boost}" ${z.off ? "disabled" : ""}>${z.boost ? "Stop boost" : `Boost +${fmt(st.boost_delta ?? 2)}° · ${fmt(st.boost_hours ?? 2)} h`}</button><button class="btn ghost" data-go="plan" data-plan="${z.slug}" data-close>Edit plan</button></div>
    <dl class="kv"><dt>Warm-up speed</dt><dd class="num">${z.mpd != null ? `${Math.round(z.mpd)} min per °C` : z.measuring ? "Measuring now" : "Not learned yet"}</dd><dt>Floor</dt><dd>${z.floor}</dd></dl>`;
}

/* ---------- plan editor ---------- */
function planRoom() { const s = slugs(); if (!s.includes(plan.room)) plan.room = s.find(x => zone(x).plan?.enabled) || s[0]; return plan.room; }
const byTime = (a, b) => a.time.localeCompare(b.time);
function rulesNow() { return plan.rules ?? (zone(planRoom()).plan?.rules || []).map(r => ({ ...r, days: [...r.days] })).sort(byTime); }
function renderPlan() {
  if (!D.schedule) return;
  const slug = planRoom(), z = zone(slug);
  $("#pl-rooms").innerHTML = zones().map(x => `<button class="chip" data-plroom="${x.slug}" aria-pressed="${x.slug === slug}">${x.plan?.enabled ? '<i style="background:var(--accent)"></i>' : ""}${x.name}</button>`).join("");
  if (!document.activeElement?.closest?.("#pl-edit")) {
    const rules = rulesNow();
    $("#pl-edit").innerHTML = `<div class="card-h"><h2>${z.name}</h2><label class="switch"><input type="checkbox" id="pl-on" ${z.plan?.enabled ? "checked" : ""} aria-label="Weekly plan for ${z.name}"><span></span></label></div>
      <p class="note" style="margin-bottom:6px">${z.plan?.enabled ? (D.schedule.enabled ? "Plan on." : "Plan on, but paused while Away.") : "Plan off: the room holds its temperature."}</p>
      <div class="rules">${rules.length ? rules.map(ruleRow).join("") : `<p class="note" style="padding:14px 0">No switch times yet.</p>`}</div>
      <div class="btns" style="margin-top:12px"><button class="btn ghost" id="pl-add" ${rules.length >= 24 ? "disabled" : ""}>Add switch time</button>
        <select id="pl-copy" aria-label="Copy from another room" style="width:auto;flex:1;min-width:150px"><option value="">Copy from…</option>${zones().filter(x => x.slug !== slug && x.plan?.rules?.length).map(x => `<option value="${x.slug}">${x.name}</option>`).join("")}</select></div>
      <div class="btns" style="margin-top:10px" ${plan.dirty ? "" : "hidden"}><button class="btn" id="pl-save">Save plan</button><button class="btn ghost" id="pl-undo">Discard</button></div>`;
  }
  // today and the week at a glance
  const today = DAYS[(new Date().getDay() + 6) % 7][0], rules = (z.plan?.rules || []).slice().sort((a, b) => a.time.localeCompare(b.time));
  const mins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; }, pct = m => (m / 1440 * 100).toFixed(2) + "%";
  const tr = rules.filter(r => r.days.includes(today)), nm = new Date().getHours() * 60 + new Date().getMinutes();
  const mpd = z.mpd ?? D.schedule.settings?.default_mpd ?? 120, margin = D.schedule.settings?.margin_min ?? 30;
  $("#pl-today").innerHTML = `<div class="card-h"><h2>Today</h2><span class="small muted">${z.name}</span></div>
    <div class="today"><div class="bar-wrap"><div class="bar">${tr.map(r => { const lead = D.schedule.settings?.preheat ? Math.min((D.schedule.settings.max_lead_h ?? 8) * 60, Math.max(0, (r.temp - (z.temp ?? r.temp)) * mpd) + margin) : 0;
      return lead > margin ? `<i class="w" style="left:${pct(Math.max(0, mins(r.time) - lead))};width:${pct(Math.min(lead, mins(r.time)))}"></i>` : ""; }).join("")}</div><span class="now" style="left:${pct(nm)}" aria-hidden="true"></span>
      ${tr.map(r => `<span class="tick" style="left:${pct(mins(r.time))}"></span>`).join("")}</div>
    <div class="ticks"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    <div class="keys">${tr.length ? tr.slice(0, 3).map(r => `<div>${r.time}<b class="num">${fmt(r.temp)}°</b></div>`).join("") : `<div>No switch times today</div>`}</div></div>`;
  $("#pl-week").innerHTML = `<div class="card-h"><h2>The week</h2></div><div class="week">${DAYS.map(([k, l]) => `<div class="wk-row${k === today ? " now" : ""}"><span>${l}</span><div>${rules.filter(r => r.days.includes(k)).map(r => `<em class="num">${r.time} · ${fmt(r.temp)}°</em>`).join("") || '<em class="none">–</em>'}</div></div>`).join("")}</div>`;
}
function ruleRow(r, i) {
  return `<div class="rule" data-i="${i}"><input type="time" class="time" step="300" value="${r.time}" data-rtime="${i}" aria-label="Time">
    <div class="stepper sm"><button data-rtemp="-0.5" data-i="${i}" aria-label="Cooler">−</button><output class="num">${t1(r.temp)}°</output><button data-rtemp="0.5" data-i="${i}" aria-label="Warmer">+</button></div>
    <button class="link rm" data-rdel="${i}" aria-label="Remove this switch time">Remove</button>
    <div class="days">${DAYS.map(([k, l]) => `<button class="chip" data-rday="${k}" data-i="${i}" aria-pressed="${r.days.includes(k)}">${l.slice(0, 2)}</button>`).join("")}</div></div>`;
}
function editRules(fn) { const rs = rulesNow(); fn(rs); rs.sort(byTime); plan.rules = rs; plan.dirty = true; document.activeElement?.blur?.(); renderPlan(); }

/* ---------- insights ---------- */
const HX = { days: Number(lsGet("hx.days")) || 7, data: null, req: 0, sel: new Set((lsGet("hx.sel") || "").split(",").filter(Boolean)) };
function hxDemo(days) {
  const step = days <= 1 ? 900 : 3600, n = Math.round(days * 86400 / step), t0 = Date.now() / 1000 - n * step;
  const t = Array.from({ length: n }, (_, i) => Math.round(t0 + i * step));
  const zs = {}; slugs().forEach((s, k) => { const z = zone(s); zs[s] = { temp: t.map(x => +((z.temp ?? 20) + Math.sin(x / 9000 + k) * .8 - .3 * Math.cos(x / 86400 * 6.28)).toFixed(2)), target: t.map(() => z.off ? null : z.day) }; });
  return { t, bucket: step, zones: zs };
}
async function hxLoad() {
  const id = ++HX.req; document.body.classList.add("hx-loading");
  let d = null;
  if (live) d = await fetch(`api/history?days=${HX.days}`).then(r => r.ok ? r.json() : null).catch(() => null);
  else d = hxDemo(HX.days);
  if (id !== HX.req) return;
  document.body.classList.remove("hx-loading");
  HX.data = d; hxRender();
}
function hxRender() {
  const sel = [...$("#hx-seg").children]; sel.forEach(b => b.setAttribute("aria-pressed", Number(b.dataset.hx) === HX.days));
  const zs = zones(); if (!HX.sel.size) zs.filter(z => !z.off).slice(0, 3).forEach(z => HX.sel.add(z.slug));
  const color = Object.fromEntries(slugs().map((s, i) => [s, SERIES[i % SERIES.length]]));
  $("#hx-tchips").innerHTML = zs.map(z => `<button class="chip" data-hxz="${z.slug}" aria-pressed="${HX.sel.has(z.slug)}"><i style="background:${color[z.slug]}"></i>${z.name}</button>`).join("");
  const d = HX.data;
  if (!d || !d.t?.length) { $("#hx-temp").innerHTML = `<p class="hx-empty">${live ? "No history from the bridge yet." : "No data."}</p>`; $("#hx-kpis").innerHTML = ""; return; }
  // buckets: hours for a day, days for longer periods
  const hourly = HX.days <= 1, size = hourly ? 3600 : 86400, start = new Date(d.t[0] * 1000);
  if (hourly) start.setMinutes(0, 0, 0); else start.setHours(0, 0, 0, 0);
  const buckets = []; for (let b = new Date(start); b.getTime() / 1000 <= d.t.at(-1); hourly ? b.setHours(b.getHours() + 1) : b.setDate(b.getDate() + 1)) buckets.push(new Date(b));
  const idx = ts => { let i = buckets.length - 1; while (i > 0 && buckets[i].getTime() / 1000 > ts) i--; return i; };
  const agg = key => { const out = {}; for (const [s, v] of Object.entries(d.zones)) { const acc = buckets.map(() => []); v[key]?.forEach((x, j) => { if (x != null) acc[idx(d.t[j])].push(x); });
    out[s] = acc.map(a => a.length ? [a.reduce((p, q) => p + q, 0) / a.length, Math.min(...a), Math.max(...a)] : null); } return out; };
  const T = agg("temp"), G = agg("target");
  const R = { buckets, bucket: hourly ? "hour" : "day", kind: HX.days === 7 ? "week" : HX.days === 1 ? "day" : "month", label: `Temperatures, last ${HX.days === 1 ? "24 hours" : HX.days + " days"}` };
  const shown = zs.filter(z => HX.sel.has(z.slug) && T[z.slug]);
  const one = shown.length === 1;
  const lines = shown.flatMap(z => [{ key: z.slug, vals: T[z.slug].map(v => v && v[0]), band: one && !hourly ? T[z.slug].map(v => v && [v[1], v[2]]) : null, color: one ? "var(--c-measured)" : color[z.slug], name: z.name, unit: "°C" },
    ...(one ? [{ key: z.slug + "-t", vals: G[z.slug].map(v => v && v[0]), color: "var(--c-target)", name: "Target", unit: "°C", dashed: true }] : [])]);
  hxChart($("#hx-temp"), R, { lines, tip: i => lines.map(l => l.vals[i] != null ? `<i style="background:${l.color}"></i>${l.name} ${t1(l.vals[i])}°` : "") });
  $("#hx-legend").innerHTML = one ? `<span><i style="background:var(--c-measured)"></i>Measured</span><span><i style="background:var(--c-target)"></i>Target (dashed)</span>${hourly ? "" : '<span><i style="background:var(--c-measured);opacity:.25"></i>Daily low–high</span>'}` : "";
  $("#hx-note").textContent = hourly ? "hourly" : "daily averages";
  // key figures across heated rooms
  const means = zs.filter(z => !z.off).map(z => { const v = T[z.slug]?.filter(Boolean).map(x => x[0]) || []; return [z, v.length ? v.reduce((a, b) => a + b, 0) / v.length : null]; }).filter(x => x[1] != null);
  const all = means.map(x => x[1]), sp = zs.map(z => z.mpd).filter(v => v != null);
  const warm = means.slice().sort((a, b) => b[1] - a[1])[0], cool = means.slice().sort((a, b) => a[1] - b[1])[0];
  $("#hx-kpis").innerHTML = [["Average", all.length ? `${t1(all.reduce((a, b) => a + b, 0) / all.length)}<small>°C</small>` : "–", "heated rooms"],
    ["Warmest", warm ? `${t1(warm[1])}<small>°C</small>` : "–", warm ? warm[0].name : ""], ["Coolest", cool ? `${t1(cool[1])}<small>°C</small>` : "–", cool ? cool[0].name : ""],
    ["Warm-up", sp.length ? `${Math.round(sp.reduce((a, b) => a + b, 0) / sp.length)}<small>min/°C</small>` : "–", sp.length ? `average of ${sp.length} room${sp.length > 1 ? "s" : ""}` : "not learned yet"]]
    .map(([l, v, e]) => `<div class="stat"><span>${l}</span><b class="num">${v}</b><em>${esc(e)}</em></div>`).join("");
}
function renderInsightsSide() {
  const zs = zones(), mx = Math.max(60, ...zs.map(z => z.mpd || 0)), def = D.schedule?.settings?.default_mpd ?? 120;
  $("#ebars").innerHTML = zs.filter(z => !z.off || z.mpd != null).map(z => `<div class="ebar"><span>${z.name}</span><div class="track"><div class="fill" style="width:${z.mpd ? Math.round(z.mpd / mx * 100) : 0}%"></div></div><span class="v num">${z.mpd != null ? Math.round(z.mpd) : z.measuring ? "measuring" : "–"}</span></div>`).join("");
  $("#wu-note").textContent = `Rooms without a learned speed use ${def} min per °C. Lower is faster.`;
  $("#health").innerHTML = zs.map(z => `<dt>${z.name}</dt><dd style="color:${!z.known ? "var(--bad)" : "inherit"}">${!z.known ? "No data" : z.off ? "Off" : `${t1(z.temp ?? 0)}° → ${t1(z.target ?? 0)}°`}</dd>`).join("");
}

/* ---------- settings ---------- */
const SET = [["margin_min", "Extra time", "Added to every warm-up, on top of the learned speed.", 0, 240, 5, "min"],
             ["max_lead_h", "Longest warm-up", "Heating never starts more than this before a plan time.", 1, 24, 1, "h"],
             ["default_mpd", "Speed before learning", "Used until a room has a learned warm-up speed.", 15, 600, 5, "min/°C"],
             ["boost_delta", "Boost", "Extra warmth for a room.", .5, 5, .5, "°C"],
             ["boost_hours", "Boost length", "Then back to the earlier temperature.", .5, 12, .5, "h"]];
function renderSettings() {
  const s = D.schedule?.settings; if (!s) return;
  if (!document.activeElement?.closest?.("#settings")) $("#settings").innerHTML =
    `<div class="setting"><div><b>Warm by plan time</b><p>Heating starts early, so a room is warm at the plan time instead of starting then.</p></div><label class="switch"><input type="checkbox" id="set-pre" ${s.preheat ? "checked" : ""} aria-label="Warm by plan time"><span></span></label></div>` +
    SET.map(([k, l, d, mi, ma, st, u]) => `<div class="setting"><div><b>${l}</b><p>${d}</p></div><output class="num" id="o-${k}">${fmt(s[k])} ${u}</output><input type="range" aria-label="${l}" min="${mi}" max="${ma}" step="${st}" value="${s[k]}" data-wset="${k}"></div>`).join("");
  const t = getTheme();
  $("#theme-seg").innerHTML = [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => `<button data-theme="${v}" aria-pressed="${t === v}">${l}</button>`).join("");
  const b = B();
  $("#conn-kv").innerHTML = `<dt>App</dt><dd>${live ? (up ? "Connected" : "Reconnecting") : "Example data"}</dd><dt>Heating controller</dt><dd>${b.online ? "Answering" : "Not answering"}</dd>
    <dt>Changes</dt><dd>${canWrite() ? "On hold" : "Allowed"}</dd><dt>Bridge</dt><dd class="num">${esc(b.version || "–")}</dd>`;
  $("#conn-note").textContent = canWrite() || "The app sends changes to the Intellihome bridge on the Home Assistant Green, which holds the only connection to the heating controller.";
}
const getTheme = () => lsGet("theme") || "auto";
setTheme(getTheme());

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
}
let hxRz; addEventListener("resize", () => { clearTimeout(hxRz); hxRz = setTimeout(() => { if (currentTab === "insights") hxRender(); }, 160); });

/* ---------- interaction ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("button,[data-zone]");
  if (!t) { if (e.target === $("#sheet")) $("#sheet").close(); return; }
  if (t.dataset.close !== undefined) $("#sheet").close();
  if (t.dataset.plan) { plan.room = t.dataset.plan; plan.rules = null; plan.dirty = false; lsSet("plan.room", plan.room); }
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.tab) return go(t.dataset.tab);
  if (t.dataset.zone) return openZone(t.dataset.zone);
  if (t.dataset.znudge) return nudge(sheetSlug, parseFloat(t.dataset.znudge));
  if (t.dataset.zboost) { const on = t.dataset.zboost === "true"; await post("boost", { slug: sheetSlug, on }, on ? "Boost on" : "Boost stopped"); return; }
  if (t.dataset.away) { const away = t.dataset.away === "true"; await post("schedule", { enabled: !away }, away ? "Away: plans paused" : "Plans on"); return; }
  if (t.id === "p-warmby") { const v = !D.schedule?.settings?.preheat; await post("schedule", { settings: { preheat: v } }, v ? "Warm by plan time on" : "Warm by plan time off"); return; }
  if (t.dataset.theme) { setTheme(t.dataset.theme); return renderSettings(); }
  if (t.dataset.hx) { HX.days = Number(t.dataset.hx); lsSet("hx.days", HX.days); return hxLoad(); }
  if (t.dataset.hxz) { const s = t.dataset.hxz; HX.sel.has(s) ? HX.sel.delete(s) : HX.sel.add(s); if (!HX.sel.size) HX.sel.add(s); lsSet("hx.sel", [...HX.sel].join(",")); return hxRender(); }
  if (t.dataset.plroom) {
    if (plan.dirty && !confirmLeave()) return;
    plan.room = t.dataset.plroom; plan.rules = null; plan.dirty = false; lsSet("plan.room", plan.room); return renderPlan();
  }
  if (t.id === "pl-add") return editRules(rs => { const last = rs.at(-1); rs.push({ days: DAYS.map(d => d[0]), time: last ? "18:00" : "06:00", temp: last ? Math.max(5, last.temp - 2) : 21 }); });
  if (t.dataset.rdel) return editRules(rs => rs.splice(Number(t.dataset.rdel), 1));
  if (t.dataset.rtemp) return editRules(rs => { const r = rs[Number(t.dataset.i)]; r.temp = Math.min(30, Math.max(5, r.temp + parseFloat(t.dataset.rtemp))); });
  if (t.dataset.rday) return editRules(rs => { const r = rs[Number(t.dataset.i)], k = t.dataset.rday; r.days = r.days.includes(k) ? r.days.filter(d => d !== k) : DAYS.map(d => d[0]).filter(d => d === k || r.days.includes(d)); });
  if (t.id === "pl-undo") { plan.rules = null; plan.dirty = false; t.blur(); return renderPlan(); }
  if (t.id === "pl-save") {
    const rs = rulesNow();
    if (rs.some(r => !r.days.length)) return toast("Every switch time needs at least one day.");
    const res = await post("schedule", { slug: planRoom(), rules: rs.map(r => ({ days: r.days, time: r.time, temp: r.temp })) }, "Plan saved");
    if (res) { if (live && res.zones) D.schedule = res; plan.rules = null; plan.dirty = false; t.blur(); render(); }
  }
});
const confirmLeave = () => { toast("Save or discard the plan changes first."); return false; };
document.addEventListener("change", async e => {
  const el = e.target;
  if (el.id === "z-on") { const off = !el.checked; await post("heating", { slug: sheetSlug, disabled: off }, off ? "Heating off for this room" : "Heating on"); el.blur(); return; }
  if (el.id === "z-plan" || el.id === "pl-on") { const slug = el.id === "z-plan" ? sheetSlug : planRoom();
    await post("schedule", { slug, enabled: el.checked }, el.checked ? "Weekly plan on" : "Weekly plan off: the room holds its temperature"); el.blur(); return; }
  if (el.id === "set-pre") { await post("schedule", { settings: { preheat: el.checked } }, el.checked ? "Warm by plan time on" : "Warm by plan time off"); el.blur(); return; }
  if (el.dataset.wset) { const k = el.dataset.wset; await post("schedule", { settings: { [k]: parseFloat(el.value) } }, `${SET.find(s => s[0] === k)[1]} saved`); el.blur(); return; }
  if (el.dataset.rtime !== undefined && /^\d{2}:\d{2}$/.test(el.value)) {
    const [h, m] = el.value.split(":").map(Number), v = `${String(h).padStart(2, "0")}:${String(Math.round(m / 5) * 5 % 60).padStart(2, "0")}`;
    return editRules(rs => { rs[Number(el.dataset.rtime)].time = v; });
  }
  if (el.id === "pl-copy" && el.value) { const src = zone(el.value).plan?.rules || []; return editRules(rs => { rs.splice(0, rs.length, ...src.map(r => ({ ...r, days: [...r.days] }))); }); }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.wset) { const k = el.dataset.wset; $("#o-" + k).textContent = `${fmt(parseFloat(el.value))} ${SET.find(s => s[0] === k)[6]}`; }
});
$("#sheet").addEventListener("close", () => { sheetSlug = null; render(); });

/* ---------- start ---------- */
async function goLive() {
  const h = await fetch("api/health", { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!h || !h.ok) return;
  let q = false; const soon = () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; render(); }); } };
  const es = new EventSource("api/events");
  es.addEventListener("snapshot", e => {
    const d = JSON.parse(e.data); up = d.connected;
    if (d.house) { D = d; live = true; }
    bridgeErr = d.house ? null : d.error;
    soon();
  });
  es.onerror = () => { up = false; soon(); };
}
go(location.hash.slice(1) || lsGet("tab") || "home");
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(render, 150); });
goLive().catch(console.warn);
