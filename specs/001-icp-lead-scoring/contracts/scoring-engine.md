# Contract: Scoring-Engine (`docs/js/core/scoring.js`)

**Verbindliche Rechenregeln.** Jede Änderung an diesem Contract erfordert einen
Constitution-Check (Prinzip II) und angepasste Tests (Prinzip V).

## API

```js
evaluate(profile, lead) → Evaluation   // pure Funktion, keine Seiteneffekte
evaluateAll(profile, leads) → Evaluation[]  // Komfort, gleiche Semantik
```

- Keine Abhängigkeit von DOM, Uhrzeit oder Zufall — identische Eingaben liefern auf jedem
  Gerät identische Ausgaben (SC-005).
- Wirft nie: ungültige/unbekannte Werte führen zu definierten Ergebnis-Flags, nicht zu
  Exceptions (Import-Robustheit).

## Rechenregeln

1. **Kriterienpunkte `p_i`** (immer 0–100):
   - `select`: Punkte der gewählten Option (`optionId`-Lookup; unbekannte Option ⇒ Wert gilt
     als fehlend, Flag `invalidValue`).
   - `range`: erster Bereich mit `min ≤ value ≤ max` (Bereiche überlappungsfrei per
     Validierung); kein Treffer ⇒ `p = 0` und `outOfRange = true`.
   - `boolean`: `pointsYes` bzw. `pointsNo`.
   - `scale`: `(value − min) / (max − min) × 100`, ungerundet.
2. **Gewichtsnormierung**: `w_i' = w_i / Σ w_j` über die **einbezogenen** Kriterien
   (siehe Regel 3). Die Eingabe-Gewichte müssen nicht 100 ergeben (FR-015: UI warnt, Engine
   normiert kommentarlos).
3. **Fehlende Werte** (`values[criterionId]` nicht vorhanden oder `invalidValue`):
   - Policy `neutral`: Kriterium wird **nicht einbezogen** (weder Zähler noch Nenner);
     `included = false`, `points = null`.
   - Policy `zero`: Kriterium wird einbezogen mit `p = 0`, volles Gewicht.
   - In beiden Fällen: `complete = false`, criterionId in `missing`.
   - Sind **alle** Werte fehlend (neutral-Policy: Nenner 0) ⇒ `status = "not-evaluable"`.
4. **K.o.-Kriterien** (`knockout = true`):
   - Wert vorhanden und `p_i < 1` ⇒ `status = "disqualified"`, `knockoutViolated = true`
     am Breakdown-Eintrag. Score wird **trotzdem informativ** berechnet und geliefert
     (UI zeigt „disqualifiziert" prominent, Punktzahl ausgegraut).
   - Wert fehlend ⇒ `status = "not-evaluable"` (Edge Case der Spec), unabhängig von der
     Missing-Policy. Bei `not-evaluable` ist `total = null` und `tierId = null`;
     bei `disqualified` wird `total` informativ berechnet, `tierId` bleibt `null`.
5. **Gesamtscore**: `total_raw = Σ (w_i' × p_i)` über einbezogene Kriterien.
   **Rundung nur bei Ausgabe**: `total = round1(total_raw)` mit
   `round1(x) = Math.round(x × 10) / 10` (kaufmännisch, eine Dezimalstelle).
6. **Stufenzuordnung** (nur bei `status = "scored"`): Stufen absteigend nach `minScore`
   sortieren; erste Stufe mit `minScore ≤ total` (verglichen mit dem **gerundeten** Wert)
   gewinnt. Durch die Pflicht-Auffangstufe (`minScore = 0`) gibt es immer einen Treffer.
   Beispiel aus der Spec: Stufen A ≥ 75, B ≥ 50, C ≥ 0 ⇒ 74 → B; 75 → A.
7. **Beitrag im Breakdown**: `contribution = w_i' × p_i` (ungerundet gespeichert, UI rundet
   auf 1 Dezimalstelle). Es gilt `total_raw = Σ contribution` — die Aufschlüsselung addiert
   sich exakt zum Score (SC-004; Rundungsdifferenzen nur in der Darstellung).

## Referenzbeispiel (Testfixture)

Profil: Branche (select, Gewicht 40; SaaS = 100, Handel = 40, Sonstige = 0),
Mitarbeiter (range, Gewicht 30; 10–50 = 100, 51–200 = 60), Budget vorhanden
(boolean, Gewicht 30, K.o.; Ja = 100, Nein = 0), Policy `neutral`, Stufen A ≥ 75 / B ≥ 50 / C ≥ 0.

| Lead | Werte | Ergebnis |
|------|-------|----------|
| L1 | SaaS, 30 MA, Budget Ja | `scored`, total = 100.0 → A |
| L2 | Handel, 120 MA, Budget Ja | 0.4·40 + 0.3·60 + 0.3·100 = 64.0 → B |
| L3 | SaaS, 30 MA, Budget **Nein** | `disqualified` (K.o.), informativ 70.0 |
| L4 | SaaS, 300 MA (outOfRange), Budget Ja | 0.4·100 + 0.3·0 + 0.3·100 = 70.0 → B, outOfRange-Flag |
| L5 | SaaS, — (fehlt), Budget Ja | neutral: (0.4·100 + 0.3·100)/0.7 = 100.0 → A, `complete = false` |
| L6 | SaaS, 30 MA, Budget — (fehlt) | `not-evaluable` (K.o. ohne Wert) |

Diese Tabelle ist 1:1 als Testfälle in `tests/scoring.test.js` zu implementieren.
