# ICP Lead Scoring

Ideal Customer Profile definieren und Leads nachvollziehbar bewerten.
Statische Web-App — **alle Daten bleiben im Browser**.

**Live:** https://icp.manuelkern.com

Die Online-Recherche braucht eine Lizenz (ein Schlüssel, zwei Geräte). Alles
andere — Profile, Leads, Bewertung, CSV, Sicherung — ist lizenzfrei und bleibt es.

## Was es tut

1. **Wunschkunden-Profil definieren** — Kriterien festlegen, gewichten,
   K.-o.-Kriterien markieren, Stufen (A/B/C) bestimmen. Zwei Vorlagen als Startpunkt.
2. **Kandidaten finden** — optionale Online-Recherche sucht Unternehmen, die zu den
   Klassen-Filtern passen (Branche, Größe, Region), jeweils mit Quellenangabe.
3. **Tiefen-Screening** — jedes Unternehmen einzeln geprüft: belegter Wert, Quelle,
   Konfidenz (belegt/abgeleitet) und Belegdatum je Kriterium. Werte ohne Quelle
   werden verworfen.
4. **Qualifizieren** — was erst im Gespräch zu erfahren ist, wird geführt Lead für
   Lead ergänzt. Die Rangliste sortiert nach Punktzahl.

Punkte entstehen ausschließlich lokal aus den eigenen Regeln — die Recherche liefert
nur Rohwerte mit Quellen, nie Bewertungen.

## Datenhaltung

Profile, Leads und Einstellungen liegen im `localStorage` des jeweiligen Browsers
(Namensraum `icp.v1.*`). Kein Konto, kein Login, keine Übertragung — mit zwei eng
begrenzten Ausnahmen, beide nur rund um die Online-Recherche:

1. **Recherche**: Pre-Screening-Kriterien und Suchparameter gehen an die
   Anthropic-API. Gewichte, Punktwerte, Bewertungen und gespeicherte Leads nie.
2. **Lizenzprüfung**: Lizenzschlüssel, Gerätekennung und eine kurze
   Gerätebezeichnung („Chrome auf macOS") gehen an den Lizenzdienst. Nie ein
   Kriterium, nie ein Lead, nie ein API-Schlüssel.

Der API-Schlüssel ist der eigene und wird nur im Browser gespeichert. Weder er noch
die Lizenzdaten landen je in einem Export, einem Profil-Code oder einer Sicherung.

## Lizenz

Ein Schlüssel (`ICP-XXXX-XXXX-XXXX`) lässt sich auf **zwei** Geräten aktivieren.
Eingetragen wird er im Recherche-Schritt; Groß- und Kleinschreibung sowie
Bindestriche sind egal. Danach erneuert sich die Freigabe still — kein Abo, keine
wiederkehrende Eingabe.

Drei Dinge, die dabei gelten:

- **Die Prüfung sitzt nur vor der Online-Recherche.** Alles andere läuft ohne Lizenz.
- **Daten werden nie als Geisel genommen.** Export und Sicherung funktionieren auch
  bei abgelaufener oder gesperrter Lizenz. Immer.
- **Netzfehler blockieren nicht.** Ist der Lizenzdienst nicht erreichbar, läuft die
  Recherche weiter. Nur eine eindeutige Absage hält sie an.

Das ist ausdrücklich **kein Kopierschutz**: Die Prüfung läuft im Browser und ist
umgehbar. Der Schlüssel ist eine Zahlungskonvention — wer sie umgeht, spart die
Lizenz und zahlt weiterhin seinen eigenen Anthropic-Schlüssel. Der zugehörige
Dienst liegt im Nachbarrepo `icp-licence`.

## Lokal starten

```bash
node serve.mjs                  # http://localhost:8080
node --test tests/*.test.js     # Kernlogik-Tests
```

Node ≥ 20. Keine Abhängigkeiten, kein Build-Schritt.

Wer den API-Schlüssel nicht bei jedem Start eingeben will, legt ihn lokal ab:

```bash
cp .env.example .env            # ANTHROPIC_API_KEY eintragen
```

`.env` ist von Git ausgeschlossen und wird nur vom lokalen Server gelesen. In der
ausgelieferten Fassung gibt es keinen Server — dort wird der Schlüssel im Browser
hinterlegt. Wer gegen einen lokal laufenden Lizenzdienst entwickelt, trägt dort
zusätzlich `LICENCE_API=http://localhost:8787` ein.

## Aufbau

- `docs/` — die App (zugleich GitHub-Pages-Root, deploybar wie sie ist)
- `docs/js/core/` — pure, DOM-freie Logik (Scoring, Screening, CSV, Import/Export)
- `tests/` — Tests der Kernlogik (`node --test`)
- `specs/` — Spezifikationen und verbindliche Verträge je Feature
- `deploy/pages-tombstone/` — Weiterleitungsseite für die alte GitHub-Pages-Adresse
- `.specify/memory/constitution.md` — die Grundsätze des Projekts

Vanilla JavaScript (ES2022), HTML5, CSS3. Kein Framework, keine Abhängigkeiten.
