# Data Model: ICP Definition & Lead Scoring

**Date**: 2026-08-04 | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

Alle Entitäten sind reine JSON-Objekte (serialisierbar für `localStorage` und Datei-Export).
IDs sind zufällige, kollisionsarme Strings (`crypto.randomUUID()`). Zeitstempel sind
ISO-8601-Strings. Die **Bewertung (Evaluation)** ist bewusst **keine gespeicherte Entität** —
sie wird deterministisch aus Profil + Lead berechnet (siehe
[contracts/scoring-engine.md](contracts/scoring-engine.md)).

## Entity: Profile (ICP-Profil)

| Feld | Typ | Regeln |
|------|-----|--------|
| `id` | string (UUID) | eindeutig, unveränderlich |
| `schemaVersion` | number | aktuell `1`; für Export/Import-Kompatibilität |
| `name` | string | Pflicht, 1–120 Zeichen, eindeutig unter allen Profilen (Duplikat ⇒ Hinweis + Suffix „(2)") |
| `description` | string | optional, ≤ 2 000 Zeichen |
| `missingValuePolicy` | `"neutral"` \| `"zero"` | Pflicht, Default `"neutral"` (FR-010) |
| `criteria` | Criterion[] | 1–50 Einträge; Reihenfolge = Anzeigereihenfolge |
| `tiers` | Tier[] | 2–10 Einträge; genau eine Stufe mit `minScore = 0` (Auffangstufe) |
| `createdAt` / `updatedAt` | string (ISO) | vom Store gesetzt |

**Validierung (model.js)**: Name nicht leer; ≥ 1 Kriterium; Gewichtssumme > 0 (Summe ≠ 100 ⇒
Warnung, keine Ablehnung — FR-015); Stufen-`minScore` paarweise verschieden, 0–100.

## Entity: Criterion (Kriterium)

| Feld | Typ | Regeln |
|------|-----|--------|
| `id` | string (UUID) | eindeutig innerhalb des Profils |
| `name` | string | Pflicht, 1–80 Zeichen |
| `description` | string | optional, ≤ 500 Zeichen |
| `type` | `"select"` \| `"range"` \| `"boolean"` \| `"scale"` | Pflicht (FR-003) |
| `weight` | number | 0–100, Eingabe in Prozentpunkten; intern zur Laufzeit auf Summe normiert |
| `knockout` | boolean | Default `false`; `true` ⇒ Punkte < 1 disqualifizieren (FR-004) |
| `rules` | objekt, typabhängig | siehe unten |

### `rules` je Typ

- **select**: `{ options: [{ id, label, points }] }` — 2–20 Optionen; `label` eindeutig
  (Groß-/Kleinschreibung ignoriert; Import matcht darüber); `points` ganzzahlig 0–100.
- **range**: `{ ranges: [{ min, max, points }] }` — 1–20 Bereiche; `min ≤ max`; Bereiche
  dürfen sich nicht überlappen (Validierungsfehler); Wert außerhalb aller Bereiche ⇒ 0 Punkte
  + Breakdown-Flag `outOfRange` (Edge Case der Spec). Grenzen inklusive.
- **boolean**: `{ pointsYes, pointsNo }` — ganzzahlig 0–100.
- **scale**: `{ min, max }` — ganzzahlig, `max − min ≥ 1`; lineare Abbildung
  `points = (value − min) / (max − min) × 100`; Eingaben außerhalb [min, max] sind ungültig
  (Formular verhindert, Import meldet Zeilenfehler).

## Entity: Tier (Stufe)

| Feld | Typ | Regeln |
|------|-----|--------|
| `id` | string (UUID) | eindeutig innerhalb des Profils |
| `label` | string | Pflicht, 1–40 Zeichen, z. B. „A", „Hot" |
| `minScore` | number | 0–100; Zuordnung: Stufen absteigend nach `minScore`, erste mit `minScore ≤ Score` gewinnt (FR-006, Akzeptanzszenario 2/US2) |

## Entity: Lead

| Feld | Typ | Regeln |
|------|-----|--------|
| `id` | string (UUID) | eindeutig |
| `profileId` | string | Referenz auf Profile; Löschen des Profils ⇒ Warnung, Leads verlieren Bewertungsgrundlage (Edge Case) |
| `name` | string | Pflicht, 1–120 Zeichen; Duplikat-Namen beim Import ⇒ Meldung, Import trotzdem (Edge Case) |
| `note` | string | optional, ≤ 2 000 Zeichen |
| `values` | `{ [criterionId]: value }` | fehlender Eintrag = fehlender Wert (FR-010); Werttyp je Kriterium: select ⇒ `optionId`, range/scale ⇒ number, boolean ⇒ boolean |
| `source` | `"manual"` \| `"csv"` | für Anzeige/Filter |
| `createdAt` / `updatedAt` | string (ISO) | vom Store gesetzt |

## Computed: Evaluation (Bewertung — nicht persistiert)

Rückgabe von `evaluate(profile, lead)`:

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `status` | `"scored"` \| `"disqualified"` \| `"not-evaluable"` | K.o. verletzt ⇒ `disqualified`; K.o.-Kriterium ohne Wert ⇒ `not-evaluable` (Edge Case) |
| `total` | number \| null | 0–100, auf 1 Dezimalstelle gerundet; bei `scored` und `disqualified` (dort informativ) gesetzt, bei `not-evaluable` stets `null` (siehe Contract) |
| `tierId` | string \| null | zugeordnete Stufe (nur bei `scored`) |
| `complete` | boolean | `false`, wenn mind. ein Kriterienwert fehlt (FR-010) |
| `missing` | string[] | criterionIds ohne Wert |
| `breakdown` | Breakdown[] | ein Eintrag je Kriterium (FR-005, SC-004) |

**Breakdown-Eintrag**: `{ criterionId, rawValue, points (0–100 | null), normalizedWeight,
contribution, included (boolean), outOfRange? (boolean), knockoutViolated? (boolean) }`

## Beziehungen & Lebenszyklus

```text
Profile 1 ──── n Criterion (eingebettet)
Profile 1 ──── n Tier      (eingebettet)
Profile 1 ──── n Lead      (referenziert via profileId, separater Storage-Key)
Profile + Lead ──▶ Evaluation (berechnet, nie gespeichert)
```

- **Profil ändern** ⇒ nächste Anzeige berechnet alle Bewertungen neu; UI zeigt Hinweis
  „Bewertungen wurden auf Basis des geänderten Profils neu berechnet" (FR-011).
- **Profil löschen** ⇒ Bestätigungsdialog. Gemäß Spec-Edge-Case bleiben die Leads erhalten,
  verlieren aber ihre Bewertungsgrundlage: Sie bleiben unter `icp.v1.leads.<profileId>`
  gespeichert und erscheinen in der Profil-Übersicht als Rubrik „Leads ohne Profil" mit den
  Aktionen Löschen oder Neuzuordnen zu einem Profil (Neuzuordnung übernimmt nur Name/Notiz
  und setzt Kriterienwerte zurück — Hinweis an den Nutzer).
- **Profil duplizieren** ⇒ tiefe Kopie mit neuen IDs, Name + „ (Kopie)" (FR-001).
- **Export/Import Profil** ⇒ [contracts/profile-export.schema.json](contracts/profile-export.schema.json);
  Import erzeugt stets neue IDs (Kollision mit vorhandenen Profilen ausgeschlossen), Punktregeln
  bleiben byte-identisch (SC-005).

## Storage-Layout (`localStorage`)

| Key | Inhalt |
|-----|--------|
| `icp.v1.profiles` | `Profile[]` (alle Profile inkl. eingebetteter Kriterien/Stufen) |
| `icp.v1.leads.<profileId>` | `Lead[]` des Profils |
| `icp.v1.settings` | `{ activeProfileId }` |

Schreibzugriffe laufen ausschließlich über `store.js` (einzige Persistenzschicht, Prinzip V-
analoge Trennung); jede Mutation aktualisiert `updatedAt`.
