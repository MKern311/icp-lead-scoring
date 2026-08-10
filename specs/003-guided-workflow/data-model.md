# Data Model: Geführter Screening-Workflow

Erweiterungen gegenüber Feature 001/002 — bestehende Entitäten (Profil, Kriterium,
Stufe, Lead) siehe `specs/001-icp-lead-scoring/data-model.md` und die
stage-Erweiterung in `specs/002-online-screening/`.

## Kriterium (erweitert)

| Feld         | Typ    | Regeln                                                            |
|--------------|--------|-------------------------------------------------------------------|
| `searchHint` | string | optional, getrimmt, max. 200 Zeichen, Default `''`; frei wählbarer Freitext, der beschreibt, wonach online gesucht werden soll (z. B. „bevorzugt 50–250 Mitarbeiter") |

- Persistenz: Teil des Profils (localStorage über `store.js`), wie alle Kriterienfelder.
- Export/Import: `schemaVersion` bleibt 2; `searchHint` optional im Export enthalten,
  beim Import fehlend ⇒ `''`, ungültiger Typ ⇒ Ablehnung mit Fehlermeldung.
- Migration: `migrateProfile` ergänzt fehlendes `searchHint` als `''` (idempotent).
- Sichtbarkeit: UI zeigt das Feld nur bei `stage === 'prescreening'`; der Wert bleibt
  beim Phasenwechsel erhalten (kein Datenverlust durch Umschalten).
- Verfassungsgrenze: `searchHint` ist Profil-Definitionsdatum der Pre-Screening-Phase
  (Verfassung III c) — es wird nur für Pre-Screening-Kriterien serialisiert und
  enthält nie Gewichte/Punkte (die stehen in anderen Feldern, die der Request-Builder
  nicht liest).

## Workflow-Zustand (flüchtig, nicht persistiert)

| Feld        | Typ                 | Regeln                                                  |
|-------------|---------------------|---------------------------------------------------------|
| `step`      | 1 \| 2 \| 3         | Start bei 1; Übergang 1→2 nur, wenn alle Kriterien bestätigt und ≥ 1 Pre-Screening-Kriterium existiert |
| `confirmed` | Set<criterionId>    | in Schritt 1 aktiv bestätigte Kriterien; „Weiter" erst bei Vollständigkeit |
| `queue`     | leadId[]            | Schritt-3-Warteschlange: nach Übernahme die übernommenen Leads; bei Wiedereinstieg `qualificationQueue(profile, leads)` |
| `position`  | integer ≥ 0         | aktueller Index in `queue`; Anzeige „Lead n von m"       |
| `skipped`   | Set<leadId>         | übersprungene Leads (für die Zusammenfassung)            |

- Lebensdauer: nur im Modul-Speicher der Ansicht; Neuladen/Verlassen setzt zurück
  (FR-010). Persistiert wird ausschließlich über bestehende Wege: Profil
  (Phasen-Zuordnung, Suchhinweise), API-Schlüssel, übernommene Leads.

## Abgeleitete Mengen (pure Funktionen, `core/screening.js`)

- `qualificationQueue(profile, leads)` → Lead[]: Leads mit `source === 'screening'`,
  bei denen mindestens ein Kriterium mit `stage !== 'prescreening'` keinen Wert in
  `lead.values` hat; Reihenfolge = Bestandsreihenfolge.
- Bestehend: `prescreeningCriteria(profile)`; Bewertung stets `evaluate(profile, lead)`
  (nie gespeichert).
