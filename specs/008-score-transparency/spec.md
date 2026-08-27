# Feature 008: Erreichbare Punktzahl sichtbar machen

**Status**: umgesetzt · **Datum**: 2026-08-27
**Basis**: Features 001–007

## Problem

Die Bewertung normiert die Gewichte (Contract `scoring-engine.md`, Regel 2). Die Skala
reicht deshalb formal bis 100 — erreichbar sind 100 Punkte aber nur, wenn **jedes**
Kriterium eine 100-Punkte-Ausprägung hat. Wer Punkte vergibt oder Stufenschwellen setzt,
müsste die Höchstpunktzahl im Kopf ausrechnen. Konkret berichtet: „Die Summe der Punktzahl
kann nicht gut abgeschätzt werden, da ich gar nicht auswendig weiß, was die maximale
Punktzahl nach der Definition der Kriterien ist."

Folgen ohne diese Information: Stufenschwellen, die niemand erreicht; Punktwerte, deren
Wirkung auf das Gesamtergebnis unklar bleibt; Ergebnisse, die kleiner wirken, als sie sind.

## User Scenarios

### US1 — Beim Definieren sehen, was ein Kriterium beiträgt (P1)

**Akzeptanz**
1. Jeder Punktregel-Block (Auswahl, Zahlenbereich, Ja/Nein) nennt die Punktspanne des
   Kriteriums — im Workflow-Editor (Schritt 1) und im Profil-Editor gleichlautend.
2. Vergeben alle Ausprägungen dieselbe Punktzahl, benennt der Hinweis das ausdrücklich:
   das Kriterium unterscheidet dann nicht zwischen Leads.
3. Der Hinweis zieht beim Tippen mit, ohne dass das Feld den Fokus verliert.

### US2 — Die erreichbare Gesamtpunktzahl kennen (P1)

**Akzeptanz**
1. Schritt 1 des Workflows und der Stufen-Bereich des Profil-Editors nennen die
   erreichbare Spanne des Gesamtscores bei vollständigen Daten.
2. Liegt das Maximum unter 100, wird der Grund genannt (kein Kriterium mit
   100-Punkte-Ausprägung), statt die Zahl unkommentiert zu zeigen.
3. Die Angabe aktualisiert sich sofort, wenn Punkte, Gewichte oder Kriterien geändert
   werden.

### US3 — Unerreichbare Stufen erkennen (P2)

**Akzeptanz**
1. Liegt die Schwelle einer Stufe über der Höchstpunktzahl, wird sie benannt — mit der
   Höchstpunktzahl und dem Hinweis, Schwelle zu senken oder Punkte anzuheben.
2. Das ist ein Hinweis, kein Fehler: Speichern bleibt möglich (die Validierung aus
   Feature 001 bleibt unverändert).

### US4 — Ergebnisse einordnen (P2)

**Akzeptanz**
1. Die Einzelbewertung eines Leads zeigt neben der Skala „von 100", welches Maximum die
   Kriterien tatsächlich hergeben.
2. Die Rangliste nennt die erreichbare Spanne des Profils.

## Regeln (verbindlich)

Die Herleitung steht in `specs/001-icp-lead-scoring/contracts/scoring-engine.md`,
Abschnitt „Erreichbare Punktzahl" (Regeln 8–10) und ist dort zuerst zu ändern.

- `criterionPointRange`, `scoreRange` und `unreachableTiers` sind pure Funktionen in
  `docs/js/core/scoring.js` — kein DOM, keine Uhrzeit, kein Zufall (Verfassung II, V).
- Die Spanne wird zur Renderzeit berechnet und **nie gespeichert** — wie Bewertungen
  selbst (Verfassung II).
- Die Spanne gilt für vollständige Leads. Bei Policy `neutral` verschiebt ein fehlender
  Wert die Normierung; die UI sagt deshalb „bei vollständigen Daten" statt „immer".

## Ausdrücklich nicht enthalten

- Keine automatische Korrektur von Punkten oder Schwellen. Das Werkzeug rechnet vor,
  entscheidet aber nicht — die Gewichtung bleibt eine fachliche Setzung.
- Keine Warnung beim Speichern. Ein Profil mit unerreichbarer Stufe kann gewollt sein
  (z. B. während des Aufbaus) und bleibt gültig.
