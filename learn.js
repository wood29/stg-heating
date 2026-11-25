// What the heating learns from its own history, shared by Seewärme (St. Gilgen) and Wien Wärme (Vienna).
// Ideas taken over from RoomMind (github.com/snazzybean/roommind): radiator/floor "afterglow" and heat loss per room.
//
//   coast     after the target drops (night setback, departure), how long the room stays within 0.5 °C
//             of where it was. Floor heating keeps giving off heat for hours; this is how long.
//   heat loss how fast a room cools without heating, per hour, at 10 °C difference to outside.
//             Lower = better insulated. Learned from long cool-downs (away, nights), after the afterglow is over.
//   wallDamp  humidity at the coldest wall (DIN 4108-2 temperature factor), for mould risk.

export const STEP = 15 * 60e3;          // everything is put on a 15-minute grid
const DROP = 1;                          // a target drop of at least 1 °C starts a coast measurement
const COAST_BAND = .5;                   // "still warm" = within 0.5 °C of the temperature when the target dropped
const COAST_MAX_H = 12;
const AFTERGLOW_H = 4;                   // cool-downs count for heat loss only this long after the last heating
const LOSS_WINDOW = 8;                   // 8 × 15 min = 2-hour windows

// [[t, v], ...] (any order, any spacing) -> values on the grid from..to, last value carried forward (max 3 h)
export function onGrid(pts, from, to, hold = 3 * 3600e3) {
  const p = (pts || []).filter(x => Number.isFinite(x[0]) && Number.isFinite(x[1])).sort((a, b) => a[0] - b[0]);
  const out = []; let j = 0, last = null;
  for (let t = from; t <= to; t += STEP) {
    while (j < p.length && p[j][0] <= t) last = p[j++];
    out.push(last && t - last[0] <= hold ? last[1] : null);
  }
  return out;
}
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// T, G, O: room temperature, target, outside on the same grid (null where unknown); from = time of index 0
export function coastEvents(T, G, from) {
  const ev = [];
  for (let i = 1; i < T.length; i++) {
    const g0 = G[i - 1], g1 = G[i], c0 = T[i];
    if (g0 == null || g1 == null || c0 == null || T[i - 1] == null || g1 > g0 - DROP || T[i - 1] < g0 - .7) continue;
    let end = null, peak = c0, censored = false, back = null;
    for (let j = i + 1; j < T.length && (j - i) * STEP <= COAST_MAX_H * 3600e3; j++) {
      if (G[j] != null && G[j] >= g0 - COAST_BAND) { censored = true; back = j; break; }   // heating came back on first
      if (T[j] == null) continue;
      peak = Math.max(peak, T[j]);
      if (T[j] <= c0 - COAST_BAND) { end = j; break; }
    }
    if (censored) {   // still warm when the heating came back (e.g. the morning warm-up): it lasts at least this long
      const h = (back - i) * STEP / 3600e3;
      if (h >= 2) ev.push({ t: from + i * STEP, hours: Math.round(h * 4) / 4, rise: Math.round((peak - c0) * 10) / 10, capped: true });
      continue;
    }
    const hours = end == null ? (T.length - 1 - i) * STEP / 3600e3 : (end - i) * STEP / 3600e3;
    if (end == null && hours < COAST_MAX_H) continue;                            // ran out of data, not a measurement
    ev.push({ t: from + i * STEP, hours: Math.round(Math.min(hours, COAST_MAX_H) * 4) / 4, rise: Math.round((peak - c0) * 10) / 10, capped: end == null });
  }
  return ev;
}

export function lossSamples(T, G, O, from) {
  const out = []; let lastHeat = -Infinity;
  const heatingAt = k => G[k] != null && T[k] != null && G[k] >= T[k] - .5;
  for (let k = 0; k + LOSS_WINDOW < T.length; k++) {
    if (heatingAt(k)) { lastHeat = k; continue; }
    if ((k - lastHeat) * STEP < AFTERGLOW_H * 3600e3 || k % LOSS_WINDOW) continue;
    let ok = true, sT = 0, sO = 0;
    for (let m = k; m <= k + LOSS_WINDOW; m++) { if (T[m] == null || O[m] == null || G[m] == null || heatingAt(m)) { ok = false; break; } sT += T[m]; sO += O[m]; }
    if (!ok) continue;
    const n = LOSS_WINDOW + 1, diff = sT / n - sO / n; if (diff < 4) continue;
    const rate = (T[k] - T[k + LOSS_WINDOW]) / (LOSS_WINDOW * STEP / 3600e3);   // °C per hour, positive = cooling
    out.push({ t: from + k * STEP, k: rate / diff });
  }
  return out;
}

// summary per room from the kept events and samples
export function summarise(ev, ls) {
  const coast = median(ev.map(e => e.hours)), rise = median(ev.map(e => e.rise));
  const ks = ls.map(s => s.k).filter(Number.isFinite);
  const k = ks.length >= 12 ? median(ks) : null;
  // coast "at least": when most measurements ended because the heating came back before the room cooled
  const atLeast = ev.length >= 2 && ev.filter(e => e.capped).length * 2 > ev.length;
  return { coast: ev.length >= 2 ? coast : null, atLeast, rise: ev.length >= 2 ? rise : null, events: ev.length,
    loss: k != null ? Math.max(0, Math.round(k * 10 * 100) / 100) : null, tau: k != null && k > 0 ? Math.round(1 / k) : null, samples: ks.length };
}

// merge new events/samples into the kept ones, without duplicates, keeping the last `days`
export function merge(old = [], add = [], days = 120) {
  const cut = Date.now() - days * 864e5, seen = new Set(), out = [];
  for (const x of [...old, ...add]) { if (x.t < cut || seen.has(x.t)) continue; seen.add(x.t); out.push(x); }
  return out.sort((a, b) => a.t - b.t);
}

export function wallDamp(tRoom, rh, tOut, f = .8) {
  if (![tRoom, rh].every(Number.isFinite)) return null;
  const A = 17.271, B = 237.7, es = t => Math.exp(A * t / (B + t));
  if (!Number.isFinite(tOut)) return { rh: Math.min(100, rh + 10), wall: null };
  const wall = tOut + f * (tRoom - tOut), g = A * tRoom / (B + tRoom) + Math.log(Math.max(1, Math.min(100, rh)) / 100), dew = B * g / (A - g);
  return { rh: Math.max(0, Math.min(100, 100 * es(dew) / es(wall))), wall };
}

// ---------------------------------------------------------------- weather forecast vs your own outdoor sensor (idea from ClimateAdvisor)
// Each hour the app notes what the forecast said for that hour 3–4 hours earlier, and later what the outdoor sensor
// actually read. The typical miss per hour of the day (median, last 21 days) corrects the next forecasts.
// samples: [{ t: hour start ms, fc: forecast °C, act: measured °C }]
export function forecastBias(samples, days = 21) {
  const cut = Date.now() - days * 864e5, s = (samples || []).filter(x => x.t >= cut && Number.isFinite(x.fc) && Number.isFinite(x.act));
  const all = s.map(x => x.act - x.fc);
  const overall = all.length >= 12 ? median(all) : null;
  const byHour = Array.from({ length: 24 }, (_, h) => { const v = s.filter(x => new Date(x.t).getHours() === h).map(x => x.act - x.fc); return v.length >= 4 ? median(v) : overall; });
  // honest score: correct each of the last 7 days only with what was known before it
  const recent = s.filter(x => x.t >= Date.now() - 7 * 864e5);
  let raw = 0, cor = 0, n = 0;
  for (const x of recent) {
    const before = s.filter(y => y.t < x.t - 864e5 / 2), hv = before.filter(y => new Date(y.t).getHours() === new Date(x.t).getHours()).map(y => y.act - y.fc);
    const b = hv.length >= 4 ? median(hv) : before.length >= 12 ? median(before.map(y => y.act - y.fc)) : 0;
    raw += Math.abs(x.act - x.fc); cor += Math.abs(x.act - x.fc - b); n++;
  }
  const r1 = v => Math.round(v * 10) / 10;
  return { byHour: byHour.map(v => v == null ? null : r1(v)), overall: overall == null ? null : r1(overall), samples: s.length,
    score: n >= 12 ? { raw: r1(raw / n), corrected: r1(cor / n), hours: n } : null };
}
export const correct = (fc, t, bias) => { const b = bias?.byHour?.[new Date(t).getHours()] ?? bias?.overall; return Number.isFinite(fc) ? fc + (Number.isFinite(b) ? b : 0) : fc; };

// ---------------------------------------------------------------- warm on time? (self-check)
// Each time a room's target goes up by 1 °C or more (a plan time, the morning, an arrival), was it already within
// 0.5 °C of the new target? If not, how long until it was. T, G on the 15-minute grid.
export function warmChecks(T, G, from) {
  const out = [];
  for (let i = 1; i < T.length; i++) {
    const g0 = G[i - 1], g1 = G[i]; if (g0 == null || g1 == null || g1 < g0 + 1 || g1 < 15) continue;
    if (T[i] == null) continue;
    let late = null;
    if (T[i] < g1 - .5) { late = 6 * 60; for (let j = i; j < T.length && (j - i) * 15 <= 6 * 60; j++) { if (G[j] != null && G[j] < g1 - .5) { late = null; break; } if (T[j] != null && T[j] >= g1 - .5) { late = (j - i) * 15; break; } } if (late === null) continue; }
    out.push({ t: from + i * STEP, target: g1, temp: T[i], late: late ?? 0 });
  }
  return out;
}
export function warmSummary(ev) {
  if (!ev?.length) return null;
  const onTime = ev.filter(e => e.late <= 15).length, late = ev.filter(e => e.late > 15);
  return { checks: ev.length, onTime, lateAvg: late.length ? Math.round(late.reduce((a, e) => a + e.late, 0) / late.length) : 0 };
}

// deadlines: [{ t, target }] (a plan time, an arrival, the morning). Skipped when the room's target wasn't up by then
// (plan paused, away). T, G on the 15-minute grid starting at `from`.
export function warmChecksAt(T, G, from, deadlines) {
  const out = [];
  for (const d of deadlines) {
    const i = Math.round((d.t - from) / STEP); if (i < 0 || i >= T.length || T[i] == null || G[i] == null || G[i] < d.target - .5) continue;
    let late = 0;
    if (T[i] < d.target - .5) { late = 6 * 60; for (let j = i; j < T.length && (j - i) * 15 <= 6 * 60; j++) if (T[j] != null && T[j] >= d.target - .5) { late = (j - i) * 15; break; } }
    if (late === 6 * 60 && i + 24 >= T.length) continue;   // not enough data after it yet
    out.push({ t: d.t, target: d.target, temp: T[i], late });
  }
  return out;
}
