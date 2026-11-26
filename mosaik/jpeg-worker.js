/* Streifenweiser Baseline-JPEG-Encoder (4:4:4) im Web Worker.
   Safari begrenzt eine Canvas auf ca. 16,7 Megapixel. Damit trotzdem Mosaike mit
   100+ MP entstehen, rendert die App das Bild in Streifen und schickt jeden Streifen
   hierher. Der Encoder schreibt die JPEG-Daten fortlaufend, das ganze Bild liegt nie
   als Pixel im Speicher.
   Nachrichten: {cmd:'start', w, h, q} · {cmd:'strip', buf, h} → {cmd:'ack'} · {cmd:'end'} → {cmd:'done', blob} */
'use strict';

const ZZ = [0,1,5,6,14,15,27,28,2,4,7,13,16,26,29,42,3,8,12,17,25,30,41,43,9,11,18,24,31,40,44,53,
  10,19,23,32,39,45,52,54,20,22,33,38,46,51,55,60,21,34,37,47,50,56,59,61,35,36,48,49,57,58,62,63];
const YQT = [16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,
  18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
const UVQT = [17,18,24,47,99,99,99,99,18,21,26,66,99,99,99,99,24,26,56,99,99,99,99,99,47,66,99,99,99,99,99,99,
  99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99];
const DC_L_N = [0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0], DC_L_V = [0,1,2,3,4,5,6,7,8,9,10,11];
const AC_L_N = [0,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d];
const AC_L_V = [0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,
  0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,
  0x1a,0x25,0x26,0x27,0x28,0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,
  0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,
  0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,
  0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,
  0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,
  0xf7,0xf8,0xf9,0xfa];
const DC_C_N = [0,0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0], DC_C_V = [0,1,2,3,4,5,6,7,8,9,10,11];
const AC_C_N = [0,0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,0x77];
const AC_C_V = [0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,0x13,0x22,0x32,0x81,
  0x08,0x14,0x42,0x91,0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,0xe1,0x25,0xf1,
  0x17,0x18,0x19,0x1a,0x26,0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,
  0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
  0x7a,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,
  0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,
  0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf2,0xf3,0xf4,0xf5,0xf6,
  0xf7,0xf8,0xf9,0xfa];

function huff(nr, vals) {           // → code[] und len[] je Symbol
  const code = new Uint16Array(256), len = new Uint8Array(256);
  let c = 0, p = 0;
  for (let k = 1; k <= 16; k++) {
    for (let j = 0; j < nr[k]; j++) { code[vals[p]] = c; len[vals[p]] = k; p++; c++; }
    c <<= 1;
  }
  return { code, len };
}
const HDC_L = huff(DC_L_N, DC_L_V), HAC_L = huff(AC_L_N, AC_L_V);
const HDC_C = huff(DC_C_N, DC_C_V), HAC_C = huff(AC_C_N, AC_C_V);

// Kategorie und Bitmuster je Koeffizient (−32767 … 32767)
const CAT = new Uint8Array(65535), BITS = new Uint16Array(65535);
(function () {
  let lo = 1, hi = 2;
  for (let cat = 1; cat <= 15; cat++) {
    for (let n = lo; n < hi; n++) { CAT[32767 + n] = cat; BITS[32767 + n] = n; }
    for (let n = -(hi - 1); n <= -lo; n++) { CAT[32767 + n] = cat; BITS[32767 + n] = hi - 1 + n; }
    lo <<= 1; hi <<= 1;
  }
})();

let W, H, yTab, uvTab, fdY, fdUV, rowsDone, dcY, dcU, dcV;
let out, outPos, chunks, bitBuf, bitCnt;

function initTables(q) {
  q = Math.max(1, Math.min(100, q | 0));
  const sf = q < 50 ? Math.floor(5000 / q) : Math.floor(200 - q * 2);
  yTab = new Uint8Array(64); uvTab = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    let t = Math.floor((YQT[i] * sf + 50) / 100); yTab[ZZ[i]] = Math.min(255, Math.max(1, t));
    t = Math.floor((UVQT[i] * sf + 50) / 100); uvTab[ZZ[i]] = Math.min(255, Math.max(1, t));
  }
  const aa = [1.0, 1.387039845, 1.306562965, 1.175875602, 1.0, 0.785694958, 0.5411961, 0.275899379];
  fdY = new Float32Array(64); fdUV = new Float32Array(64);
  let k = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++, k++) {
    fdY[k] = 1 / (yTab[ZZ[k]] * aa[r] * aa[c] * 8);
    fdUV[k] = 1 / (uvTab[ZZ[k]] * aa[r] * aa[c] * 8);
  }
}

function flushOut() { chunks.push(out.subarray(0, outPos)); out = new Uint8Array(1 << 20); outPos = 0; }
function byte(b) { if (outPos >= out.length) flushOut(); out[outPos++] = b; }
function word(w) { byte((w >> 8) & 0xff); byte(w & 0xff); }
function bits(code, len) {
  bitBuf = (bitBuf << len) | code; bitCnt += len;
  while (bitCnt >= 8) {
    const b = (bitBuf >> (bitCnt - 8)) & 0xff;
    byte(b); if (b === 0xff) byte(0);
    bitCnt -= 8;
  }
  bitBuf &= (1 << bitCnt) - 1;
}

function headers() {
  word(0xffd8);
  word(0xffe0); word(16); byte(0x4a); byte(0x46); byte(0x49); byte(0x46); byte(0); byte(1); byte(1);
  byte(1); word(300); word(300); byte(0); byte(0);              // 300 dpi als Druckhinweis
  word(0xffdb); word(132);
  byte(0); for (let i = 0; i < 64; i++) byte(yTab[i]);
  byte(1); for (let i = 0; i < 64; i++) byte(uvTab[i]);
  word(0xffc0); word(17); byte(8); word(H); word(W); byte(3);
  byte(1); byte(0x11); byte(0); byte(2); byte(0x11); byte(1); byte(3); byte(0x11); byte(1);
  word(0xffc4); word(0x01a2);
  const tbl = (id, n, v) => { byte(id); for (let i = 1; i <= 16; i++) byte(n[i]); for (let i = 0; i < v.length; i++) byte(v[i]); };
  tbl(0x00, DC_L_N, DC_L_V); tbl(0x10, AC_L_N, AC_L_V); tbl(0x01, DC_C_N, DC_C_V); tbl(0x11, AC_C_N, AC_C_V);
  word(0xffda); word(12); byte(3); byte(1); byte(0); byte(2); byte(0x11); byte(3); byte(0x11);
  byte(0); byte(0x3f); byte(0);
}

const DU = new Int32Array(64), QO = new Int32Array(64);
function block(d, fd, dc, HDC, HAC) {
  // AAN-DCT: Zeilen
  for (let o = 0; o < 64; o += 8) {
    const t0 = d[o] + d[o + 7], t7 = d[o] - d[o + 7], t1 = d[o + 1] + d[o + 6], t6 = d[o + 1] - d[o + 6];
    const t2 = d[o + 2] + d[o + 5], t5 = d[o + 2] - d[o + 5], t3 = d[o + 3] + d[o + 4], t4 = d[o + 3] - d[o + 4];
    let a = t0 + t3, b = t0 - t3, c = t1 + t2, e = t1 - t2;
    d[o] = a + c; d[o + 4] = a - c;
    const z1 = (e + b) * 0.707106781; d[o + 2] = b + z1; d[o + 6] = b - z1;
    a = t4 + t5; c = t5 + t6; e = t6 + t7;
    const z5 = (a - e) * 0.382683433, z2 = 0.5411961 * a + z5, z4 = 1.306562965 * e + z5, z3 = c * 0.707106781;
    const z11 = t7 + z3, z13 = t7 - z3;
    d[o + 5] = z13 + z2; d[o + 3] = z13 - z2; d[o + 1] = z11 + z4; d[o + 7] = z11 - z4;
  }
  // Spalten
  for (let o = 0; o < 8; o++) {
    const t0 = d[o] + d[o + 56], t7 = d[o] - d[o + 56], t1 = d[o + 8] + d[o + 48], t6 = d[o + 8] - d[o + 48];
    const t2 = d[o + 16] + d[o + 40], t5 = d[o + 16] - d[o + 40], t3 = d[o + 24] + d[o + 32], t4 = d[o + 24] - d[o + 32];
    let a = t0 + t3, b = t0 - t3, c = t1 + t2, e = t1 - t2;
    d[o] = a + c; d[o + 32] = a - c;
    const z1 = (e + b) * 0.707106781; d[o + 16] = b + z1; d[o + 48] = b - z1;
    a = t4 + t5; c = t5 + t6; e = t6 + t7;
    const z5 = (a - e) * 0.382683433, z2 = 0.5411961 * a + z5, z4 = 1.306562965 * e + z5, z3 = c * 0.707106781;
    const z11 = t7 + z3, z13 = t7 - z3;
    d[o + 40] = z13 + z2; d[o + 24] = z13 - z2; d[o + 8] = z11 + z4; d[o + 56] = z11 - z4;
  }
  for (let i = 0; i < 64; i++) { const v = d[i] * fd[i]; QO[i] = v > 0 ? (v + 0.5) | 0 : (v - 0.5) | 0; }
  for (let i = 0; i < 64; i++) DU[ZZ[i]] = QO[i];

  const diff = DU[0] - dc;
  if (diff === 0) bits(HDC.code[0], HDC.len[0]);
  else { const p = 32767 + diff, ct = CAT[p]; bits(HDC.code[ct], HDC.len[ct]); bits(BITS[p], ct); }
  let end = 63; while (end > 0 && DU[end] === 0) end--;
  if (end === 0) { bits(HAC.code[0], HAC.len[0]); return DU[0]; }
  let i = 1;
  while (i <= end) {
    const st = i; while (DU[i] === 0 && i <= end) i++;
    let nz = i - st;
    if (nz >= 16) { for (let m = nz >> 4; m > 0; m--) bits(HAC.code[0xf0], HAC.len[0xf0]); nz &= 15; }
    const p = 32767 + DU[i], ct = CAT[p], sym = (nz << 4) + ct;
    bits(HAC.code[sym], HAC.len[sym]); bits(BITS[p], ct);
    i++;
  }
  if (end !== 63) bits(HAC.code[0], HAC.len[0]);
  return DU[0];
}

const BY = new Float32Array(64), BU = new Float32Array(64), BV = new Float32Array(64);
function strip(px, h) {
  for (let by = 0; by < h; by += 8) {
    for (let bx = 0; bx < W; bx += 8) {
      let k = 0;
      for (let y = 0; y < 8; y++) {
        const yy = Math.min(by + y, h - 1), row = yy * W;
        for (let x = 0; x < 8; x++, k++) {
          const p = (row + Math.min(bx + x, W - 1)) * 4;
          const r = px[p], g = px[p + 1], b = px[p + 2];
          BY[k] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
          BU[k] = -0.16874 * r - 0.33126 * g + 0.5 * b;
          BV[k] = 0.5 * r - 0.41869 * g - 0.08131 * b;
        }
      }
      dcY = block(BY, fdY, dcY, HDC_L, HAC_L);
      dcU = block(BU, fdUV, dcU, HDC_C, HAC_C);
      dcV = block(BV, fdUV, dcV, HDC_C, HAC_C);
    }
  }
  rowsDone += h;
}

function finish() {
  if (bitCnt > 0) bits((1 << (8 - bitCnt)) - 1, 8 - bitCnt);
  word(0xffd9);
  chunks.push(out.subarray(0, outPos));
  return new Blob(chunks, { type: 'image/jpeg' });
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.cmd === 'start') {
      W = m.w; H = m.h; rowsDone = 0; dcY = dcU = dcV = 0;
      out = new Uint8Array(1 << 20); outPos = 0; chunks = []; bitBuf = 0; bitCnt = 0;
      initTables(m.q || 92); headers();
      self.postMessage({ cmd: 'ready' });
    } else if (m.cmd === 'strip') {
      strip(new Uint8ClampedArray(m.buf), m.h);
      self.postMessage({ cmd: 'ack', rows: rowsDone });
    } else if (m.cmd === 'end') {
      const blob = finish(); chunks = null; out = null;
      self.postMessage({ cmd: 'done', blob });
    }
  } catch (err) {
    self.postMessage({ cmd: 'error', message: String(err && err.message || err) });
  }
};
