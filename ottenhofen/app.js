/* Gemeinde Ottenhofen – iOS-Web-App
 * Inhalte: daten.js (erzeugt von aktualisieren.py aus www.vg-oberneuching.de/ottenhofen-54)
 * Aufbau: 5 Tabs mit je eigenem Navigationsstapel (wie UINavigationController in UITabBarController).
 */
(function () {
'use strict';
const D = window.DATEN;
const SITE = 'https://www.vg-oberneuching.de';
const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kinder) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'onerror') el.addEventListener('error', () => el.remove());
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
};
const svg = (inner, vb = '0 0 24 24') => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', vb); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner; return s;
};
const speicher = {
  lies(k, d) { try { const v = localStorage.getItem('oth.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  schreib(k, v) { try { localStorage.setItem('oth.' + k, JSON.stringify(v)); } catch (e) {} },
};

/* ── Symbole (SF-Symbols-ähnlich) ─────────────────────────────────── */
const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  haus: `<path ${S} d="M3.5 11 12 4l8.5 7"/><path ${S} d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5"/>`,
  hausVoll: `<path fill="currentColor" d="M12 3.2 2.8 10.8a.9.9 0 0 0 1.1 1.4l.9-.7V20a1 1 0 0 0 1 1H10v-5.5h4V21h4.2a1 1 0 0 0 1-1v-8.5l.9.7a.9.9 0 0 0 1.1-1.4Z"/>`,
  kalender: `<rect ${S} x="3.5" y="5" width="17" height="15.5" rx="3"/><path ${S} d="M3.5 9.5h17M8 3v4M16 3v4"/><circle fill="currentColor" cx="8" cy="13.5" r="1.1"/><circle fill="currentColor" cx="12" cy="13.5" r="1.1"/><circle fill="currentColor" cx="16" cy="13.5" r="1.1"/><circle fill="currentColor" cx="8" cy="17" r="1.1"/><circle fill="currentColor" cx="12" cy="17" r="1.1"/>`,
  az: `<path ${S} d="M3.5 18 7.5 6l4 12M5 14h5"/><path ${S} d="M14 7h6l-6 11h6"/>`,
  gemeinde: `<path ${S} d="M3 20.5h18M4.5 9.5h15M12 3.5l8 4.5H4z"/><path ${S} d="M6.5 10v8M10 10v8M14 10v8M17.5 10v8"/>`,
  dokument: `<path ${S} d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path ${S} d="M13.5 3v5h5M8.5 13h7M8.5 16.5h7"/>`,
  chevron: `<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M1.5 1.5 6.5 7l-5 5.5"/>`,
  zurueck: `<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M11 2 2.5 10.5 11 19"/>`,
  extern: `<path ${S} d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>`,
  lupe: `<circle ${S} stroke-width="2.2" cx="10.5" cy="10.5" r="6.5"/><path ${S} stroke-width="2.2" d="m15.5 15.5 5 5"/>`,
  x: `<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M2 2l12 12M14 2 2 14"/>`,
  telefon: `<path fill="currentColor" d="M6.6 3.2c.5-.4 1.2-.3 1.6.2l2.2 3c.3.5.3 1.1-.1 1.5l-1.4 1.4a.6.6 0 0 0-.1.7 13 13 0 0 0 5.2 5.2c.2.1.5.1.7-.1l1.4-1.4c.4-.4 1-.5 1.5-.1l3 2.2c.5.4.6 1.1.2 1.6l-1.4 1.9c-.7.9-1.9 1.3-3 1-6.1-1.6-10.9-6.4-12.5-12.5-.3-1.1.1-2.3 1-3Z"/>`,
  mail: `<rect ${S} x="3" y="5.5" width="18" height="13" rx="2.5"/><path ${S} d="m3.5 7 8.5 6 8.5-6"/>`,
  web: `<circle ${S} cx="12" cy="12" r="8.5"/><path ${S} d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5Z"/>`,
  teilen: `<path ${S} d="M12 3.5v11M8 7.5l4-4 4 4"/><path ${S} d="M8.5 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-2"/>`,
  warnung: `<path fill="currentColor" d="M12 2.5c.6 0 1.1.3 1.4.8l8.4 15a1.6 1.6 0 0 1-1.4 2.4H3.6a1.6 1.6 0 0 1-1.4-2.4l8.4-15c.3-.5.8-.8 1.4-.8Zm0 13.3a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm0-7.3c-.7 0-1.2.6-1.1 1.2l.4 4.6a.7.7 0 0 0 1.4 0l.4-4.6c.1-.6-.4-1.2-1.1-1.2Z"/>`,
  buch: `<path ${S} d="M4 5.5C6.5 4.3 9.5 4.3 12 6c2.5-1.7 5.5-1.7 8-.5V19c-2.5-1.2-5.5-1.2-8 .5-2.5-1.7-5.5-1.7-8-.5Z"/><path ${S} d="M12 6v13.5"/>`,
  burg: `<path ${S} d="M4 20.5V8h3v2.5h2.5V8h5v2.5H17V8h3v12.5zM10 20.5v-4.5a2 2 0 0 1 4 0v4.5"/>`,
  personen: `<circle ${S} cx="9" cy="8" r="3.2"/><path ${S} d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle ${S} cx="17" cy="9" r="2.5"/><path ${S} d="M16.5 14.6c2.3.1 4 1.6 4.5 4"/>`,
  koffer: `<rect ${S} x="3" y="7" width="18" height="12.5" rx="2.5"/><path ${S} d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>`,
  kind: `<circle ${S} cx="12" cy="6" r="2.6"/><path ${S} d="M7 11.5 12 10l5 1.5M12 10v5.5M9 21l3-5.5 3 5.5"/>`,
  schule: `<path ${S} d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path ${S} d="M6.5 11v5c1.5 1.6 3.5 2.4 5.5 2.4s4-.8 5.5-2.4v-5M21.5 9v6"/>`,
  verein: `<path ${S} d="M5 21V4M5 4.5h12l-2.5 4 2.5 4H5"/>`,
  tropfen: `<path ${S} d="M12 3.5s6 6.4 6 10.7a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5Z"/>`,
  info: `<circle ${S} cx="12" cy="12" r="8.5"/><path ${S} d="M12 11v5.5"/><circle fill="currentColor" cx="12" cy="7.8" r="1.2"/>`,
  schild: `<path ${S} d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z"/><path ${S} d="m9 12 2.2 2.2L15.5 10"/>`,
  sonne: `<circle ${S} cx="12" cy="12" r="4"/><path ${S} d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
  rathaus: `<path ${S} d="M4 20.5h16M5.5 20.5V10h13v10.5M3.5 10 12 4.5l8.5 5.5M10 20.5v-5h4v5"/>`,
  uhr: `<circle ${S} cx="12" cy="12" r="8.5"/><path ${S} d="M12 7v5l3 2"/>`,
  laptop: `<rect ${S} x="4.5" y="5" width="15" height="10.5" rx="1.5"/><path ${S} d="M2.5 19h19"/>`,
};
const ic = (n, vb) => svg(ICON[n], vb);

/* ── Hilfen ───────────────────────────────────────────────────────── */
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ausIso = s => { const [y, m, t] = s.split('-').map(Number); return new Date(y, m - 1, t); };
const HEUTE = iso(new Date());
const datumLang = s => { const d = ausIso(s); return `${WT_LANG[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const datumRelativ = s => {
  const diff = Math.round((ausIso(s) - ausIso(HEUTE)) / 864e5);
  if (diff === 0) return 'Heute'; if (diff === 1) return 'Morgen'; if (diff === -1) return 'Gestern';
  return datumLang(s);
};
const DOK_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|odt|rtf)(\?|#|$)/i;
const istDok = u => DOK_RE.test(u) || /hidrive/i.test(u);
const dokTyp = u => { const m = u.match(DOK_RE); if (m) return m[1].toUpperCase().replace('DOCX', 'DOC').replace('XLSX', 'XLS'); return 'WEB'; };
const telLink = nr => { let d = nr.replace(/[^\d+]/g, ''); if (d.startsWith('0')) d = '+49' + d.slice(1); return 'tel:' + d; };
const textAus = html => { const t = document.createElement('template'); t.innerHTML = html.replace(/</g, ' <'); return t.content.textContent.replace(/\s+/g, ' ').trim(); };
const falte = s => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
const seite = k => D.seiten[k];
const DEFEKT = new Set(D.dokumente.filter(d => d.x).map(d => d.u));
const siteUrl = k => SITE + encodeURI(k).replace(/%25/g, '%');
let toastT;
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('zeigen'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('zeigen'), 1800); };
const oeffneExtern = url => { window.open(url, '_blank', 'noopener'); };

/* ── Navigation ───────────────────────────────────────────────────── */
const TABS = [
  { id: 'start', name: 'Start', icon: 'haus', bau: baueStart },
  { id: 'termine', name: 'Termine', icon: 'kalender', bau: baueTermine },
  { id: 'az', name: 'Infos A–Z', icon: 'az', bau: baueAZ },
  { id: 'gemeinde', name: 'Gemeinde', icon: 'gemeinde', bau: baueGemeinde },
  { id: 'dokumente', name: 'Dokumente', icon: 'dokument', bau: baueDokumente },
];
const app = $('#app');
const stapel = {};
let aktiverTab = null;

function neuerScreen(titel, { gross = true, zurueck = null, rechts = [] } = {}) {
  const navtitel = h('div', { class: 'navtitel' }, titel);
  const bar = h('header', { class: 'navbar' + (gross ? '' : ' immer fest') },
    h('div', { class: 'zeile' },
      zurueck ? h('button', { class: 'zurueck', onclick: () => zurueckGehen(), 'aria-label': 'Zurück' }, ic('zurueck', '0 0 13 21'), h('span', {}, zurueck)) : h('span'),
      navtitel,
      h('div', { class: 'rechts' }, ...rechts)));
  const scroll = h('div', { class: 'scroll' });
  if (gross) scroll.append(h('h1', { class: 'grosstitel' + (titel.length > 24 ? ' lang' : '') }, titel));
  const el = h('div', { class: 'screen' }, bar, scroll);
  if (gross) {
    const pruefe = () => bar.classList.toggle('fest', scroll.scrollTop > (titel.length > 24 ? 30 : 38));
    scroll.addEventListener('scroll', pruefe, { passive: true });
  }
  return { el, scroll, bar, titel };
}

function zeigeTab(id) {
  if (!stapel[id]) {
    const tab = TABS.find(t => t.id === id);
    const cont = h('section', { class: 'stapel', 'data-tab': id });
    app.append(cont);
    stapel[id] = { cont, screens: [] };
    const sc = tab.bau();
    cont.append(sc.el); stapel[id].screens.push(sc);
  } else if (aktiverTab === id) {
    // nochmal tippen: zurück zur Wurzel bzw. nach oben scrollen
    const st = stapel[id];
    if (st.screens.length > 1) { while (st.screens.length > 1) entferneOben(id, false); }
    else st.screens[0].scroll.scrollTo({ top: 0, behavior: 'smooth' });
  }
  for (const [k, st] of Object.entries(stapel)) st.cont.classList.toggle('aktiv', k === id);
  aktiverTab = id;
  for (const b of document.querySelectorAll('.tab')) b.classList.toggle('aktiv', b.dataset.tab === id);
  speicher.schreib('tab', id);
}

function push(sc) {
  const st = stapel[aktiverTab];
  const vorher = st.screens[st.screens.length - 1];
  sc.el.classList.add('rein', 'schatten');
  st.cont.append(sc.el);
  st.screens.push(sc);
  sc.el.getBoundingClientRect();
  requestAnimationFrame(() => { sc.el.classList.remove('rein'); vorher.el.classList.add('dahinter'); });
  setTimeout(() => sc.el.classList.remove('schatten'), 450);
  history.pushState({ tiefe: st.screens.length }, '');
  randWischen(sc);
}

function entferneOben(tabId, anim = true) {
  const st = stapel[tabId];
  if (st.screens.length < 2) return;
  const oben = st.screens.pop();
  const darunter = st.screens[st.screens.length - 1];
  if (anim) {
    oben.el.classList.add('schatten');
    oben.el.classList.add('rein'); darunter.el.classList.remove('dahinter');
    setTimeout(() => oben.el.remove(), 430);
  } else {
    oben.el.remove(); darunter.el.classList.add('ohne-anim'); darunter.el.classList.remove('dahinter');
    requestAnimationFrame(() => darunter.el.classList.remove('ohne-anim'));
  }
}
function zurueckGehen() { if (stapel[aktiverTab].screens.length > 1) history.back(); }
window.addEventListener('popstate', () => entferneOben(aktiverTab, true));

/* Wischen vom linken Rand = Zurück (wie in iOS) */
function randWischen(sc) {
  let x0 = null, y0 = 0, dx = 0, aktiv = false, darunter = null;
  sc.el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    if (t.clientX > 24) return;
    x0 = t.clientX; y0 = t.clientY; dx = 0; aktiv = false;
    const st = stapel[aktiverTab]; darunter = st.screens[st.screens.length - 2];
  }, { passive: true });
  sc.el.addEventListener('touchmove', e => {
    if (x0 == null || !darunter) return;
    const t = e.touches[0]; dx = Math.max(0, t.clientX - x0);
    if (!aktiv) { if (Math.abs(t.clientY - y0) > 12 && dx < 12) { x0 = null; return; } if (dx < 8) return; aktiv = true; sc.el.classList.add('ohne-anim', 'schatten'); darunter.el.classList.add('ohne-anim'); }
    const w = window.innerWidth;
    sc.el.style.transform = `translateX(${dx}px)`;
    darunter.el.style.transform = `translateX(${-28 + 28 * dx / w}%)`;
  }, { passive: true });
  sc.el.addEventListener('touchend', () => {
    if (x0 == null) return; x0 = null;
    if (!aktiv) return;
    sc.el.classList.remove('ohne-anim'); darunter.el.classList.remove('ohne-anim');
    sc.el.style.transform = ''; darunter.el.style.transform = '';
    if (dx > window.innerWidth * 0.33) history.back();
    else setTimeout(() => sc.el.classList.remove('schatten'), 400);
  });
}

/* ── Bausteine ────────────────────────────────────────────────────── */
function gruppe(kopf, zeilen, { fuss = null, grosserKopf = false, kopfAktion = null } = {}) {
  const g = h('div', { class: 'gruppe' });
  if (kopf) g.append(h('div', { class: 'gruppe-kopf' + (grosserKopf ? ' gross' : ''), style: grosserKopf ? '' : 'margin-left:16px' }, h('span', {}, kopf), kopfAktion));
  g.append(h('div', { class: 'liste' }, ...zeilen));
  if (fuss) g.append(h('div', { class: 'gruppe-fuss' }, fuss));
  return g;
}
function zeile({ t1, t2 = null, t2klein = false, symbol = null, wert = null, links = null, onclick = null, href = null, extern = false, chevron = true, klasse = '' }) {
  const kinder = [];
  if (links) kinder.push(links);
  else if (symbol) kinder.push(symbol);
  const text = h('div', { class: 'text' }, h('div', { class: 't1' }, t1), t2 ? h('div', { class: 't2' + (t2klein ? ' klein' : '') }, t2) : null);
  const k = h('div', { class: 'koerper' }, text, wert ? h('span', { class: 'wert' }, wert) : null,
    extern ? ic('extern') : (chevron && (onclick || href) ? svg(ICON.chevron, '0 0 8 14') : null));
  const ext = k.lastChild; if (ext && ext.tagName === 'svg') ext.setAttribute('class', extern ? 'extern' : 'chevron');
  kinder.push(k);
  const tag = href ? 'a' : (onclick ? 'button' : 'div');
  const el = h(tag, { class: 'zeile-l ' + klasse, onclick, href, target: href && !href.startsWith('tel:') && !href.startsWith('mailto:') ? '_blank' : null, rel: href ? 'noopener' : null }, ...kinder);
  return el;
}
const symbol = (name, farbe) => h('span', { class: 'symbol', style: `background:${farbe}` }, ic(name));
const dokBadge = u => { const t = dokTyp(u); return h('span', { class: 'dok-badge ' + (t === 'DOC' ? 'doc' : t === 'WEB' ? 'web' : '') }, h('b', {}, t === 'WEB' ? 'LINK' : t)); };
function suchfeld(platzhalter, beiEingabe, wert = '') {
  const inp = h('input', { type: 'search', placeholder: platzhalter, enterkeyhint: 'search', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', value: wert });
  const box = h('div', { class: 'suche' + (wert ? ' hat-text' : '') }, ic('lupe'), inp,
    h('button', { class: 'loeschen', 'aria-label': 'Löschen', onclick: () => { inp.value = ''; box.classList.remove('hat-text'); beiEingabe(''); inp.focus(); } }, svg(ICON.x, '0 0 16 16')));
  box.firstChild.setAttribute('class', 'lupe');
  inp.addEventListener('input', () => { box.classList.toggle('hat-text', !!inp.value); beiEingabe(inp.value); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  return { box, inp };
}
function segment(optionen, aktiv, beiWahl) {
  const el = h('div', { class: 'segment', role: 'tablist' });
  for (const [wert, name] of optionen) {
    el.append(h('button', { class: wert === aktiv ? 'an' : '', role: 'tab', onclick: e => {
      for (const b of el.children) b.classList.remove('an'); e.currentTarget.classList.add('an'); beiWahl(wert);
    } }, name));
  }
  return el;
}

/* ── Artikelansicht (jede Seite der Website) ──────────────────────── */
function zeigeSeite(k, zurueckTitel) {
  const s = seite(k);
  if (!s) { oeffneExtern(siteUrl(k)); return; }
  const teilen = h('button', { class: 'knopf-icon', 'aria-label': 'Teilen', onclick: () => teileLink(s.t, siteUrl(k)) }, ic('teilen'));
  const sc = neuerScreen(s.t, { zurueck: kuerze(zurueckTitel || 'Zurück'), rechts: [teilen] });
  if (s.b && textAus(s.b).length + (s.b.includes('<img') ? 1 : 0) > 0) {
    sc.scroll.append(h('div', { class: 'artikel' }, inhaltElement(s.b, s.t)));
  }
  if (s.l && s.l.length) {
    sc.scroll.append(gruppe(s.b ? `${s.l.length} ${s.l.length === 1 ? 'Eintrag' : 'Einträge'}` : null,
      s.l.map(([kk, t]) => zeile({ t1: t, onclick: () => zeigeSeite(kk, s.t) }))));
  }
  if (!s.b && !(s.l && s.l.length)) sc.scroll.append(h('div', { class: 'leer' }, 'Diese Seite hat auf der Website keinen Inhalt.'));
  sc.scroll.append(h('div', { class: 'quelle' }, h('div', { class: 'liste' },
    zeile({ t1: 'Auf vg-oberneuching.de öffnen', href: siteUrl(k), extern: true, symbol: symbol('web', 'var(--grau)') }))));
  push(sc);
}
const kuerze = t => t.length > 16 ? t.slice(0, 14).trim() + '…' : t;

function inhaltElement(html, titel) {
  const div = h('div', { class: 'inhalt', html });
  for (const a of div.querySelectorAll('a')) {
    const href = a.getAttribute('href') || '';
    if (a.dataset.seite) {
      a.classList.add('intern');
      a.addEventListener('click', e => { e.preventDefault(); zeigeSeite(a.dataset.seite, titel); });
    } else if (href.startsWith('mailto:')) a.classList.add('mail');
    else if (href.startsWith('tel:')) a.classList.add('tel');
    else if (istDok(href)) {
      a.classList.add('dok'); a.target = '_blank'; a.rel = 'noopener';
      const t = dokTyp(href);
      a.prepend(h('span', { class: 'mini ' + (t === 'DOC' ? 'doc' : t === 'WEB' ? 'web' : '') }, t === 'WEB' ? 'LINK' : t));
      for (const br of a.querySelectorAll('br')) br.remove();
      if (DEFEKT.has(href)) { a.classList.add('fehlt'); a.title = 'Datei ist auf der Website nicht mehr vorhanden'; a.append(h('small', {}, ' · nicht mehr vorhanden')); }
    } else if (href) { a.classList.add('extern'); a.target = '_blank'; a.rel = 'noopener'; }
  }
  for (const img of div.querySelectorAll('img')) img.addEventListener('error', () => img.remove());
  telefonnummernVerlinken(div);
  return div;
}
// Telefonnummern wie "08123/9326-64" oder "0800 66677246" antippbar machen
const TEL_RE = /(?<![\d.,])(0\d{2,5}(?:\s?[\/–-]\s?|\s)\d[\d -]{2,}\d)(?![\d.,]*\d)/g;
function telefonnummernVerlinken(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('a') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const knoten = []; while (w.nextNode()) knoten.push(w.currentNode);
  for (const n of knoten) {
    const txt = n.nodeValue; TEL_RE.lastIndex = 0;
    if (!TEL_RE.test(txt)) continue;
    TEL_RE.lastIndex = 0;
    const frag = document.createDocumentFragment(); let i = 0, m;
    while ((m = TEL_RE.exec(txt))) {
      const nr = m[1].trim(); if (nr.replace(/\D/g, '').length < 7) continue;
      frag.append(txt.slice(i, m.index)); frag.append(h('a', { href: telLink(nr), class: 'tel' }, nr)); i = m.index + m[1].length;
    }
    frag.append(txt.slice(i)); n.replaceWith(frag);
  }
}
async function teileLink(titel, url) {
  try { if (navigator.share) { await navigator.share({ title: titel, url }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch (e) { oeffneExtern(url); }
}

/* ── Tab 1: Start ─────────────────────────────────────────────────── */
function baueStart() {
  const sc = neuerScreen('Ottenhofen');
  const s = sc.scroll;
  s.append(h('div', { class: 'untertitel' }, 'Gemeinde · Verwaltungsgemeinschaft Oberneuching'));
  s.append(h('button', { class: 'suche-knopf', onclick: () => zeigeSuche() }, ic('lupe'), 'Suchen in allen Inhalten'));
  s.append(h('div', { class: 'held' },
    h('img', { class: 'foto', src: SITE + '/images/zufallsbilder/ottenhofen//oth3.JPG', alt: 'Ottenhofen', onerror: 'this.remove()' }),
    h('img', { class: 'wappen', src: 'img/wappen.png', alt: 'Wappen Ottenhofen' }),
    h('div', { class: 'zeilen' }, h('b', {}, 'Gemeinde Ottenhofen'), h('span', {}, 'Landkreis Erding · Oberbayern'))));

  // Eilmeldung
  for (const [k, t] of D.eil || []) {
    s.append(h('button', { class: 'eil', onclick: () => zeigeSeite(k, 'Start') },
      h('span', { class: 'ico' }, ic('warnung')), h('span', {}, h('small', {}, 'Eilmeldung Ottenhofen'), h('strong', {}, t))));
  }

  // Bürgermeister (Inhalt der Seite /ottenhofen-54)
  const start = seite('/ottenhofen-54');
  const bgmText = textAus(start.b);
  const tel = (bgmText.match(/Telefon\s*([\d\/ -]+\d)/) || [])[1] || '08123/9326-64';
  const name1 = (bgmText.match(/1\. Bürgermeister\s*([^\n]+?)\s*Telefon/) || [])[1] || 'Christian Gerte';
  const name2 = (bgmText.match(/2\. Bürgermeister\s*(.+?)$/) || [])[1] || 'Alfred Greckl';
  const zusatz = (bgmText.match(/(Stellv\. VG-Vorsitzender)/) || [])[1] || '';
  const foto = (start.b.match(/<img src="([^"]+)"/) || [])[1];
  s.append(h('div', { class: 'gruppe' },
    h('div', { class: 'gruppe-kopf gross' }, 'Bürgermeister'),
    h('div', { class: 'liste' },
      h('div', { class: 'bgm' },
        foto ? h('img', { src: foto, alt: name1, onerror: 'this.remove()' }) : null,
        h('div', {}, h('div', { class: 'rolle' }, '1. Bürgermeister'), h('div', { class: 'name' }, name1),
          h('div', { class: 'zusatz' }, zusatz), h('div', { class: 'zusatz' }, 'Telefon ' + tel))),
      h('div', { class: 'aktion-reihe' },
        h('a', { class: 'aktion', href: telLink(tel) }, ic('telefon'), 'Anrufen'),
        h('a', { class: 'aktion', href: 'mailto:sekretariat@vg-oberneuching.de' }, ic('mail'), 'E-Mail'),
        h('button', { class: 'aktion', onclick: () => zeigeSeite('/ottenhofen-54', 'Start') }, ic('info'), 'Details')),
      zeile({ t1: name2, t2: '2. Bürgermeister', symbol: h('span', { class: 'symbol rund', style: 'background:var(--grau)' }, ic('personen')), chevron: false }))));

  // Aktuelle Meldungen
  s.append(gruppe('Ottenhofen – aktuelle Meldungen', (D.aktuell || []).map(([k, t]) =>
    zeile({ t1: t, onclick: () => zeigeSeite(k, 'Start') })), { grosserKopf: true }));

  // Nächste Termine
  const kommende = D.termine.filter(e => e.d >= HEUTE).slice(0, 4);
  s.append(gruppe('Nächste Termine', kommende.length ? kommende.map(terminZeile) : [h('div', { class: 'leer' }, 'Keine kommenden Termine')],
    { grosserKopf: true, kopfAktion: h('button', { onclick: () => zeigeTab('termine') }, 'Alle') }));

  // Online-Services (oben links auf der Website)
  s.append(gruppe('Online-Services', [
    zeile({ t1: 'Bürgerservice-Portal', t2: 'Anträge online stellen', href: 'https://www.buergerserviceportal.de/bayern/vgoberneuching', extern: true,
      links: h('span', { class: 'symbol', style: 'background:var(--blau);position:relative;overflow:hidden' }, ic('laptop'),
        h('img', { src: 'https://www.akdb.de/dl/bsp/bsp_rectangle01.png', alt: '', style: 'position:absolute;inset:0;background:#fff', onerror: true })) }),
    zeile({ t1: 'Bürger-Informations-System', t2: 'Ratsinformation: Sitzungen, Gemeinderat, Protokolle', href: 'https://vgem-oberneuching.ris.kommune-aktiv.de/seite/de/rathaus/02/-/Startseite.html', extern: true,
      links: h('span', { class: 'symbol', style: 'background:#fff;border:.5px solid var(--trenner)' }, h('img', { src: 'img/oth.png', alt: '' })) }),
    zeile({ t1: 'App Linus Wittich', t2: 'Mitteilungsblatt-App (verlinkt wie auf der Website)', href: 'https://vgem-oberneuching.ris.kommune-aktiv.de/seite/de/rathaus/02/-/Startseite.html', extern: true,
      links: h('span', { class: 'symbol', style: 'background:var(--indigo)' }, ic('buch')) }),
  ], { grosserKopf: true }));

  // Rathaus
  s.append(gruppe('Rathaus', [
    zeile({ t1: 'Besuch nur mit Termin', t2: 'Mo–Fr 8–12 Uhr, Mi 14–18 Uhr', symbol: symbol('uhr', 'var(--orange)'),
      onclick: () => zeigeSeite('/ottenhofen-54?view=article&id=2110:besuch-des-rathauses-mit-terminvereinbarung&catid=222', 'Start') }),
    zeile({ t1: 'Bürgerbüro anrufen', t2: '08123/9326-60', href: telLink('08123/9326-60'), symbol: symbol('telefon', 'var(--gruen)'), chevron: false }),
  ], { grosserKopf: true }));

  s.append(fussZeile());
  return sc;
}
function fussZeile() {
  const [y, m, d] = (D.stand || '').split('-');
  return h('div', { class: 'fusszeile' },
    h('img', { src: 'img/wappen.png', alt: '' }),
    `Inhalte von www.vg-oberneuching.de · Stand ${d}.${m}.${y}`, h('br'),
    `Copyright © ${y} Verwaltungsgemeinschaft Oberneuching.`);
}

/* ── Tab 2: Termine ───────────────────────────────────────────────── */
const ortKlasse = o => /neuching/i.test(o) ? 'neuching' : '';
function terminZeile(e) {
  const d = ausIso(e.d);
  return zeile({
    t1: e.t, t2: `${WT[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}${e.z ? ' · ' + e.z : ''} · ${e.o}`, t2klein: true,
    links: h('span', { class: 'datum-kachel ' + ortKlasse(e.o) }, h('i', {}, MON[d.getMonth()].slice(0, 3)), h('b', {}, d.getDate())),
    href: e.u, extern: true, klasse: 'termin-kurz',
  });
}
function baueTermine() {
  const sc = neuerScreen('Termine');
  const s = sc.scroll;
  const orte = [...new Set(D.termine.map(e => e.o))].filter(Boolean);
  let ort = speicher.lies('ort', 'alle');
  let monat = HEUTE.slice(0, 7);
  let gewaehlt = null;
  const kal = h('div', { class: 'kalender' });
  const liste = h('div');
  const opts = [['alle', 'Alle'], ...orte.map(o => [o, o])];
  s.append(segment(opts, ort, w => { ort = w; speicher.schreib('ort', w); zeichne(); }));
  s.append(kal, liste);
  s.append(h('div', { class: 'gruppe-fuss', style: 'margin:0 32px 20px' }, 'Antippen öffnet die Termindetails auf vg-oberneuching.de. Veranstaltungskalender der VG Oberneuching (Ottenhofen und Neuching).'));
  s.append(fussZeile());
  const gefiltert = () => D.termine.filter(e => ort === 'alle' || e.o === ort);

  function zeichne() {
    const ev = gefiltert();
    const proTag = {}; for (const e of ev) (proTag[e.d] = proTag[e.d] || []).push(e);
    // Kalender
    const [y, m] = monat.split('-').map(Number);
    const erster = new Date(y, m - 1, 1), tage = new Date(y, m, 0).getDate();
    const versatz = (erster.getDay() + 6) % 7;
    kal.replaceChildren(
      h('div', { class: 'kal-kopf' }, h('b', {}, `${MON[m - 1]} ${y}`),
        h('div', { class: 'pfeile' },
          h('button', { 'aria-label': 'Vorheriger Monat', onclick: () => blaettern(-1) }, svg(ICON.zurueck, '0 0 13 21')),
          h('button', { 'aria-label': 'Nächster Monat', onclick: () => blaettern(1) }, svg('<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M2 2l8.5 8.5L2 19"/>', '0 0 13 21')))),
      h('div', { class: 'kal-wt' }, ...['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => h('span', {}, w))),
      h('div', { class: 'kal-tage' },
        ...Array.from({ length: versatz }, () => h('div', { class: 'kal-tag leer' })),
        ...Array.from({ length: tage }, (_, i) => {
          const ds = `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          const evt = proTag[ds] || [];
          const orteTag = [...new Set(evt.map(e => ortKlasse(e.o)))];
          const so = new Date(y, m - 1, i + 1).getDay() === 0;
          return h('button', { class: `kal-tag${ds === HEUTE ? ' heute' : ''}${ds === gewaehlt ? ' gewaehlt' : ''}${so ? ' so' : ''}`,
            onclick: () => { gewaehlt = gewaehlt === ds ? null : ds; zeichne(); } },
            h('span', { class: 'n' }, i + 1), h('span', { class: 'punkte' }, ...orteTag.map(c => h('i', { class: c }))));
        })),
      h('div', { class: 'legende' }, h('span', {}, h('i'), 'Ottenhofen'), h('span', {}, h('i', { class: 'neuching' }), 'Neuching')));
    // Liste
    let auswahl;
    if (gewaehlt) auswahl = ev.filter(e => e.d === gewaehlt);
    else {
      const ab = monat === HEUTE.slice(0, 7) ? HEUTE : monat + '-01';
      auswahl = ev.filter(e => e.d >= ab && e.d.slice(0, 7) === monat);
    }
    const nachTag = {}; for (const e of auswahl) (nachTag[e.d] = nachTag[e.d] || []).push(e);
    const gruppen = Object.entries(nachTag).map(([d, es]) => gruppe(datumRelativ(d), es.map(e => zeile({
      t1: e.t, t2: e.o, t2klein: true, href: e.u, extern: true, klasse: 'termin',
      links: h('span', { style: 'display:flex;gap:10px;align-self:stretch' }, h('span', { class: 'zeit' }, e.z ? e.z.split(' - ')[0] : 'ganztg.'), h('span', { class: 'balken ' + ortKlasse(e.o) })),
    }))));
    liste.replaceChildren(...(gruppen.length ? gruppen : [h('div', { class: 'leer' }, gewaehlt ? 'An diesem Tag keine Termine.' : 'Keine weiteren Termine in diesem Monat.')]));
  }
  function blaettern(r) {
    let [y, m] = monat.split('-').map(Number); m += r; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    monat = `${y}-${String(m).padStart(2, '0')}`; gewaehlt = null; zeichne();
  }
  zeichne();
  return sc;
}

/* ── Tab 3: Infos A–Z ─────────────────────────────────────────────── */
function baueAZ() {
  const wurzel = seite('/infos-az-ottenhofen');
  const sc = neuerScreen('Infos A–Z');
  const s = sc.scroll;
  const { box, inp } = suchfeld('Suchen', q => zeichne(q));
  s.append(box);
  const inhalt = h('div', { class: 'az-liste' }); s.append(inhalt);
  const index = h('div', { class: 'index-leiste' });
  sc.el.append(index);
  const buchstaben = (wurzel.l || []).map(([k, t]) => ({ k, t, eintraege: (seite(k) && seite(k).l) || [] }));
  function zeichne(q = '') {
    const f = falte(q.trim());
    const teile = [];
    const sichtbar = [];
    for (const b of buchstaben) {
      const es = f ? b.eintraege.filter(([k, t]) => falte(t).includes(f) || falte(textAus((seite(k) || {}).b || '')).includes(f)) : b.eintraege;
      if (!es.length) continue;
      sichtbar.push(b.t);
      teile.push(h('div', { class: 'az-buchstabe', id: 'az-' + b.t, style: 'margin-left:32px' }, b.t));
      teile.push(h('div', { class: 'gruppe' }, h('div', { class: 'liste' }, ...es.map(([k, t]) => zeile({ t1: t, onclick: () => zeigeSeite(k, 'Infos A–Z') })))));
    }
    inhalt.replaceChildren(...(teile.length ? teile : [h('div', { class: 'leer' }, `Keine Treffer für „${q}“`)]));
    index.replaceChildren(...sichtbar.map(b => h('button', { 'data-b': b }, b)));
    index.style.display = f ? 'none' : '';
  }
  const springe = y => {
    const el = document.elementFromPoint(index.getBoundingClientRect().left + 8, y);
    if (el && el.dataset && el.dataset.b) { const z = document.getElementById('az-' + el.dataset.b); if (z) { z.scrollIntoView({ block: 'start' }); } }
  };
  index.addEventListener('touchstart', e => { springe(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  index.addEventListener('touchmove', e => { springe(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  index.addEventListener('click', e => springe(e.clientY));
  zeichne();
  inp.addEventListener('focus', () => sc.bar.classList.add('fest'));
  return sc;
}

/* ── Tab 4: Gemeinde (Menü der linken Spalte) ─────────────────────── */
function baueGemeinde() {
  const sc = neuerScreen('Gemeinde');
  const s = sc.scroll;
  const eintrag = (k, name, icon, farbe, t2) => {
    const p = seite(k); if (!p) return null;
    return zeile({ t1: name || p.t, t2, symbol: symbol(icon, farbe), onclick: () => zeigeSeite(k, 'Gemeinde') });
  };
  s.append(gruppe('Ottenhofen', [
    zeile({ t1: 'Infos A–Z Ottenhofen', symbol: symbol('az', 'var(--tint)'), onclick: () => zeigeTab('az') }),
    eintrag('/gemeindebuechereioth', 'Gemeindebücherei', 'buch', 'var(--orange)'),
    eintrag('/othgeschichte', 'Gemeindedaten und -geschichte', 'burg', 'var(--braun)'),
    eintrag('/gemeinderat-2', 'Gemeinderat', 'personen', 'var(--blau)'),
    eintrag('/gemeinderat-2/mitglieder1', 'Gemeinderat – Mitglieder', 'personen', 'var(--indigo)'),
  ].filter(Boolean)));
  s.append(gruppe('Leben in Ottenhofen', [
    eintrag('/gewerberegisterottenhofen', 'Gewerberegister', 'koffer', 'var(--braun)'),
    eintrag('/kigaottenhofen', 'Kindertagesstätten', 'kind', 'var(--pink)'),
    eintrag('/schule-oth', 'Schule', 'schule', 'var(--gruen)'),
    eintrag('/vereinothbeitr', 'Vereine', 'verein', 'var(--lila)'),
    eintrag('/versorgmenuoth', 'Ver- und Entsorgung', 'tropfen', 'var(--teal)'),
    eintrag('/infos-az-ottenhofen/205-p-oth/870-photovoltaik-in-ottenhofen', 'Photovoltaik in Ottenhofen', 'sonne', 'var(--gelb)'),
  ].filter(Boolean)));
  s.append(gruppe('Verwaltungsgemeinschaft', [
    zeile({ t1: 'Verwaltung', t2: 'VG Oberneuching – Rathaus, Ämter', href: SITE + '/', extern: true, symbol: symbol('rathaus', 'var(--grau)') }),
    zeile({ t1: 'Neuching', t2: 'Gemeinde Neuching', href: SITE + '/neuching-55', extern: true,
      links: h('span', { class: 'symbol', style: 'background:#fff;border:.5px solid var(--trenner)' }, h('img', { src: 'img/neuch.png', alt: '' })) }),
    zeile({ t1: 'Besuch des Rathauses', t2: 'nur mit Terminvereinbarung', symbol: symbol('uhr', 'var(--orange)'),
      onclick: () => zeigeSeite('/ottenhofen-54?view=article&id=2110:besuch-des-rathauses-mit-terminvereinbarung&catid=222', 'Gemeinde') }),
  ]));
  s.append(gruppe('Rechtliches', [
    eintrag('/impressum-3', 'Impressum', 'info', 'var(--grau)'),
    eintrag('/datenschutz', 'Datenschutz', 'schild', 'var(--grau)'),
  ].filter(Boolean)));
  s.append(fussZeile());
  return sc;
}

/* ── Tab 5: Dokumente ─────────────────────────────────────────────── */
const KATEGORIEN = [
  ['amtsblatt', 'Amtsblätter', d => /amtsblatt/i.test(d.t + d.u)],
  ['bau', 'Bauleitplanung', d => /bplan|bebauungs|flächennutzung|vorkauf|lageplan|schall|baugrund|geotechn|bestandsverm|außenbereich|urplan|änderung –|festsetzung|ortsplan/i.test(d.t + ' ' + d.u + ' ' + d.p.join(' '))],
  ['satzung', 'Satzungen & Verordnungen', d => /satzung|verordnung|ordnung|richtlinie/i.test(d.t + d.u)],
  ['antrag', 'Anträge & Formulare', d => /antrag|anmeld|abmeld|formular|sepa|merkblatt|tonnen|standrohr/i.test(d.t + d.u)],
  ['aktuell', 'Bekanntmachungen & Aktuelles', d => /bekanntmach|tennet|flyer|programm|ferien|kinderkino|mikrozensus|grundsteuer|hunde|flurst|bohrpunkt|komponenten|leitung|plan lh/i.test(d.t + ' ' + d.u + ' ' + d.p.join(' '))],
];
function kategorieVon(d) { for (const [id, , f] of KATEGORIEN) if (f(d)) return id; return 'sonst'; }
function baueDokumente() {
  const sc = neuerScreen('Dokumente');
  const s = sc.scroll;
  const alle = D.dokumente.map(d => ({ ...d, kat: kategorieVon(d), such: falte(d.t + ' ' + d.p.map(k => (seite(k) || {}).t || '').join(' ') + ' ' + decodeURIComponent(d.u.split('/').pop())) }));
  let kat = 'alle', q = '';
  const { box } = suchfeld(`${alle.length} Dokumente durchsuchen`, v => { q = v; zeichne(); });
  s.append(box);
  const chips = h('div', { class: 'chips' });
  const opts = [['alle', 'Alle'], ...KATEGORIEN.map(([id, n]) => [id, n]), ['sonst', 'Sonstiges']];
  for (const [id, n] of opts) {
    const anz = id === 'alle' ? alle.length : alle.filter(d => d.kat === id).length;
    if (!anz) continue;
    chips.append(h('button', { class: 'chip' + (id === kat ? ' an' : ''), onclick: e => { kat = id; for (const c of chips.children) c.classList.remove('an'); e.currentTarget.classList.add('an'); zeichne(); } }, `${n} (${anz})`));
  }
  s.append(chips);
  s.append(h('div', { class: 'hinweis' }, ic('info'), 'Dokumente öffnen sich direkt von vg-oberneuching.de. In der PDF-Ansicht über „Teilen“ lassen sie sich sichern oder drucken.'));
  const liste = h('div'); s.append(liste);
  s.append(fussZeile());
  function zeichne() {
    const f = falte(q.trim());
    let treffer = alle.filter(d => (kat === 'alle' || d.kat === kat) && (!f || f.split(' ').every(w => d.such.includes(w))));
    if (kat === 'amtsblatt') treffer.sort((a, b) => amtsblattDatum(b) - amtsblattDatum(a));
    const gruppen = [];
    if (kat === 'alle' && !f) {
      for (const [id, n] of [...KATEGORIEN.map(([i, n]) => [i, n]), ['sonst', 'Sonstiges']]) {
        let es = treffer.filter(d => d.kat === id); if (!es.length) continue;
        if (id === 'amtsblatt') es = es.sort((a, b) => amtsblattDatum(b) - amtsblattDatum(a));
        gruppen.push(gruppe(`${n} · ${es.length}`, es.map(dokZeile)));
      }
    } else if (treffer.length) gruppen.push(gruppe(`${treffer.length} ${treffer.length === 1 ? 'Dokument' : 'Dokumente'}`, treffer.map(dokZeile)));
    liste.replaceChildren(...(gruppen.length ? gruppen : [h('div', { class: 'leer' }, 'Keine Dokumente gefunden')]));
  }
  zeichne();
  return sc;
}
function amtsblattDatum(d) {
  const m = (d.t + ' ' + d.u).match(/(\d{2})[._-](\d{2})[._-](\d{2,4})/);
  if (!m) return 0; let y = +m[3]; if (y < 100) y += 2000; if (y > 2100) y = 2015; return new Date(y, m[2] - 1, m[1]).getTime();
}
function dokZeile(d) {
  const quelle = d.p.map(k => (seite(k) || {}).t).filter(Boolean)[0] || '';
  const z = zeile({ t1: d.t, t2: d.x ? 'Auf der Website nicht mehr vorhanden · ' + quelle : quelle, t2klein: true, links: dokBadge(d.u), href: d.u, extern: true, klasse: d.x ? 'fehlt' : '' });
  return z;
}

/* ── Suche über alles ─────────────────────────────────────────────── */
let suchIndex = null;
function zeigeSuche() {
  if (!suchIndex) {
    suchIndex = Object.entries(D.seiten).filter(([k, s]) => s.t && !k.startsWith('/component/content/category/103-ottenhofen-bereich')).map(([k, s]) => ({ k, t: s.t, ft: falte(s.t), fx: falte(textAus(s.b || '')) }));
    // gleiche Artikel unter mehreren Buchstaben nur einmal
    const ges = new Set(); suchIndex = suchIndex.filter(e => { const id = (e.k.match(/\/(\d+)-[^/]*$/) || [])[1] || e.k; if (ges.has(id + e.t)) return false; ges.add(id + e.t); return true; });
  }
  const sc = neuerScreen('Suche', { zurueck: 'Start' });
  const { box, inp } = suchfeld('Seiten, Dokumente, Termine', q => zeichne(q));
  sc.scroll.append(box);
  const erg = h('div'); sc.scroll.append(erg);
  function zeichne(q) {
    const f = falte(q.trim()); const w = f.split(/\s+/).filter(Boolean);
    if (!w.length) { erg.replaceChildren(h('div', { class: 'leer' }, 'Durchsucht alle Seiten, Dokumente und Termine der Gemeinde Ottenhofen.')); return; }
    const passt = s => w.every(x => s.includes(x));
    const seiten = suchIndex.map(e => ({ e, p: passt(e.ft) ? 2 : passt(e.ft + ' ' + e.fx) ? 1 : 0 })).filter(x => x.p).sort((a, b) => b.p - a.p).slice(0, 40);
    const doks = D.dokumente.filter(d => passt(falte(d.t + ' ' + decodeURIComponent(d.u.split('/').pop())))).slice(0, 30);
    const ter = D.termine.filter(e => e.d >= HEUTE && passt(falte(e.t + ' ' + e.o))).slice(0, 15);
    const teile = [];
    if (seiten.length) teile.push(gruppe(`Seiten · ${seiten.length}`, seiten.map(({ e }) => zeile({ t1: e.t, t2: ausschnitt(e, w), t2klein: true, onclick: () => zeigeSeite(e.k, 'Suche') }))));
    if (doks.length) teile.push(gruppe(`Dokumente · ${doks.length}`, doks.map(dokZeile)));
    if (ter.length) teile.push(gruppe(`Termine · ${ter.length}`, ter.map(terminZeile)));
    erg.replaceChildren(...(teile.length ? teile : [h('div', { class: 'leer' }, `Keine Treffer für „${q}“`)]));
  }
  function ausschnitt(e, w) {
    const roh = textAus(seite(e.k).b || ''); const i = falte(roh).indexOf(w[0]);
    if (i < 0) return roh.slice(0, 90) || null;
    const a = Math.max(0, i - 35); return (a ? '…' : '') + roh.slice(a, a + 100).trim() + '…';
  }
  zeichne('');
  push(sc);
  setTimeout(() => inp.focus(), 380);
}

/* ── Start ────────────────────────────────────────────────────────── */
const bar = $('#tabbar');
for (const t of TABS) bar.append(h('button', { class: 'tab', 'data-tab': t.id, onclick: () => zeigeTab(t.id) }, ic(t.icon), t.name));
zeigeTab(TABS.some(t => t.id === speicher.lies('tab')) ? speicher.lies('tab') : 'start');
history.replaceState({ tiefe: 1 }, '');
})();
