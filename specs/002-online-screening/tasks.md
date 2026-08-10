# Tasks: Zweistufiges Screening & Online-Pre-Screening

**Input**: specs/002-online-screening/ (spec.md, plan.md, research.md, contracts/screening.md)

**Tests**: enthalten (Constitution V) — Phasen-Modell, Migration, Request-Aufbau (inkl.
SC-004-Verankerung), Parsing, Kandidat→Lead, Export-Roundtrip v2.

## Phase 1: Foundational — Phasen-Modell (US1)

- [X] T101 [P] [US1] Tests erweitern in `tests/model.test.js`: `stage`-Default `qualification` bei `createCriterion`, Validierung (nur `prescreening|qualification`), `migrateProfile` ergänzt fehlendes `stage`
- [X] T102 [US1] `docs/js/core/model.js`: `STAGES`, `stage`-Feld in `createCriterion`, Validierung, pure `migrateProfile(profile)` (Default-Ergänzung, idempotent)
- [X] T103 [US1] `docs/js/store.js`: `migrateProfile` beim Lesen anwenden (`listProfiles`/`getProfile`); API-Schlüssel-Verwaltung `getApiKey/setApiKey/clearApiKey` (Key `icp.v1.apikey`)
- [X] T104 [P] [US1] Tests erweitern in `tests/profile-io.test.js`: Export trägt `schemaVersion: 2` + `stage` je Kriterium; Import akzeptiert v1 (ohne stage ⇒ `qualification`) und v2; Ablehnung ungültiger stage-Werte
- [X] T105 [US1] `docs/js/core/profile-io.js`: Export v2 mit `stage`; Import v1+v2; `specs/001-icp-lead-scoring/contracts/profile-export.schema.json` auf v2 heben (stage optional, enum)
- [X] T106 [US1] `docs/js/templates.js`: Phasen-Voreinstellungen (firmografisch ⇒ `prescreening`, gesprächsabhängig ⇒ `qualification`) — FR-004
- [X] T107 [US1] `docs/js/ui/profile-editor.js`: Phasen-Auswahl je Kriterium (Select „Pre-Screening (online recherchierbar)" / „Qualifizierung (2. Screening)") inkl. Badge in der Kriterienkarte
- [X] T108 [US1] `docs/js/ui/lead-form.js`: Kriterien-Felder nach Phase gruppiert („Pre-Screening", „Qualifizierung — 2. Screening"); Quellen-Link unter Feldern mit `lead.sources[criterionId]`; Website-Link im Kopf

**Checkpoint**: US1 komplett — Phasen sichtbar, persistent, exportierbar; Tests grün.

## Phase 2: Screening-Kern (US2)

- [X] T109 [P] [US2] Tests NEU `tests/screening.test.js`: Request enthält nur Pre-Screening-Kriterien (Stringify-Probe: kein Qualifizierungs-Name, kein `weight`/`points`, keine Leads — SC-004); Modell/Tool/Schema-Gestalt gemäß Contract; Schema: enum je select, null erlaubt, keine Score-Felder; `parseCandidates` (Quellen-Pflicht, null-Werte, Label-Mapping, Skala außerhalb, entferntes Kriterium); `candidateToLead` + `evaluate` identisch zu manueller Eingabe (SC-005)
- [X] T110 [US2] `docs/js/core/screening.js`: `prescreeningCriteria`, `buildScreeningRequest` (System-Prompt deutsch, Kriterien-Schlüssel k1..kn, dynamisches JSON-Schema), `parseCandidates`, `candidateToLead` — Tests aus T109 grün
- [X] T111 [US2] `docs/js/screening-api.js`: `runScreening(apiKey, body, onStatus)` mit pause_turn-Fortsetzung (max. 6), refusal-Behandlung, deutschem Fehler-Mapping gemäß Contract

## Phase 3: Screening-UI (US2 + US3)

- [X] T112 [US2] `docs/js/ui/screening.js`: Ansicht mit (a) Schlüssel-Verwaltung (maskiert, speichern/löschen, Hinweis Kosten + vertrauenswürdiges Gerät), (b) Lauf-Parametern (Region Default „DACH", Anzahl 5–50 Default 20, Hinweise), (c) Sperre + Erklärung ohne Pre-Screening-Kriterien bzw. ohne aktives Profil, (d) Fortschrittsanzeige, Fehleranzeige
- [X] T113 [US3] Ergebnis-Teil in `docs/js/ui/screening.js`: Kandidaten-Tabelle (Checkbox, Name, Score/Stufe via `evaluate`, belegte/fehlende Kriterien, Quellen-Links, Duplikat-Badge gegen Bestand, Begründung aufklappbar), „Auswahl übernehmen" ⇒ `candidateToLead` + `store.saveLead`, Toast + Link zur Rangliste; Verlassen ohne Übernahme speichert nichts
- [X] T114 [US2] `docs/index.html` + `docs/js/app.js`: Nav-Punkt „Screening", Section, Route `#/screening`; `docs/sw.js`: neue Dateien in ASSETS, Cache-Name `icp-cache-v2`

## Phase 4: Polish

- [X] T115 [P] Regressionslauf `node --test tests/*.test.js` (SC-006) + Syntax-Check aller Module
- [X] T116 [P] README.md + CLAUDE.md um Screening/Phasen ergänzen (inkl. Kosten-/Schlüssel-Hinweis)
- [ ] T117 Manuelle Validierung: Quickstart-Szenarien Feature 001 (Regression) + neue Szenarien US1–US3 mit echtem API-Schlüssel — **Nutzer-Task**
- [X] T118 Commit auf `main`

## Dependencies

T101→T102→T103; T104→T105; T106/T107/T108 nach T102; T109→T110→T111→T112→T113; T114 nach T112; Polish zuletzt. SC-004/SC-005 hängen an T109/T110.
