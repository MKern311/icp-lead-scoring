# icp-lead-scoring — Agent Context

Generisches ICP-Definitions- und Lead-Scoring-Tool. Statische Web-App ohne Backend.

## Verbindliche Artefakte (Quelle der Wahrheit)

- Verfassung: `.specify/memory/constitution.md` (v1.0.0 — Generik, nachvollziehbare Scores,
  lokale Datenhoheit, Einfachheit, testbare Scoring-Logik)
- Spec/Plan/Tasks: `specs/001-icp-lead-scoring/` (spec.md, plan.md, data-model.md,
  contracts/, quickstart.md, tasks.md)

## Stack & Regeln

- Vanilla JavaScript (ES2022, ES-Module), HTML5, CSS3 — **kein** Framework, **kein**
  Build-Schritt, **keine** Abhängigkeiten (auch keine Dev-Dependencies)
- `docs/` = GitHub-Pages-Root (deploybar wie er ist); `docs/js/core/` = pure, DOM-freie
  Module (scoring, model, csv, profile-io) — nur diese werden getestet
- Persistenz ausschließlich über `docs/js/store.js` (localStorage, Namespace `icp.v1.*`);
  Bewertungen werden nie gespeichert, immer via `evaluate(profile, lead)` berechnet
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
