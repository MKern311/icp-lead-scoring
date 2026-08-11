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
- Feature 003: `specs/003-guided-workflow/` (geführter Workflow auf `#/screening`,
  Suchpräferenzen je Kriterium; Regeln in `contracts/workflow.md`)
- Feature 004: `specs/004-deep-screening/` (Zweiphasen-Screening: Longlist über
  Klassen-Filter + Tiefen-Screening je Unternehmen mit Konfidenz/Belegdatum;
  Regeln fixiert in `contracts/deep-screening.md`)

## Stack & Regeln

- Vanilla JavaScript (ES2022, ES-Module), HTML5, CSS3 — **kein** Framework, **kein**
  Build-Schritt, **keine** Abhängigkeiten (auch keine Dev-Dependencies)
- `docs/` = GitHub-Pages-Root (deploybar wie er ist); `docs/js/core/` = pure, DOM-freie
  Module (scoring, model, csv, profile-io) — nur diese werden getestet
- Persistenz ausschließlich über `docs/js/store.js` (localStorage, Namespace `icp.v1.*`);
  Bewertungen werden nie gespeichert, immer via `evaluate(profile, lead)` berechnet
- Screening: Kriterien haben `stage` (`prescreening` = online recherchierbar,
  `qualification` = 2. Screening; Default qualification), `searchTargets` (bevorzugte
  Options-IDs bei Auswahl-Kriterien, per Klick — Longlist nutzt sie als harte
  „Erforderlich:"-Filter), optional `searchHint` (Freitext ≤ 200 Zeichen; UI bei range
  und bei Kriterien mit `hintLabel`) und optional `hintLabel` (≤ 80 Zeichen,
  beschriftet das Freitextfeld und ersetzt im Request das Präfix „Suchhinweis:" —
  z. B. Stellenanzeigen-Rollen); alles nur für Pre-Screening serialisiert. Katalog-
  Klassen folgen EU-Standards (NACE Rev. 2 Abschnitte, EU-KMU-Definition 2003/361/EG),
  Wachstumssignale sind 5 Einzelkriterien mit Belegzeitraum 12 Monate. `core/screening.js` ist
  pure und darf nur Pre-Screening-Kriterien serialisieren (testverankert, SC-004); die KI
  liefert nur Rohwerte + Quellen, nie Punkte. API-Schlüssel unter `icp.v1.apikey`, nie
  exportieren. Die Route `#/screening` rendert den geführten Workflow (`ui/workflow.js`,
  4 Schritte: Kriterien → Longlist → Tiefen-Screening → Qualifizierung). Longlist nutzt
  nur select-Kriterien (`longlistCriteria`, Targets = harte Filter); Deep recherchiert
  je Unternehmen (`buildDeepScreeningRequest`, Konfidenz `direct|inferred` +
  Belegdatum `JJJJ-MM` je Wert, Quellenpflicht in `parseDeepResult`) — nie für
  gespeicherte Leads. `qualificationQueue` bestimmt offene Screening-Leads für
  Schritt 4. Katalog: `criterionCatalog` (`templates.js`, kategorisierte reine Daten)
  per `criterionFromCatalog` übernehmen.
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
