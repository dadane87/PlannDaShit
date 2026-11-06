/* Health-Rückblick – die Highlight-Story (Folien wie bei Instagram/Jahresrückblicken).
 * Rechts tippen = weiter, links = zurück, gedrückt halten = Pause, nach unten wischen = schließen. */
'use strict';

const STORY_MS = 7000;

function storySlides(data, p) {
  const st = compute(data, p.from, p.to);
  const pv = compute(data, p.prev[0], p.prev[1]);
  const Y = p.year ? String(p.year) : 'Deine letzten 12 Monate';
  const yearWord = p.year ? (p.to < `${p.year}-12-31` && p.year === new Date().getFullYear() ? 'dieses Jahr' : `${p.year}`) : 'in den letzten 12 Monaten';
  const slides = [];
  const num = (v, dec = 0) => `<span class="cnt" data-to="${v}" data-dec="${dec}">${dec ? fmt1(0) : 0}</span>`;
  const per = persona(st);

  // 1 · Intro
  slides.push({
    bg: 'linear-gradient(160deg,#ff0080 0%,#7928ca 55%,#2b1055 100%)', deco: 'rings',
    html: `<div class="s-top a1">Health-Rückblick</div>
      <div class="s-mega a2">${esc(p.year ? String(p.year) : '12 Monate')}</div>
      <div class="s-h a3">${p.year ? 'Dein Jahr' : 'Deine letzten 12 Monate'} in Schritten, Herzschlägen und Träumen.</div>
      <div class="s-small a4">Bereit? Tippe rechts zum Weitergehen.</div>`,
  });

  // 2 · Schritte gesamt
  if (st.steps.total) {
    const km = st.km || st.steps.total * 0.00075;
    const cmp = distanceCompare(km);
    const marathons = km / 42.195;
    slides.push({
      bg: 'linear-gradient(160deg,#f7971e 0%,#ff3d5a 100%)', deco: 'steps',
      html: `<div class="s-top a1">${esc(yearWord[0].toUpperCase() + yearWord.slice(1))} bist du</div>
        <div class="s-big a2">${num(st.steps.total)}</div>
        <div class="s-h a3">Schritte gegangen.</div>
        <div class="s-card a4">Das sind <b>${fmt(km)} km</b>${cmp && cmp[0] > 50 ? ` – weiter als ${esc(cmp[1])}` : ''}. Oder <b>${fmt1(marathons)} Marathons</b>.</div>`,
    });
  }

  // 3 · Bester Tag + Durchschnitt
  if (st.steps.best) {
    const b = st.steps.best;
    slides.push({
      bg: 'linear-gradient(160deg,#00c9a7 0%,#0081cf 100%)', deco: 'burst',
      html: `<div class="s-top a1">Dein stärkster Tag</div>
        <div class="s-h a2">${WDL[wdOf(b[0])]}, ${fmtDate(b[0], false)}</div>
        <div class="s-big a3">${num(b[1])}</div>
        <div class="s-h a3">Schritte an einem einzigen Tag.</div>
        <div class="s-card a4">Im Schnitt waren es <b>${fmt(st.steps.avg)}</b> pro Tag${pv.steps.avg && pv.nDays > 30 ? ` – ${st.steps.avg >= pv.steps.avg ? '<b>' + fmt((st.steps.avg / pv.steps.avg - 1) * 100) + ' % mehr</b>' : fmt((1 - st.steps.avg / pv.steps.avg) * 100) + ' % weniger'} als ${p.year ? p.year - 1 : 'im Jahr davor'}` : ''}.
        An <b>${fmt(st.steps.over10k)} Tagen</b> hast du die 10.000 geknackt.</div>`,
    });
  }

  // 4 · Serie
  if (st.steps.streak >= 3) {
    slides.push({
      bg: 'linear-gradient(160deg,#ff512f 0%,#dd2476 100%)', deco: 'flame',
      html: `<div class="s-top a1">Nicht zu stoppen</div>
        <div class="s-mega a2">${num(st.steps.streak)}</div>
        <div class="s-h a3">Tage am Stück über 10.000 Schritte.</div>
        <div class="s-card a4">Deine längste Serie: vom <b>${fmtDate(st.steps.streakStart, false)}</b> bis zum <b>${fmtDate(st.steps.streakEnd, false)}</b>. 🔥</div>`,
    });
  }

  // 5 · Top-Monat
  if (st.topMonth && st.months.length >= 3) {
    const max = Math.max(...st.months.map((m) => m.steps || 0));
    const bars = st.months.map((m) => `<div class="mb${m === st.topMonth ? ' top' : ''}" style="--d:${(st.months.indexOf(m) * 0.05).toFixed(2)}s"><i style="--h:${((m.steps || 0) / max * 100).toFixed(1)}%"></i><span>${m.label[0]}</span></div>`).join('');
    slides.push({
      bg: 'linear-gradient(160deg,#4776e6 0%,#8e54e9 100%)', deco: 'none',
      html: `<div class="s-top a1">Dein Monat</div>
        <div class="s-big a2">${MONTH[st.topMonth.m - 1]}</div>
        <div class="s-h a3">Mit Ø <b>${fmt(st.topMonth.steps)}</b> Schritten am Tag warst du nie aktiver.</div>
        <div class="s-bars a4">${bars}</div>`,
    });
  }

  // 6 · Wochentag
  if (st.steps.n >= 28) {
    const wdv = ORDER.map((w) => st.weekday[w] || 0);
    const top = ORDER[wdv.indexOf(Math.max(...wdv))];
    const low = ORDER[wdv.indexOf(Math.min(...wdv.filter((v) => v > 0)))];
    const max = Math.max(...wdv);
    slides.push({
      bg: 'linear-gradient(160deg,#fceabb 0%,#f8b500 100%)', dark: true, deco: 'dots',
      html: `<div class="s-top a1">Wochen-Rhythmus</div>
        <div class="s-h a2">Du bist ein</div>
        <div class="s-big a2">${WDL[top]}s-Mensch.</div>
        <div class="s-bars wd a3">${ORDER.map((w, i) => `<div class="mb${w === top ? ' top' : ''}"><i style="--h:${(wdv[i] / max * 100).toFixed(1)}%"></i><span>${WD[w]}</span></div>`).join('')}</div>
        <div class="s-card a4">${WDL[top]}s läufst du Ø <b>${fmt(st.weekday[top])}</b> Schritte, ${WDL[low]}s nur <b>${fmt(st.weekday[low])}</b>.</div>`,
    });
  }

  // 7 · Workouts: Top-Liste
  const w = st.workouts;
  if (w.n) {
    const list = w.types.slice(0, 5).map((t, i) => `<li class="a${Math.min(5, i + 3)}"><b>${i + 1}</b><span class="em">${sportIcon(t.t)}</span><span class="nm">${esc(sportName(t.t))}<small>${t.n}× · ${fmt(t.min / 60)} h${t.km ? ' · ' + fmt(t.km) + ' km' : ''}</small></span></li>`).join('');
    slides.push({
      bg: 'linear-gradient(160deg,#11998e 0%,#38ef7d 100%)', deco: 'none',
      html: `<div class="s-top a1">Deine Top-Sportarten</div>
        <div class="s-h a2"><b>${num(w.n)}</b> Workouts, <b>${num(Math.round(w.min / 60))}</b> Stunden</div>
        <ol class="s-rank">${list}</ol>`,
    });
    const top = w.types[0];
    slides.push({
      bg: 'linear-gradient(160deg,#fc466b 0%,#3f5efb 100%)', deco: 'burst',
      html: `<div class="s-top a1">Deine Nummer 1</div>
        <div class="s-emoji a2">${sportIcon(top.t)}</div>
        <div class="s-big a3">${esc(sportName(top.t))}</div>
        <div class="s-card a4"><b>${top.n}-mal</b> und insgesamt <b>${hm(top.min)}</b>.${top.km ? ` Dabei kamen <b>${fmt1(top.km)} km</b> zusammen.` : ''}
        ${w.peakHour != null ? `<br>Am liebsten startest du gegen <b>${w.peakHour} Uhr</b>${w.peakHour < 9 ? ' – Respekt! 🌅' : w.peakHour >= 19 ? ' – Feierabend-Power! 🌙' : '.'}` : ''}</div>`,
    });
  }

  // 8 · Laufen
  if (w.run && w.run.n >= 5) {
    slides.push({
      bg: 'linear-gradient(160deg,#f12711 0%,#f5af19 100%)', deco: 'steps',
      html: `<div class="s-top a1">Laufen</div>
        <div class="s-big a2">${num(Math.round(w.run.km))} km</div>
        <div class="s-h a3">in ${w.run.n} Läufen.</div>
        <div class="s-card a4">Ø Tempo <b>${paceStr(w.run.pace)} min/km</b>. Dein längster Lauf: <b>${fmt1(w.run.longest.km)} km</b> am ${fmtDate(w.run.longest.d, false)}.</div>`,
    });
  }

  // 9 · Herz
  if (st.heart.rhr) {
    const e = st.heart.rhrEnds;
    const better = e && e[1] < e[0] - 0.9;
    slides.push({
      bg: 'linear-gradient(160deg,#e94057 0%,#8a2387 100%)', deco: 'pulse',
      html: `<div class="s-top a1">Dein Herz</div>
        ${st.heart.beats ? `<div class="s-h a2">hat ungefähr</div><div class="s-big a2">${num(Math.round(st.heart.beats / 1e6))} Mio.</div><div class="s-h a3">Mal geschlagen.</div>` : ''}
        <div class="s-card a4">Ruhepuls im Schnitt: <b>${fmt(st.heart.rhr)} bpm</b>.
        ${better ? `Er ist von ${fmt(e[0])} auf <b>${fmt(e[1])} bpm</b> gesunken – dein Herz arbeitet effizienter. 💪` : e ? `Er lag am Anfang bei ${fmt(e[0])} und zuletzt bei ${fmt(e[1])} bpm.` : ''}
        ${st.heart.hrv ? `<br>HRV im Schnitt: <b>${fmt(st.heart.hrv)} ms</b>.` : ''}</div>`,
    });
  }

  // 10 · VO2max
  if (st.vo2 && st.vo2.series.length >= 4 && st.vo2.last[1] - st.vo2.first[1] >= 0.5) {
    slides.push({
      bg: 'linear-gradient(160deg,#ee0979 0%,#ff6a00 100%)', deco: 'rings',
      html: `<div class="s-top a1">Cardiofitness</div>
        <div class="s-h a2">Deine VO₂max stieg um</div>
        <div class="s-mega a3">+${num(st.vo2.last[1] - st.vo2.first[1], 1)}</div>
        <div class="s-card a4">von ${fmt1(st.vo2.first[1])} auf <b>${fmt1(st.vo2.last[1])} ml/kg·min</b>. Ausdauer zahlt sich aus.</div>`,
    });
  }

  // 11 · Schlaf
  if (st.sleep.n >= 14) {
    const ch = per.chrono;
    const totalH = st.sleep.avg * st.sleep.n / 60;
    slides.push({
      bg: 'linear-gradient(160deg,#141e30 0%,#243b55 60%,#5b4b9a 100%)', deco: 'stars',
      html: `<div class="s-top a1">Schlaf</div>
        <div class="s-h a2">Pro Nacht im Schnitt</div>
        <div class="s-big a2">${hm(st.sleep.avg).replace(' min', '')}</div>
        <div class="s-h a3">Zusammen <b>${fmt(totalH)} Stunden</b> – das sind <b>${fmt(totalH / 24)} Tage</b> durchgeschlafen.</div>
        <div class="s-card a4">Ins Bett gehst du um <b>${clock(st.sleep.bed)}</b>, wach wirst du um <b>${clock(st.sleep.wake)}</b>.
        ${ch ? `<br>Damit bist du: <b>${ch[1]} ${esc(ch[0])}</b>.` : ''}
        ${st.sleep.longest ? `<br>Längste Nacht: <b>${hm(st.sleep.longest[1].a)}</b> (${fmtDate(st.sleep.longest[0], false)}).` : ''}</div>`,
    });
  }

  // 12 · Stockwerke
  if (st.flights >= 100) {
    const m = st.flights * 3;
    const c = heightCompare(m);
    slides.push({
      bg: 'linear-gradient(160deg,#56ab2f 0%,#a8e063 100%)', dark: true, deco: 'mountain',
      html: `<div class="s-top a1">Hoch hinaus</div>
        <div class="s-big a2">${num(st.flights)}</div>
        <div class="s-h a3">Stockwerke hochgestiegen.</div>
        <div class="s-card a4">Das sind etwa <b>${fmt(m)} Höhenmeter</b> – du hättest <b>${m / c[0] < 1.15 ? 'einmal' : fmt1(m / c[0]) + '-mal'} ${esc(c[1])}</b> besteigen können. 🏔️</div>`,
    });
  }

  // 13 · Ringe
  if (st.rings && st.rings.move) {
    slides.push({
      bg: 'linear-gradient(160deg,#000000 0%,#2c2c2e 100%)', deco: 'activity',
      html: `<div class="s-top a1">Ringe</div>
        <div class="s-big a2">${num(st.rings.move)}</div>
        <div class="s-h a3">Tage mit geschlossenem Bewegungsring.</div>
        <div class="s-card a4">An <b>${fmt(st.rings.all)} Tagen</b> waren sogar alle drei Ringe zu.
        ${st.rings.moveStreak >= 3 ? `<br>Längste Serie: <b>${st.rings.moveStreak} Tage</b> in Folge.` : ''}</div>`,
    });
  }

  // 14 · Achtsamkeit
  if (st.mindful.total >= 30) {
    slides.push({
      bg: 'linear-gradient(160deg,#a1c4fd 0%,#c2e9fb 100%)', dark: true, deco: 'rings',
      html: `<div class="s-top a1">Achtsamkeit</div>
        <div class="s-big a2">${num(st.mindful.total)} min</div>
        <div class="s-h a3">bewusst durchgeatmet, an ${st.mindful.days} Tagen.</div>
        <div class="s-card a4">Kleine Pausen, große Wirkung. 🫶</div>`,
    });
  }

  // 15 · Persona
  slides.push({
    bg: 'linear-gradient(160deg,#8e2de2 0%,#4a00e0 100%)', deco: 'burst',
    html: `<div class="s-top a1">Dein Health-Typ ${p.year ? p.year : ''}</div>
      <div class="s-emoji xl a2">${per.animal[1]}</div>
      <div class="s-big a3">${esc(per.animal[0])}</div>
      <div class="s-h a4">${esc(per.animal[2])}</div>`,
  });

  // 16 · Zusammenfassung (teilbar)
  const items = summaryItems(st, per);
  slides.push({
    bg: 'linear-gradient(160deg,#ff0080 0%,#7928ca 55%,#2b1055 100%)', deco: 'none', summary: true,
    html: `<div class="s-top a1">${esc(Y)} in Zahlen</div>
      <div class="s-sum a2">${items.map((i) => `<div><span>${esc(i[0])}</span><b>${esc(i[1])}</b></div>`).join('')}</div>
      <div class="s-actions a3"><button class="s-share">Als Bild teilen</button><button class="s-again">Nochmal ansehen</button></div>`,
    share: () => shareImage(Y, items, per),
  });
  return slides;
}

/* ── Story über alle Jahre ──────────────────────────────────────────────────── */
function storySlidesAll(data) {
  const years = yearList(data);
  const P = allPeriod(data), all = compute(data, P.from, P.to);
  const slides = [];
  const num = (v, dec = 0) => `<span class="cnt" data-to="${v}" data-dec="${dec}">${dec ? fmt1(0) : 0}</span>`;
  const yb = (list, f, top, fmtv) => {
    const max = Math.max(...list.map((Y) => f(Y) || 0)) || 1;
    return `<div class="s-bars years">${list.map((Y, i) => `<div class="mb${Y === top ? ' top' : ''}" style="--d:${(i * 0.08).toFixed(2)}s"><em>${fmtv ? fmtv(f(Y)) : ''}</em><i style="--h:${((f(Y) || 0) / max * 100).toFixed(1)}%"></i><span>’${String(Y.y).slice(2)}${Y.partial ? '*' : ''}</span></div>`).join('')}</div>`;
  };
  const full = years.filter((Y) => !Y.partial);
  const firstY = years[0], lastY = years[years.length - 1];

  // 1 · Intro
  slides.push({
    bg: 'linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#ff0080 130%)', deco: 'stars',
    html: `<div class="s-top a1">Deine Health-Geschichte</div>
      <div class="s-big a2">${firstY.y} –<br>${lastY.y}</div>
      <div class="s-h a3">${years.length} Jahre. ${fmt(all.nDays)} Tage. Ein Körper, der dich überall hingetragen hat.</div>
      <div class="s-small a4">Tippe rechts, um durch deine Jahre zu reisen.</div>`,
  });

  // 2 · Lebenszeit-Schritte
  if (all.steps.total) {
    const km = all.km || all.steps.total * 0.00075;
    const cmp = distanceCompare(km);
    const earth = km / 40075;
    slides.push({
      bg: 'linear-gradient(160deg,#f7971e 0%,#ff3d5a 100%)', deco: 'steps',
      html: `<div class="s-top a1">Seit ${fmtDate(all.keys[0], true)}</div>
        <div class="s-big a2">${num(Math.round(all.steps.total))}</div>
        <div class="s-h a3">Schritte. Insgesamt.</div>
        <div class="s-card a4">Das sind <b>${fmt(km)} km</b>${cmp ? ` – weiter als ${esc(cmp[1])}` : ''}.
        ${earth >= 0.05 ? `<br>Damit hast du <b>${fmt(earth * 100)} %</b> des Weges um die Erde geschafft. 🌍` : ''}</div>`,
    });
  }

  // 3 · Jahr für Jahr
  const sy = years.filter((Y) => Y.st.steps.n >= 30);
  if (sy.length >= 2) {
    const best = sy.reduce((b, Y) => (!b || Y.st.steps.avg > b.st.steps.avg ? Y : b), null);
    const a = sy[0], b = sy[sy.length - 1];
    const ch = (b.st.steps.avg / a.st.steps.avg - 1) * 100;
    slides.push({
      bg: 'linear-gradient(160deg,#4776e6 0%,#8e54e9 100%)', deco: 'none',
      html: `<div class="s-top a1">Jahr für Jahr</div>
        <div class="s-h a2"><b>${best.y}</b> war dein aktivstes Jahr.</div>
        ${yb(sy, (Y) => Y.st.steps.avg, best, (v) => compact(v))}
        <div class="s-card a4">Ø <b>${fmt(best.st.steps.avg)}</b> Schritte pro Tag ${best.y === b.y ? '– und das ist das aktuelle Jahr. Stark! 🚀' : 'in ' + best.y + '.'}
        <br>${Math.abs(ch) < 3 ? `Seit ${a.y} bist du erstaunlich konstant geblieben.` : ch > 0 ? `Heute gehst du <b>${fmt(ch)} % mehr</b> als ${a.y}.` : `Heute sind es ${fmt(-ch)} % weniger als ${a.y}.`}</div>`,
    });
  }

  // 4 · Rekorde aller Zeiten
  if (all.steps.best) {
    slides.push({
      bg: 'linear-gradient(160deg,#00c9a7 0%,#0081cf 100%)', deco: 'burst',
      html: `<div class="s-top a1">Rekord aller Zeiten</div>
        <div class="s-big a2">${num(all.steps.best[1])}</div>
        <div class="s-h a3">Schritte am ${WDL[wdOf(all.steps.best[0])]}, ${fmtDate(all.steps.best[0])}.</div>
        ${all.steps.streak >= 3 ? `<div class="s-card a4">Und deine längste Serie über 10.000 Schritte: <b>${all.steps.streak} Tage</b> am Stück (${fmtDate(all.steps.streakStart)} – ${fmtDate(all.steps.streakEnd)}). 🔥</div>` : ''}`,
    });
  }

  // 5 · Workouts über die Jahre
  const wy = years.filter((Y) => Y.st.nDays >= 30);
  if (all.workouts.n >= 5 && wy.length >= 2) {
    const best = wy.reduce((b, Y) => (!b || Y.st.workouts.perWeek > b.st.workouts.perWeek ? Y : b), null);
    const a = wy[0], b = wy[wy.length - 1];
    const ratio = a.st.workouts.perWeek > 0 ? b.st.workouts.perWeek / a.st.workouts.perWeek : null;
    slides.push({
      bg: 'linear-gradient(160deg,#11998e 0%,#38ef7d 100%)', deco: 'none',
      html: `<div class="s-top a1">Training</div>
        <div class="s-h a2"><b>${num(all.workouts.n)}</b> Workouts, <b>${num(Math.round(all.workouts.min / 60))}</b> Stunden</div>
        ${yb(wy, (Y) => Y.st.workouts.n, best, (v) => fmt(v))}
        <div class="s-card a4">${ratio && ratio >= 1.25 ? `Heute trainierst du <b>${fmt1(ratio)}-mal so oft</b> wie ${a.y}: ${fmt1(b.st.workouts.perWeek)} statt ${fmt1(a.st.workouts.perWeek)} Einheiten pro Woche. 💪`
          : `Im besten Jahr (${best.y}) waren es <b>${fmt1(best.st.workouts.perWeek)}</b> Workouts pro Woche.`}</div>`,
    });
  }

  // 6 · Top-Sportarten aller Zeiten
  if (all.workouts.types.length) {
    const list = all.workouts.types.slice(0, 5).map((t, i) => `<li class="a${Math.min(5, i + 3)}"><b>${i + 1}</b><span class="em">${sportIcon(t.t)}</span><span class="nm">${esc(sportName(t.t))}<small>${fmt(t.n)}× · ${fmt(t.min / 60)} h${t.km ? ' · ' + fmt(t.km) + ' km' : ''}</small></span></li>`).join('');
    slides.push({
      bg: 'linear-gradient(160deg,#fc466b 0%,#3f5efb 100%)', deco: 'burst',
      html: `<div class="s-top a1">Deine Top-Sportarten</div><div class="s-h a2">aller Zeiten</div><ol class="s-rank">${list}</ol>`,
    });
  }

  // 7 · Wandel der Lieblingssportart
  const tops = years.filter((Y) => Y.st.workouts.types[0]).map((Y) => ({ Y, t: Y.st.workouts.types[0].t }));
  if (tops.length >= 2) {
    const changed = tops[0].t !== tops[tops.length - 1].t;
    slides.push({
      bg: 'linear-gradient(160deg,#f12711 0%,#f5af19 100%)', deco: 'steps',
      html: `<div class="s-top a1">So hat sich dein Sport verändert</div>
        <div class="s-evo a2${tops.length === 4 || tops.length > 6 ? ' n4' : ''}">${tops.map((x) => `<div><span class="e">${sportIcon(x.t)}</span><span class="y">${x.Y.y}</span><span class="n">${esc(sportName(x.t))}</span></div>`).join('')}</div>
        <div class="s-h a3">${changed ? `Vom ${esc(sportName(tops[0].t))} zum ${esc(sportName(tops[tops.length - 1].t))}.` : `${esc(sportName(tops[0].t))} – Jahr für Jahr deine Nummer 1.`}</div>
        <div class="s-card a4">${changed ? 'Neue Leidenschaft gefunden? Sieht ganz so aus. ✨' : 'Treue zahlt sich aus: Du bist dir die ganze Zeit treu geblieben. 🫶'}</div>`,
    });
  }

  // 8 · Herz über die Jahre
  const hy = years.filter((Y) => Y.st.heart.rhrSeries.length >= 30);
  if (hy.length >= 2) {
    const a = hy[0], b = hy[hy.length - 1];
    const d = b.st.heart.rhr - a.st.heart.rhr;
    const low = hy.reduce((m, Y) => (!m || Y.st.heart.rhr < m.st.heart.rhr ? Y : m), null);
    const hv = years.filter((Y) => Y.st.heart.hrvSeries.length >= 30);
    const hd = hv.length >= 2 ? hv[hv.length - 1].st.heart.hrv - hv[0].st.heart.hrv : null;
    slides.push({
      bg: 'linear-gradient(160deg,#e94057 0%,#8a2387 100%)', deco: 'pulse',
      html: `<div class="s-top a1">Dein Herz über die Jahre</div>
        ${all.heart.beats ? `<div class="s-h a2">Es hat seit ${firstY.y} rund</div><div class="s-big a2">${num(Math.round(all.heart.beats / 1e6))} Mio.</div><div class="s-h a3">Mal geschlagen.</div>` : ''}
        ${yb(hy, (Y) => Y.st.heart.rhr, low, (v) => fmt(v))}
        <div class="s-card a4">Ruhepuls ${a.y}: ${fmt(a.st.heart.rhr)} bpm → ${b.y}: <b>${fmt(b.st.heart.rhr)} bpm</b>.
        ${d <= -1 ? ` Das sind <b>${fmt(-d)} Schläge pro Minute weniger</b> – dein Herz arbeitet effizienter. 💪` : d >= 1 ? ' Etwas höher als früher – Erholung lohnt sich.' : ' Bemerkenswert stabil.'}
        ${hd != null && Math.abs(hd) >= 2 ? `<br>HRV: <b>${hd > 0 ? '+' : '−'}${fmt(Math.abs(hd))} ms</b> seit ${hv[0].y}.` : ''}</div>`,
    });
  }

  // 9 · Cardiofitness
  const vy = years.filter((Y) => Y.st.vo2 && Y.st.vo2.series.length >= 3);
  if (vy.length >= 2) {
    const v = (Y) => mean(Y.st.vo2.series.slice(-5).map((x) => x[1]));
    const a = vy[0], b = vy[vy.length - 1], d = v(b) - v(a);
    if (Math.abs(d) >= 0.5) slides.push({
      bg: 'linear-gradient(160deg,#ee0979 0%,#ff6a00 100%)', deco: 'rings',
      html: `<div class="s-top a1">Cardiofitness</div>
        <div class="s-h a2">Deine VO₂max seit ${a.y}</div>
        <div class="s-mega a3">${d > 0 ? '+' : '−'}${num(Math.abs(d), 1)}</div>
        <div class="s-card a4">von ${fmt1(v(a))} auf <b>${fmt1(v(b))} ml/kg·min</b>. ${d > 0 ? 'Fitter als je zuvor? Deine Daten sagen ja. 🫁' : 'Da geht wieder mehr – du weißt ja, wie es geht.'}</div>`,
    });
  }

  // 10 · Schlaf über die Jahre
  const ny = years.filter((Y) => Y.st.sleep.n >= 30);
  if (ny.length >= 2) {
    const a = ny[0], b = ny[ny.length - 1];
    const d = b.st.sleep.avg - a.st.sleep.avg, bd = b.st.sleep.bed - a.st.sleep.bed;
    const best = ny.reduce((m, Y) => (!m || Y.st.sleep.avg > m.st.sleep.avg ? Y : m), null);
    const nightsH = all.sleep.avg * all.sleep.n / 60;
    slides.push({
      bg: 'linear-gradient(160deg,#141e30 0%,#243b55 60%,#5b4b9a 100%)', deco: 'stars',
      html: `<div class="s-top a1">Schlaf über die Jahre</div>
        <div class="s-h a2"><b>${fmt(all.sleep.n)}</b> Nächte, zusammen <b>${fmt(nightsH / 24)} Tage</b> Schlaf.</div>
        ${yb(ny, (Y) => Y.st.sleep.avg, best, (v) => hm(v).replace(' h ', ':').replace(' min', ''))}
        <div class="s-card a4">${Math.abs(d) < 5 ? `Deine Schlafdauer ist seit ${a.y} stabil bei rund <b>${hm(b.st.sleep.avg)}</b>.` : `Du schläfst heute <b>${fmt(Math.abs(d))} min ${d > 0 ? 'länger' : 'kürzer'}</b> als ${a.y}.`}
        ${Math.abs(bd) >= 10 ? `<br>Und du gehst <b>${fmt(Math.abs(bd))} min ${bd < 0 ? 'früher' : 'später'}</b> ins Bett (Ø ${clock(b.st.sleep.bed)} Uhr). ${bd < 0 ? '🌙' : '🦉'}` : ''}</div>`,
    });
  }

  // 11 · Höhenmeter
  if (all.flights >= 300) {
    const m = all.flights * 3, c = heightCompare(m);
    slides.push({
      bg: 'linear-gradient(160deg,#56ab2f 0%,#a8e063 100%)', dark: true, deco: 'mountain',
      html: `<div class="s-top a1">Hoch hinaus</div>
        <div class="s-big a2">${num(m)} m</div>
        <div class="s-h a3">Höhenmeter über Treppen, seit ${firstY.y}.</div>
        <div class="s-card a4">Das reicht für <b>${m / c[0] < 1.15 ? 'einmal' : fmt1(m / c[0]) + '-mal'} ${esc(c[1])}</b>. 🏔️</div>`,
    });
  }

  // 12 · Health-Typ im Wandel
  const pers = years.filter((Y) => Y.st.nDays >= 30).map((Y) => ({ Y, per: persona(Y.st) }));
  if (pers.length >= 2) {
    const now = pers[pers.length - 1].per;
    slides.push({
      bg: 'linear-gradient(160deg,#8e2de2 0%,#4a00e0 100%)', deco: 'burst',
      html: `<div class="s-top a1">Dein Health-Typ im Wandel</div>
        <div class="s-evo a2${pers.length === 4 || pers.length > 6 ? ' n4' : ''}">${pers.map((x) => `<div><span class="e">${x.per.animal[1]}</span><span class="y">${x.Y.y}</span><span class="n">${esc(x.per.animal[0])}</span></div>`).join('')}</div>
        <div class="s-h a3">Heute bist du: ${now.animal[1]} <b>${esc(now.animal[0])}</b></div>
        <div class="s-card a4">${esc(now.animal[2])}</div>`,
    });
  }

  // 13 · Zusammenfassung
  const per = pers.length ? pers[pers.length - 1].per : persona(all);
  const items = [];
  if (all.steps.total) items.push(['Schritte', all.steps.total >= 1e6 ? fmt1(all.steps.total / 1e6) + ' Mio.' : fmt(all.steps.total)]);
  if (all.km) items.push(['Kilometer', fmt(all.km)]);
  if (all.workouts.n) items.push(['Workouts', fmt(all.workouts.n)]);
  if (all.workouts.n) items.push(['Trainingszeit', fmt(all.workouts.min / 60) + ' h']);
  if (sy.length) { const best = sy.reduce((b, Y) => (!b || Y.st.steps.avg > b.st.steps.avg ? Y : b), null); items.push(['Bestes Jahr', String(best.y)]); }
  if (hy.length >= 2) items.push(['Ruhepuls', `${fmt(hy[0].st.heart.rhr)} → ${fmt(hy[hy.length - 1].st.heart.rhr)}`]);
  if (all.steps.best) items.push(['Rekordtag', fmt(all.steps.best[1])]);
  items.push(['Health-Typ', per.animal[1] + ' ' + per.animal[0]]);
  slides.push({
    bg: 'linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#ff0080 130%)', deco: 'none',
    html: `<div class="s-top a1">${esc(P.short)} in Zahlen</div>
      <div class="s-sum a2">${items.slice(0, 8).map((i) => `<div><span>${esc(i[0])}</span><b>${esc(i[1])}</b></div>`).join('')}</div>
      <div class="s-actions a3"><button class="s-share">Als Bild teilen</button><button class="s-again">Nochmal ansehen</button></div>`,
    share: () => shareImage(P.short, items.slice(0, 8), per),
  });
  return slides;
}

function summaryItems(st, per) {
  const items = [];
  if (st.steps.total) items.push(['Schritte', fmt(st.steps.total)]);
  if (st.km) items.push(['Kilometer', fmt(st.km)]);
  if (st.workouts.n) items.push(['Workouts', fmt(st.workouts.n)]);
  if (st.workouts.types[0]) items.push(['Top-Sport', sportName(st.workouts.types[0].t)]);
  if (st.heart.rhr) items.push(['Ruhepuls', fmt(st.heart.rhr) + ' bpm']);
  if (st.sleep.n) items.push(['Schlaf/Nacht', hm(st.sleep.avg).replace(' min', '')]);
  if (st.steps.best) items.push(['Bester Tag', fmt(st.steps.best[1])]);
  items.push(['Health-Typ', per.animal[1] + ' ' + per.animal[0]]);
  return items.slice(0, 8);
}

/* ── Abspielen ────────────────────────────────────────────────────────────────── */
function openStory(data, p) {
  const slides = p.id === 'all' ? storySlidesAll(data) : storySlides(data, p);
  const root = document.createElement('div');
  root.className = 'story';
  root.innerHTML = `<div class="st-bars">${slides.map(() => '<i><b></b></i>').join('')}</div>
    <button class="st-x" aria-label="Schließen">✕</button>
    ${slides.map((s, i) => `<section class="slide${s.dark ? ' dark' : ''}" data-i="${i}" style="background:${s.bg}"><div class="deco deco-${s.deco}"></div><div class="s-in">${s.html}</div></section>`).join('')}`;
  document.body.appendChild(root);
  document.body.classList.add('noscroll');
  let idx = -1, t0 = 0, elapsed = 0, paused = false, raf = 0;
  const bars = root.querySelectorAll('.st-bars b');
  const secs = root.querySelectorAll('.slide');

  function go(i) {
    if (i < 0) i = 0;
    if (i >= slides.length) { close(); return; }
    idx = i; elapsed = 0; t0 = performance.now();
    secs.forEach((s, j) => s.classList.toggle('on', j === i));
    bars.forEach((b, j) => (b.style.width = j < i ? '100%' : '0%'));
    const s = secs[i];
    // Animationen neu starten
    s.classList.remove('play'); void s.offsetWidth; s.classList.add('play');
    s.querySelectorAll('.cnt').forEach(countUp);
  }
  function tick(now) {
    if (!paused && idx >= 0) {
      const t = elapsed + (now - t0);
      const last = idx === slides.length - 1;
      bars[idx].style.width = Math.min(100, t / STORY_MS * 100) + '%';
      if (t >= STORY_MS && !last) go(idx + 1);
    }
    raf = requestAnimationFrame(tick);
  }
  function pause() { if (!paused) { paused = true; elapsed += performance.now() - t0; root.classList.add('paused'); } }
  function resume() { if (paused) { paused = false; t0 = performance.now(); root.classList.remove('paused'); } }
  function close() {
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', key);
    root.classList.add('closing');
    setTimeout(() => { root.remove(); document.body.classList.remove('noscroll'); }, 220);
  }
  function key(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') go(idx + 1);
    else if (e.key === 'ArrowLeft') go(idx - 1);
    else if (e.key === 'Escape') close();
  }

  let downAt = 0, downX = 0, downY = 0, holdT = 0;
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    downAt = Date.now(); downX = e.clientX; downY = e.clientY;
    holdT = setTimeout(pause, 220);
  });
  root.addEventListener('pointerup', (e) => {
    clearTimeout(holdT);
    if (e.target.closest('button')) return;
    const wasHold = paused && Date.now() - downAt > 220;
    resume();
    if (!downAt) return;
    const dy = e.clientY - downY, dx = e.clientX - downX;
    downAt = 0;
    if (dy > 90 && Math.abs(dx) < 80) { close(); return; }
    if (wasHold) return;
    if (Math.abs(dx) > 50) { go(idx + (dx < 0 ? 1 : -1)); return; }
    go(idx + (e.clientX < innerWidth * 0.33 ? -1 : 1));
  });
  root.addEventListener('pointercancel', () => { clearTimeout(holdT); resume(); downAt = 0; });
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  root.querySelector('.st-x').addEventListener('click', close);
  root.addEventListener('click', (e) => {
    if (e.target.closest('.s-share')) { const s = slides[idx]; if (s.share) s.share(); }
    if (e.target.closest('.s-again')) go(0);
  });
  document.addEventListener('keydown', key);
  go(0);
  raf = requestAnimationFrame(tick);
}

function countUp(el) {
  const to = parseFloat(el.dataset.to), dec = +el.dataset.dec || 0;
  const dur = 1400, t0 = performance.now();
  const f = dec ? (v) => NF1.format(v) : (v) => NF.format(Math.round(v));
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = f(to * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  el.textContent = f(0);
  setTimeout(() => requestAnimationFrame(step), 350);
}

/* ── Teilen als Bild (1080 × 1920) ────────────────────────────────────────────── */
async function shareImage(title, items, per) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, '#ff0080'); grad.addColorStop(0.55, '#7928ca'); grad.addColorStop(1, '#2b1055');
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1920);
  g.globalAlpha = 0.12; g.fillStyle = '#fff';
  for (const [x, y, r] of [[900, 260, 320], [120, 1650, 380], [980, 1500, 160]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const font = (w, s) => `${w} ${s}px -apple-system, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif`;
  g.fillStyle = '#fff';
  g.font = font(600, 44); g.fillText('HEALTH-RÜCKBLICK', 90, 180);
  g.font = font(800, title.length > 6 ? 92 : 220); g.fillText(title, 84, title.length > 6 ? 330 : 400);
  g.font = font(700, 64); g.fillText(`${per.animal[1]} ${per.animal[0]}`, 90, 520);
  let y = 680;
  for (const [k, v] of items) {
    g.globalAlpha = 0.75; g.font = font(500, 40); g.fillText(k, 90, y);
    g.globalAlpha = 1; g.font = font(800, 72); g.fillText(v, 90, y + 80);
    y += 150;
  }
  g.globalAlpha = 0.7; g.font = font(500, 34); g.fillText('Aus meinen Apple-Health-Daten', 90, 1840);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const file = new File([blob], `health-rueckblick-${title.replace(/\W+/g, '-')}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Mein Health-Rückblick' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
