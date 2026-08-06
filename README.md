# Familien-Retreat 17.8. – 6.9.2026

Handy-App für die drei Kita-freien Wochen: Tagesplan mit allen festen Terminen,
Kalenderblatt zum Ausdrucken, Einkaufsplan, Spielideen und Checklisten.
Alles direkt in der App änderbar.

---

## Online stellen (GitHub Pages)

**1. Repository anlegen**
Auf github.com → **New repository** → Name z. B. `retreat` → **Private** wählen → **Create**.

> Private Repos funktionieren mit GitHub Pages nur in bezahlten Plänen.
> Mit einem kostenlosen Konto muss das Repo **Public** sein. Die URL ist dann
> zwar nicht verlinkt, aber öffentlich erreichbar – deshalb stehen in der App
> bewusst keine Adressen, Telefonnummern oder Nachnamen.

**2. Dateien hochladen**
Im Repo auf **Add file → Upload files**, dann diese fünf Dateien hineinziehen:

```
index.html
manifest.json
icon-192.png
icon-512.png
icon-maskable.png
```

Unten auf **Commit changes** klicken.

**3. Pages einschalten**
**Settings → Pages** → unter *Source* **Deploy from a branch** wählen →
Branch `main`, Ordner `/ (root)` → **Save**.

Nach ein bis zwei Minuten erscheint oben die Adresse:

```
https://DEIN-NAME.github.io/retreat/
```

**4. Auf beide Handys**
Link an deine Frau schicken. Auf dem Handy im Browser öffnen und zum
Startbildschirm hinzufügen:

- **iPhone:** Teilen-Symbol → *Zum Home-Bildschirm*
- **Android:** Menü (⋮) → *App installieren* bzw. *Zum Startbildschirm hinzufügen*

Danach startet sie wie eine normale App, ohne Browser-Leiste.

---

## Wichtig: Änderungen synchronisieren sich nicht automatisch

GitHub Pages liefert nur statische Dateien aus – es gibt keinen Server, der
etwas speichern könnte. Die App legt eure Änderungen deshalb **lokal im Browser
des jeweiligen Handys** ab.

Konkret: Wenn du auf deinem Handy einen Haken setzt, sieht deine Frau das auf
ihrem Handy **nicht**.

Zum Abgleichen gibt es unter **Mehr → Stand teilen**:

- **Stand exportieren** – speichert eine `.json`-Datei, die ihr per WhatsApp,
  AirDrop oder Mail schicken könnt
- **Stand laden** – überschreibt den eigenen Stand mit der empfangenen Datei

Praktikabler Umgang damit: Einer von euch führt die Einkaufs- und Packlisten,
der andere liest hauptsächlich mit. Sonst überschreibt ihr euch gegenseitig.

---

## Was die App kann

| Bereich | Inhalt |
|---|---|
| **Plan** | Alle 21 Tage, feste Termine, Programm, Optionen A/B zum Antippen, Eltern-Moment, Essen, Haushalt |
| **Blatt** | Alle drei Wochen als Kalenderraster auf einer Seite, A4 quer zum Ausdrucken |
| **Einkauf** | Fünf Lieferungen mit Terminen und abhakbaren Posten, offene Posten kopierbar |
| **Ideen** | Spiele nach Alter, gemeinsam, Auto, Pool, Regentag |
| **Listen** | Packen, Absprachen mit der Schwägerin, Rückgabe, Haushaltsplan |
| **Mehr** | Merkzettel, Export/Import, Zurücksetzen |

**Bearbeiten:** Auf einen beliebigen Text tippen → Eingabefeld öffnet sich → Speichern.
Termine, Posten und Ideen lassen sich über **+** ergänzen und über **×** löschen.

**Ausdrucken:** Im Tab *Blatt* auf **Drucken / als PDF sichern**. Am iPhone geht das
auch über Safari → Teilen → Drucken → zum Sichern in der Vorschau aufziehen.
Ausrichtung **Querformat**, Format A4. Das Blatt ist auf genau eine Seite ausgelegt.

**Zurücksetzen:** Unter *Mehr → Zurücksetzen* geht alles auf den Ausgangsplan
zurück. Vorher exportieren, falls ihr den Stand behalten wollt.

---

## Später etwas ändern

Inhalte ändert ihr am einfachsten direkt in der App. Wenn ihr den *Ausgangsplan*
selbst anpassen wollt (der beim Zurücksetzen wiederhergestellt wird), steht er
in `index.html` im Objekt `START`. Datei im Repo öffnen, Stift-Symbol,
bearbeiten, **Commit changes** – Pages baut automatisch neu.
