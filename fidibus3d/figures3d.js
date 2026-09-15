// 3D-Figuren für Fidibus (three.js): gedrehte Körper mit gemalten Texturen, große Buch-Augen, gefächerte Flossen.
// Alle Figuren blicken nach -X (links).
import * as THREE from './three.module.min.js';

const TAU = Math.PI * 2;
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

// ───────────── gemalte Texturen (Canvas) ─────────────
function tex(w, h, fn, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t;
}
function grainOn(g, w, h, a = 0.1) { for (let i = 0; i < w * h / 40; i++) { const v = 60 + Math.random() * 150 | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }
// Fischhaut: u (x) läuft um den Körper, 0/1 = Rücken, 0.5 = Bauch; v (y) läuft vom Schwanz (0) zum Kopf (1)
function fishSkin(top, mid, belly, dark) {
  return tex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, dark); grd.addColorStop(0.2, top); grd.addColorStop(0.42, mid); grd.addColorStop(0.5, belly); grd.addColorStop(0.58, mid); grd.addColorStop(0.8, top); grd.addColorStop(1, dark);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // Schuppen (Bögen), Richtung Schwanz dichter
    g.strokeStyle = 'rgba(150,60,10,.28)'; g.lineWidth = 2.2;
    for (let r = 0; r < 20; r++) for (let i = 0; i < 24; i++) { const x = i * 22 + (r % 2) * 11, y = 40 + r * 22; g.beginPath(); g.arc(x, y, 10, 0.25, Math.PI - 0.25); g.stroke(); }
    // Glanz auf dem Rücken, Bauch heller
    let s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, 'rgba(255,240,200,0)'); s.addColorStop(0.75, 'rgba(255,240,200,.28)'); s.addColorStop(1, 'rgba(255,240,200,.1)'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    grainOn(g, w, h, 0.08);
  });
}
function whaleSkin() {
  return tex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#1f3f7c'); grd.addColorStop(0.18, '#3a6db8'); grd.addColorStop(0.34, '#4a7fc8'); grd.addColorStop(0.42, '#b9d1ea'); grd.addColorStop(0.5, '#d6e6f4'); grd.addColorStop(0.58, '#b9d1ea'); grd.addColorStop(0.66, '#4a7fc8'); grd.addColorStop(0.82, '#3a6db8'); grd.addColorStop(1, '#1f3f7c');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // Marmorierung und Sprenkel auf dem Rücken
    for (let i = 0; i < 80; i++) { const x = Math.random() * w, y = Math.random() * h; if (x > w * 0.36 && x < w * 0.64) continue; const r = 8 + Math.random() * 26; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(20,45,110,.28)'); rg.addColorStop(1, 'rgba(20,45,110,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    for (let i = 0; i < 260; i++) { const x = Math.random() * w, y = Math.random() * h; if (x > w * 0.36 && x < w * 0.64) continue; g.fillStyle = 'rgba(200,225,255,.22)'; g.beginPath(); g.arc(x, y, 1.5 + Math.random() * 2.5, 0, TAU); g.fill(); }
    // Kehlfurchen am Bauch, vorderer Teil (v hoch = Kopf)
    g.strokeStyle = 'rgba(70,100,150,.5)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const x = w * 0.37 + i * (w * 0.26 / 8); g.beginPath(); g.moveTo(x, h * 0.45); g.lineTo(x, h * 0.98); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x + 3, h * 0.45); g.lineTo(x + 3, h * 0.98); g.stroke(); g.strokeStyle = 'rgba(70,100,150,.5)'; }
    // Freundliche Mundlinie an beiden Kopfseiten: von der Seite nach vorn unten, hinten leicht nach oben gezogen
    g.strokeStyle = 'rgba(12,26,60,.9)'; g.lineWidth = 9; g.lineCap = 'round';
    for (const u of [0.5 - 0.5, 0.5 + 0.5]) { const sgn = u < 0.5 ? 1 : -1; g.beginPath(); g.moveTo(w * (0.5 - sgn * 0.19), h * 0.74); g.quadraticCurveTo(w * (0.5 - sgn * 0.14), h * 0.9, w * (0.5 - sgn * 0.07), h * 0.985); g.stroke(); }
    grainOn(g, w, h, 0.07);
  });
}
function turtleSkin() {
  return tex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#5e6a34'); grd.addColorStop(0.5, '#979e55'); grd.addColorStop(1, '#c2c078'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 14; r++) for (let i = 0; i < 14; i++) { const x = i * 38 + (r % 2) * 19, y = 20 + r * 36; const rg = g.createRadialGradient(x - 5, y - 5, 1, x, y, 15); rg.addColorStop(0, 'rgba(235,230,170,.32)'); rg.addColorStop(1, 'rgba(50,60,20,.22)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill(); g.strokeStyle = 'rgba(50,60,20,.35)'; g.lineWidth = 1.5; g.stroke(); }
    grainOn(g, w, h, 0.08);
  }, [3, 2]);
}
function shellTex() {
  return tex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#d8d094'); grd.addColorStop(0.55, '#8f9350'); grd.addColorStop(1, '#3f4a24'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const hex = (x, y, r) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
    for (let row = 0; row < 6; row++) for (let i = 0; i < 12; i++) {
      const x = i * 92 + (row % 2) * 46, y = 40 + row * 82, r = 44;
      const pg = g.createRadialGradient(x - 14, y - 14, 2, x, y, r); pg.addColorStop(0, 'rgba(240,232,170,.5)'); pg.addColorStop(0.6, 'rgba(130,135,65,.12)'); pg.addColorStop(1, 'rgba(30,35,10,.5)'); g.fillStyle = pg; hex(x, y, r); g.fill();
      g.strokeStyle = 'rgba(35,40,12,.85)'; g.lineWidth = 7; hex(x, y, r - 3); g.stroke();
      for (let k = 1; k <= 2; k++) { g.strokeStyle = `rgba(240,232,170,${0.3 - k * 0.1})`; g.lineWidth = 2; hex(x + k * 2, y + k * 2, r - 9 - k * 10); g.stroke(); }
    }
    for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 20; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(60,110,60,.25)'); rg.addColorStop(1, 'rgba(60,110,60,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    grainOn(g, w, h, 0.08);
  }, [2, 1]);
}
function finTex(c1, c2) {
  return tex(256, 256, (g, w, h) => { const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, c1); grd.addColorStop(1, c2); g.fillStyle = grd; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,95,20,.45)'; g.lineWidth = 3; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, h / 2); g.quadraticCurveTo(w * 0.5, h / 2 + (i - 5.5) * 18, w, (i + 0.5) * h / 12); g.stroke(); } });
}
function jellyTex() {
  return tex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#7448bd'); grd.addColorStop(0.35, '#a878df'); grd.addColorStop(0.75, '#d597ea'); grd.addColorStop(1, '#fbd2ee'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 4; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * w / 12 + 20, h); g.quadraticCurveTo(i * w / 12 + 30, h * 0.5, i * w / 12 + 22, h * 0.15); g.stroke(); }
    grainOn(g, w, h, 0.05);
  });
}

// ───────────── Formen ─────────────
// Drehkörper entlang Y (Profil r(y)), danach so gedreht, dass +Y → -X (Kopf links)
function lathe(profile, segs = 40) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, segs); return geo;
}
function finShape(ctrl, depth = 0.05, opts = {}) {
  const s = new THREE.Shape(); s.moveTo(ctrl[0][0], ctrl[0][1]); for (let i = 1; i < ctrl.length; i++) { const q = ctrl[i]; q.length === 4 ? s.quadraticCurveTo(q[0], q[1], q[2], q[3]) : s.lineTo(q[0], q[1]); } s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 16, UVGenerator: boxUV });
}
// UVs für Flossen: über die Bounding-Box normiert, damit die Strahlen-Textur passt
const boxUV = {
  generateTopUV(geometry, vertices, a, b, c) { const bb = geometry.userData.bb || (geometry.userData.bb = bboxOf(vertices)); return [uv(vertices, a, bb), uv(vertices, b, bb), uv(vertices, c, bb)]; },
  generateSideWallUV(geometry, vertices, a, b, c, d) { const bb = geometry.userData.bb || (geometry.userData.bb = bboxOf(vertices)); return [uv(vertices, a, bb), uv(vertices, b, bb), uv(vertices, c, bb), uv(vertices, d, bb)]; }
};
function bboxOf(v) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < v.length; i += 3) { x0 = Math.min(x0, v[i]); x1 = Math.max(x1, v[i]); y0 = Math.min(y0, v[i + 1]); y1 = Math.max(y1, v[i + 1]); } return { x0, x1, y0, y1 }; }
function uv(v, i, bb) { return new THREE.Vector2((v[i * 3] - bb.x0) / (bb.x1 - bb.x0 || 1), (v[i * 3 + 1] - bb.y0) / (bb.y1 - bb.y0 || 1)); }
function finMesh(p, ctrl, texture, x, y, z, rot = [0, 0, 0], depth = 0.05, alpha = 0.9) {
  const geo = finShape(ctrl, depth); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, transparent: true, opacity: alpha, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; p.add(m); return m;
}

// ───────────── Auge (groß und rund, wie im Buch) ─────────────
function eye(p, r, x, y, z, opts = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  sph(g, r, opts.white || 0xfdfaf2, 0, 0, 0, 1, 1.06, 0.9, { rough: 0.25 });
  sph(g, r * 0.78, opts.iris || 0x3a2414, 0, -r * 0.03, r * 0.6, 1, 1.04, 0.5, { rough: 0.35 });
  sph(g, r * 0.6, 0x0d0805, 0, -r * 0.03, r * 0.76, 1, 1.04, 0.5, { rough: 0.3 });
  sph(g, r * 0.2, 0xffffff, r * 0.24, r * 0.24, r * 0.98, 1, 1, 0.5, { rough: 0.1, emissive: 0xffffff, ei: 0.8 });
  sph(g, r * 0.09, 0xffffff, -r * 0.16, -r * 0.26, r * 1.02, 1, 1, 0.5, { rough: 0.1, emissive: 0xffffff, ei: 0.6 });
  const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.1, 28, 14, 0, TAU, 0, Math.PI / 2), M(opts.skin || 0xf28c28, { rough: 0.6 }));
  lid.scale.set(1, 1.06, 0.95); lid.rotation.x = -(1 - (opts.lid ?? 0.12)) * Math.PI / 2; g.add(lid); g.userData.lid = lid; g.userData.lidRest = lid.rotation.x;
  // Lidkante: kurzer dunkler Bogen an der Vorderseite des Lids (offen: oberer Augenrand, geschlossen: Schlaf-Linie)
  const arc = Math.PI * 0.7; const edge = new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, r * 0.035, 6, 24, arc), M(opts.rim || 0x6b3a12, { rough: 0.6 })); edge.rotation.set(Math.PI / 2, 0, Math.PI / 2 - arc / 2); edge.castShadow = false; lid.add(edge);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.05, 8, 36), M(opts.rim || 0x6b3a12, { rough: 0.6 })); ring.position.z = r * 0.3; ring.scale.set(1, 1.06, 1); g.add(ring);
  if (opts.lashes) for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.5; const l = cyl(g, r * 0.05, r * 0.5, 0x2a1a10, Math.sin(a) * r * 1.1, Math.cos(a) * r * 1.2, r * 0.3, 0, -a); l.castShadow = false; }
  return g;
}
const LID_CLOSED = Math.PI / 2 * 0.92;
export function setLids(root, closed) { root.traverse(o => { if (o.userData && o.userData.lid) o.userData.lid.rotation.x = closed ? LID_CLOSED : o.userData.lidRest; }); }
export function blinkLids(root, k) { root.traverse(o => { if (o.userData && o.userData.lid) o.userData.lid.rotation.x = o.userData.lidRest * (1 - k) + LID_CLOSED * k; }); }
function blushPair(g, x, y, z, r) { for (const sz of [-1, 1]) sph(g, r, 0xff8a7a, x, y, sz * z, 1, 0.7, 0.4, { alpha: 0.35 }); }
function smileMesh(p, r, t, col, x, y, z, rot) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 28, Math.PI), M(col, { rough: 0.6 })); m.position.set(x, y, z); m.rotation.set(...rot); p.add(m); return m; }
// Offener, lachender Mund: dunkle Höhle, Zunge, helle Unterlippe (wie Fidibus im Buch)
function openMouth(p, w, hgt, dep, x, y, z, lipCol) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  const cav = sph(g, 1, 0x5c1626, 0, 0, 0, dep, hgt, w, { rough: 0.85 });
  const tongue = sph(g, 1, 0xe9758d, dep * 0.15, -hgt * 0.45, 0, dep * 0.8, hgt * 0.4, w * 0.7, { rough: 0.55 });
  const lip = sph(g, 1, lipCol, -dep * 0.05, -hgt * 0.95, 0, dep * 1.15, hgt * 0.55, w * 1.15, { rough: 0.55 });
  const edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 30, Math.PI), M(0x5c1626, { rough: 0.7 })); edge.scale.set(w * 1.05, hgt * 1.1, 1); edge.rotation.set(0, Math.PI / 2, Math.PI); edge.position.x = -dep * 0.55; g.add(edge);
  g.userData.m = { cav, tongue, lip, edge, w, hgt, dep }; return g;
}

// ───────────── Fisch (Fidibus / Mama / Papa) ─────────────
const FINTEX = {}; function finTexFor(kind) { return FINTEX[kind] || (FINTEX[kind] = finTex(kind === 'papa' ? '#a9bf4a' : '#c9d85e', kind === 'papa' ? '#4f8a3a' : '#5fa04a')); }
export function makeFish(kind = 'fid') {
  const pal = kind === 'mama' ? ['#ffb650', '#fb9a2e', '#ffd98a', '#c9650f'] : kind === 'papa' ? ['#f08a24', '#e07314', '#f6b45c', '#9e4a0a'] : ['#ffa53a', '#f5851f', '#ffd27a', '#b85a10'];
  const g = new THREE.Group(); const parts = {}; const ft = finTexFor(kind);
  // Körper: kugelrund und pummelig wie im Buch, zum Schwanz hin kurz verjüngt
  const prof = [[0.02, -0.9], [0.25, -0.85], [0.5, -0.62], [0.68, -0.32], [0.78, 0.0], [0.8, 0.25], [0.74, 0.52], [0.6, 0.72], [0.4, 0.87], [0.15, 0.96], [0.0, 0.98]];
  const body = new THREE.Mesh(lathe(prof, 48), new THREE.MeshStandardMaterial({ map: fishSkin(pal[0], pal[1], pal[2], pal[3]), roughness: 0.5 }));
  body.rotation.z = Math.PI / 2; body.scale.set(1.0, 1.0, 0.9); body.castShadow = true; body.receiveShadow = true; g.add(body); parts.body = body;
  // Schwanz: großer Fächer (Drehpunkt am Schwanzansatz)
  const tail = new THREE.Group(); tail.position.set(0.9, 0, 0); g.add(tail); parts.tail = tail;
  finMesh(tail, [[0, 0], [0.3, 0.5, 0.72, 0.62], [0.5, 0.15, 0.55, 0], [0.5, -0.15, 0.72, -0.62], [0.3, -0.5, 0, 0]], ft, 0, 0, -0.03, [0, 0, 0], 0.06, 0.92);
  // Rückenflosse, Bauchflosse
  finMesh(g, [[-0.35, 0], [-0.1, 0.55, 0.25, 0.55], [0.45, 0.45, 0.5, 0.05]], ft, 0, 0.62, -0.03, [0, 0, 0], 0.06, 0.92);
  finMesh(g, [[0.15, 0], [0.4, -0.36, 0.6, -0.05]], ft, 0, -0.64, -0.02, [0, 0, 0], 0.05, 0.9);
  // Brustflossen (Drehpunkt an der Wurzel)
  for (const sz of [-1, 1]) { const pf = new THREE.Group(); pf.position.set(-0.05, -0.25, sz * 0.56); pf.rotation.y = sz * 0.7; g.add(pf); finMesh(pf, [[0, 0], [0.3, -0.35, 0.12, -0.6], [-0.2, -0.4, 0, 0]], ft, 0, 0, 0, [0, 0, 0], 0.04, 0.9); (parts.pfins = parts.pfins || []).push(pf); }
  // Augen: sehr groß, rund, weit vorn – beide von der Seite sichtbar
  const eyeR = 0.3;
  for (const sz of [-1, 1]) { const e = eye(g, eyeR, -0.5, 0.24, sz * 0.46, { skin: parseInt(pal[1].slice(1), 16), lashes: kind === 'mama', lid: kind === 'papa' ? 0.22 : 0.1, rim: parseInt(pal[3].slice(1), 16) }); e.lookAt(new THREE.Vector3(-2.6, 0.4, sz * 1.4)); }
  // Mund: breit lachend geöffnet, mit Zunge und heller Unterlippe; traurig: kleiner Bogen nach unten
  const mouth = openMouth(g, 0.36, 0.15, 0.22, -0.9, -0.3, 0, parseInt(pal[2].slice(1), 16)); parts.mouth = mouth;
  const frown = new THREE.Group(); frown.position.set(-0.95, -0.26, 0); frown.visible = false; g.add(frown); parts.frown = frown;
  for (const sz of [-1, 1]) smileMesh(frown, 0.13, 0.028, 0x7a2438, 0, 0, sz * 0.1, [0, -Math.PI / 2 + sz * 0.75, 0]);
  blushPair(g, -0.68, -0.1, 0.5, 0.14);
  // Brauen: feine Bögen hoch über den Augen
  for (const sz of [-1, 1]) { const b = cyl(g, kind === 'papa' ? 0.03 : 0.016, 0.3, parseInt(pal[3].slice(1), 16), -0.5, 0.64, sz * 0.36, 0, 1.3); b.rotation.y = sz * 0.6; (parts.brows = parts.brows || []).push(b); }
  const s = kind === 'fid' ? 1 : kind === 'mama' ? 1.35 : 1.45; g.scale.setScalar(s);
  g.userData.parts = parts; return g;
}
export function animFish(g, t, o) {
  const p = g.userData.parts; const sp = o.speed || 0;
  const wag = Math.sin(t * (6 + sp * 1.5)) * (o.moving ? 0.5 : 0.18);
  p.tail.rotation.y = wag; p.body.rotation.y = -wag * 0.1;
  p.pfins.forEach((f, i) => { f.rotation.y = (i ? 1 : -1) * 0.7 + Math.sin(t * 5 + i) * 0.35 * (i ? 1 : -1); });
  const talk = o.talking ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
  const sad = o.mood === 'sad' || o.mood === 'worried', sleep = o.mood === 'sleep';
  const m = p.mouth.userData.m;
  p.mouth.visible = !sad; p.frown.visible = sad;
  const hs = sleep ? 0.35 : 0.75 + talk * 0.9;   // Mundöffnung
  m.cav.scale.set(m.dep, m.hgt * hs, m.w); m.edge.scale.set(m.w * 1.05, m.hgt * hs * 1.1, 1); m.tongue.position.y = -m.hgt * hs * 0.45; m.lip.position.y = -m.hgt * hs * 0.95;
  p.brows.forEach((b, i) => { b.rotation.z = sad ? 1.3 + (i ? 1 : -1) * 0.45 : 1.3; b.position.y = sad ? 0.68 : 0.64; });
  if (sleep) setLids(g, true); else blinkLids(g, o.blink || 0);
}

// ───────────── Wal ─────────────
export function makeWhale() {
  const g = new THREE.Group(); const parts = {};
  // Körper: Drehkörper mit stumpfem, riesigem Kopf und schmalem Schwanzstiel; Länge 15
  const prof = [[0.15, -1.0], [0.24, -0.9], [0.4, -0.7], [0.62, -0.45], [0.84, -0.15], [0.98, 0.15], [1.0, 0.42], [0.95, 0.66], [0.8, 0.84], [0.55, 0.95], [0.2, 0.995], [0, 1.0]];
  const body = new THREE.Mesh(lathe(prof, 56), new THREE.MeshStandardMaterial({ map: whaleSkin(), roughness: 0.6 }));
  body.rotation.z = Math.PI / 2; body.scale.set(4.2, 7.4, 4.0); body.castShadow = true; body.receiveShadow = true; g.add(body); parts.body = body;
  // Maul: lange, freundlich geschwungene Mundlinie an beiden Kopfseiten, vorn ein kleines Stück geöffnet
  const mouth = openMouth(g, 1.5, 0.42, 0.6, -7.0, -1.5, 0, 0xcfe1f2); parts.mouth = mouth;
  // Augen: groß und freundlich, mit leichtem Lid
  for (const sz of [-1, 1]) { const e = eye(g, 0.72, -4.9, 0.4, sz * 3.55, { skin: 0x4577c0, lid: 0.2, white: 0xf4f8fd, rim: 0x203f78 }); e.lookAt(new THREE.Vector3(-8, 0.4, sz * 9)); }
  blushPair(g, -5.3, -0.9, 3.65, 0.6);
  const fx = finTex('#4a80c6', '#24499a');
  for (const sz of [-1, 1]) { const pf = new THREE.Group(); pf.position.set(-1.8, -2.2, sz * 3.0); pf.rotation.set(sz * 0.55, 0, -0.35); g.add(pf); finMesh(pf, [[0, 0], [-1.4, -1.8, -3.0, -3.2], [-1.2, -1.6, 0.9, -0.3]], fx, 0, 0, 0, [Math.PI / 2, 0, 0], 0.22, 1); (parts.pfins = parts.pfins || []).push(pf); }
  finMesh(g, [[0, 0], [0.7, 1.6, 1.8, 0.4]], fx, 4.0, 3.3, -0.1, [0, 0, 0], 0.2, 1);
  const tail = new THREE.Group(); tail.position.set(7.4, 0.2, 0); g.add(tail); parts.tail = tail;
  finMesh(tail, [[0, 0], [1.8, 1.6, 3.6, 2.6], [2.7, 0.6, 2.3, 0], [2.7, -0.6, 3.6, -2.6], [1.8, -1.6, 0, 0]], fx, 0, 0, 0, [Math.PI / 2, 0, 0], 0.24, 1);
  // Wasserfontäne-Loch oben
  sph(g, 0.35, 0x24499a, -3.2, 3.9, 0, 1, 0.3, 0.7);
  g.userData.parts = parts; return g;
}
export function animWhale(g, t, blink, talking) {
  const p = g.userData.parts;
  p.tail.rotation.z = Math.sin(t * 1.2) * 0.16; p.pfins.forEach((f, i) => { f.rotation.x = (i ? 1 : -1) * 0.55 + Math.sin(t * 1.5 + i) * 0.15; });
  const m = p.mouth.userData.m; const hs = talking ? 0.8 + 0.7 * Math.sin(t * 9) : 0.7;
  m.cav.scale.set(m.dep, m.hgt * hs, m.w); m.edge.scale.set(m.w * 1.05, m.hgt * hs * 1.1, 1); m.tongue.position.y = -m.hgt * hs * 0.45; m.lip.position.y = -m.hgt * hs * 0.95;
  blinkLids(g, blink);
}

// ───────────── Seestern ─────────────
export function makeStar() {
  const g = new THREE.Group();
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.66 : 1.45; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.28, bevelSegments: 8, curveSegments: 4 });
  const m = new THREE.Mesh(geo, M(0xe8796b, { rough: 0.75 })); m.rotation.x = -Math.PI / 2; m.castShadow = true; m.receiveShadow = true; g.add(m);
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; for (let k = 1; k <= 4; k++) { const d = 0.35 + k * 0.26; for (const sd of [-1, 1]) { if (k === 1 && sd > 0) continue; sph(g, 0.07 - k * 0.008, 0xf9bcae, Math.cos(a) * d - Math.sin(a) * sd * 0.1, 0.64, Math.sin(a) * d + Math.cos(a) * sd * 0.1, 1, 0.7, 1); } } }
  const face = new THREE.Group(); face.position.set(0, 0.5, 0.12); face.rotation.x = -Math.PI / 2 + 0.75; g.add(face);
  for (const sx of [-1, 1]) eye(face, 0.26, sx * 0.3, 0.1, 0.08, { skin: 0xe8796b, lid: 0.1, rim: 0x8a3038 });
  const mouth = openMouth(face, 0.24, 0.1, 0.12, 0, -0.26, 0.2, 0xf3a094); mouth.rotation.y = -Math.PI / 2;
  for (const sx of [-1, 1]) sph(face, 0.13, 0xff8a7a, sx * 0.55, -0.14, 0.05, 1, 0.7, 0.4, { alpha: 0.4 });
  g.userData.parts = { face }; return g;
}

// ───────────── Qualle ─────────────
export function makeJelly() {
  const g = new THREE.Group(); const parts = {};
  // Schirm als Drehkörper (Kuppel mit ausgestelltem Saum), gemalte Textur
  const prof = [[0, 1.0], [0.35, 0.98], [0.68, 0.88], [0.9, 0.68], [1.0, 0.42], [1.02, 0.18], [1.0, 0.0], [0.94, -0.12], [0.86, -0.06], [0.76, 0.02], [0.4, 0.12], [0, 0.14]];
  const bell = new THREE.Mesh(lathe(prof, 48), new THREE.MeshStandardMaterial({ map: jellyTex(), roughness: 0.25, transparent: true, opacity: 0.88, emissive: 0xa070e0, emissiveIntensity: 0.22, side: THREE.DoubleSide }));
  bell.scale.set(1.9, 1.5, 1.9); bell.castShadow = true; g.add(bell); parts.bell = bell;
  const inner = sph(g, 1.0, 0xfbd2ee, 0, 0.55, 0, 1, 0.55, 1, { alpha: 0.3, emissive: 0xffc8f0, ei: 0.6, rough: 0.2 }); parts.inner = inner;
  // Gesicht vorn auf dem Schirm, zur Kamera hin gedreht
  for (const sz of [-1, 1]) { const e = eye(g, 0.4, -1.3, 0.6, sz * 1.15, { skin: 0xd7a3ec, lid: 0.16, iris: 0x4a2f5a, rim: 0x6e3c96 }); e.lookAt(new THREE.Vector3(-5, 0.7, sz * 3.5)); }
  const mouth = openMouth(g, 0.3, 0.09, 0.08, -1.88, -0.05, 0, 0xf1c4f2); parts.mouth = mouth;
  blushPair(g, -1.45, 0.15, 1.35, 0.26);
  parts.tents = [];
  const roots = [[-1.25, 0], [-0.62, 1.08], [0.62, 1.08], [1.25, 0], [0.62, -1.08], [-0.62, -1.08], [-0.35, 0.45], [0.35, -0.45]];
  roots.forEach(([x, z], i) => {
    const chain = new THREE.Group(); chain.position.set(x, -0.05, z); g.add(chain);
    let node = chain; const n = 7 + (i % 3);
    for (let k = 0; k < n; k++) { const seg = new THREE.Group(); const r = 0.08 - k * 0.006; cyl(seg, r, 0.55, k % 2 ? 0xe6bfff : 0xb27de1, 0, -0.27, 0, 0, 0, { alpha: 0.75, rough: 0.4 }); seg.position.y = k ? -0.55 : 0; node.add(seg); node = seg; }
    parts.tents.push(chain);
  });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const arm = cyl(g, 0.14, 1.8, 0xe9c9ff, Math.cos(a) * 0.4, -0.9, Math.sin(a) * 0.4, 0, 0, { alpha: 0.6, rough: 0.5 }); arm.scale.x = 0.5; }
  const light = new THREE.PointLight(0xd9a6ff, 2.2, 14, 1.6); light.position.set(0, 0.2, 0); g.add(light); parts.light = light;
  g.userData.parts = parts; return g;
}
export function animJelly(g, t, blink, talking) {
  const p = g.userData.parts; const pulse = Math.sin(t * 1.6);
  p.bell.scale.set(1.9 + pulse * 0.08, 1.5 - pulse * 0.07, 1.9 + pulse * 0.08); p.inner.scale.set(1.0 + pulse * 0.05, 0.55 - pulse * 0.03, 1.0 + pulse * 0.05);
  p.tents.forEach((chain, i) => { let node = chain; let k = 0; while (node.children.length) { node.rotation.x = Math.sin(t * 1.8 + i + k * 0.6) * 0.14; node.rotation.z = Math.cos(t * 1.4 + i * 0.7 + k * 0.5) * 0.14; node = node.children.find(c => c.type === 'Group') || { children: [] }; k++; } });
  const m = p.mouth.userData.m; const hs = talking ? 0.8 + 0.7 * Math.sin(t * 10) : 0.7;
  m.cav.scale.set(m.dep, m.hgt * hs, m.w); m.edge.scale.set(m.w * 1.05, m.hgt * hs * 1.1, 1); m.tongue.position.y = -m.hgt * hs * 0.45; m.lip.position.y = -m.hgt * hs * 0.95;
  p.light.intensity = 1.8 + pulse * 0.5; blinkLids(g, blink);
}

// ───────────── Schildkröte ─────────────
export function makeTurtle() {
  const g = new THREE.Group(); const parts = {};
  const skinMat = new THREE.MeshStandardMaterial({ map: turtleSkin(), roughness: 0.65 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(3.0, 48, 28, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ map: shellTex(), roughness: 0.7 }));
  shell.scale.set(1.3, 0.78, 1.05); shell.position.set(1.2, 0.2, 0); shell.castShadow = true; shell.receiveShadow = true; g.add(shell); parts.shell = shell;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.34, 12, 56), M(0x6e7638, { rough: 0.7 })); rim.rotation.x = Math.PI / 2; rim.scale.set(1.3, 1.05, 1); rim.position.set(1.2, 0.2, 0); g.add(rim);
  const belly = new THREE.Mesh(G_SPH, M(0xc9b98a, { rough: 0.8 })); belly.scale.set(3.7, 0.7, 3.0); belly.position.set(1.2, -0.15, 0); g.add(belly);
  // Hals und großer Kopf mit Hauttextur
  const neck = new THREE.Mesh(G_CYL, skinMat); neck.scale.set(0.95, 1.8, 0.9); neck.position.set(-2.7, 0.15, 0); neck.rotation.z = Math.PI / 2; neck.castShadow = true; g.add(neck);
  const head = new THREE.Group(); head.position.set(-4.1, 0.45, 0); g.add(head); parts.head = head;
  const hm = new THREE.Mesh(G_SPH, skinMat); hm.scale.set(1.45, 1.3, 1.25); hm.castShadow = true; hm.receiveShadow = true; head.add(hm);
  const snout = new THREE.Mesh(G_SPH, skinMat); snout.scale.set(0.85, 0.7, 0.95); snout.position.set(-1.05, -0.35, 0); snout.castShadow = true; head.add(snout);
  // Große, weise Augen mit schweren Lidern, weit vorn und außen
  for (const sz of [-1, 1]) { const e = eye(head, 0.52, -0.7, 0.4, sz * 1.0, { skin: 0x979e55, lid: 0.3, iris: 0x7a5230, rim: 0x3a3a1a }); e.lookAt(new THREE.Vector3(-6, 0.5, sz * 3.0)); }
  for (const sz of [-1, 1]) sph(head, 0.07, 0x3a3a1a, -1.85, -0.25, sz * 0.2);
  const mouth = openMouth(head, 0.6, 0.16, 0.3, -1.85, -0.62, 0, 0xc2c078); parts.mouth = mouth;
  blushPair(head, -1.0, -0.45, 1.05, 0.3);
  // Flossen mit Hauttextur
  parts.flips = [];
  for (const sz of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(-0.9, -0.35, sz * 2.0); g.add(f); parts.flips.push(f);
    const fl = new THREE.Mesh(finShape([[0, 0], [-1.2, -0.6, -2.6, -0.3], [-3.4, -0.1, -3.2, 0.5], [-2.2, 0.8, 0, 0.5]], 0.42), skinMat); fl.rotation.set(Math.PI / 2, 0, 0); fl.position.z = sz * 0.25; fl.castShadow = true; f.add(fl);
    const r = new THREE.Group(); r.position.set(3.0, -0.45, sz * 2.0); g.add(r);
    const rl = new THREE.Mesh(finShape([[0, 0], [0.8, -0.5, 1.8, -0.2], [1.2, 0.5, 0, 0.5]], 0.3), skinMat); rl.rotation.set(Math.PI / 2, 0, 0); rl.castShadow = true; r.add(rl);
  }
  const tail = new THREE.Mesh(G_CYL, skinMat); tail.scale.set(0.22, 1.0, 0.22); tail.position.set(4.8, -0.2, 0); tail.rotation.z = Math.PI / 2; g.add(tail);
  g.userData.parts = parts; return g;
}
export function animTurtle(g, t, o) {
  const p = g.userData.parts; const hug = o.hug || 0;
  p.head.rotation.z = Math.sin(t * 0.8) * 0.05 * (1 - hug); p.head.position.y = 0.45 + Math.sin(t * 1.1) * 0.05;
  p.flips.forEach((f, i) => { const base = Math.sin(t * 1.0 + i) * 0.12; const h = i ? hug : 0; f.rotation.y = (1 - h) * base + h * -1.15; f.rotation.z = h * 0.35; f.rotation.x = h * 0.2; });
  const m = p.mouth.userData.m; const hs = o.talking ? 0.8 + 0.7 * Math.sin(t * 8) : 0.6;
  m.cav.scale.set(m.dep, m.hgt * hs, m.w); m.edge.scale.set(m.w * 1.05, m.hgt * hs * 1.1, 1); m.tongue.position.y = -m.hgt * hs * 0.45; m.lip.position.y = -m.hgt * hs * 0.95;
  if (hug > 0.5) setLids(g, true); else blinkLids(g, o.blink || 0);
}
