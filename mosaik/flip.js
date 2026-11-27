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
export function videoMime() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  const c = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/* Nimmt das Daumenkino in Echtzeit auf. getFrame(i) liefert ein fertig gestaltetes Bild (W×H).
   Ist ein Bild noch nicht geladen, wird die Aufnahme pausiert, damit kein Bild zu lang stehen bleibt. */
export async function recordVideo({ W, H, count, fps, loops, fade, getFrame, onProgress, isCancelled }) {
  const mime = videoMime();
  if (!mime) throw new Error('Dieser Browser kann keine Videos aufnehmen.');
  const cv = E.canvas(W, H), x = cv.getContext('2d');
  // Safari nimmt nur Zeichenflächen zuverlässig auf, die im Dokument hängen
  cv.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
  document.body.append(cv);
  const stream = cv.captureStream(30);
  const bps = Math.round(Math.min(16e6, Math.max(3e6, W * H * 4)));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });

  const N = count * loops, dur = 1000 / fps, fadeMs = fade ? Math.min(dur * 0.6, 450) : 0;
  const cache = new Map();
  const want = (k) => {
    const i = k % count;
    if (!cache.has(i)) { const e = { v: null }; e.p = getFrame(i).then((v) => (e.v = v)); cache.set(i, e); }
    return cache.get(i);
  };
  const evict = (k) => {
    if (count <= 8) return;
    const keep = new Set(); for (let j = -1; j <= 6; j++) keep.add(((k + j) % count + count) % count);
    for (const [i, e] of cache) if (!keep.has(i)) { if (e.v && e.v.close) e.v.close(); cache.delete(i); }
  };
  const paint = (prev, cur, a) => {
    if (prev && a < 1) { x.globalAlpha = 1; x.drawImage(prev, 0, 0, W, H); x.globalAlpha = a; x.drawImage(cur, 0, 0, W, H); x.globalAlpha = 1; }
    else x.drawImage(cur, 0, 0, W, H);
  };
  try {
    let cur = await want(0).p, prev = null;
    paint(null, cur, 1);
    rec.start(1000);
    await sleep(60);
    let t0 = performance.now();
    for (let k = 0; k < N; k++) {
      if (isCancelled()) throw new Error('abort');
      for (let j = 1; j <= 5 && k + j < N; j++) want(k + j);
      const fs = t0 + k * dur;
      for (;;) {
        const now = performance.now();
        if (now >= fs + dur) break;
        paint(prev, cur, fadeMs && prev ? Math.min(1, (now - fs) / fadeMs) : 1);
        await sleep(Math.min(33, fs + dur - now));
      }
      onProgress((k + 1) / N);
      if (k + 1 < N) {
        const e = want(k + 1);
        if (!e.v) {                       // nächstes Bild noch nicht da: Aufnahme anhalten
          const w0 = performance.now();
          if (rec.state === 'recording' && rec.pause) rec.pause();
          await e.p;
          if (rec.state === 'paused') rec.resume();
          t0 += performance.now() - w0;
        }
        prev = cur;
        cur = e.v;
        evict(k + 1);
      }
    }
    paint(null, cur, 1); await sleep(120);
    rec.stop(); await stopped;
  } catch (err) {
    if (rec.state !== 'inactive') { rec.stop(); await stopped; }
    throw err;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    cv.remove(); E.free(cv);
    for (const e of cache.values()) if (e.v && e.v.close) e.v.close();
  }
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), mime };
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
