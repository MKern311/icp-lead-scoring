# icp-lead-scoring — Agent Context

Generisches ICP-Definitions- und Lead-Scoring-Tool. Statische Web-App ohne Backend;
optionales Online-Screening (Claude API + Websuche, eigener Nutzer-Schlüssel).

## Verbindliche Artefakte (Quelle der Wahrheit)

- Verfassung: `.specify/memory/constitution.md` (v2.0.0 — Generik, nachvollziehbare Scores,
  lokale Datenhoheit & Offline-Kern mit eng begrenzter Online-Ausnahme, Einfachheit,
  testbare Logik)
- Feature 001: `specs/001-icp-lead-scoring/` (Scoring-Kern, CSV, Profile)
- Feature 002: `specs/002-online-screening/` (Kriterien-Phasen, Online-Pre-Screening;
  Screening-Regeln fixiert in `contracts/screening.md`)
- Feature 003: `specs/003-guided-workflow/` (geführter 3-Schritte-Workflow auf
  `#/screening`, Suchhinweise je Kriterium; Regeln in `contracts/workflow.md`)

## Stack & Regeln

- Vanilla JavaScript (ES2022, ES-Module), HTML5, CSS3 — **kein** Framework, **kein**
  Build-Schritt, **keine** Abhängigkeiten (auch keine Dev-Dependencies)
- `docs/` = GitHub-Pages-Root (deploybar wie er ist); `docs/js/core/` = pure, DOM-freie
  Module (scoring, model, csv, profile-io) — nur diese werden getestet
- Persistenz ausschließlich über `docs/js/store.js` (localStorage, Namespace `icp.v1.*`);
  Bewertungen werden nie gespeichert, immer via `evaluate(profile, lead)` berechnet
- Screening: Kriterien haben `stage` (`prescreening` = online recherchierbar,
  `qualification` = 2. Screening; Default qualification), `searchTargets` (bevorzugte
  Options-IDs bei Auswahl-Kriterien, per Klick — serialisiert als „Bevorzugt:"-Labels)
  und optional `searchHint` (Freitext ≤ 200 Zeichen, UI nur noch bei range; beides nur
  für Pre-Screening serialisiert). `core/screening.js` ist
  pure und darf nur Pre-Screening-Kriterien serialisieren (testverankert, SC-004); die KI
  liefert nur Rohwerte + Quellen, nie Punkte. API-Schlüssel unter `icp.v1.apikey`, nie
  exportieren. Die Route `#/screening` rendert den geführten Workflow (`ui/workflow.js`,
  3 Schritte); `qualificationQueue` bestimmt offene Screening-Leads für Schritt 3.
  Schritt 1 gruppiert (recherchierbar zuerst) und bietet `criterionCatalog`
  (`templates.js`, reine Daten) per `criterionFromCatalog` zum Übernehmen an.
- Tests: `node --test tests/` (Node ≥ 20); Scoring-Regeln sind in
  `specs/001-icp-lead-scoring/contracts/scoring-engine.md` fixiert — Änderungen dort zuerst
- UI-Texte deutsch, Code-Bezeichner englisch; Nutzereingaben beim Rendern immer escapen
- CSV: Semikolon-Auto-Erkennung, UTF-8-BOM beim Export (deutsches Excel), Details in
  `contracts/csv-format.md`

## Befehle

```bash
node --test tests/*.test.js                         # Kernlogik-Tests
python3 -m http.server 8080 --directory docs        # lokal starten
```
