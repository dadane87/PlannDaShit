// Mosaik-Engine: Farbmerkmale, Layouts (Raster, Form, Hauptbild), Bildzuordnung, Zeichnen.

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}
export function ctx2d(c, opts) {
  const x = c.getContext('2d', opts);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  return x;
}
export function free(c) { if (c && c.getContext) { c.width = 1; c.height = 1; } }

export function rng(seed) {             // mulberry32
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

/* Verkleinern in Halbierungsschritten: sauberer als ein einziger großer Sprung. */
export function resample(src, sx, sy, sw, sh, w, h) {
  let cur = src, cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw > w * 2.2 && ch > h * 2.2) {
    const nw = Math.max(w, Math.round(cw / 2)), nh = Math.max(h, Math.round(ch / 2));
    const c = canvas(nw, nh);
    ctx2d(c).drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    if (cur !== src) free(cur);
    cur = c; cx = 0; cy = 0; cw = nw; ch = nh;
  }
  const c = canvas(w, h);
  ctx2d(c).drawImage(cur, cx, cy, cw, ch, 0, 0, w, h);
  if (cur !== src) free(cur);
  return c;
}

/* ── Farbe ─────────────────────────────────────────────── */
function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function fl(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
export function lab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = fl((R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047);
  const y = fl(R * 0.2126729 + G * 0.7151522 + B * 0.072175);
  const z = fl((R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 1e-6) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, s, l];
}

/* Merkmale einer Kachel: 3×3 Lab-Werte (27 Zahlen) plus Mittelwerte zum Sortieren. */
export const F = 27;
export function tileFeatures(src, size) {
  const c = resample(src, 0, 0, size, size, 3, 3);
  const d = ctx2d(c, { willReadFrequently: true }).getImageData(0, 0, 3, 3).data;
  free(c);
  const feat = new Float32Array(F);
  let R = 0, G = 0, B = 0;
  for (let i = 0; i < 9; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    R += r; G += g; B += b;
    const l = lab(r, g, b); feat[i * 3] = l[0]; feat[i * 3 + 1] = l[1]; feat[i * 3 + 2] = l[2];
  }
  R /= 9; G /= 9; B /= 9;
  const [h, s, l] = hsl(R, G, B);
  return { feat, rgb: [R | 0, G | 0, B | 0], hue: h, sat: s, light: lab(R, G, B)[0], lum: l };
}

/* Merkmale je Zelle des Hauptbilds (Ausschnitt crop, cols×rows Zellen). */
export function targetFeatures(img, crop, cols, rows) {
  const c = resample(img, crop.sx, crop.sy, crop.sw, crop.sh, cols * 3, rows * 3);
  const w = cols * 3, d = ctx2d(c, { willReadFrequently: true }).getImageData(0, 0, w, rows * 3).data;
  free(c);
  const out = new Float32Array(cols * rows * F);
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const o = (cy * cols + cx) * F;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const p = ((cy * 3 + j) * w + cx * 3 + i) * 4, k = o + (j * 3 + i) * 3;
      const l = lab(d[p], d[p + 1], d[p + 2]);
      out[k] = l[0]; out[k + 1] = l[1]; out[k + 2] = l[2];
    }
  }
  return out;
}

export function cropFor(w, h, aspect) {      // mittiger Ausschnitt mit Seitenverhältnis aspect (B/H)
  if (w / h > aspect) { const sw = h * aspect; return { sx: (w - sw) / 2, sy: 0, sw, sh: h }; }
  const sh = w / aspect; return { sx: 0, sy: (h - sh) / 2, sw: w, sh };
}

/* ── Zuordnung fürs Hauptbild ──────────────────────────── */
export async function matchTiles(tf, M, cf, cols, rows, opt, onProgress) {
  const N = cols * rows, out = new Int32Array(N).fill(-1), uses = new Int32Array(M);
  const r = rng(opt.seed || 1);
  const order = shuffle(Array.from({ length: N }, (_, i) => i), r);

  const dist = (t, o) => {
    let d = 0; const a = t * F;
    for (let i = 0; i < F; i++) { const e = tf[a + i] - cf[o + i]; d += e * e; }
    return d;
  };
  // typischer Abstand der besten Treffer → Maßstab für die Wiederholungs-Strafe
  let base = 0; const S = Math.min(48, N);
  for (let k = 0; k < S; k++) {
    const o = order[k] * F; let b = Infinity;
    for (let t = 0; t < M; t++) { const d = dist(t, o); if (d < b) b = d; }
    base += b;
  }
  base = Math.max(base / S, 50);
  const pen = 1.6 * opt.variety * opt.variety * base;
  const R = opt.spacing | 0;
  const banned = new Uint8Array(M), bl = [];

  let last = performance.now();
  for (let k = 0; k < N; k++) {
    const c = order[k], cx = c % cols, cy = (c / cols) | 0, o = c * F;
    if (R > 0) {
      const y0 = Math.max(0, cy - R), y1 = Math.min(rows - 1, cy + R), x0 = Math.max(0, cx - R), x1 = Math.min(cols - 1, cx + R);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = out[y * cols + x]; if (t >= 0 && !banned[t]) { banned[t] = 1; bl.push(t); }
      }
    }
    let best = -1, bs = Infinity;
    for (let pass = 0; pass < 2 && best < 0; pass++) {
      for (let t = 0; t < M; t++) {
        if (pass === 0 && banned[t]) continue;
        let s = pen * uses[t];
        if (s >= bs) continue;
        const a = t * F;
        for (let i = 0; i < F; i++) { const e = tf[a + i] - cf[o + i]; s += e * e; if (s >= bs) break; }
        if (s < bs) { bs = s; best = t; }
      }
    }
    out[c] = best; uses[best]++;
    while (bl.length) banned[bl.pop()] = 0;
    if ((k & 127) === 0 && performance.now() - last > 30) {
      if (onProgress && (await onProgress(k / N)) === false) return null;
      last = performance.now();
    }
  }
  return out;
}

/* ── Reihenfolge der Fotos für Raster und Form ────────── */
// Liefert für count Felder je einen Bibliotheksindex, sortiert nach mode.
export function orderedPicks(lib, count, mode, r) {
  const n = lib.length; if (!n || !count) return [];
  let ids = lib.map((_, i) => i);
  if (mode === 'farbe') {
    const key = (t) => t.sat < 0.12 || t.lum < 0.1 || t.lum > 0.94 ? 1000 + (1 - t.light / 100) * 100 : t.hue;
    ids.sort((a, b) => key(lib[a]) - key(lib[b]));
  } else if (mode === 'hell') ids.sort((a, b) => lib[b].light - lib[a].light);
  else if (mode === 'zufall') shuffle(ids, r);

  if (mode === 'zufall') {
    const out = [];
    while (out.length < count) out.push(...(out.length ? shuffle(ids.slice(), r) : ids));
    return out.slice(0, count);
  }
  const out = new Array(count);
  for (let k = 0; k < count; k++) out[k] = ids[Math.floor(k * n / count)];
  return out;
}

// Zellen-Reihenfolge passend zur Sortierung (diagonaler Verlauf oben links → unten rechts)
export function orderCells(cells, mode) {
  if (mode === 'farbe' || mode === 'hell') {
    return cells.slice().sort((a, b) => (a.x + a.s / 2 + a.y + a.s / 2) - (b.x + b.s / 2 + b.y + b.s / 2) || a.y - b.y);
  }
  return cells.slice().sort((a, b) => a.y - b.y || a.x - b.x);
}

// Gleiche Fotos nebeneinander auseinandertauschen. local = nur mit nahen Feldern
// in der Reihenfolge tauschen, damit ein Farbverlauf erhalten bleibt.
export function spreadDuplicates(L, r, local) {
  const grid = new Int32Array(L.cols * L.rows).fill(-1);
  L.tiles.forEach((t, i) => { for (let y = t.y; y < t.y + t.s; y++) for (let x = t.x; x < t.x + t.s; x++) grid[y * L.cols + x] = i; });
  const clash = (i) => {
    const t = L.tiles[i];
    for (let y = t.y - 1; y <= t.y + t.s; y++) for (let x = t.x - 1; x <= t.x + t.s; x++) {
      if (x < 0 || y < 0 || x >= L.cols || y >= L.rows) continue;
      const j = grid[y * L.cols + x]; if (j >= 0 && j !== i && L.tiles[j].t === t.t) return true;
    }
    return false;
  };
  const n = L.tiles.length;
  for (let pass = 0; pass < 4; pass++) {
    let any = false;
    for (let i = 0; i < n; i++) {
      if (!clash(i)) continue; any = true;
      for (let tries = 0; tries < 12; tries++) {
        const j = local ? Math.max(0, Math.min(n - 1, i + (r() < 0.5 ? -1 : 1) * (2 + ((r() * (6 + tries)) | 0))))
          : (r() * n) | 0;
        if (j === i) continue;
        const a = L.tiles[i].t; L.tiles[i].t = L.tiles[j].t; L.tiles[j].t = a;
        if (!clash(i) && !clash(j)) break;
        L.tiles[j].t = L.tiles[i].t; L.tiles[i].t = a;
      }
    }
    if (!any) break;
  }
}

/* ── Layouts ─────────────────────────────────────────── */
export function rasterCells(cols, rows, bigShare, r) {
  const occ = new Uint8Array(cols * rows), cells = [];
  if (bigShare > 0 && cols >= 3 && rows >= 3) {
    const want = Math.round(cols * rows * bigShare / 4);
    for (let tries = 0, placed = 0; placed < want && tries < want * 30; tries++) {
      const x = (r() * (cols - 1)) | 0, y = (r() * (rows - 1)) | 0;
      if (occ[y * cols + x] || occ[y * cols + x + 1] || occ[(y + 1) * cols + x] || occ[(y + 1) * cols + x + 1]) continue;
      occ[y * cols + x] = occ[y * cols + x + 1] = occ[(y + 1) * cols + x] = occ[(y + 1) * cols + x + 1] = 1;
      cells.push({ x, y, s: 2 }); placed++;
    }
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!occ[y * cols + x]) cells.push({ x, y, s: 1 });
  return cells;
}

/* Abdeckung einer Form je Zelle (0…1). src = {bbox:[x,y,w,h], draw(ctx)} */
export function shapeCoverage(src, cols, rows, margin) {
  const ss = Math.max(2, Math.min(6, Math.floor(Math.sqrt(4e6 / (cols * rows)))));
  const w = cols * ss, h = rows * ss, c = canvas(w, h), x = ctx2d(c, { willReadFrequently: true });
  fitShape(x, src.bbox, w, h, margin);
  x.fillStyle = '#fff'; x.strokeStyle = '#fff';
  src.draw(x);
  const d = x.getImageData(0, 0, w, h).data; free(c);
  const cov = new Float32Array(cols * rows), norm = 1 / (ss * ss * 255);
  for (let y = 0; y < h; y++) {
    const cy = (y / ss) | 0;
    for (let xx = 0; xx < w; xx++) cov[cy * cols + ((xx / ss) | 0)] += d[(y * w + xx) * 4 + 3];
  }
  for (let i = 0; i < cov.length; i++) cov[i] *= norm;
  return cov;
}
export function fitShape(x, bbox, w, h, margin) {
  const [bx, by, bw, bh] = bbox, m = margin || 0;
  const s = Math.min(w * (1 - 2 * m) / bw, h * (1 - 2 * m) / bh);
  x.setTransform(s, 0, 0, s, (w - bw * s) / 2 - bx * s, (h - bh * s) / 2 - by * s);
}
// Umrissbox einer Zeichenfunktion ermitteln (Formen im 100er-Raster)
export function measureBBox(draw, size = 100, pad = 50) {
  const S = 200, k = S / (size + 2 * pad), c = canvas(S, S), x = ctx2d(c, { willReadFrequently: true });
  x.setTransform(k, 0, 0, k, pad * k, pad * k); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; draw(x);
  const d = x.getImageData(0, 0, S, S).data; free(c);
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) if (d[(y * S + xx) * 4 + 3] > 20) {
    if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return [0, 0, size, size];
  return [x0 / k - pad, y0 / k - pad, (x1 - x0 + 1) / k, (y1 - y0 + 1) / k];
}

export function buildIndex(L) {
  L.rowIdx = Array.from({ length: L.rows }, () => []);
  L.tiles.forEach((t, i) => { for (let y = t.y; y < t.y + t.s && y < L.rows; y++) L.rowIdx[y].push(i); });
  L.stamp = new Uint32Array(L.tiles.length); L.pass = 0;
  return L;
}

/* Geometrie in Pixeln für eine Zellgröße. Fugen außen = Fugen innen. */
export function geometry(L, cellPx) {
  const gapPx = Math.round(L.gap * cellPx);
  return { cellPx, gapPx, W: L.cols * cellPx + gapPx, H: L.rows * cellPx + gapPx };
}

function rrect(x, X, Y, w, h, r) {
  if (r <= 0) { x.rect(X, Y, w, h); return; }
  r = Math.min(r, w / 2, h / 2);
  x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}

/* Zeichnet den Bereich (rx, ry, rw, rh) in Ausgabepixeln mit Faktor scale auf ctx.
   getImg(t, px) liefert die Bitmap zum Bibliotheksindex, passend für px Bildschirmpixel.
   opts.tx/ty: eigener Versatz (Bildschirm = Ausgabe · scale + t), sonst liegt rx/ry links oben. */
export function render(ctx, L, geo, getImg, rx, ry, rw, rh, scale = 1, opts = {}) {
  const { cellPx, gapPx } = geo, half = gapPx / 2;
  const ox = opts.tx != null ? opts.tx : -rx * scale, oy = opts.ty != null ? opts.ty : -ry * scale;
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = opts.fast ? 'low' : 'high';
  ctx.fillStyle = L.bg; ctx.fillRect(rx, ry, rw, rh);

  const ov = L.overlay, rad = L.radius;
  const grow = opts.seamless && gapPx === 0 && rad === 0 ? 0.6 / scale : 0;
  const r0 = Math.max(0, Math.floor((ry - half) / cellPx)), r1 = Math.min(L.rows - 1, Math.floor((ry + rh - half) / cellPx));
  const c0 = (rx - half) / cellPx - 2, c1 = (rx + rw - half) / cellPx + 1;
  const pass = ++L.pass;
  const gx = ov ? ov.crop.sw / (L.cols * cellPx) : 0, gy = ov ? ov.crop.sh / (L.rows * cellPx) : 0;

  for (let row = r0; row <= r1; row++) {
    const list = L.rowIdx[row];
    for (let k = 0; k < list.length; k++) {
      const i = list[k], t = L.tiles[i];
      if (t.x + t.s < c0 || t.x > c1 || L.stamp[i] === pass) continue;
      L.stamp[i] = pass;
      const X = half + t.x * cellPx + half, Y = half + t.y * cellPx + half, S = t.s * cellPx - gapPx;
      if (S <= 0) continue;
      const img = getImg(t.t, S * scale); if (!img) continue;
      const clip = rad > 0 || ov;
      if (clip) { ctx.save(); ctx.beginPath(); rrect(ctx, X, Y, S, S, rad * S); ctx.clip(); }
      ctx.drawImage(img, X - grow, Y - grow, S + 2 * grow, S + 2 * grow);
      if (ov) {
        const sx = ov.crop.sx + (X - half) * gx, sy = ov.crop.sy + (Y - half) * gy, sw = S * gx, sh = S * gy;
        if (ov.color > 0) {
          ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = ov.color;
          ctx.drawImage(ov.img, sx, sy, sw, sh, X, Y, S, S);
        }
        if (ov.alpha > 0) {
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = ov.alpha;
          ctx.drawImage(ov.img, sx, sy, sw, sh, X, Y, S, S);
        }
      }
      if (clip) ctx.restore();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
