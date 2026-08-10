# Implementation Plan: Geführter Screening-Workflow

**Branch**: `main` (Solo-Projekt, kleine Schritte) | **Date**: 2026-08-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-guided-workflow/spec.md`

## Summary

Der bisherige Nav-Punkt „Screening" wird zu einem geführten Drei-Schritte-Workflow:
(1) Phasen-Zuordnung aller Kriterien als Liste mit Pflicht-Bestätigung plus optionale
Suchhinweise je Pre-Screening-Kriterium, (2) Online-Screening mit Übernahme,
(3) geführte Qualifizierung Lead für Lead mit Live-Bewertung. Technisch: neues
UI-Modul `ui/workflow.js` ersetzt `ui/screening.js` auf der Route `#/screening`;
das Kriterien-Modell erhält ein optionales Feld `searchHint`, das in den
Screening-Request einfließt (nur Pre-Screening-Kriterien, weiterhin ohne
Gewichte/Punkte); die Warteschlangen-Logik für Schritt 3 ist pure und getestet.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022, ES-Module), HTML5, CSS3

**Primary Dependencies**: keine (kein Framework, kein Build-Schritt, keine Dev-Dependencies)

**Storage**: localStorage über `docs/js/store.js` (Namespace `icp.v1.*`); Bewertungen werden nie gespeichert

**Testing**: `node --test tests/*.test.js` (Node ≥ 20), nur pure Module in `docs/js/core/`

**Target Platform**: moderne Browser (statische Site, GitHub-Pages-fähig aus `docs/`), Offline-Kern via Service Worker

**Project Type**: statische Web-App (Single-Page, Hash-Routing)

**Performance Goals**: flüssige Bedienung bis ~5 000 Leads pro Profil (Verfassungs-Auslegungsgrenze)

**Constraints**: Schritt 1 und 3 offline-fähig; Schritt 2 nur mit Netz + eigenem API-Schlüssel (Verfassung III); UI deutsch, Code englisch; Nutzereingaben beim Rendern escapen

**Scale/Scope**: 1 neues UI-Modul, 1 entfallendes UI-Modul, 3 erweiterte Core-Module, ~6 erweiterte Testgruppen

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Generik**: PASS — Workflow arbeitet mit beliebigen Profilen/Kriterien; `searchHint`
  ist ein generisches, nutzerdefinierbares Feld je Kriterium, keine Branchenlogik.
- **II. Nachvollziehbare Scores**: PASS — Bewertungslogik unverändert; Suchhinweise
  transportieren keine Punkte oder Gewichte; Live-Bewertung in Schritt 3 nutzt
  ausschließlich `evaluate(profile, lead)`.
- **III. Lokale Datenhoheit & Offline-Kern**: PASS — Schritt 2 nutzt die bestehende,
  eng begrenzte Online-Ausnahme unverändert (explizite Nutzeraktion, eigener Schlüssel,
  nur Pre-Screening-Kriterien + Suchparameter). `searchHint` ist Profil-Definitionsdatum
  der Pre-Screening-Phase und fällt unter III (c). Schritt 1 und 3 sind offline-fähig.
- **IV. Einfachheit**: PASS — keine neuen Abhängigkeiten; ein Nav-Punkt ersetzt einen
  bestehenden (keine Parallelstruktur); Wiederverwendung von `evaluate`, Store,
  Screening-Kern.
- **V. Testbare Logik**: PASS — neue pure Logik (searchHint-Validierung,
  Request-Serialisierung mit Hinweisen, Qualifizierungs-Warteschlange) liegt in
  `docs/js/core/` und wird per `node --test` abgedeckt.

**Re-Check nach Phase 1**: PASS — Design führt keine neuen Verstöße ein; die Änderung
am Request-Aufbau wird im Screening-Contract (Feature 002) nachgezogen, SC-004-Testanker
bleibt bestehen und wird um Suchhinweis-Fälle erweitert.

## Project Structure

### Documentation (this feature)

```text
specs/003-guided-workflow/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── workflow.md      # Workflow-Regeln (Schritt-Gates, Warteschlange, Hinweis-Serialisierung)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
docs/
├── index.html                 # Nav-Label bleibt „Screening"; Section view-screening bleibt
├── sw.js                      # ASSETS: ui/workflow.js statt ui/screening.js; Cache icp-cache-v3
└── js/
    ├── app.js                 # Route #/screening → ui/workflow.js
    ├── store.js               # unverändert (migrateProfile ergänzt kein searchHint-Default — optional)
    ├── templates.js           # optional: beispielhafte searchHints in Vorlagen
    ├── core/
    │   ├── model.js           # criterion.searchHint (optional, ≤ 200 Zeichen), Validierung
    │   ├── screening.js       # Request: Suchhinweis-Zeile je Pre-Screening-Kriterium;
    │   │                      #   NEU: qualificationQueue(profile, leads) (pure)
    │   └── profile-io.js      # Export/Import searchHint (schemaVersion bleibt 2, optional)
    └── ui/
        ├── workflow.js        # NEU: 3-Schritte-Führung (ersetzt ui/screening.js)
        ├── screening.js       # ENTFÄLLT (Schlüssel-/Lauf-/Ergebnis-Logik wandert in workflow.js)
        ├── profile-editor.js  # Suchhinweis-Feld bei Pre-Screening-Kriterien (Paritätspflicht FR-002)
        └── lead-form.js       # unverändert (bleibt Einzelansicht)

tests/
├── model.test.js              # searchHint-Validierung
├── screening.test.js          # Hinweis-Serialisierung (nur Pre-Screening), Warteschlange, SC-004 erweitert
└── profile-io.test.js         # searchHint-Roundtrip; v2 ohne searchHint bleibt gültig
```

**Structure Decision**: Bestehende Struktur (statische App unter `docs/`, pure Logik in
`docs/js/core/`, Views in `docs/js/ui/`) wird beibehalten. Der Workflow ist ein einzelnes
View-Modul mit internem Schritt-Zustand (kein Router-Ausbau); `ui/screening.js` wird
ersatzlos in `ui/workflow.js` aufgelöst, damit es genau einen Screening-Einstieg gibt.

## Complexity Tracking

Keine Verfassungsabweichungen — Tabelle entfällt.
