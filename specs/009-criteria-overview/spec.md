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
2. Die Gewichtssumme steht in der Kopfzeile der Übersicht; weicht sie von 100 % ab, steht
   dort auch „Auf 100 normieren".
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

## Regeln (verbindlich)

- Reine UI — keine neue Kernlogik, keine neuen Persistenzschlüssel. Die Übersicht liest
  und schreibt dieselbe Arbeitskopie (`working`) wie die Karten.
- Doppelt gebundene Felder werden über `syncBoundFields` abgeglichen, nicht über ein
  Neuzeichnen: Ein Redraw beim Tippen würde den Fokus aus dem Feld werfen (dieselbe
  Regel wie in Feature 007 für den Kriterien-Editor im Workflow).
- Die Gewichtssumme steht an zwei Stellen und wird deshalb über `[data-weight-sum]`
  aktualisiert, nicht über eine ID.
- Die Tabelle behält eine lesbare Mindestbreite und scrollt auf schmalen Bildschirmen in
  ihrem Container; die Seite selbst scrollt nie horizontal.

## Ausdrücklich nicht enthalten

- Keine Punktregeln in der Übersicht. Ausprägungen samt Punkten gehören in die Karte —
  in einer Zeile wären sie weder lesbar noch bedienbar.
- Kein zweiter Ort für dieselbe Entscheidung: Die Übersicht ergänzt die Karten, sie
  ersetzt sie nicht.
