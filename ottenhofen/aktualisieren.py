#!/usr/bin/env python3
"""Holt alle Inhalte des Ottenhofen-Bereichs von www.vg-oberneuching.de und
schreibt sie nach daten.js (wird von index.html geladen).

Aufruf:  python3 aktualisieren.py
Braucht nur Python 3 und curl. Dokumente (PDF/DOC) werden NICHT kopiert,
sondern in der App als Link auf die Originaldatei der Website angezeigt.
"""
import datetime
import html
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, unquote, urljoin, urlparse

B = 'https://www.vg-oberneuching.de'
HIER = os.path.dirname(os.path.abspath(__file__))

# Einstiegspunkte = Menü der Seite /ottenhofen-54 (linke Spalte) + Startseite
BEREICHE = (
    '/ottenhofen-54', '/infos-az-ottenhofen', '/gemeindebuechereioth', '/othgeschichte',
    '/gemeinderat-2', '/gemeinderat-2/mitglieder1', '/gewerberegisterottenhofen',
    '/kigaottenhofen', '/schule-oth', '/vereinothbeitr', '/versorgmenuoth',
    '/impressum-3', '/datenschutz', '/infos-a-z/153-t/123-topaktuell',
    '/component/content/category/103-ottenhofen-bereich', '/?view=article',
)
DOKUMENT = re.compile(r'\.(pdf|docx?|xlsx?|pptx?|zip|odt|rtf)$', re.I)


def hole(url):
    r = subprocess.run(['curl', '-sSL', '-A', 'Mozilla/5.0 (Ottenhofen-App-Aktualisierung)',
                        '--max-time', '60', url], capture_output=True)
    return r.stdout.decode('utf-8', 'replace')


def hauptteil(h):
    h = re.sub(r'<script.*?</script>', '', h, flags=re.S)
    a, b = h.find('<!-- MAIN CONTENT -->'), h.find('<!-- //MAIN CONTENT -->')
    return h[a:b] if 0 <= a < b else ''


def absolut(link):
    link = html.unescape(link).strip()
    if link.startswith(('mailto:', 'tel:')):
        return link
    if link.startswith(('#', 'javascript')):
        return ''
    u = urljoin(B + '/', link)
    u = re.sub(r'^https?://(www\.)?vg-oberneuching\.de/', B + '/', u)
    return quote(unquote(u), safe=":/?&=#%+,;@~-._!$'()*")


def schluessel(u):
    """Interner Seitenschlüssel (Pfad + Query ohne limit)."""
    u = absolut(u).split('#')[0]
    if not u.startswith(B):
        return None
    p = unquote(u[len(B):])
    p = re.sub(r'[?&]limit=0$', '', p).replace('?limit=0&', '?')
    return p or '/'


def erlaubt(pfad):
    return any(pfad.startswith(x) for x in BEREICHE)


# ── 1. Seiten crawlen ────────────────────────────────────────────────────
def crawlen():
    roh, gesehen = {}, set()
    warte = [B + p for p in BEREICHE if not p.startswith('/?')]
    warte.append(B + '/ottenhofen-54?view=article&id=2110:besuch-des-rathauses-mit-terminvereinbarung&catid=222')
    # Eilmeldungen/Meldungen aus der rechten Spalte der Startseite
    start = hole(B + '/ottenhofen-54')
    for l in re.findall(r'<h4 class="newsflash-title">\s*<a href="([^"]+)"', start):
        warte.append(absolut(l))
    while warte and len(gesehen) < 1500:
        stapel = [u for u in dict.fromkeys(warte) if u not in gesehen][:16]
        warte = [u for u in warte if u not in gesehen and u not in stapel]
        if not stapel:
            break
        gesehen.update(stapel)
        abruf = [u + ('&' if '?' in u else '?') + 'limit=0' for u in stapel]
        with ThreadPoolExecutor(8) as ex:
            antworten = list(ex.map(hole, abruf))
        for u, h in zip(stapel, antworten):
            m = hauptteil(h)
            roh[u] = m
            for l in re.findall(r'href="([^"]+)"', m):
                voll = absolut(l)
                if not voll:
                    continue
                p = urlparse(voll)
                if p.netloc != 'www.vg-oberneuching.de':
                    continue
                pfad = unquote(p.path).lower()
                if DOKUMENT.search(pfad) or '/images/' in pfad:
                    continue
                if any(x in voll for x in ('print=1', 'format=feed', 'tmpl=component')):
                    continue
                k = schluessel(voll)
                if k and erlaubt(k) and voll not in gesehen:
                    warte.append(voll)
        print(f'  {len(gesehen)} Seiten geladen …', file=sys.stderr)
    return {schluessel(u): m for u, m in roh.items() if m.strip()}, start


# ── 2. Termine ───────────────────────────────────────────────────────────
MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
          'September', 'Oktober', 'November', 'Dezember']


def termine():
    jahr = datetime.date.today().year
    urls = [f'{B}/kalmenu/eventsnachjahr/{j}/-?start={s}' for j in (jahr, jahr + 1) for s in range(0, 600, 10)]
    with ThreadPoolExecutor(8) as ex:
        seiten = list(ex.map(hole, urls))
    liste, gesehen = [], set()
    for h in seiten:
        for li in re.findall(r"<li class='ev_td_li'(.*?)</li>", h, re.S):
            t = re.sub(r'\s+', ' ', li)
            m = re.search(r'<p>(.*?)<br/>.*?href="([^"]+)"[^>]*>(.*?)</a>.*?</span>(?:&nbsp;)*\s*(.*?)</p>', t)
            if not m:
                continue
            wann = html.unescape(m.group(1)).replace('\xa0', ' ').strip()
            d = re.search(r'(\d{1,2})\. (\w+) (\d{4})\s*(.*)', wann)
            if not d or d.group(2) not in MONATE:
                continue
            datum = f'{d.group(3)}-{MONATE.index(d.group(2)) + 1:02d}-{int(d.group(1)):02d}'
            url = absolut(m.group(2))
            if url in gesehen:
                continue
            gesehen.add(url)
            liste.append({
                'd': datum, 'z': d.group(4).strip(), 't': ' '.join(html.unescape(m.group(3)).split()),
                'o': html.unescape(re.sub('<[^>]+>', '', m.group(4))).replace('\xa0', ' ').strip(), 'u': url,
            })
    liste.sort(key=lambda e: (e['d'], e['z']))
    return liste


# ── 3. HTML säubern ──────────────────────────────────────────────────────
ERLAUBT = {'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'h5',
           'table', 'tr', 'td', 'th', 'tbody', 'thead', 'img', 'hr', 'sup', 'sub', 'blockquote'}


def saeubern(frag):
    f = re.sub(r'<!--.*?-->', '', frag, flags=re.S)
    f = re.sub(r'<(script|style|form|iframe)[^>]*>.*?</\1>', '', f, flags=re.S | re.I)

    def tag(m):
        zu, name, attr = m.group(1), m.group(2).lower(), m.group(3) or ''
        if name not in ERLAUBT:
            return ''
        if zu:
            return f'</{name}>'
        if name == 'a':
            h = re.search(r'href\s*=\s*"([^"]*)"', attr) or re.search(r"href\s*=\s*'([^']*)'", attr)
            ziel = absolut(h.group(1)) if h else ''
            return f'<a href="{html.escape(ziel, quote=True)}">' if ziel else '<a>'
        if name == 'img':
            s = re.search(r'src\s*=\s*"([^"]*)"', attr)
            a = re.search(r'alt\s*=\s*"([^"]*)"', attr)
            if not s or not absolut(s.group(1)).startswith('http'):
                return ''
            alt = html.escape(html.unescape(a.group(1)) if a else '', quote=True)
            return f'<img src="{html.escape(absolut(s.group(1)), quote=True)}" alt="{alt}" loading="lazy">'
        if name in ('td', 'th'):
            cs = re.search(r'colspan\s*=\s*"(\d+)"', attr)
            return f'<{name} colspan="{cs.group(1)}">' if cs else f'<{name}>'
        return f'<{name}>'

    f = re.sub(r'<(/?)([a-zA-Z0-9]+)([^>]*)>', tag, f)
    f = f.replace('&nbsp;', ' ').replace('\xa0', ' ').replace('​', '')
    f = re.sub(r'<a[^>]*>((?:\s|<br>)*)</a>', r'\1', f)          # leere Links
    f = re.sub(r'<(strong|b|em|u)>\s*</\1>', '', f)
    f = re.sub(r'<p>\s*(<br>\s*)*</p>', '', f)
    f = re.sub(r'(<br>\s*){3,}', '<br><br>', f)
    f = re.sub(r'[ \t]+', ' ', f)
    f = re.sub(r'\s*\n\s*', '\n', f).strip()
    return f


def titel(m):
    t = re.search(r'<h1[^>]*>(.*?)</h1>', m, re.S) or re.search(r'<h2[^>]*>(.*?)</h2>', m, re.S)
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', '', t.group(1))).split()) if t else ''


def inhalt(m):
    teile = []
    d = re.search(r'<div class="category-desc">(.*?)<div class="clr"></div>', m, re.S)
    if d:
        teile.append(d.group(1))
    a = re.search(r'<section class="article-content[^"]*">(.*?)</section>', m, re.S)
    if a:
        teile.append(a.group(1))
    return saeubern('\n'.join(teile))


def liste(m):
    aus = []
    for l, t in re.findall(r'<td[^>]*class="list-title"[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>', m, re.S):
        aus.append([schluessel(l), ' '.join(html.unescape(re.sub('<[^>]+>', '', t)).split())])
    for l, t in re.findall(r'<h3 class="page-header item-title"><a href="([^"]+)">(.*?)</a>', m, re.S):
        aus.append([schluessel(l), ' '.join(html.unescape(t).split())])
    if not aus:
        for l, t in re.findall(r'<a href="(/\?view=article[^"]+)"[^>]*>(.*?)</a>', m, re.S):
            aus.append([schluessel(l), ' '.join(html.unescape(re.sub('<[^>]+>', '', t)).split())])
    return [x for x in aus if x[0]]


# ── 4. Dokumentenverzeichnis ─────────────────────────────────────────────
ALLGEMEIN = {'plan', 'download', 'hier', 'link', 'satzung', 'begründung', 'textliche festsetzung',
             'flyer', 'antrag', 'formular', 'anlage', 'info', 'infos', 'pdf'}


def dokumente(seiten):
    alle = {}
    for k, s in seiten.items():
        for block in re.split(r'<(?:p|li|h\d|td|tr)>', s['b']):
            kontext = ''
            for teil in re.split(r'(<a href="[^"]*">.*?</a>)', block, flags=re.S):
                m = re.match(r'<a href="([^"]*)">(.*?)</a>', teil, re.S)
                if not m:
                    txt = ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', teil)).split()).strip(' :–-')
                    if txt:
                        kontext = txt
                    continue
                u = html.unescape(m.group(1))
                if not (DOKUMENT.search(unquote(u).split('?')[0]) or 'hidrive' in u):
                    continue
                t = ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', m.group(2))).split())
                klein = t.lower().strip(' .:')
                if not t or klein in ALLGEMEIN or len(t) < 6 or klein.startswith(('hier ', 'download')):
                    basis = kontext if kontext and len(kontext) <= 70 else s['t']
                    t = basis if (not t or klein in ('download', 'hier', 'link', 'pdf')) else f'{basis} – {t}'
                d = alle.setdefault(u, {'u': u, 't': t, 'p': []})
                if k not in d['p']:
                    d['p'].append(k)
    # Erreichbarkeit prüfen: auf der Website selbst defekte Links werden in der App markiert
    def status(u):
        r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-I', '-L', '-A', 'Mozilla/5.0', '--max-time', '30',
                            '-w', '%{http_code}', u], capture_output=True)
        return r.stdout.decode().strip()
    eigene = [u for u in alle if u.startswith(B)]
    with ThreadPoolExecutor(12) as ex:
        for u, code in zip(eigene, ex.map(status, eigene)):
            if code == '404':
                alle[u]['x'] = 1
    return sorted(alle.values(), key=lambda d: d['t'].lower())


def main():
    print('Lade Seiten …', file=sys.stderr)
    roh, start = crawlen()
    seiten = {}
    for k, m in roh.items():
        s = {'t': titel(m), 'b': inhalt(m)}
        l = liste(m)
        if l:
            s['l'] = l
        seiten[k] = s

    # interne Links auf App-Seiten umbiegen (auch index.php?…&id=1896 → Artikel 1896)
    nach_id = {}
    for k in sorted(seiten, key=len):
        m = re.search(r'/(\d+)-[^/?]*$', k) or re.search(r'[?&]id=(\d+)', k)
        if m:
            nach_id.setdefault(m.group(1), k)

    def intern(b):
        def r(m):
            u = html.unescape(m.group(1))
            if DOKUMENT.search(unquote(u).split('?')[0]) or '/images/' in u:
                return m.group(0)
            k = schluessel(u)
            if k and k not in seiten and k.startswith(('/index.php', '/component/content/article', '/?')):
                i = re.search(r'[?&]id=(\d+)', k) or re.search(r'/(\d+)-', k)
                k = nach_id.get(i.group(1)) if i else None
            return f'<a data-seite="{html.escape(k, quote=True)}" href="{m.group(1)}">' if k in seiten else m.group(0)
        return re.sub(r'<a href="([^"]*)">', r, b)

    for s in seiten.values():
        s['b'] = intern(s['b'])
        if 'l' in s:   # Verweise auf nicht verlinkte (versteckte) Kategorien entfernen
            s['l'] = [x for x in s['l'] if x[0] in seiten]
    # Unterseiten aus dem Menü (z. B. Datenschutz → Datenschutzerklärung) als Liste anhängen
    for k, s in seiten.items():
        if 'l' not in s and '?' not in k:
            kinder = [[c, seiten[c]['t']] for c in sorted(seiten)
                      if c.startswith(k + '/') and '/' not in c[len(k) + 1:] and '?' not in c]
            if kinder:
                s['l'] = kinder

    # Meldungen der Startseite (rechte Spalte)
    def meldungen(modul):
        blk = re.search(r'id="' + modul + r'".*?</div></div></div>', start, re.S)
        if not blk:
            return []
        return [[schluessel(l), ' '.join(html.unescape(t).split())]
                for l, t in re.findall(r'<h4 class="newsflash-title">\s*<a href="([^"]+)">(.*?)</a>', blk.group(0), re.S)]

    print('Lade Termine …', file=sys.stderr)
    daten = {
        'stand': datetime.date.today().isoformat(),
        'eil': meldungen('Mod129'),
        'aktuell': meldungen('Mod113'),
        'seiten': seiten,
        'dokumente': dokumente(seiten),
        'termine': termine(),
    }
    ziel = os.path.join(HIER, 'daten.js')
    with open(ziel, 'w', encoding='utf-8') as f:
        f.write('/* Automatisch erzeugt von aktualisieren.py – Quelle: www.vg-oberneuching.de/ottenhofen-54 */\n')
        f.write('window.DATEN=')
        json.dump(daten, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print(f"Fertig: {len(seiten)} Seiten, {len(daten['dokumente'])} Dokumente, "
          f"{len(daten['termine'])} Termine → {ziel}", file=sys.stderr)


if __name__ == '__main__':
    main()
