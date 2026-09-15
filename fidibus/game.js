// Fidibus und der Weg nach Hause – die Geschichte als Schwimmspiel.
// Reines Canvas 2D, keine Bibliotheken. Welt: x 0..WORLD_W, y 0..WORLD_H (Einheiten).
(() => {
'use strict';

const WORLD_W = 11200, WORLD_H = 1400;
const HOME = { x: 330, y: 1080 };
const POS = {
  whale: { x: 2700, y: 620 }, star: { x: 5000, y: 1245 }, dark: { x: 6600 }, jelly: { x: 8500, y: 620 },
  grassFrom: 8850, grassTo: 9650, turtle: { x: 10500, y: 1010 }
};
const STATIONS = [
  { id: 'home', icon: '🏠', name: 'Zuhause im Riff' }, { id: 'whale', icon: '🐋', name: 'Der Wal' }, { id: 'star', icon: '⭐', name: 'Der Seestern' },
  { id: 'dark', icon: '🌑', name: 'Das dunkle Wasser' }, { id: 'jelly', icon: '🪼', name: 'Die Qualle' }, { id: 'turtle', icon: '🐢', name: 'Oma-Schildkröte' },
  { id: 'parents', icon: '❤️', name: 'Mama und Papa' }, { id: 'way', icon: '🐟', name: 'Der Heimweg' }, { id: 'night', icon: '🌙', name: 'Gute Nacht' }
];

// ───────────── Canvas ─────────────
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
let W = 1, H = 1, DPR = 1, scale = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  scale = Math.max(W, H) / 1400 * (H > W ? 1.0 : 0.95);
  if (H > W) scale = Math.max(scale, W / 640);
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 250)); resize();

// ───────────── Hilfen ─────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ───────────── Ton ─────────────
let audio = null;
function tone(seq, type = 'sine', vol = 0.12) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    let t = audio.currentTime;
    for (const [f, d] of seq) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + d); t += d * 0.9;
    }
  } catch (e) { /* kein Ton */ }
}
const SFX = {
  bubble: () => tone([[700 + Math.random() * 300, 0.09]], 'sine', 0.08),
  talk: () => tone([[420, 0.06], [520, 0.08]], 'triangle', 0.06),
  station: () => tone([[523, 0.12], [659, 0.12], [784, 0.2]], 'sine', 0.1),
  zisch: () => tone([[300, 0.05], [600, 0.05], [1200, 0.12]], 'sawtooth', 0.05),
  hug: () => tone([[392, 0.2], [494, 0.2], [587, 0.35]], 'sine', 0.1),
  lullaby: () => tone([[392, 0.35], [440, 0.35], [392, 0.35], [330, 0.35], [294, 0.6], [262, 0.9]], 'sine', 0.09)
};

// ───────────── Zustand ─────────────
const G = {
  mode: 'title', t: 0, step: -1, stepData: null,
  cam: { x: HOME.x, y: 900 },
  fid: { x: HOME.x, y: HOME.y, vx: 0, vy: 0, dir: 1, tilt: 0, fin: 0, eyes: 'open', mood: 'happy', scale: 1, hidden: false },
  mama: { x: HOME.x - 70, y: HOME.y + 40, vx: 0, vy: 0, dir: 1, tilt: 0, fin: 0, eyes: 'closed', mood: 'sleep', hidden: false },
  papa: { x: HOME.x + 60, y: HOME.y + 50, vx: 0, vy: 0, dir: -1, tilt: 0, fin: 0, eyes: 'closed', mood: 'sleep', hidden: false },
  ctrl: null,             // welches Wesen gesteuert wird
  target: null, keys: {}, bubbles: 0, mut: 1, dark: 0, moon: 0, night: 0,
  collect: [], particles: [], hearts: [], trail: [],
  turtle: { hug: 0, blink: 0 }, jelly: { glow: 0 }, whale: { blink: 0 },
  stationsDone: new Set(), current: 'home', hintT: 0, fadeEyes: 0, dialogQueue: [], dialogIdx: 0, typed: 0, onDialogEnd: null,
  homeArrived: false
};

// Luftblasen zum Sammeln entlang des Wegs
function makeCollect() {
  G.collect = []; seed = 11;
  for (let x = 700; x < WORLD_W - 900; x += 230 + rnd() * 120) {
    if (x > POS.whale.x - 350 && x < POS.whale.x + 350) continue;
    if (x > POS.turtle.x - 400) continue;
    G.collect.push({ x, y: 260 + rnd() * 900, r: 16 + rnd() * 12, ph: rnd() * 6, got: false });
  }
}

// ───────────── Story-Ablauf ─────────────
const S = (who, text) => ({ who, text });
const STORY = [
  { type: 'cards', cards: [
    { kicker: 'Seite 1', text: 'Tief unten im blauen Meer, dort wo das Wasser morgens im Sonnenlicht glitzert, lebte ein kleiner, aufgeweckter Fisch namens Fidibus. Er war der schnellste und neugierigste kleine Fisch im ganzen Riff.', art: 'family' },
    { kicker: 'Seite 2', text: 'Jeden Abend bettelte er: „Mama, bitte! Lass uns zu den Schildkröten schwimmen!“ Doch seine Mutter sagte: „Nein, mein kleiner Fidibus. Die Schildkröten wohnen weit weg, hinter dem großen Riff, dort wo das hohe Seegras wächst.“', art: 'family' },
    { kicker: 'Seite 3', text: 'Und so fasste er eines Nachts, als seine Eltern tief und fest schliefen, einen mutigen Entschluss: Ich büxe aus! Ich suche die Schildkröten jetzt ganz alleine!', art: 'night' }
  ] },
  { type: 'setup', fn: () => { setCtrl('fid'); G.fid.mood = 'happy'; G.night = 0.55; G.current = 'home'; } },
  { type: 'hint', text: 'Halte den Finger dorthin, wo Fidibus hinschwimmen soll. Sammle Luftblasen!' },
  { type: 'dialog', lines: [S('Fidibus', '„Juhuu! Ich schwimme zu den Schildkröten!“')] },
  { type: 'play', who: 'fid', untilX: POS.whale.x - 420, station: 'whale' },
  { type: 'dialog', lines: [
    S('Fidibus', '„Hallo! Ich schwimme zu den Schildkröten! Weißt du, wo die wohnen?“'),
    S('Wal', '„Öh, ja… da hinten, immer Richtung Seegras…“'),
    S('Erzähler', 'Doch bevor der Wal den Satz beenden konnte, war Fidibus schon wieder weg. Zisch!')
  ] },
  { type: 'dash', who: 'fid', dx: 900 },
  { type: 'play', who: 'fid', untilX: POS.star.x - 260, station: 'star' },
  { type: 'dialog', lines: [
    S('Fidibus', '„He, du! Wo finde ich die Schildkröten?“'),
    S('Seestern', '„Immer der Nase nach, mein Kleiner, dort hinten beim Seegras.“'),
    S('Erzähler', 'Fidibus bedankte sich und schoss weiter wie ein Pfeil – der Seestern traute seinen Augen kaum.')
  ] },
  { type: 'dash', who: 'fid', dx: 700 },
  { type: 'hint', text: 'Es wird dunkel. Luftblasen machen Fidibus mutig und lassen es wieder heller werden.' },
  { type: 'play', who: 'fid', untilX: POS.dark.x, station: 'dark' },
  { type: 'setup', fn: () => { G.fid.mood = 'sad'; } },
  { type: 'dialog', lines: [
    S('Erzähler', 'Plötzlich merkte Fidibus, wie seine kleinen Flossen schwer wurden. Kein bekanntes Riff, kein vertrauter Stein war mehr zu sehen. Das Meer wirkte riesig und dunkel.'),
    S('Fidibus', '„Ganz schön weit weg…“')
  ] },
  { type: 'play', who: 'fid', untilX: POS.jelly.x - 300, station: 'jelly' },
  { type: 'dialog', lines: [
    S('Fidibus', '„K-kennst du die Schildkröten? Weißt du, wo sie sind?“'),
    S('Qualle', '„Hallo, mein Kleiner. Du musst keine Angst haben. Hier im Seegras wohnt die alte Oma-Schildkröte. Bei ihr bist du sicher aufgehoben. Schwimm nur hinein!“'),
    S('Erzähler', 'Das Seegras sah so dunkel aus. Fidibus nahm all seinen Mut zusammen, kniff die Augen kurz zu und schwamm durch die dichten Halme.')
  ] },
  { type: 'hint', text: 'Schwimm durch das hohe Seegras!' },
  { type: 'play', who: 'fid', untilX: POS.turtle.x - 330, station: 'turtle' },
  { type: 'setup', fn: () => { G.fid.mood = 'happy'; } },
  { type: 'dialog', lines: [
    S('Erzähler', 'Und dann sah er sie. Mitten auf einer Lichtung lag sie: die alte Oma-Schildkröte. Ihr Panzer schimmerte uralt und wunderschön.'),
    S('Oma-Schildkröte', '„Hab keine Angst, mein Kleiner.“')
  ] },
  { type: 'cut', name: 'hug', dur: 3.2 },
  { type: 'dialog', lines: [S('Erzähler', 'Sie nahm ihn sanft in den Arm und wärmte ihn. Fidibus fühlte sich sofort geborgen.')] },
  { type: 'cards', cards: [
    { kicker: 'Unterdessen zu Hause', text: 'Die Mutter war aufgewacht und hatte das leere Bettchen gesehen. „Fidibus ist weg!“, rief sie und rüttelte den Vater wach. „Wir müssen sofort los!“ Wie der Blitz schwammen die Eltern los.', art: 'parents' }
  ] },
  { type: 'setup', fn: () => { G.fid.hidden = false; G.mama.x = HOME.x - 40; G.mama.y = HOME.y - 60; G.papa.x = HOME.x + 40; G.papa.y = HOME.y; G.mama.eyes = G.papa.eyes = 'open'; G.mama.mood = G.papa.mood = 'worried'; setCtrl('mama'); G.dark = 0; G.mut = 1; G.current = 'parents'; G.stationsDone.add('turtle'); } },
  { type: 'hint', text: 'Jetzt suchen Mama und Papa! Schwimm den gleichen Weg.' },
  { type: 'play', who: 'mama', untilX: POS.whale.x - 420, station: 'parents' },
  { type: 'dialog', lines: [S('Mama', '„Habt ihr unseren Kleinen gesehen?“'), S('Wal', '„Ja, Richtung Seegras!“')] },
  { type: 'play', who: 'mama', untilX: POS.star.x - 260, station: 'parents' },
  { type: 'dialog', lines: [S('Papa', '„Ist hier ein kleiner Fisch vorbeigekommen?“'), S('Seestern', '„Ja, schnell wie ein Pfeil, Richtung Seegras!“')] },
  { type: 'play', who: 'mama', untilX: POS.jelly.x - 300, station: 'parents' },
  { type: 'dialog', lines: [S('Qualle', '„Ja, euer Kleiner ist hier drinnen. Die große Oma-Schildkröte passt gut auf ihn auf. Mensch, hatte der Angst, als er hier ankam!“')] },
  { type: 'play', who: 'mama', untilX: POS.turtle.x - 420, station: 'parents' },
  { type: 'cut', name: 'reunion', dur: 3.5 },
  { type: 'dialog', lines: [
    S('Fidibus', '„Mama! Papa! Ich bin so froh, dass ihr da seid!“'),
    S('Fidibus', '„Nicht falsch verstehen, Oma Schildkröte, es war wahnsinnig schön bei dir. Aber ich hatte unterwegs schreckliche Angst ganz ohne meine Eltern. Darf ich dich trotzdem mal wieder besuchen?“'),
    S('Oma-Schildkröte', '„Selbstverständlich, Fidibus. Wann immer du willst. Aber unter einer Voraussetzung: Du schwimmst nie wieder alleine los!“')
  ] },
  { type: 'cards', cards: [
    { kicker: 'Der Heimweg', text: 'Die Eltern bedankten sich herzlich bei der Schildkröte, und dann machten sich die drei Fische gemeinsam auf den Heimweg. Fidibus schwamm genau zwischen seiner Mama und seinem Papa.', art: 'family' }
  ] },
  { type: 'setup', fn: () => { setCtrl('fid'); G.fid.mood = 'happy'; G.mama.mood = G.papa.mood = 'happy'; G.current = 'way'; G.stationsDone.add('parents'); G.mama.dir = G.papa.dir = G.fid.dir = -1; } },
  { type: 'hint', text: 'Bleib zwischen Mama und Papa! Sie warten auf dich.' },
  { type: 'play', who: 'fid', family: true, untilXLeft: HOME.x + 60, station: 'way' },
  { type: 'dialog', lines: [S('Fidibus', '„Ich schwimme nie mehr alleine weg!“')] },
  { type: 'cut', name: 'night', dur: 4.5 },
  { type: 'dialog', lines: [
    S('Erzähler', 'Der Mond schimmerte fahl durch die Wasseroberfläche. Fidibus war nun schrecklich müde. Er musste herzhaft gähnen – Blubb! – und kuschelte sich tief in sein weiches Bett aus feinem Meeresmoos.'),
    S('Fidibus', '„Gute Nacht, Mama. Gute Nacht, Papa.“'),
    S('Mama', '„Schlaf gut, kleiner Abenteurer.“')
  ] },
  { type: 'end' }
];

function setCtrl(who) { G.ctrl = who; G.target = null; }

function nextStep() {
  G.step++;
  const st = STORY[G.step];
  if (!st) return;
  G.stepData = st; G.t = 0;
  if (st.type === 'cards') { showCards(st.cards, nextStep); G.mode = 'cards'; }
  else if (st.type === 'setup') { st.fn(); nextStep(); }
  else if (st.type === 'hint') { showHint(st.text, 5); nextStep(); }
  else if (st.type === 'dialog') { startDialog(st.lines, nextStep); }
  else if (st.type === 'play') { G.mode = 'play'; if (st.station) { G.current = st.station; } renderMap(); }
  else if (st.type === 'dash') { G.mode = 'dash'; G.dashFrom = G[st.who].x; G.dashTo = G[st.who].x + st.dx; SFX.zisch(); }
  else if (st.type === 'cut') { G.mode = 'cut'; G.cut = st.name; if (st.name === 'night') { G.current = 'night'; G.stationsDone.add('way'); renderMap(); } }
  else if (st.type === 'end') { G.mode = 'end'; document.getElementById('end').classList.add('show'); SFX.lullaby(); }
}

// ───────────── DOM: Karten, Dialog, Hinweis, Karte ─────────────
const $ = id => document.getElementById(id);
let cardList = [], cardI = 0, cardDone = null;
function showCards(cards, done) { cardList = cards; cardI = 0; cardDone = done; renderCard(); $('cards').classList.add('show'); }
function renderCard() {
  const c = cardList[cardI];
  $('cardKicker').textContent = c.kicker; $('cardText').textContent = c.text;
  $('cardPage').textContent = `${cardI + 1} / ${cardList.length}`;
  $('cardNext').textContent = cardI < cardList.length - 1 ? 'Weiter' : 'Weiterspielen';
  const art = $('cardArt'); art.style.display = 'block'; drawCardArt(art, c.art);
}
$('cardNext').addEventListener('click', () => { cardI++; if (cardI < cardList.length) renderCard(); else { $('cards').classList.remove('show'); const d = cardDone; cardDone = null; d && d(); } });

function startDialog(lines, done) { $('hint').classList.remove('show'); G.hintT = 0; G.mode = 'dialog'; G.dialogQueue = lines; G.dialogIdx = 0; G.typed = 0; G.onDialogEnd = done; renderDialog(); $('dlg').classList.add('show'); SFX.talk(); }
const WHO_COL = { Fidibus: '#f28c28', Mama: '#f7a24a', Papa: '#e0731c', Wal: '#4d7fc4', Seestern: '#e8748a', Qualle: '#b57edc', 'Oma-Schildkröte': '#7d9a4a', Erzähler: '#6b7280' };
function renderDialog() {
  const l = G.dialogQueue[G.dialogIdx];
  $('whoname').textContent = l.who; document.querySelector('#who .dot').style.background = WHO_COL[l.who] || '#888';
  $('who').style.color = WHO_COL[l.who] || '#888';
  $('txt').textContent = '';
  $('next').textContent = G.dialogIdx < G.dialogQueue.length - 1 ? 'Tippen zum Weiterlesen ▶' : 'Tippen zum Weiterschwimmen ▶';
}
function advanceDialog() {
  const l = G.dialogQueue[G.dialogIdx];
  if (!l || G.mode !== 'dialog') return;
  if (G.typed < l.text.length) { G.typed = l.text.length; $('txt').textContent = l.text; return; }
  G.dialogIdx++; G.typed = 0;
  if (G.dialogIdx < G.dialogQueue.length) { renderDialog(); SFX.talk(); }
  else { $('dlg').classList.remove('show'); const d = G.onDialogEnd; G.onDialogEnd = null; d && d(); }
}
function showHint(t, sec) { $('hint').textContent = t; $('hint').classList.add('show'); G.hintT = sec; }
function renderMap() {
  const m = $('map'); m.innerHTML = '';
  for (const s of STATIONS) { const d = document.createElement('div'); d.className = 'st' + (G.stationsDone.has(s.id) ? ' done' : '') + (G.current === s.id ? ' now' : ''); d.textContent = s.icon; d.title = s.name; m.appendChild(d); }
}

// ───────────── Eingabe ─────────────
let pointerDown = false;
function toWorld(px, py) { return { x: G.cam.x + (px - W / 2) / scale, y: G.cam.y + (py - H / 2) / scale }; }
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (G.mode === 'dialog') { advanceDialog(); return; }
  pointerDown = true; G.target = toWorld(e.clientX, e.clientY);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
});
canvas.addEventListener('pointermove', e => { if (pointerDown) G.target = toWorld(e.clientX, e.clientY); });
const up = () => { pointerDown = false; G.target = null; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
window.addEventListener('keydown', e => { G.keys[e.code] = true; if ((e.code === 'Space' || e.code === 'Enter') && G.mode === 'dialog') advanceDialog(); });
window.addEventListener('keyup', e => { G.keys[e.code] = false; });
$('dlg').addEventListener('pointerdown', e => { e.preventDefault(); if (G.mode === 'dialog') advanceDialog(); });
$('go').addEventListener('click', () => { $('start').classList.remove('show'); tone([[523, 0.1], [659, 0.1], [784, 0.15]]); startStory(); });
$('again').addEventListener('click', () => { $('end').classList.remove('show'); startStory(); });

function startStory() {
  G.step = -1; G.bubbles = 0; G.mut = 1; G.dark = 0; G.moon = 0; G.night = 0; G.stationsDone = new Set(); G.current = 'home';
  Object.assign(G.fid, { x: HOME.x, y: HOME.y, vx: 0, vy: 0, dir: 1, eyes: 'open', mood: 'happy', hidden: false, scale: 1 });
  Object.assign(G.mama, { x: HOME.x - 70, y: HOME.y + 40, vx: 0, vy: 0, dir: 1, eyes: 'closed', mood: 'sleep', hidden: false });
  Object.assign(G.papa, { x: HOME.x + 60, y: HOME.y + 50, vx: 0, vy: 0, dir: -1, eyes: 'closed', mood: 'sleep', hidden: false });
  G.turtle.hug = 0; G.hearts = []; G.trail = []; G.homeArrived = false; G.blubbed = false; G.particles = []; G.cam.x = HOME.x; G.cam.y = 900;
  makeCollect(); renderMap(); $('bubbles').textContent = '🫧 0';
  nextStep();
}

// ───────────── Physik der Fische ─────────────
function steer(f, dt, speedMax) {
  let ax = 0, ay = 0;
  if (G.target) { const dx = G.target.x - f.x, dy = G.target.y - f.y, d = Math.hypot(dx, dy); if (d > 18) { ax = dx / d; ay = dy / d; } }
  if (G.keys.ArrowLeft || G.keys.KeyA) ax -= 1; if (G.keys.ArrowRight || G.keys.KeyD) ax += 1;
  if (G.keys.ArrowUp || G.keys.KeyW) ay -= 1; if (G.keys.ArrowDown || G.keys.KeyS) ay += 1;
  const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
  const acc = 1400;
  f.vx += ax * acc * dt; f.vy += ay * acc * dt;
  const drag = Math.exp(-3.2 * dt); f.vx *= drag; f.vy *= drag;
  const sp = Math.hypot(f.vx, f.vy); if (sp > speedMax) { f.vx *= speedMax / sp; f.vy *= speedMax / sp; }
  f.x += f.vx * dt; f.y += f.vy * dt;
  f.x = clamp(f.x, 90, WORLD_W - 90); f.y = clamp(f.y, 130, 1290);
  if (Math.abs(f.vx) > 20) f.dir = f.vx > 0 ? 1 : -1;
  f.tilt = lerp(f.tilt, clamp(f.vy / 600, -0.5, 0.5) * f.dir, 1 - Math.exp(-6 * dt));
  f.fin += dt * (4 + sp / 60);
  if (sp > 120 && Math.random() < dt * 4) G.particles.push({ x: f.x - f.dir * 30, y: f.y - 10, r: 3 + Math.random() * 4, vy: -30 - Math.random() * 30, life: 1.4 });
}
function follow(f, tx, ty, dt, k = 2.5, maxSp = 360) {
  const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
  const sp = Math.min(maxSp, d * k);
  if (d > 2) { f.vx = dx / d * sp; f.vy = dy / d * sp; f.x += f.vx * dt; f.y += f.vy * dt; }
  else { f.vx = f.vy = 0; }
  if (Math.abs(f.vx) > 25) f.dir = f.vx > 0 ? 1 : -1;
  f.tilt = lerp(f.tilt, clamp(f.vy / 600, -0.5, 0.5) * f.dir, 1 - Math.exp(-6 * dt));
  f.fin += dt * (4 + Math.hypot(f.vx, f.vy) / 60);
}

// ───────────── Update ─────────────
function update(dt) {
  G.t += dt;
  const st = G.stepData;
  if (G.hintT > 0) { G.hintT -= dt; if (G.hintT <= 0) $('hint').classList.remove('show'); }
  // Dialog: Text tippen
  if (G.mode === 'dialog') {
    const l = G.dialogQueue[G.dialogIdx];
    if (G.typed < l.text.length) { G.typed = Math.min(l.text.length, G.typed + dt * 38); $('txt').textContent = l.text.slice(0, Math.floor(G.typed)); }
  }
  // Dunkelheit je nach Position (nur Teil 1)
  const ctrl = G.ctrl ? G[G.ctrl] : G.fid;
  if (G.ctrl === 'fid' && !(st && st.family)) {
    const d = smooth(POS.star.x + 400, POS.dark.x + 300, ctrl.x) * (1 - smooth(POS.jelly.x - 700, POS.jelly.x - 150, ctrl.x));
    G.dark = lerp(G.dark, d, 1 - Math.exp(-1.5 * dt));
    if (G.dark > 0.2 && G.mode === 'play') G.mut = clamp(G.mut - dt * 0.035, 0.15, 1);
  } else G.dark = lerp(G.dark, 0, 1 - Math.exp(-1.5 * dt));
  // Augen zu im Seegras
  const inGrass = ctrl.x > POS.grassFrom + 150 && ctrl.x < POS.grassTo - 150 && G.ctrl === 'fid' && !(st && st.family);
  G.fadeEyes = lerp(G.fadeEyes, inGrass ? 1 : 0, 1 - Math.exp(-3 * dt));

  if (G.mode === 'play') {
    const f = G[st.who];
    steer(f, dt, st.family ? 330 : 380);
    if (st.who === 'mama') { follow(G.papa, G.mama.x - G.mama.dir * 110, G.mama.y + 45, dt, 3, 420); }
    if (st.family) {
      // Eltern schwimmen voran nach links und warten, wenn Fidibus zurückbleibt
      const lead = G.mama, back = G.papa;
      const gap = f.x - lead.x;   // Fidibus soll rechts von Mama (also hinter ihr) bleiben, Papa noch weiter rechts
      let sp = 190; if (gap > 260) sp = 20; else if (gap < 60) sp = 300;
      if (lead.x > HOME.x + 40) lead.x -= sp * dt; lead.y = lerp(lead.y, clamp(f.y, 300, 1200), 1 - Math.exp(-1.2 * dt)); lead.dir = -1; lead.fin += dt * 5; lead.vx = -sp;
      follow(back, f.x + 160, f.y + 30, dt, 2.5, 380); back.dir = -1;
      const between = f.x > lead.x + 40 && f.x < back.x - 20 && Math.abs(f.y - lead.y) < 220;
      if (between && Math.random() < dt * 1.5) G.hearts.push({ x: f.x, y: f.y - 50, life: 1.5, vx: (Math.random() - 0.5) * 40 });
      if (st.untilXLeft !== undefined && f.x < st.untilXLeft) { G.mode = 'wait'; G.homeArrived = true; setTimeout(nextStep, 400); }
    } else if (st.untilX !== undefined && f.x >= st.untilX) {
      G.mode = 'wait'; G.target = null; SFX.station(); G.stationsDone.add(st.station); if (st.station === 'whale') G.stationsDone.add('home'); renderMap();
      setTimeout(nextStep, 500);
    }
    // Luftblasen sammeln
    for (const b of G.collect) if (!b.got && Math.hypot(b.x - f.x, b.y - f.y) < 55 + b.r) { b.got = true; G.bubbles++; G.mut = clamp(G.mut + 0.28, 0, 1); SFX.bubble(); $('bubbles').textContent = '🫧 ' + G.bubbles; for (let k = 0; k < 6; k++) G.particles.push({ x: b.x, y: b.y, r: 2 + Math.random() * 4, vy: -40 - Math.random() * 60, vx: (Math.random() - 0.5) * 80, life: 0.9 }); }
  } else if (G.mode === 'dash') {
    const f = G[st.who]; const p = Math.min(1, G.t / 0.7); const e = 1 - Math.pow(1 - p, 3);
    f.x = lerp(G.dashFrom, G.dashTo, e); f.dir = 1; f.fin += dt * 30; f.tilt = 0;
    G.trail.push({ x: f.x - 40, y: f.y + (Math.random() - 0.5) * 30, r: 4 + Math.random() * 8, life: 1 });
    if (p >= 1) { G.mode = 'wait'; setTimeout(nextStep, 300); }
  } else if (G.mode === 'cut') {
    const p = Math.min(1, G.t / st.dur);
    if (G.cut === 'hug') {
      follow(G.fid, POS.turtle.x - 235, POS.turtle.y + 10, dt, 2, 300); G.fid.dir = 1;
      G.turtle.hug = smooth(0.35, 0.8, p);
      if (p > 0.5 && Math.random() < dt * 2) G.hearts.push({ x: G.fid.x + (Math.random() - 0.5) * 80, y: G.fid.y - 60, life: 1.6, vx: 0 });
      if (p > 0.55) { G.fid.eyes = 'closed'; G.fid.mood = 'happy'; }
      if (G.t > 0.8 && G.t < 0.9) SFX.hug();
    } else if (G.cut === 'reunion') {
      G.turtle.hug = lerp(G.turtle.hug, 0, 1 - Math.exp(-3 * dt)); G.fid.eyes = 'open';
      const mx = POS.turtle.x - 520, my = POS.turtle.y - 120;
      follow(G.mama, mx, my, dt, 3, 400); follow(G.papa, mx - 90, my + 60, dt, 3, 400);
      if (p > 0.25) { follow(G.fid, mx + 70, my + 10, dt, 4, 700); G.fid.dir = -1; }
      if (p > 0.45 && Math.random() < dt * 4) G.hearts.push({ x: mx + (Math.random() - 0.5) * 200, y: my - 40, life: 1.8, vx: (Math.random() - 0.5) * 30 });
      if (G.t > 1.1 && G.t < 1.2) SFX.hug();
      G.mama.mood = G.papa.mood = 'happy';
    } else if (G.cut === 'night') {
      G.night = smooth(0, 0.5, p); G.moon = smooth(0.1, 0.7, p);
      follow(G.fid, HOME.x + 10, HOME.y + 20, dt, 2, 250); follow(G.mama, HOME.x - 80, HOME.y - 30, dt, 2, 250); follow(G.papa, HOME.x + 95, HOME.y - 20, dt, 2, 250);
      G.mama.dir = 1; G.papa.dir = -1;
      if (p > 0.6) { G.fid.eyes = 'closed'; G.fid.mood = 'sleep'; }
      if (p > 0.85) { G.mama.eyes = G.papa.eyes = 'closed'; G.mama.mood = G.papa.mood = 'sleep'; }
      if (G.t > 2.4 && G.t < 2.5 && !G.blubbed) { G.blubbed = true; G.particles.push({ x: G.fid.x + 30, y: G.fid.y - 20, r: 14, vy: -50, life: 4 }); SFX.bubble(); }
    }
    if (p >= 1) { G.mode = 'wait'; nextStep(); }
  } else if (G.mode === 'end') {
    G.night = 1; G.moon = 1;
  }
  // Idle-Animation für nicht gesteuerte Fische
  for (const f of [G.fid, G.mama, G.papa]) { if (f !== ctrl || G.mode !== 'play') { f.fin += dt * 2.5; f.tilt = lerp(f.tilt, 0, 1 - Math.exp(-3 * dt)); } }
  // Partikel
  for (const p of G.particles) { p.y += p.vy * dt; p.x += (p.vx || 0) * dt + Math.sin(G.t * 5 + p.r) * 20 * dt; p.life -= dt; }
  G.particles = G.particles.filter(p => p.life > 0);
  for (const h of G.hearts) { h.y -= 50 * dt; h.x += h.vx * dt; h.life -= dt; }
  G.hearts = G.hearts.filter(h => h.life > 0);
  for (const t of G.trail) t.life -= dt * 1.6; G.trail = G.trail.filter(t => t.life > 0);
  G.turtle.blink = (Math.sin(G.t * 0.9) > 0.97) ? 1 : 0; G.whale.blink = (Math.sin(G.t * 0.7 + 2) > 0.96) ? 1 : 0;
  // Kamera
  let focus = ctrl;
  if (G.mode === 'cut' && G.cut === 'hug') focus = { x: POS.turtle.x - 200, y: POS.turtle.y - 80 };
  if (G.mode === 'cut' && G.cut === 'reunion') focus = { x: POS.turtle.x - 420, y: POS.turtle.y - 120 };
  if (G.mode === 'cut' && G.cut === 'night' || G.mode === 'end') focus = { x: HOME.x, y: HOME.y - 120 };
  if (G.mode === 'title') focus = { x: HOME.x + 200, y: 900 };
  if (G.mode === 'dialog' && G.stationsDone.size >= 0 && ctrl.x > 1500) focus = { x: ctrl.x + 230 * (st && st.family ? -1 : 1), y: ctrl.y - 80 };
  const visW = W / scale, visH = H / scale;
  const tx = clamp(focus.x + (G.mode === 'play' && !st.family ? (G[st.who] === G.fid ? 120 : 120) : 0) * (focus.dir || 1) * (st && st.family ? 0 : 1), visW / 2, WORLD_W - visW / 2);
  const ty = visH >= WORLD_H ? WORLD_H / 2 : clamp(focus.y, visH / 2, WORLD_H - visH / 2);
  const k = 1 - Math.exp(-4 * dt);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
}

// ───────────── Zeichnen: Welt ─────────────
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const visW = W / scale, visH = H / scale;
  const left = G.cam.x - visW / 2, top = G.cam.y - visH / 2;
  const dark = G.dark * (1 - G.mut * 0.4), night = G.night;
  // Wasser-Verlauf
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const topCol = mix([46, 128, 190], [8, 22, 48], Math.max(dark * 0.8, night * 0.85));
  const botCol = mix([10, 42, 78], [3, 10, 24], Math.max(dark * 0.8, night * 0.85));
  g.addColorStop(0, rgb(topCol)); g.addColorStop(1, rgb(botCol));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.save(); ctx.scale(scale, scale); ctx.translate(-left, -top);
  // Mond
  if (G.moon > 0 || G.mode === 'title') {
    const mx = left + visW * 0.72, my = top + 120 + (visH < 900 ? 0 : 60), m = Math.max(G.moon, G.mode === 'title' ? 0.7 : 0);
    const rg = ctx.createRadialGradient(mx, my, 10, mx, my, 260); rg.addColorStop(0, `rgba(230,240,255,${0.45 * m})`); rg.addColorStop(1, 'rgba(230,240,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(mx - 260, my - 260, 520, 520);
    ctx.fillStyle = `rgba(240,246,255,${0.95 * m})`; ctx.beginPath(); ctx.arc(mx, my, 46, 0, 7); ctx.fill();
  }
  drawRays(left, top, visW, visH, dark, night);
  drawFarLayer(left, top, visW, visH);
  drawFloor(left, visW);
  drawProps(left, visW);
  // Figuren der Stationen
  drawWhale(POS.whale.x, POS.whale.y + Math.sin(G.t * 0.6) * 18);
  drawStarfish(POS.star.x, POS.star.y);
  drawSeagrassWall();
  drawJelly(POS.jelly.x, POS.jelly.y + Math.sin(G.t * 1.1) * 30);
  drawTurtle(POS.turtle.x, POS.turtle.y);
  drawHome();
  // Sammel-Luftblasen
  for (const b of G.collect) if (!b.got && b.x > left - 100 && b.x < left + visW + 100) drawBubble(b.x, b.y + Math.sin(G.t * 1.5 + b.ph) * 10, b.r, 0.85);
  for (const t of G.trail) drawBubble(t.x, t.y, t.r * t.life, 0.5 * t.life);
  // Fische
  const order = [G.papa, G.mama, G.fid];
  for (const f of order) if (!f.hidden) drawFish(f, f === G.fid ? 1 : 1.5, f === G.mama ? 'mama' : f === G.papa ? 'papa' : 'fid');
  for (const p of G.particles) drawBubble(p.x, p.y, p.r, Math.min(1, p.life) * 0.7);
  for (const h of G.hearts) drawHeart(h.x, h.y, 14 + (1.8 - h.life) * 6, Math.min(1, h.life));
  drawForeGrass(left, visW);
  ctx.restore();

  // Dunkelheit / Licht-Vignette um den Fisch
  const ctrl = G.ctrl ? G[G.ctrl] : G.fid;
  const dAmount = Math.max(dark, G.fadeEyes * 0.85);
  if (dAmount > 0.02) {
    const cx = (ctrl.x - left) * scale, cy = (ctrl.y - top) * scale;
    const r = lerp(140, 560, G.mut) * scale * (1 - G.fadeEyes * 0.6);
    const rg = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r);
    rg.addColorStop(0, 'rgba(2,8,20,0)'); rg.addColorStop(1, `rgba(2,8,20,${0.96 * dAmount})`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  if (G.mode === 'title') { ctx.fillStyle = 'rgba(5,20,40,.25)'; ctx.fillRect(0, 0, W, H); }
}
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function drawRays(left, top, visW, visH, dark, night) {
  const a = 0.16 * (1 - dark) * (1 - night * 0.7);
  if (a < 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(left / 520) * 520 + i * 520 + Math.sin(G.t * 0.3 + i) * 40;
    const gr = ctx.createLinearGradient(0, top, 0, top + 900); gr.addColorStop(0, '#dff3ff'); gr.addColorStop(1, 'rgba(223,243,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x, top - 50); ctx.lineTo(x + 90, top - 50); ctx.lineTo(x + 260, top + 950); ctx.lineTo(x + 40, top + 950); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawFarLayer(left, top, visW, visH) {
  // Ferne Felsen-Silhouetten mit Parallaxe
  ctx.save(); ctx.fillStyle = 'rgba(6,30,60,.55)';
  const px = left * 0.55;
  for (let i = Math.floor(px / 700) - 1; i < (px + visW) / 700 + 1; i++) {
    const bx = i * 700 - (px - left), h = 260 + ((i * 37) % 5) * 60;
    ctx.beginPath(); ctx.moveTo(bx, 1400); ctx.quadraticCurveTo(bx + 120, 1400 - h * 1.3, bx + 300, 1400 - h); ctx.quadraticCurveTo(bx + 480, 1400 - h * 0.6, bx + 620, 1400); ctx.fill();
  }
  // Schwarm kleiner Fische im Riff-Bereich
  ctx.fillStyle = 'rgba(120,170,210,.35)';
  for (let i = 0; i < 12; i++) {
    const x = 900 + ((i * 131) % 1500) + Math.sin(G.t * 0.8 + i) * 60, y = 350 + ((i * 97) % 500) + Math.cos(G.t * 0.6 + i) * 30;
    if (x < left - 50 || x > left + visW + 50) continue;
    ctx.beginPath(); ctx.ellipse(x, y, 16, 7, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 26, y - 7); ctx.lineTo(x - 26, y + 7); ctx.fill();
  }
  ctx.restore();
}
function drawFloor(left, visW) {
  const g = ctx.createLinearGradient(0, 1290, 0, 1400); g.addColorStop(0, '#c9ad7a'); g.addColorStop(1, '#7d6a48');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(left - 100, 1400);
  for (let x = Math.floor(left / 80) * 80 - 80; x < left + visW + 160; x += 80) ctx.lineTo(x, 1300 + Math.sin(x * 0.013) * 14 + Math.sin(x * 0.041) * 6);
  ctx.lineTo(left + visW + 200, 1400); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  for (let x = Math.floor(left / 120) * 120; x < left + visW + 120; x += 120) { ctx.beginPath(); ctx.moveTo(x, 1345); ctx.quadraticCurveTo(x + 30, 1338, x + 60, 1345); ctx.stroke(); }
}
// Korallen, Steine, Anemonen (deterministisch)
let PROPS = null;
function genProps() {
  PROPS = []; seed = 3;
  for (let x = 150; x < WORLD_W; x += 140 + rnd() * 160) {
    const dark = x > POS.star.x + 500 && x < POS.jelly.x - 400;   // dunkles Wasser: karg
    const r = rnd();
    if (dark && r < 0.6) continue;
    if (x > POS.grassFrom - 100 && x < POS.grassTo + 100) continue;
    const kind = r < 0.3 ? 'rock' : r < 0.55 ? 'coral' : r < 0.75 ? 'fan' : r < 0.9 ? 'anemone' : 'grass';
    PROPS.push({ kind, x, y: 1300 + Math.sin(x * 0.013) * 14, s: 0.7 + rnd() * 0.9, hue: [rnd(), rnd(), rnd()], ph: rnd() * 6 });
  }
}
const CORAL = ['#e86f8a', '#f2a04b', '#7fd1c0', '#c77dd8', '#f7d354', '#ff8f6b'];
function drawProps(left, visW) {
  for (const p of PROPS) {
    if (p.x < left - 200 || p.x > left + visW + 200) continue;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.s, p.s);
    if (p.kind === 'rock') {
      ctx.fillStyle = '#3d4f6b'; ctx.beginPath(); ctx.moveTo(-90, 10); ctx.quadraticCurveTo(-70, -80, 0, -85); ctx.quadraticCurveTo(80, -75, 95, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.ellipse(-20, -50, 35, 14, -0.3, 0, 7); ctx.fill();
    } else if (p.kind === 'coral') {
      ctx.strokeStyle = CORAL[Math.floor(p.hue[0] * CORAL.length)]; ctx.lineCap = 'round'; ctx.lineWidth = 14;
      const br = (x, y, a, l, d) => { if (d === 0) return; const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l; ctx.lineWidth = 4 + d * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke(); br(nx, ny, a - 0.5 - p.hue[1] * 0.3, l * 0.72, d - 1); br(nx, ny, a + 0.45 + p.hue[2] * 0.3, l * 0.7, d - 1); };
      br(0, 10, -Math.PI / 2, 60, 4);
    } else if (p.kind === 'fan') {
      ctx.fillStyle = CORAL[Math.floor(p.hue[1] * CORAL.length)]; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(0, 10); for (let a = -2.6; a <= -0.5; a += 0.15) { const r = 95 + Math.sin(a * 9 + p.ph) * 12; ctx.lineTo(Math.cos(a) * r, 10 + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 2; for (let a = -2.5; a <= -0.6; a += 0.3) { ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(Math.cos(a) * 90, 10 + Math.sin(a) * 90); ctx.stroke(); }
    } else if (p.kind === 'anemone') {
      ctx.strokeStyle = CORAL[Math.floor(p.hue[2] * CORAL.length)]; ctx.lineCap = 'round'; ctx.lineWidth = 9;
      for (let i = -4; i <= 4; i++) { const sw = Math.sin(G.t * 1.6 + i + p.ph) * 8; ctx.beginPath(); ctx.moveTo(i * 9, 8); ctx.quadraticCurveTo(i * 14 + sw, -30, i * 18 + sw * 2, -60 - Math.abs(i) * -4); ctx.stroke(); }
    } else {
      ctx.strokeStyle = '#3fa66b'; ctx.lineCap = 'round'; ctx.lineWidth = 6;
      for (let i = -2; i <= 2; i++) { const sw = Math.sin(G.t * 1.2 + i * 0.7 + p.ph) * 18; ctx.beginPath(); ctx.moveTo(i * 12, 10); ctx.quadraticCurveTo(i * 12 + sw * 0.5, -70, i * 14 + sw, -140); ctx.stroke(); }
    }
    ctx.restore();
  }
}
function drawForeGrass(left, visW) {
  ctx.save(); ctx.strokeStyle = 'rgba(20,70,50,.85)'; ctx.lineCap = 'round';
  for (let x = Math.floor(left / 90) * 90; x < left + visW + 90; x += 90) {
    const h = 90 + ((x * 7) % 5) * 22, sw = Math.sin(G.t * 1.3 + x * 0.05) * 20; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x, 1420); ctx.quadraticCurveTo(x + sw * 0.4, 1400 - h * 0.6, x + sw, 1400 - h); ctx.stroke();
  }
  ctx.restore();
}
function drawSeagrassWall() {
  // Hohes, dunkles Seegras zwischen grassFrom und grassTo
  ctx.save(); ctx.lineCap = 'round';
  for (let x = POS.grassFrom; x < POS.grassTo; x += 26) {
    const h = 900 + Math.sin(x * 0.07) * 150 + ((x * 13) % 7) * 40, sw = Math.sin(G.t * 0.9 + x * 0.02) * 45;
    const shade = 30 + ((x * 3) % 5) * 12;
    ctx.strokeStyle = `rgb(${shade * 0.4 | 0},${shade + 40},${shade * 0.9 | 0})`; ctx.lineWidth = 12 + ((x * 5) % 3) * 4;
    ctx.beginPath(); ctx.moveTo(x, 1330); ctx.bezierCurveTo(x - sw * 0.3, 1330 - h * 0.35, x + sw, 1330 - h * 0.7, x + sw * 1.2, 1330 - h); ctx.stroke();
  }
  ctx.restore();
}
function drawHome() {
  // Felsspalte mit Moosbett
  ctx.save(); ctx.translate(HOME.x, 1300);
  ctx.fillStyle = '#2f3f5c'; ctx.beginPath(); ctx.moveTo(-330, 20); ctx.quadraticCurveTo(-320, -360, -90, -400); ctx.quadraticCurveTo(140, -420, 260, -250); ctx.quadraticCurveTo(330, -120, 330, 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a2740'; ctx.beginPath(); ctx.moveTo(-190, 20); ctx.quadraticCurveTo(-200, -240, 0, -250); ctx.quadraticCurveTo(200, -240, 190, 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4f8a5c'; ctx.beginPath(); ctx.ellipse(0, -200 + 200, 150, 34, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6aa66f'; for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.arc(i * 26, -8 + Math.sin(i) * 6, 16, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.ellipse(-120, -300, 60, 22, -0.4, 0, 7); ctx.fill();
  // Zzz beim Schlafen
  const sleepers = [G.fid, G.mama, G.papa].filter(f => f.mood === 'sleep' && !f.hidden);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = 'bold 26px sans-serif';
  for (const f of sleepers) { const ph = (G.t * 0.7 + f.x) % 2; ctx.globalAlpha = 1 - ph / 2; ctx.fillText('z', f.x - HOME.x + 30 + ph * 14, f.y - 1300 - 40 - ph * 40); }
  ctx.restore();
}

// ───────────── Figuren ─────────────
function drawBubble(x, y, r, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, 'rgba(200,235,255,.35)'); g.addColorStop(1, 'rgba(160,220,255,.15)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(220,245,255,.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, 7); ctx.fill();
  ctx.restore();
}
function drawHeart(x, y, s, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ff6b8a'; ctx.translate(x, y); ctx.scale(s / 20, s / 20);
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -6, -8, -18, 0, -10); ctx.bezierCurveTo(8, -18, 14, -6, 0, 8); ctx.fill(); ctx.restore();
}
function drawFish(f, sz, kind) {
  const bodyCol = kind === 'papa' ? '#e8761c' : kind === 'mama' ? '#f6a03a' : '#f28c28';
  const belly = kind === 'papa' ? '#f7b26a' : '#fbd08a';
  const finCol = '#b8c94a', finDark = '#8fa63a';
  ctx.save(); ctx.translate(f.x, f.y); ctx.scale(f.dir, 1); ctx.rotate(f.tilt); ctx.scale(sz * (f.scale || 1), sz * (f.scale || 1));
  const wag = Math.sin(f.fin) * 0.35;
  // Schwanz
  ctx.fillStyle = finCol; ctx.save(); ctx.translate(-42, 0); ctx.rotate(wag);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -34, -42, -30); ctx.quadraticCurveTo(-28, 0, -42, 30); ctx.quadraticCurveTo(-30, 34, 0, 0); ctx.fill(); ctx.restore();
  // Rückenflosse
  ctx.fillStyle = finDark; ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(0, -60, 22, -32); ctx.closePath(); ctx.fill();
  // Körper
  const g = ctx.createRadialGradient(10, -12, 5, 0, 0, 60); g.addColorStop(0, '#ffb35a'); g.addColorStop(0.6, bodyCol); g.addColorStop(1, '#c95f12');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 50, 38, 0, 0, 7); ctx.fill();
  ctx.fillStyle = belly; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(6, 14, 34, 18, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  // Schuppen-Andeutung
  ctx.strokeStyle = 'rgba(180,80,10,.25)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-18 + i * 12, -4 + (i % 2) * 8, 9, 0.3, 2.8); ctx.stroke(); }
  // Brustflosse
  ctx.fillStyle = finCol; ctx.save(); ctx.translate(2, 12); ctx.rotate(0.6 + Math.sin(f.fin * 1.3) * 0.25); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, 22, -26, 26); ctx.quadraticCurveTo(-6, 8, 0, 0); ctx.fill(); ctx.restore();
  // Auge
  const ex = 26, ey = -8;
  if (f.eyes === 'closed') { ctx.strokeStyle = '#7a3a05'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, ey - 2, 9, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, 12, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a1f14'; ctx.beginPath(); ctx.arc(ex + 3, ey + (f.mood === 'sad' ? 3 : 0), 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 5, ey - 3, 2.5, 0, 7); ctx.fill();
    if (f.mood === 'sad' || f.mood === 'worried') { ctx.strokeStyle = '#7a3a05'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - 10, ey - 16); ctx.lineTo(ex + 10, ey - 11); ctx.stroke(); }
    if (kind === 'mama') { ctx.strokeStyle = '#2a1f14'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ex - 6 + i * 6, ey - 13); ctx.lineTo(ex - 8 + i * 6, ey - 19); ctx.stroke(); } }
  }
  // Mund
  ctx.strokeStyle = '#7a3a05'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
  if (f.mood === 'sad' || f.mood === 'worried') ctx.arc(42, 16, 6, Math.PI + 0.3, -0.3); else if (f.mood === 'sleep') ctx.arc(42, 10, 4, 0.2, Math.PI - 0.2); else ctx.arc(40, 8, 8, 0.2, Math.PI - 0.4);
  ctx.stroke();
  if (f.mood === 'happy' && f.eyes !== 'closed') { ctx.fillStyle = 'rgba(255,120,120,.35)'; ctx.beginPath(); ctx.ellipse(36, 8, 8, 5, 0, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawWhale(x, y) {
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -200, 0, 200); g.addColorStop(0, '#5b8fd6'); g.addColorStop(0.55, '#3d6bb5'); g.addColorStop(1, '#2b4f8e');
  // Schwanz
  ctx.fillStyle = '#3d6bb5'; ctx.save(); ctx.translate(-330, -20); ctx.rotate(Math.sin(G.t * 1.2) * 0.12);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-90, -120, -170, -100); ctx.quadraticCurveTo(-110, -20, -170, 90); ctx.quadraticCurveTo(-90, 110, 0, 0); ctx.fill(); ctx.restore();
  // Körper
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(300, -40); ctx.bezierCurveTo(300, -220, 80, -230, -80, -190); ctx.bezierCurveTo(-260, -150, -360, -60, -340, 30); ctx.bezierCurveTo(-300, 140, -60, 190, 120, 170); ctx.bezierCurveTo(260, 150, 320, 60, 300, -40); ctx.fill();
  // Bauch
  ctx.fillStyle = '#d6e8f7'; ctx.beginPath(); ctx.moveTo(300, 0); ctx.bezierCurveTo(280, 120, 120, 190, -60, 170); ctx.bezierCurveTo(-200, 150, -300, 100, -330, 40); ctx.bezierCurveTo(-200, 80, 100, 70, 300, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(80,120,170,.35)'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(220 - i * 70, 30 + i * 12); ctx.quadraticCurveTo(80 - i * 60, 120 + i * 10, -120 - i * 30, 110 + i * 12); ctx.stroke(); }
  // Flosse
  ctx.fillStyle = '#2f5aa0'; ctx.save(); ctx.translate(20, 90); ctx.rotate(0.3 + Math.sin(G.t * 1.5) * 0.15); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-40, 90, -130, 100); ctx.quadraticCurveTo(-50, 40, 0, 0); ctx.fill(); ctx.restore();
  // Auge und Mund
  if (G.whale.blink) { ctx.strokeStyle = '#1a2b4a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(200, -60, 16, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(200, -60, 22, 24, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1a2b4a'; ctx.beginPath(); ctx.arc(206, -56, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(211, -62, 4, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#1a2b4a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(290, 10); ctx.quadraticCurveTo(200, 70, 60, 50); ctx.stroke();
  ctx.fillStyle = 'rgba(255,150,150,.3)'; ctx.beginPath(); ctx.ellipse(240, 10, 26, 14, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawStarfish(x, y) {
  // Fels
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#4a5a78'; ctx.beginPath(); ctx.moveTo(-160, 60); ctx.quadraticCurveTo(-150, -40, -20, -50); ctx.quadraticCurveTo(140, -50, 170, 60); ctx.closePath(); ctx.fill();
  ctx.translate(0, -75); ctx.rotate(Math.sin(G.t * 0.5) * 0.04);
  ctx.fillStyle = '#e8748a'; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 34 : 88; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 26; ctx.strokeStyle = '#e8748a'; ctx.stroke(); ctx.fill();
  ctx.fillStyle = '#f7a2b4'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(Math.cos(a) * k * 24, Math.sin(a) * k * 24, 5, 0, 7); ctx.fill(); } }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-12, -6, 9, 0, 7); ctx.arc(12, -6, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a1f2a'; ctx.beginPath(); ctx.arc(-10, -5, 5, 0, 7); ctx.arc(14, -5, 5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a1f2a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 8, 9, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.restore();
}
function drawJelly(x, y) {
  ctx.save(); ctx.translate(x, y);
  const glow = 0.5 + Math.sin(G.t * 2) * 0.15;
  const rg = ctx.createRadialGradient(0, 0, 20, 0, 0, 380); rg.addColorStop(0, `rgba(210,160,255,${0.55 * glow})`); rg.addColorStop(1, 'rgba(210,160,255,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 380, 0, 7); ctx.fill();
  // Tentakel
  ctx.lineCap = 'round';
  for (let i = -4; i <= 4; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(230,180,255,.8)' : 'rgba(200,140,240,.8)'; ctx.lineWidth = i % 2 ? 6 : 9;
    ctx.beginPath(); ctx.moveTo(i * 20, 40);
    const sw = Math.sin(G.t * 2 + i) * 30, sw2 = Math.cos(G.t * 1.5 + i * 0.5) * 30;
    ctx.bezierCurveTo(i * 22 + sw, 130, i * 24 + sw2, 200, i * 26 + sw, 270 + Math.abs(i) * -12); ctx.stroke();
  }
  // Schirm
  const g = ctx.createRadialGradient(-20, -50, 10, 0, -10, 130); g.addColorStop(0, 'rgba(240,215,255,.95)'); g.addColorStop(0.7, 'rgba(190,130,230,.9)'); g.addColorStop(1, 'rgba(150,90,210,.85)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-120, 40); ctx.bezierCurveTo(-130, -90, -60, -130, 0, -130); ctx.bezierCurveTo(60, -130, 130, -90, 120, 40);
  for (let i = 0; i < 5; i++) ctx.quadraticCurveTo(120 - i * 48 - 24, 60, 120 - (i + 1) * 48, 40); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-40, -70, 30, 16, -0.5, 0, 7); ctx.fill();
  // Gesicht
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-30, -20, 14, 16, 0, 0, 7); ctx.ellipse(30, -20, 14, 16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a2a50'; ctx.beginPath(); ctx.arc(-27, -17, 8, 0, 7); ctx.arc(33, -17, 8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a2a50'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 4, 12, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,170,.4)'; ctx.beginPath(); ctx.ellipse(-52, 2, 10, 6, 0, 0, 7); ctx.ellipse(52, 2, 10, 6, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawTurtle(x, y) {
  ctx.save(); ctx.translate(x, y);
  // Lichtung: heller Sand
  ctx.fillStyle = 'rgba(255,240,200,.18)'; ctx.beginPath(); ctx.ellipse(-100, 260, 620, 90, 0, 0, 7); ctx.fill();
  const hug = G.turtle.hug;
  // Hinterflosse
  ctx.fillStyle = '#6e8a3c'; ctx.beginPath(); ctx.ellipse(170, 150, 90, 40, 0.5, 0, 7); ctx.fill();
  // Panzer
  const g = ctx.createRadialGradient(-40, -120, 20, 0, 0, 260); g.addColorStop(0, '#b6b872'); g.addColorStop(0.6, '#8a9a4a'); g.addColorStop(1, '#5d6e30');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-250, 90); ctx.bezierCurveTo(-260, -150, -80, -230, 40, -225); ctx.bezierCurveTo(180, -220, 270, -100, 250, 90); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,70,30,.45)'; ctx.lineWidth = 4;
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const cx = -150 + i * 62 + (r % 2) * 31, cy = -60 + r * 70 - Math.abs(i - 2.5) * 22; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); } ctx.closePath(); ctx.stroke(); }
  ctx.fillStyle = '#5a6a2e'; ctx.beginPath(); ctx.moveTo(-260, 90); ctx.quadraticCurveTo(0, 150, 260, 90); ctx.quadraticCurveTo(0, 120, -260, 90); ctx.fill();
  // Kopf (nach links, freundlich)
  ctx.fillStyle = '#93a35a'; ctx.beginPath(); ctx.ellipse(-300, -20, 95, 70, -0.15, 0, 7); ctx.fill();
  ctx.fillStyle = '#7e8e48'; ctx.beginPath(); ctx.ellipse(-230, 30, 60, 40, 0.3, 0, 7); ctx.fill();
  ctx.fillStyle = '#93a35a'; ctx.beginPath(); ctx.ellipse(-300, -20, 95, 70, -0.15, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(60,70,30,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-330 + i * 12, -70 + i * 6); ctx.quadraticCurveTo(-300 + i * 12, -78 + i * 6, -270 + i * 12, -70 + i * 6); ctx.stroke(); }
  if (G.turtle.blink) { ctx.strokeStyle = '#2b3018'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-330, -35, 16, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-330, -35, 22, 24, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#2b3018'; ctx.beginPath(); ctx.arc(-336, -31, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-341, -37, 4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4a5528'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-330, -38, 26, Math.PI + 0.3, -0.3); ctx.stroke(); }
  ctx.strokeStyle = '#2b3018'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-385, 5); ctx.quadraticCurveTo(-350, 30, -300, 20); ctx.stroke();
  ctx.fillStyle = 'rgba(255,150,150,.25)'; ctx.beginPath(); ctx.ellipse(-300, 5, 22, 12, 0, 0, 7); ctx.fill();
  // Vorderflosse (umarmt Fidibus, wenn hug > 0)
  ctx.fillStyle = '#7e8e48'; ctx.save(); ctx.translate(-180, 80); ctx.rotate(-0.2 - hug * 1.1 + Math.sin(G.t * 1.5) * 0.04);
  ctx.beginPath(); ctx.ellipse(-90, 20, 120, 45, 0.15, 0, 7); ctx.fill(); ctx.restore();
  ctx.restore();
}

// Karten-Illustrationen (klein)
function drawCardArt(cv, kind) {
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  const g = c.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, kind === 'night' ? '#0d2140' : '#2a7ab8'); g.addColorStop(1, '#0b2a4a');
  c.fillStyle = g; c.fillRect(0, 0, 400, 120);
  // Einfache Mini-Szene
  c.save(); c.translate(0, 0);
  const miniFish = (x, y, s, col, closed) => { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = '#b8c94a'; c.beginPath(); c.moveTo(-42, 0); c.lineTo(-70, -26); c.lineTo(-70, 26); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 50, 38, 0, 0, 7); c.fill(); c.fillStyle = '#fbd08a'; c.globalAlpha = .6; c.beginPath(); c.ellipse(6, 14, 34, 18, 0, 0, 7); c.fill(); c.globalAlpha = 1; if (closed) { c.strokeStyle = '#7a3a05'; c.lineWidth = 3; c.beginPath(); c.arc(26, -10, 9, 0.2, Math.PI - 0.2); c.stroke(); } else { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(26, -8, 12, 13, 0, 0, 7); c.fill(); c.fillStyle = '#2a1f14'; c.beginPath(); c.arc(29, -8, 7, 0, 7); c.fill(); } c.strokeStyle = '#7a3a05'; c.lineWidth = 2.5; c.beginPath(); c.arc(40, 8, 8, 0.2, Math.PI - 0.4); c.stroke(); c.restore(); };
  if (kind === 'family') { miniFish(120, 62, 0.75, '#f6a03a'); miniFish(280, 62, 0.75, '#e8761c'); miniFish(200, 78, 0.5, '#f28c28'); }
  else if (kind === 'night') { c.fillStyle = '#eef3ff'; c.beginPath(); c.arc(330, 30, 18, 0, 7); c.fill(); miniFish(120, 70, 0.6, '#f6a03a', true); miniFish(230, 72, 0.6, '#e8761c', true); miniFish(330, 80, 0.45, '#f28c28'); }
  else if (kind === 'parents') { miniFish(150, 60, 0.75, '#f6a03a'); miniFish(260, 70, 0.75, '#e8761c'); c.fillStyle = '#fff'; c.font = 'bold 28px sans-serif'; c.fillText('!', 200, 40); c.fillText('?', 320, 45); }
  c.restore();
}

// ───────────── Schleife ─────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
}
genProps(); makeCollect(); renderMap();
requestAnimationFrame(frame);

// Test-Schnittstelle
window.FB = { G, POS, HOME, STORY, nextStep, startStory, jumpToStep(i) { G.step = i - 1; nextStep(); }, tp(x, y) { const f = G[G.ctrl || 'fid']; f.x = x; f.y = y; G.cam.x = x; G.cam.y = y; }, advanceDialog, tick(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) update(1 / 60); }, setTarget(x, y) { G.target = { x, y }; }, draw };
})();
