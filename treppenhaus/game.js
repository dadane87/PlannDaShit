// Das Treppenhaus – ein begehbares Duplo-Haus.
// Welt in "Noppen"-Einheiten (1 = eine Duplo-Noppe), Höhen in Halbsteinen (1 Stein = 2 Level).
import * as THREE from './three.module.min.js';

// ───────────────────────── Konstanten ─────────────────────────
const LV = 0.6;          // Höhe eines Levels (halber Duplo-Stein) in Noppen-Einheiten
const STEP = 2;          // max. Stufenhöhe, die man ohne Springen schafft (1 Stein)
const PH = 4;            // Körperhöhe der Figuren in Leveln
const GRAV = 45, JUMP = 19;
const SPEED = 5.2;
const OX = 14, OZ = 14, GW = 52, GD = 52, GH = 40;

// ───────────────────────── Kollisionsgitter ─────────────────────────
const solid = new Uint8Array(GW * GD * GH);
const sidx = (x, z, l) => ((x + OX) * GD + (z + OZ)) * GH + l;
function isSolid(cx, cz, l) {
  if (l < 0) return true;                       // Boden
  if (l >= GH) return false;
  if (cx < -OX || cx >= GW - OX || cz < -OZ || cz >= GD - OZ) return false;
  return solid[sidx(cx, cz, l)] === 1;
}
function mark(x, z, w, d, y, h) {
  for (let i = x; i < x + w; i++) for (let j = z; j < z + d; j++) for (let l = y; l < y + h; l++) {
    if (i < -OX || i >= GW - OX || j < -OZ || j >= GD - OZ || l < 0 || l >= GH) continue;
    solid[sidx(i, j, l)] = 1;
  }
}
function floorOf(cx, cz, maxL) {
  for (let l = maxL; l >= 0; l--) if (isSolid(cx, cz, l - 1)) return l;
  return 0;
}
function corners(x, z, r) {
  return [[Math.floor(x - r), Math.floor(z - r)], [Math.floor(x + r), Math.floor(z - r)],
          [Math.floor(x - r), Math.floor(z + r)], [Math.floor(x + r), Math.floor(z + r)]];
}

// ───────────────────────── Farben & Materialien ─────────────────────────
const COL = {
  red: 0xd7262e, blue: 0x1f66d4, green: 0x2f9e3a, lime: 0x9fd038, yellow: 0xf8c800, orange: 0xf5811f,
  pink: 0xf08ac4, tan: 0xe6d19c, white: 0xf4f4f0, grey: 0xa1a5ad, dblue: 0x123f8c, teal: 0x36bcd0,
  brown: 0x8b5a2b, dbrown: 0x5b3a1a, purple: 0x9b5fc4, black: 0x1d1d1f, skin: 0xf6c77a, magenta: 0xe0409a,
  lpink: 0xf7b6d9, pig: 0xf7a8c9, cream: 0xfff5dc, beige: 0xd9b98a, sand: 0xc9a86a
};
const mats = {};
function M(c) {
  const k = typeof c === 'string' ? COL[c] : c;
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: k, roughness: 0.55, metalness: 0 }));
}
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_SPH = new THREE.SphereGeometry(1, 18, 14);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 18);

function box(p, w, h, d, c, x, y, z) {
  const m = new THREE.Mesh(G_BOX, M(c)); m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
}
function sph(p, r, c, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(G_SPH, M(c)); m.scale.set(r * sx, r * sy, r * sz); m.position.set(x, y, z);
  m.castShadow = true; p.add(m); return m;
}
function cyl(p, r, h, c, x, y, z, rx = 0, rz = 0) {
  const m = new THREE.Mesh(G_CYL, M(c)); m.scale.set(r, h, r); m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz); m.castShadow = true; p.add(m); return m;
}
function cone(p, rt, rb, h, c, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20), M(c)); m.position.set(x, y, z);
  m.castShadow = true; p.add(m); return m;
}
function torus(p, r, t, c, x, y, z, rx = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20), M(c)); m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0); p.add(m); return m;
}

// ───────────────────────── Szene ─────────────────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2eee6);
scene.fog = new THREE.Fog(0xf2eee6, 45, 110);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8c8a70, 0.85));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.7);
sun.position.set(18, 42, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 5; sun.shadow.camera.far = 120;
sun.shadow.camera.left = -28; sun.shadow.camera.right = 28; sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28;
sun.shadow.bias = -0.0004;
sun.target.position.set(12, 0, 12);
scene.add(sun, sun.target);

// Holzboden (Parkett) als prozedurale Textur
function plankTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a87a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) {
    const y = i * 128;
    g.fillStyle = ['#cfae80', '#c4a273', '#d2b285', '#c9a87a'][i];
    g.fillRect(0, y, 512, 128);
    g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = 2;
    g.strokeRect(0, y + 1, 512, 126);
    g.strokeStyle = 'rgba(120,85,45,.18)';
    for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(0, y + 8 + k * 9); g.lineTo(512, y + 12 + k * 9 + Math.sin(k) * 3); g.stroke(); }
    g.strokeStyle = 'rgba(90,60,30,.4)'; g.beginPath(); const sx = (i * 170) % 512; g.moveTo(sx, y); g.lineTo(sx, y + 128); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(12, -0.3, 12); floor.receiveShadow = true; scene.add(floor);
}

// ───────────────────────── Steine ─────────────────────────
const bricks = [];        // {x,z,w,d,y,h,c}
const solids = [];        // Meshes für Kamera-Sichtprüfung
const decor = new THREE.Group(); scene.add(decor);

function B(x, z, w, d, y, h, c, opts = {}) {
  bricks.push({ x, z, w, d, y, h, c, studs: !opts.noStuds });
  if (!opts.noSolid) mark(x, z, w, d, y, h);
}
// Ein Steinverlauf: segs = [[Länge, Farbe|null], …]; null = Lücke (Tür/Fenster)
function course(x, z, axis, d, y, segs) {
  let p = 0;
  for (const [len, c] of segs) {
    if (c) { if (axis === 'x') B(x + p, z, len, d, y, 2, c); else B(x, z + p, d, len, y, 2, c); }
    p += len;
  }
}

// Torbogen: w = Gesamtbreite entlang axis, leg = Pfeilerbreite, legH/archH in Leveln
function arch(x, z, w, d, y, leg, legH, archH, c, axis) {
  const H = (legH + archH) * LV, r = (w - 2 * leg) / 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(w, 0); shape.lineTo(w, H); shape.lineTo(0, H); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(leg, 0); hole.lineTo(w - leg, 0); hole.lineTo(w - leg, legH * LV);
  hole.absarc(w / 2, legH * LV, r, 0, Math.PI, false); hole.lineTo(leg, 0);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  const m = new THREE.Mesh(geo, M(c)); m.castShadow = true; m.receiveShadow = true;
  if (axis === 'x') { m.position.set(x, y * LV, z); }
  else { m.rotation.y = -Math.PI / 2; m.position.set(x + d, y * LV, z); }
  scene.add(m); solids.push(m);
  if (axis === 'x') {
    mark(x, z, leg, d, y, legH + archH); mark(x + w - leg, z, leg, d, y, legH + archH); mark(x + leg, z, w - 2 * leg, d, y + legH, archH);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) bricks.push({ x: x + i, z: z + j, w: 1, d: 1, y: y + legH + archH - 1, h: 1, c, studs: true, onlyStuds: true });
  } else {
    mark(x, z, d, leg, y, legH + archH); mark(x, z + w - leg, d, leg, y, legH + archH); mark(x, z + leg, d, w - 2 * leg, y + legH, archH);
    for (let i = 0; i < d; i++) for (let j = 0; j < w; j++) bricks.push({ x: x + i, z: z + j, w: 1, d: 1, y: y + legH + archH - 1, h: 1, c, studs: true, onlyStuds: true });
  }
}

// Schräge (Dach / Rutsche). high = Seite, an der die Schräge oben ist: 'N','S','E','W'
const G_WEDGE = (() => {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(-0.5, 0, -0.5); return g;
})();
function wedge(x, z, w, d, y, h, c, high, opts = {}) {
  const m = new THREE.Mesh(G_WEDGE, M(c)); m.castShadow = true; m.receiveShadow = true;
  const rot = { W: 0, E: Math.PI, N: -Math.PI / 2, S: Math.PI / 2 }[high];
  m.rotation.y = rot;
  if (high === 'N' || high === 'S') m.scale.set(d, h * LV, w); else m.scale.set(w, h * LV, d);
  m.position.set(x + w / 2, y * LV, z + d / 2);
  scene.add(m); solids.push(m);
  if (opts.ramp) {
    // Rampe: stufenweise absteigende Kollision, damit man hoch- und runterlaufen kann
    const n = (high === 'N' || high === 'S') ? d : w;
    for (let k = 0; k < n; k++) {
      const lv = Math.max(0, Math.round(h * (n - k) / n) - 1);
      if (lv <= 0) continue;
      if (high === 'N') mark(x, z + k, w, 1, y, lv);
      else if (high === 'S') mark(x, z + d - 1 - k, w, 1, y, lv);
      else if (high === 'W') mark(x + k, z, 1, d, y, lv);
      else mark(x + w - 1 - k, z, 1, d, y, lv);
    }
  } else if (!opts.noSolid) mark(x, z, w, d, y, h);
}

// Fensterstein: farbiger Rahmen, weißes Kreuz, Loch in der Mitte
function windowBrick(x, z, w, d, y, h, c, axis) {
  const H = h * LV, t = 0.35;
  const g = new THREE.Group(); g.position.set(x, y * LV, z);
  const along = axis === 'x' ? w : d, thick = axis === 'x' ? d : w;
  const mk = (aw, ah, ad, col, ax, ay, az) => axis === 'x' ? box(g, aw, ah, ad, col, ax, ay, az) : box(g, ad, ah, aw, col, az, ay, ax);
  mk(along, t, thick, c, along / 2, t / 2, thick / 2);
  mk(along, t, thick, c, along / 2, H - t / 2, thick / 2);
  mk(t, H, thick, c, t / 2, H / 2, thick / 2);
  mk(t, H, thick, c, along - t / 2, H / 2, thick / 2);
  mk(along - 2 * t, 0.12, 0.25, 'white', along / 2, H / 2, thick / 2);
  mk(0.12, H - 2 * t, 0.25, 'white', along / 2, H / 2, thick / 2);
  const pane = new THREE.Mesh(G_BOX, new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, roughness: 0.2 }));
  if (axis === 'x') { pane.scale.set(along - 2 * t, H - 2 * t, 0.05); pane.position.set(along / 2, H / 2, thick / 2); }
  else { pane.scale.set(0.05, H - 2 * t, along - 2 * t); pane.position.set(thick / 2, H / 2, along / 2); }
  g.add(pane);
  scene.add(g); g.children.forEach(ch => solids.push(ch));
  mark(x, z, w, d, y, h);
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) bricks.push({ x: x + i, z: z + j, w: 1, d: 1, y: y + h - 1, h: 1, c, studs: true, onlyStuds: true });
}

function fence(x, z, w, d, y, c) {
  const g = new THREE.Group(); g.position.set(x, y * LV, z);
  const horiz = w >= d, along = horiz ? w : d;
  for (let k = 0; k < along; k++) box(g, 0.16, 1.1, 0.16, c, horiz ? k + 0.5 : 0.5, 0.55, horiz ? 0.5 : k + 0.5);
  if (horiz) { box(g, w, 0.12, 0.1, c, w / 2, 0.85, 0.5); box(g, w, 0.12, 0.1, c, w / 2, 0.45, 0.5); }
  else { box(g, 0.1, 0.12, d, c, 0.5, 0.85, d / 2); box(g, 0.1, 0.12, d, c, 0.5, 0.45, d / 2); }
  scene.add(g); mark(x, z, w, d, y, 3);   // 3 Level hoch: darüber steigt niemand einfach so
}
function flower(x, z, y, petal, center = 'yellow') {
  const g = new THREE.Group(); g.position.set(x, y * LV, z);
  cyl(g, 0.06, 0.7, 'green', 0, 0.35, 0);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; sph(g, 0.17, petal, Math.cos(a) * 0.26, 0.75, Math.sin(a) * 0.26, 1, 0.5, 1); }
  sph(g, 0.14, center, 0, 0.8, 0);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.4; sph(g, 0.28, 'lime', Math.cos(a) * 0.35, 0.08, Math.sin(a) * 0.35, 1, 0.25, 0.55); }
  decor.add(g);
}
function tree(x, z, y) {
  const g = new THREE.Group(); g.position.set(x, y * LV, z);
  cyl(g, 0.14, 2.6, 'green', 0, 1.3, 0);
  for (const [dx, dy, dz, r] of [[0, 2.9, 0, 0.55], [0.5, 2.3, 0.1, 0.42], [-0.5, 2.0, -0.1, 0.4], [0.1, 1.5, 0.45, 0.35], [-0.1, 1.2, -0.45, 0.32]]) sph(g, r, 'green', dx, dy, dz, 1, 0.65, 1);
  decor.add(g); mark(Math.floor(x), Math.floor(z), 1, 1, y, 4);
}
function vine(x, z, y, h, side) {
  const g = new THREE.Group(); g.position.set(x, y * LV, z);
  for (let k = 0; k < h; k++) {
    const yy = k * 0.7 + 0.3; const dx = (k % 2 ? 0.25 : -0.25);
    sph(g, 0.22, 'green', dx * (side === 'x' ? 1 : 0), yy, dx * (side === 'x' ? 0 : 1), 1, 0.5, 1.2);
    cyl(g, 0.05, 0.75, 'green', 0, yy, 0, 0, side === 'x' ? 0.5 * (k % 2 ? 1 : -1) : 0);
  }
  decor.add(g);
}
function chair(x, z, y, c) {
  const g = new THREE.Group(); g.position.set(x + 0.5, y * LV, z + 0.5);
  box(g, 0.8, 0.12, 0.8, c, 0, 0.6, 0); box(g, 0.8, 0.8, 0.12, c, 0, 1.0, -0.34);
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) box(g, 0.14, 0.6, 0.14, c, dx, 0.3, dz);
  decor.add(g); mark(x, z, 1, 1, y, 2);
}
function table(x, z, y, c, w = 2) {
  const g = new THREE.Group(); g.position.set(x + w / 2, y * LV, z + w / 2);
  box(g, w - 0.1, 0.16, w - 0.1, c, 0, 1.1, 0);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.2, 1.05, 0.2, c, dx * (w / 2 - 0.25), 0.52, dz * (w / 2 - 0.25));
  decor.add(g); mark(x, z, w, w, y, 2);
}

// ───────────────────────── Das Haus ─────────────────────────
function buildHouse() {
  // Grundplatte 24×24
  {
    const plate = box(scene, 24, 0.3, 24, 'green', 12, -0.15, 12);
    plate.castShadow = false; solids.push(plate);
  }
  // ── Erdgeschoss (Level 0–8), Innenraum x 6–18, z 4–10, Trennwand bei x 11–13
  // Südwand (Vorderseite) mit Torbogen
  course(4, 10, 'x', 2, 0, [[4, 'tan'], [6, null], [2, 'teal'], [4, 'dblue']]);
  course(4, 10, 'x', 2, 2, [[4, 'lime'], [6, null], [4, 'green'], [2, 'pink']]);
  course(4, 10, 'x', 2, 4, [[4, 'tan'], [6, null], [2, 'pink'], [2, null], [2, 'teal']]);
  course(4, 10, 'x', 2, 6, [[4, 'yellow'], [6, null], [2, 'pink'], [2, null], [2, 'lime']]);
  arch(8, 10, 6, 2, 0, 1, 4, 4, 'tan', 'x');
  windowBrick(16, 10, 2, 2, 4, 4, 'dblue', 'x');
  // Ostwand
  course(18, 2, 'z', 2, 0, [[2, 'teal'], [2, 'dblue'], [4, 'green']]);
  course(18, 2, 'z', 2, 2, [[4, 'pink'], [2, 'teal'], [2, 'dblue']]);
  course(18, 2, 'z', 2, 4, [[2, 'green'], [2, null], [4, 'teal']]);
  course(18, 2, 'z', 2, 6, [[4, 'dblue'], [4, 'pink']]);
  windowBrick(18, 4, 2, 2, 4, 4, 'dblue', 'z');
  // Nordwand (Rückseite) mit Honigtopf-Stein, Gitterfenster, blauem Fenster
  course(6, 2, 'x', 2, 0, [[2, 'yellow'], [4, 'grey'], [2, 'blue'], [4, 'tan']]);
  course(6, 2, 'x', 2, 2, [[4, 'grey'], [2, 'tan'], [2, null], [4, 'lime']]);
  course(6, 2, 'x', 2, 4, [[4, 'tan'], [2, null], [2, null], [4, 'orange']]);
  course(6, 2, 'x', 2, 6, [[6, 'red'], [6, 'orange']]);
  windowBrick(10, 2, 2, 2, 4, 4, 'teal', 'x');
  windowBrick(12, 2, 2, 2, 2, 4, 'blue', 'x');
  // Westwand mit Tür (z 8–10) und beigem Fenster
  course(4, 2, 'z', 2, 0, [[6, 'white'], [2, null]]);
  course(4, 2, 'z', 2, 2, [[2, 'tan'], [2, 'white'], [2, 'tan'], [2, null]]);
  course(4, 2, 'z', 2, 4, [[2, 'white'], [2, 'tan'], [2, null], [2, 'white']]);
  course(4, 2, 'z', 2, 6, [[4, 'tan'], [2, null], [2, 'tan']]);
  windowBrick(4, 6, 2, 2, 4, 4, 'beige', 'z');
  // Trennwand mit rotem Bogen
  arch(11, 4, 6, 2, 0, 1, 4, 4, 'red', 'z');
  // Glitzerröhre im linken Zimmer
  {
    const m = new THREE.Mesh(G_CYL, new THREE.MeshStandardMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.55, roughness: 0.1 }));
    m.scale.set(0.45, 3.5, 0.45); m.position.set(6.5, 1.75, 4.5); scene.add(m); solids.push(m); mark(6, 4, 1, 1, 0, 6);
    for (let k = 0; k < 6; k++) sph(scene, 0.09, ['red', 'blue', 'yellow', 'pink', 'lime', 'orange'][k], 6.5 + Math.sin(k) * 0.2, 0.4 + k * 0.5, 4.5 + Math.cos(k) * 0.2);
  }
  // Veranda unter dem Deck (x 0–4) mit Stützen, graue Bank
  B(0, 2, 2, 2, 0, 8, 'tan'); B(0, 10, 2, 2, 0, 8, 'tan');
  B(2, 5, 2, 2, 0, 2, 'grey');
  // ── Deck (Level 8–10) über x 0–20, z 2–12
  const deckCols = [['lime', 'yellow', 'lime'], ['lime', 'lime', 'red'], ['yellow', 'lime', 'lime'], ['lime', 'red', 'lime'], ['lime', 'lime', 'yellow']];
  for (let r = 0; r < 5; r++) { const z = 2 + r * 2; B(0, z, 8, 2, 8, 2, deckCols[r][0]); B(8, z, 8, 2, 8, 2, deckCols[r][1]); B(16, z, 4, 2, 8, 2, deckCols[r][2]); }
  // ── Haupttreppe (links) vom Garten aufs Deck: 5 Stufen à 1 Stein
  B(0, 20, 4, 2, 0, 2, 'white');
  B(0, 18, 4, 2, 0, 2, 'lime'); B(0, 18, 4, 2, 2, 2, 'blue');
  B(0, 16, 4, 2, 0, 2, 'green'); B(0, 16, 4, 2, 2, 2, 'orange'); B(0, 16, 4, 2, 4, 2, 'blue');
  B(0, 14, 4, 2, 0, 2, 'lime'); B(0, 14, 4, 2, 2, 2, 'blue'); B(0, 14, 4, 2, 4, 2, 'orange'); B(0, 14, 4, 2, 6, 2, 'green');
  B(0, 12, 4, 2, 0, 2, 'tan'); B(0, 12, 4, 2, 2, 2, 'blue'); B(0, 12, 4, 2, 4, 2, 'lime'); B(0, 12, 4, 2, 6, 2, 'orange'); B(0, 12, 4, 2, 8, 2, 'blue');
  // ── Turm auf dem Deck (x 6–12, z 2–8), Level 10–18
  const tw = [['green', 'orange', 'blue'], ['red', 'pink', 'lime'], ['blue', 'red', 'orange'], ['pink', 'green', 'red']];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) B(6 + i * 2, 2, 2, 6, 10 + r * 2, 2, tw[r][i]);
  // Turmtreppe an der Rückseite (z 2–4) von Ost nach West hoch
  B(18, 2, 2, 2, 10, 2, 'tan');
  B(16, 2, 2, 2, 10, 2, 'blue'); B(16, 2, 2, 2, 12, 2, 'orange');
  B(14, 2, 2, 2, 10, 2, 'red'); B(14, 2, 2, 2, 12, 2, 'tan'); B(14, 2, 2, 2, 14, 2, 'blue');
  B(12, 2, 2, 2, 10, 2, 'orange'); B(12, 2, 2, 2, 12, 2, 'green'); B(12, 2, 2, 2, 14, 2, 'red'); B(12, 2, 2, 2, 16, 2, 'tan');
  // Turmspitze: schräges Dach hinten, Fahne, Papa-Wutz-Eimer auf Auslegerplatte
  wedge(6, 2, 6, 2, 18, 3, 'orange', 'N');
  B(10, 6, 2, 2, 18, 2, 'blue');
  B(3, 4, 3, 2, 17, 1, 'lime');
  {
    const g = new THREE.Group(); g.position.set(11, 19.2 * LV, 7);
    cyl(g, 0.07, 3.2, 'grey', 0, 1.6, 0); sph(g, 0.12, 'yellow', 0, 3.25, 0);
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.4, -0.35); s.lineTo(0, -0.7); s.closePath();
    const fl = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: COL.lime, side: THREE.DoubleSide }));
    fl.position.set(0.05, 3.15, 0); g.add(fl); g.userData.flag = fl; decor.add(g); flagMesh = fl;
  }
  {
    // Eimer für Papa Wutz
    const g = new THREE.Group(); g.position.set(3.5, 18 * LV, 4.5);
    cone(g, 0.5, 0.38, 0.8, 'orange', 0, 0.4, 0); torus(g, 0.42, 0.05, 'orange', 0, 0.85, 0, Math.PI / 2);
    decor.add(g); mark(3, 4, 1, 1, 18, 2);
  }
  // Baum & Blumenranke am Turm, Schranke, Zaun, Tisch, Stuhl, kleines blaues Haus
  tree(1.5, 3.5, 10);
  vine(5.7, 8.5, 10, 6, 'x');
  vine(19.9, 12.2, 0, 8, 'z');
  {
    const g = new THREE.Group(); g.position.set(3, 10 * LV, 11);
    B(2, 10, 2, 2, 10, 2, 'red');
    const pole = new THREE.Group(); pole.position.set(0, 1.25, 0); pole.rotation.x = -1.05;
    for (let k = 0; k < 6; k++) box(pole, 0.22, 0.7, 0.22, k % 2 ? 'white' : 'red', 0, 0.35 + k * 0.7, 0);
    g.add(pole); decor.add(g);
  }
  fence(12, 11, 4, 1, 10, 'green');
  fence(4, 11, 4, 1, 10, 'green');
  fence(0, 4, 1, 6, 10, 'lime');
  table(13, 8, 10, 'brown', 1);
  chair(14, 9, 10, 'yellow');
  // kleines blaues Haus auf dem Deck
  B(16, 8, 4, 4, 10, 4, 'teal');
  wedge(16, 8, 2, 4, 14, 2, 'blue', 'E'); wedge(18, 8, 2, 4, 14, 2, 'blue', 'W');
  {
    const g = new THREE.Group(); g.position.set(18, 10 * LV, 12.02);
    box(g, 1.2, 1.2, 0.08, 'white', 0, 1.3, 0); box(g, 1.0, 1.0, 0.1, 0xbfe8ff, 0, 1.3, 0);
    box(g, 0.1, 1.0, 0.12, 'white', 0, 1.3, 0); box(g, 1.0, 0.1, 0.12, 'white', 0, 1.3, 0);
    decor.add(g);
  }
  // ── Garten (z 12–24)
  B(14, 12, 2, 2, 0, 2, 'tan'); B(14, 12, 2, 2, 2, 2, 'tan'); B(16, 12, 2, 2, 0, 2, 'tan');
  wedge(14, 14, 2, 4, 0, 4, 'red', 'N', { ramp: true });
  wedge(20, 12, 2, 2, 0, 2, 'orange', 'N');
  B(20, 14, 2, 2, 0, 2, 'orange');
  {
    // grüner Anhänger
    const g = new THREE.Group(); g.position.set(7, 0, 17);
    box(g, 4, 0.25, 2, 'lime', 0, 0.35, 0);
    box(g, 4, 0.9, 0.18, 'lime', 0, 0.8, -0.91); box(g, 4, 0.9, 0.18, 'lime', 0, 0.8, 0.91);
    box(g, 0.18, 0.9, 2, 'lime', -1.91, 0.8, 0); box(g, 0.18, 0.9, 2, 'lime', 1.91, 0.8, 0);
    for (const dx of [-1.2, 1.2]) for (const dz of [-1.05, 1.05]) cyl(g, 0.3, 0.2, 'black', dx, 0.3, dz, Math.PI / 2);
    decor.add(g); mark(5, 16, 4, 2, 0, 2);
  }
  chair(11, 20, 0, 'red');
  table(18, 20, 0, 'tan', 2);
  chair(20, 21, 0, 'yellow');
  chair(17, 21, 0, 'brown');
  flower(21.5, 15.5, 0, 'yellow', 'orange'); flower(22.5, 19.5, 0, 'pink', 'yellow');
  flower(20.5, 23.2, 0, 'lime', 'yellow'); flower(7.5, 21.5, 0, 'pink', 'yellow'); flower(3.2, 22.6, 0, 'yellow', 'red');
  flower(22.8, 7.5, 0, 'pink', 'yellow');
  // ── Sichtbare Steine bauen (Instanzen) + Noppen
  buildInstances();
}
let flagMesh = null;

function buildInstances() {
  const real = bricks.filter(b => !b.onlyStuds);
  const inst = new THREE.InstancedMesh(G_BOX, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), real.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  real.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x + b.w / 2, (b.y + b.h / 2) * LV, b.z + b.d / 2), new THREE.Quaternion(), new THREE.Vector3(b.w - 0.04, b.h * LV - 0.03, b.d - 0.04));
    inst.setMatrixAt(i, m4); inst.setColorAt(i, col.set(COL[b.c]));
  });
  inst.castShadow = true; inst.receiveShadow = true; scene.add(inst); solids.push(inst);
  // Noppen
  const studs = [];
  const pushStud = (i, j, l, c) => studs.push([i + 0.5, l * LV, j + 0.5, c]);
  for (const b of bricks) if (b.studs) for (let i = b.x; i < b.x + b.w; i++) for (let j = b.z; j < b.z + b.d; j++) if (!isSolid(i, j, b.y + b.h)) pushStud(i, j, b.y + b.h, b.c);
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) if (!isSolid(i, j, 0)) pushStud(i, j, 0, 'green');
  const sg = new THREE.CylinderGeometry(0.29, 0.29, 0.13, 14);
  const si = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), studs.length);
  studs.forEach(([x, y, z, c], i) => {
    m4.compose(new THREE.Vector3(x, y + 0.065, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    si.setMatrixAt(i, m4); si.setColorAt(i, col.set(COL[c]));
  });
  si.castShadow = false; si.receiveShadow = true; scene.add(si);
}

// ───────────────────────── Figuren ─────────────────────────
function makeFigure(o) {
  const g = new THREE.Group(); const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.22, 0.8, 0);
    box(piv, 0.38, 0.8, 0.42, o.pants, 0, -0.4, 0); box(piv, 0.4, 0.14, 0.5, o.shoes || 'black', 0, -0.73, 0.05);
    g.add(piv); legs.push(piv);
  }
  box(g, 0.95, 0.85, 0.55, o.shirt, 0, 1.225, 0);
  if (o.badge) box(g, 0.36, 0.3, 0.06, o.badge, 0, 1.3, 0.29);
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.6, 1.58, 0);
    box(piv, 0.26, 0.62, 0.3, o.shirt, 0, -0.31, 0); box(piv, 0.22, 0.16, 0.26, o.skin || 'skin', 0, -0.68, 0);
    g.add(piv); arms.push(piv);
  }
  const head = new THREE.Group(); head.position.y = 2.06; g.add(head);
  sph(head, 0.42, o.skin || 'skin', 0, 0, 0, 1, 1, 0.95);
  for (const sx of [-1, 1]) sph(head, 0.055, 'black', sx * 0.15, 0.06, 0.37);
  box(head, 0.2, 0.05, 0.05, 0x8a3a2a, 0, -0.16, 0.4);
  if (o.hairStyle === 'cap') { cyl(head, 0.44, 0.3, o.hair, 0, 0.3, 0); box(head, 0.5, 0.07, 0.34, o.hair, 0, 0.2, 0.45); }
  else if (o.hairStyle === 'short') sph(head, 0.45, o.hair, 0, 0.12, -0.04, 1, 0.7, 1);
  else if (o.hairStyle === 'long') { sph(head, 0.46, o.hair, 0, 0.1, -0.05, 1, 0.75, 1); for (const sx of [-1, 1]) box(head, 0.16, 0.55, 0.3, o.hair, sx * 0.4, -0.12, -0.08); }
  else if (o.hairStyle === 'helmet') { sph(head, 0.49, o.hair, 0, 0.1, 0, 1, 0.8, 1); box(head, 0.12, 0.3, 0.12, 'white', 0, -0.1, 0.44); }
  g.scale.setScalar(o.scale || 1);
  return { group: g, legs, arms, head, height: 2.5 * (o.scale || 1) };
}
function makePig(o) {
  const g = new THREE.Group(); const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.2, 0.62, 0);
    cyl(piv, 0.09, 0.6, 'black', 0, -0.3, 0); box(piv, 0.26, 0.12, 0.34, 'black', 0, -0.58, 0.05);
    g.add(piv); legs.push(piv);
  }
  cone(g, 0.34, 0.62, 1.0, o.dress, 0, 1.08, 0);
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.42, 1.45, 0); piv.rotation.z = sx * 0.5;
    cyl(piv, 0.09, 0.55, 'pig', 0, -0.27, 0); g.add(piv); arms.push(piv);
  }
  const head = new THREE.Group(); head.position.y = 2.05; g.add(head);
  sph(head, 0.5, 'pig', 0, 0, 0, 1, 0.88, 1.1);
  cyl(head, 0.22, 0.5, 'pig', 0.05, -0.02, 0.55, Math.PI / 2, 0);
  for (const sx of [-1, 1]) sph(head, 0.045, 0xd06090, 0.05 + sx * 0.09, 0, 0.8);
  for (const sx of [-1, 1]) { sph(head, 0.1, 'white', sx * 0.17, 0.14, 0.42); sph(head, 0.05, 'black', sx * 0.17, 0.14, 0.5); }
  sph(head, 0.11, 0xf2647a, 0.3, -0.15, 0.4, 1, 0.8, 0.6);
  for (const sx of [-1, 1]) sph(head, 0.11, 'pig', sx * 0.3, 0.42, -0.05, 0.6, 1.4, 0.5);
  if (o.glasses) for (const sx of [-1, 1]) torus(head, 0.13, 0.025, 'black', sx * 0.17, 0.14, 0.46);
  box(head, 0.16, 0.04, 0.04, 0xc03060, 0.05, -0.2, 0.5);
  g.scale.setScalar(o.scale || 1);
  return { group: g, legs, arms, head, height: 2.6 * (o.scale || 1) };
}
function makeSheep(o) {
  const g = new THREE.Group(); const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 0.2, 0.62, 0);
    cyl(piv, 0.09, 0.6, 'black', 0, -0.3, 0); box(piv, 0.26, 0.12, 0.34, 'black', 0, -0.58, 0.05);
    g.add(piv); legs.push(piv);
  }
  cone(g, 0.34, 0.62, 1.0, o.dress, 0, 1.08, 0);
  for (const sx of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(sx * 0.42, 1.45, 0); piv.rotation.z = sx * 0.5; cyl(piv, 0.09, 0.55, 'white', 0, -0.27, 0); g.add(piv); arms.push(piv); }
  const head = new THREE.Group(); head.position.y = 2.05; g.add(head);
  sph(head, 0.46, 'white', 0, 0, 0, 1, 0.95, 1.05);
  for (const [dx, dy, dz] of [[-0.3, 0.35, -0.1], [0.3, 0.35, -0.1], [0, 0.45, -0.2], [-0.15, 0.4, 0.25], [0.2, 0.42, 0.2]]) sph(head, 0.18, 'cream', dx, dy, dz);
  for (const sx of [-1, 1]) { sph(head, 0.09, 'white', sx * 0.16, 0.1, 0.4); sph(head, 0.045, 'black', sx * 0.16, 0.1, 0.47); }
  sph(head, 0.08, 'lpink', 0, -0.12, 0.46);
  for (const sx of [-1, 1]) sph(head, 0.1, 'white', sx * 0.45, 0.05, -0.05, 0.9, 0.5, 1.2);
  g.scale.setScalar(o.scale || 1);
  return { group: g, legs, arms, head, height: 2.6 };
}
function makeQuad(o) {
  const g = new THREE.Group(); const legs = [];
  const { L, W, BH, LH } = o;
  box(g, W, BH, L, o.body, 0, LH + BH / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * (W / 2 - 0.13), LH, sz * (L / 2 - 0.2));
    cyl(piv, o.legR || 0.12, LH, o.legColor || o.body, 0, -LH / 2, 0);
    if (o.hoof) cyl(piv, (o.legR || 0.12) + 0.02, 0.12, o.hoof, 0, -LH + 0.06, 0);
    g.add(piv); legs.push(piv);
  }
  const hy = LH + BH;
  if (o.neck) { const n = box(g, 0.36, o.neck, 0.4, o.body, 0, hy + o.neck * 0.32, L / 2 - 0.2); n.rotation.x = -0.55; if (o.mane) for (let k = 0; k < 4; k++) box(g, 0.14, 0.22, 0.2, o.mane, 0, hy + 0.15 + k * 0.18, L / 2 - 0.25 + k * 0.1); }
  const hz = L / 2 + 0.28 + (o.neck ? o.neck * 0.3 : 0), hyy = hy + (o.neck ? o.neck * 0.72 : 0.12);
  box(g, o.HW || 0.44, o.HH || 0.42, o.HL || 0.62, o.head || o.body, 0, hyy, hz);
  if (o.muzzle) box(g, (o.HW || 0.44) * 0.8, (o.HH || 0.42) * 0.55, 0.2, o.muzzle, 0, hyy - 0.08, hz + (o.HL || 0.62) / 2 + 0.05);
  for (const sx of [-1, 1]) sph(g, 0.05, 'black', sx * (o.HW || 0.44) * 0.5, hyy + 0.1, hz + (o.HL || 0.62) * 0.35);
  if (o.ears === 'up') for (const sx of [-1, 1]) box(g, 0.12, 0.28, 0.1, o.earColor || o.body, sx * 0.16, hyy + 0.3, hz - 0.1);
  if (o.ears === 'floppy') for (const sx of [-1, 1]) box(g, 0.1, 0.36, 0.2, o.earColor || o.body, sx * ((o.HW || 0.44) / 2 + 0.05), hyy - 0.05, hz - 0.1);
  if (o.ears === 'side') for (const sx of [-1, 1]) box(g, 0.25, 0.1, 0.16, o.earColor || o.body, sx * ((o.HW || 0.44) / 2 + 0.12), hyy + 0.12, hz - 0.1);
  if (o.horns) for (const sx of [-1, 1]) { const h = cyl(g, 0.05, 0.3, o.horns, sx * 0.18, hyy + 0.32, hz - 0.15); h.rotation.z = -sx * 0.5; }
  if (o.tail === 'up') { const t = box(g, 0.1, 0.5, 0.1, o.tailColor || o.body, 0, hy + 0.1, -L / 2 - 0.02); t.rotation.x = 0.5; }
  if (o.tail === 'down') { const t = box(g, 0.12, 0.7, 0.12, o.tailColor || o.body, 0, hy - 0.25, -L / 2 - 0.05); t.rotation.x = -0.25; }
  if (o.spots) for (const [sx, y, z, w, h] of o.spots) box(g, 0.06, h, w, 'black', sx * (W / 2), LH + y, z);
  if (o.udder) sph(g, 0.22, 'lpink', 0, LH + 0.02, -0.2, 1, 0.6, 1.2);
  g.scale.setScalar(o.scale || 1);
  return { group: g, legs, arms: [], head: null, height: (LH + BH + 0.7) * (o.scale || 1) };
}
function makeBee() {
  const g = new THREE.Group();
  sph(g, 0.3, 'yellow', 0, 0, 0, 0.9, 0.8, 1.3);
  torus(g, 0.26, 0.05, 'black', 0, 0, 0.02, 0, 0); torus(g, 0.22, 0.05, 'black', 0, 0, -0.2, 0, 0);
  sph(g, 0.2, 'black', 0, 0.02, 0.42);
  for (const sx of [-1, 1]) sph(g, 0.05, 'white', sx * 0.1, 0.1, 0.58);
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.55), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    w.position.set(sx * 0.18, 0.28, 0); w.rotation.x = -Math.PI / 2; w.rotation.z = sx * 0.3; g.add(w); wings.push(w);
  }
  return { group: g, wings };
}
function makeTruck() {
  const g = new THREE.Group();
  box(g, 1.6, 0.35, 4.2, 'dblue', 0, 0.55, 0);
  box(g, 1.7, 1.3, 1.5, 'green', 0, 1.35, 1.3); box(g, 1.5, 0.7, 0.1, 0xbfe8ff, 0, 1.55, 2.05);
  box(g, 1.8, 0.25, 2.4, 'lime', 0, 0.85, -0.9); box(g, 1.8, 0.5, 0.15, 'lime', 0, 1.2, -2.05);
  for (const dx of [-0.85, 0.85]) for (const dz of [-1.4, 1.4]) { const w = cyl(g, 0.42, 0.35, 'black', dx, 0.42, dz, 0, Math.PI / 2); cyl(g, 0.2, 0.37, 'grey', dx, 0.42, dz, 0, Math.PI / 2); }
  return { group: g };
}
function makeBike() {
  const g = new THREE.Group();
  box(g, 0.4, 0.5, 1.5, 'red', 0, 0.7, 0); box(g, 0.3, 0.2, 0.7, 'black', 0, 1.0, -0.2);
  cyl(g, 0.38, 0.2, 'black', 0, 0.38, 0.8, 0, Math.PI / 2); cyl(g, 0.38, 0.2, 'black', 0, 0.38, -0.7, 0, Math.PI / 2);
  cyl(g, 0.05, 0.9, 'grey', 0, 1.2, 0.6, 0, Math.PI / 2);
  return { group: g };
}

// ───────────────────────── Bewegliche Wesen ─────────────────────────
class Walker {
  constructor(model, x, z, y, opts = {}) {
    this.m = model; this.obj = model.group; this.x = x; this.z = z; this.y = y; this.visY = y; this.vy = 0;
    this.r = opts.r || 0.32; this.h = PH; this.grounded = true; this.face = opts.face || 0; this.anim = 0; this.moving = false;
    this.noDrop = !!opts.noDrop; this.zone = opts.zone || null; this.speed = opts.speed || 2; this.name = opts.name || '';
    this.say = opts.say || ''; this.cool = 0; this.t = Math.random() * 2; this.dir = Math.random() * Math.PI * 2; this.pause = 0;
    this.npc = !!opts.npc; this.hop = opts.hop || 0; this.bounce = 0; this.baseScale = this.obj.scale.y;
    scene.add(this.obj); this.sync(0);
  }
  tryMove(nx, nz) {
    if (this.zone && (nx < this.zone[0] || nx > this.zone[1] || nz < this.zone[2] || nz > this.zone[3])) return false;
    if (nx < -9 || nx > 33 || nz < -9 || nz > 33) return false;
    const base = Math.floor(this.y + 1e-4);
    const cs = corners(nx, nz, this.r);
    let f = 0;
    for (const [cx, cz] of cs) { const v = floorOf(cx, cz, base + STEP); if (v > f) f = v; }
    if (f > this.y + 1e-4 && this.vy > 0.5) return false;
    if (this.noDrop && f < base - STEP) return false;
    const lo = f, hi = Math.max(f + this.h, Math.ceil(this.y + this.h - 1e-4));
    for (const [cx, cz] of cs) for (let l = lo; l < hi; l++) if (isSolid(cx, cz, l)) return false;
    this.x = nx; this.z = nz;
    if (f > this.y) { this.y = f; this.vy = 0; }
    return true;
  }
  physics(dt) {
    this.vy -= GRAV * dt; if (this.vy < -40) this.vy = -40;
    let ny = this.y + this.vy * dt;
    const base = Math.floor(this.y + 1e-4);
    const cs = corners(this.x, this.z, this.r);
    let f = 0;
    for (const [cx, cz] of cs) { const v = floorOf(cx, cz, base); if (v > f) f = v; }
    if (ny <= f) { if (!this.grounded && this.vy < -8) this.bounce = 0.15; ny = f; this.vy = 0; this.grounded = true; }
    else {
      this.grounded = false;
      if (this.vy > 0) { const hl = Math.floor(ny + this.h); for (const [cx, cz] of cs) if (isSolid(cx, cz, hl)) { ny = this.y; this.vy = 0; break; } }
    }
    this.y = ny;
  }
  jump() { if (this.grounded) { this.vy = JUMP; this.grounded = false; } }
  move(vx, vz, dt) {
    let moved = false;
    if (vx) moved = this.tryMove(this.x + vx * dt, this.z) || moved;
    if (vz) moved = this.tryMove(this.x, this.z + vz * dt) || moved;
    if (vx || vz) this.face = Math.atan2(vx, vz);
    this.moving = !!(vx || vz);
    return moved;
  }
  npcUpdate(dt) {
    this.cool -= dt;
    if (this.pause > 0) { this.pause -= dt; this.moving = false; this.physics(dt); return; }
    this.t -= dt;
    if (this.t <= 0) {
      if (Math.random() < 0.35) { this.moving = false; this.t = 0.8 + Math.random() * 2; }
      else { this.moving = true; this.dir = Math.random() * Math.PI * 2; this.t = 1.2 + Math.random() * 2.5; }
    }
    if (this.moving) {
      const vx = Math.sin(this.dir) * this.speed, vz = Math.cos(this.dir) * this.speed;
      const a = this.tryMove(this.x + vx * dt, this.z), b = this.tryMove(this.x, this.z + vz * dt);
      if (!a && !b) { this.dir += Math.PI / 2 + Math.random() * Math.PI; this.t = 1 + Math.random() * 2; }
      else this.face = this.dir;
      if (this.hop && this.grounded && Math.random() < this.hop * dt) { this.vy = 9; this.grounded = false; }
    }
    this.physics(dt);
  }
  sync(dt) {
    this.visY += (this.y - this.visY) * (1 - Math.exp(-14 * dt)); if (Math.abs(this.y - this.visY) > 3) this.visY = this.y;
    if (this.bounce > 0) this.bounce = Math.max(0, this.bounce - dt);
    this.obj.position.set(this.x, this.visY * LV, this.z);
    let d = this.face - this.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.obj.rotation.y += d * (1 - Math.exp(-12 * dt));
    if (this.moving) this.anim += dt * (this.speed > 3 ? 12 : 9); else this.anim += (Math.round(this.anim / Math.PI) * Math.PI - this.anim) * 0.2;
    const s = Math.sin(this.anim), amp = this.moving ? 0.55 : 0;
    const legs = this.m.legs, arms = this.m.arms;
    if (legs.length === 2) { legs[0].rotation.x = s * amp; legs[1].rotation.x = -s * amp; }
    else if (legs.length === 4) { legs[0].rotation.x = s * amp; legs[3].rotation.x = s * amp; legs[1].rotation.x = -s * amp; legs[2].rotation.x = -s * amp; }
    if (arms && arms.length === 2) { arms[0].rotation.x = -s * amp * 0.8; arms[1].rotation.x = s * amp * 0.8; }
    const sq = this.bounce > 0 ? 1 - this.bounce * 1.5 : 1;
    this.obj.scale.y = this.baseScale * sq;
    if (!this.grounded && legs.length === 2) { legs[0].rotation.x = -0.4; legs[1].rotation.x = 0.4; }
  }
}

// ───────────────────────── Spielzustand ─────────────────────────
const state = { running: false, avatar: 'ben', found: 0 };
const npcs = [], bees = [], vehicles = [], items = [];
let player = null;

const AVATARS = {
  ben: { name: 'Ben', shirt: 'teal', pants: 'blue', hair: 'red', hairStyle: 'cap', badge: 'white', say: 'Hi! Komm mit!' },
  mia: { name: 'Mia', shirt: 'pink', pants: 'purple', hair: 'dbrown', hairStyle: 'long', say: 'Hallo! Schau mal, die Pferde!' },
  leo: { name: 'Leo', shirt: 'blue', pants: 'green', hair: 'brown', hairStyle: 'short', say: 'Wollen wir auf den Turm?' }
};

function spawnNpcs() {
  const deck = [0.4, 19.6, 2.4, 11.6], garden = [4.4, 23.6, 12.4, 23.6], rooms = [0.4, 19.6, 0.4, 11.6], plate = [0.4, 23.6, 0.4, 23.6], top = [6.4, 11.6, 4.4, 7.6];
  const add = (model, x, z, y, o) => { const w = new Walker(model, x, z, y, { ...o, npc: true }); npcs.push(w); return w; };
  add(makePig({ dress: 'red' }), 3, 8, 10, { name: 'Peppa', say: 'Oink! Hallo!', speed: 1.8, noDrop: true, zone: deck, hop: 0.25 });
  add(makeSheep({ dress: 'pink' }), 14, 6, 10, { name: 'Suzy Schaf', say: 'Määäh! Wo ist mein Pferd?', speed: 1.7, noDrop: true, zone: deck });
  add(makeQuad({ L: 1.8, W: 0.7, BH: 0.75, LH: 0.95, body: 'brown', neck: 0.9, mane: 'black', ears: 'up', tail: 'down', tailColor: 'black', hoof: 'black', HW: 0.42, HH: 0.45, HL: 0.8, muzzle: 0x6e421c }), 8, 10, 10, { name: 'Pferd', say: 'Wiehiiiiher!', speed: 2.4, noDrop: true, zone: deck, r: 0.4 });
  add(makeQuad({ L: 1.8, W: 0.7, BH: 0.75, LH: 0.95, body: 'grey', neck: 0.9, mane: 'white', ears: 'up', tail: 'down', tailColor: 'white', hoof: 'black', HW: 0.42, HH: 0.45, HL: 0.8, muzzle: 0x7d7f85, scale: 0.66 }), 16, 6, 10, { name: 'Pony', say: 'Hü! Hü!', speed: 2.0, noDrop: true, zone: deck, r: 0.3 });
  add(makeQuad({ L: 1.9, W: 0.9, BH: 0.85, LH: 0.75, body: 'white', neck: 0.35, ears: 'side', earColor: 'black', horns: 'sand', tail: 'down', HW: 0.5, HH: 0.5, HL: 0.7, muzzle: 'lpink', udder: true, spots: [[-1, 0.5, 0.3, 0.6, 0.45], [1, 0.3, -0.4, 0.5, 0.4], [1, 0.55, 0.5, 0.35, 0.3], [-1, 0.2, -0.55, 0.4, 0.35]] }), 11, 17, 0, { name: 'Kuh', say: 'Muuuuh!', speed: 1.4, noDrop: true, zone: garden, r: 0.45 });
  add(makeQuad({ L: 0.95, W: 0.42, BH: 0.42, LH: 0.4, body: 'black', ears: 'floppy', earColor: 'dbrown', tail: 'up', HW: 0.4, HH: 0.38, HL: 0.5, muzzle: 'dbrown', legR: 0.08 }), 9, 6, 18, { name: 'Schwarzer Hund', say: 'Wuff! Wuff!', speed: 3.0, noDrop: true, zone: top, r: 0.25, hop: 0.6 });
  add(makeQuad({ L: 0.95, W: 0.42, BH: 0.42, LH: 0.4, body: 'white', ears: 'floppy', earColor: 'black', tail: 'up', HW: 0.4, HH: 0.38, HL: 0.5, muzzle: 'black', legR: 0.08, spots: [[1, 0.2, 0.1, 0.3, 0.25], [-1, 0.25, -0.2, 0.25, 0.2]] }), 9, 7, 0, { name: 'Weißer Hund', say: 'Wau wau!', speed: 3.2, noDrop: true, zone: rooms, r: 0.25, hop: 0.5 });
  add(makeQuad({ L: 0.95, W: 0.42, BH: 0.42, LH: 0.4, body: 'beige', ears: 'floppy', earColor: 'brown', tail: 'up', HW: 0.4, HH: 0.38, HL: 0.5, muzzle: 'brown', legR: 0.08 }), 20, 18, 0, { name: 'Brauner Hund', say: 'Hecheln … wuff!', speed: 2.8, noDrop: true, zone: garden, r: 0.25, hop: 0.4 });
  add(makeFigure({ shirt: 'orange', pants: 'dblue', hair: 'red', hairStyle: 'helmet' }), 12, 6, 10, { name: 'Kind mit Helm', say: 'Ich bin hier oben!', speed: 2.2, noDrop: true, zone: plate });
  for (const k of Object.keys(AVATARS)) if (k !== state.avatar) {
    const a = AVATARS[k];
    add(makeFigure(a), k === 'ben' ? 6 : k === 'mia' ? 18 : 15, k === 'ben' ? 20 : k === 'mia' ? 15 : 9, k === 'leo' ? 10 : 0, { name: a.name, say: a.say, speed: 2.4, noDrop: true, zone: plate });
  }
  // Papa Wutz sitzt im Eimer auf dem Turm und winkt
  {
    const p = makePig({ dress: 'teal', glasses: true, scale: 1.15 });
    p.group.position.set(3.5, 18.2 * LV, 4.5); p.group.rotation.y = -Math.PI / 2; scene.add(p.group);
    npcs.push({ static: true, m: p, obj: p.group, x: 3.5, z: 4.5, y: 18, name: 'Papa Wutz', say: 'Ho ho! Von hier oben sehe ich alles!', cool: 0, height: 3, update(dt) { this.cool -= dt; this.tt = (this.tt || 0) + dt; p.arms[1].rotation.z = 0.5 + Math.sin(this.tt * 4) * 0.4 - 1.6; p.head.rotation.y = Math.sin(this.tt * 0.7) * 0.5; } });
  }
  // Bienen
  for (let k = 0; k < 3; k++) { const b = makeBee(); scene.add(b.group); bees.push({ ...b, cx: 21 + k * 0.4, cz: 19 - k * 1.2, R: 2.2 + k * 0.7, ph: k * 2.1, h: 1.6 + k * 0.5, sp: 0.9 + k * 0.2, cool: 0, name: 'Biene', say: 'Summ summ!' }); }
  // Fahrzeuge um die Platte herum
  {
    const t = makeTruck(); scene.add(t.group);
    vehicles.push({ obj: t.group, path: [[-3.5, -3.5], [27.5, -3.5], [27.5, 27.5], [-3.5, 27.5]], i: 0, s: 0, speed: 3.2, name: 'Laster', say: 'Brumm brumm!', cool: 0 });
    const b = makeBike(); scene.add(b.group);
    vehicles.push({ obj: b.group, path: [[-6, 30], [-6, -6], [30, -6], [30, 30]], i: 0, s: 0.3, speed: 4.5, name: 'Motorrad', say: 'Wrooom!', cool: 0 });
  }
}

// ───────────────────────── Sammelsachen ─────────────────────────
const ITEMS = [
  { id: 'ballon', name: 'Ballon', emoji: '🎈', x: 7, z: 5.2, y: 19, build(g) { sph(g, 0.5, 'orange', 0, 0.9, 0, 1, 1.2, 1); sph(g, 0.1, 'orange', 0, 0.28, 0); cyl(g, 0.02, 0.8, 'grey', 0, -0.1, 0); } },
  { id: 'klo', name: 'Klo', emoji: '🚽', x: 8.5, z: 6.5, y: 18, build(g) { box(g, 0.7, 0.55, 0.8, 'white', 0, 0.28, 0.05); box(g, 0.72, 0.12, 0.72, 'blue', 0, 0.6, 0.02); box(g, 0.7, 0.6, 0.25, 'white', 0, 0.85, -0.35); box(g, 0.2, 0.08, 0.1, 'grey', 0.2, 1.15, -0.35); } },
  { id: 'giesskanne', name: 'Gießkanne', emoji: '🪣', x: 14.5, z: 5.5, y: 10, build(g) { cyl(g, 0.32, 0.6, 'teal', 0, 0.3, 0); const s = cyl(g, 0.06, 0.7, 'teal', 0.4, 0.5, 0); s.rotation.z = -0.9; cone(g, 0.14, 0.06, 0.16, 'teal', 0.68, 0.72, 0); torus(g, 0.22, 0.04, 'teal', -0.2, 0.62, 0, 0, Math.PI / 2); } },
  { id: 'schaufel', name: 'Schaufel', emoji: '⛏️', x: 3.5, z: 9, y: 10, build(g) { cyl(g, 0.05, 1.2, 'teal', 0, 0.6, 0); box(g, 0.36, 0.5, 0.06, 'teal', 0, 0.25, 0); box(g, 0.3, 0.08, 0.08, 'teal', 0, 1.2, 0); } },
  { id: 'zahnbuerste', name: 'Zahnbürste', emoji: '🪥', x: 8.5, z: 8.5, y: 0, build(g) { const b = box(g, 0.14, 0.95, 0.14, 'blue', 0, 0.5, 0); box(g, 0.16, 0.28, 0.22, 'white', 0, 0.85, 0.06); } },
  { id: 'honig', name: 'Honigtopf', emoji: '🍯', x: 15.5, z: 5.5, y: 0, build(g) { cyl(g, 0.3, 0.5, 'yellow', 0, 0.25, 0); cyl(g, 0.33, 0.1, 'dbrown', 0, 0.55, 0); box(g, 0.32, 0.22, 0.02, 'white', 0, 0.25, 0.3); } },
  { id: 'buerste', name: 'Bürste', emoji: '🧹', x: 17, z: 3, y: 14, build(g) { cyl(g, 0.07, 0.8, 'blue', 0, 0.75, 0); box(g, 0.3, 0.42, 0.16, 'blue', 0, 0.22, 0); box(g, 0.28, 0.4, 0.1, 'white', 0, 0.22, 0.12); } },
  { id: 'himbeeren', name: 'Himbeeren', emoji: '🍓', x: 16.5, z: 22.5, y: 0, build(g) { for (let k = 0; k < 8; k++) { const a = k * 1.3; sph(g, 0.2, 'red', Math.cos(a) * 0.25 * (k % 3), 0.25 + (k % 3) * 0.22, Math.sin(a) * 0.25 * (k % 3)); } sph(g, 0.25, 'green', 0.2, 0.1, 0.2, 1, 0.3, 1.4); } }
];
function spawnItems() {
  for (const it of ITEMS) {
    const g = new THREE.Group(); it.build(g); g.position.set(it.x, it.y * LV, it.z); scene.add(g);
    items.push({ ...it, obj: g, got: false, ph: Math.random() * 6 });
  }
  renderItems();
}
function renderItems() {
  const el = document.getElementById('items'); el.innerHTML = '';
  for (const it of items) { const d = document.createElement('div'); d.className = 'item' + (it.got ? ' found' : ''); d.textContent = (it.got ? '✓ ' : '') + it.emoji + ' ' + it.name; el.appendChild(d); }
}

// ───────────────────────── Ton ─────────────────────────
let audio = null;
function beep(seq) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    let t = audio.currentTime;
    for (const [f, d] of seq) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + d); t += d;
    }
  } catch (e) { /* kein Ton verfügbar */ }
}

// ───────────────────────── Eingabe ─────────────────────────
const input = { jx: 0, jy: 0, jump: false, keys: {} };
const joyEl = document.getElementById('joy'), knobEl = document.getElementById('knob');
let joyId = null, joyBase = [0, 0];
const camPts = new Map();
let yaw = 0.15, pitch = 0.62, camDist = 15, yawSnap = null, curDist = 15;

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType !== 'mouse' && joyId === null && e.clientX < window.innerWidth * 0.5) {
    joyId = e.pointerId; joyBase = [e.clientX, e.clientY];
    joyEl.style.display = 'block'; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
    knobEl.style.transform = 'translate(-50%,-50%)'; input.jx = 0; input.jy = 0;
  } else camPts.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY });
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyBase[0], dy = e.clientY - joyBase[1];
    const len = Math.hypot(dx, dy), R = 50;
    if (len > R) { dx *= R / len; dy *= R / len; }
    knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.jx = dx / R; input.jy = -dy / R;
  } else if (camPts.has(e.pointerId)) {
    const p = camPts.get(e.pointerId); p.lx = p.x; p.ly = p.y; p.x = e.clientX; p.y = e.clientY;
    if (camPts.size === 1) { yaw -= (p.x - p.lx) * 0.0065; pitch = Math.max(0.15, Math.min(1.25, pitch + (p.y - p.ly) * 0.004)); yawSnap = null; }
    else if (camPts.size === 2) {
      const [a, b] = [...camPts.values()];
      const d0 = Math.hypot(a.lx - b.lx, a.ly - b.ly), d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 > 0) camDist = Math.max(6, Math.min(26, camDist * d0 / d1));
    }
  }
});
const endPtr = e => {
  if (e.pointerId === joyId) { joyId = null; joyEl.style.display = 'none'; input.jx = 0; input.jy = 0; }
  camPts.delete(e.pointerId);
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { camDist = Math.max(6, Math.min(26, camDist + e.deltaY * 0.01)); });
document.getElementById('jump').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (player) player.jump(); });
document.getElementById('turn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); yawSnap = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 2; showToast(['Vorderseite', 'Rechte Seite', 'Rückseite', 'Linke Seite'][((Math.round(yawSnap / (Math.PI / 2)) % 4) + 4) % 4]); });
window.addEventListener('keydown', e => { input.keys[e.code] = true; if (e.code === 'Space' && player) { player.jump(); e.preventDefault(); } });
window.addEventListener('keyup', e => { input.keys[e.code] = false; });

// ───────────────────────── HUD ─────────────────────────
const bubble = document.getElementById('bubble'), bname = document.getElementById('bname'), btext = document.getElementById('btext');
let bubbleFor = null, bubbleT = 0;
function speak(who, y) { bubbleFor = who; bubbleT = 2.4; bname.textContent = who.name; btext.textContent = who.say; bubble.style.display = 'block'; }
let toastT = 0;
function showToast(t) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); toastT = 2.2; }

// ───────────────────────── Schleife ─────────────────────────
const clock = new THREE.Clock();
const V = new THREE.Vector3(), tmp = new THREE.Vector3(), ray = new THREE.Raycaster();
const camTarget = new THREE.Vector3(12, 2, 20);

function updatePlayer(dt) {
  let ix = input.jx, iy = input.jy;
  if (input.keys.ArrowUp || input.keys.KeyW) iy += 1; if (input.keys.ArrowDown || input.keys.KeyS) iy -= 1;
  if (input.keys.ArrowLeft || input.keys.KeyA) ix -= 1; if (input.keys.ArrowRight || input.keys.KeyD) ix += 1;
  if (input.keys.KeyQ) yaw += 2 * dt; if (input.keys.KeyE) yaw -= 2 * dt;
  const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const vx = (fx * iy + rx * ix) * SPEED, vz = (fz * iy + rz * ix) * SPEED;
  player.move(vx, vz, dt);
  player.physics(dt);
}
function updateBees(dt, t) {
  for (const b of bees) {
    b.cool -= dt;
    const a = t * b.sp + b.ph;
    const x = b.cx + Math.cos(a) * b.R, z = b.cz + Math.sin(a) * b.R, y = b.h + Math.sin(a * 2.3) * 0.35;
    b.group.position.set(x, y, z); b.group.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
    b.wings[0].rotation.z = 0.3 + Math.sin(t * 60) * 0.6; b.wings[1].rotation.z = -0.3 - Math.sin(t * 60) * 0.6;
    b.x = x; b.z = z; b.y = y / LV;
  }
}
function updateVehicles(dt) {
  for (const v of vehicles) {
    v.cool -= dt;
    const a = v.path[v.i], b = v.path[(v.i + 1) % v.path.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    v.s += v.speed * dt / L;
    if (v.s >= 1) { v.s = 0; v.i = (v.i + 1) % v.path.length; continue; }
    const x = a[0] + (b[0] - a[0]) * v.s, z = a[1] + (b[1] - a[1]) * v.s;
    v.obj.position.set(x, 0, z); v.obj.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    v.x = x; v.z = z; v.y = 0;
  }
}
function updateItems(dt, t) {
  for (const it of items) {
    if (it.got) continue;
    it.obj.position.y = it.y * LV + 0.15 + Math.sin(t * 2 + it.ph) * 0.12; it.obj.rotation.y = t * 1.2 + it.ph;
    const d = Math.hypot(player.x - it.x, player.z - it.z);
    if (d < 1.05 && Math.abs(player.y - it.y) <= 3.5) {
      it.got = true; scene.remove(it.obj); state.found++; renderItems();
      beep([[660, 0.08], [880, 0.08], [1320, 0.14]]);
      showToast(`${it.emoji} ${it.name} gefunden! (${state.found}/${items.length})`);
      if (state.found === items.length) setTimeout(() => { document.getElementById('end').style.display = 'flex'; beep([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]]); }, 900);
    }
  }
}
function updateNpcs(dt) {
  for (const n of npcs) {
    if (n.static) { n.update(dt); }
    else n.npcUpdate(dt);
    const d = Math.hypot(player.x - n.x, player.z - n.z);
    if (d < 1.6 && Math.abs(player.y - n.y) < 3 && n.cool <= 0) {
      n.cool = 7; speak(n); beep([[440 + Math.random() * 300, 0.07], [520 + Math.random() * 300, 0.09]]);
      if (!n.static) { n.pause = 1.6; n.face = Math.atan2(player.x - n.x, player.z - n.z); }
    }
    if (!n.static) n.sync(dt);
  }
  for (const b of bees) { const d = Math.hypot(player.x - b.x, player.z - b.z); if (d < 1.5 && Math.abs(player.y - b.y) < 4 && b.cool <= 0) { b.cool = 8; speak(b); beep([[900, 0.05], [1000, 0.05], [900, 0.05]]); } }
  for (const v of vehicles) { const d = Math.hypot(player.x - v.x, player.z - v.z); if (d < 2.6 && player.y < 3 && v.cool <= 0) { v.cool = 8; speak(v); beep([[150, 0.12], [120, 0.16]]); } }
}
let effPitch = 0.62;
function freeDist(p) {
  V.set(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p));
  ray.set(camTarget, V); ray.far = camDist;
  const hits = ray.intersectObjects(solids, false);
  return hits.length ? hits[0].distance : camDist;
}
function updateCamera(dt) {
  if (yawSnap !== null) { let d = yawSnap - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * (1 - Math.exp(-6 * dt)); if (Math.abs(d) < 0.01) { yaw = yawSnap; yawSnap = null; } }
  const px = player ? player.x : 12, py = player ? player.visY * LV + 1.6 : 2, pz = player ? player.z : 20;
  camTarget.lerp(tmp.set(px, py, pz), 1 - Math.exp(-9 * dt));
  // In Räumen (niedrige Decke) die Kamera flacher legen statt sie in den Nacken zu ziehen
  let bestP = pitch, bestD = freeDist(pitch);
  if (bestD < 5) for (const p of [pitch * 0.6, 0.28, 0.12]) { const d = freeDist(p); if (d > bestD + 0.5) { bestD = d; bestP = p; } if (bestD >= 5) break; }
  effPitch += (bestP - effPitch) * (1 - Math.exp(-5 * dt));
  V.set(Math.sin(yaw) * Math.cos(effPitch), Math.sin(effPitch), Math.cos(yaw) * Math.cos(effPitch));
  let want = camDist;
  ray.set(camTarget, V); ray.far = camDist;
  const hits = ray.intersectObjects(solids, false);
  if (hits.length && hits[0].distance < want) want = Math.max(2.2, hits[0].distance - 0.5);
  curDist += (want - curDist) * (1 - Math.exp(-(want < curDist ? 20 : 4) * dt));
  camera.position.copy(camTarget).addScaledVector(V, curDist);
  camera.lookAt(camTarget);
}
function updateHud(dt) {
  if (bubbleT > 0) {
    bubbleT -= dt;
    const w = bubbleFor; const h = w.m ? (w.m.height || 2.5) : (w.group ? 0.9 : 2.2);
    tmp.set(w.x, (w.obj ? w.obj.position.y : w.group.position.y) + h + 0.2, w.z).project(camera);
    if (tmp.z > 1 || bubbleT <= 0) bubble.style.display = 'none';
    else { bubble.style.display = 'block'; bubble.style.left = ((tmp.x + 1) / 2 * window.innerWidth) + 'px'; bubble.style.top = ((1 - tmp.y) / 2 * window.innerHeight) + 'px'; }
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) document.getElementById('toast').classList.remove('show'); }
  if (flagMesh) flagMesh.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.3;
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));

let hintT = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (state.running) {
    updatePlayer(dt); player.sync(dt);
    updateNpcs(dt); updateBees(dt, t); updateVehicles(dt); updateItems(dt, t);
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) document.getElementById('hint').classList.remove('show'); }
  } else { updateBees(dt, t); updateVehicles(dt); for (const n of npcs) { if (n.static) n.update(dt); else { n.npcUpdate(dt); n.sync(dt); } } }
  updateCamera(dt); updateHud(dt);
  renderer.render(scene, camera);
}

// ───────────────────────── Start ─────────────────────────
function startGame(av) {
  state.avatar = av;
  if (player && player.obj) scene.remove(player.obj);
  for (const n of npcs) scene.remove(n.obj); npcs.length = 0;
  for (const b of bees) scene.remove(b.group); bees.length = 0;
  for (const v of vehicles) scene.remove(v.obj); vehicles.length = 0;
  for (const it of items) scene.remove(it.obj); items.length = 0; state.found = 0;
  const a = AVATARS[av];
  player = new Walker(makeFigure(a), 12, 21, 0, { face: Math.PI, speed: SPEED, name: a.name });
  spawnNpcs(); spawnItems();
  document.getElementById('start').style.display = 'none';
  document.getElementById('end').style.display = 'none';
  document.getElementById('hint').classList.add('show'); hintT = 6;
  state.running = true; yaw = 0.15; pitch = 0.62; camDist = 15;
  beep([[523, 0.08], [659, 0.08], [784, 0.12]]);
}
document.querySelectorAll('.av').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.av').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); state.avatar = b.dataset.av; }));
document.getElementById('go').addEventListener('click', () => startGame(state.avatar));
document.getElementById('again').addEventListener('click', () => startGame(state.avatar));

buildHouse();
resize();
// Vor dem Start laufen die Tiere schon herum – Vorschau hinter dem Startbild
state.avatar = 'ben';
player = null;
{
  // Vorschau-NPCs (werden beim Start neu gesetzt)
  const tmpPlayer = { x: 12, z: 21, y: 0, visY: 0 }; player = null;
  spawnNpcs(); spawnItems();
  player = tmpPlayer;
}
document.getElementById('loading').style.display = 'none';
tick();

// Für Tests von außen
window.TH = { renderer, start: startGame, setYaw: v => { yaw = v; yawSnap = null; }, setPitch: v => { pitch = v; }, setDist: v => { camDist = v; }, get player() { return player; }, teleport(x, z, y) { player.x = x; player.z = z; player.y = y; player.visY = y; }, walk(dx, dz, sec, jumpAt = -1) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { if (jumpAt >= 0 && i === Math.round(jumpAt * 60)) player.jump(); player.move(dx * SPEED, dz * SPEED, 1 / 60); player.physics(1 / 60); } }, state, npcs, items, camTarget, render: () => { updateCamera(0.5); updateCamera(0.5); renderer.render(scene, camera); } };
