// Gesichter-Morph: Gesicht erkennen (lokal, face-api/TensorFlow.js), ausrichten und ineinander überblenden.
// Kein Foto verlässt das Gerät: Modell und Code liegen in /vendor und werden von derselben Adresse geladen.
import * as E from './engine.js';

export const SIZE = 1024;                       // ausgerichtete Gesichter: Quadrat SIZE×SIZE
const EYE_L = [0.41, 0.42], EYE_R = [0.59, 0.42]; // Zielposition der Augen (Anteil der Kantenlänge)

let api = null, loading = null;
export function loadModel() {
  if (api) return Promise.resolve(api);
  if (!loading) {
    loading = (async () => {
      const fa = await import('./vendor/face-api/face-api.esm.js');
      try { await fa.tf.setBackend('webgl'); } catch (e) { await fa.tf.setBackend('cpu'); }
      await fa.tf.ready();
      const base = new URL('./vendor/face-api/model/', import.meta.url).href;
      await fa.nets.tinyFaceDetector.loadFromUri(base);
      await fa.nets.faceLandmark68Net.loadFromUri(base);
      api = fa;
      return fa;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

/* Größtes Gesicht finden. Gibt 68 Punkte in Bildkoordinaten zurück oder null. */
export async function findFace(img, w, h) {
  const fa = await loadModel();
  const k = Math.min(1, 720 / Math.max(w, h));
  const c = E.resample(img, 0, 0, w, h, Math.round(w * k), Math.round(h * k));
  try {
    for (const inputSize of [416, 608, 320]) {
      const res = await fa.detectAllFaces(c, new fa.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.35 })).withFaceLandmarks();
      if (res && res.length) {
        res.sort((a, b) => b.detection.box.area - a.detection.box.area);
        return res[0].landmarks.positions.map((p) => [p.x / k, p.y / k]);
      }
    }
    return null;
  } finally { E.free(c); }
}

const mean = (pts, a, b) => { let x = 0, y = 0; for (let i = a; i <= b; i++) { x += pts[i][0]; y += pts[i][1]; } const n = b - a + 1; return [x / n, y / n]; };

/* Foto so drehen/skalieren/verschieben, dass die Augen immer an derselben Stelle liegen. */
export function alignFace(img, w, h, pts) {
  const S = SIZE, L = mean(pts, 36, 41), R = mean(pts, 42, 47);
  const tl = [EYE_L[0] * S, EYE_L[1] * S], tr = [EYE_R[0] * S, EYE_R[1] * S];
  const sv = [R[0] - L[0], R[1] - L[1]], dv = [tr[0] - tl[0], tr[1] - tl[1]];
  const s = Math.hypot(...dv) / Math.hypot(...sv), ang = Math.atan2(dv[1], dv[0]) - Math.atan2(sv[1], sv[0]);
  const a = s * Math.cos(ang), b = s * Math.sin(ang), c = -b, d = a;
  const e = tl[0] - (a * L[0] + c * L[1]), f = tl[1] - (b * L[0] + d * L[1]);
  const cv = E.canvas(S, S), x = E.ctx2d(cv);
  // Ränder, die das Foto nicht abdeckt: Foto weichgezeichnet und vergrößert dahinter
  x.save(); x.filter = 'blur(24px)'; x.setTransform(a * 1.6, b * 1.6, c * 1.6, d * 1.6, e - 0.3 * S, f - 0.27 * S);
  x.drawImage(img, 0, 0, w, h); x.restore(); x.filter = 'none';
  x.setTransform(a, b, c, d, e, f); x.drawImage(img, 0, 0, w, h); x.setTransform(1, 0, 0, 1, 0, 0);
  const out = new Float32Array(pts.length * 2);
  pts.forEach((p, i) => { out[i * 2] = a * p[0] + c * p[1] + e; out[i * 2 + 1] = b * p[0] + d * p[1] + f; });
  return { canvas: cv, pts: out };
}

/* ── Dreiecksnetz (Bowyer-Watson) ───────────────────── */
export function delaunay(P) {          // P: [[x,y],...] → [[i,j,k],...]
  const n = P.length; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of P) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const dm = Math.max(maxX - minX, maxY - minY) * 20, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const pts = P.concat([[mx - dm, my - dm], [mx, my + dm], [mx + dm, my - dm]]);
  const circ = (i, j, k) => {
    const [ax, ay] = pts[i], [bx, by] = pts[j], [cx, cy] = pts[k];
    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(D) < 1e-12) return { x: 0, y: 0, r2: Infinity };
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const x = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / D, y = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / D;
    return { x, y, r2: (ax - x) ** 2 + (ay - y) ** 2 };
  };
  let tris = [{ v: [n, n + 1, n + 2], c: circ(n, n + 1, n + 2) }];
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i], bad = [], good = [];
    for (const t of tris) ((px - t.c.x) ** 2 + (py - t.c.y) ** 2 < t.c.r2 ? bad : good).push(t);
    const edges = new Map();
    for (const t of bad) for (let k = 0; k < 3; k++) {
      const a = t.v[k], b = t.v[(k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a;
      edges.set(key, edges.has(key) ? null : [a, b]);
    }
    tris = good;
    for (const e of edges.values()) if (e) tris.push({ v: [e[0], e[1], i], c: circ(e[0], e[1], i) });
  }
  return tris.filter((t) => t.v.every((v) => v < n)).map((t) => t.v);
}

// Punkte eines Gesichts plus Randpunkte, damit das ganze Bild mitverformt wird
export function withBorder(p) {
  const S = SIZE, out = [];
  for (let i = 0; i < p.length; i += 2) out.push([p[i], p[i + 1]]);
  for (const [x, y] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5], [0.2, 0], [0.8, 0], [0.2, 1], [0.8, 1], [0, 0.25], [1, 0.25], [0, 0.78], [1, 0.78]])
    out.push([x * S, y * S]);
  return out;
}

function affine(s, d) {                 // Dreieck s → Dreieck d, Rückgabe [a,b,c,d,e,f] für setTransform
  const [x0, y0, x1, y1, x2, y2] = s, [u0, v0, u1, v1, u2, v2] = d;
  const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(den) < 1e-9) return null;
  const a = (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den;
  const c = (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den;
  const e = (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den;
  const b = (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den;
  const dd = (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den;
  const f = (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den;
  return [a, b, c, dd, e, f];
}

// Bild img (SIZE×SIZE) mit Punkten src auf Zielpunkte dst verformen, auf ctx der Größe R×R
function warp(ctx, img, src, dst, tris, k) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(img, 0, 0, SIZE * k, SIZE * k);           // Grundlage gegen feine Haarlinien
  for (const [i, j, l] of tris) {
    const d = [dst[i][0] * k, dst[i][1] * k, dst[j][0] * k, dst[j][1] * k, dst[l][0] * k, dst[l][1] * k];
    const m = affine([src[i][0], src[i][1], src[j][0], src[j][1], src[l][0], src[l][1]], d);
    if (!m) continue;
    const cx = (d[0] + d[2] + d[4]) / 3, cy = (d[1] + d[3] + d[5]) / 3, g = 0.8;
    const ex = (x, y) => { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1; return [x + dx / L * g, y + dy / L * g]; };
    const p0 = ex(d[0], d[1]), p1 = ex(d[2], d[3]), p2 = ex(d[4], d[5]);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.clip();
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}

/* Morph-Ablauf: faces = [{canvas, pts}] (ausgerichtet). */
export class Morph {
  constructor(faces, o) {
    this.faces = faces; this.o = o;
    this.P = faces.map((f) => withBorder(f.pts));
    this.fps = 30;
    this.H = Math.round(o.hold * this.fps); this.M = Math.max(2, Math.round(o.dur * this.fps));
    this.T = faces.length < 2 ? 0 : o.loop ? faces.length : faces.length - 1;
    this.count = faces.length < 2 ? 1 : this.T * (this.H + this.M) + (o.loop ? 0 : Math.max(1, this.H));
    this.tris = new Map(); this.layers = null;
  }
  at(i) {                                 // → {a, b, t}
    if (this.T === 0) return { a: 0, b: 0, t: 0 };
    const per = this.H + this.M, p = Math.floor(i / per), j = i % per, n = this.faces.length;
    if (p >= this.T) return { a: this.o.loop ? 0 : n - 1, b: 0, t: 0 };
    if (j < this.H) return { a: p, b: (p + 1) % n, t: 0 };
    let t = (j - this.H + 1) / (this.M + 1); t = t * t * (3 - 2 * t);
    return { a: p, b: (p + 1) % n, t };
  }
  trisFor(a, b) {
    const key = a + ',' + b;
    if (!this.tris.has(key)) {
      const A = this.P[a], B = this.P[b];
      this.tris.set(key, delaunay(A.map((p, i) => [(p[0] + B[i][0]) / 2, (p[1] + B[i][1]) / 2])));
    }
    return this.tris.get(key);
  }
  /* Bild i quadratisch (R×R) auf ctx zeichnen */
  draw(ctx, i, R) {
    const { a, b, t } = this.at(i), k = R / SIZE;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (t <= 0 || a === b) { ctx.drawImage(this.faces[a].canvas, 0, 0, R, R); return; }
    if (t >= 1) { ctx.drawImage(this.faces[b].canvas, 0, 0, R, R); return; }
    const A = this.P[a], B = this.P[b], Mpts = A.map((p, j) => [p[0] * (1 - t) + B[j][0] * t, p[1] * (1 - t) + B[j][1] * t]);
    const tris = this.trisFor(a, b);
    if (!this.layers || this.layers[0].width !== R) {
      if (this.layers) this.layers.forEach(E.free);
      this.layers = [E.canvas(R, R), E.canvas(R, R)];
    }
    const [la, lb] = this.layers, xa = E.ctx2d(la), xb = E.ctx2d(lb);
    warp(xa, this.faces[a].canvas, A, Mpts, tris, k);
    warp(xb, this.faces[b].canvas, B, Mpts, tris, k);
    ctx.drawImage(la, 0, 0);
    ctx.globalAlpha = t; ctx.drawImage(lb, 0, 0); ctx.globalAlpha = 1;
  }
  dispose() { if (this.layers) this.layers.forEach(E.free); this.layers = null; }
}
