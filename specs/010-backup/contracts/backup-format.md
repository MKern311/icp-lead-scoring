# Contract: Sicherungsformat (`docs/js/core/backup.js`)

**Verbindlich.** Änderungen erfordern eine erhöhte `schemaVersion` und angepasste Tests.

## API

```js
buildBackup(profile, leads, { appVersion, exportedAt }) → Backup   // pure Umformung
readBackup(data) → { profile, leads, errors, warnings }            // pure Prüfung
```

Beide sind DOM-frei und ohne Zufall bis auf `uuid()` beim Einlesen (neue Kennungen)
und `new Date()` als Vorgabewert für `exportedAt` — beides überschreibbar bzw. beim
Vergleich irrelevant.

## Format

```json
{
  "format": "icp-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-08-27T11:30:00.000Z",
  "appVersion": "2",
  "profile": { "name": "…", "description": "…", "missingValuePolicy": "neutral",
               "criteria": [ { "id": "…", "name": "…", "type": "select", "weight": 15,
                               "knockout": false, "stage": "prescreening",
                               "searchHint": "", "hintLabel": "", "searchTargets": ["<option-id>"],
                               "rules": { "options": [ { "id": "…", "label": "…", "points": 100 } ] } } ],
               "tiers": [ { "id": "…", "label": "A", "minScore": 75 } ] },
  "leads": [ { "name": "…", "note": "…", "source": "screening", "website": "…",
               "values": { "<criterion-id>": "<option-id>" },
               "sources": { "<criterion-id>": { … } },
               "createdAt": "…", "updatedAt": "…" } ]
}
```

## Regeln

1. **IDs.** Die Sicherung trägt die IDs von Kriterien, Ausprägungen und Stufen mit —
   Lead-Werte und Quellenangaben sind danach abgelegt (`lead.values[criterionId]`).
   Ohne sie verlöre eine Sicherung genau das, wofür sie gemacht ist. Damit unterscheidet
   sie sich bewusst vom **Profil-Export** (`profile-io.js`), der zum *Teilen* dient und
   IDs weglässt.
2. **Neue Kennung beim Einlesen.** Profil-ID und Lead-IDs werden neu vergeben. Eine
   Wiederherstellung **überschreibt nie** vorhandene Daten, sie tritt daneben; der
   Profilname wird bei Bedarf eindeutig gemacht (`uniqueProfileName`).
3. **Keine Punktzahlen.** Bewertungen werden nie gespeichert, sondern immer aus Profil
   und Werten berechnet (Verfassung II) — die Sicherung enthält deshalb keine Scores,
   Stufen oder Status.
4. **Kein Schlüssel.** Der API-Schlüssel (`icp.v1.apikey`) wird nicht gelesen und ist
   nie Teil einer Sicherung (testverankert).
5. **Prüfung beim Einlesen.** Das Profil durchläuft `validateProfile`; scheitert es,
   wird **nichts** angelegt (`profile: null`, `errors` gefüllt). Leads werden einzeln
   bereinigt statt verworfen: Leads ohne Namen entfallen, Werte zu unbekannten
   Kriterien-IDs entfallen — beides erscheint in `warnings`, nicht in `errors`.
6. **Obergrenze.** Mehr als `MAX_LEADS` (5000) Leads werden abgelehnt, statt den
   Browser-Speicher zu sprengen.
7. **Fremde Formate.** `format !== "icp-backup"` oder unbekannte `schemaVersion`
   führen zu einer deutschen Fehlermeldung, nie zu einem Absturz oder Teil-Import.
