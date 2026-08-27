# Feature 010: Vollsicherung (Profil und Leads in einer Datei)

**Status**: umgesetzt · **Datum**: 2026-08-27
**Basis**: Features 001–009

## Problem

Alle Daten liegen ausschließlich im Browser (Verfassung III) — und dort getrennt nach
Browser **und** Adresse. Wer lokal unter `http://localhost:8080` recherchiert und später
die veröffentlichte Seite öffnet, findet dort nichts; ein geleerter Website-Speicher
löscht den Stand endgültig. Am 27.08.2026 trat genau das auf: Das Profil schien
verschwunden, lag aber im eingebauten Browser von VS Code, während in Chrome gesucht wurde.

Vorhandene Ausgänge decken das nicht ab: Der Profil-Export und der Profil-Code tragen
bewusst **keine** Leads, der CSV-Export trägt **kein** Profil. Es fehlte ein Ausgang,
der den Stand vollständig sichert.

## User Scenarios

### US1 — Stand in einem Schritt sichern (P1)

**Akzeptanz**
1. „Sicherung" legt Profil **und** alle zugehörigen Leads als **eine** JSON-Datei ab —
   erreichbar in der Profil-Übersicht je Profil und in der Rangliste für das aktive Profil.
2. Der Dateiname nennt Profil und Datum (`icp-sicherung-<profil>-<JJJJ-MM-TT>.json`).
3. Die Sicherung enthält nie den API-Schlüssel.
4. Sie enthält keine Punktzahlen — die werden beim Anzeigen immer neu berechnet.

### US2 — Stand vollständig wiederherstellen (P1)

**Akzeptanz**
1. „Sicherung oder Profil laden" nimmt beide Formate an: die Sicherung (mit Leads) und
   den bisherigen Profil-Export (ohne). Das Format wird an `format` erkannt, nicht am
   Dateinamen.
2. Nach dem Einlesen sind Kriterienwerte, Quellenangaben, Belegdaten, Websites und
   Notizen der Leads wieder da; die Bewertung ergibt exakt dieselbe Punktzahl wie vorher.
3. Die Wiederherstellung überschreibt nichts: Sie legt ein neues Profil mit neuen
   Kennungen an, der Name wird bei Bedarf eindeutig gemacht.
4. Eine unbrauchbare Datei führt zu einer konkreten deutschen Meldung — nie zu einem
   halb angelegten Profil.
5. Was übernommen, aber bereinigt wurde (Leads ohne Namen, Werte zu nicht mehr
   vorhandenen Kriterien), wird gemeldet, statt still zu verschwinden.

### US3 — Wissen, was welcher Ausgang mitnimmt (P2)

**Akzeptanz**
1. Die Profil-Übersicht erklärt in einem Satz den Unterschied: Sicherung = Profil und
   Leads; Exportieren und Code teilen = nur das Profil.
2. Sie benennt, dass die Daten nur in diesem Browser liegen und je Adresse getrennt sind.

## Regeln (verbindlich)

Format und Prüfregeln stehen in `contracts/backup-format.md` und sind dort zuerst zu ändern.

- `core/backup.js` ist pure und DOM-frei; nur diese Ebene wird getestet.
- Die Sicherung trägt die internen IDs von Kriterien, Ausprägungen und Stufen — anders
  als der Profil-Export, der zum Teilen dient. Begründung im Contract, Regel 1.
- Wiederherstellen legt immer neu an und überschreibt nie (Contract, Regel 2).

## Ausdrücklich nicht enthalten

- **Keine automatische Sicherung.** Der Browser darf nichts ungefragt herunterladen; eine
  Sicherung ohne bewussten Anstoß wäre außerdem nicht auffindbar, wenn man sie braucht.
- **Kein Server, keine Cloud.** Das würde die lokale Datenhoheit aufgeben (Verfassung III).
  Wohin die Datei kommt, entscheidet der Mensch.
- **Kein Zusammenführen** zweier Bestände. Eine Wiederherstellung legt neu an; Leads
  zwischen Profilen bewegt weiterhin der CSV-Weg.
