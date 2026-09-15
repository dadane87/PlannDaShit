// 3D-Figuren für Fidibus, gebaut aus Grundkörpern (three.js). Alle Figuren blicken nach -X (links).
import * as THREE from './three.module.min.js';

const mats = {};
export function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.55, metalness: 0, transparent: !!opts.alpha, opacity: opts.alpha ?? 1, side: opts.side || THREE.FrontSide, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei ?? 1, flatShading: !!opts.flat });
  return mats[key];
}
const G_SPH = new THREE.SphereGeometry(1, 28, 20);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 16);

function sph(p, r, c, x, y, z, sx = 1, sy = 1, sz = 1, opts) { const m = new THREE.Mesh(G_SPH, M(c, opts)); m.scale.set(r * sx, r * sy, r * sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; }
function cyl(p, r, h, c, x, y, z, rx = 0, rz = 0, opts) { const m = new THREE.Mesh(G_CYL, M(c, opts)); m.scale.set(r, h, r); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; p.add(m); return m; }
// Flache Flosse aus einer 2D-Form (Punkte in lokaler XY-Ebene), leicht dick
function fin(p, pts, c, x, y, z, rot = [0, 0, 0], depth = 0.06, opts = {}) {
  const s = new THREE.Shape(); pts.forEach(([px, py], i) => i ? s.lineTo(px, py) : s.moveTo(px, py)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 12 });
  const m = new THREE.Mesh(g, M(c, { side: THREE.DoubleSide, ...opts })); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; p.add(m); return m;
}
function curveFin(p, ctrl, c, x, y, z, rot = [0, 0, 0], depth = 0.06, opts = {}) {
  // ctrl: [[x,y],[cx,cy,x,y],...] – erster Punkt moveTo, danach quadraticCurveTo
  const s = new THREE.Shape(); s.moveTo(ctrl[0][0], ctrl[0][1]); for (let i = 1; i < ctrl.length; i++) { const q = ctrl[i]; q.length === 4 ? s.quadraticCurveTo(q[0], q[1], q[2], q[3]) : s.lineTo(q[0], q[1]); } s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 14 });
  const m = new THREE.Mesh(g, M(c, { side: THREE.DoubleSide, ...opts })); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; p.add(m); return m;
}
// Auge: Augapfel + Iris + Pupille + Glanz + Lid (Kugel, die zum Blinzeln von oben zuklappt)
function eye(p, r, x, y, z, opts = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  sph(g, r, opts.white || 0xfbf6ea, 0, 0, 0, 1, 1, 0.9, { rough: 0.35 });
  const iris = sph(g, r * 0.62, opts.iris || 0x4a2f1a, 0, -r * 0.05, r * 0.7, 1, 1, 0.5, { rough: 0.4 });
  sph(g, r * 0.4, 0x120a05, 0, -r * 0.05, r * 0.86, 1, 1, 0.5, { rough: 0.3 });
  sph(g, r * 0.13, 0xffffff, r * 0.2, r * 0.16, r * 1.0, 1, 1, 0.5, { rough: 0.1, emissive: 0xffffff, ei: 0.6 });
  // Lid: Halbkugel in Hautfarbe, Drehung um X schließt das Auge
  const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(opts.skin || 0xf28c28, { rough: 0.6 }));
  lid.rotation.x = -(opts.lid ?? 0.35) * Math.PI / 2; g.add(lid); g.userData.lid = lid; g.userData.lidRest = lid.rotation.x;
  if (opts.lashes) for (let i = 0; i < 3; i++) { const l = cyl(g, r * 0.06, r * 0.5, 0x2a1a10, Math.sin(-0.5 + i * 0.5) * r * 1.05, Math.cos(-0.5 + i * 0.5) * r * 1.05 + r * 0.1, r * 0.3, 0, -(-0.5 + i * 0.5)); l.castShadow = false; }
  return g;
}
export function setLids(root, closed) { root.traverse(o => { if (o.userData && o.userData.lid) o.userData.lid.rotation.x = closed ? Math.PI / 2 * 0.02 : o.userData.lidRest; }); }
export function blinkLids(root, k) { root.traverse(o => { if (o.userData && o.userData.lid) o.userData.lid.rotation.x = o.userData.lidRest * (1 - k) + 0.02 * k; }); }

// ───────────── Fisch (Fidibus / Mama / Papa) ─────────────
export function makeFish(kind = 'fid') {
  const pal = kind === 'mama' ? { body: 0xfb9a2e, belly: 0xffd07a, fin: 0xb9cc4a } : kind === 'papa' ? { body: 0xe57a1a, belly: 0xf7b866, fin: 0xa3b83e } : { body: 0xf28c28, belly: 0xffcb72, fin: 0xb8cc4a };
  const g = new THREE.Group(); const parts = {};
  const body = sph(g, 0.6, pal.body, 0, 0, 0, 1.15, 1, 0.8, { rough: 0.5 }); parts.body = body;
  sph(g, 0.5, pal.belly, 0.05, -0.18, 0, 1.05, 0.7, 0.8, { rough: 0.55 });
  // Schwanz (Drehpunkt hinten am Körper)
  const tail = new THREE.Group(); tail.position.set(0.62, 0, 0); g.add(tail); parts.tail = tail;
  curveFin(tail, [[0, 0], [0.35, 0.45, 0.62, 0.5], [0.45, 0.1, 0.5, 0], [0.45, -0.1, 0.62, -0.5], [0.35, -0.45, 0, 0]], pal.fin, 0, 0, -0.03, [0, 0, 0], 0.06, { alpha: 0.95 });
  // Rückenflosse
  curveFin(g, [[-0.25, 0], [0, 0.55, 0.3, 0.05]], pal.fin, 0, 0.5, -0.03, [0, 0, 0], 0.06, { alpha: 0.95 });
  // Brustflossen (beide Seiten), Drehpunkt an der Wurzel
  for (const sz of [-1, 1]) { const pf = new THREE.Group(); pf.position.set(-0.05, -0.15, sz * 0.42); pf.rotation.y = sz * 0.6; g.add(pf); curveFin(pf, [[0, 0], [0.25, -0.35, 0.05, -0.5], [-0.15, -0.3, 0, 0]], pal.fin, 0, 0, 0, [0, 0, 0], 0.04, { alpha: 0.95 }); (parts.pfins = parts.pfins || []).push(pf); }
  // Bauchflosse
  curveFin(g, [[0.15, 0], [0.4, -0.35, 0.5, -0.05]], pal.fin, 0, -0.45, -0.02, [0, 0, 0], 0.05, { alpha: 0.95 });
  // Gesicht (blickt nach -X): Auge seitlich, Mund vorn
  const eyeR = kind === 'fid' ? 0.22 : 0.23;
  for (const sz of [-1, 1]) { const e = eye(g, eyeR, -0.3, 0.17, sz * 0.46, { skin: pal.body, lashes: kind === 'mama', lid: kind === 'papa' ? 0.3 : 0.14 }); e.rotation.y = sz * -0.9 + (sz > 0 ? 0 : Math.PI * 0) ; e.lookAt(new THREE.Vector3(-2, 0.12, sz * 1.6)); }
  const mouth = new THREE.Group(); mouth.position.set(-0.66, -0.12, 0); g.add(mouth); parts.mouth = mouth;
  const lip = sph(mouth, 0.13, 0x7a2438, 0, 0, 0, 0.5, 0.55, 1, { rough: 0.6 }); parts.lip = lip;
  sph(mouth, 0.07, 0xe8788f, 0.02, -0.03, 0, 0.5, 0.4, 0.8);
  // Wangen
  for (const sz of [-1, 1]) sph(g, 0.1, 0xff8a7a, -0.5, -0.05, sz * 0.4, 1, 0.7, 0.5, { alpha: 0.35 });
  // Braue (Papa kräftiger)
  for (const sz of [-1, 1]) { const b = cyl(g, kind === 'papa' ? 0.035 : 0.022, 0.32, 0x7a3a10, -0.32, 0.36, sz * 0.42, 0, 1.3); b.rotation.y = sz * 0.5; (parts.brows = parts.brows || []).push(b); }
  const s = kind === 'fid' ? 1 : kind === 'mama' ? 1.45 : 1.55; g.scale.setScalar(s);
  g.userData.parts = parts; g.userData.len = 1.9 * s;
  return g;
}
// Stimmung/Animation für Fische: t Zeit, o {moving, speed, mood, talking, blink}
export function animFish(g, t, o) {
  const p = g.userData.parts; const sp = o.speed || 0;
  const wag = Math.sin(t * (6 + sp * 1.5)) * (o.moving ? 0.5 : 0.18);
  p.tail.rotation.y = wag; p.body.rotation.y = -wag * 0.12;
  p.pfins.forEach((f, i) => { f.rotation.y = (i ? 1 : -1) * 0.6 + Math.sin(t * 5 + i) * 0.35 * (i ? 1 : -1); });
  const open = o.talking ? 0.5 + 0.5 * Math.sin(t * 14) : (o.mood === 'sad' ? 0.35 : 0.15);
  p.mouth.scale.set(1, 0.6 + open * 1.4, 1 + open * 0.4);
  const sad = o.mood === 'sad' || o.mood === 'worried';
  p.brows.forEach((b, i) => { b.rotation.z = sad ? (i ? 1 : -1) * 0.35 + 1.3 : 1.3; b.position.y = sad ? 0.4 : 0.36; });
  if (o.mood === 'sleep') setLids(g, true); else blinkLids(g, o.blink || 0);
}

// ───────────── Wal ─────────────
export function makeWhale() {
  const g = new THREE.Group(); const parts = {};
  const blue = 0x3a6db8;
  // Körper: Kugelkopf vorn, sich verjüngend nach hinten (mehrere Segmente)
  sph(g, 3.2, blue, 0, 0, 0, 1.25, 1, 1);
  sph(g, 2.9, blue, 3.5, 0.2, 0, 1.4, 0.9, 0.9);
  sph(g, 2.2, blue, 7.2, 0.5, 0, 1.6, 0.75, 0.75);
  sph(g, 1.3, blue, 10.6, 0.8, 0, 1.8, 0.6, 0.6);
  // Bauch hell
  sph(g, 2.9, 0xcfe1f2, 0.3, -0.9, 0, 1.25, 0.75, 0.95, { rough: 0.7 });
  sph(g, 2.5, 0xcfe1f2, 3.6, -0.7, 0, 1.4, 0.65, 0.85, { rough: 0.7 });
  // Kehlfurchen
  for (let i = 0; i < 6; i++) { const r = cyl(g, 0.05, 5.5, 0x9db9d6, 1.2, -2.6 + i * 0.28, 0, 0, Math.PI / 2); r.rotation.y = 0; r.position.z = (i - 2.5) * 0.7; r.rotation.x = 0; r.castShadow = false; }
  // Maul: weit offen vorn unten (dunkle Höhle), Zunge, Unterkiefer, Lippenlinie
  const mouth = new THREE.Group(); mouth.position.set(-3.4, -1.1, 0); g.add(mouth); parts.mouth = mouth;
  sph(mouth, 1.0, 0x0c1a3c, -0.5, 0.1, 0, 1.1, 1.2, 2.7, { rough: 0.95 });
  sph(mouth, 0.8, 0xe37a90, 0.2, -0.75, 0, 1.0, 0.35, 2.0, { rough: 0.6 });
  const jaw = sph(g, 2.6, blue, -0.6, -2.3, 0, 1.35, 0.45, 1.08); parts.jaw = jaw;
  sph(g, 2.5, 0xcfe1f2, -0.55, -2.5, 0, 1.33, 0.36, 1.03, { rough: 0.7 });
  const lipLine = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.09, 8, 40, Math.PI * 0.9), M(0x14295c)); lipLine.rotation.set(Math.PI / 2, 0, Math.PI * 1.05); lipLine.position.set(0.2, -0.2, 0); g.add(lipLine);
  // Augen
  for (const sz of [-1, 1]) { const e = eye(g, 0.42, -1.6, 0.9, sz * 3.0, { skin: 0x4577c0, lid: 0.25, white: 0xeef4fb }); e.lookAt(new THREE.Vector3(-6, 0.9, sz * 8)); }
  // Brustflossen
  for (const sz of [-1, 1]) { const pf = new THREE.Group(); pf.position.set(0.8, -1.6, sz * 2.6); pf.rotation.set(sz * 0.5, 0, -0.3); g.add(pf); curveFin(pf, [[0, 0], [-1.2, -1.6, -2.6, -2.8], [-1.0, -1.4, 0.8, -0.3]], 0x2b569e, 0, 0, 0, [Math.PI / 2, 0, 0], 0.18); (parts.pfins = parts.pfins || []).push(pf); }
  // Rückenflosse
  curveFin(g, [[0, 0], [0.6, 1.4, 1.5, 0.3]], 0x2f5ea8, 6.5, 2.0, -0.08, [0, 0, 0], 0.16);
  // Schwanzflosse (Drehpunkt am Stiel, horizontal wie bei Walen)
  const tail = new THREE.Group(); tail.position.set(11.6, 0.9, 0); g.add(tail); parts.tail = tail;
  curveFin(tail, [[0, 0], [1.6, 1.4, 3.2, 2.4], [2.4, 0.5, 2.1, 0], [2.4, -0.5, 3.2, -2.4], [1.6, -1.4, 0, 0]], 0x2a5497, 0, 0, 0, [Math.PI / 2, 0, 0], 0.2);
  blushPair(g, -1.9, 0.1, 3.1, 0.6);
  g.userData.parts = parts; return g;
}
function blushPair(g, x, y, z, r) { for (const sz of [-1, 1]) sph(g, r, 0xff8a7a, x, y, sz * z, 1, 0.7, 0.4, { alpha: 0.3 }); }
export function animWhale(g, t, blink) {
  const p = g.userData.parts;
  p.tail.rotation.z = Math.sin(t * 1.2) * 0.18; p.pfins.forEach((f, i) => { f.rotation.x = (i ? 1 : -1) * 0.5 + Math.sin(t * 1.5 + i) * 0.15; });
  p.jaw.position.y = -1.9 + Math.sin(t * 0.8) * 0.08; blinkLids(g, blink);
}

// ───────────── Seestern ─────────────
export function makeStar() {
  const g = new THREE.Group();
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.62 : 1.45; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 6, curveSegments: 4 });
  const m = new THREE.Mesh(geo, M(0xe4796d, { rough: 0.75 })); m.rotation.x = -Math.PI / 2; m.position.y = 0; m.castShadow = true; m.receiveShadow = true; g.add(m);
  // Noppen
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; for (let k = 1; k <= 4; k++) { const d = 0.3 + k * 0.26; sph(g, 0.07 - k * 0.008, 0xf7b3a4, Math.cos(a) * d, 0.62, Math.sin(a) * d, 1, 0.7, 1); } }
  // Gesicht: schaut nach oben/vorn (Seestern liegt flach, Gesicht auf der Oberseite, leicht zur Kamera geneigt)
  const face = new THREE.Group(); face.position.set(0, 0.5, 0.1); face.rotation.x = -Math.PI / 2 + 0.6; g.add(face);
  for (const sx of [-1, 1]) eye(face, 0.16, sx * 0.24, 0.05, 0.05, { skin: 0xe4796d, lid: 0.2 });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 20, Math.PI), M(0x7a2438)); smile.rotation.z = Math.PI; smile.position.set(0, -0.2, 0.08); face.add(smile);
  for (const sx of [-1, 1]) sph(face, 0.1, 0xff8a7a, sx * 0.42, -0.12, 0.05, 1, 0.7, 0.4, { alpha: 0.35 });
  g.userData.parts = { face }; return g;
}

// ───────────── Qualle ─────────────
export function makeJelly() {
  const g = new THREE.Group(); const parts = {};
  const bell = new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2 + 0.25), M(0xd597ea, { alpha: 0.82, rough: 0.3, emissive: 0xa070e0, ei: 0.25, side: THREE.DoubleSide }));
  bell.scale.set(1, 0.85, 1); bell.castShadow = true; g.add(bell); parts.bell = bell;
  const inner = sph(g, 1.1, 0xfbd2ee, 0, 0.35, 0, 1, 0.5, 1, { alpha: 0.35, emissive: 0xffc8f0, ei: 0.5, rough: 0.2 }); parts.inner = inner;
  // Saum
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.12, 10, 40), M(0x9c66d6, { alpha: 0.85, rough: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = -0.4; g.add(rim);
  // Gesicht vorn (-X)
  for (const sz of [-1, 1]) { const e = eye(g, 0.34, -1.2, 0.2, sz * 0.72, { skin: 0xd7a3ec, lid: 0.3, iris: 0x4a2f5a }); e.lookAt(new THREE.Vector3(-6, 0.2, sz * 1.6)); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20, Math.PI), M(0x6e3c96)); smile.rotation.set(0, -Math.PI / 2, Math.PI); smile.position.set(-1.62, -0.3, 0); g.add(smile);
  blushPair(g, -1.4, -0.2, 1.15, 0.2);
  // Tentakel: Ketten aus Segmenten (werden animiert)
  parts.tents = [];
  const roots = [[-1.1, 0], [-0.55, 0.95], [0.55, 0.95], [1.1, 0], [0.55, -0.95], [-0.55, -0.95], [-0.3, 0.4], [0.3, -0.4]];
  roots.forEach(([x, z], i) => {
    const chain = new THREE.Group(); chain.position.set(x, -0.45, z); g.add(chain);
    let node = chain; const n = 7 + (i % 3);
    for (let k = 0; k < n; k++) { const seg = new THREE.Group(); const r = 0.075 - k * 0.006; cyl(seg, r, 0.55, k % 2 ? 0xe6bfff : 0xb27de1, 0, -0.27, 0, 0, 0, { alpha: 0.75, rough: 0.4 }); seg.position.y = k ? -0.55 : 0; node.add(seg); node = seg; }
    parts.tents.push(chain);
  });
  // Mundarme (Rüschen)
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const arm = cyl(g, 0.12, 1.6, 0xe9c9ff, Math.cos(a) * 0.35, -1.2, Math.sin(a) * 0.35, 0, 0, { alpha: 0.6, rough: 0.5 }); arm.scale.x = 0.5; }
  const light = new THREE.PointLight(0xd9a6ff, 2.2, 14, 1.6); light.position.set(0, -0.3, 0); g.add(light); parts.light = light;
  g.userData.parts = parts; return g;
}
export function animJelly(g, t, blink) {
  const p = g.userData.parts; const pulse = Math.sin(t * 1.6);
  p.bell.scale.set(1 + pulse * 0.05, 0.85 - pulse * 0.05, 1 + pulse * 0.05); p.inner.scale.set(1.1 + pulse * 0.05, 0.55 - pulse * 0.03, 1.1 + pulse * 0.05);
  p.tents.forEach((chain, i) => { let node = chain; let k = 0; while (node.children.length) { node.rotation.x = Math.sin(t * 1.8 + i + k * 0.6) * 0.14; node.rotation.z = Math.cos(t * 1.4 + i * 0.7 + k * 0.5) * 0.14; node = node.children.find(c => c.type === 'Group') || { children: [] }; k++; } });
  p.light.intensity = 1.8 + pulse * 0.5; blinkLids(g, blink);
}

// ───────────── Schildkröte ─────────────
function shellTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, '#c9c58a'); grd.addColorStop(0.6, '#8f9350'); grd.addColorStop(1, '#5a6432'); g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  const hex = (x, y, r) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
  for (let row = 0; row < 6; row++) for (let i = 0; i < 12; i++) {
    const x = i * 92 + (row % 2) * 46, y = 40 + row * 82, r = 44;
    const pg = g.createRadialGradient(x - 14, y - 14, 2, x, y, r); pg.addColorStop(0, 'rgba(240,232,170,.5)'); pg.addColorStop(1, 'rgba(30,35,10,.45)'); g.fillStyle = pg; hex(x, y, r); g.fill();
    g.strokeStyle = 'rgba(35,40,12,.85)'; g.lineWidth = 7; hex(x, y, r - 3); g.stroke();
    g.strokeStyle = 'rgba(240,232,170,.28)'; g.lineWidth = 2; hex(x + 2, y + 2, r - 12); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
}
export function makeTurtle() {
  const g = new THREE.Group(); const parts = {}; const skin = 0x979e55;
  // Panzer: obere Halbkugel mit Plattentextur, Saum als Torus-Segment
  const shell = new THREE.Mesh(new THREE.SphereGeometry(3.0, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: shellTexture(), roughness: 0.7 }));
  shell.scale.set(1.25, 0.72, 1); shell.position.set(1.2, 0.2, 0); shell.castShadow = true; shell.receiveShadow = true; g.add(shell); parts.shell = shell;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.32, 12, 48), M(0x6e7638, { rough: 0.7 })); rim.rotation.x = Math.PI / 2; rim.scale.set(1.25, 1, 1); rim.position.set(1.2, 0.2, 0); g.add(rim);
  sph(g, 2.9, 0xc9b98a, 1.2, -0.1, 0, 1.25, 0.25, 1, { rough: 0.8 });  // Bauchpanzer
  // Hals und Kopf
  cyl(g, 0.85, 1.6, skin, -2.6, 0.1, 0, 0, Math.PI / 2, { rough: 0.6 });
  const head = new THREE.Group(); head.position.set(-3.9, 0.3, 0); g.add(head); parts.head = head;
  sph(head, 1.25, skin, 0, 0, 0, 1.15, 1, 1, { rough: 0.6 });
  sph(head, 0.7, skin, -0.9, -0.3, 0, 1, 0.8, 0.9, { rough: 0.6 });   // Schnauze
  for (const sz of [-1, 1]) { const e = eye(head, 0.42, -0.55, 0.3, sz * 0.78, { skin, lid: 0.45, iris: 0x7a5230 }); e.lookAt(new THREE.Vector3(-6, 0.3, sz * 1.8)); }
  for (const sz of [-1, 1]) sph(head, 0.06, 0x3a3a1a, -1.55, -0.2, sz * 0.18);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 24, Math.PI), M(0x3a3a1a)); smile.rotation.set(0, -Math.PI / 2, Math.PI); smile.position.set(-1.35, -0.55, 0); head.add(smile); parts.smile = smile;
  blushPair(head, -0.9, -0.35, 0.95, 0.28);
  // Vorderflossen (Drehpunkt am Panzer), hinten kleiner, Schwanz
  parts.flips = [];
  for (const sz of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(-0.9, -0.35, sz * 2.0); g.add(f); parts.flips.push(f);
    const fl = curveFin(f, [[0, 0], [-1.2, -0.6, -2.6, -0.3], [-3.4, -0.1, -3.2, 0.5], [-2.2, 0.8, 0, 0.5]], skin, 0, 0, 0, [Math.PI / 2, 0, 0], 0.42, { rough: 0.6 }); fl.position.z = sz * 0.25;
    const r = new THREE.Group(); r.position.set(3.0, -0.45, sz * 2.0); g.add(r); curveFin(r, [[0, 0], [0.8, -0.5, 1.8, -0.2], [1.2, 0.5, 0, 0.5]], skin, 0, 0, 0, [Math.PI / 2, 0, 0], 0.28, { rough: 0.6 });
  }
  cyl(g, 0.22, 1.0, skin, 4.8, -0.2, 0, 0, Math.PI / 2);
  g.userData.parts = parts; return g;
}
export function animTurtle(g, t, o) {
  const p = g.userData.parts; const hug = o.hug || 0;
  p.head.rotation.z = Math.sin(t * 0.8) * 0.05 * (1 - hug); p.head.position.y = 0.3 + Math.sin(t * 1.1) * 0.05;
  p.flips.forEach((f, i) => { const sz = i ? 1 : -1; const base = Math.sin(t * 1.0 + i) * 0.12; const h = i ? hug : 0; f.rotation.y = (1 - h) * base + h * -1.15; f.rotation.z = h * 0.35; f.rotation.x = h * 0.2; });
  if (hug > 0.5) setLids(g, true); else blinkLids(g, o.blink || 0);
}
