# Tasks: Granulares Zweiphasen-Screening

**Input**: specs/004-deep-screening/ (spec.md, plan.md, contracts/deep-screening.md)

## Phase 1: Contracts & Spezifikation

- [X] T401 specs/004 (spec, plan, contracts/deep-screening.md, tasks)
- [X] T402 [P] Contracts 002 (API-Liste Longlist/Deep statt buildScreeningRequest, Verweis auf 004) und 003 (W1/W3: 4 Schritte, „Deep nie für gespeicherte Leads") aktualisieren

## Phase 2: Core (testgetrieben)

- [X] T403 Tests `tests/screening.test.js` umbauen/erweitern: Longlist (nur selects, `Erforderlich:`-Filterzeile, wirft ohne selects, max_uses 25, SC-401), Deep (Name/Website/alle Pre-Kriterien, Schema confidence/evidenceDate, SC-402 inkl. Fremdfeld-Probe), `parseDeepResult` (Quellenpflicht, enum-/Datums-Validierung, found:false, null-Werte), `mergeDeepIntoCandidate`, `candidateToLead`-Maps, SC-404 (`evaluate` identisch mit/ohne Konfidenz), `estimateDeepCost`
- [X] T404 `docs/js/core/screening.js`: Refaktorierung (criterionLine/buildOutputSchema/mapValues), `longlistCriteria`, `buildLonglistRequest`, `buildDeepScreeningRequest`, `parseDeepResult`, `mergeDeepIntoCandidate`, `estimateDeepCost`, `COST_ESTIMATES`; `candidateToLead` erweitert; `buildScreeningRequest` entfernt — alle Tests grün

## Phase 3: Katalog

- [X] T405 Tests `tests/catalog.test.js`: Kategorien aus fester Menge, `evidence` nicht leer, Wachstums-Signale nennen Belegzeitraum oder „aktuell", Selects 2–20 Optionen ohne Freitext-Hint, evidence-Anhang validiert (≤ 500)
- [X] T406 `docs/js/templates.js`: Katalog → ~23 kategorisierte Einträge (Firmografie 7, Wachstum & Dynamik 8, Digitale Präsenz 5, Markt & Netzwerk 3); `docs/js/core/model.js`: `criterionFromCatalog` hängt `evidence` an description an

## Phase 4: UI

- [X] T407 `docs/js/screening-api.js`: `runScreening(..., { signal })`, AbortError → `error.aborted` + deutsche Meldung
- [X] T408 `docs/js/ui/workflow.js`: 4-stufige Schrittanzeige; Schritt 1 Katalog nach Kategorien gruppiert; Schritt 2 Longlist (Filter sichtbar, Kostenschätzung, zwei Fortsetzungen); Schritt 3 NEU Deep (Firmenliste mit Status, Start/Abbruch/Fortsetzen/Retry, manuelle Firmen-Eingabe, Kosten-/Zeitschätzung + Warnung ab 15, Ergebnis-Karten mit Konfidenz-Badges/Belegdatum/Quellen, Übernahme); Schritt 4 = bisherige Qualifizierung; Resume → Schritt 4
- [X] T409 [P] `docs/js/ui/lead-form.js`: Konfidenz-Badge + „Stand JJJJ-MM" neben Quell-Link; `docs/css/components.css`: Badges/Deep-Status; `docs/sw.js`: Cache v6

## Phase 5: Polish

- [X] T410 [P] README.md, CLAUDE.md, Memory aktualisieren
- [X] T411 Regression `node --test tests/*.test.js` + Syntax-/Smoke-Check
- [X] T412 Commit auf `main`
- [ ] T413 Manuelle Validierung mit echtem Schlüssel (Longlist → Deep 3–5 Firmen → manuelle Firma → Übernahme → Qualifizierung) — **Nutzer-Task**
