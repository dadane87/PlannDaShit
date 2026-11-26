import * as E from './engine.js';
import { SHAPES, textShape, imageMask } from './shapes.js';

/* ── Hilfen ─────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : String(c));
  return n;
}
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const nf = (v, d = 0) => v.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fileKey = (f) => [f.name, f.size, f.lastModified].join('|');
const toBlob = (c, type, q) => new Promise((res) => c.toBlob ? c.toBlob(res, type, q) : res(null));
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms);
}

/* ── Einstellungen ─────────────────────────────────── */
const FORMATS = [['auto', 'Passend'], ['1:1', 'Quadrat 1:1'], ['4:5', 'Hoch 4:5'], ['3:4', 'Hoch 3:4'], ['2:3', 'Hoch 2:3'],
  ['9:16', 'Hoch 9:16'], ['a-h', 'DIN A hoch'], ['5:4', 'Quer 5:4'], ['4:3', 'Quer 4:3'], ['3:2', 'Quer 3:2'], ['16:9', 'Quer 16:9'], ['a-q', 'DIN A quer']];
const aspectOf = (f) => f === 'a-h' ? Math.SQRT1_2 : f === 'a-q' ? Math.SQRT2 : (([w, hh]) => w / hh)(f.split(':').map(Number));
const RES = [[3000, '3K'], [6000, '6K'], [9000, '9K'], [12000, '12K']];
const BGS = ['#ffffff', '#f3ede2', '#8e8e93', '#1c1c1e', '#000000'];
const DEF = {
  mode: 'raster', res: 6000, seed: 1,
  raster: { format: 'auto', autoCols: true, cols: 8, sort: 'zufall', big: 0, gap: 0.04, radius: 0, bg: '#ffffff' },
  form: { format: 'auto', shape: 'herz', text: 'LOVE', cols: 36, sort: 'zufall', threshold: 0.5, invert: false, gap: 0.06, radius: 0.12, bg: '#ffffff' },
  haupt: { format: 'auto', cols: 60, variety: 0.5, spacing: 2, color: 0.3, alpha: 0.12, gap: 0, radius: 0, bg: '#ffffff' },
};
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('mosaik-settings') || '{}'); } catch (e) {}
  const o = { ...DEF, ...s };
  for (const m of ['raster', 'form', 'haupt']) o[m] = { ...DEF[m], ...(s[m] || {}) };
  return o;
}
const S = loadSettings();
function save() { try { localStorage.setItem('mosaik-settings', JSON.stringify(S)); } catch (e) {} }

/* ── Speicher (IndexedDB) ──────────────────────────── */
const idb = {
  db: null,
  open() {
    if (this.db !== null) return Promise.resolve(this.db);
    return new Promise((res) => {
      try {
        const r = indexedDB.open('mosaik', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('tiles', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
        r.onsuccess = () => res(this.db = r.result);
        r.onerror = () => res(this.db = false);
      } catch (e) { res(this.db = false); }
    });
  },
  async run(store, mode, fn) {
    const db = await this.open(); if (!db) return null;
    return new Promise((res) => {
      try {
        const t = db.transaction(store, mode), req = fn(t.objectStore(store));
        t.oncomplete = () => res(req && 'result' in req ? req.result : null);
        t.onerror = t.onabort = () => res(null);
      } catch (e) { res(null); }
    });
  },
  putTile(t) {
    return this.run('tiles', 'readwrite', (s) => s.put({ id: t.id, key: t.key, order: t.order, size: t.size, blob: t.blob,
      feat: Array.from(t.feat), rgb: t.rgb, hue: t.hue, sat: t.sat, light: t.light, lum: t.lum }));
  },
  delTile(id) { return this.run('tiles', 'readwrite', (s) => s.delete(id)); },
  clearTiles() { return this.run('tiles', 'readwrite', (s) => s.clear()); },
  allTiles() { return this.run('tiles', 'readonly', (s) => s.getAll()); },
  setMeta(k, v) { return this.run('meta', 'readwrite', (s) => v == null ? s.delete(k) : s.put(v, k)); },
  getMeta(k) { return this.run('meta', 'readonly', (s) => s.get(k)); },
};

/* ── Bibliothek ────────────────────────────────────── */
const lib = [];             // Kacheln: {id,key,size,bmp,blob,feat,rgb,hue,sat,light,lum,file?,demo?}
let libVer = 0, featFlat = null, featVer = -1, orderCounter = 0;
let target = null, targetVer = 0;   // Hauptbild {bmp,w,h,blob,demo}
let mask = null, maskVer = 0;       // eigenes Formbild {img,w,h,blob}

function libFeat() {
  if (featVer !== libVer) {
    featFlat = new Float32Array(lib.length * E.F);
    lib.forEach((t, i) => featFlat.set(t.feat, i * E.F));
    featVer = libVer;
  }
  return featFlat;
}
function thumbURL(t) { if (!t.url && t.blob) t.url = URL.createObjectURL(t.blob); return t.url || ''; }

async function decode(blob) {
  const url = URL.createObjectURL(blob), img = new Image();
  img.decoding = 'async'; img.src = url;
  try { await img.decode(); } catch (e) {
    await new Promise((res, rej) => {
      if (img.complete && img.naturalWidth) return res();
      img.onload = res; img.onerror = () => rej(new Error('Bild nicht lesbar'));
    });
  }
  if (!img.naturalWidth) { URL.revokeObjectURL(url); throw new Error('Bild nicht lesbar'); }
  return { img, w: img.naturalWidth, h: img.naturalHeight, done() { URL.revokeObjectURL(url); img.src = ''; } };
}
function squareOf(w, hh) { const s = Math.min(w, hh); return { sx: (w - s) / 2, sy: hh > w ? (hh - s) * 0.38 : (hh - s) / 2, s }; }
async function toBitmap(c) { try { const b = await createImageBitmap(c); E.free(c); return b; } catch (e) { return c; } }

async function tileFromCanvas(c, size, extra) {
  const f = E.tileFeatures(c, size);
  const blob = await toBlob(c, 'image/jpeg', 0.86);
  const bmp = await toBitmap(c);
  return { id: uid(), size, bmp, blob, url: null, order: orderCounter++, ...f, ...extra };
}
async function tileFromFile(file, size) {
  const d = await decode(file);
  try {
    const { sx, sy, s } = squareOf(d.w, d.h), T = Math.max(16, Math.min(size, Math.round(s)));
    return await tileFromCanvas(E.resample(d.img, sx, sy, s, s, T, T), T, { file, key: fileKey(file) });
  } finally { d.done(); }
}

async function addFiles(fileList) {
  let files = [...fileList].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?|avif)$/i.test(f.name));
  if (!files.length) return;
  if (lib.length && lib[0].demo) clearLibrary(true);
  const have = new Set(lib.map((t) => t.key));
  files = files.filter((f) => !have.has(fileKey(f)));
  if (!files.length) { toast('Diese Fotos sind schon dabei.'); return; }
  const total = lib.length + files.length;
  const size = total <= 200 ? 320 : total <= 500 ? 256 : total <= 1000 ? 192 : 144;
  const P = progressModal('Fotos werden vorbereitet', `${files.length} Fotos werden verkleinert und nach Farben analysiert.`);
  const out = new Array(files.length); let next = 0, done = 0, failed = 0;
  async function worker() {
    while (next < files.length && !P.cancelled) {
      const i = next++;
      try { out[i] = await tileFromFile(files[i], size); } catch (e) { failed++; }
      done++; P.set(done / files.length, `${nf(done)} von ${nf(files.length)}`);
    }
  }
  await Promise.all([worker(), worker()]);
  const added = out.filter(Boolean);
  for (const t of added) { lib.push(t); idb.putTile(t); }
  libVer++;
  P.close();
  if (failed) toast(`${failed} Foto${failed > 1 ? 's' : ''} konnte${failed > 1 ? 'n' : ''} nicht gelesen werden.`);
  else if (P.cancelled) toast(`Abgebrochen. ${added.length} Fotos übernommen.`);
  refresh();
}

function removeTile(t) {
  const i = lib.indexOf(t); if (i < 0) return;
  lib.splice(i, 1); libVer++;
  if (t.url) URL.revokeObjectURL(t.url);
  if (t.bmp && t.bmp.close) t.bmp.close();
  freeMips(t);
  if (!t.demo) idb.delTile(t.id);
}
function clearLibrary(silent) {
  for (const t of lib) { if (t.url) URL.revokeObjectURL(t.url); if (t.bmp && t.bmp.close) t.bmp.close(); freeMips(t); }
  const wasDemo = lib.length && lib[0].demo;
  lib.length = 0; libVer++;
  if (!wasDemo) idb.clearTiles();
  if (target && target.demo) { target = null; targetVer++; }
  if (!silent) refresh();
}

async function restore() {
  const rows = await idb.allTiles();
  if (rows && rows.length) {
    rows.sort((a, b) => a.order - b.order);
    orderCounter = rows[rows.length - 1].order + 1;
    const out = new Array(rows.length); let next = 0;
    const work = async () => {
      while (next < rows.length) {
        const i = next++, r = rows[i];
        try {
          let bmp;
          try { bmp = await createImageBitmap(r.blob); } catch (e) {
            const d = await decode(r.blob); const c = E.canvas(d.w, d.h); E.ctx2d(c).drawImage(d.img, 0, 0); d.done(); bmp = c;
          }
          out[i] = { ...r, feat: Float32Array.from(r.feat), bmp, url: null };
        } catch (e) {}
      }
    };
    await Promise.all([work(), work(), work(), work()]);
    lib.push(...out.filter(Boolean)); libVer++;
  }
  const tb = await idb.getMeta('target');
  if (tb) { try { await setTarget(tb, false, true); } catch (e) {} }
  const mb = await idb.getMeta('mask');
  if (mb) { try { await setMask(mb, true); } catch (e) {} }
}

/* Hauptbild und Formbild */
async function setTarget(blob, demo, restoring) {
  const d = await decode(blob);
  try {
    const k = Math.min(1, 3072 / Math.max(d.w, d.h)), w = Math.round(d.w * k), hh = Math.round(d.h * k);
    const c = E.resample(d.img, 0, 0, d.w, d.h, w, hh);
    const b = restoring ? blob : await toBlob(c, 'image/jpeg', 0.9);
    if (target && target.url) URL.revokeObjectURL(target.url);
    target = { bmp: await toBitmap(c), w, h: hh, blob: b, demo: !!demo, url: null };
    targetVer++;
    if (!demo && !restoring) idb.setMeta('target', b);
  } finally { d.done(); }
}
async function setMask(blob, restoring) {
  const d = await decode(blob);
  try {
    const k = Math.min(1, 1200 / Math.max(d.w, d.h)), w = Math.round(d.w * k), hh = Math.round(d.h * k);
    const c = E.canvas(w, hh); E.ctx2d(c).drawImage(d.img, 0, 0, w, hh);
    const b = restoring ? blob : await toBlob(c, 'image/png');
    if (mask && mask.url) URL.revokeObjectURL(mask.url);
    mask = { img: c, w, h: hh, blob: b, url: null }; maskVer++;
    if (!restoring) idb.setMeta('mask', b);
  } finally { d.done(); }
}

/* ── Beispielfotos ─────────────────────────────────── */
function demoPhoto(r, size) {
  const c = E.canvas(size, size), x = E.ctx2d(c);
  const hue = r() * 360, hue2 = (hue + 20 + r() * 90) % 360;
  const sat = r() < 0.15 ? r() * 15 : 35 + r() * 60, li = 8 + r() * 84;
  const g = x.createLinearGradient(0, 0, size * r(), size);
  g.addColorStop(0, `hsl(${hue},${sat}%,${li}%)`);
  g.addColorStop(1, `hsl(${hue2},${sat}%,${Math.max(5, Math.min(95, li + (r() - 0.5) * 40))}%)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const kind = r();
  if (kind < 0.4) {
    for (let i = 0, n = 2 + r() * 5; i < n; i++) {
      x.fillStyle = `hsla(${(hue + r() * 80 - 40 + 360) % 360},${sat}%,${Math.min(95, li + (r() - 0.4) * 50)}%,${0.35 + r() * 0.5})`;
      x.beginPath(); x.arc(r() * size, r() * size, size * (0.08 + r() * 0.3), 0, 7); x.fill();
    }
  } else if (kind < 0.75) {
    const hz = size * (0.45 + r() * 0.3);
    x.fillStyle = `hsl(${(hue + 180) % 360},${sat * 0.7}%,${Math.max(4, li - 25)}%)`;
    x.beginPath(); x.moveTo(0, size); x.lineTo(0, hz);
    for (let i = 1; i <= 6; i++) x.lineTo(size * i / 6, hz + (r() - 0.5) * size * 0.25);
    x.lineTo(size, size); x.fill();
    x.fillStyle = `hsla(50,100%,${80 + r() * 15}%,.85)`; x.beginPath(); x.arc(size * r(), hz * 0.5 * r() + size * 0.1, size * 0.07, 0, 7); x.fill();
  } else {
    x.save(); x.translate(size / 2, size / 2); x.rotate(r() * Math.PI);
    for (let i = -size; i < size; i += size / 7) {
      x.fillStyle = `hsla(${(hue2 + i) % 360},${sat}%,${Math.min(95, li + (r() - 0.5) * 30)}%,.55)`;
      x.fillRect(i, -size, size / 14, size * 2);
    }
    x.restore();
  }
  return c;
}
function demoTarget() {
  const W = 1600, H = 1200, c = E.canvas(W, H), x = E.ctx2d(c);
  const sky = x.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#141e5c'); sky.addColorStop(0.45, '#7a3f8f'); sky.addColorStop(0.8, '#f0743a'); sky.addColorStop(1, '#ffcf7a');
  x.fillStyle = sky; x.fillRect(0, 0, W, H * 0.62);
  const glow = x.createRadialGradient(1050, 650, 40, 1050, 650, 420);
  glow.addColorStop(0, 'rgba(255,245,200,1)'); glow.addColorStop(0.25, 'rgba(255,220,140,.8)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(1050, 650, 120, 0, 7); x.fill();
  x.fillStyle = '#3b1f4f'; x.beginPath(); x.moveTo(0, 760);
  [[160, 520], [330, 640], [520, 430], [760, 690], [900, 620], [1180, 740], [1380, 560], [1600, 700]].forEach(([a, b]) => x.lineTo(a, b));
  x.lineTo(1600, 760); x.fill();
  x.fillStyle = '#25123a'; x.beginPath(); x.moveTo(0, 760);
  [[220, 650], [480, 740], [700, 670], [1000, 760]].forEach(([a, b]) => x.lineTo(a, b)); x.lineTo(1600, 760); x.fill();
  const sea = x.createLinearGradient(0, 760, 0, H);
  sea.addColorStop(0, '#d9764a'); sea.addColorStop(0.3, '#6a3a6e'); sea.addColorStop(1, '#0e1540');
  x.fillStyle = sea; x.fillRect(0, 760, W, H - 760);
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(255,230,170,${0.55 - i * 0.02})`;
    const w = 240 - i * 7; x.fillRect(1050 - w / 2 + Math.sin(i) * 20, 780 + i * 16, w, 6);
  }
  x.fillStyle = '#120a20'; x.beginPath(); x.moveTo(380, 880); x.lineTo(560, 880); x.lineTo(530, 905); x.lineTo(405, 905); x.fill();
  x.beginPath(); x.moveTo(470, 875); x.lineTo(470, 700); x.lineTo(545, 870); x.fill();
  return c;
}
async function loadDemo() {
  clearLibrary(true);
  const r = E.rng(4242), n = 260, size = 192;
  const P = progressModal('Beispielfotos', 'Es werden farbige Beispielbilder erzeugt.');
  for (let i = 0; i < n; i++) {
    const t = await tileFromCanvas(demoPhoto(r, size), size, { demo: true, key: 'demo' + i });
    lib.push(t);
    if (i % 20 === 0) { P.set(i / n, `${i} von ${n}`); await frame(); }
  }
  libVer++;
  if (!target) await setTarget(await toBlob(demoTarget(), 'image/jpeg', 0.92), true);
  P.close();
  refresh();
}

/* ── Layout berechnen ──────────────────────────────── */
let L = null, buildTok = 0, building = false, emptyMsg = '';
const cache = { tfKey: '', tf: null, mKey: '', match: null, maskKey: '', maskSrc: null };

function shapeSource() {
  const m = S.form;
  if (m.shape === 'text') return textShape(m.text);
  if (m.shape === 'bild') {
    if (!mask) return null;
    const k = [maskVer, m.threshold, m.invert].join();
    if (cache.maskKey !== k) { cache.maskSrc = imageMask(mask.img, { threshold: m.threshold, invert: m.invert }); cache.maskKey = k; }
    return cache.maskSrc;
  }
  const sh = SHAPES.find((s) => s.id === m.shape) || SHAPES[0];
  if (!sh.bbox) sh.bbox = E.measureBBox(sh.draw);
  return sh;
}

let schedT = 0;
function schedule(delay) {
  clearTimeout(schedT);
  if (delay == null) delay = S.mode === 'haupt' ? 160 : 0;
  schedT = setTimeout(() => requestAnimationFrame(build), delay);
}

async function build() {
  const tok = ++buildTok, mode = S.mode, m = S[mode];
  const r = E.rng(S.seed * 7919 + mode.length);
  emptyMsg = '';
  let tiles, cols, rows, overlay = null;
  if (!lib.length) { L = null; return drawPreview(); }

  if (mode === 'raster') {
    const n = lib.length, share = [0, 0.12, 0.3][m.big] || 0;
    if (m.autoCols) {
      const area = n / (1 - 0.75 * share);
      if (m.format === 'auto') { cols = Math.max(1, Math.ceil(Math.sqrt(area))); rows = Math.max(1, Math.ceil(area / cols)); }
      else { const A = aspectOf(m.format); cols = Math.max(1, Math.round(Math.sqrt(area * A))); rows = Math.max(1, Math.round(cols / A)); }
      m.cols = Math.min(80, cols);
    } else {
      cols = m.cols; rows = Math.max(1, Math.round(cols / (m.format === 'auto' ? 1 : aspectOf(m.format))));
    }
    const cells = E.orderCells(E.rasterCells(cols, rows, share, r), m.sort);
    const picks = E.orderedPicks(lib, cells.length, m.sort, r);
    tiles = cells.map((c, i) => ({ x: c.x, y: c.y, s: c.s, t: picks[i] }));
    if (cells.length > n) E.spreadDuplicates({ cols, rows, tiles }, r, m.sort !== 'zufall');
  } else if (mode === 'form') {
    const src = shapeSource();
    if (!src) { L = null; emptyMsg = 'Wähle unten ein Bild, dessen Umriss die Form bestimmt.'; return drawPreview(); }
    const A = m.format === 'auto' ? Math.max(0.2, Math.min(5, src.bbox[2] / src.bbox[3])) : aspectOf(m.format);
    cols = m.cols; rows = Math.max(1, Math.round(cols / A));
    const cov = E.shapeCoverage(src, cols, rows, 0.035), cells = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (cov[y * cols + x] >= 0.5) cells.push({ x, y, s: 1 });
    if (!cells.length) { L = null; emptyMsg = 'Die Form ist bei dieser Kachelzahl zu klein. Erhöhe „Kacheln pro Reihe“.'; return drawPreview(); }
    const ord = E.orderCells(cells, m.sort);
    const picks = E.orderedPicks(lib, ord.length, m.sort, r);
    tiles = ord.map((c, i) => ({ x: c.x, y: c.y, s: 1, t: picks[i] }));
    if (ord.length > lib.length) E.spreadDuplicates({ cols, rows, tiles }, r, m.sort !== 'zufall');
  } else {
    if (!target) { L = null; emptyMsg = 'Wähle unten das Hauptbild, das aus deinen Fotos entstehen soll.'; return drawPreview(); }
    const A = m.format === 'auto' ? target.w / target.h : aspectOf(m.format);
    cols = m.cols; rows = Math.max(1, Math.round(cols / A));
    const crop = E.cropFor(target.w, target.h, cols / rows);
    const tk = [targetVer, cols, rows].join();
    if (cache.tfKey !== tk) { cache.tf = E.targetFeatures(target.bmp, crop, cols, rows); cache.tfKey = tk; }
    const mk = [tk, libVer, m.variety, m.spacing, S.seed].join();
    if (cache.mKey !== mk) {
      busy(true, 'Suche passende Fotos …');
      const res = await E.matchTiles(libFeat(), lib.length, cache.tf, cols, rows,
        { variety: m.variety, spacing: m.spacing, seed: S.seed },
        async (p) => { if (tok !== buildTok) return false; busy(true, `Suche passende Fotos … ${Math.round(p * 100)} %`); await frame(); return tok === buildTok; });
      if (!res || tok !== buildTok) return;
      cache.match = res; cache.mKey = mk;
    }
    tiles = new Array(cols * rows);
    for (let i = 0; i < tiles.length; i++) tiles[i] = { x: i % cols, y: (i / cols) | 0, s: 1, t: cache.match[i] };
    overlay = { img: target.bmp, crop, color: m.color, alpha: m.alpha };
  }
  if (tok !== buildTok) return;
  L = E.buildIndex({ cols, rows, tiles, gap: m.gap, radius: m.radius, bg: m.bg, overlay, mode });
  busy(false);
  drawPreview();
  if (mode === 'raster' && m.autoCols) syncColsSlider();
}

function busy(on, text) {
  const b = $('#pvBusy'); b.hidden = !on; if (text) b.lastElementChild.textContent = text;
}

/* ── Vorschau ──────────────────────────────────────── */
let pvGeo = null;
// Verkleinerte Stufen je Kachel, damit stark verkleinerte Kacheln nicht flimmern
const LEVELS = [16, 32, 64, 128];
function mip(t, px) {
  if (!t) return null;
  const lvl = LEVELS.find((l) => l >= px * 1.15);
  if (!lvl || lvl * 1.6 >= t.size) return t.bmp;
  const m = t.mips || (t.mips = {});
  if (!m[lvl]) {
    const src = m[lvl * 2] || t.bmp, ss = m[lvl * 2] ? lvl * 2 : t.size;
    m[lvl] = E.resample(src, 0, 0, ss, ss, lvl, lvl);
  }
  return m[lvl];
}
function freeMips(t) { if (t.mips) { Object.values(t.mips).forEach(E.free); t.mips = null; } }
const thumb = (t, px) => mip(lib[t], px);
function drawPreview() {
  const cv = $('#pv'), st = $('#stage'), em = $('#pvEmpty');
  busy(false);
  if (!L) {
    cv.hidden = true; $('#zoomBtn').hidden = true;
    em.hidden = !emptyMsg; em.textContent = emptyMsg;
    $('#pvInfo').textContent = ''; updateOut(); return;
  }
  cv.hidden = false; em.hidden = true; $('#zoomBtn').hidden = false;
  const sw = st.clientWidth - 28, sh = st.clientHeight - 28;
  const uW = L.cols + L.gap, uH = L.rows + L.gap, fit = Math.min(sw / uW, sh / uH);
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  let cell = Math.max(1, Math.floor(fit * dpr));
  while (cell > 1 && Math.max(uW, uH) * cell > 3600) cell--;
  const geo = E.geometry(L, cell);
  cv.width = geo.W; cv.height = geo.H;
  const k = fit / cell * (uW * cell / geo.W);
  cv.style.width = (geo.W * k) + 'px'; cv.style.height = (geo.H * k) + 'px';
  E.render(E.ctx2d(cv), L, geo, thumb, 0, 0, geo.W, geo.H, 1);
  pvGeo = geo;
  $('#pvInfo').textContent = infoText();
  updateOut();
}
function infoText() {
  const used = new Set(L.tiles.map((t) => t.t)).size, n = L.tiles.length;
  if (S.mode === 'raster') {
    const rep = n - used;
    return `${L.cols} × ${L.rows} Felder · ${nf(used)} Fotos` + (rep > 0 ? ` · ${nf(rep)} doppelt` : lib.length > n ? ` · ${nf(lib.length - n)} nicht genutzt` : '');
  }
  if (S.mode === 'form') return `${nf(n)} Kacheln in der Form · ${nf(used)} verschiedene Fotos` + (n > used ? ` · je ca. ${nf(n / used, 1)}×` : '');
  return `${L.cols} × ${L.rows} = ${nf(n)} Kacheln · ${nf(used)} verschiedene Fotos`;
}

/* ── Ausgabegröße ──────────────────────────────────── */
function outGeo() {
  if (!L) return null;
  const cell = Math.max(4, Math.floor(S.res / (Math.max(L.cols, L.rows) + L.gap)));
  return E.geometry(L, cell);
}
function updateOut() {
  const f = $('#outFacts'), note = $('#outNote'), go = $('#goBtn');
  if (!f) return;
  const g = outGeo();
  go.disabled = !g;
  if (!g) { f.textContent = '–'; note.textContent = ''; return; }
  const mp = g.W * g.H / 1e6;
  f.innerHTML = `<b>${nf(g.W)} × ${nf(g.H)} px</b> · ${nf(mp, mp < 10 ? 1 : 0)} MP`;
  const cm = (px) => nf(px / 300 * 2.54, 0);
  let t = `Druckgröße bei 300 dpi: ${cm(g.W)} × ${cm(g.H)} cm · Kachel ${nf(g.cellPx)} px.`;
  const need = g.cellPx * L.tiles.reduce((a, x) => Math.max(a, x.s), 1);
  const small = lib.filter((x) => !x.demo && !x.file && x.size < need * 0.8).length;
  if (small) t += ` Hinweis: ${small} Fotos stammen aus einer früheren Sitzung und liegen nur in ${lib.find((x) => !x.file).size} px vor. Für volle Schärfe Fotos neu hinzufügen.`;
  note.textContent = t;
}

/* ── Bedienelemente ────────────────────────────────── */
function setPct(inp) { const p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty('--p', p + '%'); }
function slider(label, o) {
  const val = h('span', { class: 'rv' }, o.fmt(o.get()));
  const inp = h('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, value: o.get(), 'aria-label': label });
  setPct(inp);
  inp.addEventListener('input', () => { o.set(+inp.value); val.textContent = o.fmt(+inp.value); setPct(inp); save(); schedule(); });
  const row = h('div', { class: 'row col' }, h('div', { class: 'top' }, h('span', { class: 'rl' }, label), val), inp);
  if (o.sub) row.append(h('div', { class: 'sub' }, o.sub));
  row._inp = inp; row._val = val;
  return row;
}
function segment(label, opts, get, set) {
  const seg = h('div', { class: 'seg' });
  const paint = () => [...seg.children].forEach((b) => b.classList.toggle('on', String(b.dataset.v) === String(get())));
  for (const [v, t] of opts) seg.append(h('button', { 'data-v': v, onclick: () => { set(v); paint(); save(); schedule(); } }, t));
  paint();
  return label ? h('div', { class: 'row col' }, h('span', { class: 'rl' }, label), seg) : h('div', { class: 'row' }, seg);
}
function select(label, opts, get, set) {
  const s = h('select', { 'aria-label': label, onchange: () => { set(s.value); save(); schedule(); } }, opts.map(([v, t]) => h('option', { value: v }, t)));
  s.value = get();
  return h('div', { class: 'row' }, h('span', { class: 'rl' }, label), s);
}
function toggle(label, get, set, sub) {
  const inp = h('input', { type: 'checkbox', role: 'switch', 'aria-label': label });
  inp.checked = !!get();
  inp.addEventListener('change', () => { set(inp.checked); save(); schedule(); });
  return h('div', { class: 'row' }, h('div', { class: 'rl' }, label, sub ? h('div', { class: 'sub' }, sub) : null), h('label', { class: 'sw' }, inp, h('span')));
}
function link(label, onclick, right) {
  return h('div', { class: 'row link', role: 'button', tabindex: 0, onclick }, h('span', { class: 'rl' }, label), right || h('span', { class: 'chev' }, '›'));
}
const pct = (v) => Math.round(v * 100) + ' %';

const DESC = {
  raster: 'Deine Fotos als klassisches Mosaik-Raster, zufällig verteilt, als Farbverlauf oder nach Helligkeit sortiert.',
  form: 'Die Fotos füllen eine Form: Herz, Stern, Text, Zahl oder ein eigenes Bild als Umriss.',
  haupt: 'Aus vielen kleinen Fotos entsteht ein großes Bild. Für jede Kachel wird das Foto mit den passendsten Farben gewählt.',
};

let colsRow = null;
function syncColsSlider() {
  if (!colsRow) return;
  colsRow._inp.value = S.raster.cols; colsRow._val.textContent = S.raster.cols; setPct(colsRow._inp);
}

function buildModeUI() {
  const g = $('#gMode'), m = S[S.mode], note = $('#gModeNote');
  g.textContent = ''; note.textContent = ''; colsRow = null;
  $('#modeDesc').textContent = DESC[S.mode];
  [...$('#modeSeg').children].forEach((b) => b.classList.toggle('on', b.dataset.m === S.mode));
  const sorts = [['zufall', 'Zufall'], ['farbe', 'Farbverlauf'], ['hell', 'Hell → Dunkel']];

  if (S.mode === 'raster') {
    g.append(segment('Anordnung', [...sorts, ['auswahl', 'Auswahl']], () => m.sort, (v) => m.sort = v));
    const auto = toggle('Spalten automatisch', () => m.autoCols, (v) => m.autoCols = v, 'So viele Felder wie Fotos');
    g.append(auto);
    colsRow = slider('Spalten', { min: 2, max: 80, get: () => m.cols, set: (v) => { m.cols = v; if (m.autoCols) { m.autoCols = false; $('input', auto).checked = false; } }, fmt: (v) => v });
    g.append(colsRow);
    g.append(segment('Große Kacheln', [[0, 'Keine'], [1, 'Einige'], [2, 'Viele']], () => m.big, (v) => m.big = v));
    g.append(link('Neu mischen', reshuffle, h('span', { class: 'chev' }, '⟳')));
  } else if (S.mode === 'form') {
    const pick = h('div', { class: 'shapes' });
    const btn = (id, name, icon) => {
      const b = h('button', { class: m.shape === id ? 'on' : '', onclick: () => { m.shape = id; save(); buildModeUI(); schedule(); if (id === 'bild' && !mask) $('#inMask').click(); } }, icon, name);
      pick.append(b);
    };
    btn('text', 'Text', h('span', { class: 'ic' }, 'Aa'));
    btn('bild', 'Eigenes', h('span', { class: 'ic', html: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M5 17l5-5 3 3 2-2 4 4"/></svg>' }));
    for (const s of SHAPES) btn(s.id, s.name, shapeIcon(s));
    g.append(h('div', { class: 'row col' }, h('span', { class: 'rl' }, 'Form'), pick));
    requestAnimationFrame(() => { const on = $('.on', pick); if (on) pick.scrollLeft = on.offsetLeft - pick.clientWidth / 2 + 32; });
    if (m.shape === 'text') {
      const ta = h('textarea', { rows: Math.min(3, (m.text.match(/\n/g) || []).length + 1), maxlength: 40, autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Text' });
      ta.value = m.text;
      ta.addEventListener('input', () => { m.text = ta.value; ta.rows = Math.min(3, (ta.value.match(/\n/g) || []).length + 1); save(); schedule(120); });
      g.append(h('div', { class: 'row col' }, h('span', { class: 'rl' }, 'Text, Name oder Zahl'), ta, h('div', { class: 'sub' }, 'Zeilenumbruch für mehrere Zeilen. Kurze Wörter wirken am besten.')));
    }
    if (m.shape === 'bild') {
      const im = mask ? h('img', { src: mask.url || (mask.url = URL.createObjectURL(mask.blob)), alt: '' }) : h('span', { class: 'ph' }, '＋');
      g.append(h('div', { class: 'row link', onclick: () => $('#inMask').click() }, h('div', { class: 'thumb-row rl' }, im,
        h('div', null, mask ? 'Anderes Bild wählen' : 'Bild für die Form wählen', h('div', { class: 'sub' }, 'Logo, Silhouette oder Zeichnung. Dunkle oder deckende Flächen werden zur Form.'))), h('span', { class: 'chev' }, '›')));
      const ms = shapeSource();
      if (mask && ms && !ms.useAlpha) g.append(slider('Schwelle', { min: 0.1, max: 0.9, step: 0.01, get: () => m.threshold, set: (v) => m.threshold = v, fmt: pct, sub: 'Ab welcher Helligkeit ein Bereich zur Form gehört' }));
      if (mask) g.append(toggle('Umkehren', () => m.invert, (v) => m.invert = v, 'Hintergrund statt Motiv füllen'));
    }
    g.append(slider('Kacheln pro Reihe', { min: 8, max: 140, get: () => m.cols, set: (v) => m.cols = v, fmt: (v) => v, sub: 'Mehr Kacheln zeichnen die Form genauer' }));
    g.append(segment('Anordnung', sorts, () => m.sort, (v) => m.sort = v));
    g.append(link('Neu mischen', reshuffle, h('span', { class: 'chev' }, '⟳')));
  } else {
    const im = target ? h('img', { src: thumbURLTarget(), alt: '' }) : h('span', { class: 'ph' }, '＋');
    g.append(h('div', { class: 'row link', onclick: () => $('#inTarget').click() }, h('div', { class: 'thumb-row rl' }, im,
      h('div', null, target ? 'Anderes Hauptbild wählen' : 'Hauptbild wählen', h('div', { class: 'sub' }, target && target.demo ? 'Beispielbild' : 'Aus der Galerie: Porträt, Paar, Tier, Landschaft'))), h('span', { class: 'chev' }, '›')));
    if (lib.length) g.append(link('Eines meiner Fotos als Hauptbild', () => openLibrary(true)));
    g.append(slider('Kacheln pro Reihe', { min: 16, max: 160, get: () => m.cols, set: (v) => m.cols = v, fmt: (v) => v, sub: 'Mehr Kacheln = mehr Details im Hauptbild' }));
    g.append(slider('Vielfalt', { min: 0, max: 1, step: 0.05, get: () => m.variety, set: (v) => m.variety = v, fmt: pct, sub: 'Höher = weniger Wiederholungen, dafür etwas ungenauer' }));
    g.append(slider('Abstand gleicher Fotos', { min: 0, max: 6, get: () => m.spacing, set: (v) => m.spacing = v, fmt: (v) => v ? v + ' Kachel' + (v > 1 ? 'n' : '') : 'aus' }));
    g.append(slider('Farben angleichen', { min: 0, max: 0.8, step: 0.02, get: () => m.color, set: (v) => { m.color = v; if (L && L.overlay) L.overlay.color = v; }, fmt: pct, sub: 'Färbt die Fotos leicht im Farbton des Hauptbilds' }));
    g.append(slider('Hauptbild einblenden', { min: 0, max: 0.6, step: 0.02, get: () => m.alpha, set: (v) => { m.alpha = v; if (L && L.overlay) L.overlay.alpha = v; }, fmt: pct, sub: 'Legt das Hauptbild durchscheinend über die Kacheln' }));
    g.append(link('Neu mischen', reshuffle, h('span', { class: 'chev' }, '⟳')));
    if (lib.length < 80) note.append(h('p', { class: 'note warn' }, `Tipp: Du hast ${lib.length} Fotos. Mit 150 oder mehr Fotos wird das Hauptbild deutlich besser erkennbar.`));
  }
}
function thumbURLTarget() { if (!target.url) target.url = URL.createObjectURL(target.blob); return target.url; }
function reshuffle() { S.seed = (S.seed % 100000) + 1; save(); schedule(0); }

function shapeIcon(s) {
  const c = E.canvas(112, 112), x = E.ctx2d(c);
  if (!s.bbox) s.bbox = E.measureBBox(s.draw);
  E.fitShape(x, s.bbox, 112, 112, 0.2);
  x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--tint').trim() || '#5E5CE6';
  s.draw(x);
  return c;
}

function buildLookUI() {
  const g = $('#gLook'), m = S[S.mode];
  g.textContent = '';
  g.append(select('Format', FORMATS, () => m.format, (v) => m.format = v));
  g.append(slider('Fugen', { min: 0, max: 0.3, step: 0.01, get: () => m.gap, set: (v) => m.gap = v, fmt: (v) => v ? pct(v) : 'keine' }));
  g.append(slider('Ecken', { min: 0, max: 0.5, step: 0.01, get: () => m.radius, set: (v) => m.radius = v, fmt: (v) => v === 0 ? 'eckig' : v >= 0.5 ? 'rund' : pct(v * 2) }));
  const sw = h('div', { class: 'swatches' });
  const paint = () => [...sw.children].forEach((b) => b.classList.toggle('on', b.dataset.c === m.bg || (b.tagName === 'LABEL' && !BGS.includes(m.bg))));
  for (const c of BGS) sw.append(h('button', { 'data-c': c, style: `background:${c}`, 'aria-label': c, onclick: () => { m.bg = c; paint(); save(); schedule(); } }));
  const ci = h('input', { type: 'color', value: m.bg, 'aria-label': 'Eigene Farbe' });
  ci.addEventListener('input', () => { m.bg = ci.value; paint(); save(); schedule(); });
  sw.append(h('label', { title: 'Eigene Farbe' }, ci));
  paint();
  g.append(h('div', { class: 'row' }, h('span', { class: 'rl' }, 'Hintergrund'), sw));
}

function buildPhotosUI() {
  const g = $('#gPhotos'); g.textContent = '';
  const strip = h('div', { class: 'strip' }, lib.slice(0, 14).map((t) => h('img', { src: thumbURL(t), alt: '' })));
  const demo = lib.length && lib[0].demo;
  g.append(h('div', { class: 'row link', onclick: () => openLibrary(false) },
    h('div', { class: 'rl' }, h('div', null, `${nf(lib.length)} ${demo ? 'Beispielfotos' : 'Fotos'}`), strip), h('span', { class: 'chev' }, '›')));
  g.append(link(demo ? 'Eigene Fotos auswählen …' : 'Fotos hinzufügen …', () => $('#inPhotos').click(), h('span', { class: 'chev' }, '＋')));
  $('#libBtn').textContent = `${nf(lib.length)} Fotos`;
}

function buildOutUI() {
  const g = $('#gOut'); g.textContent = '';
  g.append(segment('Auflösung (lange Seite)', RES, () => S.res, (v) => { S.res = +v; updateOut(); }));
  g.append(h('div', { class: 'row' }, h('span', { class: 'rl' }, 'Ergebnis'), h('span', { class: 'rv', id: 'outFacts' }, '–')));
}

function refresh() {
  const has = lib.length > 0;
  $('#welcome').hidden = has; $('#work').hidden = !has; $('#libBtn').hidden = !has;
  if (!has) { drawHero(); return; }
  buildModeUI(); buildLookUI(); buildPhotosUI(); buildOutUI();
  schedule(0);
}

/* ── Bibliothek-Ansicht ────────────────────────────── */
function sheet(title, left, right, body, foot) {
  const bd = h('div', { class: 'backdrop' });
  const close = () => { bd.remove(); document.body.classList.remove('locked'); };
  const sh = h('div', { class: 'sheet' },
    h('div', { class: 'sheet-head' }, h('button', { onclick: () => (left.fn || close)(close) }, left.label), h('h3', null, title), h('button', { onclick: () => (right.fn || close)(close) }, right.label)),
    h('div', { class: 'sheet-body' }, body, foot));
  bd.append(sh);
  bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
  document.body.append(bd); document.body.classList.add('locked');
  return { close, bd };
}
function openLibrary(pickMode) {
  const grid = h('div', { class: 'libgrid' });
  let changed = false;
  for (const t of lib) {
    const cell = h('div', null, h('img', { src: thumbURL(t), alt: '', loading: 'lazy' }));
    if (pickMode) cell.addEventListener('click', async () => {
      s.close(); toast('Hauptbild wird geladen …');
      await setTarget(t.file || t.blob, false); buildModeUI(); schedule(0);
    });
    else cell.append(h('button', { 'aria-label': 'Entfernen', onclick: () => { removeTile(t); cell.remove(); changed = true; } }, '✕'));
    grid.append(cell);
  }
  const foot = pickMode ? null : h('div', { style: 'margin-top:18px' },
    h('button', { class: 'btn', style: 'color:var(--bad)', onclick: () => { if (confirm('Alle Fotos aus dem Mosaik entfernen? Die Originale in deiner Galerie bleiben erhalten.')) { s.close(); clearLibrary(false); } } }, 'Alle entfernen'));
  const done = (close) => { close(); if (changed) refresh(); };
  const s = sheet(pickMode ? 'Hauptbild wählen' : `${nf(lib.length)} Fotos`,
    { label: pickMode ? 'Abbrechen' : '', fn: done },
    { label: pickMode ? '' : 'Fertig', fn: done }, grid, foot);
  s.bd.addEventListener('click', (e) => { if (e.target === s.bd && changed) refresh(); });
}

/* ── Fortschritt / Ergebnis ────────────────────────── */
function progressModal(title, text, cancellable = true) {
  const bar = h('i'), st = h('p', { style: 'font-size:14px;margin:0 0 14px;font-variant-numeric:tabular-nums' }, ' ');
  const P = { cancelled: false };
  const cancel = cancellable ? h('button', { class: 'btn', onclick: () => { P.cancelled = true; cancel.disabled = true; cancel.textContent = 'Wird abgebrochen …'; } }, 'Abbrechen') : null;
  const box = h('div', { class: 'modal' }, h('h3', null, title), h('p', null, text), h('div', { class: 'track' }, bar), st, cancel);
  const bd = h('div', { class: 'backdrop center' }, box);
  document.body.append(bd); document.body.classList.add('locked');
  P.set = (p, s) => { bar.style.width = Math.round(p * 100) + '%'; if (s != null) st.textContent = s; };
  P.close = () => { bd.remove(); document.body.classList.remove('locked'); };
  P.box = box; P.bd = bd;
  return P;
}

/* ── Export in voller Auflösung ────────────────────── */
async function makeHires(file, px) {
  const d = await decode(file);
  try { const { sx, sy, s } = squareOf(d.w, d.h); return await toBitmap(E.resample(d.img, sx, sy, s, s, Math.min(px, Math.round(s)), Math.min(px, Math.round(s)))); }
  finally { d.done(); }
}
function workerCall(w, msg, transfer) {
  return new Promise((res, rej) => {
    w.onmessage = (e) => e.data.cmd === 'error' ? rej(new Error(e.data.message)) : res(e.data);
    w.onerror = (e) => rej(new Error(e.message || 'Fehler im Encoder'));
    w.postMessage(msg, transfer || []);
  });
}
async function exportMosaic() {
  if (!L) return;
  const Lx = L, geo = outGeo(), mode = S.mode;
  const P = progressModal('Mosaik wird erstellt', `${nf(geo.W)} × ${nf(geo.H)} Pixel (${nf(geo.W * geo.H / 1e6, 0)} MP). Bitte die App geöffnet lassen.`);
  const hires = new Map(); let worker = null;
  try {
    // 1) Fotos bei Bedarf in höherer Auflösung laden
    const span = Lx.tiles.reduce((a, t) => Math.max(a, t.s), 1), need = geo.cellPx * span;
    const used = [...new Set(Lx.tiles.map((t) => t.t))];
    const cand = used.filter((t) => lib[t].file && lib[t].size < need * 0.9);
    if (cand.length) {
      const px = Math.min(need, 2400, Math.floor(Math.sqrt(200e6 / 4 / cand.length)));
      const todo = cand.filter((t) => px > lib[t].size * 1.15);
      let next = 0, done = 0;
      const work = async () => {
        while (next < todo.length && !P.cancelled) {
          const t = todo[next++];
          try { hires.set(t, await makeHires(lib[t].file, px)); } catch (e) {}
          done++; P.set(0.25 * done / todo.length, `Fotos in voller Auflösung: ${done} von ${todo.length}`);
        }
      };
      await Promise.all([work(), work()]);
    }
    if (P.cancelled) throw new Error('abort');
    const base = hires.size ? 0.25 : 0;
    const getImg = (t, px) => hires.get(t) || mip(lib[t], px);

    // 2) Streifenweise rendern und im Worker als JPEG kodieren
    worker = new Worker('jpeg-worker.js');
    await workerCall(worker, { cmd: 'start', w: geo.W, h: geo.H, q: 92 });
    const SH = 128, CW = Math.min(geo.W, 4096);
    const cv = E.canvas(CW, SH), cx = E.ctx2d(cv, { willReadFrequently: false });
    let pending = null;
    for (let y = 0; y < geo.H; y += SH) {
      if (P.cancelled) throw new Error('abort');
      const hh = Math.min(SH, geo.H - y), buf = new Uint8ClampedArray(geo.W * hh * 4);
      for (let x = 0; x < geo.W; x += CW) {
        const w = Math.min(CW, geo.W - x);
        E.render(cx, Lx, geo, getImg, x, y, w, hh, 1);
        const d = cx.getImageData(0, 0, w, hh).data;
        if (w === geo.W) buf.set(d);
        else for (let r = 0; r < hh; r++) buf.set(d.subarray(r * w * 4, (r + 1) * w * 4), (r * geo.W + x) * 4);
      }
      if (pending) await pending;
      pending = workerCall(worker, { cmd: 'strip', buf: buf.buffer, h: hh }, [buf.buffer]);
      P.set(base + (1 - base) * Math.min(1, (y + hh) / geo.H), `Rendern und Speichern: ${Math.round((y + hh) / geo.H * 100)} %`);
    }
    await pending;
    const res = await workerCall(worker, { cmd: 'end' });
    E.free(cv);
    P.close();
    showResult(res.blob, geo, mode);
  } catch (e) {
    P.close();
    if (e.message !== 'abort') { console.error(e); alert('Das Mosaik konnte nicht erstellt werden: ' + e.message + '\nTipp: eine kleinere Auflösung wählen.'); }
  } finally {
    if (worker) worker.terminate();
    for (const b of hires.values()) if (b.close) b.close();
  }
}

function showResult(blob, geo, mode) {
  const name = `Mosaik-${{ raster: 'Raster', form: 'Form', haupt: 'Hauptbild' }[mode]}-${geo.W}x${geo.H}.jpg`;
  const file = new File([blob], name, { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const img = h('img', { class: 'res', src: $('#pv').toDataURL('image/jpeg', 0.85), alt: 'Vorschau' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const bd = h('div', { class: 'backdrop center' });
  const close = () => { bd.remove(); document.body.classList.remove('locked'); setTimeout(() => URL.revokeObjectURL(url), 60000); };
  const box = h('div', { class: 'modal' },
    h('h3', null, 'Fertig!'), img,
    h('div', { class: 'facts', html: `<b>${nf(geo.W)} × ${nf(geo.H)} px</b> · ${nf(geo.W * geo.H / 1e6, 0)} MP · ${nf(blob.size / 1048576, 1)} MB` }),
    canShare ? h('button', { class: 'btn primary', onclick: async () => {
      try { await navigator.share({ files: [file] }); } catch (e) { if (e.name !== 'AbortError') toast('Teilen nicht möglich. Bitte „Datei laden“ verwenden.'); }
    } }, 'In Fotos sichern oder teilen') : null,
    h('a', { class: 'btn' + (canShare ? '' : ' primary'), href: url, download: name, style: 'text-decoration:none' }, 'Datei laden'),
    h('button', { class: 'btn', onclick: close }, 'Schließen'),
    canShare ? h('p', { style: 'font-size:13px;margin:12px 0 0' }, 'Im Teilen-Menü auf „Bild sichern“ tippen, dann liegt das Mosaik in deiner Fotos-App.') : null);
  bd.append(box); document.body.append(bd); document.body.classList.add('locked');
}

/* ── Vollbild-Betrachter mit Zoom ──────────────────── */
const V = { s: 1, tx: 0, ty: 0, fit: 1, ptrs: new Map(), raf: 0, lastTap: 0, moved: false, pinch: null };
function openViewer() {
  if (!L || !pvGeo) return;
  const vw = $('#viewer'); vw.hidden = false; document.body.classList.add('locked');
  $('.vhint', vw).style.opacity = 1; setTimeout(() => $('.vhint', vw).style.opacity = 0, 2600);
  vResize(); vFit(); vDraw();
}
function closeViewer() { $('#viewer').hidden = true; document.body.classList.remove('locked'); }
function vResize() {
  const cv = $('#viewer canvas'), d = window.devicePixelRatio || 1;
  cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
}
function vFit() {
  const cv = $('#viewer canvas');
  V.fit = Math.min(cv.width / pvGeo.W, cv.height / pvGeo.H) * 0.94;
  V.s = V.fit; V.tx = (cv.width - pvGeo.W * V.s) / 2; V.ty = (cv.height - pvGeo.H * V.s) / 2;
}
function vMax() { const big = Math.max(...lib.slice(0, 50).map((t) => t.size)); return Math.max(V.fit * 2, big * 1.6 / pvGeo.cellPx); }
function vClamp() {
  const cv = $('#viewer canvas'), W = pvGeo.W * V.s, H = pvGeo.H * V.s, m = 0.4;
  V.tx = W < cv.width ? (cv.width - W) / 2 : Math.min(cv.width * m, Math.max(cv.width * (1 - m) - W, V.tx));
  V.ty = H < cv.height ? (cv.height - H) / 2 : Math.min(cv.height * m, Math.max(cv.height * (1 - m) - H, V.ty));
}
function vDraw(fast) {
  cancelAnimationFrame(V.raf);
  V.raf = requestAnimationFrame(() => {
    const cv = $('#viewer canvas'), x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, cv.width, cv.height);
    const rx = Math.max(0, -V.tx / V.s), ry = Math.max(0, -V.ty / V.s);
    const rw = Math.min(pvGeo.W, (cv.width - V.tx) / V.s) - rx, rh = Math.min(pvGeo.H, (cv.height - V.ty) / V.s) - ry;
    if (rw <= 0 || rh <= 0) return;
    if (pvGeo.cellPx * V.s < 14) {
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage($('#pv'), V.tx, V.ty, pvGeo.W * V.s, pvGeo.H * V.s);
    } else {
      // Ausschnitt mit Kacheln in voller Vorschau-Schärfe
      x.save(); x.beginPath(); x.rect(V.tx + rx * V.s, V.ty + ry * V.s, rw * V.s, rh * V.s); x.clip();
      E.render(x, L, pvGeo, thumb, rx, ry, rw, rh, V.s, { seamless: true, fast, tx: V.tx, ty: V.ty });
      x.restore();
    }
  });
}
function vZoomAt(f, px, py) {
  const ns = Math.max(V.fit * 0.8, Math.min(vMax(), V.s * f)); f = ns / V.s;
  V.tx = px - (px - V.tx) * f; V.ty = py - (py - V.ty) * f; V.s = ns;
}
function initViewer() {
  const vw = $('#viewer'), cv = $('canvas', vw), d = () => window.devicePixelRatio || 1;
  $('.close', vw).addEventListener('click', closeViewer);
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    V.ptrs.set(e.pointerId, { x: e.clientX * d(), y: e.clientY * d(), x0: e.clientX, y0: e.clientY });
    if (V.ptrs.size === 1) V.moved = false; else V.moved = true;
    if (V.ptrs.size === 2) {
      const [a, b] = [...V.ptrs.values()];
      V.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), s: V.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx: V.tx, ty: V.ty };
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const p = V.ptrs.get(e.pointerId); if (!p) return;
    const nx = e.clientX * d(), ny = e.clientY * d();
    if (V.ptrs.size === 1) { V.tx += nx - p.x; V.ty += ny - p.y; }
    p.x = nx; p.y = ny;
    if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 8) V.moved = true;
    if (V.ptrs.size === 2 && V.pinch) {
      const [a, b] = [...V.ptrs.values()], P = V.pinch;
      const dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ns = Math.max(V.fit * 0.8, Math.min(vMax(), P.s * dist / P.dist)), f = ns / P.s;
      V.s = ns; V.tx = mx - (P.mx - P.tx) * f; V.ty = my - (P.my - P.ty) * f;
    }
    vClamp(); vDraw(true);
  });
  const up = (e) => {
    const was = V.ptrs.size; V.ptrs.delete(e.pointerId);
    if (V.ptrs.size < 2) V.pinch = null;
    if (was === 1 && !V.moved) {
      const now = performance.now();
      if (now - V.lastTap < 320) {
        const px = e.clientX * d(), py = e.clientY * d();
        if (V.s > V.fit * 1.5) vFit(); else vZoomAt(4, px, py);
        vClamp(); V.lastTap = 0;
      } else V.lastTap = now;
    }
    vDraw(false);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); vZoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX * d(), e.clientY * d()); vClamp(); vDraw(); }, { passive: false });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !vw.hidden) closeViewer(); });
}

/* ── Startseite: kleine Illustrationen ─────────────── */
function drawHero() {
  const c = $('#heroCv'), x = c.getContext('2d'), W = c.width, H = c.height, r = E.rng(7);
  const cols = 32, cell = W / cols, rows = Math.ceil(H / cell);
  const heart = SHAPES[0]; if (!heart.bbox) heart.bbox = E.measureBBox(heart.draw);
  const cov = E.shapeCoverage(heart, cols, rows, 0.1);
  for (let y = 0; y < rows; y++) for (let xx = 0; xx < cols; xx++) {
    const inside = cov[y * cols + xx] > 0.5;
    x.fillStyle = inside ? `hsl(${(335 + xx * 1.6 + y * 1.2 + r() * 16) % 360},${72 + r() * 22}%,${52 + r() * 16}%)`
      : `hsl(${232 + xx * 1.2 + r() * 20},${28 + r() * 22}%,${20 + r() * 16}%)`;
    x.fillRect(xx * cell + 2, y * cell + 2, cell - 4, cell - 4);
  }
  document.querySelectorAll('[data-ic]').forEach((cv) => {
    const k = cv.getContext('2d'), n = 6, s = cv.width / n, kind = cv.dataset.ic, rr = E.rng(kind.length * 31);
    const cvv = kind === 'form' ? E.shapeCoverage(heart, n, n, 0.02) : null;
    for (let y = 0; y < n; y++) for (let xx = 0; xx < n; xx++) {
      let col;
      if (kind === 'raster') col = `hsl(${(xx + y) * 28 + 180},70%,${55 + rr() * 15}%)`;
      else if (kind === 'form') col = cvv[y * n + xx] > 0.45 ? `hsl(${340 + rr() * 30},80%,${55 + rr() * 12}%)` : 'rgba(128,128,128,.18)';
      else { const d = Math.hypot(xx - 3.6, y - 2.2); col = `hsl(${30 + d * 30},${80 - d * 6}%,${78 - d * 9 + rr() * 6}%)`; }
      k.fillStyle = col; k.fillRect(xx * s + 1.5, y * s + 1.5, s - 3, s - 3);
    }
  });
}

/* ── Start ─────────────────────────────────────────── */
function wire() {
  $('#inPhotos').addEventListener('change', (e) => { const f = e.target.files; if (f && f.length) addFiles(f); e.target.value = ''; });
  $('#inTarget').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { await setTarget(f, false); buildModeUI(); schedule(0); } catch (err) { toast('Das Bild konnte nicht gelesen werden.'); }
  });
  $('#inMask').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { await setMask(f); S.form.shape = 'bild'; save(); buildModeUI(); schedule(0); } catch (err) { toast('Das Bild konnte nicht gelesen werden.'); }
  });
  $('#pickFirst').addEventListener('click', () => $('#inPhotos').click());
  $('#demoBtn').addEventListener('click', loadDemo);
  $('#libBtn').addEventListener('click', () => openLibrary(false));
  $('#modeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.mode = b.dataset.m; save(); buildModeUI(); buildLookUI(); schedule(0);
  });
  $('#goBtn').addEventListener('click', exportMosaic);
  $('#zoomBtn').addEventListener('click', openViewer);
  $('#pv').addEventListener('click', openViewer);
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt); rt = setTimeout(() => { if (L) drawPreview(); if (!$('#viewer').hidden) { vResize(); vFit(); vDraw(); } }, 150);
  });
  initViewer();
}

wire();
// Offline-Modus: App-Dateien auf dem Gerät ablegen (sendet keine Daten)
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
restore().then(refresh, refresh);
