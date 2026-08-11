# Implementation Plan: Granulares Zweiphasen-Screening

**Branch**: `main` | **Date**: 2026-08-11 | **Spec**: [spec.md](spec.md)

Vollständiger Architektur-Plan (freigegeben im Plan-Modus):
`~/.claude/plans/refactored-hugging-key.md` — Kurzfassung:

## Summary

Granularität durch zwei Phasen: **Longlist** (nur Auswahl-Kriterien als harte
Klassen-Filter, geringes Suchbudget) und **Tiefen-Screening** (ein API-Lauf je
Unternehmen über alle Pre-Screening-Kriterien mit Konfidenz + Belegdatum je Wert,
Quellenpflicht, sequenziell mit Abbruch/Fortsetzen). Katalog wächst auf ~23
kategorisierte Einträge mit Belegquellen. Workflow wird vierstufig. Manuelle
Firmen-Eingabe im Deep-Schritt. Regeln fixiert in
[contracts/deep-screening.md](contracts/deep-screening.md).

## Constitution Check

- **I Generik**: Longlist-Regel ist typbasiert (select), Katalog bleibt Daten;
  `category`/`evidence` sind Katalog-Felder, kein Modell-/Schema-Ausbau. PASS
- **II Scores**: Konfidenz/Belegdatum sind Metadaten; `evaluate` unangetastet,
  testverankert (SC-404). PASS
- **III Datenhoheit**: Deep überträgt nur Name/Website/Region + Pre-Screening-
  Kriterien; nie Bestands-Leads (Deep nicht für gespeicherte Leads erreichbar),
  nie Longlist-Werte/fremde Kandidaten (SC-402). PASS
- **IV Einfachheit**: kein neuer Kriterientyp, Export bleibt schemaVersion 2,
  keine Abhängigkeiten. PASS
- **V Testbarkeit**: alle neuen Regeln als pure Funktionen in core/ mit Tests. PASS

## Technical Context

Wie Feature 003 (Vanilla JS, node --test, localStorage, Service Worker). Neue
Konstanten: `LONGLIST_MAX_SEARCHES = 25`, `DEEP_MAX_SEARCHES = 12`,
`COST_ESTIMATES`. SW-Cache → `icp-cache-v6`.

## Structure

Änderungen: `docs/js/core/screening.js` (Refaktorierung + Longlist/Deep/Merge),
`docs/js/core/model.js` (`criterionFromCatalog` + evidence), `docs/js/templates.js`
(Katalog ~23), `docs/js/screening-api.js` (AbortSignal), `docs/js/ui/workflow.js`
(4 Schritte, Deep-Schleife, manuelle Eingabe), `docs/js/ui/lead-form.js`
(Konfidenz-Badges), `docs/css/components.css`, `docs/sw.js`; Contracts 002/003
angepasst; Tests: screening/catalog/model/profile-io.
