# Feature 011: Recherche-Schema innerhalb der API-Grenzen

**Status**: umgesetzt · **Datum**: 2026-08-27
**Basis**: Features 002, 004, 005

## Problem

Das Tiefen-Screening brach bei gewachsenen Profilen mit einer Fehlermeldung des Dienstes ab:

> Schemas contains too many parameters with union types (49 parameters with type arrays
> or anyOf). … limit: 16

Ursache: Das Antwortschema wuchs mit der Zahl der Pre-Screening-Kriterien. Je Kriterium
standen vier Felder im Schema (`value`, `source`, `confidence`, `evidenceDate`), jedes als
Union „Wert **oder** null". Bei 12 Kriterien waren das `1 + 4 × 12 = 49` Union-Parameter —
die API lässt 16 zu. Das Werkzeug war damit auf drei Pre-Screening-Kriterien beschränkt,
ohne dass irgendwo ein Hinweis darauf stand.

Beim Beheben kamen zwei weitere, undokumentierte Grenzen zum Vorschein — jede erst
sichtbar, nachdem die vorige umgangen war:

| Grenze | Meldung | Bei welchem Umbau sie auftrat |
|---|---|---|
| 16 union-typisierte Parameter | „too many parameters with union types" | Ausgangslage (`X \| null`) |
| 24 optionale Parameter | „too many optional parameters" | Felder aus `required` genommen |
| Größe der kompilierten Grammatik | „compiled grammar is too large" | alles erforderlich, ein Feld je Kriterium |

Die dritte Grenze riss schon bei 16 Kriterien und war die eigentliche: Sie hängt an der
Zahl der Felder in **einem** Objekt — und genau die wuchs mit jedem Kriterium.

## Anforderungen

**FR-1001**: Das Antwortschema der Recherche hat eine **feste** Größe, unabhängig von der
Zahl der Kriterien im Profil.

**Akzeptanz**
1. `values` ist eine **Liste** von Einträgen `{ key, value, source[, confidence,
   evidenceDate] }` statt eines Objekts mit einem Feld je Kriterium. `key` ist das Kürzel
   aus der Kriterienliste des Prompts (`k1..kn`).
2. Das Schema enthält **keine** Unions (`anyOf`, Typ-Listen) und **keine** optionalen
   Parameter — testverankert über Zähler, die bei 30 Kriterien null ergeben müssen.
3. Alle Werte sind `string`; **leerer Text bedeutet „unbekannt"**. Das Auswerten behandelt
   leeren Text, `null` und ein fehlendes Feld gleich, damit ältere Antworten lesbar bleiben.
4. Zahlen und Ja/Nein werden beim Auswerten zurückgewandelt (`"250"` ⇒ 250, `"Ja"` ⇒ true).
   Die Umwandlung ist **eng**: `"ca. 250"` gilt als unbrauchbar und der Wert bleibt offen.
   Ein geratener Wert wäre schlimmer als ein offener (Verfassung II).
5. Die zulässigen Ausprägungen eines Auswahl-Kriteriums stehen im **Prompt**, nicht als
   `enum` im Schema. Geprüft werden sie beim Auswerten (`mapCompanyValues`), das
   Nicht-Passendes verwirft und meldet — diese Prüfung gab es ohnehin schon.
6. Ein Profil mit 50 Pre-Screening-Kriterien (die Obergrenze der Profil-Validierung) wird
   vom Dienst angenommen. Gegen die echte API geprüft: 12, 30 und 50 Kriterien.

## Warum nicht anders gelöst

- **Weniger Kriterien erlauben**: Die Beschränkung wäre willkürlich und für Nutzende nicht
  nachvollziehbar — der Katalog schlägt selbst mehr als zwölf Kriterien vor.
- **Enums im Schema behalten**: Sie sind die größte Einzelposition der Grammatik und im
  Prompt ohnehin redundant. Die Prüfung beim Auswerten war schon vorher die verbindliche.
- **Getypte Werte behalten** (Zahl als `number`, Ja/Nein als `boolean`): Ein Feld kann nur
  einen Typ haben, sonst braucht es wieder eine Union. Der Preis ist die Rückwandlung —
  bewusst eng gehalten, siehe Akzeptanz 4.

## Nebenbefund: Kostenschätzung war zu niedrig

Der gemessene Lauf (Opus 5, 12 Suchen, ein Unternehmen) kostete **0,71 $** — die Anzeige
schätzte 0,15–0,40 $. `COST_ESTIMATES.deepPerCompany` steht jetzt auf `[0.2, 0.8]`.
Die Longlist-Spanne ist rechnerisch hergeleitet (`[0.35, 1.2]`), nicht gemessen.
