# Tasks: Geführter Screening-Workflow

**Input**: specs/003-guided-workflow/ (spec.md, plan.md, research.md, data-model.md,
contracts/workflow.md, quickstart.md)

**Tests**: enthalten (Constitution V) — searchHint-Validierung/-Roundtrip, erweiterte
Request-Serialisierung inkl. SC-004-Anker, Warteschlangen-Logik.

## Phase 1: Setup

Kein Setup nötig — bestehende Projektstruktur, keine Abhängigkeiten.

## Phase 2: Foundational — searchHint & Warteschlange (pure Logik)

- [X] T201 [P] Tests erweitern in `tests/model.test.js`: `searchHint` Default `''` bei `createCriterion`, Validierung (String, getrimmt, ≤ 200 Zeichen, andere Typen abgelehnt), `migrateProfile` ergänzt fehlendes `searchHint` idempotent
- [X] T202 Tests erweitern in `tests/screening.test.js`: (a) Request enthält `Suchhinweis: <text>` je Pre-Screening-Kriterium mit nicht-leerem Hint, (b) SC-004-Anker erweitert — `searchHint` eines Qualifizierungskriteriums erscheint nie im serialisierten Request, (c) NEU `qualificationQueue(profile, leads)`: nur `source === 'screening'`, nur Leads mit mindestens einem offenen Qualifizierungskriterium, Bestandsreihenfolge, leere/fremde Eingaben werfen nie
- [X] T203 [P] Tests erweitern in `tests/profile-io.test.js`: Export enthält `searchHint` (nur wenn nicht leer), Import v2 ohne `searchHint` ⇒ `''`, Nicht-String ⇒ Fehlermeldung, Roundtrip erhält den Hint
- [X] T204 `docs/js/core/model.js`: `searchHint`-Feld in `createCriterion` (Default `''`), Validierung, `migrateProfile`-Ergänzung — Tests aus T201 grün
- [X] T205 `docs/js/core/screening.js`: `buildScreeningRequest` hängt Suchhinweis-Zeile an Kriterienzeilen an (nur Pre-Screening, nur nicht-leer); NEU pure `qualificationQueue(profile, leads)` — Tests aus T202 grün
- [X] T206 `docs/js/core/profile-io.js`: Export/Import `searchHint` (schemaVersion bleibt 2); `specs/001-icp-lead-scoring/contracts/profile-export.schema.json` um optionales `searchHint` ergänzen — Tests aus T203 grün
- [X] T207 [P] `specs/002-online-screening/contracts/screening.md`: Suchhinweis-Regel ergänzen (Serialisierung nur für Pre-Screening-Kriterien, erweiterter SC-004-Anker) — Contract-Änderung vor Implementierungsabschluss dokumentiert

**Checkpoint**: Pure Logik komplett und getestet; noch keine UI-Änderung sichtbar.

## Phase 3: User Story 1 — Schritt 1: Phasen-Zuordnung mit Pflicht-Bestätigung (P1)

**Goal**: Geführte Liste aller Kriterien mit aktiver Bestätigung, Suchhinweise je
Pre-Screening-Kriterium, Suchparameter; Speicherung identisch zum Profil-Editor.

**Independent Test**: Quickstart V1 + V2 — Workflow starten, Zuordnungen bestätigen,
Hinweise erfassen, Parität im Profil-Editor und Export prüfen; ohne Screening-Lauf.

- [X] T208 [US1] `docs/js/ui/workflow.js` NEU: Grundgerüst mit Schrittanzeige (1 · 2 · 3), Modul-Zustand (`step`, `confirmed`, `queue`, `position`, `skipped` gemäß data-model.md), Leerzustand ohne aktives Profil (Verweis auf Profil-Anlage), Wiedereinstiegs-Angebot bei nicht-leerer `qualificationQueue` (W1)
- [X] T209 [US1] Schritt-1-Renderer in `docs/js/ui/workflow.js`: Kriterienliste mit Name, Beschreibung, Phasen-Wahl (aktuelle Phase als Vorschlag), Bestätigen-Interaktion je Kriterium, „Weiter" gesperrt bis alle bestätigt und ≥ 1 Pre-Screening-Kriterium (W2); Suchhinweis-Feld nur bei Pre-Screening (≤ 200 Zeichen), sofortiges Speichern via `store.saveProfile`; danach Suchparameter-Teil (Region/Anzahl/globale Hinweise, Vorbelegung wie bisher)
- [X] T210 [US1] `docs/js/ui/profile-editor.js`: Suchhinweis-Eingabe je Kriterium bei Phase „Pre-Screening" (Parität zu Schritt 1, FR-002/Verfassung I); Wert bleibt bei Phasenwechsel erhalten
- [X] T211 [US1] `docs/js/app.js`: Route `#/screening` auf `ui/workflow.js` umstellen; `docs/index.html`: Section bleibt `view-screening`, Nav-Label bleibt „Screening"

**Checkpoint**: US1 unabhängig testbar (V1/V2) — Schritt 2/3 noch als Platzhalter zulässig.

## Phase 4: User Story 2 — Schritt 2: Online-Screening im Workflow (P2)

**Goal**: Lauf mit bestätigten Kriterien und Hinweisen direkt im Workflow; Übernahme
füllt die Schritt-3-Warteschlange.

**Independent Test**: Quickstart V3 + V4 (bis zur Übernahme) — Gates ohne
Pre-Screening-Kriterien/Schlüssel, Lauf, Kandidatentabelle, Übernahme.

- [X] T212 [US2] Schritt-2-Renderer in `docs/js/ui/workflow.js`: Schlüssel-Verwaltung, Lauf-Start, Fortschritt, Fehlerbilder und Ergebnistabelle aus `ui/screening.js` übernehmen (Checkbox-Auswahl, Score/Stufe via `evaluate`, Duplikat-Badge, Quellen-Links, Warnungen); Gates gemäß W1 (Schlüssel an Ort und Stelle nachtragbar, Rücksprung zu Schritt 1)
- [X] T213 [US2] Übernahme in `docs/js/ui/workflow.js`: `candidateToLead` + `store.saveLead`, gespeicherte Lead-IDs als Warteschlange merken, automatischer Übergang zu Schritt 3; bei 0 Übernahmen Verbleib in Schritt 2 mit Wiederholungs-Angebot (W3)
- [X] T214 [US2] `docs/js/ui/screening.js` entfernen; `docs/sw.js`: ASSETS `js/ui/workflow.js` statt `js/ui/screening.js`, Cache-Name `icp-cache-v3`

**Checkpoint**: US2 testbar (V3/V4 bis Übernahme); Einzelansichten unverändert.

## Phase 5: User Story 3 — Schritt 3: Geführte Qualifizierung (P3)

**Goal**: Lead-für-Lead-Qualifizierung mit Live-Bewertung und Abschluss-Zusammenfassung.

**Independent Test**: Quickstart V4 (ab Übernahme) + V5 — Warteschlange, nur
Qualifizierungsfelder editierbar, Zusammenfassung, Wiedereinstieg.

- [X] T215 [US3] Schritt-3-Renderer in `docs/js/ui/workflow.js`: Kopf („Lead n von m", Name, Website-Link), Pre-Screening-Werte nur lesend mit Quell-Links, Eingabefelder nur für Qualifizierungskriterien, Live-Panel via `evaluate` (Status/Score/Stufe, K.o. sofort sichtbar) — W4
- [X] T216 [US3] Navigation in Schritt 3: „Speichern & weiter" (`store.saveLead`), „Überspringen", „Zurück"; Zusammenfassung nach letztem Lead (bearbeitet/übersprungen, Stufen-Verteilung, Link zur Rangliste)
- [X] T217 [US3] Wiedereinstieg verdrahten: Angebot aus T208 führt mit `qualificationQueue(profile, leads)` direkt in Schritt 3 (FR-011)

**Checkpoint**: Alle drei User Stories erfüllt; SC-001-Pfad durchgehend.

## Phase 6: Polish

- [X] T218 [P] `docs/js/templates.js`: beispielhafte `searchHint`-Werte für die Pre-Screening-Kriterien beider Vorlagen (Daten, kein Code — Verfassung I)
- [X] T219 [P] Regressionslauf `node --test tests/*.test.js` (SC-006) + Syntax-Check aller geänderten Module + Smoke-Check der ausgelieferten Dateien
- [X] T220 [P] README.md + CLAUDE.md aktualisieren (Workflow ersetzt Screening-Ansicht, Suchhinweise, Cache v3)
- [ ] T221 Manuelle Validierung: Quickstart V1–V5 im Browser (V4 mit echtem API-Schlüssel) — **Nutzer-Task**
- [X] T222 Commit auf `main` (91f57de)

## Phase 7: Erweiterung — Kriterien-Katalog & Gruppierung (FR-014/FR-015, Session 2026-08-11)

- [X] T223 [P] Tests NEU `tests/catalog.test.js`: jeder Katalog-Eintrag ⇒ `criterionFromCatalog` ⇒ valides Kriterium (`validateProfile` fehlerfrei), `stage === 'prescreening'`, Suchhinweis nicht leer, Options-IDs neu; Katalog-Namen eindeutig; Katalog-Profil serialisiert vollständig als Pre-Screening
- [X] T224 `docs/js/core/model.js`: pure `criterionFromCatalog(entry)` (neue IDs, Phase prescreening, Regeln kopiert) — Tests aus T223 grün
- [X] T225 [P] `docs/js/templates.js`: `criterionCatalog` (8 online recherchierbare Kriterienarten als Daten: Branche, Mitarbeiterzahl, Region, Umsatzklasse, Firmenalter, Wachstumssignale, Digitalisierungs-/KI-Reife, Online-Sichtbarkeit)
- [X] T226 `docs/js/ui/workflow.js`: Schritt 1 gruppiert — erst Pre-Screening-Kriterien, dann Katalog-Vorschläge (Übernahme per Klick, Duplikat-Namen ausgeblendet), dann Qualifizierungskriterien; Phasenwechsel verschiebt zwischen Gruppen
- [X] T227 [P] `docs/sw.js` Cache `icp-cache-v4`; README.md + CLAUDE.md um Katalog ergänzen
- [X] T228 Regressionslauf + Syntax-/Smoke-Check + Commit auf `main`

## Dependencies

- Phase 2 vor allem anderen: T201→T204, T202→T205, T203→T206; T207 parallel dazu
- US1: T208→T209→T211; T210 nach T204, parallel zu T209
- US2: T212→T213→T214; benötigt T208 (Gerüst) und T205 (Hinweis-Serialisierung)
- US3: T215→T216→T217; benötigt T213 (Warteschlange) und T205 (`qualificationQueue`)
- Polish zuletzt; T221 nach T219/T220

## Parallel Execution Examples

- T201 + T203 + T207 (verschiedene Dateien, keine Abhängigkeit)
- T210 (profile-editor) parallel zu T209 (workflow Schritt 1)
- T218 + T219 + T220 im Polish

## Implementation Strategy

MVP = Phase 2 + US1 (T201–T211): geführte Phasen-Zuordnung mit Suchhinweisen ist
allein lauffähig und wertstiftend (V1/V2), noch mit bestehender Screening-Ansicht als
Schritt-2-Platzhalter. Danach US2 (Lauf im Workflow, Ablösung `ui/screening.js`),
dann US3 (Qualifizierung), zuletzt Polish + manuelle Validierung.
