// Vordefinierte Formen, gezeichnet im Raum 0…100. Jede Form füllt mit der aktuellen Füllfarbe.

const P = (d) => (x) => x.fill(new Path2D(d));
function poly(x, pts) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fill(); }
function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
function ell(x, cx, cy, rx, ry, rot) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2); x.fill(); }
function star(n, R, r, cx, cy, rot = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r : R; p.push(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  return p;
}
function cut(x, fn) { const g = x.globalCompositeOperation; x.globalCompositeOperation = 'destination-out'; fn(); x.globalCompositeOperation = g; }

export const SHAPES = [
  { id: 'herz', name: 'Herz', draw: P('M50 90C22 68 3 52 3 31 3 16 14 5 28 5c10 0 18 6 22 14C54 11 62 5 72 5c14 0 25 11 25 26 0 21-19 37-47 59z') },
  { id: 'kreis', name: 'Kreis', draw: (x) => circ(x, 50, 50, 48) },
  { id: 'stern', name: 'Stern', draw: (x) => poly(x, star(5, 50, 21, 50, 54)) },
  { id: 'sechseck', name: 'Sechseck', draw: (x) => poly(x, star(3, 48, 48, 50, 50, -Math.PI / 2)) },
  { id: 'ring', name: 'Ring', draw: (x) => { circ(x, 50, 50, 48); cut(x, () => circ(x, 50, 50, 26)); } },
  { id: 'mond', name: 'Mond', draw: (x) => { circ(x, 46, 50, 44); cut(x, () => circ(x, 66, 38, 36)); } },
  { id: 'sonne', name: 'Sonne', draw: (x) => { poly(x, star(12, 50, 36, 50, 50)); } },
  { id: 'klee', name: 'Kleeblatt', draw: (x) => {
      circ(x, 50, 27, 21); circ(x, 27, 50, 21); circ(x, 73, 50, 21); circ(x, 50, 73, 21); circ(x, 50, 50, 14);
      x.beginPath(); x.moveTo(52, 70); x.quadraticCurveTo(58, 88, 72, 98); x.lineTo(66, 100); x.quadraticCurveTo(50, 90, 46, 72); x.closePath(); x.fill();
    } },
  { id: 'pfote', name: 'Pfote', draw: (x) => {
      ell(x, 50, 68, 27, 23); ell(x, 21, 40, 10, 13, -0.35); ell(x, 39, 22, 10, 14, -0.12); ell(x, 61, 22, 10, 14, 0.12); ell(x, 79, 40, 10, 13, 0.35);
    } },
  { id: 'haus', name: 'Haus', draw: (x) => { poly(x, [50, 4, 97, 46, 86, 46, 86, 96, 14, 96, 14, 46, 3, 46]); cut(x, () => poly(x, [42, 96, 42, 70, 58, 70, 58, 96])); } },
  { id: 'tanne', name: 'Tanne', draw: (x) => { poly(x, [50, 2, 74, 32, 63, 32, 84, 58, 70, 58, 94, 86, 6, 86, 30, 58, 16, 58, 37, 32, 26, 32]); x.fillRect(43, 85, 14, 13); } },
  { id: 'blitz', name: 'Blitz', draw: (x) => poly(x, [60, 2, 18, 56, 46, 56, 36, 98, 82, 40, 54, 40]) },
  { id: 'tropfen', name: 'Tropfen', draw: P('M50 3C50 3 15 44 15 64a35 35 0 0 0 70 0C85 44 50 3 50 3z') },
  { id: 'blase', name: 'Sprechblase', draw: P('M18 8h64a14 14 0 0 1 14 14v38a14 14 0 0 1-14 14H44L24 94V74h-6A14 14 0 0 1 4 60V22A14 14 0 0 1 18 8z') },
  { id: 'schmetterling', name: 'Schmetterling', draw: (x) => {
      ell(x, 30, 32, 24, 20, -0.5); ell(x, 70, 32, 24, 20, 0.5); ell(x, 33, 68, 17, 20, 0.45); ell(x, 67, 68, 17, 20, -0.45); ell(x, 50, 52, 5, 30);
    } },
  { id: 'apfel', name: 'Apfel', draw: (x) => {
      x.fill(new Path2D('M50 30C40 22 14 20 10 48c-3 22 12 46 26 48 7 1 10-3 14-3s7 4 14 3c14-2 29-26 26-48C86 20 60 22 50 30z'));
      x.fill(new Path2D('M50 28c-1-10 4-20 16-24 1 10-5 20-16 24z'));
    } },
];

// Text als Form: mehrere Zeilen, fett, eng gesetzt
export const TEXT_FONT = '900 100px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
export function textShape(text) {
  const lines = String(text || '').split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) lines.push('A');
  const c = document.createElement('canvas').getContext('2d');
  c.font = TEXT_FONT;
  const lh = 92, ms = lines.map((l) => c.measureText(l));
  const asc = ms[0].actualBoundingBoxAscent || 72, desc = ms[ms.length - 1].actualBoundingBoxDescent || 0;
  let x0 = Infinity, x1 = -Infinity;
  ms.forEach((m) => { x0 = Math.min(x0, -(m.actualBoundingBoxLeft ?? 0) - m.width / 2); x1 = Math.max(x1, (m.actualBoundingBoxRight ?? m.width) - m.width / 2); });
  const bbox = [x0, -asc, x1 - x0, asc + lh * (lines.length - 1) + desc];
  return {
    bbox,
    draw(x) { x.font = TEXT_FONT; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; lines.forEach((l, i) => x.fillText(l, -ms[i].width / 2, i * lh)); },
  };
}

// Eigenes Bild als Form: Maske aus Transparenz oder Helligkeit
export function imageMask(img, { threshold = 0.5, invert = false } = {}) {
  const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h), d = id.data;
  let transparent = 0;
  for (let i = 3; i < d.length; i += 16) if (d[i] < 200) transparent++;
  const useAlpha = transparent > d.length / 16 * 0.03;
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const p = (y * w + xx) * 4;
    let on;
    if (useAlpha) on = d[p + 3] > 128;
    else on = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255 < threshold;
    if (invert) on = !on;
    d[p] = d[p + 1] = d[p + 2] = 255; d[p + 3] = on ? 255 : 0;
    if (on) { if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  }
  x.putImageData(id, 0, 0);
  const bbox = bx1 < 0 ? [0, 0, w, h] : [bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1];
  return { bbox, useAlpha, canvas: c, draw(ctx) { ctx.drawImage(c, 0, 0); } };
}
