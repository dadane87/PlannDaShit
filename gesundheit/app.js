/* Health-Rückblick – Oberfläche, Kennzahlen und Diagramme.
 * Alle Berechnungen laufen lokal. Gespeichert wird nur in IndexedDB dieses Geräts. */
'use strict';

/* ── Formatierung ─────────────────────────────────────────────────────────────── */
const NF = new Intl.NumberFormat('de-DE');
const NF1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt = (v) => NF.format(Math.round(v));
const fmt1 = (v) => NF1.format(v);
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Wochentage ab Montag
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayMs = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const wdOf = (k) => new Date(dayMs(k)).getUTCDay();
const fmtDate = (k, year = true) => `${+k.slice(8, 10)}. ${MONTH[+k.slice(5, 7) - 1]}${year ? ' ' + k.slice(0, 4) : ''}`;
const fmtShort = (k) => `${+k.slice(8, 10)}.${+k.slice(5, 7)}.`;
function hm(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, '0')} min`; }
function clock(min) { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
const sum = (a) => a.reduce((s, v) => s + v, 0);
function std(a) { const m = mean(a); return a.length > 1 ? Math.sqrt(mean(a.map((v) => (v - m) ** 2))) : 0; }

const SPORT = {
  Running: ['Laufen', '🏃'], Walking: ['Gehen', '🚶'], Cycling: ['Radfahren', '🚴'], Swimming: ['Schwimmen', '🏊'],
  Hiking: ['Wandern', '🥾'], TraditionalStrengthTraining: ['Krafttraining', '🏋️'], FunctionalStrengthTraining: ['Funktionelles Krafttraining', '💪'],
  HighIntensityIntervalTraining: ['HIIT', '🔥'], Yoga: ['Yoga', '🧘'], Elliptical: ['Crosstrainer', '⚙️'], Rowing: ['Rudern', '🚣'],
  Dance: ['Tanzen', '💃'], SocialDance: ['Tanzen', '💃'], CardioDance: ['Cardio-Tanz', '💃'], CoreTraining: ['Core-Training', '🎯'], Pilates: ['Pilates', '🤸'],
  Soccer: ['Fußball', '⚽'], Tennis: ['Tennis', '🎾'], Badminton: ['Badminton', '🏸'], TableTennis: ['Tischtennis', '🏓'], Squash: ['Squash', '🎾'],
  Basketball: ['Basketball', '🏀'], Volleyball: ['Volleyball', '🏐'], Handball: ['Handball', '🤾'], Golf: ['Golf', '⛳'], Hockey: ['Hockey', '🏑'],
  Climbing: ['Klettern', '🧗'], Boxing: ['Boxen', '🥊'], Kickboxing: ['Kickboxen', '🥊'], MartialArts: ['Kampfsport', '🥋'],
  DownhillSkiing: ['Ski alpin', '⛷️'], CrossCountrySkiing: ['Langlauf', '🎿'], Snowboarding: ['Snowboard', '🏂'], SnowSports: ['Wintersport', '❄️'],
  StairClimbing: ['Treppensteigen', '🪜'], Stairs: ['Treppen', '🪜'], StepTraining: ['Step-Aerobic', '🪜'], Flexibility: ['Dehnen', '🤸'],
  MixedCardio: ['Cardio-Mix', '❤️'], Cooldown: ['Cool-down', '🧊'], Barre: ['Barre', '🩰'], Pickleball: ['Pickleball', '🏓'],
  PaddleSports: ['Paddeln', '🛶'], SurfingSports: ['Surfen', '🏄'], WaterFitness: ['Wassergymnastik', '💧'], SkatingSports: ['Skaten', '🛼'],
  MindAndBody: ['Achtsamkeit & Körper', '🧘'], Wheelchair: ['Rollstuhl', '♿'], Other: ['Sonstiges', '✨'],
};
const sportName = (t) => (SPORT[t] || [t.replace(/([a-z])([A-Z])/g, '$1 $2'), '✨'])[0];
const sportIcon = (t) => (SPORT[t] || [0, '✨'])[1];

/* ── Speicher (nur auf diesem Gerät) ──────────────────────────────────────────── */
const DB = {
  open() {
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open('health-rueckblick', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  },
  async get(k) {
    try {
      const db = await this.open();
      return await new Promise((res) => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result || null); q.onerror = () => res(null);
      });
    } catch { return null; }
  },
  async set(k, v) {
    try {
      const db = await this.open();
      await new Promise((res) => {
        const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k);
        t.oncomplete = res; t.onerror = res;
      });
    } catch { /* privater Modus: dann eben nur für diese Sitzung */ }
  },
  async del(k) {
    try {
      const db = await this.open();
      await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; });
    } catch { /* egal */ }
  },
};

/* ── Zustand ──────────────────────────────────────────────────────────────────── */
const S = { data: null, period: null, tab: 'start' };
const $ = (sel) => document.querySelector(sel);

/* ── Zeiträume ────────────────────────────────────────────────────────────────── */
function dataRange(data) {
  const keys = Object.keys(data.days).concat(data.workouts.map((w) => w.d)).sort();
  return keys.length ? [keys[0], keys[keys.length - 1]] : null;
}
function periods(data) {
  const r = dataRange(data);
  if (!r) return [];
  const list = [];
  const y0 = +r[0].slice(0, 4), y1 = +r[1].slice(0, 4);
  const lastFrom = keyOf(dayMs(r[1]) - 364 * 86400000);
  list.push({ id: 'l12', label: 'Letzte 12 Monate', short: '12 Monate', from: lastFrom, to: r[1], prev: [keyOf(dayMs(lastFrom) - 365 * 86400000), keyOf(dayMs(lastFrom) - 86400000)] });
  for (let y = y1; y >= y0; y--) {
    const from = `${y}-01-01`, to = y === y1 ? r[1] : `${y}-12-31`;
    const n = Object.keys(data.days).filter((k) => k.startsWith(y + '-')).length;
    if (n < 14) continue;
    list.push({ id: String(y), year: y, label: String(y) + (y === y1 && to < `${y}-12-31` ? ' (bis ' + fmtShort(to) + ')' : ''), short: String(y), from, to, prev: [`${y - 1}-01-01`, `${y - 1}${to.slice(4)}`] });
  }
  return list;
}

/* ── Kennzahlen ───────────────────────────────────────────────────────────────── */
function compute(data, from, to) {
  const D = data.days;
  const keys = Object.keys(D).filter((k) => k >= from && k <= to).sort();
  const vals = (f) => keys.map((k) => [k, f(D[k])]).filter((x) => x[1] != null && x[1] > 0);
  const out = { from, to, keys, nDays: keys.length };

  // Aktivität
  const st = vals((d) => d.st);
  out.steps = {
    n: st.length, total: sum(st.map((x) => x[1])), avg: mean(st.map((x) => x[1])),
    best: st.reduce((b, x) => (!b || x[1] > b[1] ? x : b), null),
    over10k: st.filter((x) => x[1] >= 10000).length,
  };
  // längste Serie ≥ 10.000
  let run = 0, best = 0, bestEnd = null;
  for (let ms = dayMs(from); ms <= dayMs(to); ms += 86400000) {
    const k = keyOf(ms);
    if (D[k] && D[k].st >= 10000) { run++; if (run > best) { best = run; bestEnd = k; } } else run = 0;
  }
  out.steps.streak = best;
  out.steps.streakEnd = bestEnd;
  out.steps.streakStart = bestEnd ? keyOf(dayMs(bestEnd) - (best - 1) * 86400000) : null;
  out.km = sum(vals((d) => d.di).map((x) => x[1]));
  out.flights = sum(vals((d) => d.fl).map((x) => x[1]));
  const ae = vals((d) => d.ae).map((x) => x[1]);
  out.kcal = { total: sum(ae), avg: mean(ae) };
  const ex = vals((d) => d.ex).map((x) => x[1]);
  out.exercise = { total: sum(ex), avg: mean(ex), n: ex.length };

  // Wochentage
  out.weekday = [0, 1, 2, 3, 4, 5, 6].map((w) => mean(st.filter((x) => wdOf(x[0]) === w).map((x) => x[1])));

  // Monate
  const months = [];
  for (let y = +from.slice(0, 4), m = +from.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` <= to.slice(0, 7); m === 12 ? (y++, m = 1) : m++) {
    const mk = `${y}-${String(m).padStart(2, '0')}`;
    const mkeys = keys.filter((k) => k.startsWith(mk));
    const ms = mkeys.map((k) => D[k].st).filter((v) => v > 0);
    const sl = mkeys.map((k) => D[k].sl && D[k].sl.a).filter((v) => v > 0);
    const rh = mkeys.map((k) => D[k].rhr).filter((v) => v > 0);
    months.push({
      key: mk, y, m, label: MON[m - 1], steps: mean(ms), stepsTotal: sum(ms),
      km: sum(mkeys.map((k) => D[k].di || 0)), sleep: mean(sl), rhr: mean(rh),
      workouts: data.workouts.filter((w) => w.d.startsWith(mk) && w.d >= from && w.d <= to).length,
    });
  }
  out.months = months;
  const withSteps = months.filter((m) => m.steps);
  out.topMonth = withSteps.reduce((b, m) => (!b || m.steps > b.steps ? m : b), null);

  // Herz
  const rhr = vals((d) => d.rhr), hrv = vals((d) => d.hrv), hrA = vals((d) => d.hrA);
  const ends = (arr) => {
    if (arr.length < 20) return null;
    const n = Math.max(7, Math.min(30, Math.floor(arr.length / 4)));
    return [mean(arr.slice(0, n).map((x) => x[1])), mean(arr.slice(-n).map((x) => x[1]))];
  };
  out.heart = {
    rhr: mean(rhr.map((x) => x[1])), rhrSeries: rhr, rhrEnds: ends(rhr),
    rhrMin: rhr.reduce((b, x) => (!b || x[1] < b[1] ? x : b), null),
    hrv: mean(hrv.map((x) => x[1])), hrvSeries: hrv, hrvEnds: ends(hrv),
    max: vals((d) => d.hrX).reduce((b, x) => (!b || x[1] > b[1] ? x : b), null),
    beats: hrA.length ? mean(hrA.map((x) => x[1])) * 1440 * keys.length : 0,
    avg: mean(hrA.map((x) => x[1])),
  };

  // Schlaf
  const nights = keys.filter((k) => D[k].sl && D[k].sl.a > 0).map((k) => [k, D[k].sl]);
  const staged = nights.filter((x) => x[1].d + x[1].r + x[1].c > 0);
  out.sleep = {
    n: nights.length,
    avg: mean(nights.map((x) => x[1].a)),
    bed: mean(nights.map((x) => x[1].bt)), wake: mean(nights.map((x) => x[1].wk)),
    bedStd: std(nights.map((x) => x[1].bt)),
    over7: nights.filter((x) => x[1].a >= 420).length,
    longest: nights.reduce((b, x) => (!b || x[1].a > b[1].a ? x : b), null),
    shortest: nights.reduce((b, x) => (!b || x[1].a < b[1].a ? x : b), null),
    stages: staged.length ? {
      n: staged.length,
      d: mean(staged.map((x) => x[1].d)), c: mean(staged.map((x) => x[1].c)),
      r: mean(staged.map((x) => x[1].r)), w: mean(staged.map((x) => x[1].w)),
    } : null,
    weekday: [0, 1, 2, 3, 4, 5, 6].map((w) => {
      // Nacht, die an Wochentag w+1 morgens endet = „Nacht von w auf w+1“ → nach Abend-Wochentag gruppieren
      const ns = nights.filter((x) => (wdOf(x[0]) + 6) % 7 === w).map((x) => x[1]);
      return ns.length ? { bed: mean(ns.map((s) => s.bt)), wake: mean(ns.map((s) => s.wk)), a: mean(ns.map((s) => s.a)), n: ns.length } : null;
    }),
  };

  // Körper
  const wt = vals((d) => d.wt), vo2 = vals((d) => d.vo2);
  out.weight = wt.length ? { first: wt[0], last: wt[wt.length - 1], series: wt, min: Math.min(...wt.map((x) => x[1])), max: Math.max(...wt.map((x) => x[1])) } : null;
  out.vo2 = vo2.length ? { first: vo2[0], last: vo2[vo2.length - 1], series: vo2, max: Math.max(...vo2.map((x) => x[1])) } : null;
  const mi = vals((d) => d.mi);
  out.mindful = { total: sum(mi.map((x) => x[1])), days: mi.length };

  // Ringe
  const rk = Object.keys(data.rings || {}).filter((k) => k >= from && k <= to).sort();
  const R = data.rings || {};
  const moveOk = (r) => r.mg > 0 && r.m >= r.mg;
  const allOk = (r) => moveOk(r) && r.eg > 0 && r.e >= r.eg && r.sg > 0 && r.s >= r.sg;
  let mr = 0, mb = 0;
  for (const k of rk) { if (moveOk(R[k])) { mr++; mb = Math.max(mb, mr); } else mr = 0; }
  out.rings = rk.length ? { n: rk.length, move: rk.filter((k) => moveOk(R[k])).length, all: rk.filter((k) => allOk(R[k])).length, moveStreak: mb } : null;

  // Workouts
  const ws = data.workouts.filter((w) => w.d >= from && w.d <= to);
  const byType = {};
  for (const w of ws) {
    const t = byType[w.t] || (byType[w.t] = { t: w.t, n: 0, min: 0, km: 0, kcal: 0 });
    t.n++; t.min += w.dur; t.km += w.km || 0; t.kcal += w.kcal || 0;
  }
  const types = Object.values(byType).sort((a, b) => b.min - a.min);
  const hours = new Array(24).fill(0);
  for (const w of ws) hours[Math.floor(w.h) % 24]++;
  const runs = ws.filter((w) => w.t === 'Running' && w.km > 0);
  const activeDays = new Set(ws.map((w) => w.d)).size;
  out.workouts = {
    list: ws, n: ws.length, min: sum(ws.map((w) => w.dur)), km: sum(ws.map((w) => w.km || 0)), kcal: sum(ws.map((w) => w.kcal || 0)),
    types, hours, activeDays,
    longest: ws.reduce((b, w) => (!b || w.dur > b.dur ? w : b), null),
    farthest: ws.reduce((b, w) => (w.km > 0 && (!b || w.km > b.km) ? w : b), null),
    perWeek: ws.length / Math.max(1, (dayMs(to) - dayMs(from)) / 86400000 + 1) * 7,
    run: runs.length ? { n: runs.length, km: sum(runs.map((w) => w.km)), longest: runs.reduce((b, w) => (!b || w.km > b.km ? w : b), null),
      pace: sum(runs.map((w) => w.dur)) / sum(runs.map((w) => w.km)) } : null,
    peakHour: hours.indexOf(Math.max(...hours)),
  };
  return out;
}

/* ── Vergleiche für die Story ─────────────────────────────────────────────────── */
const DISTANCES = [
  [42.195, 'einen Marathon'], [145, 'die Strecke München – Salzburg'], [230, 'die Strecke München – Stuttgart'],
  [585, 'die Strecke München – Berlin'], [800, 'den ganzen Jakobsweg (Camino Francés)'], [876, 'Deutschland von Nord nach Süd'],
  [1233, 'den ganzen Rhein entlang'], [2400, 'die Strecke München – Lissabon'], [3940, 'die komplette Route 66'],
  [6400, 'die Strecke Berlin – New York'], [40075, 'einmal um die Erde'],
];
function distanceCompare(km) {
  let c = null;
  for (const d of DISTANCES) if (km >= d[0]) c = d;
  return c;
}
function heightCompare(m) {
  if (m >= 8849) return [8849, 'den Mount Everest'];
  if (m >= 2962) return [2962, 'die Zugspitze'];
  if (m >= 330) return [330, 'den Eiffelturm'];
  return [55, 'den Schiefen Turm von Pisa'];
}
function persona(st) {
  const top = st.workouts.types[0];
  const t = top ? top.t : '';
  let animal;
  if (st.sleep.avg >= 480) animal = ['Koala', '🐨', 'Du nimmst Erholung so ernst wie andere ihr Training.'];
  else if (/Hiking|Climbing/.test(t) || st.flights / Math.max(1, st.nDays) > 25) animal = ['Bergziege', '🐐', 'Höhenmeter sind dein Revier.'];
  else if (/Running/.test(t)) animal = ['Gepard', '🐆', 'Schnell, ausdauernd, nie lange still.'];
  else if (/Strength|HighIntensity|Core|Boxing/.test(t)) animal = ['Bär', '🐻', 'Kraft ist deine Superkraft.'];
  else if (/Yoga|Pilates|Flexibility|MindAndBody|Barre/.test(t)) animal = ['Katze', '🐈', 'Beweglich, ruhig, immer im Gleichgewicht.'];
  else if (/Swimming|Water|Surfing|Paddle|Rowing/.test(t)) animal = ['Delfin', '🐬', 'Im Wasser bist du zu Hause.'];
  else if (/Cycling/.test(t)) animal = ['Wanderfalke', '🦅', 'Auf zwei Rädern bist du kaum zu bremsen.'];
  else if ((st.steps.avg || 0) >= 10000) animal = ['Wolf', '🐺', 'Du legst jeden Tag weite Strecken zurück.'];
  else animal = ['Fuchs', '🦊', 'Vielseitig und schlau unterwegs.'];
  let chrono = null;
  if (st.sleep.n >= 20) {
    if (st.sleep.wake != null && st.sleep.wake <= 6.5 * 60) chrono = ['Frühaufsteher-Typ', '🌅'];
    else if (st.sleep.bed != null && st.sleep.bed >= 30) chrono = ['Nachteule', '🦉'];
    else chrono = ['Gewohnheitsmensch', '🌙'];
  }
  return { animal, chrono };
}

/* ── Diagramme (SVG) ──────────────────────────────────────────────────────────── */
const W = 340;
let chartId = 0;
const CHARTS = {};

function compact(v) {
  if (Math.abs(v) >= 10000) return NF.format(Math.round(v / 1000)) + 'k';
  if (Math.abs(v) >= 1000) return NF1.format(v / 1000) + 'k';
  return NF.format(Math.round(v * 10) / 10);
}
function barPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function barChart(o) {
  const H = o.height || 170, L = 34, R = 6, T = 10, B = 22;
  const vals = o.values.map((v) => v || 0);
  const rawMax = Math.max(o.max || 0, ...vals, o.ref || 0) || 1;
  const step = o.integer ? Math.max(1, niceStep(rawMax / 4)) : niceStep(rawMax / 4);
  const ticks = Math.ceil(rawMax / step - 1e-9);
  const max = step * ticks;
  const n = vals.length, band = (W - L - R) / n, bw = Math.max(2, Math.min(band * 0.64, 28));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">`;
  for (let i = 0; i <= ticks; i++) {
    const v = step * i, yy = y(v);
    s += `<line class="grid${i === 0 ? ' base' : ''}" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 6}" y="${yy + 3.5}" text-anchor="end">${(o.fmtAxis || compact)(v)}</text>`;
  }
  vals.forEach((v, i) => {
    const x = L + band * i + (band - bw) / 2;
    const hl = o.highlight === i;
    s += `<path class="bar${hl ? ' hl' : ''}" style="fill:${o.color}${o.highlight != null && !hl ? ';opacity:.45' : ''}" d="${barPath(x, y(v), bw, y(0) - y(v))}"/>`;
    const lab = o.labels[i];
    const every = n > 14 ? Math.ceil(n / 8) : 1;
    if (lab != null && i % every === 0) s += `<text class="ax" x="${L + band * i + band / 2}" y="${H - 7}" text-anchor="middle">${esc(lab)}</text>`;
    s += `<rect class="hit" x="${L + band * i}" y="${T}" width="${band}" height="${H - T - B}" data-tip="${esc(o.tips ? o.tips[i] : fmt(v))}"/>`;
  });
  if (o.ref) {
    const yy = y(o.ref);
    s += `<line class="ref" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax refl" x="${W - R}" y="${yy - 4}" text-anchor="end">${esc(o.refLabel || '')}</text>`;
  }
  return s + '</svg>';
}

function hbarChart(o) {
  // horizontale Balken mit Beschriftung links und Wert rechts
  const rowH = 30, H = o.rows.length * rowH + 4, L = 118, R = 64;
  const max = Math.max(...o.rows.map((r) => r.v), 1);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">`;
  o.rows.forEach((r, i) => {
    const yy = 4 + i * rowH, w = Math.max(3, (W - L - R) * r.v / max);
    s += `<text class="lab" x="${L - 8}" y="${yy + 15}" text-anchor="end">${esc(r.label)}</text>`;
    s += `<path class="bar" style="fill:${o.color}" d="M${L},${yy + 4}H${L + w - 4}Q${L + w},${yy + 4} ${L + w},${yy + 8}V${yy + 16}Q${L + w},${yy + 20} ${L + w - 4},${yy + 20}H${L}Z"/>`;
    s += `<text class="val" x="${L + w + 6}" y="${yy + 16}">${esc(r.text)}</text>`;
    s += `<rect class="hit" x="0" y="${yy}" width="${W}" height="${rowH}" data-tip="${esc(r.tip || r.text)}"/>`;
  });
  return s + '</svg>';
}

function rolling(series, n = 7) {
  const out = [];
  for (let i = 0; i < series.length; i++) {
    const t = dayMs(series[i][0]);
    const win = [];
    for (let j = i; j >= 0 && t - dayMs(series[j][0]) < n * 86400000; j--) win.push(series[j][1]);
    out.push(mean(win));
  }
  return out;
}

function lineChart(o) {
  // o.series: [[key, value], …] · o.from/o.to · Tageswerte als Punkte, gleitender Schnitt als Linie
  const H = o.height || 180, L = 34, R = 8, T = 12, B = 22;
  const ser = o.series;
  if (ser.length < 2) return '<p class="leer">Zu wenige Messwerte für ein Diagramm.</p>';
  const t0 = dayMs(o.from), t1 = dayMs(o.to);
  const ysv = ser.map((x) => x[1]);
  let lo = Math.min(...ysv), hi = Math.max(...ysv);
  const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
  const step = niceStep((hi - lo) / 3);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = (k) => L + (W - L - R) * (dayMs(k) - t0) / Math.max(1, t1 - t0);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const roll = o.window ? rolling(ser, o.window) : ysv;
  const id = 'c' + (++chartId);
  let s = `<svg class="chart line" id="${id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || '')}">`;
  for (let v = lo; v <= hi + 1e-9; v += step) {
    s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${(o.fmtAxis || compact)(v)}</text>`;
  }
  // Monatsmarken
  const span = (t1 - t0) / 86400000;
  const mstep = span > 400 ? 3 : span > 200 ? 2 : 1;
  for (let ms = Date.UTC(+o.from.slice(0, 4), +o.from.slice(5, 7) - 1, 1), i = 0; ms <= t1; i++) {
    const k = keyOf(ms);
    if (ms >= t0 && i % mstep === 0) s += `<text class="ax" x="${x(k)}" y="${H - 7}" text-anchor="middle">${MON[+k.slice(5, 7) - 1]}</text>`;
    const d = new Date(ms); ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  if (o.window && ser.length > 2) {
    for (const p of ser) s += `<circle class="dot" cx="${x(p[0]).toFixed(1)}" cy="${y(p[1]).toFixed(1)}" r="1.6" style="fill:${o.color}"/>`;
  }
  const pts = ser.map((p, i) => `${x(p[0]).toFixed(1)},${y(roll[i]).toFixed(1)}`).join(' ');
  s += `<polyline class="ln" points="${pts}" style="stroke:${o.color}"/>`;
  s += `<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><circle class="xp" r="4.5" style="display:none;fill:${o.color}"/>`;
  s += `<rect class="ov" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/>`;
  s += '</svg>';
  CHARTS[id] = {
    xs: ser.map((p) => x(p[0])), ys: roll.map(y),
    tips: ser.map((p, i) => `${fmtDate(p[0])}<br><b>${(o.fmtTip || fmt1)(roll[i])}</b>${o.window ? ' ' + o.unit + ` <span class="mut">(${o.window}-Tage-Schnitt)</span><br>Tageswert: ${(o.fmtTip || fmt1)(p[1])} ${o.unit}` : ' ' + o.unit}`),
  };
  return s;
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

function heatmap(data, from, to) {
  // 12 kleine Monatskalender, Farbe = Schritte
  const levels = [2500, 5000, 7500, 10000, 12500];
  const lvl = (v) => { let l = 0; for (const t of levels) if (v >= t) l++; return l; };
  let html = '<div class="hm">';
  let ms = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, 1);
  const end = dayMs(to);
  let guard = 0;
  while (ms <= end && guard++ < 14) {
    const d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth();
    const first = (d.getUTCDay() + 6) % 7;
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    html += `<div class="hm-m"><div class="hm-t">${MONTH[m]}${from.slice(0, 4) !== to.slice(0, 4) ? ' ' + String(y).slice(2) : ''}</div><div class="hm-g">`;
    for (let i = 0; i < first; i++) html += '<i></i>';
    for (let day = 1; day <= dim; day++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const v = data.days[k] && data.days[k].st;
      if (k < from || k > to) { html += '<i class="out"></i>'; continue; }
      html += v ? `<i class="l${lvl(v)}" data-tip="${esc(WDL[wdOf(k)] + ', ' + fmtDate(k) + '<br><b>' + fmt(v) + '</b> Schritte')}"></i>` : `<i class="l-" data-tip="${esc(fmtDate(k) + '<br>keine Daten')}"></i>`;
    }
    html += '</div></div>';
    ms = Date.UTC(y, m + 1, 1);
  }
  html += '</div><div class="legend hm-leg"><span>weniger</span>';
  for (let i = 0; i <= 5; i++) html += `<i class="l${i}"></i>`;
  html += '<span>mehr</span><span class="mut">· Stufen je 2.500 Schritte</span></div>';
  return html;
}

function sleepWindow(st) {
  // Pro Wochentag: von Ø Einschlafen bis Ø Aufwachen (Zeitachse 20:00 – 11:00)
  const rows = ORDER.map((w) => [w, st.sleep.weekday[w]]).filter((r) => r[1]);
  if (!rows.length) return '';
  const lo = Math.min(-240, Math.floor(Math.min(...rows.map((r) => r[1].bed)) / 60) * 60);
  const hi = Math.max(660, Math.ceil(Math.max(...rows.map((r) => r[1].wake)) / 60) * 60);
  const L = 70, R = 10, T = 6, rowH = 26, H = T + rows.length * rowH + 22;
  const x = (m) => L + (W - L - R) * (m - lo) / (hi - lo);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Schlaffenster nach Wochentag">`;
  for (let m = lo; m <= hi; m += 120) s += `<line class="grid" x1="${x(m)}" x2="${x(m)}" y1="${T}" y2="${H - 20}"/><text class="ax" x="${x(m)}" y="${H - 6}" text-anchor="middle">${+clock(m).slice(0, 2)}${m === lo ? ' Uhr' : ''}</text>`;
  rows.forEach(([w, r], i) => {
    const yy = T + i * rowH;
    const next = WD[(w + 1) % 7];
    s += `<text class="lab" x="${L - 8}" y="${yy + 16}" text-anchor="end">${WD[w]} → ${next}</text>`;
    s += `<rect class="bar" x="${x(r.bed)}" y="${yy + 5}" width="${Math.max(4, x(r.wake) - x(r.bed))}" height="14" rx="4" style="fill:var(--c-sleep)"/>`;
    s += `<rect class="hit" x="0" y="${yy}" width="${W}" height="${rowH}" data-tip="${esc(`Nacht ${WDL[w]} → ${WDL[(w + 1) % 7]}<br>Ø ${clock(r.bed)} – ${clock(r.wake)} Uhr<br><b>${hm(r.a)}</b> Schlaf · ${r.n} Nächte`)}"/>`;
  });
  return s + '</svg>';
}

function stageBar(stg) {
  const parts = [['Tiefschlaf', stg.d, 'var(--s1)'], ['Kernschlaf', stg.c, 'var(--s2)'], ['REM', stg.r, 'var(--s3)'], ['Wach', stg.w, 'var(--s4)']];
  const tot = sum(parts.map((p) => p[1])) || 1;
  let html = '<div class="stack">';
  for (const p of parts) if (p[1] > 0) html += `<span style="flex:${p[1]};background:${p[2]}" data-tip="${esc(`${p[0]}<br><b>${hm(p[1])}</b> pro Nacht (${Math.round(p[1] / tot * 100)} %)`)}"></span>`;
  html += '</div><div class="legend">';
  for (const p of parts) html += `<span><i style="background:${p[2]}"></i>${p[0]} <b>${Math.round(p[1] / tot * 100)} %</b> <span class="mut">${hm(p[1])}</span></span>`;
  return html + '</div>';
}

/* ── Tooltip ──────────────────────────────────────────────────────────────────── */
function setupTips() {
  const tip = $('#tip');
  let hideT = 0;
  const show = (html, cx, cy) => {
    clearTimeout(hideT);
    tip.innerHTML = html; tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    let left = cx - r.width / 2, top = cy - r.height - 14;
    left = Math.max(8, Math.min(innerWidth - r.width - 8, left));
    if (top < 8) top = cy + 18;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  };
  const hide = () => { tip.style.display = 'none'; document.querySelectorAll('.chart.line .xh,.chart.line .xp').forEach((e) => (e.style.display = 'none')); };
  const handle = (e) => {
    const ov = e.target.closest && e.target.closest('.ov');
    if (ov) {
      const svg = ov.ownerSVGElement, c = CHARTS[svg.id];
      if (!c) return;
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let bi = 0, bd = Infinity;
      c.xs.forEach((xx, i) => { const d = Math.abs(xx - p.x); if (d < bd) { bd = d; bi = i; } });
      const xh = svg.querySelector('.xh'), xp = svg.querySelector('.xp');
      xh.setAttribute('x1', c.xs[bi]); xh.setAttribute('x2', c.xs[bi]); xh.style.display = '';
      xp.setAttribute('cx', c.xs[bi]); xp.setAttribute('cy', c.ys[bi]); xp.style.display = '';
      const sp = svg.createSVGPoint(); sp.x = c.xs[bi]; sp.y = c.ys[bi];
      const scr = sp.matrixTransform(svg.getScreenCTM());
      show(c.tips[bi], scr.x, scr.y);
      return;
    }
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) {
      const r = t.getBoundingClientRect();
      show(t.getAttribute('data-tip'), r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
    } else if (e.type !== 'pointermove' || !tip.contains(e.target)) hide();
  };
  document.addEventListener('pointermove', handle);
  document.addEventListener('pointerdown', handle);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('pointerleave', hide);
}

/* ── Ansichten ────────────────────────────────────────────────────────────────── */
function delta(cur, prev, opts = {}) {
  if (cur == null || prev == null || !prev) return '';
  const d = opts.abs ? cur - prev : (cur - prev) / prev * 100;
  if (Math.abs(d) < (opts.abs ? 0.05 : 0.5)) return `<span class="dl">≈ wie ${opts.label}</span>`;
  const arrow = d > 0 ? '▲' : '▼';
  const txt = opts.abs ? (d > 0 ? '+' : '−') + fmt1(Math.abs(d)) + (opts.unit || '') : (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + ' %';
  return `<span class="dl">${arrow} ${txt} ggü. ${opts.label}</span>`;
}

function tile(o) {
  return `<div class="tile" style="--c:${o.color}"><div class="tl"><i></i>${esc(o.label)}</div>
    <div class="tv">${o.value}<small>${o.unit ? ' ' + esc(o.unit) : ''}</small></div><div class="ts">${o.sub || ''}</div></div>`;
}

function card(title, body, sub) {
  return `<section class="card"><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}${body}</section>`;
}

function periodPicker() {
  const ps = periods(S.data);
  return `<label class="picker"><span class="sr">Zeitraum</span><select id="period">${ps.map((p) => `<option value="${p.id}"${S.period.id === p.id ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label>`;
}

function prevLabel(p) { return p.year ? String(p.year - 1) : 'Vorjahr'; }

function viewOverview() {
  const p = S.period, st = compute(S.data, p.from, p.to), pv = compute(S.data, p.prev[0], p.prev[1]);
  const hasPrev = pv.nDays > 30;
  const lab = prevLabel(p);
  const d = (c, v, o = {}) => (hasPrev ? delta(c, v, { label: lab, ...o }) : '');
  const tiles = [];
  if (st.steps.n) tiles.push(tile({ label: 'Schritte pro Tag', color: 'var(--c-act)', value: fmt(st.steps.avg), sub: d(st.steps.avg, pv.steps.avg) || `${fmt(st.steps.total)} insgesamt` }));
  if (st.km) tiles.push(tile({ label: 'Gehstrecke', color: 'var(--c-act)', value: fmt(st.km), unit: 'km', sub: d(st.km, pv.km) || `Ø ${fmt1(st.km / st.nDays)} km pro Tag` }));
  if (st.steps.n) tiles.push(tile({ label: 'Tage ≥ 10.000', color: 'var(--c-act)', value: fmt(st.steps.over10k), unit: 'Tage', sub: `${Math.round(st.steps.over10k / st.steps.n * 100)} % aller Tage · längste Serie ${st.steps.streak}` }));
  if (st.kcal.avg) tiles.push(tile({ label: 'Aktivkalorien', color: 'var(--c-work)', value: fmt(st.kcal.avg), unit: 'kcal/Tag', sub: d(st.kcal.avg, pv.kcal.avg) }));
  if (st.exercise.n) tiles.push(tile({ label: 'Trainingsminuten', color: 'var(--c-work)', value: fmt(st.exercise.avg), unit: 'min/Tag', sub: d(st.exercise.avg, pv.exercise.avg) || `${fmt(st.exercise.total / 60)} Stunden insgesamt` }));
  if (st.workouts.n) tiles.push(tile({ label: 'Workouts', color: 'var(--c-work)', value: fmt(st.workouts.n), sub: `${fmt1(st.workouts.perWeek)} pro Woche · ${fmt(st.workouts.min / 60)} h` }));
  if (st.heart.rhr) tiles.push(tile({ label: 'Ruhepuls', color: 'var(--c-heart)', value: fmt(st.heart.rhr), unit: 'bpm', sub: d(st.heart.rhr, pv.heart.rhr, { abs: true, unit: ' bpm' }) }));
  if (st.heart.hrv) tiles.push(tile({ label: 'Herzfrequenzvariabilität', color: 'var(--c-heart)', value: fmt(st.heart.hrv), unit: 'ms', sub: d(st.heart.hrv, pv.heart.hrv, { abs: true, unit: ' ms' }) }));
  if (st.sleep.n) tiles.push(tile({ label: 'Schlaf pro Nacht', color: 'var(--c-sleep)', value: hm(st.sleep.avg).replace(' min', ''), sub: d(st.sleep.avg, pv.sleep.avg) || `${Math.round(st.sleep.over7 / st.sleep.n * 100)} % der Nächte ≥ 7 h` }));
  if (st.sleep.n) tiles.push(tile({ label: 'Schlafenszeit', color: 'var(--c-sleep)', value: clock(st.sleep.bed), unit: 'Uhr', sub: `Aufwachen Ø ${clock(st.sleep.wake)} · ±${fmt(st.sleep.bedStd)} min` }));
  if (st.flights) tiles.push(tile({ label: 'Stockwerke', color: 'var(--c-act)', value: fmt(st.flights), sub: `≈ ${fmt(st.flights * 3)} Höhenmeter` }));
  if (st.rings) tiles.push(tile({ label: 'Bewegungsring geschlossen', color: 'var(--c-work)', value: fmt(st.rings.move), unit: 'Tage', sub: `alle drei Ringe: ${fmt(st.rings.all)} Tage` }));
  if (st.vo2) tiles.push(tile({ label: 'VO₂max (Cardiofitness)', color: 'var(--c-heart)', value: fmt1(st.vo2.last[1]), unit: 'ml/kg·min', sub: delta(st.vo2.last[1], st.vo2.first[1], { abs: true, label: 'Anfang', unit: '' }) }));
  if (st.weight) tiles.push(tile({ label: 'Gewicht', color: 'var(--c-body)', value: fmt1(st.weight.last[1]), unit: 'kg', sub: delta(st.weight.last[1], st.weight.first[1], { abs: true, label: 'Anfang', unit: ' kg' }) }));
  if (st.mindful.total) tiles.push(tile({ label: 'Achtsamkeit', color: 'var(--c-body)', value: fmt(st.mindful.total), unit: 'min', sub: `an ${st.mindful.days} Tagen` }));

  const story = p.year || p.id === 'l12' ? `<button class="story-cta" data-story="${p.id}"><span class="sc-k">Dein Rückblick</span><span class="sc-t">${esc(p.short)} als Story ansehen</span><span class="sc-p">▶</span></button>` : '';
  return `${story}
    <div class="tiles">${tiles.join('')}</div>
    ${st.steps.n ? card('Schritte im Kalender', heatmap(S.data, p.from, p.to), 'Jedes Kästchen ist ein Tag. Antippen zeigt den Wert.') : ''}
    ${st.steps.best ? card('Bestwerte', `<ul class="list">
        <li><span>🏆 Meiste Schritte</span><b>${fmt(st.steps.best[1])}</b><em>${fmtDate(st.steps.best[0])}</em></li>
        ${st.steps.streak ? `<li><span>🔥 Längste 10k-Serie</span><b>${st.steps.streak} Tage</b><em>${fmtShort(st.steps.streakStart)} – ${fmtShort(st.steps.streakEnd)}</em></li>` : ''}
        ${st.heart.rhrMin ? `<li><span>💓 Niedrigster Ruhepuls</span><b>${fmt(st.heart.rhrMin[1])} bpm</b><em>${fmtDate(st.heart.rhrMin[0])}</em></li>` : ''}
        ${st.sleep.longest ? `<li><span>😴 Längste Nacht</span><b>${hm(st.sleep.longest[1].a)}</b><em>${fmtDate(st.sleep.longest[0])}</em></li>` : ''}
        ${st.workouts.longest ? `<li><span>${sportIcon(st.workouts.longest.t)} Längstes Workout</span><b>${hm(st.workouts.longest.dur)}</b><em>${sportName(st.workouts.longest.t)}, ${fmtDate(st.workouts.longest.d)}</em></li>` : ''}
      </ul>`) : ''}`;
}

function viewTrends() {
  const p = S.period, st = compute(S.data, p.from, p.to);
  const ms = st.months;
  let h = '';
  if (st.steps.n) {
    h += card('Schritte pro Monat', barChart({ title: 'Schritte pro Monat', values: ms.map((m) => m.steps), labels: ms.map((m) => m.label), color: 'var(--c-act)',
      tips: ms.map((m) => `${MONTH[m.m - 1]} ${m.y}<br><b>${m.steps ? fmt(m.steps) : '–'}</b> Schritte pro Tag<br>${fmt1(m.km)} km im Monat`),
      highlight: st.topMonth ? ms.indexOf(st.topMonth) : null, ref: 10000, refLabel: 'Ziel 10.000' }),
    `Durchschnitt pro Tag · stärkster Monat: <b>${st.topMonth ? MONTH[st.topMonth.m - 1] : '–'}</b>`);
    const wdv = ORDER.map((w) => st.weekday[w]);
    const topWd = ORDER[wdv.indexOf(Math.max(...wdv.map((v) => v || 0)))];
    h += card('Schritte nach Wochentag', barChart({ title: 'Schritte nach Wochentag', values: wdv, labels: ORDER.map((w) => WD[w]), color: 'var(--c-act)',
      tips: ORDER.map((w) => `${WDL[w]}<br><b>${st.weekday[w] ? fmt(st.weekday[w]) : '–'}</b> Schritte im Schnitt`), highlight: ORDER.indexOf(topWd), height: 150 }),
    `Dein aktivster Tag: <b>${WDL[topWd]}</b>`);
  }
  if (st.heart.rhrSeries.length > 1) {
    const e = st.heart.rhrEnds;
    h += card('Ruhepuls', lineChart({ title: 'Ruhepuls', series: st.heart.rhrSeries, from: p.from, to: p.to, color: 'var(--c-heart)', window: 7, unit: 'bpm', fmtTip: fmt }),
      `Linie: 7-Tage-Schnitt, Punkte: Tageswerte${e ? ` · von Ø ${fmt(e[0])} auf ${fmt(e[1])} bpm` : ''}`);
  }
  if (st.heart.hrvSeries.length > 1) {
    const e = st.heart.hrvEnds;
    h += card('Herzfrequenzvariabilität (HRV)', lineChart({ title: 'HRV', series: st.heart.hrvSeries, from: p.from, to: p.to, color: 'var(--c-heart)', window: 14, unit: 'ms', fmtTip: fmt }),
      `Höher ist meist ein Zeichen guter Erholung. Linie: 14-Tage-Schnitt${e ? ` · von Ø ${fmt(e[0])} auf ${fmt(e[1])} ms` : ''}`);
  }
  if (st.sleep.n) {
    h += card('Schlafdauer pro Monat', barChart({ title: 'Schlafdauer pro Monat', values: ms.map((m) => m.sleep && m.sleep / 60), labels: ms.map((m) => m.label), color: 'var(--c-sleep)',
      tips: ms.map((m) => `${MONTH[m.m - 1]} ${m.y}<br><b>${m.sleep ? hm(m.sleep) : '–'}</b> pro Nacht`), ref: 7, refLabel: '7 Stunden', fmtAxis: (v) => fmt(v) + ' h', max: 8 }),
    `Ø ${hm(st.sleep.avg)} pro Nacht · ${st.sleep.n} Nächte erfasst`);
    h += card('Schlaffenster nach Wochentag', sleepWindow(st), 'Durchschnittliche Einschlaf- und Aufwachzeit');
    if (st.sleep.stages) h += card('Schlafphasen', stageBar(st.sleep.stages), `Durchschnitt aus ${st.sleep.stages.n} Nächten mit Phasen-Messung`);
  }
  if (st.vo2 && st.vo2.series.length > 1) h += card('VO₂max', lineChart({ title: 'VO2max', series: st.vo2.series, from: p.from, to: p.to, color: 'var(--c-heart)', unit: 'ml/kg·min' }), 'Cardiofitness, von der Apple Watch geschätzt');
  if (st.weight && st.weight.series.length > 1) h += card('Gewicht', lineChart({ title: 'Gewicht', series: st.weight.series, from: p.from, to: p.to, color: 'var(--c-body)', unit: 'kg' }),
    `von ${fmt1(st.weight.first[1])} auf ${fmt1(st.weight.last[1])} kg`);
  return h || '<p class="leer">Für diesen Zeitraum gibt es keine Verlaufsdaten.</p>';
}

function viewWorkouts() {
  const p = S.period, st = compute(S.data, p.from, p.to), w = st.workouts;
  if (!w.n) return '<p class="leer">In diesem Zeitraum wurden keine Workouts aufgezeichnet.</p>';
  const ms = st.months;
  const tiles = [
    tile({ label: 'Workouts', color: 'var(--c-work)', value: fmt(w.n), sub: `${fmt1(w.perWeek)} pro Woche` }),
    tile({ label: 'Trainingszeit', color: 'var(--c-work)', value: fmt(w.min / 60), unit: 'h', sub: `Ø ${fmt(w.min / w.n)} min pro Workout` }),
    tile({ label: 'Distanz', color: 'var(--c-work)', value: fmt(w.km), unit: 'km', sub: 'Laufen, Rad, Schwimmen …' }),
    tile({ label: 'Energie', color: 'var(--c-work)', value: fmt(w.kcal), unit: 'kcal', sub: `≈ ${fmt(w.kcal / 250)} Tafeln Schokolade` }),
  ];
  if (w.run) tiles.push(tile({ label: 'Laufen', color: 'var(--c-work)', value: fmt1(w.run.km), unit: 'km', sub: `Ø Tempo ${paceStr(w.run.pace)} /km` }));
  tiles.push(tile({ label: 'Aktive Tage', color: 'var(--c-work)', value: fmt(w.activeDays), sub: 'Tage mit mindestens einem Workout' }));
  const top = w.types.slice(0, 8);
  const other = w.types.slice(8);
  const rows = top.map((t) => ({ label: `${sportIcon(t.t)} ${sportName(t.t)}`, v: t.min, text: `${fmt(t.min / 60)} h · ${t.n}×`, tip: `${sportName(t.t)}<br><b>${t.n}</b> Workouts · ${hm(t.min)}${t.km ? '<br>' + fmt1(t.km) + ' km' : ''}` }));
  if (other.length) rows.push({ label: `Weitere (${other.length})`, v: sum(other.map((t) => t.min)), text: `${fmt(sum(other.map((t) => t.min)) / 60)} h · ${sum(other.map((t) => t.n))}×` });
  const hourLabels = w.hours.map((_, i) => (i % 3 === 0 ? String(i) : null));
  const recent = w.list.slice(-8).reverse();
  return `<div class="tiles">${tiles.join('')}</div>
    ${card('Sportarten nach Trainingszeit', hbarChart({ title: 'Sportarten', rows, color: 'var(--c-work)' }))}
    ${card('Workouts pro Monat', barChart({ title: 'Workouts pro Monat', values: ms.map((m) => m.workouts), labels: ms.map((m) => m.label), color: 'var(--c-work)', tips: ms.map((m) => `${MONTH[m.m - 1]} ${m.y}<br><b>${m.workouts}</b> Workouts`), fmtAxis: (v) => fmt(v), integer: true, height: 150 }))}
    ${card('Tageszeit', barChart({ title: 'Startzeit der Workouts', values: w.hours, labels: hourLabels.map((l) => (l == null ? null : l + ' h')), color: 'var(--c-work)', tips: w.hours.map((v, i) => `${i}–${i + 1} Uhr<br><b>${v}</b> Workouts`), fmtAxis: (v) => fmt(v), integer: true, height: 140 }),
      `Am häufigsten startest du gegen <b>${w.peakHour} Uhr</b>`)}
    ${card('Rekorde', `<ul class="list">
      ${w.longest ? `<li><span>⏱️ Längstes Workout</span><b>${hm(w.longest.dur)}</b><em>${sportName(w.longest.t)}, ${fmtDate(w.longest.d)}</em></li>` : ''}
      ${w.farthest ? `<li><span>📏 Weiteste Strecke</span><b>${fmt1(w.farthest.km)} km</b><em>${sportName(w.farthest.t)}, ${fmtDate(w.farthest.d)}</em></li>` : ''}
      ${w.run ? `<li><span>🏃 Längster Lauf</span><b>${fmt1(w.run.longest.km)} km</b><em>${fmtDate(w.run.longest.d)}</em></li>` : ''}
    </ul>`)}
    ${card('Zuletzt', `<ul class="list">${recent.map((x) => `<li><span>${sportIcon(x.t)} ${esc(sportName(x.t))}</span><b>${fmt(x.dur)} min${x.km ? ' · ' + fmt1(x.km) + ' km' : ''}</b><em>${fmtDate(x.d)}${x.hr ? ' · Ø ' + x.hr + ' bpm' : ''}</em></li>`).join('')}</ul>`)}`;
}
function paceStr(minPerKm) { const m = Math.floor(minPerKm), s = Math.round((minPerKm - m) * 60); return `${m}:${String(s === 60 ? 0 : s).padStart(2, '0')}`; }

function viewStories() {
  const ps = periods(S.data);
  const grads = ['linear-gradient(135deg,#ff0080,#7928ca)', 'linear-gradient(135deg,#f7971e,#ff3d5a)', 'linear-gradient(135deg,#00c9a7,#3a47d5)', 'linear-gradient(135deg,#fc466b,#3f5efb)'];
  return `<p class="intro">Dein Jahr als Story: die wichtigsten Zahlen, Rekorde und Muster, Folie für Folie. Antippen rechts = weiter, links = zurück, gedrückt halten = Pause.</p>
    <div class="story-grid">${ps.map((p, i) => {
      const st = compute(S.data, p.from, p.to);
      return `<button class="story-card" data-story="${p.id}" style="background:${grads[i % grads.length]}">
        <span class="y">${esc(p.short)}</span>
        <span class="k">${st.steps.total ? fmt(st.steps.total) + ' Schritte' : ''}${st.workouts.n ? '<br>' + st.workouts.n + ' Workouts' : ''}</span>
        <span class="go">Story ansehen ▶</span></button>`;
    }).join('')}</div>`;
}

function viewData() {
  const d = S.data, r = dataRange(d);
  const n = Object.keys(d.days).length;
  return `${card('Deine Daten', `<ul class="list">
      <li><span>Quelle</span><b>${d.source === 'demo' ? 'Beispieldaten' : 'Apple-Health-Export'}</b></li>
      <li><span>Zeitraum</span><b>${r ? fmtShort(r[0]) + r[0].slice(0, 4) + ' – ' + fmtShort(r[1]) + r[1].slice(0, 4) : '–'}</b></li>
      <li><span>Tage mit Daten</span><b>${fmt(n)}</b></li>
      <li><span>Workouts</span><b>${fmt(d.workouts.length)}</b></li>
      ${d.records ? `<li><span>Gelesene Messwerte</span><b>${fmt(d.records)}</b></li>` : ''}
      <li><span>Eingelesen am</span><b>${new Date(d.importedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</b></li>
    </ul>`)}
    ${card('Datenschutz', '<p class="txt">Deine Gesundheitsdaten verlassen dieses Gerät nicht. Die Datei wird direkt im Browser gelesen und ausgewertet; gespeichert werden nur die zusammengefassten Tageswerte, und zwar lokal auf diesem Gerät. Es gibt keinen Server, kein Konto und keine Analyse-Tools.</p>')}
    <div class="btns">
      <button class="btn primary" data-act="import">Neuen Export einlesen</button>
      ${d.source !== 'demo' ? '' : '<p class="hint">Gerade siehst du erfundene Beispieldaten.</p>'}
      <button class="btn danger" data-act="delete">Alle Daten auf diesem Gerät löschen</button>
    </div>
    ${howto()}`;
}

function howto() {
  return card('So kommst du an deinen Export', `<ol class="steps">
      <li>Öffne die <b>Health</b>-App auf dem iPhone.</li>
      <li>Tippe oben rechts auf dein <b>Profilbild</b>.</li>
      <li>Ganz unten: <b>Alle Gesundheitsdaten exportieren</b> → <b>Exportieren</b>. Das dauert ein bis ein paar Minuten.</li>
      <li>Im Teilen-Menü <b>In „Dateien“ sichern</b> wählen.</li>
      <li>Hier auf <b>Export einlesen</b> tippen und die Datei <b>Export.zip</b> auswählen.</li>
    </ol>`);
}

/* ── Rahmen, Tabs, Navigation ─────────────────────────────────────────────────── */
const TABS = [
  ['start', 'Übersicht', '<path d="M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z"/>'],
  ['trends', 'Trends', '<path d="M3 17l5-6 4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'],
  ['workouts', 'Workouts', '<path d="M13.5 5.5a2 2 0 1 0 0-.01zM9 21l2-6 3 3v3h2v-4.5l-2.5-2.6.8-3.2A6 6 0 0 0 18 13v-2a4 4 0 0 1-3.4-1.9l-1-1.6a2 2 0 0 0-2.4-.8L6 9v5h2v-3.6l1.8-.7L7 21z"/>'],
  ['story', 'Rückblick', '<path d="M12 2l2.6 6.3 6.4.5-4.9 4.2 1.5 6.5L12 16l-5.6 3.5 1.5-6.5L3 8.8l6.4-.5z"/>'],
  ['daten', 'Daten', '<path d="M12 3C7 3 4 4.6 4 6.5v11C4 19.4 7 21 12 21s8-1.6 8-3.5v-11C20 4.6 17 3 12 3zm0 2c3.9 0 6 1.1 6 1.5S15.9 8 12 8 6 6.9 6 6.5 8.1 5 12 5zm0 14c-3.9 0-6-1.1-6-1.5v-2.2c1.5.8 3.6 1.2 6 1.2s4.5-.4 6-1.2v2.2c0 .4-2.1 1.5-6 1.5zm0-4.5c-3.9 0-6-1.1-6-1.5V10.8c1.5.8 3.6 1.2 6 1.2s4.5-.4 6-1.2V13c0 .4-2.1 1.5-6 1.5z"/>'],
];
const TITLES = { start: 'Übersicht', trends: 'Trends', workouts: 'Workouts', story: 'Rückblick', daten: 'Daten' };

function render() {
  const main = $('#main');
  if (!S.data) {
    $('#tabbar').hidden = true;
    main.innerHTML = welcome();
    return;
  }
  $('#tabbar').hidden = false;
  for (const k in CHARTS) delete CHARTS[k];
  const withPicker = ['start', 'trends', 'workouts'].includes(S.tab);
  const body = { start: viewOverview, trends: viewTrends, workouts: viewWorkouts, story: viewStories, daten: viewData }[S.tab]();
  main.innerHTML = `<header class="lt"><h1>${TITLES[S.tab]}</h1>${withPicker ? periodPicker() : ''}</header>
    ${S.data.source === 'demo' && S.tab !== 'daten' ? '<div class="demo-note">Beispieldaten · <button data-act="import">eigenen Export einlesen</button></div>' : ''}
    ${body}`;
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
}

function welcome() {
  return `<div class="welcome">
    <div class="hero-ic"><svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.4 3.3 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.7 0 5.9 3.9 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg></div>
    <h1>Health-Rückblick</h1>
    <p class="lead">Deine Apple-Health-Daten ausgewertet: Kennzahlen, Diagramme und dein Jahr als Story.</p>
    <div class="btns">
      <button class="btn primary" data-act="import">Export einlesen</button>
      <button class="btn" data-act="demo">Mit Beispieldaten ausprobieren</button>
    </div>
    <p class="privacy">🔒 Alles bleibt auf deinem iPhone. Die Datei wird direkt im Browser ausgewertet und nirgendwohin hochgeladen.</p>
    ${howto()}
  </div>`;
}

/* ── Import ───────────────────────────────────────────────────────────────────── */
function pickFile() { $('#file').value = ''; $('#file').click(); }

function importFile(file) {
  const ov = $('#progress');
  ov.hidden = false;
  $('#pg-title').textContent = 'Export wird gelesen …';
  $('#pg-bar').style.width = '0%';
  $('#pg-txt').textContent = `${file.name} · ${fmt1(file.size / 1048576)} MB`;
  let worker;
  try { worker = new Worker('parser.js'); } catch (e) { fail('Der Browser konnte den Leser nicht starten: ' + e.message); return; }
  const t0 = Date.now();
  worker.onmessage = async (ev) => {
    const m = ev.data;
    if (m.type === 'progress') {
      const pct = m.total ? Math.min(100, m.done / m.total * 100) : 0;
      $('#pg-bar').style.width = pct.toFixed(1) + '%';
      const el = (Date.now() - t0) / 1000;
      const eta = pct > 3 ? Math.max(0, el / pct * 100 - el) : null;
      $('#pg-txt').textContent = `${Math.round(pct)} % · ${fmt(m.records)} Messwerte${eta != null ? ` · noch ca. ${eta > 90 ? Math.round(eta / 60) + ' min' : Math.round(eta) + ' s'}` : ''}`;
    } else if (m.type === 'done') {
      worker.terminate();
      $('#pg-title').textContent = 'Fertig!';
      S.data = m.result;
      await DB.set('data', S.data);
      ov.hidden = true;
      choosePeriod(); S.tab = 'start'; render(); scrollTo(0, 0);
    } else if (m.type === 'error') { worker.terminate(); fail(m.message); }
  };
  worker.onerror = (e) => { fail(e.message || 'Unbekannter Fehler beim Lesen.'); worker.terminate(); };
  worker.postMessage({ file });
}
function fail(msg) {
  $('#progress').hidden = true;
  alert('Das hat nicht geklappt.\n\n' + msg);
}

function choosePeriod() {
  const ps = periods(S.data);
  // Standard: das jüngste Jahr, wenn es schon mindestens 3 Monate hat, sonst „Letzte 12 Monate“
  const y = ps.find((p) => p.year);
  S.period = y && (dayMs(y.to) - dayMs(y.from)) / 86400000 >= 90 ? y : ps[0];
}

/* ── Start ────────────────────────────────────────────────────────────────────── */
async function init() {
  $('#tabbar').innerHTML = TABS.map(([id, label, icon]) => `<button data-tab="${id}"><svg viewBox="0 0 24 24">${icon}</svg><span>${label}</span></button>`).join('');
  setupTips();
  document.addEventListener('click', async (e) => {
    const tb = e.target.closest('#tabbar button');
    if (tb) { S.tab = tb.dataset.tab; render(); scrollTo(0, 0); return; }
    const sb = e.target.closest('[data-story]');
    if (sb) { const p = periods(S.data).find((x) => x.id === sb.dataset.story); if (p) openStory(S.data, p); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'import') pickFile();
    if (act === 'demo') { S.data = makeDemoData(); await DB.set('data', S.data); choosePeriod(); S.tab = 'start'; render(); }
    if (act === 'delete' && confirm('Alle eingelesenen Gesundheitsdaten von diesem Gerät löschen?')) { await DB.del('data'); S.data = null; render(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'period') { S.period = periods(S.data).find((p) => p.id === e.target.value); render(); }
    if (e.target.id === 'file' && e.target.files[0]) importFile(e.target.files[0]);
  });
  S.data = await DB.get('data');
  if (S.data) choosePeriod();
  render();
  if (location.hash === '#demo' && !S.data) { S.data = makeDemoData(); choosePeriod(); render(); }
}
init();
