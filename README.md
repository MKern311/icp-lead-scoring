# ICP Lead Scoring

Ideal Customer Profile definieren und Leads nachvollziehbar bewerten.
Statische Web-App ohne Backend — **alle Daten bleiben im Browser**.

**Live:** https://mkern311.github.io/icp-lead-scoring/

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
(Namensraum `icp.v1.*`). Kein Konto, kein Server, keine Übertragung — mit einer eng
begrenzten Ausnahme: Wer die Online-Recherche nutzt, sendet die Pre-Screening-Kriterien
und Suchparameter an die Anthropic-API. Gewichte, Punktwerte, Bewertungen und
gespeicherte Leads werden dabei nie übertragen.

Der API-Schlüssel ist der eigene und wird nur im Browser gespeichert (nie in Exporten).

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

`.env` ist von Git ausgeschlossen und wird nur vom lokalen Server gelesen. Auf
GitHub Pages gibt es keinen Server — dort wird der Schlüssel im Browser hinterlegt.

## Aufbau

- `docs/` — die App (zugleich GitHub-Pages-Root, deploybar wie sie ist)
- `docs/js/core/` — pure, DOM-freie Logik (Scoring, Screening, CSV, Import/Export)
- `tests/` — Tests der Kernlogik (`node --test`)
- `specs/` — Spezifikationen und verbindliche Verträge je Feature
- `.specify/memory/constitution.md` — die Grundsätze des Projekts

Vanilla JavaScript (ES2022), HTML5, CSS3. Kein Framework, keine Abhängigkeiten.
