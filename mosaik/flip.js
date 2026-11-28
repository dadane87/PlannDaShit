// Daumenkino: Fotos schnell hintereinander. Vorschau, Video (MediaRecorder) und Druckbogen (PDF).
// Alles läuft lokal im Browser.
import * as E from './engine.js';

export const FLIP_FORMATS = [['4:5', 'Hoch 4:5'], ['1:1', 'Quadrat 1:1'], ['3:4', 'Hoch 3:4'], ['9:16', 'Hoch 9:16 (Story)'],
  ['4:3', 'Quer 4:3'], ['3:2', 'Quer 3:2'], ['16:9', 'Quer 16:9']];

export function orderFrames(list, mode, r) {
  const a = list.slice();
  if (mode === 'datum') a.sort((x, y) => (x.date || 0) - (y.date || 0) || x.order - y.order);
  else if (mode === 'farbe') {
    const key = (t) => (t.sat < 0.12 || t.lum < 0.1 || t.lum > 0.94 ? 1000 + (1 - t.light / 100) * 100 : t.hue);
    a.sort((x, y) => key(x) - key(y));
  } else if (mode === 'hell') a.sort((x, y) => y.light - x.light);
  else if (mode === 'zufall') E.shuffle(a, r);
  return a;
}

const DFMT = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

// Foto in das Feld (x,y,w,h) zeichnen. src = {img,w,h}. fit: 'fill' (Ausschnitt) oder 'ganz'
export function drawPhoto(ctx, src, x, y, w, h, fit) {
  const iw = src.w, ih = src.h;
  if (fit === 'ganz') {
    const k = Math.min(w / iw, h / ih), dw = iw * k, dh = ih * k;
    ctx.drawImage(src.img, 0, 0, iw, ih, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    const k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
    const sx = (iw - sw) / 2, sy = ih > iw ? (ih - sh) * 0.38 : (ih - sh) / 2;
    ctx.drawImage(src.img, sx, sy, sw, sh, x, y, w, h);
  }
}
export function drawStamp(ctx, t, x, y, w, h) {
  if (!t.date) return;
  const fs = Math.max(9, Math.round(Math.min(w, h) * 0.045));
  ctx.save();
  ctx.font = `600 ${fs}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = fs * 0.4;
  ctx.fillStyle = '#fff';
  ctx.fillText(DFMT.format(t.date), x + w - fs * 0.8, y + h - fs * 0.6);
  ctx.restore();
}
export function composeFrame(ctx, W, H, src, t, o) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
  drawPhoto(ctx, src, 0, 0, W, H, o.fit);
  if (o.date) drawStamp(ctx, t, 0, 0, W, H);
}

/* ── Video ─────────────────────────────────────────── */
export function videoMime(audio) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  // MP4 immer zuerst: nur MP4 lässt sich auf dem iPhone in der Fotos-App sichern
  const c = audio
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/* Nimmt das Daumenkino in Echtzeit auf.
   N Bilder insgesamt (mit Durchläufen), Bild k zeigt Eintrag k % count, dauert durs[k] ms.
   paint(ctx, k, u, d, img) zeichnet Bild k zum Zeitpunkt u (0…d); img(o) liefert das geladene Bild k+o oder null.
   sound(actx, dest, when, k): optionales Geräusch beim Bildwechsel. Fehlt ein Bild noch, pausiert die Aufnahme. */
export async function recordVideo({ W, H, N, count, durs, getFrame, paint, sound, soundAt, onProgress, isCancelled }) {
  let actx = null, dest = null;
  if (sound) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); await actx.resume(); dest = actx.createMediaStreamDestination(); }
    catch (e) { actx = null; dest = null; }
  }
  const mime = videoMime(!!dest) || videoMime(false);
  if (!mime) throw new Error('Dieser Browser kann keine Videos aufnehmen.');
  const cv = E.canvas(W, H), x = cv.getContext('2d');
  // Safari nimmt nur Zeichenflächen zuverlässig auf, die im Dokument hängen
  cv.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
  document.body.append(cv);
  const vstream = cv.captureStream(30);
  const tracks = [...vstream.getVideoTracks(), ...(dest ? dest.stream.getAudioTracks() : [])];
  const stream = new MediaStream(tracks);
  const bps = Math.round(Math.min(16e6, Math.max(3e6, W * H * 4)));
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps }); }
  catch (e) { rec = new MediaRecorder(new MediaStream(vstream.getVideoTracks()), { mimeType: videoMime(false), videoBitsPerSecond: bps }); actx = null; }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });

  const cache = new Map();
  const want = (k) => {
    const i = ((k % count) + count) % count;
    if (!cache.has(i)) { const e = { v: null }; e.p = getFrame(i).then((v) => (e.v = v)); cache.set(i, e); }
    return cache.get(i);
  };
  const evict = (k) => {
    if (count <= 10) return;
    const keep = new Set(); for (let j = -2; j <= 6; j++) keep.add((((k + j) % count) + count) % count);
    for (const [i, e] of cache) if (!keep.has(i)) { if (e.v && e.v.close) e.v.close(); cache.delete(i); }
  };
  const ready = async (k) => {             // Bilder k-1, k, k+1 müssen da sein
    const need = [k - 1, k, k + 1].filter((j) => j >= 0 && j < N).map(want).filter((e) => !e.v);
    if (!need.length) return 0;
    const w0 = performance.now();
    if (rec.state === 'recording' && rec.pause) rec.pause();
    await Promise.all(need.map((e) => e.p));
    if (rec.state === 'paused') rec.resume();
    return performance.now() - w0;
  };
  const img = (k) => (o) => { const j = k + o; if (j < 0 || j >= N) return null; const e = want(j); return e.v; };
  try {
    await ready(0);
    paint(x, 0, 0, durs[0], img(0));
    rec.start(1000);
    await sleep(60);
    let fs = performance.now();
    for (let k = 0; k < N; k++) {
      if (isCancelled()) throw new Error('abort');
      for (let j = 2; j <= 6 && k + j < N; j++) want(k + j);
      fs += await ready(k);
      const d = durs[k];
      let clicked = !actx || k === 0;
      for (;;) {
        const now = performance.now(), u = now - fs;
        if (u >= d) break;
        if (!clicked && u >= soundAt(d)) { clicked = true; sound(actx, dest, actx.currentTime, k); }
        paint(x, k, u, d, img(k));
        await sleep(Math.min(16, d - u));
      }
      fs += d;
      onProgress((k + 1) / N);
      evict(k + 1);
    }
    paint(x, N - 1, durs[N - 1], durs[N - 1], img(N - 1)); await sleep(150);
    rec.stop(); await stopped;
  } catch (err) {
    if (rec.state !== 'inactive') { rec.stop(); await stopped; }
    throw err;
  } finally {
    stream.getTracks().forEach((t) => t.stop()); vstream.getTracks().forEach((t) => t.stop());
    if (actx) actx.close().catch(() => {});
    cv.remove(); E.free(cv);
    for (const e of cache.values()) if (e.v && e.v.close) e.v.close();
  }
  const type = rec.mimeType || mime;
  return { blob: new Blob(chunks, { type: type.split(';')[0] }), mime: type };
}

/* ── „Echtes Daumenkino“: Papier, wegklappende Blätter, Klatschen ── */
// Ungleichmäßiges Tempo: leichte Schwankung, ab und zu bleibt ein Blatt hängen und die nächsten rutschen schneller
export function paperDurations(N, fps, life, seed) {
  const r = E.rng(seed), base = 1000 / fps, out = new Float64Array(N);
  let catchup = 0;
  for (let k = 0; k < N; k++) {
    let f = 1 + (r() - 0.5) * 0.55 * life;
    if (catchup > 0) { f *= 0.72; catchup--; } else if (r() < 0.07 * life) { f *= 1.9; catchup = 2; }
    out[k] = Math.max(base * 0.45, base * f);
  }
  return out;
}
export const flipMs = (d) => Math.min(d * 0.5, 120);    // Dauer des Wegklappens

let GRAIN = null;
function grain(ctx) {
  if (!GRAIN) {
    const c = E.canvas(160, 160), x = c.getContext('2d'), id = x.createImageData(160, 160), r = E.rng(77);
    for (let i = 0; i < id.data.length; i += 4) { const v = 200 + r() * 55; id.data[i] = v; id.data[i + 1] = v * 0.985; id.data[i + 2] = v * 0.95; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); GRAIN = c;
  }
  return ctx.createPattern(GRAIN, 'repeat');
}
export function paperGeom(W, H) {
  const s = Math.min(W, H), m = Math.round(s * 0.05), st = Math.max(3, Math.round(s * 0.024));
  const card = { x: m, y: Math.round(m * 0.8), w: W - 2 * m - st, h: H - Math.round(m * 1.6) - st };
  const pad = Math.round(s * 0.03);
  return { s, st, card, ph: { x: card.x + pad, y: card.y + pad, w: card.w - 2 * pad, h: card.h - 2 * pad } };
}
function drawCard(ctx, g, im, opts) {
  const { card, ph } = g;
  ctx.fillStyle = '#f7f4ee'; ctx.fillRect(card.x, card.y, card.w, card.h);
  if (im) { ctx.save(); ctx.beginPath(); ctx.rect(ph.x, ph.y, ph.w, ph.h); ctx.clip(); drawPhoto(ctx, { img: im, w: im.width, h: im.height }, ph.x, ph.y, ph.w, ph.h, 'fill'); ctx.restore(); }
  if (opts && opts.ghost && opts.ghostA > 0) {
    ctx.save(); ctx.globalAlpha = opts.ghostA; ctx.beginPath(); ctx.rect(ph.x, ph.y, ph.w, ph.h); ctx.clip();
    drawPhoto(ctx, { img: opts.ghost, w: opts.ghost.width, h: opts.ghost.height }, ph.x, ph.y, ph.w, ph.h, 'fill'); ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.5;
  ctx.fillStyle = grain(ctx); ctx.fillRect(card.x, card.y, card.w, card.h); ctx.restore();
  ctx.strokeStyle = 'rgba(70,60,45,.22)'; ctx.lineWidth = 1; ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);
}
/* Ein Bild des Papier-Daumenkinos. o = {cur, prev, next, u, d, k, total, life, bg} */
export function drawPaper(ctx, W, H, o) {
  const g = paperGeom(W, H), { card, st, s } = g, life = o.life;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
  // Blattstapel: wird beim Durchblättern dünner
  const L = 1 + Math.round(5 * Math.max(0, 1 - o.k / Math.max(1, o.total)));
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = s * 0.03; ctx.shadowOffsetY = s * 0.008;
  ctx.fillStyle = '#ddd6c9'; ctx.fillRect(card.x + st, card.y + st, card.w, card.h); ctx.restore();
  for (let i = L; i >= 1; i--) {
    const off = st * i / L;
    ctx.fillStyle = i % 2 ? '#ebe6dc' : '#e2dccf'; ctx.fillRect(card.x + off, card.y + off, card.w, card.h);
    ctx.strokeStyle = 'rgba(70,60,45,.25)'; ctx.lineWidth = 1; ctx.strokeRect(card.x + off + 0.5, card.y + off + 0.5, card.w - 1, card.h - 1);
  }
  const f = flipMs(o.d), cy = card.y + card.h / 2;
  if (o.prev && o.u < f) {
    // 1) neue Seite liegt schon da, das nächste Motiv schimmert durch, Schatten des wegklappenden Blatts
    const p = Math.pow(o.u / f, 1.35);
    drawCard(ctx, g, o.cur, { ghost: o.next, ghostA: 0.12 * life * (1 - p) });
    const ex = card.x + card.w * Math.cos(p * Math.PI / 2);
    const sg = ctx.createLinearGradient(card.x, 0, Math.min(card.x + card.w, ex + s * 0.12), 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.75, `rgba(0,0,0,${0.32 * (1 - p)})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(card.x, card.y, card.w, card.h);
    // 2) altes Blatt klappt an der Bindung (links) weg: wird schmal, rechte Kante hebt sich, Bewegungsunschärfe
    const steps = [[0.16, 0.22], [0.08, 0.3], [0, 1]];
    for (const [back, a] of steps) {
      const q = Math.max(0, p - back * life), sx = Math.max(0.02, Math.cos(q * Math.PI / 2));
      const b = -0.1 * life * Math.sin(q * Math.PI) * (card.h / card.w), dS = 1 - 0.04 * life * Math.sin(q * Math.PI);
      ctx.save(); ctx.globalAlpha = a;
      ctx.setTransform(sx, b, 0, dS, card.x - sx * card.x, cy - dS * cy - b * card.x);
      drawCard(ctx, g, o.prev, null);
      ctx.fillStyle = `rgba(0,0,0,${0.4 * q})`; ctx.fillRect(card.x, card.y, card.w, card.h);
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    // 3) „Klatsch“: Blatt rastet mit kleinem Ruck ein und wölbt sich kurz
    const q = (o.u - f) / 80;
    let ty = 0, sy = 1, sx = 1, b = 0;
    if (o.prev && q >= 0 && q < 1) { const j = Math.sin(q * Math.PI) * (1 - q); ty = s * 0.007 * life * j; sy = 1 - 0.012 * life * j; }
    // Spannung: kurz bevor das Blatt entwischt, hebt sich die rechte Kante leicht
    const pre = o.next ? (o.u - o.d * 0.84) / (o.d * 0.16) : -1;
    if (pre > 0) { sx = 1 - 0.035 * life * pre; b = -0.05 * life * pre * (card.h / card.w); }
    ctx.setTransform(sx, b, 0, sy, card.x - sx * card.x, cy - sy * cy - b * card.x + ty);
    drawCard(ctx, g, o.cur, null);
    if (pre > 0) { ctx.fillStyle = `rgba(0,0,0,${0.08 * pre * life})`; ctx.fillRect(card.x, card.y, card.w, card.h); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

/* Trockenes Klacken eines Papierblatts, rein synthetisch (WebAudio) */
let CLICKS = null;
export function paperClick(actx, dest, when, k) {
  if (!CLICKS || CLICKS.sr !== actx.sampleRate) {
    const sr = actx.sampleRate, r = E.rng(5); CLICKS = { sr, bufs: [] };
    for (let v = 0; v < 6; v++) {
      const len = Math.round(sr * 0.06), buf = actx.createBuffer(1, len, sr), d = buf.getChannelData(0);
      const fr = 120 + r() * 60, dk = 70 + r() * 40;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        d[i] = (r() * 2 - 1) * Math.exp(-t * dk) * 0.8 + Math.sin(2 * Math.PI * fr * t) * Math.exp(-t * 55) * 0.6;
      }
      CLICKS.bufs.push(buf);
    }
  }
  const src = actx.createBufferSource(); src.buffer = CLICKS.bufs[k % CLICKS.bufs.length];
  const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
  const pk = actx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2200 + (k % 5) * 180; pk.gain.value = 6; pk.Q.value = 0.9;
  const g = actx.createGain(); g.gain.value = 0.35 + ((k * 7) % 5) * 0.05;
  src.connect(hp); hp.connect(pk); pk.connect(g); g.connect(dest);
  src.start(when);
}

/* ── Druckbogen: A4, 2 × 6 Karten mit Bindestreifen ── */
export const CARD = { cols: 2, rows: 6, w: 100, h: 46, mx: 5, my: 10.5, bind: 24 };
export const PER_PAGE = CARD.cols * CARD.rows;

export function drawPrintPage(ctx, dpi, items, pageNo, pages, o) {
  const mm = dpi / 25.4, W = Math.round(210 * mm), H = Math.round(297 * mm);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const C = CARD;
  items.forEach((it, idx) => {
    const col = idx % C.cols, row = (idx / C.cols) | 0;
    const x = (C.mx + col * C.w) * mm, y = (C.my + row * C.h) * mm;
    // Bindestreifen mit Nummer
    ctx.fillStyle = '#f1f1f3'; ctx.fillRect(x, y, C.bind * mm, C.h * mm);
    ctx.fillStyle = '#8e8e93';
    ctx.font = `700 ${Math.round(4.2 * mm)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(it.no), x + C.bind * mm / 2, y + C.h * mm / 2);
    // Foto
    const ix = x + (C.bind + 1.5) * mm, iy = y + 2 * mm, iw = (C.w - C.bind - 3.5) * mm, ih = (C.h - 4) * mm;
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    ctx.fillStyle = o.bg; ctx.fillRect(ix, iy, iw, ih);
    drawPhoto(ctx, it.src, ix, iy, iw, ih, o.fit);
    if (o.date) drawStamp(ctx, it.t, ix, iy, iw, ih);
    ctx.restore();
  });
  // Schnittlinien
  ctx.strokeStyle = '#b8b8bd'; ctx.lineWidth = Math.max(1, 0.2 * mm); ctx.setLineDash([]);
  const rows = Math.ceil(items.length / C.cols);
  for (let r = 0; r <= rows; r++) {
    const y = (C.my + r * C.h) * mm; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let c = 0; c <= C.cols; c++) {
    const x = (C.mx + c * C.w) * mm; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, (C.my + rows * C.h) * mm + 5 * mm); ctx.stroke();
  }
  ctx.fillStyle = '#8e8e93'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${Math.round(2.8 * mm)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Daumenkino · Seite ${pageNo} von ${pages} · In Originalgröße (100 %) drucken, an den grauen Linien ausschneiden,`, 5 * mm, 291 * mm);
  ctx.fillText('nach Nummern stapeln (Nr. 1 oben) und am grauen Streifen links fest klammern oder kleben.', 5 * mm, 295 * mm);
  return { W, H };
}

/* Minimaler PDF-Schreiber: je Seite ein ganzseitiges JPEG (A4). pages = [{bytes, w, h}] */
export function makePdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let pos = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
  const obj = (id, body) => { offs[id] = pos; push(`${id} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n');
  const n = pages.length, PW = 595.28, PH = 841.89;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`));
  pages.forEach((p, i) => {
    const id = 3 + 3 * i, cs = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(id, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`));
    obj(id + 1, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(id + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`);
      push(p.bytes); push('\nendstream');
    });
  });
  const xref = pos, size = 3 + 3 * n;
  let x = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id++) x += String(offs[id]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

/* ── Video / Live Photo in Einzelbilder zerlegen ─────────
   Gibt [{blob, w, h}] zurück (JPEG je Bild, spart Speicher). */
export async function extractVideoFrames(file, { perSec = 12, maxFrames = 180, maxSide = 1440, onProgress, isCancelled }) {
  const url = URL.createObjectURL(file), v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', ''); v.src = url;
  const wait = (ev, ms, msg) => new Promise((res, rej) => {
    const t = setTimeout(() => { cleanup(); rej(new Error(msg)); }, ms);
    const ok = () => { cleanup(); res(); }, bad = () => { cleanup(); rej(new Error('Video nicht lesbar')); };
    const cleanup = () => { clearTimeout(t); v.removeEventListener(ev, ok); v.removeEventListener('error', bad); };
    v.addEventListener(ev, ok); v.addEventListener('error', bad);
  });
  try {
    if (v.readyState < 2) await wait('loadeddata', 20000, 'Video lädt nicht');
    // iOS gibt Bilder oft erst nach einem kurzen Abspielen frei
    try { await v.play(); v.pause(); } catch (e) {}
    const dur = v.duration;
    if (!isFinite(dur) || dur <= 0) throw new Error('Videolänge unbekannt');
    const n = Math.max(2, Math.min(maxFrames, Math.round(dur * perSec)));
    const vw = v.videoWidth, vh = v.videoHeight, k = Math.min(1, maxSide / Math.max(vw, vh));
    const W = Math.round(vw * k), H = Math.round(vh * k);
    const c = E.canvas(W, H), x = E.ctx2d(c), out = [];
    for (let i = 0; i < n; i++) {
      if (isCancelled && isCancelled()) throw new Error('abort');
      const t = Math.min(dur - 0.001, (i + 0.5) * dur / n);
      if (Math.abs(v.currentTime - t) > 0.0005) { const p = wait('seeked', 8000, 'Video springt nicht'); v.currentTime = t; await p; }
      x.drawImage(v, 0, 0, W, H);
      out.push({ blob: await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9)), w: W, h: H });
      if (onProgress) onProgress((i + 1) / n);
    }
    E.free(c);
    return { frames: out, duration: dur };
  } finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); }
}
