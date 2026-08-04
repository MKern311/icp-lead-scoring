# Contract: CSV-Import & -Export (`docs/js/core/csv.js`)

## Import (Leads)

**Akzeptierte Eingaben**: Textdateien (`.csv`, `.txt`), UTF-8 (mit oder ohne BOM);
Windows- (`\r\n`) und Unix-Zeilenenden (`\n`).

**Parser-Regeln (RFC-4180-Subset)**:

- Delimiter-Auto-Erkennung über die Kopfzeile: Es gewinnt das Zeichen (`;` oder `,`) mit den
  meisten Vorkommen außerhalb von Anführungszeichen; bei Gleichstand `;` (deutsches Excel).
- Felder optional in `"…"`; darin sind Delimiter, Zeilenumbrüche und `""` (escaptes
  Anführungszeichen) erlaubt.
- Erste Zeile = Kopfzeile (Spaltennamen). Leere Zeilen werden übersprungen.
- Zeilen mit abweichender Spaltenanzahl ⇒ Zeilenfehler (Import der übrigen Zeilen läuft
  weiter — Edge Case „fehlerhafte Zeilen").

**Spaltenzuordnung (Import-Assistent)**:

- Pflicht: genau eine Spalte → „Lead-Name". Optional: eine Spalte → „Notiz".
- Jede weitere Spalte kann genau einem Kriterium zugeordnet werden oder „ignorieren".
- Vorbelegung: exakte Namensgleichheit Spaltenkopf ↔ Kriterienname (case-insensitiv).

**Wertkonvertierung je Kriterientyp** (fehlgeschlagene Konvertierung ⇒ Wert gilt als fehlend,
Zelle wird im Fehlerbericht aufgeführt; leere Zelle ⇒ fehlender Wert ohne Fehler):

| Typ | Regel |
|-----|-------|
| select | Match gegen Options-`label`, case-insensitiv, getrimmt |
| range / scale | Zahl; Komma **oder** Punkt als Dezimaltrenner akzeptiert („12,5" = 12.5); Tausenderpunkte werden nicht unterstützt |
| boolean | wahr: `ja/yes/true/1/x`; falsch: `nein/no/false/0`; case-insensitiv |

**Fehlerbericht**: Liste `{ zeile, spalte?, grund }` — wird nach dem Import angezeigt;
Duplikate (gleicher Lead-Name wie vorhandener Lead oder innerhalb der Datei) werden gemeldet,
aber importiert (Edge Case).

## Export (bewertete Leads)

- Dateiname: `leads-bewertet-<profil-slug>-JJJJ-MM-TT.csv`
- Kodierung: UTF-8 **mit BOM** (`﻿`), Delimiter `;`, Zeilenende `\r\n` — öffnet in
  deutschem Excel per Doppelklick korrekt inkl. Umlauten.
- Alle Felder in Anführungszeichen; `"` im Inhalt als `""` escaped.
- Spalten (in dieser Reihenfolge): `Lead`, `Notiz`, je Kriterium eine Spalte mit dem
  **Rohwert** (Options-Label, Zahl, Ja/Nein), dann `Punktzahl` (1 Dezimalstelle, Dezimal-
  **Komma**), `Stufe`, `Status` (`bewertet` / `disqualifiziert` / `nicht bewertbar` /
  `unvollständig` als Zusatz-Kennzeichen in eigener Spalte `Vollständig` mit `ja/nein`).

## Rundtrip-Garantie

Ein Export ist **kein** verlustfreies Backup (berechnete Felder enthalten gerundete Werte);
für Weitergabe der Bewertungslogik ist ausschließlich der Profil-Export
([profile-export.schema.json](profile-export.schema.json)) maßgeblich. Ein exportiertes
Lead-CSV kann aber über den Import-Assistenten wieder eingelesen werden (Rohwert-Spalten
matchen die Kriteriennamen).
