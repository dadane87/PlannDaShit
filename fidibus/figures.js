// Gemalte Figuren im Stil des Buchs, prozedural in Offscreen-Canvases gerendert.
// window.FIG.build(IMG) ersetzt whale, turtle, star, jelly, mama, papa durch gemalte Versionen
// und liefert Sprite-Daten (Blickrichtung, Augenpositionen) zurück.
(() => {
'use strict';

const TAU = Math.PI * 2;
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// Körnung wie Pinsel/Papier
const NOISE = (() => {
  const [c, g] = mk(256, 256); const d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = 90 + Math.random() * 160; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return c;
})();
function grain(g, w, h, a = 0.13) {
  const [t, tg] = mk(w, h); tg.drawImage(g.canvas, 0, 0);
  tg.globalCompositeOperation = 'overlay'; tg.globalAlpha = a; tg.fillStyle = tg.createPattern(NOISE, 'repeat'); tg.fillRect(0, 0, w, h);
  tg.globalCompositeOperation = 'destination-in'; tg.globalAlpha = 1; tg.drawImage(g.canvas, 0, 0);
  g.save(); g.globalCompositeOperation = 'copy'; g.drawImage(t, 0, 0); g.restore();
}
// Weiche Farbflecken (Malerei-Look) nur auf bereits gemalten Pixeln
function mottle(g, w, h, n, col, r0, r1, a = 0.12, seed = 1) {
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  g.save(); g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = r0 + rnd() * (r1 - r0);
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col.replace('A', a.toFixed(3))); rg.addColorStop(1, col.replace('A', '0'));
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.restore();
}
// Licht von oben links + dunkler Rand unten rechts, nur auf gemalten Pixeln
function light(g, w, h, lx, ly, lr, la, dx, dy, dr, da) {
  g.save(); g.globalCompositeOperation = 'source-atop';
  let rg = g.createRadialGradient(lx, ly, 0, lx, ly, lr); rg.addColorStop(0, `rgba(255,250,230,${la})`); rg.addColorStop(1, 'rgba(255,250,230,0)');
  g.fillStyle = rg; g.fillRect(0, 0, w, h);
  rg = g.createRadialGradient(dx, dy, 0, dx, dy, dr); rg.addColorStop(0, `rgba(10,20,50,${da})`); rg.addColorStop(1, 'rgba(10,20,50,0)');
  g.fillStyle = rg; g.fillRect(0, 0, w, h);
  g.restore();
}
function eye(g, x, y, rx, ry, opts = {}) {
  // Augapfel
  g.save();
  g.fillStyle = opts.white || '#fbf6ea'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  const ig = g.createRadialGradient(x + rx * 0.15, y - ry * 0.1, 1, x + rx * 0.15, y, rx * 0.8);
  ig.addColorStop(0, opts.iris || '#3b2a1c'); ig.addColorStop(0.6, opts.iris2 || '#1b120b'); ig.addColorStop(1, '#0b0805');
  g.fillStyle = ig; g.beginPath(); g.ellipse(x + rx * (opts.px || 0.12), y + ry * (opts.py || 0.08), rx * (opts.pr || 0.62), ry * (opts.pr || 0.62) * 1.05, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(x + rx * 0.3, y - ry * 0.3, rx * 0.2, ry * 0.18, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - rx * 0.15, y + ry * 0.35, rx * 0.1, ry * 0.08, 0, 0, TAU); g.fill();
  // oberes Lid (schwer = „weise/müde“)
  if (opts.lid) {
    g.fillStyle = opts.lidCol; g.beginPath(); g.ellipse(x, y - ry * (1.1 - opts.lid), rx * 1.12, ry * 1.05, 0, Math.PI, TAU); g.lineTo(x + rx * 1.12, y - ry * (1.1 - opts.lid)); g.closePath(); g.fill();
    g.strokeStyle = opts.lidLine || 'rgba(40,25,10,.6)'; g.lineWidth = Math.max(1.5, rx * 0.08); g.beginPath(); g.ellipse(x, y - ry * (1.1 - opts.lid), rx * 1.1, ry * 0.9, 0, Math.PI + 0.15, TAU - 0.15); g.stroke();
  }
  // Augenrand
  g.strokeStyle = opts.rim || 'rgba(40,25,10,.35)'; g.lineWidth = Math.max(1.2, rx * 0.06); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.stroke();
  g.restore();
}
function blush(g, x, y, rx, ry, a = 0.35) {
  const rg = g.createRadialGradient(x, y, 0, x, y, rx); rg.addColorStop(0, `rgba(255,120,110,${a})`); rg.addColorStop(1, 'rgba(255,120,110,0)');
  g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); g.restore();
}

// ───────────── Wal (blickt nach links) ─────────────
function whale() {
  const W = 1500, H = 820; const [c, g] = mk(W, H);
  // Schwanzflosse
  const fluke = (top) => { g.beginPath(); g.moveTo(1230, 335); g.quadraticCurveTo(1330, top ? 170 : 500, 1470, top ? 150 : 540); g.quadraticCurveTo(1420, top ? 260 : 410, 1300, 350); g.closePath(); g.fill(); };
  g.fillStyle = '#23478a'; fluke(true); fluke(false);
  // Körper: riesiger runder Kopf links, sanft auslaufend nach rechts
  const body = () => { g.beginPath(); g.moveTo(160, 440); g.bezierCurveTo(150, 260, 260, 90, 470, 75); g.bezierCurveTo(700, 60, 950, 150, 1110, 260); g.bezierCurveTo(1190, 310, 1240, 330, 1265, 342); g.bezierCurveTo(1235, 385, 1150, 450, 1010, 520); g.bezierCurveTo(830, 620, 560, 730, 360, 690); g.bezierCurveTo(235, 665, 170, 570, 160, 440); g.closePath(); };
  const bg = g.createLinearGradient(0, 70, 0, 720); bg.addColorStop(0, '#6aa0dc'); bg.addColorStop(0.4, '#3a6db8'); bg.addColorStop(1, '#1d3d7a');
  g.fillStyle = bg; body(); g.fill();
  g.save(); body(); g.clip();
  // Bauch mit Kehlfurchen
  const belly = g.createLinearGradient(0, 470, 0, 720); belly.addColorStop(0, 'rgba(205,225,242,0)'); belly.addColorStop(0.3, 'rgba(205,225,242,.92)'); belly.addColorStop(1, 'rgba(150,182,215,.95)');
  g.fillStyle = belly; g.beginPath(); g.moveTo(150, 520); g.bezierCurveTo(330, 600, 700, 720, 1120, 470); g.lineTo(1200, 760); g.lineTo(120, 760); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(70,100,150,.32)'; g.lineWidth = 3;
  for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(190 + i * 14, 545 + i * 22); g.quadraticCurveTo(520 + i * 20, 690 + i * 8, 950 - i * 12, 560 + i * 12); g.stroke(); }
  // Maul: riesig, weit offen und freundlich (Zunge innen)
  const mouth = () => { g.beginPath(); g.moveTo(158, 415); g.quadraticCurveTo(420, 375, 700, 470); g.quadraticCurveTo(640, 560, 500, 610); g.quadraticCurveTo(330, 660, 205, 590); g.quadraticCurveTo(165, 540, 158, 415); g.closePath(); };
  g.fillStyle = '#0c1a3c'; mouth(); g.fill();
  g.save(); mouth(); g.clip();
  const tg = g.createRadialGradient(420, 640, 20, 420, 640, 220); tg.addColorStop(0, '#ea8aa0'); tg.addColorStop(1, '#8a3350');
  g.fillStyle = tg; g.beginPath(); g.ellipse(430, 650, 210, 70, -0.08, 0, TAU); g.fill();
  const th = g.createLinearGradient(0, 430, 0, 560); th.addColorStop(0, 'rgba(20,45,100,.9)'); th.addColorStop(1, 'rgba(20,45,100,0)');
  g.fillStyle = th; g.fillRect(150, 400, 600, 200);
  g.restore();
  // Lippen
  g.strokeStyle = 'rgba(15,30,70,.7)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(158, 415); g.quadraticCurveTo(420, 375, 700, 470); g.stroke();
  g.strokeStyle = 'rgba(210,230,250,.55)'; g.lineWidth = 6; g.beginPath(); g.moveTo(190, 585); g.quadraticCurveTo(330, 668, 505, 612); g.stroke();
  g.restore();
  // Brustflosse (breit, nach vorn unten)
  g.fillStyle = '#2b569e'; g.beginPath(); g.moveTo(600, 560); g.quadraticCurveTo(560, 700, 430, 760); g.quadraticCurveTo(470, 650, 560, 600); g.quadraticCurveTo(620, 570, 690, 580); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(15,30,70,.4)'; g.lineWidth = 3; g.stroke();
  // Rückenflosse
  g.fillStyle = '#2f5ea8'; g.beginPath(); g.moveTo(900, 120); g.quadraticCurveTo(950, 45, 1010, 80); g.quadraticCurveTo(980, 130, 1020, 185); g.closePath(); g.fill();
  // Auge: klein im Verhältnis zum Kopf, mit Lid
  eye(g, 600, 320, 30, 34, { px: -0.2, py: 0.05, pr: 0.62, white: '#eef4fb', lid: 0.35, lidCol: '#4577c0', lidLine: 'rgba(20,40,90,.55)', rim: 'rgba(20,40,90,.45)' });
  g.strokeStyle = 'rgba(20,40,90,.45)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(565, 282); g.quadraticCurveTo(600, 266, 636, 284); g.stroke();
  blush(g, 520, 400, 70, 40, 0.25);
  light(g, W, H, 450, 120, 760, 0.34, 980, 740, 900, 0.45);
  mottle(g, W, H, 60, 'rgba(120,180,240,A)', 40, 140, 0.16, 3);
  mottle(g, W, H, 40, 'rgba(10,30,80,A)', 40, 160, 0.12, 7);
  grain(g, W, H, 0.14);
  return { c, face: 1, eyes: [{ cx: 600, cy: 322, rx: 36, ry: 40, col: '#4577c0' }] };
}

// ───────────── Oma-Schildkröte (blickt nach links) ─────────────
function turtle() {
  const W = 1300, H = 820; const [c, g] = mk(W, H);
  const skin = g.createLinearGradient(0, 150, 0, 720); skin.addColorStop(0, '#bcbb72'); skin.addColorStop(0.5, '#949b52'); skin.addColorStop(1, '#5c6631');
  const scales = (clipFn, x0, y0, cols, rows, r, step) => { g.save(); clipFn(); g.clip(); g.strokeStyle = 'rgba(60,70,25,.3)'; g.lineWidth = 2; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { g.beginPath(); g.arc(x0 + i * step + (j % 2) * step / 2, y0 + j * step * 0.9, r, 0, TAU); g.stroke(); } g.restore(); };
  // hintere Flosse + Schwanz
  g.fillStyle = '#6f7a3c'; g.beginPath(); g.moveTo(1000, 560); g.quadraticCurveTo(1130, 560, 1220, 660); g.quadraticCurveTo(1100, 660, 960, 610); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(1140, 470); g.quadraticCurveTo(1240, 470, 1270, 520); g.quadraticCurveTo(1210, 530, 1140, 520); g.closePath(); g.fill();
  // Hals
  const neck = () => { g.beginPath(); g.moveTo(400, 260); g.quadraticCurveTo(500, 220, 600, 270); g.lineTo(600, 500); g.quadraticCurveTo(500, 540, 400, 490); g.closePath(); };
  g.fillStyle = skin; neck(); g.fill(); scales(neck, 400, 260, 6, 8, 16, 40);
  g.save(); neck(); g.clip(); g.strokeStyle = 'rgba(60,70,25,.35)'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(410, 320 + i * 40); g.quadraticCurveTo(500, 300 + i * 40, 590, 330 + i * 40); g.stroke(); } g.restore();
  // Vorderflosse: breites Paddel nach links vorn
  const flip = () => { g.beginPath(); g.moveTo(600, 480); g.quadraticCurveTo(470, 560, 280, 600); g.quadraticCurveTo(150, 630, 80, 610); g.quadraticCurveTo(70, 560, 140, 535); g.quadraticCurveTo(300, 470, 460, 430); g.quadraticCurveTo(560, 410, 600, 430); g.closePath(); };
  const fg = g.createLinearGradient(0, 430, 0, 630); fg.addColorStop(0, '#b3b46a'); fg.addColorStop(1, '#6a7238');
  g.fillStyle = fg; flip(); g.fill(); scales(flip, 90, 445, 13, 6, 15, 42);
  g.save(); flip(); g.clip(); g.strokeStyle = 'rgba(50,55,20,.4)'; g.lineWidth = 3; g.beginPath(); g.moveTo(600, 480); g.quadraticCurveTo(470, 560, 280, 600); g.stroke(); g.restore();
  // Kopf: groß und rund
  const head = () => { g.beginPath(); g.moveTo(120, 330); g.bezierCurveTo(115, 220, 210, 150, 330, 155); g.bezierCurveTo(450, 160, 520, 240, 515, 340); g.bezierCurveTo(510, 440, 420, 500, 300, 495); g.bezierCurveTo(190, 490, 125, 430, 120, 330); g.closePath(); };
  g.fillStyle = skin; head(); g.fill(); scales(head, 120, 160, 10, 9, 17, 44);
  g.save(); head(); g.clip(); g.strokeStyle = 'rgba(60,70,25,.45)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(200 + i * 25, 205 + i * 12); g.quadraticCurveTo(300, 185 + i * 12, 400 - i * 10, 210 + i * 12); g.stroke(); } g.restore();
  // Panzer: hohe Kuppel
  const shell = () => { g.beginPath(); g.moveTo(440, 545); g.bezierCurveTo(410, 280, 540, 90, 790, 80); g.bezierCurveTo(1030, 70, 1180, 280, 1180, 520); g.bezierCurveTo(1120, 575, 720, 590, 440, 545); g.closePath(); };
  const sg = g.createRadialGradient(640, 190, 30, 800, 330, 540); sg.addColorStop(0, '#d6cf92'); sg.addColorStop(0.45, '#8f9350'); sg.addColorStop(1, '#3e4722');
  g.fillStyle = sg; shell(); g.fill();
  g.save(); shell(); g.clip();
  // Platten: leicht unregelmäßig, erhaben (Bevel)
  let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const plate = (x, y, r, rot) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + rot; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
  for (let row = 0; row < 4; row++) for (let i = 0; i < 8; i++) {
    const big = row === 1 || row === 2; const r = (big ? 62 : 48) + (rnd() - 0.5) * 8;
    const x = 480 + i * 108 + (row % 2) * 54 + (rnd() - 0.5) * 14, y = 165 + row * 100 + Math.abs(i - 3.5) * 16 + (rnd() - 0.5) * 12, rot = Math.PI / 6 + (rnd() - 0.5) * 0.25;
    const pg = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r); pg.addColorStop(0, 'rgba(240,232,170,.5)'); pg.addColorStop(0.6, 'rgba(130,135,65,.15)'); pg.addColorStop(1, 'rgba(30,35,10,.5)');
    g.fillStyle = pg; plate(x, y, r, rot); g.fill();
    g.strokeStyle = 'rgba(35,40,12,.8)'; g.lineWidth = 8; plate(x, y, r - 4, rot); g.stroke();
    g.strokeStyle = 'rgba(240,232,170,.3)'; g.lineWidth = 2.5; plate(x, y, r - 11, rot); g.stroke();
  }
  // Saum (Randplatten)
  const rim = g.createLinearGradient(0, 470, 0, 600); rim.addColorStop(0, 'rgba(90,100,45,0)'); rim.addColorStop(0.45, 'rgba(125,130,62,.95)'); rim.addColorStop(1, 'rgba(60,66,30,1)');
  g.fillStyle = rim; g.fillRect(400, 460, 820, 150);
  g.strokeStyle = 'rgba(45,50,18,.6)'; g.lineWidth = 4; g.beginPath(); g.moveTo(440, 520); g.quadraticCurveTo(790, 565, 1180, 500); g.stroke();
  for (let i = 0; i < 14; i++) { const x = 470 + i * 52; g.beginPath(); g.moveTo(x, 525 + Math.sin(i / 13 * Math.PI) * 30); g.lineTo(x + 6, 575); g.stroke(); }
  g.restore();
  // Auge: groß, dunkel, schweres Lid
  eye(g, 268, 318, 62, 66, { px: -0.05, py: 0.1, pr: 0.72, iris: '#4a3320', iris2: '#1a120a', lid: 0.42, lidCol: '#a2a85c', lidLine: 'rgba(50,45,15,.65)', rim: 'rgba(50,45,15,.45)' });
  g.strokeStyle = 'rgba(50,45,15,.55)'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(200, 238); g.quadraticCurveTo(268, 205, 340, 240); g.stroke();
  // Nase und Lächeln
  g.fillStyle = 'rgba(50,45,15,.6)'; g.beginPath(); g.ellipse(150, 365, 7, 5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(45,40,15,.78)'; g.lineWidth = 7; g.beginPath(); g.moveTo(135, 405); g.quadraticCurveTo(250, 460, 385, 415); g.stroke();
  g.strokeStyle = 'rgba(45,40,15,.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(380, 413); g.quadraticCurveTo(398, 402, 400, 388); g.stroke();
  blush(g, 240, 410, 60, 34, 0.3);
  light(g, W, H, 540, 140, 780, 0.34, 1060, 740, 860, 0.5);
  mottle(g, W, H, 70, 'rgba(240,230,150,A)', 30, 120, 0.14, 11);
  mottle(g, W, H, 50, 'rgba(40,50,10,A)', 30, 140, 0.12, 13);
  grain(g, W, H, 0.16);
  return { c, face: 1, eyes: [{ cx: 268, cy: 322, rx: 68, ry: 70, col: '#a2a85c' }] };
}

// ───────────── Seestern ─────────────
function star() {
  const W = 620, H = 600; const [c, g] = mk(W, H);
  const cx = 310, cy = 305;
  const shape = () => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 118 : 275; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.closePath(); };
  g.save(); g.lineJoin = 'round'; g.lineWidth = 70; g.strokeStyle = '#d96d66'; shape(); g.stroke(); g.restore();
  const sg = g.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, 300); sg.addColorStop(0, '#f9a98c'); sg.addColorStop(0.5, '#e4796d'); sg.addColorStop(1, '#a8434c');
  g.fillStyle = sg; shape(); g.fill();
  // Noppen
  g.save(); g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; for (let k = 1; k <= 6; k++) for (let s = -1; s <= 1; s++) { const d = 45 + k * 36, off = s * (24 - k * 3); if (off === 0 && k % 2) continue; const x = cx + Math.cos(a) * d - Math.sin(a) * off, y = cy + Math.sin(a) * d + Math.cos(a) * off; const rr = 9 - k * 0.8; const dg = g.createRadialGradient(x - 2, y - 2, 1, x, y, rr); dg.addColorStop(0, 'rgba(255,205,180,.9)'); dg.addColorStop(1, 'rgba(200,90,90,.5)'); g.fillStyle = dg; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); } }
  g.restore();
  // Gesicht: verschlafene Augen mit schweren Lidern, Brauen, Lächeln
  eye(g, 268, 290, 24, 20, { px: 0.25, py: 0.15, pr: 0.55, white: '#f6ecdc', lid: 0.5, lidCol: '#e07e78', lidLine: 'rgba(90,30,30,.6)', rim: 'rgba(90,30,30,.4)' });
  eye(g, 352, 290, 24, 20, { px: 0.25, py: 0.15, pr: 0.55, white: '#f6ecdc', lid: 0.5, lidCol: '#e07e78', lidLine: 'rgba(90,30,30,.6)', rim: 'rgba(90,30,30,.4)' });
  g.strokeStyle = 'rgba(90,30,30,.55)'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(240, 252); g.quadraticCurveTo(268, 236, 296, 256); g.stroke(); g.beginPath(); g.moveTo(326, 254); g.quadraticCurveTo(354, 238, 382, 252); g.stroke();
  g.strokeStyle = 'rgba(90,30,30,.7)'; g.lineWidth = 6; g.beginPath(); g.moveTo(272, 332); g.quadraticCurveTo(312, 362, 352, 330); g.stroke();
  blush(g, 240, 320, 30, 18, 0.35); blush(g, 384, 320, 30, 18, 0.35);
  light(g, W, H, 220, 170, 330, 0.34, 430, 480, 360, 0.42);
  mottle(g, W, H, 50, 'rgba(255,180,160,A)', 20, 80, 0.16, 5); mottle(g, W, H, 40, 'rgba(120,30,40,A)', 20, 90, 0.12, 9);
  grain(g, W, H, 0.16);
  return { c, face: 1, eyes: [{ cx: 268, cy: 292, rx: 28, ry: 22, col: '#e07e78' }, { cx: 352, cy: 292, rx: 28, ry: 22, col: '#e07e78' }] };
}

// ───────────── Qualle: Buch-Schirm mit Gesicht, vollständige Tentakel ─────────────
function jelly(img) {
  const W = 420, H = 920; const [c, g] = mk(W, H);
  const ox = (W - img.width) / 2;   // Sprite mittig
  // Tentakel unter dem Schirm (lang, durchscheinend)
  const roots = [[-95, 0], [-70, 6], [-40, 10], [-12, 12], [16, 12], [44, 10], [72, 6], [96, 0]];
  const baseY = 300;
  roots.forEach(([rx, dy], i) => {
    const x0 = W / 2 + rx * 0.98, y0 = baseY + dy;
    const len = 330 + (i % 3) * 60 + (i % 2) * 40;
    const w0 = i % 2 ? 14 : 20;
    g.save(); g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.lineWidth = pass ? w0 * 0.45 : w0;
      g.strokeStyle = pass ? 'rgba(245,225,255,.55)' : 'rgba(178,120,225,.62)';
      g.beginPath(); g.moveTo(x0, y0);
      const s1 = (i % 2 ? 1 : -1) * (26 + i * 3), s2 = -s1 * 0.9;
      g.bezierCurveTo(x0 + s1, y0 + len * 0.35, x0 + s2, y0 + len * 0.7, x0 + s1 * 0.5, y0 + len);
      g.stroke();
    }
    g.restore();
  });
  // Rüschen-Tentakel (kurz, gekräuselt)
  g.save(); g.strokeStyle = 'rgba(230,190,255,.5)'; g.lineWidth = 6; g.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const x0 = W / 2 - 105 + i * 19; g.beginPath(); g.moveTo(x0, baseY + 4); for (let k = 1; k <= 8; k++) g.quadraticCurveTo(x0 + (k % 2 ? 9 : -9), baseY + k * 22 - 10, x0, baseY + k * 22); g.stroke(); }
  g.restore();
  // Schirm aus dem Buch, unterer Rand weich ausgeblendet
  const [t, tg] = mk(img.width, img.height); tg.drawImage(img, 0, 0);
  const fade = tg.createLinearGradient(0, img.height - 120, 0, img.height); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
  tg.globalCompositeOperation = 'destination-out'; tg.fillStyle = fade; tg.fillRect(0, img.height - 120, img.width, 120);
  g.drawImage(t, ox, 0);
  return { c, face: 1, eyes: [{ cx: 62 + ox, cy: 150, rx: 25, ry: 26, col: '#c9a4ee' }, { cx: 143 + ox, cy: 145, rx: 27, ry: 26, col: '#c9a4ee' }] };
}

// ───────────── Mama und Papa: aus Fidibus abgeleitet ─────────────
function parent(img, kind) {
  const S = 1.5, W = Math.round(img.width * S), H = Math.round(img.height * S); const [c, g] = mk(W, H);
  g.drawImage(img, 0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'source-atop';
  if (kind === 'mama') { g.fillStyle = 'rgba(255,215,140,.22)'; g.fillRect(0, 0, W, H); }
  else { g.fillStyle = 'rgba(150,55,20,.22)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(80,30,10,.10)'; g.fillRect(0, 0, W, H); }
  g.restore();
  // Auge von fid_happy: (90,119) r 32x31 im Original; Bild blickt nach links
  const ex = 90 * S, ey = 119 * S, rx = 32 * S, ry = 31 * S;
  if (kind === 'mama') {
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3.5 * S / 1.5; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = -2.1 - i * 0.32; const x0 = ex + Math.cos(a) * rx * 0.95, y0 = ey + Math.sin(a) * ry * 0.95; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * 14, y0 + Math.sin(a) * 14); g.stroke(); }
    blush(g, ex + 30, ey + 40, 34, 20, 0.3);
  } else {
    // Papa: etwas kräftigere Braue
    g.strokeStyle = 'rgba(90,40,10,.75)'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - rx * 0.9, ey - ry * 1.25); g.quadraticCurveTo(ex, ey - ry * 1.5, ex + rx * 0.9, ey - ry * 1.2); g.stroke();
  }
  grain(g, W, H, 0.06);
  return { c, face: -1, eyes: [{ cx: ex, cy: ey, rx: rx, ry: ry, col: kind === 'mama' ? '#f6a03a' : '#d9731c' }] };
}

window.FIG = {
  build(IMG) {
    const out = {};
    out.whale = whale(); out.turtle = turtle(); out.star = star();
    if (IMG.jelly && IMG.jelly.width) out.jelly = jelly(IMG.jelly);
    if (IMG.fid_happy && IMG.fid_happy.width) { out.mama = parent(IMG.fid_happy, 'mama'); out.papa = parent(IMG.fid_happy, 'papa'); }
    return out;
  }
};
})();
