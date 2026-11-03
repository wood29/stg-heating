/* Wärme core: helpers and components shared by Seewärme and Wien Wärme.
   Everything visual goes through the theme tokens (data-brand on <html>). */
const BAR_COLOURS = { see: ["#F6FAFC", "#0B1D2B"], wien: ["#FFF8F1", "#17191F"] };
/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const fmtD = d => d ? d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–";
const fmtDay = d => d ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "–";
const fmtT = d => d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "–";
const hm = v => (v || "").slice(0, 5) || "–";
const t1 = v => (Math.round(v * 10) / 10).toFixed(1);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); }
const toInput = d => { if (!d) return ""; const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const lsGet = k => { try { return localStorage.getItem("stg." + k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem("stg." + k, v); } catch { } };
function setTheme(v) {
  lsSet("theme", v);
  if (v === "light" || v === "dark") document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  const dark = v === "dark" || (v !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const [a, b] = document.querySelectorAll('meta[name="theme-color"]');
  const [lt, dk] = BAR_COLOURS[document.documentElement.dataset.brand] || BAR_COLOURS.see;
  if (v === "auto") { a.content = lt; a.media = "(prefers-color-scheme: light)"; b.content = dk; b.media = "(prefers-color-scheme: dark)"; }
  else for (const m of [a, b]) { m.content = dark ? dk : lt; m.removeAttribute("media"); }
}
function hxRange(kind, a) {
  const s = new Date(a); s.setHours(0, 0, 0, 0);
  let e, ps, bucket, label;
  if (kind === "day") { e = new Date(s); e.setDate(s.getDate() + 1); ps = new Date(s); ps.setDate(s.getDate() - 1); bucket = "hour";
    const t = new Date(); t.setHours(0, 0, 0, 0);
    label = s.getTime() === t.getTime() ? "Today" : s.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }
  else if (kind === "week") { s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); e = new Date(s); e.setDate(s.getDate() + 7); ps = new Date(s); ps.setDate(s.getDate() - 7); bucket = "day";
    const l = new Date(e); l.setDate(e.getDate() - 1);
    label = `${s.getDate()}${s.getMonth() !== l.getMonth() ? " " + s.toLocaleDateString("en-GB", { month: "short" }) : ""} – ${l.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`; }
  else if (kind === "month") { s.setDate(1); e = new Date(s); e.setMonth(s.getMonth() + 1); ps = new Date(s); ps.setMonth(s.getMonth() - 1); bucket = "day";
    label = s.toLocaleDateString("en-GB", { month: "long", year: "numeric" }); }
  else { s.setMonth(0, 1); e = new Date(s); e.setFullYear(s.getFullYear() + 1); ps = new Date(s); ps.setFullYear(s.getFullYear() - 1); bucket = "month"; label = String(s.getFullYear()); }
  const buckets = [];
  for (let d = new Date(s); d < e;) { buckets.push(new Date(d)); if (bucket === "hour") d.setHours(d.getHours() + 1); else if (bucket === "day") d.setDate(d.getDate() + 1); else d.setMonth(d.getMonth() + 1); }
  const prevName = kind === "day" ? "the day before" : kind === "week" ? "the week before" : kind === "month" ? ps.toLocaleDateString("en-GB", { month: "long" }) : String(ps.getFullYear());
  return { s, e, ps, bucket, label, buckets, prevName, kind };
}
// one chart: optional bars (left axis), lines (left axis, or right axis for bars + line), hover/tap inspector
function hxChart(el, R, o) {
  const W = Math.max(280, el.clientWidth || 600), H = Math.round(Math.min(260, Math.max(180, W * .38)));
  const padL = 34, padR = o.bars && o.lines?.length ? 34 : 10, top = 24, bot = 26, iw = W - padL - padR, ih = H - top - bot, n = R.buckets.length, bw = iw / n;
  const x = i => padL + i * bw + bw / 2;
  const nice = (lo, hi, count = 4) => { if (!(hi > lo)) { hi = lo + 1; } const span = hi - lo, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw)), st0 = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw; const a = Math.floor(lo / st0) * st0, b = Math.ceil(hi / st0) * st0; const t = []; for (let v = a; v <= b + 1e-9; v += st0) t.push(+v.toFixed(6)); return { a, b, t }; };
  let svg = "";
  // left axis
  let L = null, Rr = null;
  if (o.bars) { const mx = Math.max(0, ...o.bars.vals.map(v => v || 0)); L = nice(0, mx || 1); }
  const lineVals = (o.lines || []).flatMap(l => l.vals.concat((l.band || []).flatMap(b => b || []))).filter(v => v != null);
  if (lineVals.length) { const lo = o.fixed ? Math.min(o.fixed[0], ...lineVals) : Math.min(...lineVals), hi = o.fixed ? Math.max(o.fixed[1], ...lineVals) : Math.max(...lineVals, o.threshold ? o.threshold[0] * 1.05 : -Infinity); const ax = nice(lo - (hi - lo) * .08, hi + (hi - lo) * .08); if (o.bars) Rr = ax; else L = ax; }
  const yL = v => top + ih - (v - L.a) / (L.b - L.a) * ih, yR = v => top + ih - (v - Rr.a) / (Rr.b - Rr.a) * ih;
  if (!L) { el.innerHTML = `<p class="hx-empty">No data for this period yet.</p>`; return; }
  for (const v of L.t) svg += `<line class="gl" x1="${padL}" x2="${W - padR}" y1="${yL(v).toFixed(1)}" y2="${yL(v).toFixed(1)}"/><text class="ax" x="${padL - 6}" y="${(yL(v) + 3.5).toFixed(1)}" text-anchor="end">${o.bars ? (v >= 10 ? Math.round(v) : +v.toFixed(1)) : Math.round(v)}</text>`;
  if (Rr) svg += `<text class="ax unit" x="${W - padR + 6}" y="${top - 12}">°C</text>`;
  const fmtT = (ax, v) => (ax.t[1] - ax.t[0]) < 1 ? v.toFixed(1) : String(Math.round(v));
  if (Rr) for (const v of Rr.t) svg += `<text class="ax" x="${W - padR + 6}" y="${(yR(v) + 3.5).toFixed(1)}">${fmtT(Rr, v)}</text>`;
  svg += `<text class="ax unit" x="${padL - 6}" y="${top - 12}" text-anchor="end">${o.bars ? "kWh" : o.lines?.[0]?.unit || ""}</text>`;
  if (o.threshold) { const y = yL(o.threshold[0]); svg += `<line class="thr" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/><text class="ax thr-t" x="${W - padR - 2}" y="${y - 4}" text-anchor="end">${o.threshold[1]} · ${o.threshold[0]}</text>`; }
  // x labels
  const lab = i => { const b = R.buckets[i]; return R.bucket === "hour" ? (b.getHours() % 6 === 0 ? String(b.getHours()).padStart(2, "0") : "") :
    R.kind === "week" ? b.toLocaleDateString("en-GB", { weekday: "short" }) : R.bucket === "day" ? ([1, 8, 15, 22, 29].includes(b.getDate()) ? String(b.getDate()) : "") :
    b.toLocaleDateString("en-GB", { month: W < 520 ? "narrow" : "short" }); };
  for (let i = 0; i < n; i++) { const t = lab(i); if (t) svg += `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${t}</text>`; }
  // bars
  if (o.bars) o.bars.vals.forEach((v, i) => { if (v == null || v <= 0) return; /* no bar when nothing was used */ const h = Math.max(1.5, yL(0) - yL(v)), w = Math.max(2, Math.min(bw * .64, 28));
    svg += `<rect class="bar${o.bars.est?.[i] ? " est" : ""}" x="${(x(i) - w / 2).toFixed(1)}" y="${(yL(0) - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, w / 3).toFixed(1)}"/>`; });
  // lines
  const Y = o.bars ? yR : yL;
  for (const l of o.lines || []) {
    if (l.band) { const pts = l.band.map((b, i) => b && b[0] != null && b[1] != null ? [x(i), Y(b[0]), Y(b[1])] : null); let seg = [];
      const flush = () => { if (seg.length > 1) svg += `<path class="band" style="fill:${l.color}" d="M${seg.map(p => `${p[0].toFixed(1)} ${p[2].toFixed(1)}`).join("L")}L${seg.slice().reverse().map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}Z"/>`; seg = []; };
      pts.forEach(p => p ? seg.push(p) : flush()); flush(); }
    let dpath = "", pen = false;
    l.vals.forEach((v, i) => { if (v == null) { pen = false; return; } dpath += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${Y(v).toFixed(1)}`; pen = true; });
    const single = l.vals.filter(v => v != null).length === 1;
    svg += single ? l.vals.map((v, i) => v == null ? "" : `<circle cx="${x(i)}" cy="${Y(v)}" r="3" style="fill:${l.color}"/>`).join("") : `<path class="ln${l.dashed ? " dash" : ""}" style="stroke:${l.color}" d="${dpath}"/>`;
  }
  el.innerHTML = `<svg class="hx-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${R.label}">${svg}<line class="cur" x1="0" x2="0" y1="${top}" y2="${top + ih}" visibility="hidden"/><rect class="hit" x="${padL}" y="0" width="${iw}" height="${H}"/></svg><div class="hx-tip" hidden></div>`;
  const s = el.querySelector("svg"), tip = el.querySelector(".hx-tip"), cur = el.querySelector(".cur");
  const fmtB = b => R.bucket === "hour" ? `${b.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${String(b.getHours()).padStart(2, "0")}:00` : R.bucket === "day" ? b.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : b.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const show = e => { const r = s.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width), i = Math.max(0, Math.min(n - 1, Math.floor((px - padL) / bw)));
    const lines = o.tip(i).filter(Boolean); if (!lines.length) return hide();
    cur.setAttribute("x1", x(i)); cur.setAttribute("x2", x(i)); cur.setAttribute("visibility", "visible");
    tip.innerHTML = `<span>${fmtB(R.buckets[i])}</span>${lines.map(t => `<div>${t}</div>`).join("")}`; tip.hidden = false;
    const left = x(i) / W * r.width; tip.style.left = `${Math.min(Math.max(left, 70), r.width - 70)}px`; };
  const hide = () => { tip.hidden = true; cur.setAttribute("visibility", "hidden"); };
  s.addEventListener("pointermove", show); s.addEventListener("pointerdown", show); s.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") hide(); });
}
// navigation buttons, same in both apps
function navHTML(nav) { return nav.map(([k, l, p]) => `<button class="nav" data-tab="${k}" aria-current="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg><span>${l}</span></button>`).join(""); }
