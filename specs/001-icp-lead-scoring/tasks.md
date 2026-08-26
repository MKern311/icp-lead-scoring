# Tasks: ICP Definition & Lead Scoring

**Input**: Design documents from `/specs/001-icp-lead-scoring/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Enthalten — Constitution-Prinzip V verlangt automatisierte Tests für die gesamte
Core-Logik (scoring, model, csv, profile-io). Test-Tasks stehen vor der jeweiligen
Implementierung (test-first: erst rot, dann grün). UI wird manuell über quickstart.md validiert.

**Organization**: Tasks sind nach User Stories gruppiert; jede Story ist unabhängig testbar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelisierbar (andere Dateien, keine offenen Abhängigkeiten)
- **[Story]**: US1–US4 gemäß spec.md

## Path Conventions

Single-Page-App ohne Build: App-Code unter `docs/` (GitHub-Pages-Root), pure Core-Module
unter `docs/js/core/`, Tests unter `tests/` (Repo-Root) — siehe plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Projektgerüst und statische Hülle

- [X] T001 Verzeichnisstruktur anlegen gemäß plan.md: `docs/css/`, `docs/js/core/`, `docs/js/ui/`, `tests/`; leere `.gitignore` mit macOS-/Editor-Artefakten (`.DS_Store`, `*.swp`) im Repo-Root
- [X] T002 [P] App-Hülle in `docs/index.html`: deutsches `<html lang="de">`-Grundgerüst, Kopfzeile mit Navigation (Profile, Leads, Import), je eine `<section>` pro View (profile-list, profile-editor, lead-form, lead-list, import-wizard), `<script type="module" src="js/app.js">`
- [X] T003 [P] Basis-Styles: `docs/css/base.css` (Reset, CSS-Custom-Properties für Farben/Abstände, Typografie), `docs/css/layout.css` (Kopfzeile, Navigation, Seitenraster, responsive Breakpoints), `docs/css/components.css` (Buttons, Formulare, Tabellen, Badges, Dialog, Toast)

**Checkpoint**: `python3 -m http.server 8080 --directory docs` zeigt die leere Hülle mit Navigation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entitäten, Persistenz und App-Wiring, auf denen alle Stories aufbauen

**⚠️ CRITICAL**: Keine User-Story-Arbeit vor Abschluss dieser Phase

- [X] T004 [P] Modell-Tests in `tests/model.test.js`: Factory-Defaults; Validierungen aus data-model.md (Name-Pflicht, 1–50 Kriterien, Gewichtssumme-≠-100-Warnung als Warnobjekt, Bereichs-Überlappung als Fehler, Stufen: 2–10, paarweise verschiedene minScore, Pflicht-Auffangstufe minScore = 0, scale max−min ≥ 1)
- [X] T005 Entity-Factories und Validierung in `docs/js/core/model.js`: `createProfile/createCriterion/createTier/createLead` (crypto.randomUUID), `validateProfile(profile) → { errors[], warnings[] }` gemäß data-model.md; pure, DOM-frei — Tests aus T004 grün
- [X] T006 Persistenzschicht in `docs/js/store.js`: Namespace `icp.v1.*` gemäß data-model.md (Storage-Layout), CRUD für Profile und Leads (`listProfiles/saveProfile/deleteProfile/duplicateProfile`, `listLeads/saveLead/deleteLead`), `settings.activeProfileId`, setzt `createdAt/updatedAt`; einzige Stelle mit localStorage-Zugriff
- [X] T007 App-Wiring in `docs/js/app.js`: Hash-Routing (`#/profile`, `#/profil/:id`, `#/leads`, `#/lead/:id`, `#/import`), View-Umschaltung, zentrale `esc()`-Escaping-Hilfe, Toast- und Bestätigungsdialog-Helfer; Views registrieren sich als Module mit `render(container, params)`

**Checkpoint**: `node --test tests/` grün (model); Navigation wechselt zwischen leeren Views.

---

## Phase 3: User Story 1 - ICP-Profil mit eigenen Kriterien definieren (Priority: P1) 🎯 MVP

**Goal**: Profile mit frei definierbaren Kriterien (4 Typen), Gewichten, Punktregeln,
K.o.-Markierung und Stufen anlegen, bearbeiten, duplizieren, löschen — dauerhaft gespeichert.

**Independent Test**: Quickstart-Szenario V1 — Profil mit 5 Kriterien anlegen, Browser neu
öffnen, Profil unverändert; Gewichtssummen-Hinweis erscheint.

### Implementation for User Story 1

- [X] T008 [US1] Profil-Übersicht in `docs/js/ui/profile-list.js`: Liste aller Profile (Name, Beschreibung, Anzahl Kriterien/Leads), Aktionen Neu/Duplizieren („ (Kopie)", neue IDs)/Löschen (Bestätigungsdialog mit Warnung auf zugehörige Leads; Leads bleiben erhalten und erscheinen in Rubrik „Leads ohne Profil" mit Aktionen Löschen/Neuzuordnen gemäß data-model.md, FR-001, Edge Case Profil-Löschung), Auswahl als aktives Profil
- [X] T009 [US1] Profil-Editor Grunddaten + Kriterienliste in `docs/js/ui/profile-editor.js`: Name/Beschreibung/missingValuePolicy bearbeiten; Kriterien anlegen/bearbeiten/löschen/umsortieren mit Typwahl (select/range/boolean/scale), Gewicht (0–100) und K.o.-Checkbox (FR-002, FR-004)
- [X] T010 [US1] Punktregel-Editoren je Kriterientyp in `docs/js/ui/profile-editor.js`: select (Optionen + Punkte 0–100), range (Bereiche min/max/Punkte, Überlappungsfehler anzeigen), boolean (Punkte Ja/Nein), scale (min/max, Hinweis auf lineare Abbildung) — Regeln gemäß data-model.md (FR-003)
- [X] T011 [US1] Stufen-Editor in `docs/js/ui/profile-editor.js`: Stufen mit Label + minScore, absteigende Sortierung in der Anzeige, Pflicht-Auffangstufe erzwingen (FR-006)
- [X] T012 [US1] Gewichtssummen-Hinweis und Normalisierungsangebot im Profil-Editor: laufende Summenanzeige, Warnung bei ≠ 100 mit Aktion „Auf 100 normieren" (proportional, auf 1 Dezimalstelle), Speichern trotzdem möglich (FR-015, US1-Szenario 3)
- [X] T013 [US1] Validierungs- und Speicher-Wiring: `validateProfile` vor dem Speichern, Fehler blockieren mit Feldbezug, Warnungen als Hinweis; Persistenz über `store.js`; nach Speichern Toast + Rücksprung zur Profil-Übersicht

**Checkpoint**: US1 komplett — Quickstart V1 besteht; MVP demonstrierbar.

---

## Phase 4: User Story 2 - Einzelnen Lead erfassen und bewerten (Priority: P2)

**Goal**: Lead manuell erfassen; sofortige, vollständig aufgeschlüsselte Bewertung
(Score 0–100, Stufe, Disqualifikation, Unvollständigkeit).

**Independent Test**: Quickstart-Szenario V2 — Lead erfassen, Ergebnis + Breakdown live;
K.o.-Verletzung disqualifiziert; fehlender Wert kennzeichnet „unvollständig".

### Tests for User Story 2

- [X] T014 [P] [US2] Scoring-Tests in `tests/scoring.test.js`: Referenzfälle L1–L6 aus contracts/scoring-engine.md 1:1; zusätzlich Stufengrenze 74/75 → B/A (US2-Szenario 2), Policy `zero` vs. `neutral`, Gewichtsnormierung bei Summe ≠ 100, outOfRange ⇒ 0 Punkte + Flag, unbekannte select-Option ⇒ invalidValue/fehlend, Rundung `round1` nur am Gesamtwert, Σ contribution = total_raw

### Implementation for User Story 2

- [X] T015 [US2] Scoring-Engine in `docs/js/core/scoring.js`: `evaluate(profile, lead)` und `evaluateAll(profile, leads)` exakt nach contracts/scoring-engine.md (Punktermittlung je Typ, Normierung, Missing-Policies, K.o.-Regeln, Stufenzuordnung, Breakdown); pure, wirft nie — Tests aus T014 grün (FR-005)
- [X] T016 [US2] Lead-Formular in `docs/js/ui/lead-form.js`: dynamische Eingabefelder aus den Kriterien des aktiven Profils (select → Dropdown, range/scale → Zahlenfeld mit Grenzen, boolean → Ja/Nein), Basisdaten Name/Notiz (FR-007); Live-Bewertung bei jeder Eingabe (US2-Szenario 4)
- [X] T017 [US2] Ergebnis-Panel in `docs/js/ui/lead-form.js`: Gesamtscore (1 Dezimalstelle), Stufen-Badge, Status-Badges „disqualifiziert"/„nicht bewertbar"/„unvollständig" inkl. Ausweis des Umgangs mit fehlenden Werten, Breakdown-Tabelle (Rohwert, Punkte, Gewichtsanteil, Beitrag, Flags) (FR-005, FR-010, SC-004)
- [X] T018 [US2] Lead-Persistenz und Neuberechnung: Speichern/Bearbeiten/Löschen über `store.js`; bei Profiländerung Hinweis-Toast „Bewertungen neu berechnet" beim nächsten Öffnen der Lead-Ansichten (FR-011; Bewertungen werden nie gespeichert)

**Checkpoint**: US1 + US2 unabhängig funktionsfähig — Kern-Nutzen des Tools steht.

---

## Phase 5: User Story 3 - Viele Leads importieren, vergleichen und priorisieren (Priority: P3)

**Goal**: CSV-Import mit Spaltenzuordnung und Fehlerbericht; sortier-/filterbare Rangliste;
Ergebnis-Export für Excel (DE).

**Independent Test**: Quickstart-Szenario V3 — 20-Zeilen-CSV (Semikolon, Umlaute, 1 kaputte
Zeile) importieren, Rangliste sortieren/filtern, Export in Excel öffnen.

### Tests for User Story 3

- [X] T019 [P] [US3] CSV-Tests in `tests/csv.test.js`: Delimiter-Auto-Erkennung (`;` vor `,`, Gleichstand ⇒ `;`), Anführungszeichen mit eingebetteten Delimitern/Umbrüchen/`""`, BOM-Toleranz beim Lesen, `\r\n` und `\n`, leere Zeilen übersprungen, abweichende Spaltenanzahl ⇒ Zeilenfehler, Dezimal-Komma und -Punkt, boolean-Synonyme (ja/yes/true/1/x …); Serializer: BOM vorhanden, `;`-Delimiter, `\r\n`, alle Felder gequotet, `"` als `""` (contracts/csv-format.md)

### Implementation for User Story 3

- [X] T020 [US3] CSV-Parser/-Serializer in `docs/js/core/csv.js`: `parse(text) → { header, rows, errors }` und `serialize(header, rows) → string` exakt nach contracts/csv-format.md; pure — Tests aus T019 grün
- [X] T021 [US3] Import-Assistent in `docs/js/ui/import-wizard.js`: Dateiauswahl, Vorschau (erste 5 Zeilen), Spaltenzuordnung mit Vorbelegung bei Namensgleichheit (Pflicht: Lead-Name; optional: Notiz; Rest: Kriterium oder ignorieren), Wertkonvertierung je Typ, Duplikat-Meldung (Datei-intern und gegen Bestand), Fehlerbericht `{ zeile, spalte, grund }`, Import der gültigen Zeilen mit `source: "csv"` (FR-008, US3-Szenario 3)
- [X] T022 [US3] Rangliste in `docs/js/ui/lead-list.js`: alle Leads des aktiven Profils via `evaluateAll` bewertet, Standard-Sortierung Score absteigend, umschaltbare Sortierung (Name, Score), Filter nach Stufe und Status (inkl. disqualifiziert/unvollständig), Zeilenklick öffnet Lead-Formular; Zähler „n Leads, davon m unvollständig" (FR-009)
- [X] T023 [US3] Ergebnis-Export in `docs/js/ui/lead-list.js`: Download `leads-bewertet-<profil-slug>-JJJJ-MM-TT.csv` mit Spalten gemäß contracts/csv-format.md (Rohwerte, Punktzahl mit Dezimal-Komma, Stufe, Status, Vollständig) über `csv.serialize` (US3-Szenario 4)

**Checkpoint**: Alle Prioritäts-Kernstories (P1–P3) unabhängig lauffähig.

---

## Phase 6: User Story 4 - Profile weitergeben und Vorlagen nutzen (Priority: P4)

**Goal**: Profil-Export/-Import als JSON-Datei (identische Bewertungslogik überall) und zwei
mitgelieferte, frei anpassbare Beispiel-Vorlagen.

**Independent Test**: Quickstart-Szenario V4 — Export → Import in anderem Browser-Profil ⇒
identische Scores; Vorlage laden, anpassen, Original bleibt unberührt.

### Tests for User Story 4

- [X] T024 [P] [US4] Profil-IO-Tests in `tests/profile-io.test.js`: Export-Objekt entspricht contracts/profile-export.schema.json (format/schemaVersion/Pflichtfelder, keine IDs/Leads im Export); Import: Roundtrip Export→Import ⇒ `evaluate` liefert identische Ergebnisse für Referenz-Leads (SC-005); Ablehnung mit verständlicher Fehlermeldung bei falschem `format`, fehlenden Pflichtfeldern, unbekanntem Kriterientyp, Punkten außerhalb 0–100

### Implementation for User Story 4

- [X] T025 [US4] Profil-Export/-Import in `docs/js/core/profile-io.js`: `exportProfile(profile) → object` (ohne IDs, mit `format`/`schemaVersion`/`exportedAt`), `importProfile(object) → { profile, errors }` mit handgeschriebener Schema-Prüfung gemäß contracts/profile-export.schema.json und Vergabe neuer IDs; pure — Tests aus T024 grün (FR-012)
- [X] T026 [US4] Export/Import-UI in `docs/js/ui/profile-list.js`: „Exportieren" lädt `icp-profil-<slug>-v1.json` herunter; „Importieren" mit Dateiauswahl, Fehleranzeige bei Ablehnung, Namenskollision ⇒ Suffix „(2)" (FR-012)
- [X] T027 [P] [US4] Zwei Beispiel-Vorlagen als reine Datenobjekte in `docs/js/templates.js` (inhaltlich verschieden: „B2B-Dienstleistung" und „SaaS-Produkt", je ≥ 5 Kriterien mit allen 4 Typen, K.o.-Kriterium, Stufen) + „Aus Vorlage erstellen"-Aktion in `docs/js/ui/profile-list.js` (Kopie mit neuen IDs, frei editierbar) (FR-013, SC-006, Constitution I: Vorlagen sind Daten, kein Code)

**Checkpoint**: Alle vier User Stories unabhängig funktionsfähig.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Offline-Fähigkeit, Robustheit, Validierung, Dokumentation, Deployment

- [X] T028 Service Worker `docs/sw.js` (cache-first, versionierter Cache-Name `icp-cache-v1`, Cleanup alter Caches bei `activate`) + Registrierung und Update-Hinweis-Toast in `docs/js/app.js` (Spec-Annahme „offline nach erstem Laden", Constitution III)
- [X] T029 [P] Responsive- und A11y-Durchgang über alle Views: Labels an allen Formularfeldern, Tastatur-Bedienbarkeit der Dialoge, Fokus-Stile, Kontraste, Tabellen scrollbar auf schmalen Screens (`docs/css/*.css`, `docs/index.html`)
- [X] T030 [P] Performance-Nachweis: synthetisches 5 000-Leads-Fixture in `tests/scoring.test.js` — `evaluateAll` + Sortierung < 1 s (Plan-Performance-Ziel, Spec-Annahme Datenvolumen)
- [X] T031 [P] `README.md` im Repo-Root: Kurzbeschreibung, Nutzung (URL), lokaler Start, Tests, Verweis auf specs/ und Constitution
- [ ] T032 Manuelle End-to-End-Validierung aller Quickstart-Szenarien V1–V5 durchführen und Ergebnis (bestanden/Abweichungen) in specs/001-icp-lead-scoring/quickstart.md als Abschnitt „Validierungsprotokoll" dokumentieren
- [x] T033 Deployment auf GitHub Pages — erledigt 2026-08-26: https://mkern311.github.io/icp-lead-scoring/ (öffentliches Repo MKern311/icp-lead-scoring, Pages aus `docs/` auf `main`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: keine — sofort startbar
- **Foundational (Phase 2)**: braucht Phase 1; **blockiert alle Stories**
- **US1 (Phase 3)**: braucht Phase 2 — keine Abhängigkeit von anderen Stories
- **US2 (Phase 4)**: braucht Phase 2; nutzt zur Demonstration ein Profil aus US1 (fachlich), technisch nur von model/store abhängig
- **US3 (Phase 5)**: braucht Phase 2; Rangliste nutzt `evaluateAll` aus T015 (US2)
- **US4 (Phase 6)**: braucht Phase 2; Roundtrip-Test nutzt `evaluate` aus T015 (US2)
- **Polish (Phase 7)**: nach Abschluss der gewünschten Stories

### Within Each User Story

- Test-Task ([P], rot) vor Implementierung des Core-Moduls (grün)
- Core-Modul vor UI-Task, UI vor Persistenz-/Integrations-Wiring

### Parallel Opportunities

- T002 ∥ T003 (Setup); T004 parallel zu T002/T003 vorbereitbar
- Nach Phase 2: T008 ∥ T014 ∥ T019 ∥ T024 ∥ T027 (verschiedene Dateien)
- US2–US4-Testdateien (T014, T019, T024) jederzeit parallel schreibbar
- T029 ∥ T030 ∥ T031 im Polish

## Parallel Example: nach Abschluss von Phase 2

```bash
# Unabhängige Startpunkte gleichzeitig:
Task: "T008 Profil-Übersicht in docs/js/ui/profile-list.js"      # US1-UI
Task: "T014 Scoring-Tests in tests/scoring.test.js"              # US2-Tests (rot)
Task: "T019 CSV-Tests in tests/csv.test.js"                      # US3-Tests (rot)
Task: "T024 Profil-IO-Tests in tests/profile-io.test.js"         # US4-Tests (rot)
Task: "T027 Beispiel-Vorlagen in docs/js/templates.js"           # US4-Daten
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 abschließen (Gerüst, Modell, Store, Routing)
2. Phase 3 (US1): Profil-Definition komplett
3. **STOP & VALIDATE**: Quickstart V1 — Profil anlegen, neu laden, Hinweis bei Gewichtssumme
4. Danach inkrementell US2 → US3 → US4, nach jeder Story Quickstart-Szenario prüfen

### Incremental Delivery

Jede Story liefert eigenständigen Mehrwert: US1 = ICP strukturiert erfassen (bereits nützlich
als Denk-Werkzeug), US2 = Einzelbewertung (Kern-Nutzen), US3 = Priorisierung von Listen,
US4 = Weitergabe/Generik erlebbar. Deployment (T033) ist nach jeder Story möglich.

## Notes

- Bewertungen werden nie persistiert — `evaluate` ist die einzige Quelle (Constitution II)
- Nur `store.js` berührt localStorage; nur `docs/js/core/*` wird von Tests importiert
- Nach jeder Task bzw. logischen Gruppe committen (kleine Schritte auf `main`)
- Nutzereingaben beim Rendern immer über `esc()` führen (T007)
