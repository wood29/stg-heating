// Seewärme: the photoreal flat (Cycles render) with live room tints and temperature pins.
// Same API as the old three.js model: mount, update, onPick, resetView, stop, renderOnce, snapshot.
const SRC = "img/flat.webp";

export async function createFlatView() {
  const geo = await (await fetch("img/flat.json", { cache: "no-cache" })).json();
  const [W, H] = geo.size;
  const ver = geo.v ? `?v=${geo.v}` : "";
  const img = new Image(); img.decoding = "async"; img.src = SRC + ver;
  img.alt = "The St. Gilgen flat: bedroom, hall, sauna, bathroom, WC, living room with tunnel fireplace, dining corner and kitchen";
  let host = null, labelsEl = null, stage = null, onPick = null;
  const pins = {}, polys = {};
  const NS = "http://www.w3.org/2000/svg";

  function buildStage() {
    stage = document.createElement("div"); stage.className = "fv-stage";
    img.className = "fv-img"; stage.appendChild(img);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "fv-heat"); svg.setAttribute("aria-hidden", "true");
    for (const [id, pts] of Object.entries(geo.rooms)) {
      const p = document.createElementNS(NS, "polygon");
      p.setAttribute("points", pts.map(q => q.join(",")).join(" "));
      p.setAttribute("class", "fv-room"); p.dataset.room = id; // the app's [data-room] click handler opens the room
      svg.appendChild(p); polys[id] = p;
    }
    stage.appendChild(svg);
  }

  return {
    ok: () => true,
    mount(el) {
      if (!stage) buildStage();
      if (host === el && stage.isConnected) return true;
      host = el;
      el.classList.add("fv");
      el.style.aspectRatio = `${W} / ${H}`;
      el.prepend(stage);
      labelsEl = el.querySelector(".m3d-labels");
      for (const k in pins) delete pins[k];
      return true;
    },
    onPick(fn) { onPick = fn; },
    // looks: { room: { state: "hot"|"ok"|"low"|"off", label, name, selected } }
    update(looks) {
      for (const [id, p] of Object.entries(polys)) {
        const L = looks[id] || {};
        p.setAttribute("class", `fv-room ${L.state || ""} ${L.selected ? "sel" : ""}`);
      }
      if (!labelsEl) return;
      for (const [id, L] of Object.entries(looks)) {
        const a = geo.anchors[id]; if (!a) continue;
        let p = pins[id];
        if (!p || !p.isConnected) { p = document.createElement("button"); if (L.go) p.dataset.go = L.go; else p.dataset.room = id; labelsEl.appendChild(p); pins[id] = p; }
        p.className = `m3d-pin ${L.state || ""} ${L.selected ? "sel" : ""} ${labelsEl.dataset.compact ? "compact" : ""} ${L.small ? "small" : ""}`;
        p.style.left = `${(a[0] / W * 100).toFixed(2)}%`; p.style.top = `${(a[1] / H * 100).toFixed(2)}%`;
        p.style.transform = "translate(-50%, -100%)";
        p.innerHTML = `<span class="n">${L.name}</span><b class="num">${L.label}</b>${L.state === "hot" ? "<i></i>" : ""}`;
        p.setAttribute("aria-label", `${L.name} ${L.label}`);
      }
    },
    resetView() {},
    stop() {},
    renderOnce() {},
    snapshot() { return SRC; },
  };
}
