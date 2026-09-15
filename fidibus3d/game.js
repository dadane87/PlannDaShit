// Fidibus und der Weg nach Hause – Version 2 in 3D (three.js).
// Spiellogik, Geschichte und Steuerung wie in Version 1 (Welt in 2D-Einheiten), Darstellung in 3D.
import * as THREE from './three.module.min.js';
import { makeFish, animFish, makeWhale, animWhale, makeStar, makeJelly, animJelly, makeTurtle, animTurtle, setLids, M } from './figures3d.js';

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
// Umrechnung 2D-Welt → 3D (1 Einheit = 100 px, y nach oben)
const U = 0.01, X = x => x * U, Y = y => (WORLD_H - y) * U;

// ───────────── Renderer / Kamera ─────────────
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
let W = 1, H = 1, scale = 1, baseScale = 1, zoom = 1;
function resize() {
  W = window.innerWidth; H = window.innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  baseScale = H > W ? Math.max(H / 1000, W / 640) : Math.max(H / 900, W / 1500); scale = baseScale * zoom;
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
    if (x > POS.whale.x - 450 && x < POS.whale.x + 700) continue;
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
  { type: 'play', who: 'fid', untilX: POS.star.x - 340, station: 'star' },
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
  { type: 'setup', fn: () => { setCtrl('fid'); G.fid.mood = 'happy'; G.fid.hidden = false; G.mama.mood = G.papa.mood = 'happy'; G.current = 'way'; G.stationsDone.add('parents'); G.mama.dir = G.papa.dir = G.fid.dir = -1; } },
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
  G.fid.talking = l.who === 'Fidibus'; G.mama.talking = l.who === 'Mama'; G.papa.talking = l.who === 'Papa';
  $('txt').textContent = '';
  $('next').textContent = G.dialogIdx < G.dialogQueue.length - 1 ? 'Tippen zum Weiterlesen ▶' : 'Tippen zum Weiterschwimmen ▶';
}
function advanceDialog() {
  const l = G.dialogQueue[G.dialogIdx];
  if (!l || G.mode !== 'dialog') return;
  if (G.typed < l.text.length) { G.typed = l.text.length; $('txt').textContent = l.text; return; }
  G.dialogIdx++; G.typed = 0;
  if (G.dialogIdx < G.dialogQueue.length) { renderDialog(); SFX.talk(); }
  else { G.fid.talking = G.mama.talking = G.papa.talking = false; $('dlg').classList.remove('show'); const d = G.onDialogEnd; G.onDialogEnd = null; d && d(); }
}
function showHint(t, sec) { $('hint').textContent = t; $('hint').classList.add('show'); G.hintT = sec; }
function renderMap() {
  const m = $('map'); m.innerHTML = '';
  for (const s of STATIONS) { const d = document.createElement('div'); d.className = 'st' + (G.stationsDone.has(s.id) ? ' done' : '') + (G.current === s.id ? ' now' : ''); d.textContent = s.icon; d.title = s.name; m.appendChild(d); }
}

// ───────────── Eingabe ─────────────
let pointerDown = false;
const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), _hit = new THREE.Vector3();
function toWorld(px, py) {
  _ray.setFromCamera(new THREE.Vector2(px / W * 2 - 1, -(py / H) * 2 + 1), camera);
  if (_ray.ray.intersectPlane(_plane, _hit)) return { x: _hit.x / U, y: WORLD_H - _hit.y / U };
  return { x: G.cam.x, y: G.cam.y };
}
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
  makeCollect(); if (window.FB) FB.rebuildCollect(); renderMap(); $('bubbles').textContent = '🫧 0';
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
  if (sp > 150 && Math.random() < dt * 1.1) G.particles.push({ x: f.x + f.dir * 62, y: f.y - 12, r: 2.5 + Math.random() * 3.5, vy: -40 - Math.random() * 30, vx: f.dir * 20, life: 1.3 });
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
  // Herauszoomen bei großen Figuren (Wal, Schildkröte), damit sie ins Bild passen
  const who = G.ctrl ? G[G.ctrl] : G.fid;
  let zt = 1;
  if (who.x > POS.whale.x - 700 && who.x < POS.whale.x + 500) zt = H > W ? 0.56 : 0.8;
  else if (who.x > POS.turtle.x - 800) zt = H > W ? 0.8 : 0.92;
  else if (who.x > POS.star.x - 600 && who.x < POS.star.x + 400) zt = H > W ? 0.86 : 0.95;
  else if (who.x > POS.jelly.x - 600 && who.x < POS.jelly.x + 400) zt = H > W ? 0.8 : 0.92;
  if (G.mode === 'title' || G.mode === 'cards') zt = zoom;
  zoom += (zt - zoom) * (1 - Math.exp(-2.5 * dt)); scale = baseScale * zoom;
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
      follow(G.fid, POS.turtle.x - 330, POS.turtle.y + 40, dt, 2, 300); G.fid.dir = 1;
      G.turtle.hug = smooth(0.4, 0.75, p); G.fid.hidden = G.turtle.hug > 0.5;
      if (p > 0.5 && Math.random() < dt * 2) G.hearts.push({ x: G.fid.x + (Math.random() - 0.5) * 80, y: G.fid.y - 60, life: 1.6, vx: 0 });
      if (p > 0.55) { G.fid.mood = 'happy'; }
      if (G.t > 0.8 && G.t < 0.9) SFX.hug();
    } else if (G.cut === 'reunion') {
      G.turtle.hug = lerp(G.turtle.hug, 0, 1 - Math.exp(-3 * dt)); if (G.turtle.hug < 0.5) G.fid.hidden = false;
      const mx = POS.turtle.x - 520, my = POS.turtle.y - 120;
      follow(G.mama, mx, my, dt, 3, 400); follow(G.papa, mx - 90, my + 60, dt, 3, 400);
      if (p > 0.25) { follow(G.fid, mx + 40, my + 40, dt, 4, 700); G.fid.dir = -1; if (p > 0.6) G.fid.mood = 'front'; }
      if (p > 0.45 && Math.random() < dt * 4) G.hearts.push({ x: mx + (Math.random() - 0.5) * 200, y: my - 40, life: 1.8, vx: (Math.random() - 0.5) * 30 });
      if (G.t > 1.1 && G.t < 1.2) SFX.hug();
      G.mama.mood = G.papa.mood = 'happy';
    } else if (G.cut === 'night') {
      G.night = smooth(0, 0.5, p); G.moon = smooth(0.1, 0.7, p);
      follow(G.fid, HOME.x + 10, HOME.y + 20, dt, 2, 250); follow(G.mama, HOME.x - 80, HOME.y - 30, dt, 2, 250); follow(G.papa, HOME.x + 95, HOME.y - 20, dt, 2, 250);
      G.mama.dir = 1; G.papa.dir = -1;
      if (p > 0.6) { G.fid.mood = 'sleep'; G.fid.dir = 1; }
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
  if (G.mode === 'cut' && G.cut === 'hug') focus = { x: POS.turtle.x - 150, y: POS.turtle.y + 40 };
  if (G.mode === 'cut' && G.cut === 'reunion') focus = { x: POS.turtle.x - 400, y: POS.turtle.y + 20 };
  if (G.mode === 'cut' && G.cut === 'night' || G.mode === 'end') focus = { x: HOME.x + 40, y: HOME.y + 60 };
  if (G.mode === 'title') focus = { x: HOME.x + 200, y: 900 };
  if (G.mode === 'dialog' && G.stationsDone.size >= 0 && ctrl.x > 1500) {
    const nearWhale = ctrl.x > POS.whale.x - 700 && ctrl.x < POS.whale.x + 500, nearStar = ctrl.x > POS.star.x - 600 && ctrl.x < POS.star.x + 400, nearJelly = ctrl.x > POS.jelly.x - 600 && ctrl.x < POS.jelly.x + 400;
    const dx = nearWhale ? 330 : nearStar ? 210 : 240, dy = nearStar ? 200 : nearJelly ? 60 : 330;
    focus = { x: ctrl.x + dx * (st && st.family ? -1 : 1), y: ctrl.y + dy };
  }
  const visW = W / scale, visH = H / scale;
  const tx = clamp(focus.x + (G.mode === 'play' && !st.family ? (G[st.who] === G.fid ? 120 : 120) : 0) * (focus.dir || 1) * (st && st.family ? 0 : 1), visW / 2, WORLD_W - visW / 2);
  const extra = (G.mode === 'dialog' || G.mode === 'cut') ? 300 : 0;   // bei Dialogen darf die Kamera tiefer, damit die Box nichts verdeckt
  const ty = visH >= WORLD_H + extra ? (WORLD_H + extra) / 2 : clamp(focus.y, visH / 2, WORLD_H + extra - visH / 2);
  const k = 1 - Math.exp(-4 * dt);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
}


// ───────────── 3D-Welt ─────────────
const G_SPH2 = new THREE.SphereGeometry(1, 14, 10), G_CYL2 = new THREE.CylinderGeometry(1, 1, 1, 8);
const hemi = new THREE.HemisphereLight(0xd8efff, 0x27507a, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2); sun.position.set(6, 26, 14); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18; sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
const playerLight = new THREE.PointLight(0xffe9c0, 0, 22, 1.5); scene.add(playerLight);
const FOG = new THREE.FogExp2(0x2a78b4, 0.016); scene.fog = FOG; scene.background = new THREE.Color(0x2a78b4);

function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// Sandboden
{
  const t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#c9ad7a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${120 + Math.random() * 80 | 0},${90 + Math.random() * 60 | 0},${40 + Math.random() * 40 | 0},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, i * 58 + Math.sin(x * 0.05 + i) * 8); g.stroke(); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 12);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(170, 60), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(56, Y(1300), 0); floor.receiveShadow = true; scene.add(floor);
}
let sd3 = 9; const r3 = () => { sd3 = (sd3 * 16807) % 2147483647; return (sd3 - 1) / 2147483646; };
const rockMat = M(0x2f4468, { rough: 0.9, flat: true }), rockMat2 = M(0x3d5a86, { rough: 0.9, flat: true });
const CORAL = [0xe86f8a, 0xf2a04b, 0x7fd1c0, 0xc77dd8, 0xf7d354, 0xff8f6b];
const swayers = [];
function rock(x, y, z, r, mat = rockMat) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat); m.position.set(x, y, z); m.scale.set(1 + r3() * 0.6, 0.6 + r3() * 0.5, 1 + r3() * 0.5); m.rotation.set(r3(), r3() * 3, r3()); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; }
function coral(x, z, s, col) {
  const g = new THREE.Group(); g.position.set(x, Y(1300), z); g.scale.setScalar(s); scene.add(g);
  const br = (px, py, pz, a, l, d) => { if (!d) return; const c = new THREE.Mesh(G_CYL2, M(col, { rough: 0.7 })); c.scale.set(0.06 + d * 0.03, l, 0.06 + d * 0.03); c.position.set(px, py + l / 2, pz); c.rotation.z = a; c.castShadow = true; g.add(c); const nx = px - Math.sin(a) * l, ny = py + Math.cos(a) * l; br(nx, ny, pz, a - 0.5 - r3() * 0.3, l * 0.72, d - 1); br(nx, ny, pz + (r3() - 0.5) * 0.2, a + 0.45 + r3() * 0.3, l * 0.7, d - 1); };
  br(0, 0, 0, 0, 0.8, 4);
}
function grassBlade(x, z, h, col, thick = 0.08) { const m = new THREE.Mesh(new THREE.BoxGeometry(thick, h, thick * 0.4), M(col, { rough: 0.8 })); m.geometry.translate(0, h / 2, 0); m.position.set(x, Y(1300), z); m.rotation.y = r3() * 3; m.castShadow = true; scene.add(m); swayers.push({ m, ph: r3() * 6, amp: 0.05 + r3() * 0.06 }); return m; }
function anemone(x, z, col) { const g = new THREE.Group(); g.position.set(x, Y(1300), z); scene.add(g); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const c = cylMesh(0.05, 0.9, col); c.position.set(Math.cos(a) * 0.2, 0.45, Math.sin(a) * 0.2); c.rotation.z = Math.cos(a) * 0.5; c.rotation.x = -Math.sin(a) * 0.5; g.add(c); swayers.push({ m: c, ph: i, amp: 0.08, rot: 'x' }); } }
function cylMesh(r, h, col) { const m = new THREE.Mesh(G_CYL2, M(col, { rough: 0.7 })); m.scale.set(r, h, r); m.castShadow = true; return m; }
// Kulisse entlang der Welt
for (let x = -6; x < 118; x += 5 + r3() * 6) {
  const dark = x > 54 && x < 82;
  rock(x, Y(1300) - 1.5, -9 - r3() * 6, 3 + r3() * 5, r3() < 0.5 ? rockMat : rockMat2);
  if (r3() < 0.5) rock(x + 2, Y(1300) - 0.3, -3.5 - r3() * 2, 0.8 + r3() * 1.2, rockMat2);
  if (dark && r3() < 0.6) continue;
  if (x > 87 && x < 98) continue;
  const r = r3();
  if (r < 0.35) coral(x + r3() * 3, -2 - r3() * 3, 0.9 + r3() * 0.8, CORAL[Math.floor(r3() * CORAL.length)]);
  else if (r < 0.6) anemone(x + r3() * 3, -1.5 - r3() * 2, CORAL[Math.floor(r3() * CORAL.length)]);
  else for (let k = 0; k < 4; k++) grassBlade(x + r3() * 2, -1 - r3() * 3, 1 + r3() * 1.5, 0x3fa66b);
  if (r3() < 0.5) for (let k = 0; k < 3; k++) grassBlade(x + r3() * 3, 1 + r3() * 2.5, 0.6 + r3() * 0.8, 0x2f7a52, 0.06);
}
// Seegraswand
for (let i = 0; i < 150; i++) grassBlade(X(POS.grassFrom) + r3() * X(POS.grassTo - POS.grassFrom), -4 + r3() * 7, 7 + r3() * 4, i % 3 ? 0x1f5a3a : 0x2c7048, 0.14);
// Felsspalte (Zuhause) mit Moosbett
{
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 1.1, 14, 28, Math.PI), M(0x2f3f5c, { rough: 0.9, flat: true })); arch.position.set(X(HOME.x), Y(1300) + 0.2, -1.2); arch.scale.set(1.3, 1, 1.4); arch.castShadow = true; arch.receiveShadow = true; scene.add(arch);
  rock(X(HOME.x) - 3.6, Y(1300) + 0.2, -1.5, 1.6); rock(X(HOME.x) + 3.6, Y(1300) + 0.3, -1.4, 1.7); rock(X(HOME.x), Y(1300) + 3.4, -2.4, 2.2);
  for (let i = -3; i <= 3; i++) { const m = new THREE.Mesh(G_SPH2, M(0x5f9a63, { rough: 0.9 })); m.scale.set(0.5, 0.22, 0.45); m.position.set(X(HOME.x) + i * 0.45, Y(1300) + 0.12, 0.2 + Math.sin(i) * 0.15); m.receiveShadow = true; scene.add(m); }
}
// Lichtstrahlen (zarte Flächen) und Plankton
const rays = new THREE.Group(); scene.add(rays);
for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + r3(), 26), new THREE.MeshBasicMaterial({ color: 0xdff3ff, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })); m.position.set(i * 5 + r3() * 3, 12, -5 - r3() * 4); m.rotation.z = 0.25; rays.add(m); }
const plankton = (() => { const n = 900; const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = r3() * 120 - 3; pos[i * 3 + 1] = 1 + r3() * 13; pos[i * 3 + 2] = -6 + r3() * 10; } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfe9ff, size: 0.07, transparent: true, opacity: 0.5 })); scene.add(p); return p; })();
// Mond
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 10, 64, 64, 64); r.addColorStop(0, 'rgba(245,250,255,1)'); r.addColorStop(0.35, 'rgba(240,246,255,.9)'); r.addColorStop(1, 'rgba(240,246,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }), transparent: true, opacity: 0, depthWrite: false }));
moon.scale.set(6, 6, 1); scene.add(moon);

// Sprites: Blasen und Herzen
const bubbleTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(24, 24, 4, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.5, 'rgba(200,235,255,.35)'); r.addColorStop(0.95, 'rgba(210,240,255,.7)'); r.addColorStop(1, 'rgba(210,240,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); });
const heartTex = canvasTex(64, 64, (g) => { g.fillStyle = '#ff6b8a'; g.translate(32, 36); g.scale(2.2, 2.2); g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-14, -6, -8, -18, 0, -10); g.bezierCurveTo(8, -18, 14, -6, 0, 8); g.fill(); });
const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTex, transparent: true, depthWrite: false }), heartMat = new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false });
const pool = { b: [], h: [] };
function spriteFrom(kind) { const arr = pool[kind]; const s = arr.find(x => !x.visible); if (s) return s; const n = new THREE.Sprite(kind === 'b' ? bubbleMat.clone() : heartMat.clone()); scene.add(n); arr.push(n); return n; }

// ───────────── Figuren ─────────────
const fidM = makeFish('fid'), mamaM = makeFish('mama'), papaM = makeFish('papa');
const whaleM = makeWhale(), starM = makeStar(), jellyM = makeJelly(), turtleM = makeTurtle();
scene.add(fidM, mamaM, papaM, whaleM, starM, jellyM, turtleM);
whaleM.position.set(X(2500) + 4.2, Y(700), 0.4);
starM.position.set(X(POS.star.x), Y(1300) + 1.0, 0.6); rock(X(POS.star.x), Y(1300) + 0.2, 0.2, 2.2, rockMat2).scale.set(1.7, 0.55, 1.1);
jellyM.position.set(X(POS.jelly.x), Y(720), 0);
turtleM.position.set(X(POS.turtle.x) + 1.5, Y(1300) + 1.4, -0.3);
const collectSprites = [];
function rebuildCollect() { for (const s of collectSprites) scene.remove(s); collectSprites.length = 0; for (const b of G.collect) { const s = new THREE.Sprite(bubbleMat); s.scale.setScalar(b.r * U * 2.6); s.position.set(X(b.x), Y(b.y), 0.2); s.userData.b = b; scene.add(s); collectSprites.push(s); } }
const blink = (period, off) => { const ph = (G.t + off) % period; return ph < 0.13 ? Math.sin(ph / 0.13 * Math.PI) : 0; };

function syncFish(m, f, kind, off) {
  m.visible = !f.hidden;
  m.position.set(X(f.x), Y(f.y) + Math.sin(f.fin * 0.9) * 0.03, 0);
  const front = f.mood === 'front';
  const yaw = front ? -Math.PI / 2 : (f.dir > 0 ? Math.PI : 0);
  m.rotation.set(0, yaw, (f.dir > 0 ? 1 : -1) * -f.tilt * 0.8 * (front ? 0 : 1));
  const line = G.mode === 'dialog' ? G.dialogQueue[G.dialogIdx] : null; const typing = !!(line && G.typed < line.text.length);
  animFish(m, G.t + off, { moving: Math.hypot(f.vx, f.vy) > 30, speed: Math.hypot(f.vx, f.vy) / 100, mood: f.mood, talking: f.talking && typing, blink: blink(kind === 'fid' ? 4.1 : 5.3, off) });
}
function render3d(dt) {
  const t = G.t;
  const ctrl = G.ctrl ? G[G.ctrl] : G.fid;
  syncFish(fidM, G.fid, 'fid', 0.4); syncFish(mamaM, G.mama, 'mama', 1.9); syncFish(papaM, G.papa, 'papa', 3.1);
  // Umarmung: Fidibus schmiegt sich an den Kopf der Schildkröte
  const hug = G.turtle.hug;
  if (hug > 0.5) { fidM.visible = true; fidM.position.set(turtleM.position.x - 5.2, turtleM.position.y + 0.1, 0.9); fidM.rotation.set(0, Math.PI * 0.75, 0.45); setLids(fidM, true); }
  animTurtle(turtleM, t, { hug, blink: blink(5.6, 3.3) });
  animWhale(whaleM, t, blink(4.7, 1.3)); animJelly(jellyM, t, blink(5.1, 2.2));
  jellyM.position.y = Y(720) + Math.sin(t * 1.1) * 0.3; whaleM.position.y = Y(700) + Math.sin(t * 0.6) * 0.18; whaleM.rotation.z = Math.sin(t * 0.6) * 0.02;
  starM.rotation.y = Math.sin(t * 0.5) * 0.06;
  for (const s of swayers) { const a = Math.sin(t * 1.3 + s.ph) * s.amp; if (s.rot === 'x') s.m.rotation.x += (a - (s.m.userData.prev || 0)), s.m.userData.prev = a; else s.m.rotation.z = a; }
  plankton.position.y = Math.sin(t * 0.2) * 0.3;
  // Sammelblasen
  for (const s of collectSprites) { s.visible = !s.userData.b.got; s.position.y = Y(s.userData.b.y) + Math.sin(t * 1.5 + s.userData.b.ph) * 0.1; }
  // Partikel / Herzen / Spur
  for (const arr of [pool.b, pool.h]) for (const s of arr) s.visible = false;
  for (const p of G.particles) { const s = spriteFrom('b'); s.visible = true; s.position.set(X(p.x), Y(p.y), 0.6); s.scale.setScalar(p.r * U * 2.4); s.material.opacity = Math.min(1, p.life) * 0.8; }
  for (const p of G.trail) { const s = spriteFrom('b'); s.visible = true; s.position.set(X(p.x), Y(p.y), 0.5); s.scale.setScalar(p.r * U * 2.4 * p.life); s.material.opacity = 0.5 * p.life; }
  for (const h of G.hearts) { const s = spriteFrom('h'); s.visible = true; s.position.set(X(h.x), Y(h.y), 0.8); const k = (14 + (1.8 - h.life) * 6) * U * 2; s.scale.set(k, k, 1); s.material.opacity = Math.min(1, h.life); }
  // Licht, Nebel, Nacht
  const dark = G.dark * (1 - G.mut * 0.4), night = G.night;
  const bg = new THREE.Color(0x2a78b4).lerp(new THREE.Color(0x030a1c), Math.max(dark * 0.9, night * 0.85));
  scene.background = bg; FOG.color.copy(bg); FOG.density = 0.016 + dark * 0.06 + night * 0.01;
  hemi.intensity = 1.25 * (1 - dark * 0.75) * (1 - night * 0.55); sun.intensity = 2.2 * (1 - dark * 0.85) * (1 - night * 0.7);
  playerLight.position.set(X(ctrl.x), Y(ctrl.y) + 0.5, 1.5); playerLight.intensity = (dark * 3.5 + night * 0.6) * (0.4 + G.mut * 0.8); playerLight.distance = 8 + G.mut * 14;
  rays.children.forEach((r, i) => { r.material.opacity = 0.06 * (1 - dark) * (1 - night * 0.7); r.position.x = i * 5 + Math.sin(t * 0.3 + i) * 0.5; });
  moon.material.opacity = Math.max(G.moon, 0); moon.position.set(camera.position.x + 6, 15.5, -14);
  document.getElementById('fade').style.opacity = G.fadeEyes * 0.85;
  document.getElementById('vig').style.opacity = Math.max(0, dark - 0.1) * 0.9;
  // Kamera: schräg von vorn, folgt dem 2D-Kamerapunkt
  const dist = (H > W ? 15 : 11.5) / zoom;
  const lx = X(G.cam.x), ly = Y(G.cam.y) + 0.4;
  camera.position.set(lx + 1.6, ly + 2.2 + dist * 0.12, dist);
  camera.lookAt(lx, ly, 0);
  sun.position.set(lx + 6, 26, 14); sun.target.position.set(lx, Y(1300), 0);
  renderer.render(scene, camera);
}

// ───────────── Karten: gerenderte Szenen aus Version 1 ─────────────
function drawCardArt(el, kind) {
  const map = { family: 's-familie', night: 's-nacht', parents: 's-eltern', cover: 's-familie', sleep: 's-schlaf' };
  el.src = 'img/' + (map[kind] || 's-familie') + '.jpg';
}

// ───────────── Schleife ─────────────
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render3d(dt);
}
makeCollect(); rebuildCollect(); renderMap();
const _startStory = startStory;
document.getElementById('loading').style.display = 'none';
requestAnimationFrame(frame);

window.FB = { G, POS, HOME, STORY, scene, camera, renderer, nextStep, startStory, jumpToStep(i) { G.step = i - 1; nextStep(); }, tp(x, y) { const f = G[G.ctrl || 'fid']; f.x = x; f.y = y; G.cam.x = x; G.cam.y = y; }, advanceDialog, tick(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) update(1 / 60); }, setTarget(x, y) { G.target = { x, y }; }, draw: () => render3d(0), rebuildCollect, setZoom(v) { zoom = v; } };
