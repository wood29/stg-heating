/* Seewärme floor plan: the St. Gilgen flat as a small architectural model.
   Geometry is in plan pixels of the Sensopia floor plan (≈ 84.6 px per metre). */
const PLAN = (() => {
  const R = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const rooms = [
    { id: "living_room", name: "Living room", heated: true, poly: R(916, 205, 1355, 552) },
    { id: "kitchen", name: "Dining room", heated: true, poly: [[905, 552], [1505, 552], [1505, 768], [1483, 768], [1483, 910], [916, 910], [916, 695], [905, 695]] },
    { id: "hall", name: "Hall", heated: true, poly: [[672, 557], [905, 557], [905, 700], [672, 700]] },
    { id: "bathroom", name: "Bathroom", heated: true, poly: R(672, 700, 820, 910) },
    { id: "bedroom", name: "Bedroom", heated: true, poly: R(355, 557, 662, 838) },
    { id: "wardrobe", name: "Wardrobe", poly: R(355, 838, 662, 910) },
    { id: "toilet", name: "WC", poly: R(830, 700, 905, 910) },
    { id: "closet", name: "Closet", poly: R(770, 205, 905, 388) },
    { id: "sauna", name: "Sauna", poly: R(770, 392, 905, 552) },
    { id: "balcony", name: "Balcony", outdoor: true, poly: R(1362, 205, 1505, 548) },
  ];
  // Walls: [x1, y1, x2, y2, height] (door openings are simply left out)
  const H = 50; // ≈ 0.75 m: a cut-away model, so the rooms stay visible
  const walls = [
    [750, 183, 1375, 205], [750, 183, 770, 557], [333, 537, 672, 557], [333, 537, 355, 645], [333, 808, 355, 932],
    [333, 910, 690, 932], [805, 910, 930, 932], [1065, 910, 1503, 932], [1483, 768, 1503, 932],
    [1505, 537, 1525, 565], [1505, 765, 1525, 790], [1483, 768, 1525, 790],
    [905, 205, 916, 262], [905, 325, 916, 557], [770, 386, 905, 394], [744, 548, 770, 557],
    [838, 548, 916, 557], [916, 548, 1012, 557], [1355, 548, 1525, 557],
    [662, 537, 672, 598], [662, 662, 672, 932],
    [672, 695, 682, 705], [740, 695, 838, 705], [897, 695, 916, 705],
    [820, 700, 830, 932], [905, 700, 916, 932],
  ].map(w => [...w, H]);
  const glass = [
    [1355, 205, 1362, 525, H], [1510, 565, 1520, 765, H], [690, 916, 805, 926, H], [930, 916, 1065, 926, H], [339, 645, 349, 808, H],
  ];
  const rails = [[1362, 200, 1510, 205, 26], [1505, 200, 1510, 548, 26]];
  const low = [[355, 836, 662, 840, 14]]; // wardrobe sliding doors
  const outline = [[333, 537], [750, 537], [750, 183], [1375, 183], [1375, 200], [1510, 200], [1510, 537], [1525, 537], [1525, 790], [1503, 790], [1503, 932], [333, 932]];
  const furniture = [
    { kind: "fireplace", box: [1106, 557, 1312, 597, 46] },
    { kind: "bed", box: [432, 562, 581, 708, 16] },
    { kind: "bench", box: [856, 522, 905, 548, 22] },
  ];
  return { rooms, walls, glass, rails, low, outline, furniture };
})();

function isoProjector(angleDeg = 32, tilt = 0.56, scale = 0.42) {
  const a = angleDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return {
    p(x, y, z = 0) { const xr = x * ca - y * sa, yr = x * sa + y * ca; return [xr * scale, (yr * tilt - z) * scale]; },
    depth(x, y) { return x * sa + y * ca; },
    // outward normal of an edge points toward the viewer when its rotated y-component is positive
    faces(nx, ny) { return nx * sa + ny * ca > 0.001; },
  };
}

/* Renders the model into an <svg>. room(state) → { fill, label, sub, hot } decides the look per room. */
function renderPlan(svg, look, opts = {}) {
  const P = isoProjector(opts.angle, opts.tilt, 0.42);
  const pts = arr => arr.map(([x, y, z]) => P.p(x, y, z).map(v => v.toFixed(1)).join(",")).join(" ");
  const box = ([x1, y1, x2, y2, h], z0 = 0, edges = [1, 1, 1, 1]) => {
    const c = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    let s = "";
    const normals = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = c[i], [bx, by] = c[(i + 1) % 4], [nx, ny] = normals[i];
      if (!edges[i] || !P.faces(nx, ny)) continue;
      const shade = Math.abs(nx) > 0 ? "side-a" : "side-b";
      s += `<polygon class="${shade}" points="${pts([[ax, ay, z0], [bx, by, z0], [bx, by, z0 + h], [ax, ay, z0 + h]])}"/>`;
    }
    s += `<polygon class="top" points="${pts(c.map(([x, y]) => [x, y, z0 + h]))}"/>`;
    return s;
  };
  // slab under the whole flat
  let slab = "";
  const o = PLAN.outline;
  for (let i = 0; i < o.length; i++) {
    const [ax, ay] = o[i], [bx, by] = o[(i + 1) % o.length];
    const nx = by - ay, ny = -(bx - ax); // clockwise outline → this is the outward normal
    if (P.faces(nx, ny)) slab += `<polygon class="slab-side" points="${pts([[ax, ay, -18], [bx, by, -18], [bx, by, 0], [ax, ay, 0]])}"/>`;
  }
  const floors = PLAN.rooms.map(r => {
    const L = look(r);
    return `<polygon class="floor ${r.outdoor ? "outdoor" : ""} ${L.cls || ""}" data-room="${r.heated ? r.id : ""}" style="${L.fill ? `fill:${L.fill}` : ""}" points="${pts(r.poly.map(([x, y]) => [x, y, 0]))}"/>`;
  }).join("");
  // everything that stands up, far to near
  const solids = [
    ...PLAN.walls.map(b => ({ b, cls: "wall" })), ...PLAN.glass.map(b => ({ b, cls: "glass" })),
    ...PLAN.rails.map(b => ({ b, cls: "rail" })), ...PLAN.low.map(b => ({ b, cls: "rail" })),
    ...PLAN.furniture.map(f => ({ b: f.box, cls: f.kind })),
  ].flatMap(s => {
    // long walls are cut into short pieces so near/far order stays right
    const [x1, y1, x2, y2, h] = s.b, alongX = x2 - x1 >= y2 - y1, len = alongX ? x2 - x1 : y2 - y1, n = s.cls === "wall" || s.cls === "rail" ? Math.max(1, Math.ceil(len / 24)) : 1;
    return Array.from({ length: n }, (_, i) => {
      const a = (alongX ? x1 : y1) + len * i / n, b = (alongX ? x1 : y1) + len * (i + 1) / n;
      const b2 = alongX ? [a, y1, b, y2, h] : [x1, a, x2, b, h];
      const edges = alongX ? [1, i === n - 1 ? 1 : 0, 1, i === 0 ? 1 : 0] : [i === 0 ? 1 : 0, 1, i === n - 1 ? 1 : 0, 1];
      return { cls: s.cls, b: b2, edges, d: P.depth((b2[0] + b2[2]) / 2, (b2[1] + b2[3]) / 2) };
    });
  }).sort((a, b) => a.d - b.d)
    .map(s => `<g class="${s.cls}">${box(s.b, 0, s.edges)}</g>`).join("");
  // fireplace glow
  const fp = PLAN.furniture[0].box, [gx, gy] = P.p((fp[0] + fp[2]) / 2, fp[3] + 4, 10);
  const glow = look.fire ? `<ellipse class="fire-glow" cx="${gx}" cy="${gy}" rx="34" ry="11"/>` : "";
  // labels for heated rooms
  const labels = opts.labels === false ? "" : PLAN.rooms.filter(r => r.heated).map(r => {
    const L = look(r);
    const cx = r.poly.reduce((a, p) => a + p[0], 0) / r.poly.length, cy = r.poly.reduce((a, p) => a + p[1], 0) / r.poly.length;
    const off = { living_room: [10, 40], kitchen: [60, 60], hall: [-10, 10], bathroom: [0, 40], bedroom: [40, 60] }[r.id] || [0, 0];
    const [x, y] = P.p(cx + off[0], cy + off[1], 0);
    return `<g class="pin ${L.cls || ""}" data-room="${r.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(__K__)" tabindex="0" role="button" aria-label="${r.name} ${L.label || ""}">
      __FULL__<rect x="-31" y="-31" width="62" height="29" rx="9"/>
      <text class="pin-name" x="0" y="-20.5" text-anchor="middle">${r.name}</text>
      <text class="pin-temp" x="0" y="-8" text-anchor="middle">${L.label || "–"}</text>
      ${L.hot ? `<circle class="pin-hot" cx="23" cy="-24" r="2.6"/>` : ""}__/FULL__
      __MINI__<rect x="${L.hot ? -22 : -18}" y="-19" width="${L.hot ? 44 : 36}" height="17" rx="8.5"/>
      <text class="pin-temp" x="${L.hot ? -3 : 0}" y="-6.6" text-anchor="middle">${L.label || "–"}</text>
      ${L.hot ? `<circle class="pin-hot" cx="15" cy="-10.5" r="2.4"/>` : ""}__/MINI__
      <circle class="pin-dot" cx="0" cy="2" r="2"/>
    </g>`;
  }).join("");
  // fit the drawing
  const allPts = [...PLAN.outline.map(([x, y]) => P.p(x, y, -18)), ...PLAN.outline.map(([x, y]) => P.p(x, y, 64))];
  const xs = allPts.map(p => p[0]), ys = allPts.map(p => p[1]);
  const pad = 14, minX = Math.min(...xs) - pad, minY = Math.min(...ys) - 46, w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad;
  svg.setAttribute("viewBox", `${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`);
  // keep labels readable at any size: about 11 px on screen whatever the drawing's scale
  const shown = svg.clientWidth || svg.parentElement?.clientWidth || w;
  const compact = shown < 520;
  const K = Math.min(2.8, Math.max(1.05, w / shown * (compact ? 1.0 : 1.2))).toFixed(2);
  svg.innerHTML = `<defs><filter id="shadow" x="-10%" y="-10%" width="120%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="10"/><feOffset dy="12"/><feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <radialGradient id="glow"><stop offset="0" stop-color="#FF8A3D" stop-opacity=".75"/><stop offset="1" stop-color="#FF8A3D" stop-opacity="0"/></radialGradient></defs>
    <g filter="url(#shadow)">${slab}<polygon class="slab-top" points="${pts(o.map(([x, y]) => [x, y, 0]))}"/>${floors}</g>${glow}${solids}${labels.replaceAll("__K__", K).replace(compact ? /__FULL__[\s\S]*?__\/FULL__/g : /__MINI__[\s\S]*?__\/MINI__/g, "").replace(/__\/?(FULL|MINI)__/g, "")}`;
}
