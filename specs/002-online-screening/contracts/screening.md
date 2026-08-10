# Contract: Screening (`docs/js/core/screening.js` + `docs/js/screening-api.js`)

Verbindlich. Änderungen hier zuerst; Tests in `tests/screening.test.js` spiegeln jede Regel.

## Pure API (core/screening.js — getestet)

```js
buildScreeningRequest(profile, { region, count, hints }) → requestBody   // deterministisch
parseCandidates(outputObject, profile) → { candidates, warnings }        // wirft nie
candidateToLead(candidate, profile) → lead                               // source: "screening"
prescreeningCriteria(profile) → Criterion[]                              // stage === "prescreening"
```

## Request-Regeln (Constitution III c, SC-004)

1. `buildScreeningRequest` serialisiert **ausschließlich**: Name/Beschreibung des Profils?
   — NEIN: nur die **Pre-Screening-Kriterien** (Name, Beschreibung, Typ, Ausprägungen/
   Bereiche/Skala), Region, Anzahl (5–50), optionale Hinweise. Profilname, qualitative
   Kriterien, Gewichte, Punktwerte, Stufen, Leads und Bewertungen kommen im Request-JSON
   **nicht vor** (testverankert: `JSON.stringify(request)` enthält keinen Namen eines
   Qualifizierungs-Kriteriums, keine `points`/`weight`-Werte, keine Lead-Daten).
   *Begründung Gewichte/Punkte: die Recherche braucht nur Ausprägungen; Punktregeln sind
   Geschäftslogik und bleiben lokal (Constitution II).*
2. Request-Gestalt:
   - `model: "claude-opus-5"`, `max_tokens: 16000`
   - kein `thinking`, keine `temperature`/`top_p`/`top_k`
   - `tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 40 }]`
   - `output_config.format`: json_schema (Regeln unten)
   - `system`: deutsche Recherche-Anweisung (Rolle, Quellen-Arten, „nichts erfinden",
     nur öffentlich Zugängliches, min. 1 Quelle pro Kandidat)
   - eine User-Message mit Kriterienliste (Schlüssel `k1..kn`), Region, Anzahl, Hinweisen
3. HTTP-Header (screening-api.js): `content-type: application/json`,
   `x-api-key: <Schlüssel>`, `anthropic-version: 2023-06-01`,
   `anthropic-dangerous-direct-browser-access: true`.

## Output-JSON-Schema (dynamisch je Profil)

```json
{
  "type": "object", "additionalProperties": false, "required": ["companies"],
  "properties": { "companies": { "type": "array", "items": {
    "type": "object", "additionalProperties": false,
    "required": ["name", "website", "reasoning", "sources", "values"],
    "properties": {
      "name":      { "type": "string" },
      "website":   { "anyOf": [{ "type": "string" }, { "type": "null" }] },
      "reasoning": { "type": "string" },
      "sources":   { "type": "array", "items": { "type": "string" } },
      "values":    { "type": "object", "additionalProperties": false,
                     "required": ["k1", "…"],
                     "properties": {
                       "k<i>": { "type": "object", "additionalProperties": false,
                                 "required": ["value", "source"],
                                 "properties": {
                                   "value":  "<typabhängig, immer | null>",
                                   "source": { "anyOf": [{ "type": "string" }, { "type": "null" }] }
                                 } } } } } } } }
```

`value` je Kriterientyp: select ⇒ `enum` der Options-Labels | null; boolean ⇒ boolean | null;
range/scale ⇒ number | null. **Punkte, Gewichte oder Scores existieren im Schema nicht.**

## Parsing-Regeln (parseCandidates)

- Kandidat ohne mindestens eine nicht-leere Quelle (`sources` und alle `source`-Felder leer)
  wird **verworfen** (Warnung „ohne Quelle verworfen", Edge Case der Spec).
- `value: null` ⇒ Wert fehlt (kein Eintrag in `lead.values`).
- select: Options-Label-Match case-insensitiv/getrimmt gegen das Profil ⇒ `optionId`;
  kein Match (sollte durch enum nicht vorkommen) ⇒ Wert fehlt + Warnung mit Rohtext.
- scale: nicht-ganzzahlige Werte werden gerundet; außerhalb `[min, max]` ⇒ Wert fehlt +
  Warnung. range: jede endliche Zahl ist gültig (outOfRange behandelt die Engine).
- Duplikat-Kennzeichnung: Name-Gleichheit (case-insensitiv, getrimmt) mit Bestands-Leads
  wird von der UI ermittelt und angezeigt; Übernahme bleibt möglich.
- Kriterien, die zwischen Lauf und Übernahme aus dem Profil entfernt wurden, werden beim
  Mapping ignoriert und als Warnung ausgewiesen.

## candidateToLead

- `source: "screening"`, `website` (falls vorhanden), `sources`-Map (criterionId → URL,
  nur belegte Werte), `note` = reasoning + „Recherchiert am <Datum> (Region <region>)" +
  Firmen-Quellen.
- Punktzahl/Stufe entstehen ausschließlich über `evaluate(profile, lead)` — identische
  Werte ⇒ identisches Ergebnis wie manuelle Eingabe (SC-005, testverankert).

## Netzwerkschicht (screening-api.js — dünn, nicht unit-getestet)

- `runScreening(apiKey, requestBody, onStatus)`:
  1. POST an `https://api.anthropic.com/v1/messages`.
  2. `stop_reason === "pause_turn"` ⇒ Assistenten-Content anhängen, erneut senden
     (max. 6 Fortsetzungen, `onStatus` meldet „Recherche läuft … (Teil n)").
  3. `stop_reason === "refusal"` ⇒ Fehler „Anfrage wurde vom Dienst abgelehnt".
  4. Ergebnis: letzter Text-Block ⇒ `JSON.parse` ⇒ Objekt an `parseCandidates`.
- Fehler-Mapping (deutsch): 401 „API-Schlüssel ungültig", 400 „Anfrage ungültig",
  429 „Rate-Limit erreicht — später erneut versuchen", 529/5xx „Dienst überlastet",
  `TypeError`/Netz „Keine Verbindung — Internet prüfen". Kein automatischer Retry
  (Nutzer entscheidet; Kosten).
- Der API-Schlüssel verlässt das Gerät ausschließlich im `x-api-key`-Header an
  `api.anthropic.com`.
