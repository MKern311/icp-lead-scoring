# Feature Specification: Granulares Zweiphasen-Screening

**Feature Branch**: `004-deep-screening`

**Created**: 2026-08-11

**Status**: Approved (Plan-Modus-Freigabe 2026-08-11)

**Input**: User description: "Recherchiere gründlich und erstelle einen Plan, wie dieser Workflow besser gebaut werden kann, sodass ein sehr granulares Screening erfolgen kann. Bedenke dabei sehr sorgfältig, wie bzw. welche Kriterien du recherchieren kannst."

## Clarifications

### Session 2026-08-11

- Q: Tiefen-Screening auch für manuell eingegebene Firmennamen? → A: Ja — Name +
  optionale Website als Suchparameter (kein Bestands-Lead, verfassungskonform).
- Q: Empfohlener Umfang des Tiefen-Screenings? → A: 5–10 Unternehmen empfohlen,
  Warnhinweis ab 15, kein hartes Limit (nur Kostenschätzung).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Longlist: Kandidaten über Klassen-Filter finden (Priority: P1)

Der Nutzer bestätigt in Schritt 1 seine Kriterien (erweiterter, kategorisierter
Katalog) und startet in Schritt 2 die Longlist-Suche: Sie nutzt ausschließlich die
Auswahl-Kriterien (Klassen) als Filter — angeklickte Suchpräferenzen wirken als harte
Filter — und liefert eine schlanke Kandidatenliste (Name, Website, Klassen-Werte,
Begründung, Quellen) mit geringem Suchbudget.

**Why this priority**: Ohne treffsichere, günstige Kandidatensuche gibt es nichts,
das granular vertieft werden könnte.

**Acceptance Scenarios**:

1. **Given** ein Profil mit Auswahl-Kriterien (Branche, Größe) und angeklickten
   Präferenzen, **When** die Longlist startet, **Then** enthält die Anfrage nur die
   Auswahl-Kriterien mit den Präferenzen als harte Filter — keine Signal-, Skalen-
   oder Zahlenbereichs-Kriterien, keine Gewichte/Punkte.
2. **Given** das Profil hat kein Auswahl-Kriterium im Pre-Screening, **When**
   Schritt 2 erreicht wird, **Then** erklärt das Tool die Voraussetzung und verweist
   auf den Katalog.

---

### User Story 2 - Tiefen-Screening je Unternehmen (Priority: P1)

Der Nutzer wählt Kandidaten aus der Longlist (oder gibt eigene Firmennamen ein) und
startet das Tiefen-Screening: **je Unternehmen ein eigener Recherche-Lauf** über alle
Pre-Screening-Kriterien mit eigenem Suchbudget. Jeder Wert kommt mit Quelle,
**Konfidenz** (belegt/abgeleitet) und **Belegdatum** (JJJJ-MM). Werte ohne Quelle
werden verworfen. Der Lauf zeigt Fortschritt je Firma, ist abbrechbar und
fortsetzbar; Teilergebnisse bleiben erhalten. Kosten- und Zeitschätzung vor dem
Start; Empfehlung 5–10 Firmen, Warnung ab 15.

**Why this priority**: Das ist die eigentliche Granularität — fokussiertes
Suchbudget je Firma statt verdünnter Sammellauf.

**Acceptance Scenarios**:

1. **Given** 3 ausgewählte Kandidaten, **When** das Tiefen-Screening läuft, **Then**
   wird je Firma sequenziell recherchiert („Unternehmen 2 von 3"), und jedes Ergebnis
   zeigt pro Kriterium Wert, Quelle, Konfidenz-Badge und Belegdatum.
2. **Given** ein laufendes Tiefen-Screening, **When** der Nutzer abbricht, **Then**
   bleiben fertige Firmen erhalten und der Lauf kann fortgesetzt werden.
3. **Given** ein manuell eingegebener Firmenname ohne Website, **When** die Firma
   geprüft wird, **Then** identifiziert die Recherche zuerst die offizielle Website
   und recherchiert dann die Kriterien; ist die Firma nicht eindeutig
   identifizierbar, wird das als Fehler je Firma ausgewiesen.
4. **Given** ein Deep-Ergebnis liefert einen Wert ohne Quelle, **When** geparst wird,
   **Then** bleibt der Wert offen und eine Warnung erscheint.

---

### User Story 3 - Übernahme mit Konfidenz & Qualifizierung (Priority: P2)

Der Nutzer übernimmt geprüfte Firmen als Leads; Konfidenz und Belegdatum wandern mit
und sind in der Lead-Einzelansicht neben der Quelle sichtbar. Danach führt Schritt 4
(bisherige Qualifizierung) unverändert durch die nicht recherchierbaren Kriterien.
Alternativ können Longlist-Kandidaten ohne Tiefen-Screening übernommen werden.

**Acceptance Scenarios**:

1. **Given** eine tief recherchierte Firma wird übernommen, **When** die
   Lead-Einzelansicht geöffnet wird, **Then** zeigt jedes recherchierte Feld Quelle,
   Konfidenz („belegt"/„abgeleitet") und Belegdatum; die Bewertung ist identisch zur
   manuellen Eingabe derselben Werte.
2. **Given** der Nutzer überspringt das Tiefen-Screening, **When** er Longlist-
   Kandidaten direkt übernimmt, **Then** verhält sich alles wie in Feature 003.

---

### Edge Cases

- Firma in Deep nicht identifizierbar (`found: false`) ⇒ Fehlerstatus je Firma,
  Lauf geht weiter; „Erneut versuchen" möglich.
- Rate-Limit (429) mitten im Sequenzlauf ⇒ Lauf pausiert, Firma als Fehler markiert,
  „Fortsetzen" ohne Auto-Retry (Kostenprinzip).
- Navigation/Reload während des Deep-Laufs ⇒ nicht übernommene Ergebnisse gehen
  verloren (flüchtiger Zustand, FR-010 aus 003); Hinweis im UI.
- Kleine Kapitalgesellschaften publizieren keinen Umsatz ⇒ Umsatzklasse oft
  „abgeleitet" oder offen (in Katalog-Beschreibung dokumentiert).
- Deep-Screening ist für gespeicherte Leads nicht erreichbar (Verfassung III:
  niemals Bestands-Leads übertragen).

## Requirements *(mandatory)*

- **FR-401**: Die Longlist-Anfrage MUSS ausschließlich Pre-Screening-Kriterien vom
  Typ Auswahlliste enthalten; nicht-leere Suchpräferenzen wirken als harte Filter
  („Erforderlich: …"). Ohne solches Kriterium MUSS der Start mit Erklärung gesperrt
  sein.
- **FR-402**: Das Tiefen-Screening MUSS je Unternehmen einen eigenen Recherche-Lauf
  ausführen (alle Pre-Screening-Kriterien, eigenes Suchbudget) — sequenziell mit
  Fortschrittsanzeige, Abbruch, Fortsetzen und Wiederholung je Firma.
- **FR-403**: Jeder recherchierte Wert MUSS Quelle, Konfidenz (belegt/abgeleitet)
  und — wenn bestimmbar — Belegdatum (JJJJ-MM) tragen; Werte ohne Quelle werden
  verworfen (Warnung). Beleg-Typ muss zum Signal passen (Stellen-Signale nur
  Jobportal/Karriereseite, News-Signale nur Presse).
- **FR-404**: Tiefen-Screening MUSS für Longlist-Kandidaten des laufenden Laufs und
  für manuell eingegebene Firmen (Name + optionale Website) möglich sein — niemals
  für gespeicherte Leads.
- **FR-405**: Longlist-Werte und Deep-Werte MÜSSEN zusammengeführt werden (Deep
  gewinnt, Longlist als Fallback); übernommene Leads tragen Konfidenz und Belegdatum
  je Wert, sichtbar in der Lead-Einzelansicht.
- **FR-406**: Vor jedem Lauf MUSS eine Kostenschätzung erscheinen (Longlist gesamt;
  Tiefen-Screening je Firma × Anzahl); ab 15 Firmen zusätzlich ein Warnhinweis,
  Empfehlung 5–10.
- **FR-407**: Der Katalog MUSS auf ~23 kategorisierte, granulare Kriterienarten
  erweitert werden (Firmografie, Wachstum & Dynamik, Digitale Präsenz, Markt &
  Netzwerk) — je Eintrag mit Belegquelle; Signale einzeln und konkret (u. a.
  Stellenanzeigen nach Funktionsbereich getrennt). Kein neuer Kriterientyp, kein
  neues Profil-Exportschema.
- **FR-408**: Der Workflow MUSS vierstufig führen: Kriterien → Kandidaten finden →
  Tiefen-Screening (optional überspringbar) → Qualifizierung; der Wiedereinstieg
  mit offenen Screening-Leads zielt auf die Qualifizierung.
- **FR-409**: Konfidenz und Belegdatum sind Metadaten — die Bewertung
  (`evaluate`) bleibt davon nachweislich unbeeinflusst.

## Success Criteria *(mandatory)*

- **SC-401**: Longlist-Request enthält keine Nicht-Auswahl-Kriterien, keine
  Gewichte/Punkte/Stufen/Leads (testverankert).
- **SC-402**: Deep-Request enthält nur Name, Website, Region und
  Pre-Screening-Kriterien — keine Longlist-Werte, keine anderen Kandidaten, keine
  Gewichte/Punkte/Qualifizierungskriterien (testverankert).
- **SC-403**: Werte ohne Quelle erscheinen nie als belegte Werte (testverankert).
- **SC-404**: Ein übernommener Deep-Lead scored identisch zu einem manuell erfassten
  Lead mit gleichen Werten, mit und ohne Konfidenz-Metadaten (testverankert).
- **SC-405**: Alle bestehenden Tests bleiben grün; Katalog-Einträge validieren
  vollständig.

## Assumptions

- Kostenrichtwerte: Longlist ~0,3–0,8 €; Tiefen-Screening ~0,15–0,35 € und
  2–3 Minuten je Firma (sequenziell) — Schätzwerte, keine Abrechnung.
- Quellenlage DACH (verifiziert per Webrecherche + realem Testlauf):
  Pflichtveröffentlichungen (Bundesanzeiger, z. B. via Northdata-Basisansicht),
  Handelsregister-Bekanntmachungen, Impressen, Firmenverzeichnisse, Jobportale,
  Presse, Messe-Ausstellerlisten, öffentliche LinkedIn-/Kununu-Übersichten —
  alles ohne Login; Login-/Paywall-Inhalte bleiben ausgeschlossen.
