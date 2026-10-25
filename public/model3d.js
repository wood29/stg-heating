// Seewärme: the St. Gilgen flat as a lit 3D model (three.js).
// Built from the Sensopia floor plan (plan pixels, ≈ 84.6 px per metre) and the family's photos.
import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { RoundedBoxGeometry } from "./vendor/RoundedBoxGeometry.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

const S = 84.6, OX = 333, OY = 183;
const X = px => (px - OX) / S, Z = py => (py - OY) / S, L = px => px / S;
const WALL_H = 1.1;
const FRONT_H = .5;               // the front (south) walls are cut lower, like a doll's house               // cut-away height, so the rooms stay visible
const CX = X((333 + 1525) / 2), CZ = Z((183 + 932) / 2);

/* ---------------------------------------------------------------- materials */
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function oak(base = [196, 152, 104]) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const plankW = w / 6;
    for (let i = 0; i < 6; i++) {
      let y = -rnd() * 400;
      while (y < h) {
        const len = 620 + rnd() * 520, v = (rnd() - .5) * 26;
        const [r, gg, b] = base.map(c => Math.max(0, Math.min(255, c + v)));
        g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(i * plankW, y, plankW, len);
        for (let k = 0; k < 22; k++) {           // grain
          g.strokeStyle = `rgba(${r - 40},${gg - 40},${b - 34},${.05 + rnd() * .08})`; g.lineWidth = 1 + rnd() * 2;
          const x0 = i * plankW + rnd() * plankW; g.beginPath(); g.moveTo(x0, y); g.bezierCurveTo(x0 + rnd() * 10 - 5, y + len / 3, x0 + rnd() * 10 - 5, y + len * 2 / 3, x0 + rnd() * 8 - 4, y + len); g.stroke();
        }
        g.fillStyle = "rgba(60,40,20,.35)"; g.fillRect(i * plankW, y + len - 2, plankW, 2);
        y += len;
      }
      g.fillStyle = "rgba(60,40,20,.28)"; g.fillRect(i * plankW, 0, 2, h);
    }
  });
}
function tiles(color, line, n = 4) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .035})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.strokeStyle = line; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / (n / 2)); g.lineTo(w, i * h / (n / 2)); g.stroke(); }
  });
}
function stripes(colors, vertical = false) {
  return canvasTex(512, 512, (g, w, h) => {
    let p = 0; const total = colors.reduce((a, c) => a + c[1], 0);
    for (const [c, f] of colors) { const s = f / total * (vertical ? w : h); g.fillStyle = c; vertical ? g.fillRect(p, 0, s, h) : g.fillRect(0, p, w, s); p += s; }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * .06})`; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
  });
}
function painting(kind) {
  return canvasTex(512, 340, (g, w, h) => {
    if (kind === "trees") {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#c9a99a"); gr.addColorStop(1, "#7c8fa6"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#111"; for (let i = 0; i < 9; i++) { const x = 30 + i * 55 + rnd() * 20; g.lineWidth = 6 + rnd() * 6; g.beginPath(); g.moveTo(x, h); g.lineTo(x + rnd() * 20 - 10, 60); g.stroke(); for (let k = 0; k < 14; k++) { g.lineWidth = 1 + rnd() * 2; g.beginPath(); const y = 40 + rnd() * 160; g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 120, y - 40 - rnd() * 60); g.stroke(); } }
      g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(170, 220, 160, 80);
    } else {
      g.fillStyle = "#2c5f8a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = ["#7fc6e8", "#e8a33a", "#d9e6ef", "#1b3a5c", "#c4593a"][Math.floor(rnd() * 5)]; g.globalAlpha = .6; g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 9, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
  });
}
function logs() {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = "#5a3f26"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const x = rnd() * w, y = rnd() * h, r = 12 + rnd() * 16; g.fillStyle = `rgb(${190 + rnd() * 40},${140 + rnd() * 30},${90 + rnd() * 20})`; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y + r * .6); g.lineTo(x - r, y + r * .6); g.closePath(); g.fill(); g.strokeStyle = "rgba(90,60,30,.6)"; g.stroke(); }
  });
}
function panelling() {
  return canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) { const v = (rnd() - .5) * 30; g.fillStyle = `rgb(${190 + v},${132 + v},${70 + v})`; g.fillRect(0, i * h / 8, w, h / 8); g.fillStyle = "rgba(80,50,20,.35)"; g.fillRect(0, i * h / 8, w, 2);
      for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(110,70,30,${.08 + rnd() * .12})`; g.beginPath(); const y = i * h / 8 + rnd() * h / 8; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + rnd() * 8 - 4, w * 2 / 3, y + rnd() * 8 - 4, w, y + rnd() * 6 - 3); g.stroke(); }
      for (let k = 0; k < 2; k++) { g.fillStyle = "rgba(90,55,25,.45)"; g.beginPath(); g.ellipse(rnd() * w, i * h / 8 + h / 16, 6, 4, 0, 0, 7); g.fill(); } }
  });
}
function kilim() {
  return canvasTex(256, 512, (g, w, h) => {
    const cols = ["#9c3b23", "#c96a2b", "#efe3c8", "#6b2a1c", "#d98a3a"];
    for (let y = 0; y < h; y += 14) { g.fillStyle = cols[Math.floor(y / 14) % cols.length]; g.fillRect(0, y, w, 14); for (let x = 0; x < w; x += 16) { g.fillStyle = "rgba(255,240,210,.35)"; g.fillRect(x + ((y / 14) % 2) * 8, y + 5, 6, 4); } }
  });
}
function checks() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#f3efe8"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(150,60,40,.35)"; g.lineWidth = 2; for (let i = 0; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(140,40,30,.55)"; g.fillRect(rnd() * w, rnd() * h, 4, 3); }
  });
}

/* ---------------------------------------------------------------- build */
export function createModel() {
  const M = (opts) => new THREE.MeshStandardMaterial({ roughness: .8, metalness: 0, ...opts });
  const mat = {
    floor: M({ map: oak(), roughness: .55 }),
    wall: M({ color: 0xf6f4ef, roughness: .95 }),
    cap: M({ color: 0x1d1f22, roughness: .9 }),
    slab: M({ color: 0xe9e6e0, roughness: 1 }),
    tileLight: M({ map: tiles("#e7e0d4", "#d9d1c3", 4), roughness: .5 }),
    tileGrey: M({ map: tiles("#8d8f91", "#7b7d80", 3), roughness: .7 }),
    door: M({ color: 0xffffff, roughness: .45 }),
    oakFrame: M({ color: 0xb98a55, roughness: .55 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe6ef, roughness: .05, transmission: .85, transparent: true, opacity: .35, thickness: .02, ior: 1.45 }),
    glassDark: new THREE.MeshPhysicalMaterial({ color: 0x3a2a1e, roughness: .1, transparent: true, opacity: .55 }),
    white: M({ color: 0xfbfbf9, roughness: .5 }),
    gloss: M({ color: 0xffffff, roughness: .18 }),
    granite: M({ color: 0x1c1d1f, roughness: .25, metalness: .1 }),
    black: M({ color: 0x111214, roughness: .4 }),
    fabric: M({ color: 0xe8e3d9, roughness: 1 }),
    fabricDark: M({ color: 0xd8d2c6, roughness: 1 }),
    sage: M({ color: 0x9fb0a3, roughness: 1 }),
    bedding: M({ map: checks(), roughness: 1 }),
    curtain: M({ color: 0xd8cebf, roughness: 1 }),
    wardrobe: M({ map: oak([206, 170, 128]), roughness: .6 }),
    tableOak: M({ map: oak([201, 150, 94]), roughness: .5 }),
    pine: M({ map: panelling(), roughness: .7 }),
    sauna: M({ color: 0xe0b98a, roughness: .7 }),
    leather: M({ color: 0x7a3a22, roughness: .55 }),
    rugGrey: M({ color: 0xdedad2, roughness: 1 }),
    rugStripe: M({ map: stripes([["#3f6b52", 3], ["#e6dccb", 1], ["#b8403a", 2], ["#d8742e", 2], ["#4c3a35", 1], ["#e6dccb", 1]]), roughness: 1 }),
    kilim: M({ map: kilim(), roughness: 1 }),
    shag: M({ color: 0xf2eee6, roughness: 1 }),
    paintTrees: M({ map: painting("trees"), roughness: .6 }),
    paintBlue: M({ map: painting("blue"), roughness: .6 }),
    logs: M({ map: logs(), roughness: .9 }),
    fire: new THREE.MeshBasicMaterial({ color: 0xff8a3d }),
    fireCore: new THREE.MeshBasicMaterial({ color: 0xffd08a }),
    red: M({ color: 0xc9483f, roughness: .6 }),
    purple: new THREE.MeshPhysicalMaterial({ color: 0x4b2a7a, roughness: .15, transmission: .3, transparent: true, opacity: .9 }),
    plant: M({ color: 0x4f7a46, roughness: .9 }),
    steel: M({ color: 0xc8cbcf, roughness: .3, metalness: .8 }),
    toilet: M({ color: 0xffffff, roughness: .15 }),
    mat: M({ color: 0x1b2030, roughness: 1 }),
    antler: M({ color: 0xd9ccb4, roughness: .7 }),
    shield: M({ color: 0x2b1d14, roughness: .7 }),
  };

  const root = new THREE.Group();
  const add = (geo, m, x, y, z, { cast = true, recv = true, ry = 0, parent = root } = {}) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.castShadow = cast; mesh.receiveShadow = recv; parent.add(mesh); return mesh;
  };
  // box in plan pixels: x1,y1,x2,y2 + bottom/top in metres
  const pbox = (x1, y1, x2, y2, b, t, m, o = {}) => add(new THREE.BoxGeometry(L(x2 - x1), t - b, L(y2 - y1)), m, X((x1 + x2) / 2), (b + t) / 2, Z((y1 + y2) / 2), o);
  const rbox = (x1, y1, x2, y2, b, t, m, r = .04, o = {}) => add(new RoundedBoxGeometry(L(x2 - x1), t - b, L(y2 - y1), 3, Math.min(r, (t - b) / 2.1, L(x2 - x1) / 2.1, L(y2 - y1) / 2.1)), m, X((x1 + x2) / 2), (b + t) / 2, Z((y1 + y2) / 2), o);
  const cut = () => {};   // furniture keeps its own colour where the model is cut
  const floorPoly = (pts, m, y = 0, o = {}) => {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(X(x), -Z(z))));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.25, uv.getY(i) / 1.25);
    const mesh = new THREE.Mesh(g, m); mesh.position.y = y; mesh.receiveShadow = true; (o.parent || root).add(mesh); return mesh;
  };

  /* slab + floors */
  const outline = [[333, 537], [750, 537], [750, 183], [1375, 183], [1375, 200], [1510, 200], [1510, 537], [1525, 537], [1525, 790], [1503, 790], [1503, 932], [333, 932]];
  const slabShape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(X(x), -Z(z))));
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, { depth: .22, bevelEnabled: false }); slabGeo.rotateX(-Math.PI / 2);
  add(slabGeo, mat.slab, 0, -0.221, 0, { cast: true });
  const R = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const ROOMS = {
    living_room: R(916, 205, 1355, 548),
    kitchen: [[905, 557], [1505, 557], [1505, 768], [1483, 768], [1483, 910], [916, 910], [916, 695], [905, 695]],
    hall: [[672, 557], [905, 557], [905, 695], [672, 695]],
    bathroom: R(672, 705, 820, 910),
    bedroom: R(355, 557, 662, 910),
  };
  floorPoly(ROOMS.living_room, mat.floor, .002); floorPoly(ROOMS.kitchen, mat.floor, .002); floorPoly(ROOMS.hall, mat.floor, .002);
  floorPoly(R(1012, 548, 1106, 557), mat.floor, .002); floorPoly(R(672, 548, 744, 557), mat.floor, .002); floorPoly(R(770, 548, 838, 557), mat.floor, .002);
  floorPoly(R(662, 598, 672, 662), mat.floor, .002); floorPoly(R(682, 695, 740, 705), mat.tileLight, .002); floorPoly(R(838, 695, 897, 705), mat.tileLight, .002);
  floorPoly(R(905, 262, 916, 325), mat.floor, .002);
  floorPoly(ROOMS.bedroom, mat.floor, .002);
  floorPoly(ROOMS.bathroom, mat.tileLight, .002); floorPoly(R(830, 700, 905, 910), mat.tileLight, .002);
  floorPoly(R(770, 205, 905, 386), mat.floor, .002); floorPoly(R(770, 394, 905, 548), mat.sauna, .002);
  floorPoly(R(1362, 205, 1505, 548), mat.tileGrey, .002);

  /* walls: [x1,y1,x2,y2, top] */
  const walls = [
    [750, 183, 1375, 205], [750, 183, 770, 557], [333, 537, 672, 557], [333, 537, 355, 645], [333, 808, 355, 910], [333, 910, 355, 932, FRONT_H],
    [333, 910, 690, 932, FRONT_H], [805, 910, 930, 932, FRONT_H], [1065, 910, 1503, 932, FRONT_H], [1483, 768, 1503, 932, FRONT_H],
    [1505, 548, 1525, 565], [1505, 765, 1525, 790], [1483, 768, 1525, 790, FRONT_H],
    [905, 205, 916, 262], [905, 325, 916, 548], [770, 386, 905, 394], [744, 548, 770, 557], [838, 548, 916, 557],
    [916, 548, 1012, 557], [1312, 548, 1405, 557], [1470, 548, 1525, 557], [1355, 525, 1362, 548],
    [662, 537, 672, 598], [662, 662, 672, 932], [672, 695, 682, 705], [740, 695, 838, 705], [897, 695, 916, 705],
    [820, 700, 830, 932], [905, 700, 916, 932], [355, 836, 662, 840],
    [1362, 183, 1510, 205, .95], [1505, 205, 1510, 548, .95],   // balcony parapets
  ];
  for (const [x1, y1, x2, y2, top = WALL_H] of walls) {
    pbox(x1, y1, x2, y2, 0, top, mat.wall);
    pbox(x1, y1, x2, y2, top, top + .012, mat.cap, { cast: false });
  }
  /* windows: sill wall + oak frame + glass */
  const windowAt = (x1, y1, x2, y2, sill, head = WALL_H) => {
    if (sill > 0) { pbox(x1, y1, x2, y2, 0, sill, mat.wall); }
    const along = x2 - x1 > y2 - y1, mid = along ? (y1 + y2) / 2 : (x1 + x2) / 2;
    const f = 4; // frame in px
    if (along) { pbox(x1, mid - 3, x2, mid + 3, sill, sill + .05, mat.oakFrame); pbox(x1, mid - 3, x1 + f, mid + 3, sill, head, mat.oakFrame); pbox(x2 - f, mid - 3, x2, mid + 3, sill, head, mat.oakFrame); pbox(x1 + f, mid - 1, x2 - f, mid + 1, sill + .05, head, mat.glass, { cast: false }); }
    else { pbox(mid - 3, y1, mid + 3, y2, sill, sill + .05, mat.oakFrame); pbox(mid - 3, y1, mid + 3, y1 + f, sill, head, mat.oakFrame); pbox(mid - 3, y2 - f, mid + 3, y2, sill, head, mat.oakFrame); pbox(mid - 1, y1 + f, mid + 1, y2 - f, sill + .05, head, mat.glass, { cast: false }); }
    pbox(x1, y1, x2, y2, head, head + .012, mat.cap, { cast: false });
  };
  windowAt(333, 645, 355, 808, .45);            // bedroom (behind the curtains)
  windowAt(690, 910, 805, 932, .3, FRONT_H);    // bathroom window (front walls are cut low)
  windowAt(930, 910, 1065, 932, .3, FRONT_H);   // dining room window at the end of the kitchen run
  windowAt(1505, 565, 1525, 765, .55);          // dining corner, triple window
  windowAt(1405, 548, 1470, 557, .7);           // dining corner, small window to the balcony
  windowAt(1355, 205, 1362, 525, 0);            // living room sliding door to the balcony
  pbox(1355, 365, 1362, 371, 0, WALL_H, mat.oakFrame);   // sliding door mullion

  /* doors (all white; sauna dark glass) */
  const door = (hx, hy, widthPx, angleDeg, m = mat.door, glassDoor = false) => {
    const w = L(widthPx), g = new THREE.Group(); g.position.set(X(hx), 0, Z(hy)); g.rotation.y = THREE.MathUtils.degToRad(angleDeg); root.add(g);
    if (glassDoor) {
      add(new THREE.BoxGeometry(w, WALL_H, .03), mat.glassDark, w / 2, WALL_H / 2, 0, { parent: g, cast: false });
      add(new THREE.BoxGeometry(w, .04, .045), mat.oakFrame, w / 2, WALL_H - .02, 0, { parent: g });
      add(new THREE.BoxGeometry(.04, WALL_H, .045), mat.oakFrame, .02, WALL_H / 2, 0, { parent: g });
      add(new THREE.BoxGeometry(.03, .5, .03), mat.white, w - .1, .9, .05, { parent: g });
    } else {
      add(new THREE.BoxGeometry(w, WALL_H, .04), m, w / 2, WALL_H / 2, 0, { parent: g });
      add(new THREE.BoxGeometry(.12, .02, .03), mat.steel, w - .1, 1.0, .04, { parent: g });
    }
  };
  door(672, 552, 72, -75);           // entrance (front door)
  door(838, 552, 68, -100, mat.door, true); // sauna, dark glass
  door(667, 662, 64, 160);           // bedroom
  door(682, 700, 58, -80);           // bathroom
  door(897, 700, 59, -100);          // WC
  door(910, 262, 63, 100);           // closet

  /* ------------------------------------------------ living room */
  rbox(1000, 300, 1290, 470, .002, .012, mat.rugGrey, .005, { cast: false });                  // rug
  // L-sofa on the far wall, chaise next to the sliding door
  rbox(1065, 212, 1330, 290, .1, .44, mat.fabric, .05); rbox(1065, 208, 1330, 228, .1, .82, mat.fabric, .05);
  rbox(1060, 212, 1080, 290, .1, .62, mat.fabric, .04);
  rbox(1255, 212, 1340, 400, .1, .44, mat.fabric, .05);
  for (let i = 0; i < 3; i++) rbox(1090 + i * 52, 224, 1138 + i * 52, 246, .44, .76, mat.fabricDark, .06);
  rbox(1262, 300, 1330, 360, .44, .465, M({ color: 0x5a5d61, roughness: 1 }), .02);              // throw on the chaise
  for (const [x, y] of [[1068, 285], [1250, 285], [1068, 216], [1335, 395]]) pbox(x, y, x + 5, y + 5, 0, .1, mat.black);
  pbox(1110, 207, 1235, 209, .83, 1.08, mat.paintTrees, { cast: false });                       // painting above the sofa
  // coffee table (oak) and shaggy pouf
  rbox(1110, 320, 1230, 375, .38, .42, mat.tableOak, .01);
  for (const [x, y] of [[1114, 324], [1222, 324], [1114, 367], [1222, 367]]) pbox(x, y, x + 4, y + 4, 0, .38, mat.tableOak);
  rbox(1135, 392, 1195, 448, 0, .22, mat.shag, .06);
  pbox(1160, 340, 1166, 346, .42, .52, mat.black);                                              // candle
  // TV wall opposite the sliding doors: floating white sideboard, TV, vase, floor lamp
  rbox(918, 300, 950, 440, .1, .48, mat.white, .01);
  pbox(916, 322, 919, 418, .58, 1.05, mat.black, { cast: false });
  add(new THREE.CylinderGeometry(.09, .07, .6, 24), mat.purple, X(935), .3, Z(285));
  add(new THREE.CylinderGeometry(.012, .012, 1.0, 8), mat.white, X(928), .5, Z(462)); add(new THREE.CylinderGeometry(.14, .14, .02, 24), mat.white, X(928), .01, Z(462));
  add(new THREE.CylinderGeometry(.06, .08, .12, 20), mat.white, X(928), 1.0, Z(462));
  // balcony: red bench with cushions on the north side
  rbox(1385, 215, 1470, 245, .38, .43, mat.red, .02); rbox(1385, 210, 1470, 214, .43, .75, mat.red, .02);
  for (const [x, y] of [[1385, 215], [1466, 215], [1385, 241], [1466, 241]]) pbox(x, y, x + 4, y + 4, 0, .38, mat.red);
  rbox(1392, 218, 1425, 232, .43, .7, mat.fabric, .05); rbox(1430, 218, 1462, 232, .43, .68, mat.fabric, .05);

  /* ------------------------------------------------ tunnel fireplace (living ↔ dining) */
  pbox(1106, 548, 1312, 597, 0, WALL_H, mat.wall); pbox(1106, 548, 1312, 597, WALL_H, WALL_H + .012, mat.cap, { cast: false });
  pbox(1150, 546, 1268, 599, .35, .8, mat.black, { cast: false });       // firebox, open to both sides
  const flames = [];
  for (let i = 0; i < 6; i++) { const f = add(new THREE.ConeGeometry(.07 + i % 2 * .03, .28, 10), i % 2 ? mat.fireCore : mat.fire, X(1165 + i * 18), .5, Z(572), { cast: false, recv: false }); flames.push(f); }
  pbox(1160, 565, 1258, 580, .35, .4, mat.logs, { cast: false });
  const fireLight = new THREE.PointLight(0xff8a3d, 1.6, 4, 2); fireLight.position.set(X(1209), .6, Z(572)); root.add(fireLight);
  pbox(1316, 557, 1346, 575, .05, WALL_H - .02, mat.logs);                         // log niche
  for (let i = 0; i < 5; i++) {                                            // trophies above the fireplace (dining side)
    const x = 1130 + i * 38, y = i % 2 ? .86 : .96;
    add(new THREE.BoxGeometry(.13, .17, .02), mat.shield, X(x), y, Z(598));
    add(new THREE.ConeGeometry(.015, .14, 6), mat.antler, X(x - 3), y + .14, Z(600)); add(new THREE.ConeGeometry(.015, .14, 6), mat.antler, X(x + 3), y + .14, Z(600));
  }

  /* ------------------------------------------------ dining corner (3): panelling, corner bench, antique table */
  pbox(1346, 557, 1505, 562, 0, WALL_H, mat.pine, { cast: false });
  pbox(1500, 557, 1505, 768, 0, .55, mat.pine, { cast: false });
  rbox(1350, 562, 1500, 594, .42, .48, mat.tableOak, .01); rbox(1468, 594, 1500, 740, .42, .48, mat.tableOak, .01);
  pbox(1350, 562, 1500, 594, 0, .42, mat.pine, { cast: false }); pbox(1468, 594, 1500, 740, 0, .42, mat.pine, { cast: false });
  rbox(1356, 565, 1386, 580, .48, .74, M({ color: 0x2e4a7a, roughness: 1 }), .04); rbox(1470, 600, 1484, 630, .48, .72, M({ color: 0x4a4f63, roughness: 1 }), .04);
  rbox(1370, 610, 1462, 668, .74, .78, mat.tableOak, .01);
  for (const [x, y] of [[1376, 614], [1452, 614], [1376, 660], [1452, 660]]) add(new THREE.CylinderGeometry(.03, .025, .74, 10), mat.tableOak, X(x), .37, Z(y));
  rbox(1395, 620, 1440, 655, .78, .785, mat.white, .002, { cast: false });
  rbox(1385, 690, 1420, 715, .42, .46, mat.tableOak, .01);
  for (const [x, y] of [[1388, 693], [1416, 693], [1388, 711], [1416, 711]]) pbox(x, y, x + 3, y + 3, 0, .42, mat.tableOak);
  add(new THREE.SphereGeometry(.08, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.white, X(1405), .78, Z(632), { ry: 0 }).rotation.x = Math.PI;
  // middle of the room: striped rug and leather pouf
  rbox(1035, 650, 1265, 820, .002, .012, mat.rugStripe, .005, { cast: false });
  rbox(1120, 700, 1190, 765, 0, .36, mat.leather, .08);

  /* ------------------------------------------------ kitchen (4): white run opposite the fireplace, granite top */
  const kz1 = 852, kz2 = 910;
  rbox(1072, kz1, 1400, kz2, .1, .86, mat.white, .01); pbox(1072, kz1 + 2, 1400, kz2, 0, .1, mat.black);
  rbox(1070, kz1 - 2, 1402, kz2, .86, .9, mat.granite, .006);
  for (let x = 1120; x < 1400; x += 58) pbox(x, kz1 - .5, x + 1, kz1, .12, .84, mat.fabricDark, { cast: false });
  rbox(1400, kz1, 1483, kz2, 0, WALL_H - .02, mat.white, .01); cut(1400, kz1, 1483, kz2);   // tall units
  pbox(1418, kz1 - 1, 1452, kz1, .78, 1.12, mat.black, { cast: false });           // oven
  pbox(1072, 908, 1400, 910, .9, FRONT_H + .2, mat.gloss, { cast: false });       // white glass splashback
  pbox(1150, 862, 1185, 890, .88, .905, mat.steel, { cast: false });              // sink
  pbox(1290, 860, 1350, 895, .9, .906, mat.black, { cast: false });               // hob

  /* ------------------------------------------------ hall */
  rbox(712, 600, 868, 652, .002, .01, mat.kilim, .004, { cast: false });
  pbox(673, 600, 676, 650, .65, 1.05, mat.oakFrame, { cast: false });               // old window-frame coat hook

  /* ------------------------------------------------ bedroom (1): bed against the solid wall, curtains, wall-to-wall wardrobe */
  rbox(440, 565, 585, 580, .1, 1.05, mat.sage, .06);                               // upholstered headboard
  rbox(445, 578, 580, 742, .1, .42, mat.sage, .05);
  rbox(448, 590, 577, 740, .42, .55, mat.bedding, .07);
  rbox(456, 582, 510, 602, .5, .62, mat.white, .05); rbox(515, 582, 569, 602, .5, .62, mat.white, .05);
  rbox(410, 565, 436, 590, 0, .5, mat.tableOak, .01); rbox(590, 565, 616, 590, 0, .5, mat.tableOak, .01);
  pbox(458, 557, 567, 559, .7, 1.06, mat.paintBlue, { cast: false });
  for (let i = 0; i < 7; i++) rbox(357, 600 + i * 30, 366, 628 + i * 30, 0, WALL_H - .05, mat.curtain, .03);       // curtains
  rbox(357, 843, 660, 908, 0, WALL_H - .03, mat.wardrobe, .006); cut(357, 843, 660, 908);                     // wardrobe
  for (let x = 400; x < 660; x += 50) pbox(x, 842, x + 1, 843, .05, WALL_H - .06, mat.fabricDark, { cast: false });

  /* ------------------------------------------------ bathroom (2) and WC */
  rbox(674, 740, 712, 800, .45, .85, mat.white, .01); pbox(684, 752, 704, 788, .85, .9, mat.gloss);             // vanity + basin
  rbox(674, 708, 712, 738, 0, WALL_H - .03, mat.gloss, .01); cut(674, 708, 712, 738);                          // tall cabinet
  pbox(672, 820, 760, 822, 0, WALL_H - .05, mat.glass, { cast: false });                                               // walk-in shower glass
  add(new THREE.CylinderGeometry(.11, .11, .015, 24), mat.steel, X(760), 1.0, Z(880));
  rbox(700, 760, 780, 800, .002, .012, M({ color: 0x8a8580, roughness: 1 }), .004, { cast: false });
  rbox(850, 878, 885, 906, .3, .45, mat.toilet, .08); pbox(855, 904, 880, 907, .45, .75, mat.tileLight);         // WC
  rbox(892, 760, 904, 790, .7, .82, mat.toilet, .03);
  rbox(845, 740, 890, 780, .002, .01, mat.mat, .004, { cast: false });
  pbox(832, 700, 903, 702, .02, .9, mat.tileLight, { cast: false });

  /* ------------------------------------------------ sauna (5) and closet */
  pbox(772, 396, 903, 400, 0, WALL_H - .04, mat.sauna, { cast: false }); pbox(772, 396, 776, 548, 0, WALL_H - .04, mat.sauna, { cast: false });
  pbox(899, 396, 903, 548, 0, WALL_H - .04, mat.sauna, { cast: false });
  rbox(776, 400, 899, 445, .85, .9, mat.sauna, .01); pbox(776, 400, 899, 445, 0, .85, M({ color: 0xcfa577, roughness: .8 }), { cast: false });
  rbox(776, 445, 899, 478, .42, .46, mat.sauna, .01);
  pbox(820, 399, 855, 401, .9, 1.08, mat.black, { cast: false });
  const saunaLight = new THREE.PointLight(0xff9a5a, .6, 2.2, 2); saunaLight.position.set(X(838), 1.0, Z(470)); root.add(saunaLight);
  rbox(772, 207, 903, 240, 0, WALL_H - .03, mat.white, .01); cut(772, 207, 903, 240);                          // closet shelving

  /* plants */
  const plant = (x, y, h = .5) => { add(new THREE.CylinderGeometry(.09, .07, .22, 16), mat.white, X(x), .11, Z(y)); add(new THREE.SphereGeometry(h / 2.2, 14, 10), mat.plant, X(x), .22 + h / 3, Z(y)); };
  plant(1343, 228, .7); plant(1480, 520, .5);

  /* ------------------------------------------------ heating overlay per room */
  const heat = {};
  for (const [id, poly] of Object.entries(ROOMS)) {
    const m = new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0, depthWrite: false });
    const mesh = floorPoly(poly, m, .016); mesh.receiveShadow = false; mesh.renderOrder = 2; mesh.userData.room = id;
    const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(X(x), Z(z))));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(sh.getPoints().map(p => new THREE.Vector3(p.x, .02, p.y))), new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0 }));
    root.add(edge);
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const anchors = { living_room: [1180, 470], kitchen: [1180, 640], hall: [790, 640], bathroom: [745, 860], bedroom: [508, 790] };
    const [ax, ay] = anchors[id] || [cx, cy];
    heat[id] = { mesh, mat: m, edge, anchor: new THREE.Vector3(X(ax), .05, Z(ay)) };
  }

  /* ------------------------------------------------ scene, lights, camera */
  const scene = new THREE.Scene();
  scene.add(root);
  { const bb = new THREE.Box3().setFromObject(root), c = bb.getCenter(new THREE.Vector3()); root.position.set(-c.x, 0, -c.z); }
  const shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .16 }));
  shadowGround.rotation.x = -Math.PI / 2; shadowGround.position.y = -.22; shadowGround.receiveShadow = true; scene.add(shadowGround);
  scene.add(new THREE.HemisphereLight(0xfffaf2, 0xcdbfae, .32));
  const sun = new THREE.DirectionalLight(0xfff1df, 2.9); sun.position.set(-7, 11, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; sun.shadow.radius = 4;
  scene.add(sun);

  let opts_zoom = 1, ro = null;
  let renderer, camera, controls, pmrem, host = null, labelsEl = null, raf = 0, onPick = null, onRender = null, last = 0, interactive = false;
  const pins = {};

  function ensureRenderer() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch { return false; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    scene.environmentIntensity = .42;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    const az = THREE.MathUtils.degToRad(-6), el = THREE.MathUtils.degToRad(58), d = 30;
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    camera.lookAt(0, 0, 0);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minZoom = .8; controls.maxZoom = 3.2;
    controls.minPolarAngle = THREE.MathUtils.degToRad(20); controls.maxPolarAngle = THREE.MathUtils.degToRad(70);
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    renderer.domElement.style.touchAction = "pan-y";
    // tap / click on a room
    let down = null;
    renderer.domElement.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(Object.values(heat).map(h => h.mesh))[0];
      if (hit && onPick) onPick(hit.object.userData.room);
    });
    return true;
  }

  function size() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    // fit the whole flat (≈ 14.6 m × 9.5 m seen from above at an angle)
    const aspect = w / h, needW = 14.2, needH = 9.0;
    const vh = Math.max(needH, needW / aspect) / (opts_zoom || 1);
    camera.left = -vh * aspect / 2; camera.right = vh * aspect / 2; camera.top = vh / 2; camera.bottom = -vh / 2; camera.updateProjectionMatrix();
  }

  function placePins() {
    if (!labelsEl) return;
    const w = host.clientWidth, h = host.clientHeight;
    for (const [id, p] of Object.entries(pins)) {
      const v = heat[id].anchor.clone().add(root.position).project(camera);
      p.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (document.hidden || !host) return;
    if (t - last < 33) return; last = t;
    const k = t / 1000;
    flames.forEach((f, i) => { f.scale.y = .8 + Math.sin(k * 7 + i * 1.7) * .18 + Math.sin(k * 13 + i) * .08; f.scale.x = .9 + Math.sin(k * 5 + i) * .08; });
    fireLight.intensity = 1.4 + Math.sin(k * 9) * .25 + Math.sin(k * 17) * .15;
    controls.update();
    renderer.render(scene, camera);
    placePins();
  }

  return {
    ok: () => ensureRenderer(),
    // show the model inside `el`; labels go into an overlay div
    mount(el, opts = {}) {
      if (!ensureRenderer()) return false;
      if (host === el) return true;
      host = el; interactive = !!opts.interactive;
      el.querySelector(".m3d-canvas")?.remove();
      renderer.domElement.className = "m3d-canvas"; el.prepend(renderer.domElement);
      labelsEl = el.querySelector(".m3d-labels"); for (const k in pins) delete pins[k];
      controls.enabled = interactive;
      if (!ro) ro = new ResizeObserver(() => { size(); placePins(); });
      ro.disconnect(); ro.observe(el); size();
      if (!raf) raf = requestAnimationFrame(loop);
      return true;
    },
    onPick(fn) { onPick = fn; },
    // looks: { room: { state: "hot"|"ok"|"low"|"off", label, name, selected } }
    update(looks) {
      if (!renderer) return;
      for (const [id, h] of Object.entries(heat)) {
        const L = looks[id] || {};
        const color = { hot: 0xff6a2a, low: 0x3d8fb8, off: 0x888888, ok: 0xffb36b }[L.state] || 0xffb36b;
        h.mat.color.setHex(color); h.mat.opacity = { hot: .2, low: .2, off: .22, ok: 0 }[L.state] ?? 0;
        h.edge.material.opacity = L.selected ? .9 : 0;
      }
      if (!labelsEl) return;
      for (const [id, L] of Object.entries(looks)) {
        let p = pins[id];
        if (!p || !p.isConnected) { p = document.createElement("button"); p.className = "m3d-pin"; p.dataset.room = id; labelsEl.appendChild(p); pins[id] = p; }
        p.className = `m3d-pin ${L.state || ""} ${L.selected ? "sel" : ""} ${labelsEl.dataset.compact ? "compact" : ""}`;
        p.innerHTML = `<span class="n">${L.name}</span><b class="num">${L.label}</b>${L.state === "hot" ? "<i></i>" : ""}`;
        p.setAttribute("aria-label", `${L.name} ${L.label}`);
      }
      placePins();
    },
    resetView() { controls?.reset(); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    renderOnce() { controls.update(); renderer.render(scene, camera); placePins(); },
    snapshot() { controls.update(); renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); },
  };
}
