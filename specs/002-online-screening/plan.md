# Implementation Plan: Zweistufiges Screening & Online-Pre-Screening

**Branch**: `main` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)

## Summary

Zwei Bausteine: (1) Jedes Kriterium erhält eine **Phase** (`prescreening` | `qualification`),
sichtbar im Profil-Editor, gruppiert im Lead-Formular, enthalten in Export/Import und Vorlagen.
(2) Eine neue **Screening-Ansicht** ruft die Claude API (Modell `claude-opus-5`) mit
server-seitiger Websuche direkt aus dem Browser auf, recherchiert Unternehmen passend zu den
Pre-Screening-Kriterien (Region, Anzahl, Hinweise konfigurierbar) und liefert Kandidaten mit
Rohwerten + Quellen-URLs als validiertes JSON (Structured Outputs). Kandidaten werden mit der
bestehenden Engine bewertet, geprüft und selektiv als Leads übernommen. API-Schlüssel bleibt
lokal (localStorage), nur Pre-Screening-Kriterien werden übertragen.

## Technical Context

**Language/Version**: unverändert Vanilla JS (ES2022), kein Build, keine Abhängigkeiten

**API**: Claude API `POST https://api.anthropic.com/v1/messages` per `fetch` direkt aus dem
Browser (Header `anthropic-dangerous-direct-browser-access: true`, `anthropic-version:
2023-06-01`, `x-api-key` = Nutzer-Schlüssel). Modell **`claude-opus-5`** (Standard laut
API-Referenz; Thinking implizit adaptiv — kein `thinking`-Parameter, keine Sampling-Parameter).
Websuche als Server-Tool `{type: "web_search_20260209", name: "web_search", max_uses: 40}`.
Kandidatenliste erzwungen über `output_config.format` (json_schema, dynamisch aus den
Pre-Screening-Kriterien erzeugt). `stop_reason "pause_turn"` wird durch Fortsetzungs-Requests
behandelt (max. 6), `refusal`/Fehlercodes werden deutsch gemeldet. Nicht-Streaming,
`max_tokens: 16000`.

**Storage**: API-Schlüssel unter eigenem Key `icp.v1.apikey` (nie in Exporten); Kandidaten
flüchtig (nur im Speicher der Ansicht); Leads erhalten optionale Felder `website` und
`sources` (criterionId → URL)

**Testing**: neue pure Module `docs/js/core/screening.js` (Request-Aufbau, Antwort-Parsing,
Kandidat→Lead) via `node --test`; Netzwerkschicht (`docs/js/screening-api.js`) bleibt dünn
und wird wie `store.js` nicht unit-getestet

**Constraints**: Constitution v2.0.0 — Prinzip III (c): Anfrage enthält ausschließlich
Pre-Screening-Kriterien und Lauf-Parameter (testverankert, SC-004); Prinzip II: API liefert
nur Rohwerte + Quellen, Punkte berechnet weiterhin `evaluate()`; Kernfunktionen offline
unverändert (Screening-Ansicht degradiert mit Hinweis)

**Kosten**: Websuche 10 $/1000 Suchen + Tokens (`claude-opus-5`: 5 $/25 $ pro MTok);
ein Lauf mit 20 Kandidaten ≈ 20–40 Suchen + ~10–20K Tokens ⇒ grob 0,50–1,50 € — Hinweis in
der UI vor dem Start (FR-014)

## Constitution Check (v2.0.0)

| # | Prinzip | Prüfung | Status |
|---|---------|---------|--------|
| I | Generik | Phase ist ein generisches Kriterien-Attribut; Screening nutzt ausschließlich die Profil-Definition, keine Branchen-Logik im Code; Vorlagen bleiben Daten | ✅ |
| II | Nachvollziehbare Scores | KI liefert nur Rohwerte + Quellen (Structured-Output-Schema kennt keine Punkte); Bewertung ausschließlich `evaluate()`; SC-005-Test | ✅ |
| III | Datenhoheit & Offline-Kern | Nur nutzerinitiierter Aufruf; Schlüssel lokal, nie exportiert; Anfrage = Pre-Screening-Kriterien + Parameter (Test); Kern offline unverändert | ✅ |
| IV | Einfachheit | Kein Backend, kein SDK, eine fetch-Schicht; ein Lauf zur Zeit | ✅ |
| V | Testbare Logik | screening.js pure + getestet (Request-Aufbau, Parsing, Mapping); UI/Netz getrennt | ✅ |

**Re-Check nach Design**: unverändert ✅

## Project Structure

```text
specs/002-online-screening/
├── spec.md, plan.md, research.md
├── contracts/screening.md          # Request-/Antwort-Vertrag inkl. JSON-Schema-Regeln
├── checklists/requirements.md
└── tasks.md

Neu/geändert im Code:
docs/js/core/model.js               # Criterion.stage (+ Migration migrateProfile)
docs/js/core/profile-io.js          # Export schemaVersion 2, Import 1+2, stage
docs/js/core/screening.js           # NEU: buildScreeningRequest / parseCandidates / candidateToLead
docs/js/screening-api.js            # NEU: fetch-Schicht (pause_turn-Loop, Fehler-Mapping)
docs/js/store.js                    # apiKey-Verwaltung, Migration beim Lesen
docs/js/templates.js                # Phasen-Voreinstellungen
docs/js/ui/profile-editor.js        # Phasen-Auswahl je Kriterium
docs/js/ui/lead-form.js             # Gruppierung nach Phase, Quellen-Links
docs/js/ui/screening.js             # NEU: Screening-View (Key, Parameter, Lauf, Übernahme)
docs/index.html, docs/sw.js         # Nav + Section, Cache v2
specs/001-icp-lead-scoring/contracts/profile-export.schema.json  # v2 (stage)
tests/screening.test.js             # NEU
tests/{model,profile-io}.test.js    # erweitert (stage, Migration, Roundtrip)
```

**Structure Decision**: Screening-Kernlogik (Request-Aufbau, Schema-Erzeugung, Parsing,
Werte-Zuordnung) liegt DOM- und netzwerkfrei in `docs/js/core/screening.js` und ist damit
vollständig testbar — insbesondere die verfassungskritische Eigenschaft „nur Pre-Screening-
Kriterien in der Anfrage". Die fetch-Schicht ist bewusst minimal.

## Complexity Tracking

> Keine Verletzungen — Online-Zugriff ist durch Constitution v2.0.0 Prinzip III gedeckt.
