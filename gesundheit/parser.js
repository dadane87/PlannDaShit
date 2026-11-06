/* Health-Rückblick – Web-Worker, der den Apple-Health-Export liest.
 *
 * Eingabe: die Datei export.zip (Health-App → Profilbild → „Alle Gesundheitsdaten exportieren“)
 *          oder die entpackte export.xml.
 * Ausgabe: kompakte Tageswerte (Schritte, Puls, Schlaf …), Workouts und Aktivitätsringe.
 *
 * Alles passiert lokal im Browser: die Datei wird nie hochgeladen.
 * Die Datei wird gestreamt (nie komplett in den Speicher geladen) – auch Exporte mit mehreren GB gehen.
 */
'use strict';

self.onmessage = async (ev) => {
  try {
    const result = await parseFile(ev.data.file);
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};

/* ── ZIP lesen (nur das Nötigste: Zentralverzeichnis, ZIP64, Deflate) ───────────── */

async function bytes(file, start, end) {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 16777216;
const u64 = (b, o) => u32(b, o) + u32(b, o + 4) * 4294967296;

async function findZipEntry(file) {
  const tailLen = Math.min(file.size, 65557 + 20);
  const tail = await bytes(file, file.size - tailLen, file.size);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Die Datei ist kein gültiges ZIP-Archiv.');
  let count = u16(tail, eocd + 10);
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);
  if (cdOffset === 0xFFFFFFFF || cdSize === 0xFFFFFFFF || count === 0xFFFF) {
    // ZIP64: Locator steht direkt vor dem EOCD
    const loc = eocd - 20;
    if (loc >= 0 && u32(tail, loc) === 0x07064b50) {
      const z64off = u64(tail, loc + 8);
      const z = await bytes(file, z64off, z64off + 56);
      if (u32(z, 0) !== 0x06064b50) throw new Error('ZIP64-Verzeichnis nicht gefunden.');
      count = u64(z, 32); cdSize = u64(z, 40); cdOffset = u64(z, 48);
    }
  }
  const cd = await bytes(file, cdOffset, cdOffset + cdSize);
  const dec = new TextDecoder();
  let p = 0, best = null;
  for (let n = 0; n < count && p + 46 <= cd.length; n++) {
    if (u32(cd, p) !== 0x02014b50) break;
    const method = u16(cd, p + 10);
    let comp = u32(cd, p + 20), uncomp = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28), extraLen = u16(cd, p + 30), commentLen = u16(cd, p + 32);
    let local = u32(cd, p + 42);
    const name = dec.decode(cd.subarray(p + 46, p + 46 + nameLen));
    // ZIP64-Extra-Feld
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = u16(cd, e), len = u16(cd, e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncomp === 0xFFFFFFFF) { uncomp = u64(cd, q); q += 8; }
        if (comp === 0xFFFFFFFF) { comp = u64(cd, q); q += 8; }
        if (local === 0xFFFFFFFF) { local = u64(cd, q); q += 8; }
      }
      e += 4 + len;
    }
    const base = name.split('/').pop();
    if (base === 'export.xml' || base === 'Export.xml' || base === 'Exportieren.xml') {
      best = { name, method, comp, uncomp, local };
    }
    p = eEnd + commentLen;
  }
  if (!best) throw new Error('Im ZIP wurde keine export.xml gefunden. Bitte die Datei „export.zip“ aus der Health-App wählen.');
  const lh = await bytes(file, best.local, best.local + 30);
  if (u32(lh, 0) !== 0x04034b50) throw new Error('ZIP-Eintrag beschädigt.');
  best.dataStart = best.local + 30 + u16(lh, 26) + u16(lh, 28);
  return best;
}

/* ── Hilfen für Datum und Attribute ────────────────────────────────────────────── */

// „2025-03-14 07:31:12 +0100“ → Uhrzeit als „Wanduhr“-Millisekunden (ohne Zeitzone) bzw. echte ms
function wall(s) {
  return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16), +s.slice(17, 19));
}
function absMs(s) {
  const w = wall(s);
  const z = s.slice(20, 25); // +0100
  if (z.length < 5) return w;
  const sign = z[0] === '-' ? -1 : 1;
  return w - sign * ((+z.slice(1, 3)) * 60 + (+z.slice(3, 5))) * 60000;
}
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

function A(line, key) {
  const k = ' ' + key + '="';
  const i = line.indexOf(k);
  if (i < 0) return null;
  const s = i + k.length;
  return line.slice(s, line.indexOf('"', s));
}

function distKm(v, unit) {
  if (unit === 'km') return v;
  if (unit === 'mi') return v * 1.609344;
  if (unit === 'm') return v / 1000;
  if (unit === 'ft') return v * 0.0003048;
  if (unit === 'yd') return v * 0.0009144;
  return v;
}
function energyKcal(v, unit) {
  if (unit === 'kJ') return v / 4.184;
  return v; // kcal / Cal
}
function massKg(v, unit) {
  if (unit === 'lb') return v * 0.45359237;
  if (unit === 'g') return v / 1000;
  if (unit === 'st') return v * 6.35029;
  return v;
}

/* ── Parser ───────────────────────────────────────────────────────────────────── */

const SUM_TYPES = {
  HKQuantityTypeIdentifierStepCount: 'st',
  HKQuantityTypeIdentifierDistanceWalkingRunning: 'di',
  HKQuantityTypeIdentifierActiveEnergyBurned: 'ae',
  HKQuantityTypeIdentifierFlightsClimbed: 'fl',
  HKQuantityTypeIdentifierAppleExerciseTime: 'ex',
};
const AVG_TYPES = {
  HKQuantityTypeIdentifierRestingHeartRate: 'rhr',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'hrv',
};
const LAST_TYPES = {
  HKQuantityTypeIdentifierVO2Max: 'vo2',
  HKQuantityTypeIdentifierBodyMass: 'wt',
};
const ASLEEP = {
  HKCategoryValueSleepAnalysisAsleep: 'u',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'u',
  HKCategoryValueSleepAnalysisAsleepCore: 'c',
  HKCategoryValueSleepAnalysisAsleepDeep: 'd',
  HKCategoryValueSleepAnalysisAsleepREM: 'r',
};

function makeParser() {
  const sums = {};   // kürzel → tag → { quelle: summe }
  for (const k of Object.values(SUM_TYPES)) sums[k] = {};
  const mindful = {}; // tag → { quelle: minuten }
  const hr = {};      // tag → [summe, anzahl, min, max]
  const avg = { rhr: {}, hrv: {} }; // tag → [summe, anzahl]
  const last = { vo2: {}, wt: {} }; // tag → [zeit, wert]
  const sleep = {};   // nacht → quelle → {a,d,r,c,u,w,ib,bt,wk}
  const rings = {};
  const workouts = [];
  const me = {};
  let cur = null;     // aktuelles Workout
  let records = 0;

  function addSum(map, day, src, v) {
    const d = map[day] || (map[day] = {});
    d[src] = (d[src] || 0) + v;
  }

  function finishWorkout() {
    if (cur) { workouts.push(cur); cur = null; }
  }

  function record(line) {
    const type = A(line, 'type');
    if (!type) return;
    records++;
    const sk = SUM_TYPES[type];
    if (sk) {
      const start = A(line, 'startDate');
      let v = parseFloat(A(line, 'value'));
      if (!start || !isFinite(v)) return;
      if (sk === 'di') v = distKm(v, A(line, 'unit'));
      else if (sk === 'ae') v = energyKcal(v, A(line, 'unit'));
      addSum(sums[sk], start.slice(0, 10), A(line, 'sourceName') || '?', v);
      return;
    }
    if (type === 'HKQuantityTypeIdentifierHeartRate') {
      const start = A(line, 'startDate');
      const v = parseFloat(A(line, 'value'));
      if (!start || !isFinite(v)) return;
      const day = start.slice(0, 10);
      const h = hr[day];
      if (!h) hr[day] = [v, 1, v, v];
      else { h[0] += v; h[1]++; if (v < h[2]) h[2] = v; if (v > h[3]) h[3] = v; }
      return;
    }
    const ak = AVG_TYPES[type];
    if (ak) {
      const start = A(line, 'startDate');
      const v = parseFloat(A(line, 'value'));
      if (!start || !isFinite(v)) return;
      const day = start.slice(0, 10);
      const a = avg[ak][day];
      if (!a) avg[ak][day] = [v, 1]; else { a[0] += v; a[1]++; }
      return;
    }
    const lk = LAST_TYPES[type];
    if (lk) {
      const start = A(line, 'startDate');
      let v = parseFloat(A(line, 'value'));
      if (!start || !isFinite(v)) return;
      if (lk === 'wt') v = massKg(v, A(line, 'unit'));
      const day = start.slice(0, 10);
      const t = start.slice(11, 19);
      const l = last[lk][day];
      if (!l || t >= l[0]) last[lk][day] = [t, v];
      return;
    }
    if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      const s = A(line, 'startDate'), e = A(line, 'endDate'), val = A(line, 'value');
      if (!s || !e || !val) return;
      const mins = (absMs(e) - absMs(s)) / 60000;
      if (!(mins > 0) || mins > 24 * 60) return;
      const ws = wall(s), we = wall(e);
      const night = isoDay(ws + 6 * 3600000);       // Schlaf ab 18 Uhr zählt zur nächsten Nacht
      const mid = Date.UTC(+night.slice(0, 4), +night.slice(5, 7) - 1, +night.slice(8, 10));
      const src = A(line, 'sourceName') || '?';
      const n = sleep[night] || (sleep[night] = {});
      const o = n[src] || (n[src] = { a: 0, d: 0, r: 0, c: 0, u: 0, w: 0, ib: 0, bt: null, wk: null });
      const st = ASLEEP[val];
      if (st) {
        o.a += mins; o[st] += mins;
        const bt = (ws - mid) / 60000, wk = (we - mid) / 60000;
        if (o.bt === null || bt < o.bt) o.bt = bt;
        if (o.wk === null || wk > o.wk) o.wk = wk;
      } else if (val === 'HKCategoryValueSleepAnalysisAwake') o.w += mins;
      else if (val === 'HKCategoryValueSleepAnalysisInBed') o.ib += mins;
      return;
    }
    if (type === 'HKCategoryTypeIdentifierMindfulSession') {
      const s = A(line, 'startDate'), e = A(line, 'endDate');
      if (!s || !e) return;
      const mins = (absMs(e) - absMs(s)) / 60000;
      if (mins > 0 && mins < 600) addSum(mindful, s.slice(0, 10), A(line, 'sourceName') || '?', mins);
    }
  }

  function workoutStart(line) {
    finishWorkout();
    const s = A(line, 'startDate');
    if (!s) return;
    const type = (A(line, 'workoutActivityType') || 'HKWorkoutActivityTypeOther').replace('HKWorkoutActivityType', '');
    let dur = parseFloat(A(line, 'duration'));
    const du = A(line, 'durationUnit');
    if (du === 's') dur /= 60; else if (du === 'hr' || du === 'h') dur *= 60;
    if (!isFinite(dur)) {
      const e = A(line, 'endDate');
      dur = e ? (absMs(e) - absMs(s)) / 60000 : 0;
    }
    cur = {
      t: type,
      d: s.slice(0, 10),
      h: +s.slice(11, 13) + (+s.slice(14, 16)) / 60,
      dur: Math.round(dur * 10) / 10,
      km: 0, kcal: 0, hr: 0,
    };
    const td = parseFloat(A(line, 'totalDistance'));
    if (td > 0) cur.km = distKm(td, A(line, 'totalDistanceUnit'));
    const te = parseFloat(A(line, 'totalEnergyBurned'));
    if (te > 0) cur.kcal = energyKcal(te, A(line, 'totalEnergyBurnedUnit'));
    if (line.trimEnd().endsWith('/>')) finishWorkout();
  }

  function workoutStat(line) {
    if (!cur) return;
    const type = A(line, 'type') || '';
    if (type === 'HKQuantityTypeIdentifierActiveEnergyBurned') {
      const v = parseFloat(A(line, 'sum'));
      if (v > 0 && !cur.kcal) cur.kcal = energyKcal(v, A(line, 'unit'));
    } else if (type === 'HKQuantityTypeIdentifierHeartRate') {
      const v = parseFloat(A(line, 'average'));
      if (v > 0) cur.hr = Math.round(v);
    } else if (type.indexOf('HKQuantityTypeIdentifierDistance') === 0) {
      const v = parseFloat(A(line, 'sum'));
      if (v > 0 && !cur.km) cur.km = distKm(v, A(line, 'unit'));
    }
  }

  function line(l) {
    const i = l.indexOf('<');
    if (i < 0) return;
    const c = l.charCodeAt(i + 1);
    if (c === 82 /* R */) { if (l.startsWith('<Record ', i)) record(l); return; }
    if (c === 87 /* W */) {
      if (l.startsWith('<WorkoutStatistics ', i)) workoutStat(l);
      else if (l.startsWith('<Workout ', i)) workoutStart(l);
      return;
    }
    if (c === 47 /* / */) { if (l.startsWith('</Workout>', i)) finishWorkout(); return; }
    if (c === 65 /* A */) {
      if (l.startsWith('<ActivitySummary ', i)) {
        const d = A(l, 'dateComponents');
        if (!d) return;
        const r = {
          m: +A(l, 'activeEnergyBurned') || 0, mg: +A(l, 'activeEnergyBurnedGoal') || 0,
          e: +A(l, 'appleExerciseTime') || 0, eg: +A(l, 'appleExerciseTimeGoal') || 0,
          s: +A(l, 'appleStandHours') || 0, sg: +A(l, 'appleStandHoursGoal') || 0,
        };
        if (A(l, 'activeEnergyBurnedUnit') === 'kJ') { r.m /= 4.184; r.mg /= 4.184; }
        if (r.mg > 0 || r.eg > 0) rings[d] = r;
      }
      return;
    }
    if (c === 77 /* M */ && l.startsWith('<Me ', i)) {
      me.birth = A(l, 'HKCharacteristicTypeIdentifierDateOfBirth') || '';
      me.sex = (A(l, 'HKCharacteristicTypeIdentifierBiologicalSex') || '').replace('HKBiologicalSex', '');
    }
  }

  function result() {
    finishWorkout();
    const days = {};
    const D = (k) => days[k] || (days[k] = {});
    const r1 = (v) => Math.round(v * 10) / 10;
    // Summen: pro Tag die Quelle mit dem größten Wert (iPhone + Watch nicht doppelt zählen)
    for (const [k, map] of Object.entries(sums)) {
      for (const [day, srcs] of Object.entries(map)) {
        const v = Math.max(...Object.values(srcs));
        if (v > 0) D(day)[k] = k === 'di' ? Math.round(v * 100) / 100 : Math.round(v);
      }
    }
    for (const [day, srcs] of Object.entries(mindful)) D(day).mi = Math.round(Math.max(...Object.values(srcs)));
    for (const [day, h] of Object.entries(hr)) {
      const o = D(day); o.hrA = Math.round(h[0] / h[1]); o.hrN = Math.round(h[2]); o.hrX = Math.round(h[3]);
    }
    for (const [k, map] of Object.entries(avg)) for (const [day, a] of Object.entries(map)) D(day)[k] = r1(a[0] / a[1]);
    for (const [k, map] of Object.entries(last)) for (const [day, l] of Object.entries(map)) D(day)[k] = r1(l[1]);
    for (const [night, srcs] of Object.entries(sleep)) {
      let best = null;
      for (const o of Object.values(srcs)) if (o.a > 0 && (!best || o.a > best.a)) best = o;
      if (!best) continue;
      if (best.a < 60) continue; // Nickerchen ignorieren
      D(night).sl = {
        a: Math.round(best.a), d: Math.round(best.d), r: Math.round(best.r), c: Math.round(best.c),
        w: Math.round(best.w), bt: Math.round(best.bt), wk: Math.round(best.wk),
      };
    }
    for (const w of workouts) {
      w.km = Math.round(w.km * 100) / 100;
      w.kcal = Math.round(w.kcal);
      w.h = Math.round(w.h * 100) / 100;
    }
    workouts.sort((a, b) => (a.d + a.h).localeCompare(b.d + b.h));
    return { version: 1, source: 'export', importedAt: new Date().toISOString(), me, days, rings, workouts, records };
  }

  return { line, result, count: () => records };
}

/* ── Stream lesen ─────────────────────────────────────────────────────────────── */

async function parseFile(file) {
  let stream, total, label;
  const lower = (file.name || '').toLowerCase();
  if (lower.endsWith('.xml')) {
    stream = file.stream();
    total = file.size;
  } else {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Dieser Browser kann ZIP-Dateien nicht entpacken. Bitte iOS 16.4 oder neuer verwenden – oder die ZIP in der Dateien-App entpacken und die export.xml wählen.');
    }
    const entry = await findZipEntry(file);
    const raw = file.slice(entry.dataStart, entry.dataStart + entry.comp).stream();
    total = entry.comp;
    if (entry.method === 0) stream = raw;
    else if (entry.method === 8) {
      stream = { raw, inflate: true };
    } else throw new Error('Unbekannte ZIP-Kompression (' + entry.method + ').');
  }

  // Fortschritt messen (an den gelesenen Rohbytes)
  let read = 0, lastPost = 0;
  const counter = new TransformStream({
    transform(chunk, ctl) {
      read += chunk.byteLength;
      const now = Date.now();
      if (now - lastPost > 250) {
        lastPost = now;
        self.postMessage({ type: 'progress', done: read, total, records: parser.count() });
      }
      ctl.enqueue(chunk);
    },
  });
  const parser = makeParser();
  let s;
  if (stream.inflate) s = stream.raw.pipeThrough(counter).pipeThrough(new DecompressionStream('deflate-raw'));
  else s = stream.pipeThrough(counter);

  const reader = s.getReader();
  const decoder = new TextDecoder('utf-8');
  let rest = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = rest + decoder.decode(value, { stream: true });
    let start = 0, nl;
    while ((nl = text.indexOf('\n', start)) >= 0) {
      parser.line(text.slice(start, nl));
      start = nl + 1;
    }
    rest = text.slice(start);
    if (rest.length > 4e6) { parser.line(rest); rest = ''; } // Notbremse bei fehlenden Zeilenumbrüchen
  }
  rest += decoder.decode();
  if (rest) parser.line(rest);
  self.postMessage({ type: 'progress', done: total, total, records: parser.count() });
  const res = parser.result();
  if (!Object.keys(res.days).length && !res.workouts.length) {
    throw new Error('In der Datei wurden keine Gesundheitsdaten gefunden.');
  }
  return res;
}
