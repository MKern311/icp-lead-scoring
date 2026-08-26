# Feature 005: Recherche-Qualität & Arbeitsfähigkeit im Zweiphasen-Screening

**Status**: umgesetzt · **Datum**: 2026-08-26
**Basis**: Features 002–004 (Screening-Kern, geführter Workflow, Zweiphasen-Screening)

## Ausgangslage

Der vierstufige Workflow steht und ist testabgedeckt. Ein Review vor der ersten
Validierung mit echtem API-Schlüssel zeigte fünf Lücken, die alle die Qualität der
Recherche oder die Arbeitsfähigkeit in den beiden Phasen betreffen — keine davon
verlangt neue Konzepte, alle sind Präzisierungen bestehender Abläufe.

## User Scenarios

### US1 — Belege sind zeitlich richtig eingeordnet (Priorität P1)

Als Nutzer verlasse ich mich darauf, dass „Wachstumssignal in den letzten 12 Monaten"
auch wirklich die letzten 12 Monate meint und dass ich sehe, wenn ein Beleg alt ist.

**Akzeptanz**
1. Beide Recherche-Requests (Longlist, Tiefen-Screening) nennen das heutige Datum als
   ausdrücklichen Bezugspunkt für alle Zeitangaben.
2. Ein Wert, dessen Belegdatum älter als 12 Monate ist, wird in Schritt 3, Schritt 4
   und der Lead-Einzelansicht als „Beleg veraltet" gekennzeichnet.
3. Die Kennzeichnung wird bei jedem Rendern neu berechnet und nie gespeichert — ein
   Lead altert von selbst.

### US2 — Die Suche lässt sich fortsetzen (Priorität P1)

Als Nutzer möchte ich nach einer Longlist weitere Kandidaten suchen, ohne dieselben
Unternehmen erneut zu bekommen.

**Akzeptanz**
1. „Weitere Kandidaten suchen" startet einen Lauf, der die bereits gefundenen
   Unternehmen ausdrücklich ausschließt, und hängt die neuen Treffer an die Liste an.
2. Namensgleiche Wiederholungen werden verworfen; die Zahl der verworfenen Treffer
   wird gemeldet.
3. Ausgeschlossen werden ausschließlich Kandidaten desselben Laufs — gespeicherte
   Leads verlassen das Gerät nie (Verfassung III).

### US3 — Kein Doppel-Lead aus Versehen (Priorität P2)

**Akzeptanz**
1. Kandidaten mit dem Namen eines bestehenden Leads sind nicht vorausgewählt — weder
   in der Longlist noch nach dem Tiefen-Screening.
2. Die Übernahme bleibt möglich; die Zahl der namensgleichen Übernahmen wird gemeldet.

### US4 — Bezahlte Recherche geht nicht verloren (Priorität P1)

**Akzeptanz**
1. Beim Verlassen der Screening-Ansicht mit laufender Recherche oder nicht
   übernommenen Ergebnissen erscheint eine Rückfrage — auch beim Neuladen der Seite.
2. Nach der Übernahme entfällt die Rückfrage.

### US5 — Der Ablauf ist zügig bedienbar (Priorität P2)

**Akzeptanz**
1. Alle offenen Kriterien lassen sich in Schritt 1 mit einem Klick bestätigen.
2. Region, Anzahl und globale Hinweise sind beim nächsten Start wieder vorbelegt.
3. Das Tiefen-Screening prüft zwei Unternehmen gleichzeitig; Abbruch und
   Teilergebnisse verhalten sich unverändert.
4. Nach jedem Lauf werden die tatsächlich verbrauchten Kosten angezeigt.

## Functional Requirements

- **FR-408** Beide Request-Builder nehmen ein Bezugsdatum entgegen und stellen es dem
  Prompt voran. Beleg-Alter wird pure berechnet (`isEvidenceStale`), nie gespeichert.
- **FR-409** `buildLonglistRequest` nimmt eine Ausschlussliste von Firmennamen
  entgegen (max. 150). Die UI füllt sie ausschließlich aus dem laufenden Lauf.
- **FR-410** Views mit ungesicherten, kostenpflichtigen Ergebnissen melden einen
  Verlassen-Schutz an (`setLeaveGuard`), der bei Routenwechsel und `beforeunload` greift.
- **FR-411** Suchparameter (Region, Anzahl, Hinweise) werden je Profil unter
  `icp.v1.workflow.<profileId>` gespeichert. Keine Ergebnisse, keine Bewertungen.
- **FR-412** Die Netzwerkschicht summiert `usage` über alle Fortsetzungen; die UI
  zeigt daraus die tatsächlichen Kosten (`usageCost`) je Sitzung.
- **FR-413** Mitgelieferte Vorlagen enthalten mindestens ein Auswahl-Kriterium im
  Pre-Screening, damit die Longlist ab Werk funktioniert.

## Success Criteria

- **SC-408** Beide Requests enthalten das übergebene Datum; ein ungültiges Datum
  erzeugt keine (falsche) Datumszeile. *(testverankert)*
- **SC-409** Die Ausschlussliste erscheint im Request, ist auf 150 Namen begrenzt und
  enthält weiterhin keine Gewichte, Punkte oder Qualifizierungskriterien. *(testverankert)*
- **SC-410** `isEvidenceStale` meldet Belege > 12 Monate als veraltet; unbekannte oder
  kaputte Daten nie. *(testverankert)*
- **SC-411** `usageCost` rechnet Token- und Suchkosten nach Listenpreis und liefert
  bei fehlenden Feldern 0 statt NaN. *(testverankert)*
- **SC-412** Jede Vorlage importiert fehlerfrei, hat ein Longlist-taugliches
  Auswahl-Kriterium und ihre Suchpräferenzen zeigen auf echte Ausprägungen. *(testverankert)*

## Nicht enthalten

- Automatisches erneutes Recherchieren gespeicherter Leads (Verfassung III).
- Umrechnung der Kosten in Euro — die API rechnet in USD ab, ein gepflegter
  Wechselkurs wäre eine Fehlerquelle ohne Nutzen.
