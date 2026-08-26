# Contract: Recherche-Qualität (Feature 005)

Verbindlich für `docs/js/core/screening.js`, `docs/js/screening-api.js`,
`docs/js/store.js`, `docs/js/app.js` und `docs/js/ui/workflow.js`.
Änderungen hier zuerst; `tests/screening.test.js` und `tests/catalog.test.js`
spiegeln jede pure Regel. Ergänzt `specs/004-deep-screening/contracts/deep-screening.md`.

## Pure API (core/screening.js — getestet)

```js
todayIso() → "JJJJ-MM-TT"                          // einziger nicht-deterministischer Punkt
isEvidenceStale(evidenceDate, today, maxMonths?) → boolean
addUsage(a, b) → usage                             // summiert API-usage-Objekte
usageCost(usage) → { input, output, search, total, searches }   // USD
```

Konstanten: `DEEP_CONCURRENCY = 2`, `EVIDENCE_MAX_AGE_MONTHS = 12`,
`PRICING = { currency: 'USD', inputPerMTok: 5, outputPerMTok: 25,
cacheWriteFactor: 1.25, cacheReadFactor: 0.1, webSearchPer1000: 10 }`
(Listenpreise `claude-opus-5` + Websuche, Stand 2026-08).

## D: Bezugsdatum (FR-408, SC-408)

- `buildLonglistRequest(profile, { …, today })` und
  `buildDeepScreeningRequest(profile, entry, { region, today })` stellen dem
  User-Text die Zeile voran:
  `Heutiges Datum: <today>. Zeitangaben wie „in den letzten 12 Monaten" oder
  „aktuell" beziehen sich immer auf dieses Datum.`
- Default ist `todayIso()`; ein Wert, der nicht auf `^\d{4}-\d{2}-\d{2}$` passt,
  erzeugt **keine** Datumszeile (lieber keine Angabe als eine falsche).
- Die Zeile enthält keine Nutzerdaten und berührt SC-004 nicht.

## S: Beleg-Alter (FR-408, SC-410)

- `isEvidenceStale(evidenceDate, today, maxMonths = 12)`: rechnet in Monaten
  (`Jahr × 12 + Monat`); `true`, wenn die Differenz **größer** als `maxMonths` ist —
  exakt 12 Monate gilt noch als frisch.
- Unparsbare oder fehlende Daten ⇒ `false`. Wirft nie.
- UI: Badge „Beleg veraltet" (`.badge-stale`) in Schritt 3, Schritt 4 und der
  Lead-Einzelansicht; Schritt 3 zählt zusätzlich alle veralteten Werte in einem
  Hinweis zusammen. Ausschließlich zur Renderzeit berechnet — `lead.evidenceDates`
  bleibt unverändert, die Bewertung ist nicht betroffen (Verfassung II).

## A: Ausschlussliste der Nachsuche (FR-409, SC-409)

- `buildLonglistRequest(profile, { …, exclude })`: `exclude` ist ein String-Array.
  Leere Einträge werden übersprungen, jeder Name auf 120 Zeichen gekürzt, die Liste
  auf **150** Namen begrenzt.
- Nicht-leere Liste ⇒ Block im User-Text:
  `Diese Unternehmen sind bereits gefunden — schlage sie NICHT erneut vor (auch keine
  Schreibvarianten desselben Unternehmens):` + `- <Name>` je Zeile.
- **Verfassung III**: Die UI befüllt `exclude` ausschließlich aus
  `result.candidates` des laufenden Laufs. Gespeicherte Leads werden nie übergeben
  (testverankert über den unveränderten SC-004-Anker).
- UI: „Weitere Kandidaten suchen" hängt neue Treffer an; namensgleiche
  Wiederholungen werden clientseitig verworfen und gemeldet.

## K: Kosten (FR-412, SC-411)

- `addUsage(a, b)` summiert `input_tokens`, `output_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens` und
  `server_tool_use.web_search_requests`; `null`/fehlende Felder zählen 0.
- `runScreening` summiert `usage` über alle `pause_turn`-Fortsetzungen und liefert
  die Summe zurück — ein Lauf besteht aus mehreren Requests.
- `usageCost(usage)`: Input = `(input + cacheWrite × 1,25 + cacheRead × 0,1) / 1e6 ×
  inputPerMTok`, Output analog, Suche = `Suchen / 1000 × webSearchPer1000`; alle
  Werte auf 4 Nachkommastellen gerundet. Negative oder nicht-numerische Felder
  zählen 0 (nie NaN).
- UI: Summe je Workflow-Sitzung, angezeigt in Schritt 2 und 3, mit dem Zusatz
  „maßgeblich ist Ihre Abrechnung". Beträge unter 0,01 $ werden als „unter 0,01 $"
  ausgewiesen.

## V: Verlassen-Schutz (FR-410)

- `app.js` exportiert `setLeaveGuard(fn)`; `fn()` liefert eine deutsche Meldung oder
  `null`. Der Guard gilt nur für den View, der ihn gesetzt hat, und wird beim
  Routenwechsel verworfen.
- Greift bei Hash-Wechsel (natives `confirm`, weil `hashchange` synchron entschieden
  werden muss; bei Ablehnung wird der alte Hash ohne zweite Rückfrage
  wiederhergestellt) und bei `beforeunload`.
- Der Workflow meldet: laufender Lauf, fertige, nicht übernommene Tiefen-Screenings,
  oder nicht übernommene Longlist-Kandidaten — in dieser Reihenfolge.

## P: Suchparameter (FR-411)

- `store.getWorkflowParams(profileId)` / `setWorkflowParams(profileId, params)` unter
  `icp.v1.workflow.<profileId>`; nur `region` (≤ 120 Zeichen, Default „DACH"),
  `count` (5–50, Default 20), `hints` (≤ 1000 Zeichen).
- Beim Lesen defensiv normalisiert; `deleteProfile` räumt den Eintrag mit ab.
- Ergebnisse, Kandidaten und Bewertungen werden **nicht** gespeichert (FR-010).

## N: Nebenläufigkeit im Tiefen-Screening (FR-405 präzisiert)

- `DEEP_CONCURRENCY = 2` Arbeiter greifen sich reihum den nächsten `pending`-Eintrag;
  die Auswahl läuft synchron vor dem ersten `await` (keine Doppelvergabe).
- `deepRun.controllers` ist ein Set; Abbruch bricht alle laufenden Requests ab und
  setzt deren Einträge auf `pending` zurück.
- 429 auf einem Arbeiter beendet den gesamten Lauf (kein Auto-Retry, Kosten).

## B: Befund „type-mismatch" (FR-413, Bestandsprofile)

- `profileCatalogFindings` meldet zusätzlich `kind: 'type-mismatch'`, wenn ein
  Profil-Kriterium **denselben Namen** wie ein Katalog-Eintrag trägt, aber einen
  **anderen Typ** hat (typisch: Unternehmensgröße als Zahlenbereich aus einem
  Profil vor der Umstellung auf feste Klassen). Felder: `successor` (= Katalog-Name),
  `catalogType`, `currentType`.
- Nötig, weil der Katalog namensgleiche Einträge nicht mehr zum Übernehmen anbietet —
  ohne diesen Befund bliebe die Altlast unsichtbar und fehlte als Klassen-Filter.
- Reihenfolge der Prüfung je Kriterium: `replaced` → `retired` → `type-mismatch`
  (nur wenn keins der beiden zutrifft); `duplicate` unabhängig davon.
- UI: Aufräum-Box bietet „In Klassen umstellen" an. Die Umstellung übernimmt Gewicht,
  K.o.-Status **und Phase** des alten Kriteriums; die Punktwerte kommen aus dem
  Katalog und sind im Profil-Editor anzupassen (Hinweis im Toast).

## T: Vorlagen (FR-413, SC-412)

- Jede Vorlage in `templates.js` enthält mindestens ein Pre-Screening-Kriterium vom
  Typ `select`; Größenklassen folgen der EU-KMU-Definition 2003/361/EG.
- Suchpräferenzen stehen als **Options-Labels** in `searchTargets` (Export-Format);
  `importProfile` bildet sie auf die neu vergebenen Options-IDs ab — ein Label ohne
  Entsprechung ist ein Import-Fehler.
