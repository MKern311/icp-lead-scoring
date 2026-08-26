# Contract: Zweiphasen-Screening (Longlist + Deep)

Verbindlich für `docs/js/core/screening.js` und `docs/js/screening-api.js`.
Änderungen hier zuerst; `tests/screening.test.js` spiegelt jede Regel. Ergänzt
`specs/002-online-screening/contracts/screening.md` (Netzwerkschicht, Parsing-Basis)
und `specs/003-guided-workflow/contracts/workflow.md`.

## Pure API (core/screening.js — getestet)

```js
longlistCriteria(profile) → Criterion[]                 // stage=prescreening && type=select
buildLonglistRequest(profile, { region, count, hints, today, exclude }) → requestBody
buildDeepScreeningRequest(profile, { name, website }, { region, today }) → requestBody
parseCandidates(output, profile) → { candidates, warnings }        // Longlist (wie 002)
parseDeepResult(output, profile, { name }) → { candidate|null, warnings }
mergeDeepIntoCandidate(longlistCand, deepCand) → candidate
candidateToLead(candidate, profile, meta) → lead        // + confidence/evidenceDates
estimateDeepCost(n) → { min, max }                      // USD, COST_ESTIMATES
```

**Feature 005** ergänzt Bezugsdatum, Ausschlussliste, Beleg-Alter und Ist-Kosten —
Regeln in `specs/005-research-quality/contracts/research-quality.md`.

`buildScreeningRequest` (002/003) entfällt — Longlist ersetzt den Sammellauf.

## L: Longlist-Request (SC-401)

- Kriterien: **nur** `longlistCriteria(profile)`. Namen/Beschreibungen von
  boolean-/scale-/range-Pre-Screening-Kriterien kommen im Request-JSON nicht vor.
- Nicht-leere `searchTargets` je Kriterium ⇒ Zeile `Erforderlich: <Labels>` (harte
  Filter); das Output-Schema behält den vollen Options-enum (ehrliche Werte).
- `max_uses: LONGLIST_MAX_SEARCHES = 25`, `max_tokens: 16000`, Modell wie 002.
- Ohne Longlist-Kriterium: Error mit deutscher Meldung (Hinweis auf Katalog).
- SC-004-Basis gilt unverändert: keine `weight`/`points`/Stufen/Profilname/Leads.

## D: Deep-Request (SC-402)

- Serialisiert ausschließlich: `name`, `website` (falls vorhanden), Region und
  **alle** Pre-Screening-Kriterien (inkl. `searchHint`-Zeilen; hat ein Kriterium
  ein `hintLabel`, ersetzt es das Zeilen-Präfix „Suchhinweis:" — z. B. „Gesuchte
  Rollen / Stellentitel: Vertriebsleiter, SAP-Berater"; `searchTargets`
  werden im Deep NICHT serialisiert — bei Faktenprüfung gibt es keine Präferenz).
- Niemals: Longlist-Werte, andere Kandidatennamen, gespeicherte Leads, Gewichte,
  Punktwerte, Stufen, Qualifizierungskriterien, Profilname (testverankert: Kandidat
  mit Zusatzfeldern übergeben ⇒ nur name/website erscheinen).
- `max_uses: DEEP_MAX_SEARCHES = 12`, `max_tokens: 8000`.
- System-Prompt (deutsch): genau dieses eine Unternehmen recherchieren; ohne
  Website zuerst die offizielle Website identifizieren; nichts erfinden; Beleg-Typ
  muss zum Signal passen (Stellen-Signale nur Jobportal-/Karriereseiten-URL,
  News-Signale nur Presse-URL); `confidence`: `direct` = Quelle nennt den Wert
  explizit, `inferred` = aus Indizien abgeleitet; `evidenceDate` = Stand des Belegs
  als `JJJJ-MM`, sonst null; Login/Paywall verboten.
- Output-Schema (Structured Output):

```json
{ "type": "object", "additionalProperties": false,
  "required": ["found", "website", "summary", "sources", "values"],
  "properties": {
    "found":   { "type": "boolean" },
    "website": { "anyOf": [{ "type": "string" }, { "type": "null" }] },
    "summary": { "type": "string" },
    "sources": { "type": "array", "items": { "type": "string" } },
    "values":  { "k<i>": { "required": ["value", "source", "confidence", "evidenceDate"],
                  "value": "<typabhängig | null>",
                  "source": "string | null",
                  "confidence": "enum ['direct','inferred'] | null",
                  "evidenceDate": "string | null" } } } }
```

## P: parseDeepResult (SC-403)

- `found !== true` oder kaputte Antwort ⇒ `candidate: null` + Warnung („nicht
  eindeutig identifizierbar"). Wirft nie.
- **Quellenpflicht je Wert**: nicht-null-`value` ohne `source` ⇒ Wert wird
  verworfen + Warnung (härter als Longlist-Parsing).
- `confidence`: nur `direct`/`inferred` wird übernommen; anderes ⇒ weggelassen.
- `evidenceDate`: nur `JJJJ-MM` (Regex `^\d{4}-(0[1-9]|1[0-2])$`) wird übernommen;
  anderes ⇒ weggelassen + Warnung. Kein Eintrag für null-Werte.
- Kandidat ohne jede Quelle (weder `sources` noch Wert-Quellen) ⇒ `null` + Warnung.
- Typ-Mapping (select-Label, scale-Rundung/-Grenzen, range) wie 002-Parsing.

## M: Merge & Lead

- `mergeDeepIntoCandidate(a, b)`: Werte/Quellen aus Deep gewinnen; Longlist-Werte
  ohne Deep-Ersatz bleiben (ohne Konfidenz-Eintrag); `sources` = Union;
  `website`/`reasoning` bevorzugt Deep; `name` aus Longlist; `unmatched` konkateniert.
- `candidateToLead`: kopiert `confidence`/`evidenceDates` gefiltert auf gültige
  Kriterien-IDs mit vorhandenem Wert nach `lead.confidence`/`lead.evidenceDates`
  (nur wenn nicht leer). **Verfassung-II-Anker (SC-404)**: `evaluate(profile, lead)`
  liefert mit und ohne diese Maps identische Ergebnisse.

## N: Netzwerkschicht & Ablauf

- `runScreening(apiKey, body, onStatus, { signal })`: `signal` wird an `fetch`
  durchgereicht; Abbruch ⇒ Error mit `aborted: true` und deutscher Meldung
  („Recherche abgebrochen."). Übrige Fehler-Mappings wie 002. Rückgabe
  `{ output, usage }`, `usage` über alle `pause_turn`-Fortsetzungen summiert (005).
- Deep-Ausführung (UI): `DEEP_CONCURRENCY = 2` Firmen gleichzeitig (005; vorher
  sequenziell), Zustand flüchtig (`{ entries, running, controllers }`); Abbruch
  beendet alle laufenden Requests, fertige Firmen bleiben; 429 pausiert den Lauf
  (kein Auto-Retry); „Erneut versuchen" je Firma. Deep nur für Kandidaten des
  laufenden Laufs oder manuell eingegebene Firmen — nie für gespeicherte Leads
  (Verfassung III).

## K: Kosten

- `COST_ESTIMATES = { longlist: [0.35, 0.9], deepPerCompany: [0.15, 0.4] }` (**USD**
  — Abrechnungswährung der API, seit 005; grobe Richtwerte); `estimateDeepCost(n)`
  = n × Spanne, auf 2 Nachkommastellen.
- UI zeigt Schätzung vor jedem Start; ab 15 Firmen Warnhinweis (Empfehlung 5–10,
  ~2–3 Min. je Zweiergruppe). Nach jedem Lauf zusätzlich die **tatsächlichen**
  Kosten aus `usage` (005, siehe Feature-005-Contract).
