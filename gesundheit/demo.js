/* Health-Rückblick – erfundene Beispieldaten (knapp sechs Jahre), damit man die App
 * ohne eigenen Export ausprobieren kann. Gleiches Format wie parser.js liefert. */
'use strict';

function makeDemoData() {
  let seed = 20260101;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / Math.sqrt(0.5); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const days = {}, rings = {}, workouts = [];
  const start = Date.UTC(2021, 0, 1);
  const today = new Date();
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - 86400000;
  const totalDays = Math.round((end - start) / 86400000);

  const planNew = [ // Wochentag (0=So) → mögliche Workouts (ab 2024: Laufen im Fokus)
    [['Hiking', 0.35], ['Cycling', 0.3]],
    [['TraditionalStrengthTraining', 0.55]],
    [['Running', 0.6]],
    [['Yoga', 0.4], ['Swimming', 0.15]],
    [['Running', 0.45], ['TraditionalStrengthTraining', 0.3]],
    [['HighIntensityIntervalTraining', 0.25]],
    [['Running', 0.55], ['Cycling', 0.25]],
  ];
  const planOld = [ // 2021–2023: mehr Radfahren, weniger Training insgesamt
    [['Cycling', 0.45], ['Hiking', 0.2]],
    [],
    [['Cycling', 0.3]],
    [['TraditionalStrengthTraining', 0.3]],
    [['Walking', 0.35]],
    [],
    [['Cycling', 0.5]],
  ];

  for (let i = 0; i <= totalDays; i++) {
    const ms = start + i * 86400000;
    const dt = new Date(ms);
    const key = dt.toISOString().slice(0, 10);
    const wd = dt.getUTCDay();
    const doy = (ms - Date.UTC(dt.getUTCFullYear(), 0, 1)) / 86400000;
    const season = Math.sin((doy - 100) / 365 * 2 * Math.PI); // Sommer +1, Winter −1
    const progress = i / totalDays; // langsamer Fitness-Fortschritt
    const vacation = key.slice(5) >= '08-03' && key.slice(5) <= '08-17';
    const sick = key >= '2026-02-09' && key <= '2026-02-14';

    let steps = 6900 + 1700 * season + 2200 * progress + gauss() * 2600;
    if (wd === 6) steps += 2600; if (wd === 0) steps += 1200;
    if (vacation) steps += 4200;
    if (sick) steps = 1500 + rnd() * 1500;
    if (rnd() < 0.015) steps += 9000; // Ausreißer: Wandertag
    steps = Math.round(clamp(steps, 900, 32000));

    const d = days[key] = {
      st: steps,
      di: Math.round(steps * 0.00074 * 100) / 100,
      fl: Math.round(clamp(8 + gauss() * 4 + (vacation ? 10 : 0), 0, 80)),
    };
    const todays = [];
    const plan = key < '2024-01-01' ? planOld : planNew;
    if (!sick) for (const [t, p] of plan[wd]) if (rnd() < p * (vacation ? 0.7 : 1)) { todays.push(t); break; }

    let exMin = clamp(12 + gauss() * 8, 0, 60);
    let actKcal = 280 + steps * 0.022 + gauss() * 60;
    for (const t of todays) {
      const spec = {
        Running: [32 + rnd() * 25, 10.8, 152], Cycling: [55 + rnd() * 60, 7.5, 134],
        Hiking: [120 + rnd() * 140, 6.2, 118], TraditionalStrengthTraining: [45 + rnd() * 20, 5.5, 112],
        Yoga: [35 + rnd() * 25, 3.3, 94], Swimming: [40 + rnd() * 20, 8.5, 128],
        HighIntensityIntervalTraining: [24 + rnd() * 12, 11.5, 158], Walking: [40 + rnd() * 30, 4.2, 104],
      }[t];
      const dur = Math.round(spec[0]);
      const kcal = Math.round(dur * spec[1] * (0.9 + rnd() * 0.2));
      let km = 0;
      if (t === 'Running') km = dur / (6.1 - progress * 0.5 + gauss() * 0.25);
      if (t === 'Cycling') km = dur / 60 * (22 + gauss() * 3);
      if (t === 'Hiking') km = dur / 60 * (4.1 + gauss() * 0.4);
      if (t === 'Walking') km = dur / 60 * (5.2 + gauss() * 0.3);
      if (t === 'Swimming') km = dur / 60 * 2.1;
      const hour = wd === 0 || wd === 6 ? 9.5 + rnd() * 3 : (rnd() < 0.4 ? 6.4 + rnd() : 17.5 + rnd() * 2);
      workouts.push({ t, d: key, h: Math.round(hour * 100) / 100, dur, km: Math.round(km * 100) / 100, kcal, hr: Math.round(spec[2] + gauss() * 5 - progress * 4) });
      exMin += dur * 0.85; actKcal += kcal;
      if (t === 'Running' || t === 'Hiking' || t === 'Walking') { d.st += Math.round(km * 1350); d.di = Math.round((d.di + km) * 100) / 100; }
    }
    d.ex = Math.round(exMin);
    d.ae = Math.round(clamp(actKcal, 80, 2500));

    // Herz
    d.rhr = Math.round((64 - progress * 8 + gauss() * 1.6 + (sick ? 6 : 0) + (vacation ? -1.5 : 0)) * 10) / 10;
    d.hrv = Math.round(clamp(34 + progress * 14 + gauss() * 7 - (sick ? 12 : 0), 12, 110) * 10) / 10;
    d.hrA = Math.round(d.rhr + 14 + steps / 2000 + gauss() * 2);
    d.hrN = Math.round(d.rhr - 4 - rnd() * 3);
    d.hrX = Math.round(todays.length ? 165 + rnd() * 18 : 115 + rnd() * 25);
    if (key >= '2022-03-01' && (wd === 3 || rnd() < 0.08)) d.vo2 = Math.round((38.5 + progress * 6 + gauss() * 0.5) * 10) / 10;
    if (wd === 1 && rnd() < 0.8) d.wt = Math.round((86.2 - progress * 6.4 + Math.sin(i / 21) * 0.4 + gauss() * 0.35) * 10) / 10;
    if (key >= '2023-01-01' && rnd() < 0.1 + progress * 0.3) d.mi = Math.round(5 + rnd() * 10);

    // Schlaf (Nacht, die an diesem Morgen endet)
    const weekend = wd === 0 || wd === 6;
    const bt = Math.round((weekend ? 0 : -45) + 25 - progress * 30 + gauss() * 28 + (vacation ? 20 : 0)); // Minuten relativ zu 0:00
    const asleep = clamp((weekend ? 480 : 418) - 22 + progress * 30 + gauss() * 38 + (sick ? 50 : 0), 260, 620);
    const awake = Math.round(14 + rnd() * 22);
    const deep = Math.round(asleep * (0.13 + rnd() * 0.05));
    const rem = Math.round(asleep * (0.21 + rnd() * 0.05));
    const stages = key >= '2022-10-01'; // Schlafphasen gibt es erst seit watchOS 9
    d.sl = {
      a: Math.round(asleep), d: stages ? deep : 0, r: stages ? rem : 0, c: stages ? Math.round(asleep) - deep - rem : 0, w: stages ? awake : 0,
      bt, wk: Math.round(bt + asleep + awake),
    };

    // Ringe
    const mg = key < '2024-01-01' ? 450 : key < '2026-01-01' ? 550 : 600;
    if (key >= '2021-04-01') rings[key] = { m: d.ae, mg, e: d.ex, eg: 30, s: Math.round(clamp(9 + gauss() * 2 + (todays.length ? 1 : 0), 3, 16)), sg: 12 };
  }

  return {
    version: 1, source: 'demo', importedAt: new Date().toISOString(),
    me: { birth: '1987-06-12', sex: '' }, days, rings, workouts, records: 0,
  };
}
