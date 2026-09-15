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

// ───────────── gemeinsame Stil-Helfer ─────────────
const LINE = 'rgba(35,28,20,.62)';
function stroke(g, w, col = LINE) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; }
function speckle(g, clipFn, n, col, r0, r1, seed) {
  let sd = seed; const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  g.save(); clipFn(); g.clip(); g.fillStyle = col;
  for (let i = 0; i < n; i++) { const x = rnd() * g.canvas.width, y = rnd() * g.canvas.height, r = r0 + rnd() * (r1 - r0); g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, TAU); g.fill(); }
  g.restore();
}

// ───────────── Wal (blickt nach links) ─────────────
function whale() {
  const W = 1500, H = 820; const [c, g] = mk(W, H);
  const body = () => { g.beginPath(); g.moveTo(160, 440); g.bezierCurveTo(150, 260, 260, 90, 470, 75); g.bezierCurveTo(700, 60, 950, 150, 1110, 260); g.bezierCurveTo(1190, 310, 1240, 330, 1265, 342); g.bezierCurveTo(1235, 385, 1150, 450, 1010, 520); g.bezierCurveTo(830, 620, 560, 730, 360, 690); g.bezierCurveTo(235, 665, 170, 570, 160, 440); g.closePath(); };
  // Schwanzflosse mit Kerbe und hellen Spitzen
  const fluke = () => { g.beginPath(); g.moveTo(1225, 330); g.quadraticCurveTo(1320, 180, 1470, 150); g.quadraticCurveTo(1430, 260, 1330, 340); g.quadraticCurveTo(1430, 420, 1470, 540); g.quadraticCurveTo(1320, 500, 1225, 360); g.closePath(); };
  const fgr = g.createLinearGradient(1220, 0, 1480, 0); fgr.addColorStop(0, '#2a5497'); fgr.addColorStop(1, '#4f83c7');
  g.fillStyle = fgr; fluke(); g.fill();
  g.save(); fluke(); g.clip(); stroke(g, 3, 'rgba(15,30,70,.35)'); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(1240, 340); g.quadraticCurveTo(1340, 200 + i * 70, 1450, 160 + i * 90); g.stroke(); } g.restore();
  // Körper
  const bg = g.createLinearGradient(0, 70, 0, 720); bg.addColorStop(0, '#6ea4de'); bg.addColorStop(0.45, '#3a6db8'); bg.addColorStop(1, '#1b3a76');
  g.fillStyle = bg; body(); g.fill();
  // Hautstruktur: dunkle Marmorierung oben, helle Sprenkel
  speckle(g, body, 90, 'rgba(20,45,110,.22)', 12, 40, 21);
  speckle(g, body, 160, 'rgba(190,220,255,.16)', 3, 9, 33);
  g.save(); body(); g.clip();
  // Rückenglanz
  const shine = g.createLinearGradient(0, 90, 0, 260); shine.addColorStop(0, 'rgba(255,255,255,.22)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = shine; g.beginPath(); g.moveTo(330, 130); g.quadraticCurveTo(600, 40, 1000, 200); g.quadraticCurveTo(700, 150, 340, 190); g.closePath(); g.fill();
  // Bauch mit Kehlfurchen (plastisch: jede Furche hell/dunkel)
  const belly = g.createLinearGradient(0, 470, 0, 720); belly.addColorStop(0, 'rgba(205,225,242,0)'); belly.addColorStop(0.3, 'rgba(208,226,242,.94)'); belly.addColorStop(1, 'rgba(150,182,215,.96)');
  g.fillStyle = belly; g.beginPath(); g.moveTo(150, 520); g.bezierCurveTo(330, 600, 700, 720, 1120, 470); g.lineTo(1200, 760); g.lineTo(120, 760); g.closePath(); g.fill();
  for (let i = 0; i < 9; i++) {
    g.beginPath(); g.moveTo(185 + i * 14, 540 + i * 20); g.quadraticCurveTo(520 + i * 20, 690 + i * 8, 960 - i * 14, 555 + i * 12);
    stroke(g, 4, 'rgba(60,90,140,.35)'); g.stroke(); g.beginPath(); g.moveTo(185 + i * 14, 545 + i * 20); g.quadraticCurveTo(520 + i * 20, 695 + i * 8, 960 - i * 14, 560 + i * 12); stroke(g, 2, 'rgba(255,255,255,.35)'); g.stroke();
  }
  // Maul: riesig, weit offen; Barten als feine Streifen, Zunge innen
  const mouth = () => { g.beginPath(); g.moveTo(158, 415); g.quadraticCurveTo(420, 375, 700, 470); g.quadraticCurveTo(640, 560, 500, 610); g.quadraticCurveTo(330, 660, 205, 590); g.quadraticCurveTo(165, 540, 158, 415); g.closePath(); };
  g.fillStyle = '#0b183a'; mouth(); g.fill();
  g.save(); mouth(); g.clip();
  const tg = g.createRadialGradient(420, 640, 20, 420, 640, 220); tg.addColorStop(0, '#ec93a8'); tg.addColorStop(1, '#8a3350');
  g.fillStyle = tg; g.beginPath(); g.ellipse(430, 650, 210, 70, -0.08, 0, TAU); g.fill();
  stroke(g, 2, 'rgba(120,40,70,.35)'); g.beginPath(); g.moveTo(260, 640); g.quadraticCurveTo(430, 600, 600, 630); g.stroke();
  // Barten (Oberkiefer)
  stroke(g, 2, 'rgba(200,210,230,.35)'); for (let x = 190; x < 690; x += 11) { g.beginPath(); g.moveTo(x, 395 + (x - 158) * 0.16); g.lineTo(x + 6, 440 + (x - 158) * 0.16); g.stroke(); }
  const th = g.createLinearGradient(0, 400, 0, 560); th.addColorStop(0, 'rgba(15,35,90,.95)'); th.addColorStop(1, 'rgba(15,35,90,0)');
  g.fillStyle = th; g.fillRect(150, 380, 600, 200);
  g.restore();
  // Lippen und Mundwinkel-Falte
  stroke(g, 9, 'rgba(15,30,70,.7)'); g.beginPath(); g.moveTo(158, 415); g.quadraticCurveTo(420, 375, 700, 470); g.stroke();
  stroke(g, 6, 'rgba(210,230,250,.55)'); g.beginPath(); g.moveTo(190, 585); g.quadraticCurveTo(330, 668, 505, 612); g.stroke();
  stroke(g, 4, 'rgba(15,30,70,.4)'); g.beginPath(); g.moveTo(700, 470); g.quadraticCurveTo(730, 440, 760, 445); g.stroke();
  g.restore();
  // Brustflosse: breit, mit hellem Rand und Adern
  const fin = () => { g.beginPath(); g.moveTo(600, 560); g.quadraticCurveTo(560, 700, 430, 760); g.quadraticCurveTo(470, 650, 560, 600); g.quadraticCurveTo(620, 570, 690, 580); g.closePath(); };
  const fg2 = g.createLinearGradient(430, 0, 690, 0); fg2.addColorStop(0, '#4a80c6'); fg2.addColorStop(1, '#24499a');
  g.fillStyle = fg2; fin(); g.fill(); stroke(g, 3, 'rgba(15,30,70,.45)'); g.stroke();
  g.save(); fin(); g.clip(); stroke(g, 2, 'rgba(200,225,255,.3)'); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(640 - i * 18, 575 + i * 8); g.quadraticCurveTo(560 - i * 10, 650, 450 + i * 10, 745 - i * 8); g.stroke(); } g.restore();
  // Rückenflosse
  g.fillStyle = '#2f5ea8'; g.beginPath(); g.moveTo(900, 120); g.quadraticCurveTo(950, 45, 1010, 80); g.quadraticCurveTo(980, 130, 1020, 185); g.closePath(); g.fill(); stroke(g, 3, 'rgba(15,30,70,.4)'); g.stroke();
  // Blasloch
  g.fillStyle = 'rgba(15,30,70,.55)'; g.beginPath(); g.ellipse(560, 100, 14, 6, -0.3, 0, TAU); g.fill();
  // Auge: klein, mit Lid, Falten
  eye(g, 600, 320, 30, 34, { px: -0.2, py: 0.05, pr: 0.62, white: '#eef4fb', iris: '#3a2a20', lid: 0.35, lidCol: '#4577c0', lidLine: 'rgba(20,40,90,.55)', rim: 'rgba(20,40,90,.45)' });
  stroke(g, 5, 'rgba(20,40,90,.45)'); g.beginPath(); g.moveTo(565, 282); g.quadraticCurveTo(600, 266, 636, 284); g.stroke();
  stroke(g, 3, 'rgba(20,40,90,.3)'); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(640 + i * 8, 300 + i * 12); g.quadraticCurveTo(660 + i * 8, 330, 645 + i * 8, 360); g.stroke(); }
  blush(g, 520, 400, 70, 40, 0.25);
  light(g, W, H, 450, 120, 760, 0.34, 980, 740, 900, 0.45);
  mottle(g, W, H, 60, 'rgba(120,180,240,A)', 40, 140, 0.16, 3); mottle(g, W, H, 40, 'rgba(10,30,80,A)', 40, 160, 0.12, 7);
  grain(g, W, H, 0.14);
  return { c, face: 1, eyes: [{ cx: 600, cy: 322, rx: 36, ry: 40, col: '#4577c0' }] };
}

// ───────────── Oma-Schildkröte (blickt nach links); opts.hug = umarmt Fidibus ─────────────
function turtle(opts = {}) {
  const W = 1300, H = 820; const [c, g] = mk(W, H); const hug = !!opts.hug;
  const skin = g.createLinearGradient(0, 150, 0, 720); skin.addColorStop(0, '#c2c078'); skin.addColorStop(0.5, '#979e55'); skin.addColorStop(1, '#5a6430');
  const scales = (clipFn, x0, y0, cols, rows, r, step, a = 0.3) => { g.save(); clipFn(); g.clip(); for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const x = x0 + i * step + (j % 2) * step / 2, y = y0 + j * step * 0.9; const sg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); sg.addColorStop(0, `rgba(235,230,170,${a * 0.8})`); sg.addColorStop(1, `rgba(50,60,20,${a * 0.6})`); g.fillStyle = sg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); stroke(g, 1.5, `rgba(50,60,20,${a})`); g.stroke(); } g.restore(); };
  const tail = () => { g.beginPath(); g.moveTo(1140, 470); g.quadraticCurveTo(1240, 470, 1275, 520); g.quadraticCurveTo(1210, 535, 1140, 520); g.closePath(); };
  const rear = () => { g.beginPath(); g.moveTo(1000, 560); g.quadraticCurveTo(1130, 560, 1225, 665); g.quadraticCurveTo(1100, 665, 960, 610); g.closePath(); };
  g.fillStyle = '#6f7a3c'; tail(); g.fill(); rear(); g.fill(); scales(rear, 990, 570, 6, 4, 13, 34, 0.25); stroke(g, 3, 'rgba(45,50,18,.45)'); rear(); g.stroke();
  const neck = () => { g.beginPath(); g.moveTo(400, 250); g.quadraticCurveTo(500, 210, 600, 260); g.lineTo(600, 500); g.quadraticCurveTo(500, 545, 400, 495); g.closePath(); };
  g.fillStyle = skin; neck(); g.fill(); scales(neck, 400, 255, 6, 8, 15, 40, 0.28);
  g.save(); neck(); g.clip(); stroke(g, 3, 'rgba(45,50,18,.4)'); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(405, 300 + i * 42); g.quadraticCurveTo(500, 280 + i * 42, 595, 310 + i * 42); g.stroke(); } g.restore();
  // Vorderflosse: normal = Paddel nach links vorn; hug = nach oben gebogen, umschließt Fidibus
  const flip = hug
    ? () => { g.beginPath(); g.moveTo(600, 470); g.quadraticCurveTo(470, 585, 320, 610); g.quadraticCurveTo(200, 625, 170, 545); g.quadraticCurveTo(160, 470, 240, 445); g.quadraticCurveTo(300, 430, 330, 470); g.quadraticCurveTo(400, 445, 520, 425); g.quadraticCurveTo(570, 418, 600, 430); g.closePath(); }
    : () => { g.beginPath(); g.moveTo(600, 480); g.quadraticCurveTo(470, 560, 280, 600); g.quadraticCurveTo(150, 630, 80, 610); g.quadraticCurveTo(70, 560, 140, 535); g.quadraticCurveTo(300, 470, 460, 430); g.quadraticCurveTo(560, 410, 600, 430); g.closePath(); };
  const drawFlip = () => {
    const fg = g.createLinearGradient(0, 430, 0, 630); fg.addColorStop(0, '#bdbd72'); fg.addColorStop(1, '#66703a');
    g.fillStyle = fg; flip(); g.fill(); scales(flip, 90, 445, 13, 6, 15, 42, 0.3);
    g.save(); flip(); g.clip(); stroke(g, 3, 'rgba(45,50,18,.45)'); g.beginPath(); if (hug) { g.moveTo(600, 470); g.quadraticCurveTo(470, 585, 320, 610); } else { g.moveTo(600, 480); g.quadraticCurveTo(470, 560, 280, 600); } g.stroke(); g.restore();
    stroke(g, 3, 'rgba(45,50,18,.35)'); flip(); g.stroke();
  };
  if (!hug) drawFlip();
  const head = () => { g.beginPath(); g.moveTo(120, 330); g.bezierCurveTo(115, 220, 210, 150, 330, 155); g.bezierCurveTo(450, 160, 520, 240, 515, 340); g.bezierCurveTo(510, 440, 420, 500, 300, 495); g.bezierCurveTo(190, 490, 125, 430, 120, 330); g.closePath(); };
  g.fillStyle = skin; head(); g.fill(); scales(head, 120, 160, 10, 9, 16, 44, 0.26);
  g.save(); head(); g.clip();
  const hl = g.createRadialGradient(250, 210, 10, 300, 300, 260); hl.addColorStop(0, 'rgba(255,250,200,.28)'); hl.addColorStop(1, 'rgba(255,250,200,0)'); g.fillStyle = hl; g.fillRect(100, 140, 450, 380);
  stroke(g, 3, 'rgba(45,50,18,.45)'); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(200 + i * 25, 205 + i * 12); g.quadraticCurveTo(300, 185 + i * 12, 400 - i * 10, 210 + i * 12); g.stroke(); }
  g.restore();
  stroke(g, 3, 'rgba(45,50,18,.35)'); head(); g.stroke();
  const shell = () => { g.beginPath(); g.moveTo(440, 545); g.bezierCurveTo(410, 280, 540, 90, 790, 80); g.bezierCurveTo(1030, 70, 1180, 280, 1180, 520); g.bezierCurveTo(1120, 575, 720, 590, 440, 545); g.closePath(); };
  const sg = g.createRadialGradient(640, 190, 30, 800, 330, 540); sg.addColorStop(0, '#d8d094'); sg.addColorStop(0.45, '#8f9350'); sg.addColorStop(1, '#3a4320');
  g.fillStyle = sg; shell(); g.fill();
  g.save(); shell(); g.clip();
  let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const plate = (x, y, r, rot) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + rot; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
  for (let row = 0; row < 4; row++) for (let i = 0; i < 8; i++) {
    const big = row === 1 || row === 2; const r = (big ? 62 : 48) + (rnd() - 0.5) * 8;
    const x = 480 + i * 108 + (row % 2) * 54 + (rnd() - 0.5) * 14, y = 165 + row * 100 + Math.abs(i - 3.5) * 16 + (rnd() - 0.5) * 12, rot = Math.PI / 6 + (rnd() - 0.5) * 0.25;
    const pg = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r); pg.addColorStop(0, 'rgba(240,232,170,.5)'); pg.addColorStop(0.6, 'rgba(130,135,65,.15)'); pg.addColorStop(1, 'rgba(30,35,10,.5)');
    g.fillStyle = pg; plate(x, y, r, rot); g.fill();
    stroke(g, 8, 'rgba(35,40,12,.8)'); plate(x, y, r - 4, rot); g.stroke();
    for (let k = 1; k <= 3; k++) { stroke(g, 1.5, `rgba(240,232,170,${0.28 - k * 0.06})`); plate(x + k * 3, y + k * 3, r - 8 - k * 11, rot); g.stroke(); }
  }
  speckle(g, shell, 26, 'rgba(60,110,60,.22)', 10, 30, 41); speckle(g, shell, 40, 'rgba(240,235,200,.18)', 2, 6, 43);
  const rim = g.createLinearGradient(0, 470, 0, 600); rim.addColorStop(0, 'rgba(90,100,45,0)'); rim.addColorStop(0.45, 'rgba(130,135,64,.96)'); rim.addColorStop(1, 'rgba(55,60,28,1)');
  g.fillStyle = rim; g.fillRect(400, 460, 820, 150);
  stroke(g, 4, 'rgba(35,40,12,.6)'); g.beginPath(); g.moveTo(440, 520); g.quadraticCurveTo(790, 565, 1180, 500); g.stroke();
  for (let i = 0; i < 14; i++) { const x = 470 + i * 52; g.beginPath(); g.moveTo(x, 525 + Math.sin(i / 13 * Math.PI) * 30); g.lineTo(x + 6, 580); g.stroke(); stroke(g, 2, 'rgba(240,232,170,.25)'); g.beginPath(); g.moveTo(x + 8, 528 + Math.sin(i / 13 * Math.PI) * 30); g.lineTo(x + 14, 580); g.stroke(); stroke(g, 4, 'rgba(35,40,12,.6)'); }
  g.restore();
  stroke(g, 3, 'rgba(35,40,12,.45)'); shell(); g.stroke();
  // Auge: normal groß mit schwerem Lid; beim Umarmen zufrieden geschlossen
  if (hug) {
    stroke(g, 7, 'rgba(50,45,15,.7)'); g.beginPath(); g.moveTo(215, 325); g.quadraticCurveTo(268, 285, 322, 325); g.stroke();
    stroke(g, 4, 'rgba(50,45,15,.35)'); g.beginPath(); g.moveTo(230, 345); g.quadraticCurveTo(268, 360, 306, 345); g.stroke();
  } else {
    eye(g, 268, 318, 62, 66, { px: -0.05, py: 0.1, pr: 0.74, iris: '#7a5230', iris2: '#2a1a0c', lid: 0.42, lidCol: '#a8ad60', lidLine: 'rgba(50,45,15,.65)', rim: 'rgba(50,45,15,.45)' });
    stroke(g, 4, 'rgba(50,45,15,.4)'); g.beginPath(); g.moveTo(215, 372); g.quadraticCurveTo(268, 392, 322, 372); g.stroke();
  }
  stroke(g, 7, 'rgba(50,45,15,.55)'); g.beginPath(); g.moveTo(200, 238); g.quadraticCurveTo(268, 205, 340, 240); g.stroke();
  g.fillStyle = 'rgba(50,45,15,.6)'; g.beginPath(); g.ellipse(150, 365, 7, 5, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(168, 372, 5, 4, 0, 0, TAU); g.fill();
  stroke(g, 7, 'rgba(45,40,15,.78)'); g.beginPath(); g.moveTo(135, 405); g.quadraticCurveTo(250, hug ? 470 : 460, 385, 415); g.stroke();
  stroke(g, 4, 'rgba(45,40,15,.5)'); g.beginPath(); g.moveTo(380, 413); g.quadraticCurveTo(398, 402, 400, 388); g.stroke();
  blush(g, 240, 410, 60, 34, hug ? 0.42 : 0.3);
  if (hug) {
    // Fidibus im Arm (kleiner, leicht geneigt, glücklich mit geschlossenen Augen), dann Flosse darüber
    const f = fish({ kind: 'fid', mouth: 'smile', eyes: 'closed' }).c;
    g.save(); g.translate(318, 425); g.rotate(-0.45); g.scale(-0.78, 0.78); g.drawImage(f, -f.width / 2, -f.height / 2); g.restore();
    drawFlip();
  }
  light(g, W, H, 540, 140, 780, 0.34, 1060, 740, 860, 0.5);
  mottle(g, W, H, 70, 'rgba(240,230,150,A)', 30, 120, 0.14, 11); mottle(g, W, H, 50, 'rgba(40,50,10,A)', 30, 140, 0.12, 13);
  grain(g, W, H, 0.16);
  return { c, face: 1, eyes: hug ? [] : [{ cx: 268, cy: 322, rx: 68, ry: 70, col: '#a8ad60' }] };
}

// ───────────── Fische (Fidibus, Mama, Papa) – gemalt, Blick nach links ─────────────
// opts: kind 'fid'|'mama'|'papa', mouth 'smile'|'open'|'sad', eyes 'open'|'closed', worried, front
function fish(opts = {}) {
  const kind = opts.kind || 'fid';
  const W = 460, H = 380; const [c, g] = mk(W, H);
  const pal = kind === 'mama' ? { top: '#ffb650', mid: '#fb9a2e', low: '#d86f14', belly: '#ffd98a', fin: '#d6e06a', fin2: '#8fb23a' }
            : kind === 'papa' ? { top: '#ff9a34', mid: '#ea7a18', low: '#b3540c', belly: '#f9bd66', fin: '#bfc95a', fin2: '#789a30' }
            : { top: '#ffa53a', mid: '#f5851f', low: '#c85e10', belly: '#ffd27a', fin: '#cfdb5e', fin2: '#86ad36' };
  const finGrad = (x0, y0, x1, y1) => { const fg = g.createLinearGradient(x0, y0, x1, y1); fg.addColorStop(0, pal.fin); fg.addColorStop(1, pal.fin2); return fg; };
  const rays = (pts, n, col) => { stroke(g, 2, col); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); const x = pts[1][0] + (pts[2][0] - pts[1][0]) * t, y = pts[1][1] + (pts[2][1] - pts[1][1]) * t; g.quadraticCurveTo((pts[0][0] + x) / 2 + 6, (pts[0][1] + y) / 2 + (t - 0.5) * 20, x, y); g.stroke(); } };
  if (opts.front) {
    // Frontalansicht: runder Körper, zwei Augen, Flossen seitlich
    const cx = 230, cy = 200;
    for (const sx of [-1, 1]) { g.save(); g.translate(cx, cy); g.scale(sx, 1); g.fillStyle = finGrad(120, 200, 190, 260); g.globalAlpha = 0.9; g.beginPath(); g.moveTo(110, 20); g.quadraticCurveTo(170, 20, 195, 70); g.quadraticCurveTo(160, 75, 110, 50); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = finGrad(230, 40, 230, 110); g.globalAlpha = 0.95; g.beginPath(); g.moveTo(cx - 40, cy - 105); g.quadraticCurveTo(cx, cy - 175, cx + 40, cy - 105); g.closePath(); g.fill(); g.globalAlpha = 1;
    const body = () => { g.beginPath(); g.ellipse(cx, cy, 128, 122, 0, 0, TAU); g.closePath(); };
    const bg = g.createRadialGradient(cx - 50, cy - 60, 10, cx, cy, 150); bg.addColorStop(0, pal.top); bg.addColorStop(0.55, pal.mid); bg.addColorStop(1, pal.low);
    g.fillStyle = bg; body(); g.fill();
    g.save(); body(); g.clip(); const bl = g.createRadialGradient(cx, cy + 70, 10, cx, cy + 60, 110); bl.addColorStop(0, pal.belly); bl.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = bl; g.fillRect(0, 0, W, H);
    stroke(g, 1.5, 'rgba(150,60,10,.25)'); for (let r = 0; r < 4; r++) for (let i = -3; i <= 3; i++) { g.beginPath(); g.arc(cx + i * 34 + (r % 2) * 17, cy - 90 + r * 26, 14, 0.2, Math.PI - 0.2); g.stroke(); } g.restore();
    const eyeOpts = { px: 0, py: 0.1, pr: 0.62, iris: '#6b4a2c', iris2: '#1c120a', lid: opts.worried ? 0.3 : 0.14, lidCol: pal.mid, lidLine: 'rgba(120,50,10,.5)', rim: 'rgba(120,50,10,.35)' };
    for (const sx of [-1, 1]) { if (opts.eyes === 'closed') { stroke(g, 5, 'rgba(120,50,10,.7)'); g.beginPath(); g.moveTo(cx + sx * 50 - 22, cy - 12); g.quadraticCurveTo(cx + sx * 50, cy - 40, cx + sx * 50 + 22, cy - 12); g.stroke(); } else eye(g, cx + sx * 50, cy - 20, 30, 34, eyeOpts); if (kind === 'mama') { stroke(g, 3.5, 'rgba(60,30,10,.85)'); for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + sx * (50 + i * 14), cy - 52); g.lineTo(cx + sx * (50 + i * 16) + sx * 4, cy - 66); g.stroke(); } } }
    if (kind === 'papa') { stroke(g, 6, 'rgba(120,50,10,.7)'); for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 24, cy - 60); g.quadraticCurveTo(cx + sx * 52, cy - 76, cx + sx * 80, cy - 60); g.stroke(); } }
    if (opts.mouth === 'open') { g.fillStyle = '#7a2438'; g.beginPath(); g.ellipse(cx, cy + 52, 34, 26, 0, 0, TAU); g.fill(); g.fillStyle = '#e8788f'; g.beginPath(); g.ellipse(cx, cy + 66, 22, 12, 0, 0, TAU); g.fill(); stroke(g, 4, 'rgba(120,50,10,.7)'); g.beginPath(); g.ellipse(cx, cy + 52, 34, 26, 0, 0, TAU); g.stroke(); }
    else { g.fillStyle = '#7a2438'; g.beginPath(); g.moveTo(cx - 36, cy + 40); g.quadraticCurveTo(cx, cy + 92, cx + 36, cy + 40); g.quadraticCurveTo(cx, cy + 58, cx - 36, cy + 40); g.closePath(); g.fill(); stroke(g, 4.5, 'rgba(120,50,10,.7)'); g.beginPath(); g.moveTo(cx - 36, cy + 40); g.quadraticCurveTo(cx, cy + 92, cx + 36, cy + 40); g.stroke(); }
    blush(g, cx - 82, cy + 22, 28, 18, 0.4); blush(g, cx + 82, cy + 22, 28, 18, 0.4);
    light(g, W, H, cx - 60, cy - 90, 240, 0.24, cx + 80, cy + 110, 220, 0.3);
    mottle(g, W, H, 24, 'rgba(255,225,160,A)', 15, 60, 0.14, 21); mottle(g, W, H, 12, 'rgba(150,50,10,A)', 15, 50, 0.08, 23);
    grain(g, W, H, 0.1);
    return { c, face: 1, eyes: opts.eyes === 'closed' ? [] : [{ cx: cx - 50, cy: cy - 18, rx: 34, ry: 38, col: pal.mid }, { cx: cx + 50, cy: cy - 18, rx: 34, ry: 38, col: pal.mid }] };
  }
  // Seitenansicht (Kopf links)
  const cx = 225, cy = 195;
  // Schwanzflosse: groß, gefächert
  g.fillStyle = finGrad(320, 190, 455, 190); g.globalAlpha = 0.94;
  g.beginPath(); g.moveTo(322, 170); g.quadraticCurveTo(370, 95, 452, 72); g.quadraticCurveTo(422, 150, 428, 195); g.quadraticCurveTo(422, 240, 452, 318); g.quadraticCurveTo(370, 295, 322, 222); g.closePath(); g.fill(); g.globalAlpha = 1;
  rays([[330, 196], [448, 80], [448, 310]], 9, 'rgba(80,105,25,.4)');
  // Rückenflosse: hoch, gewellt
  g.fillStyle = finGrad(230, 30, 230, 110); g.globalAlpha = 0.95;
  g.beginPath(); g.moveTo(140, 108); g.quadraticCurveTo(170, 18, 240, 24); g.quadraticCurveTo(290, 28, 330, 112); g.closePath(); g.fill(); g.globalAlpha = 1;
  rays([[235, 112], [160, 45], [315, 65]], 7, 'rgba(80,105,25,.4)');
  // Bauchflossen
  g.fillStyle = finGrad(280, 285, 300, 350); g.globalAlpha = 0.92; g.beginPath(); g.moveTo(250, 292); g.quadraticCurveTo(280, 352, 335, 345); g.quadraticCurveTo(302, 305, 300, 278); g.closePath(); g.fill(); g.globalAlpha = 1;
  // Körper: vorn rund und dick, hinten zum Schwanz verjüngt
  const body = () => { g.beginPath(); g.moveTo(80, 198); g.bezierCurveTo(82, 112, 150, 72, 225, 76); g.bezierCurveTo(295, 80, 335, 125, 342, 190); g.bezierCurveTo(345, 255, 300, 312, 222, 314); g.bezierCurveTo(145, 314, 80, 275, 80, 198); g.closePath(); };
  const bg = g.createRadialGradient(145, 125, 8, cx, cy, 180); bg.addColorStop(0, pal.top); bg.addColorStop(0.5, pal.mid); bg.addColorStop(1, pal.low);
  g.fillStyle = bg; body(); g.fill();
  g.save(); body(); g.clip();
  const bl = g.createRadialGradient(165, 285, 10, 185, 262, 135); bl.addColorStop(0, pal.belly); bl.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = bl; g.fillRect(0, 0, W, H);
  stroke(g, 1.8, 'rgba(160,60,10,.3)'); for (let r = 0; r < 7; r++) for (let i = 0; i < 6; i++) { const x = 188 + i * 28 + (r % 2) * 14, y = 106 + r * 31; g.beginPath(); g.arc(x, y, 13, 0.25, Math.PI - 0.25); g.stroke(); }
  const sh = g.createRadialGradient(170, 110, 5, 190, 125, 90); sh.addColorStop(0, 'rgba(255,245,215,.55)'); sh.addColorStop(1, 'rgba(255,245,215,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H);
  const rimD = g.createLinearGradient(0, 240, 0, 320); rimD.addColorStop(0, 'rgba(120,40,0,0)'); rimD.addColorStop(1, 'rgba(120,40,0,.35)'); g.fillStyle = rimD; g.fillRect(0, 230, W, 100);
  g.restore();
  stroke(g, 2.5, 'rgba(150,60,10,.3)'); body(); g.stroke();
  // Brustflosse
  g.fillStyle = finGrad(175, 215, 120, 300); g.globalAlpha = 0.92; g.beginPath(); g.moveTo(178, 222); g.quadraticCurveTo(155, 285, 100, 305); g.quadraticCurveTo(125, 245, 160, 214); g.closePath(); g.fill(); g.globalAlpha = 1;
  rays([[176, 224], [140, 268], [104, 300]], 5, 'rgba(80,105,25,.4)');
  // Auge
  const ex = 140, ey = 160;
  if (opts.eyes === 'closed') { stroke(g, 5, 'rgba(120,50,10,.75)'); g.beginPath(); g.moveTo(ex - 26, ey + 6); g.quadraticCurveTo(ex, ey - 28, ex + 26, ey + 6); g.stroke(); }
  else {
    eye(g, ex, ey, 38, 42, { px: -0.12, py: opts.mouth === 'sad' ? 0.16 : 0.08, pr: 0.64, iris: '#6b4a2c', iris2: '#1c120a', lid: opts.worried ? 0.32 : 0.12, lidCol: pal.mid, lidLine: 'rgba(120,50,10,.5)', rim: 'rgba(120,50,10,.35)' });
    if (kind === 'mama') { stroke(g, 3.5, 'rgba(60,30,10,.85)'); for (let i = 0; i < 3; i++) { const a = -2.2 - i * 0.3; g.beginPath(); g.moveTo(ex + Math.cos(a) * 38, ey + Math.sin(a) * 42); g.lineTo(ex + Math.cos(a) * 52, ey + Math.sin(a) * 56); g.stroke(); } }
  }
  // Braue
  stroke(g, kind === 'papa' ? 6 : 4, 'rgba(120,50,10,.6)'); g.beginPath();
  if (opts.mouth === 'sad' || opts.worried) { g.moveTo(112, 112); g.quadraticCurveTo(140, 104, 172, 120); } else { g.moveTo(108, 118); g.quadraticCurveTo(140, 98, 174, 112); } g.stroke();
  // Mund
  if (opts.mouth === 'open') { g.fillStyle = '#7a2438'; g.beginPath(); g.ellipse(100, 222, 20, 24, -0.3, 0, TAU); g.fill(); g.fillStyle = '#e8788f'; g.beginPath(); g.ellipse(104, 234, 13, 9, -0.3, 0, TAU); g.fill(); stroke(g, 4, 'rgba(120,50,10,.7)'); g.beginPath(); g.ellipse(100, 222, 20, 24, -0.3, 0, TAU); g.stroke(); }
  else if (opts.mouth === 'sad') { g.fillStyle = '#7a2438'; g.beginPath(); g.ellipse(102, 228, 9, 11, 0, 0, TAU); g.fill(); stroke(g, 4, 'rgba(120,50,10,.7)'); g.beginPath(); g.ellipse(102, 228, 9, 11, 0, 0, TAU); g.stroke(); }
  else { g.fillStyle = '#7a2438'; g.beginPath(); g.moveTo(88, 214); g.quadraticCurveTo(105, 248, 138, 226); g.quadraticCurveTo(110, 232, 88, 214); g.closePath(); g.fill(); stroke(g, 4.5, 'rgba(120,50,10,.7)'); g.beginPath(); g.moveTo(88, 214); g.quadraticCurveTo(105, 248, 138, 226); g.stroke(); stroke(g, 3, 'rgba(120,50,10,.35)'); g.beginPath(); g.moveTo(138, 226); g.quadraticCurveTo(146, 220, 146, 212); g.stroke(); }
  blush(g, 125, 226, 30, 18, opts.mouth === 'sad' ? 0.2 : 0.4);
  light(g, W, H, 150, 100, 240, 0.22, 310, 300, 220, 0.3);
  mottle(g, W, H, 24, 'rgba(255,225,160,A)', 15, 60, 0.14, 21); mottle(g, W, H, 12, 'rgba(150,50,10,A)', 15, 50, 0.08, 23);
  grain(g, W, H, 0.1);
  return { c, face: -1, eyes: opts.eyes === 'closed' ? [] : [{ cx: ex, cy: ey + 2, rx: 42, ry: 46, col: pal.mid }] };
}

// ───────────── Seestern (freundlich) ─────────────
function star() {
  const W = 620, H = 600; const [c, g] = mk(W, H);
  const cx = 310, cy = 305;
  const shape = () => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 118 : 275; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.closePath(); };
  g.save(); g.lineJoin = 'round'; g.lineWidth = 70; g.strokeStyle = '#d96d66'; shape(); g.stroke(); g.restore();
  const sg = g.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, 300); sg.addColorStop(0, '#fbb094'); sg.addColorStop(0.5, '#e57a6c'); sg.addColorStop(1, '#a5424b');
  g.fillStyle = sg; shape(); g.fill();
  // Mittelrippe je Arm (leichte Erhebung) und Noppen
  g.save(); g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; const rg = g.createLinearGradient(cx, cy, cx + Math.cos(a) * 280, cy + Math.sin(a) * 280); rg.addColorStop(0, 'rgba(255,220,200,.25)'); rg.addColorStop(1, 'rgba(150,50,60,.25)'); g.fillStyle = rg; g.beginPath(); g.moveTo(cx + Math.cos(a - 0.35) * 110, cy + Math.sin(a - 0.35) * 110); g.lineTo(cx + Math.cos(a) * 275, cy + Math.sin(a) * 275); g.lineTo(cx + Math.cos(a + 0.35) * 110, cy + Math.sin(a + 0.35) * 110); g.closePath(); g.fill(); }
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; for (let k = 1; k <= 6; k++) for (let s = -1; s <= 1; s++) { const d = 45 + k * 36, off = s * (24 - k * 3); if (off === 0 && k % 2) continue; const x = cx + Math.cos(a) * d - Math.sin(a) * off, y = cy + Math.sin(a) * d + Math.cos(a) * off; const rr = 9 - k * 0.8; const dg = g.createRadialGradient(x - 2, y - 2, 1, x, y, rr); dg.addColorStop(0, 'rgba(255,215,190,.95)'); dg.addColorStop(1, 'rgba(190,80,80,.55)'); g.fillStyle = dg; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); } }
  g.restore();
  // Gesicht: offene, freundliche Augen, hohe Brauen, breites Lächeln
  eye(g, 266, 288, 27, 25, { px: 0.18, py: 0.12, pr: 0.6, white: '#fbf3e6', iris: '#5a3a2a', lid: 0.14, lidCol: '#e57a6c', lidLine: 'rgba(90,30,30,.55)', rim: 'rgba(90,30,30,.4)' });
  eye(g, 354, 288, 27, 25, { px: 0.18, py: 0.12, pr: 0.6, white: '#fbf3e6', iris: '#5a3a2a', lid: 0.14, lidCol: '#e57a6c', lidLine: 'rgba(90,30,30,.55)', rim: 'rgba(90,30,30,.4)' });
  stroke(g, 5, 'rgba(90,30,30,.5)'); g.beginPath(); g.moveTo(238, 246); g.quadraticCurveTo(266, 226, 296, 246); g.stroke(); g.beginPath(); g.moveTo(324, 246); g.quadraticCurveTo(354, 226, 382, 246); g.stroke();
  // Mund: breites Lachen mit hellem Innenraum
  g.fillStyle = '#7a2438'; g.beginPath(); g.moveTo(262, 330); g.quadraticCurveTo(310, 386, 358, 330); g.quadraticCurveTo(310, 346, 262, 330); g.closePath(); g.fill();
  g.fillStyle = '#f7d3d0'; g.beginPath(); g.moveTo(272, 333); g.quadraticCurveTo(310, 350, 348, 333); g.quadraticCurveTo(310, 343, 272, 333); g.closePath(); g.fill();
  stroke(g, 5, 'rgba(90,30,30,.7)'); g.beginPath(); g.moveTo(262, 330); g.quadraticCurveTo(310, 386, 358, 330); g.stroke();
  stroke(g, 3, 'rgba(90,30,30,.35)'); g.beginPath(); g.moveTo(256, 322); g.quadraticCurveTo(250, 332, 256, 342); g.stroke(); g.beginPath(); g.moveTo(364, 322); g.quadraticCurveTo(370, 332, 364, 342); g.stroke();
  blush(g, 232, 322, 32, 20, 0.4); blush(g, 388, 322, 32, 20, 0.4);
  light(g, W, H, 220, 170, 330, 0.34, 430, 480, 360, 0.42);
  mottle(g, W, H, 50, 'rgba(255,180,160,A)', 20, 80, 0.16, 5); mottle(g, W, H, 40, 'rgba(120,30,40,A)', 20, 90, 0.12, 9);
  grain(g, W, H, 0.16);
  return { c, face: 1, eyes: [{ cx: 266, cy: 290, rx: 31, ry: 27, col: '#e57a6c' }, { cx: 354, cy: 290, rx: 31, ry: 27, col: '#e57a6c' }] };
}

// ───────────── Qualle (komplett gemalt, Gesicht wie im Buch) ─────────────
function jelly() {
  const W = 460, H = 900; const [c, g] = mk(W, H);
  const cx = 230, top = 40, bw = 205, bh = 215, rimY = top + bh;   // Schirm: Kuppel
  const bell = () => { g.beginPath(); g.moveTo(cx - bw, rimY); g.bezierCurveTo(cx - bw, top + 30, cx - bw * 0.55, top, cx, top); g.bezierCurveTo(cx + bw * 0.55, top, cx + bw, top + 30, cx + bw, rimY); for (let i = 0; i < 6; i++) g.quadraticCurveTo(cx + bw - (i + 0.5) * bw / 3, rimY + 22, cx + bw - (i + 1) * bw / 3, rimY); g.closePath(); };
  // lange Tentakel (zuerst, liegen hinter dem Schirm)
  const roots = [[-150, 0], [-115, 8], [-75, 12], [-30, 14], [30, 14], [75, 12], [115, 8], [150, 0]];
  roots.forEach(([rx, dy], i) => {
    const x0 = cx + rx, y0 = rimY + dy, len = 380 + (i % 3) * 70 + (i % 2) * 40, w0 = i % 2 ? 12 : 18;
    const s1 = (i % 2 ? 1 : -1) * (26 + i * 3), s2 = -s1 * 0.9;
    for (let pass = 0; pass < 2; pass++) { stroke(g, pass ? w0 * 0.42 : w0, pass ? 'rgba(248,230,255,.55)' : 'rgba(178,120,225,.6)'); g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + s1, y0 + len * 0.35, x0 + s2, y0 + len * 0.7, x0 + s1 * 0.5, y0 + len); g.stroke(); }
  });
  // Mundarme (Rüschen)
  for (let i = 0; i < 4; i++) { const x0 = cx - 60 + i * 40; stroke(g, 8, 'rgba(225,185,255,.55)'); g.beginPath(); g.moveTo(x0, rimY); for (let k = 1; k <= 10; k++) g.quadraticCurveTo(x0 + (k % 2 ? 12 : -12), rimY + k * 26 - 13, x0 + (i - 1.5) * k * 1.2, rimY + k * 26); g.stroke(); stroke(g, 3, 'rgba(255,245,255,.5)'); g.beginPath(); g.moveTo(x0, rimY); for (let k = 1; k <= 10; k++) g.quadraticCurveTo(x0 + (k % 2 ? 12 : -12), rimY + k * 26 - 13, x0 + (i - 1.5) * k * 1.2, rimY + k * 26); g.stroke(); }
  // Schirm: durchscheinend, rosa-violett, innen leuchtend
  const bg = g.createRadialGradient(cx - 60, top + 60, 10, cx, top + 110, 240); bg.addColorStop(0, '#fbd2ee'); bg.addColorStop(0.4, '#d597ea'); bg.addColorStop(0.8, '#9c66d6'); bg.addColorStop(1, '#7448bd');
  g.fillStyle = bg; bell(); g.fill();
  g.save(); bell(); g.clip();
  // innere Kanäle und Glanz
  stroke(g, 3, 'rgba(255,255,255,.22)'); for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * 12, top + 40); g.quadraticCurveTo(cx + i * 50, top + 120, cx + i * 62, rimY); g.stroke(); }
  const inner = g.createRadialGradient(cx, top + 140, 10, cx, top + 140, 150); inner.addColorStop(0, 'rgba(255,240,255,.35)'); inner.addColorStop(1, 'rgba(255,240,255,0)'); g.fillStyle = inner; g.fillRect(0, 0, W, rimY + 30);
  const sheen = g.createLinearGradient(0, top, 0, top + 120); sheen.addColorStop(0, 'rgba(255,255,255,.45)'); sheen.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sheen; g.beginPath(); g.ellipse(cx - 50, top + 55, 120, 40, -0.2, 0, TAU); g.fill();
  const rimg = g.createLinearGradient(0, rimY - 70, 0, rimY + 20); rimg.addColorStop(0, 'rgba(90,50,170,0)'); rimg.addColorStop(1, 'rgba(90,50,170,.55)'); g.fillStyle = rimg; g.fillRect(0, rimY - 70, W, 100);
  // Saum
  stroke(g, 5, 'rgba(120,70,190,.5)'); g.beginPath(); g.moveTo(cx - bw, rimY); for (let i = 0; i < 6; i++) g.quadraticCurveTo(cx - bw + (i + 0.5) * bw / 3, rimY + 22, cx - bw + (i + 1) * bw / 3, rimY); g.stroke();
  g.restore();
  stroke(g, 3, 'rgba(120,70,190,.4)'); bell(); g.stroke();
  // Gesicht wie im Buch: große Augen mit schweren Lidern, kleines Lächeln, Wangen
  eye(g, cx - 70, top + 132, 36, 39, { px: 0.12, py: 0.12, pr: 0.7, white: '#fff8fc', iris: '#4a2f5a', iris2: '#1c1030', lid: 0.36, lidCol: '#d7a3ec', lidLine: 'rgba(110,60,150,.6)', rim: 'rgba(110,60,150,.45)' });
  eye(g, cx + 70, top + 128, 36, 39, { px: 0.12, py: 0.12, pr: 0.7, white: '#fff8fc', iris: '#4a2f5a', iris2: '#1c1030', lid: 0.36, lidCol: '#d7a3ec', lidLine: 'rgba(110,60,150,.6)', rim: 'rgba(110,60,150,.45)' });
  stroke(g, 4, 'rgba(110,60,150,.45)'); g.beginPath(); g.moveTo(cx - 104, top + 80); g.quadraticCurveTo(cx - 70, top + 62, cx - 36, top + 80); g.stroke(); g.beginPath(); g.moveTo(cx + 36, top + 76); g.quadraticCurveTo(cx + 70, top + 58, cx + 104, top + 76); g.stroke();
  stroke(g, 5, 'rgba(110,60,150,.7)'); g.beginPath(); g.moveTo(cx - 22, top + 178); g.quadraticCurveTo(cx, top + 200, cx + 22, top + 178); g.stroke();
  blush(g, cx - 118, top + 165, 34, 20, 0.5); blush(g, cx + 118, top + 162, 34, 20, 0.5);
  light(g, W, H, cx - 80, top + 40, 300, 0.3, cx + 120, rimY + 60, 320, 0.28);
  mottle(g, W, H, 40, 'rgba(255,200,255,A)', 20, 80, 0.16, 15); mottle(g, W, H, 30, 'rgba(90,40,160,A)', 20, 90, 0.12, 17);
  grain(g, W, H, 0.12);
  return { c, face: 1, eyes: [{ cx: cx - 70, cy: top + 134, rx: 40, ry: 42, col: '#d7a3ec' }, { cx: cx + 70, cy: top + 130, rx: 40, ry: 42, col: '#d7a3ec' }] };
}

window.FIG = {
  build() {
    const out = {};
    out.whale = whale(); out.turtle = turtle(); out.hug = turtle({ hug: true }); out.star = star(); out.jelly = jelly();
    out.fid_happy = fish({ kind: 'fid' }); out.fid_talk = fish({ kind: 'fid', mouth: 'open' }); out.fid_sad = fish({ kind: 'fid', mouth: 'sad', worried: true });
    out.fid_worried = fish({ kind: 'fid', worried: true }); out.fid_sleep = fish({ kind: 'fid', eyes: 'closed' }); out.fid_front = fish({ kind: 'fid', front: true });
    out.mama = fish({ kind: 'mama' }); out.papa = fish({ kind: 'papa' });
    return out;
  }
};
})();
