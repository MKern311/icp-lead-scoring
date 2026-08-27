# Feature 009: Kriterien-Übersicht im Profil

**Status**: umgesetzt · **Datum**: 2026-08-27
**Basis**: Features 001–008

## Problem

Der Profil-Editor zeigt jedes Kriterium als vollständige Karte mit Punktregeln. Bei fünf
oder mehr Kriterien passt keine Gewichtung mehr auf einen Blick auf den Bildschirm — wer
Gewichte austarieren oder ein Kriterium loswerden will, scrollt zwischen den Karten hin und
her. Gefordert: eine Liste, in der alle Kriterien mit ihrem Gewicht sichtbar sind und sich
direkt ändern und entfernen lassen.

## User Scenarios

### US1 — Alle Gewichte auf einen Blick (P1)

**Akzeptanz**
1. Direkt unter „Grunddaten" und **vor** den einzelnen Kriterien-Karten steht eine
   Übersicht mit einer Zeile je Kriterium: Name, Typ, Screening-Phase, Gewicht, K.-o.
2. Die Gewichtssumme steht an zwei Stellen: in der Kopfzeile (auch im zugeklappten
   Zustand sichtbar) und als Summenzeile unter der Gewichtsspalte. Die Summenzeile nennt
   zusätzlich den Abstand zu 100 % („noch 5 % bis 100 %" / „5 % über 100 %" /
   „genau 100 % — passt") und trägt die Schaltfläche „Auf 100 normieren", die bei
   exakt 100 % deaktiviert ist.
3. Die Übersicht ist ein- und ausklappbar. Der Zustand überlebt jede Änderung
   (Entfernen, Verschieben, Hinzufügen) — sie klappt nicht ungefragt wieder auf oder zu.

### US2 — Schnell ändern und entfernen (P1)

**Akzeptanz**
1. Name, Gewicht und K.-o.-Status sind direkt in der Zeile änderbar.
2. Ein Kriterium lässt sich aus der Zeile entfernen und in der Reihenfolge verschieben.
3. Ein Kriterium erscheint zweimal (Übersicht und Karte). Eine Änderung an einer Stelle
   erscheint sofort an der anderen, ohne dass das Tippen den Fokus verliert.
4. „Punktregeln" springt zur vollständigen Karte des Kriteriums und setzt den Fokus
   dorthin — Punktwerte und Ausprägungen bleiben Sache der Karte.
5. Wie im ganzen Editor gilt: Änderungen wirken erst mit „Speichern"; „Abbrechen"
   verwirft sie. Deshalb fragt das Entfernen hier nicht nach (anders als im Workflow,
   der sofort speichert).

### US3 — Sortieren (P2)

**Akzeptanz**
1. Die Spalten Kriterium, Typ, Phase, Gewicht und K.-o. sind über den Spaltenkopf
   sortierbar; ein Klick sortiert aufsteigend, der zweite absteigend, der dritte hebt die
   Sortierung wieder auf. Der aktive Kopf zeigt die Richtung (▲ / ▼).
2. Namen werden nach deutscher Sortierreihenfolge verglichen (`localeCompare(…, 'de')`),
   bei Gleichstand gilt die Profilreihenfolge.
3. Sortieren ist **reine Ansichtssache** — die gespeicherte Reihenfolge der Kriterien
   bleibt unberührt. Sie bestimmt die Feldreihenfolge im Lead-Formular und darf sich
   nicht als Nebenwirkung einer Sortierung ändern.
4. Solange sortiert wird, sind ↑ ↓ deaktiviert (mit Begründung im Titel) — Verschieben
   in einer sortierten Ansicht wäre nicht nachvollziehbar. Eine Schaltfläche
   „Sortierung aufheben" führt zurück.
5. Die Spaltenköpfe sind echte Schaltflächen (Tastatur, `aria-sort` am `<th>`) und auf
   Touch mindestens 40 px hoch.

## Regeln (verbindlich)

- Reine UI — keine neue Kernlogik, keine neuen Persistenzschlüssel. Die Übersicht liest
  und schreibt dieselbe Arbeitskopie (`working`) wie die Karten.
- Doppelt gebundene Felder werden über `syncBoundFields` abgeglichen, nicht über ein
  Neuzeichnen: Ein Redraw beim Tippen würde den Fokus aus dem Feld werfen (dieselbe
  Regel wie in Feature 007 für den Kriterien-Editor im Workflow).
- Die Gewichtssumme steht an zwei Stellen und wird deshalb über `[data-weight-sum]`
  aktualisiert, nicht über eine ID.
- Die Tabelle behält eine lesbare Mindestbreite (48 rem) und scrollt auf schmalen
  Bildschirmen in ihrem Container; die Seite selbst scrollt nie horizontal (gemessen,
  nicht am Screenshot beurteilt).
- Sortierzustand (`sortKey`, `sortDir`) ist flüchtig wie `overviewOpen` — er wird nicht
  gespeichert und nie exportiert.

## Ausdrücklich nicht enthalten

- Keine Punktregeln in der Übersicht. Ausprägungen samt Punkten gehören in die Karte —
  in einer Zeile wären sie weder lesbar noch bedienbar.
- Kein zweiter Ort für dieselbe Entscheidung: Die Übersicht ergänzt die Karten, sie
  ersetzt sie nicht.
- Keine Sortierung, die die Profilreihenfolge überschreibt. Wer die Reihenfolge dauerhaft
  ändern will, nutzt ↑ ↓ in der Profilreihenfolge.
