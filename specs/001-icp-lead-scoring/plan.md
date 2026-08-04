# Implementation Plan: ICP Definition & Lead Scoring

**Branch**: `main` (Solo-Projekt, kein Feature-Branch) | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-icp-lead-scoring/spec.md`

## Summary

Generisches Einzelnutzer-Werkzeug zur Definition von Ideal Customer Profiles (frei konfigurierbare
Kriterien, Gewichte, Punktregeln, K.o.-Kriterien, Stufen) und zur deterministischen, vollständig
nachvollziehbaren Bewertung von Leads (einzeln und per CSV-Import). Technischer Ansatz: statisch
gehostete Web-App (GitHub Pages) ohne Backend — Vanilla JavaScript mit ES-Modulen, ohne
Build-Schritt und ohne Laufzeit-Abhängigkeiten. Alle Nutzdaten liegen in `localStorage` des
Browsers; ein Service Worker macht die App nach dem ersten Laden offline nutzbar. Die
Scoring-Engine ist ein pures, DOM-freies Modul und wird mit dem Node-Test-Runner getestet.

## Technical Context

**Language/Version**: JavaScript (ES2022, native ES-Module), HTML5, CSS3 — kein TypeScript, kein Transpiler

**Primary Dependencies**: Keine Laufzeit- oder Build-Abhängigkeiten. CSV-Parser und Scoring-Engine werden selbst implementiert (pure Module, testgedeckt)

**Storage**: `localStorage` (Namespace `icp.v1.*`); Profile und Leads als JSON-Dokumente; Bewertungen werden nicht gespeichert, sondern deterministisch berechnet

**Testing**: Node.js ≥ 20 eingebauter Test-Runner (`node --test`) für alle puren Module (scoring, csv, model, profile-io); manuelle Validierung der UI über quickstart.md

**Target Platform**: Moderne Evergreen-Browser (Chrome, Edge, Firefox, Safari), Desktop-first mit responsivem Layout; Hosting als statische Site auf GitHub Pages (`docs/`-Ordner auf `main`)

**Project Type**: Statische Single-Page-Web-App (client-only)

**Performance Goals**: 5 000 Leads bewerten + sortieren < 1 s; UI-Interaktionen < 100 ms; Erst-Laden < 2 s bei DSL

**Constraints**: Offline-fähig nach erstem Laden (Service Worker, cache-first); kein Backend, keine Konten, keine Telemetrie; deutsche UI; CSV-Kompatibilität mit deutschem Excel (Semikolon-Trennung, UTF-8 mit BOM)

**Scale/Scope**: 1 Nutzer pro Instanz; bis 5 000 Leads pro Profil; ca. 6 Ansichten (Profil-Liste, Profil-Editor, Lead-Erfassung, Rangliste, CSV-Import-Assistent, Einstellungen/Export)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Prinzip | Prüfung | Status |
|---|---------|---------|--------|
| I | Generik vor Spezialfall | Keine Branchen-Kriterien im Code; Vorlagen liegen als reine Datenobjekte in `templates.js` und nutzen dasselbe Profil-Schema wie Nutzerprofile | ✅ Pass |
| II | Nachvollziehbare Scores | `scoring.js` liefert zu jeder Bewertung ein Breakdown (Rohwert, Punkte, Gewichtsanteil, Beitrag) zurück; Rundungs- und Normalisierungsregeln sind in [contracts/scoring-engine.md](contracts/scoring-engine.md) fixiert; keine Zufalls- oder Zeitabhängigkeit | ✅ Pass |
| III | Lokale Datenhoheit | Nur `localStorage`; keine Netzwerkzugriffe außer dem Laden der statischen App-Dateien; Export/Import ausschließlich als vom Nutzer ausgelöste Datei-Downloads/-Uploads; Service Worker für Offline-Betrieb | ✅ Pass |
| IV | Einfachheit & Ein-Personen-Betrieb | Kein Framework, kein Build-Schritt, keine Abhängigkeiten; Deployment = Dateien in `docs/` pushen; Start = URL öffnen | ✅ Pass |
| V | Testbare Scoring-Logik | Scoring, CSV, Modell-Validierung und Profil-IO sind DOM-freie ES-Module unter `docs/js/core/`, getestet via `node --test tests/` | ✅ Pass |

**Re-Check nach Phase 1 (Design)**: unverändert ✅ — das Datenmodell enthält keine
branchenspezifischen Felder, die Bewertung bleibt eine pure Funktion `evaluate(profile, lead)`,
und es kam keine Abhängigkeit hinzu.

## Project Structure

### Documentation (this feature)

```text
specs/001-icp-lead-scoring/
├── spec.md              # Feature-Spezifikation
├── plan.md              # Diese Datei
├── research.md          # Phase-0-Output
├── data-model.md        # Phase-1-Output
├── quickstart.md        # Phase-1-Output (Validierungsanleitung)
├── contracts/
│   ├── profile-export.schema.json   # JSON-Schema der Profil-Exportdatei
│   ├── csv-format.md                # CSV-Import/-Export-Vertrag
│   └── scoring-engine.md            # API- und Rechenregeln der Scoring-Engine
├── checklists/
│   └── requirements.md  # Spec-Qualitäts-Checkliste
└── tasks.md             # Phase-2-Output (/speckit-tasks)
```

### Source Code (repository root)

```text
docs/                          # GitHub-Pages-Root (die App)
├── index.html                 # Einstieg, alle Views als <section> + Navigation
├── sw.js                      # Service Worker: cache-first, versionierter Cache
├── css/
│   ├── base.css               # Reset, Typografie, Farben (CSS-Custom-Properties)
│   ├── layout.css             # Seitengerüst, Navigation, responsive Raster
│   └── components.css         # Formulare, Tabellen, Badges, Dialoge, Toasts
└── js/
    ├── app.js                 # Entry: View-Wiring, Navigation, SW-Registrierung
    ├── store.js               # Persistenzschicht über localStorage (icp.v1.*)
    ├── templates.js           # Mitgelieferte Beispiel-Profile (reine Daten)
    ├── core/                  # DOM-freie, pure Module (Node-testbar)
    │   ├── model.js           # Entity-Factories + Validierung (Profil, Kriterium, Stufe, Lead)
    │   ├── scoring.js         # evaluate(profile, lead) → Bewertung mit Breakdown
    │   ├── csv.js             # RFC-4180-Subset: parse/serialize, Delimiter-Erkennung, BOM
    │   └── profile-io.js      # Profil-Export/-Import (JSON, Schema-Validierung)
    └── ui/
        ├── profile-list.js    # Profil-Übersicht, Anlegen/Duplizieren/Löschen, Vorlagen
        ├── profile-editor.js  # Kriterien, Gewichte, Punktregeln, K.o., Stufen
        ├── lead-form.js       # Lead erfassen/bearbeiten, Live-Bewertung
        ├── lead-list.js       # Rangliste: Sortieren, Filtern, CSV-Export
        └── import-wizard.js   # CSV-Upload, Spaltenzuordnung, Fehlerbericht

tests/                         # node --test
├── scoring.test.js            # Punktregeln, Gewichtung, K.o., fehlende Werte, Rundung
├── model.test.js              # Validierung (Gewichtssumme, Bereichs-Überlappung, Stufen)
├── csv.test.js                # Parser/Serializer, Delimiter, BOM, kaputte Zeilen
└── profile-io.test.js         # Export→Import-Roundtrip, Schema-Ablehnung
```

**Structure Decision**: Single-Page-App ohne Build — `docs/` ist unverändert deploybarer
Pages-Root. Die unter `docs/js/core/` liegenden Module sind DOM- und browserfrei und werden
direkt von den Tests unter `tests/` importiert; damit ist Constitution-Prinzip V strukturell
erzwungen (UI kann Scoring nicht beeinflussen). UI-Code (deutsch beschriftet) und Core-Logik
(englische Bezeichner) sind strikt getrennt.

## Complexity Tracking

> Keine Constitution-Verletzungen — Tabelle entfällt.
