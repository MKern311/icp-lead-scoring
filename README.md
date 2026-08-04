# ICP Lead Scoring

Generisches Werkzeug, um ein **Ideal Customer Profile (ICP)** zu definieren und Leads
dagegen nachvollziehbar zu bewerten — als statische Web-App ohne Backend.
Alle Daten bleiben lokal im Browser; es gibt kein Konto und keine Telemetrie.

## Funktionen

- **ICP-Profile frei definieren**: eigene Kriterien (Auswahlliste, Zahlenbereich, Ja/Nein,
  Skala) mit Gewichtung, Punktregeln und K.o.-Kriterien; Bewertungsstufen (z. B. A/B/C)
  mit eigenen Schwellenwerten
- **Leads bewerten**: einzeln mit Live-Ergebnis oder massenhaft per CSV-Import mit
  Spaltenzuordnung; jede Punktzahl ist bis auf Kriterienebene aufgeschlüsselt
- **Rangliste**: sortieren, filtern, als Excel-taugliche CSV exportieren (Semikolon, UTF-8-BOM)
- **Generik**: Profile als JSON-Datei exportieren/importieren — andere Nutzer erhalten
  identische Bewertungslogik; zwei anpassbare Beispiel-Vorlagen sind enthalten
- **Offline**: nach dem ersten Laden auch ohne Internetverbindung nutzbar (Service Worker)

## Nutzung

Die App ist eine statische Site — den Ordner `docs/` beliebig hosten (z. B. GitHub Pages)
oder lokal starten:

```bash
python3 -m http.server 8080 --directory docs
# → http://localhost:8080
```

## Tests

Die gesamte Kernlogik (Scoring, Modell-Validierung, CSV, Profil-Export/-Import) ist
testgedeckt — ohne Abhängigkeiten, nur mit dem Node-Test-Runner (Node ≥ 20):

```bash
node --test tests/*.test.js
```

## Projektstruktur

```text
docs/            Web-App (deploybarer Pages-Root)
  js/core/       Pure, DOM-freie Logik: scoring, model, csv, profile-io
  js/ui/         Views (deutsch): Profile, Editor, Lead, Rangliste, Import
tests/           node --test
specs/           Spec-Kit-Artefakte: Spezifikation, Plan, Contracts, Tasks
.specify/        Spec-Kit-Konfiguration inkl. Projekt-Verfassung
```

Verbindliche Regeln (Generik, nachvollziehbare Scores, lokale Datenhoheit, Einfachheit,
testbare Scoring-Logik): [.specify/memory/constitution.md](.specify/memory/constitution.md).
Die Rechenregeln der Bewertung sind in
[specs/001-icp-lead-scoring/contracts/scoring-engine.md](specs/001-icp-lead-scoring/contracts/scoring-engine.md) fixiert.
