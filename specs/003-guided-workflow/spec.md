# Feature Specification: Geführter Screening-Workflow

**Feature Branch**: `003-guided-workflow`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Geführter Workflow durch den Screening-Prozess: Statt getrennter Ansichten führt die App den Nutzer aktiv durch drei Schritte. Schritt 1: Beim Profil werden die Pre-Screening-Kriterien aktiv in einem Workflow abgefragt (der Nutzer legt geführt fest bzw. bestätigt, welche Kriterien online recherchierbar sind und mit welchen Werten gesucht wird). Schritt 2: Anschließend erfolgt das Online-Screening mit diesen Kriterien. Schritt 3: Danach erfolgt die manuelle Bewertung der weiteren Kriterien (Qualifizierungsphase) für die übernommenen Kandidaten — geführt Lead für Lead, wobei die recherchierten Pre-Screening-Werte samt Quellen sichtbar sind und nur noch die Qualifizierungskriterien erfasst werden."

## Clarifications

### Session 2026-08-10

- Q: Wo soll der geführte Workflow in der App leben? → A: Er ersetzt den bisherigen
  Nav-Punkt „Screening"; die bisherige Einzelansicht geht in Schritt 2 auf.
- Q: Wie fragt Schritt 1 die Phasen-Zuordnung ab? → A: Alle Kriterien als Liste auf
  einer Seite; jede Zuordnung muss aktiv bestätigt werden, „Weiter" erst, wenn kein
  Kriterium mehr offen ist.
- Q: Such-Zielwerte je Pre-Screening-Kriterium erfassen? → A: Ja — optionaler
  Freitext-Suchhinweis je Kriterium, wird bei der Recherche als Hinweis übertragen
  (weiterhin nie Gewichte, Punktwerte oder Stufen).
- Q: Warteschlange von Schritt 3 beim Wiedereinstieg ohne frischen Lauf? → A:
  Gespeicherte Screening-Leads mit offenen Qualifizierungskriterien.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Schritt 1: Pre-Screening-Kriterien aktiv festlegen (Priority: P1)

Ein Nutzer mit aktivem Profil startet den geführten Workflow. Schritt 1 zeigt alle
Kriterien des Profils als Liste; zu jedem Kriterium muss der Nutzer aktiv entscheiden
oder bestätigen, ob es online recherchierbar ist (Pre-Screening) oder erst im
Kundenkontakt bewertbar (Qualifizierung — 2. Screening). Bereits zugeordnete Phasen
werden als Vorschlag angezeigt. Zu jedem Pre-Screening-Kriterium kann der Nutzer
optional einen Suchhinweis erfassen (Freitext, z. B. „bevorzugt 50–250 Mitarbeiter"),
der beschreibt, wonach gesucht werden soll. Danach erfasst der Workflow die
Suchparameter des Laufs (Region, Kandidatenzahl, globale Hinweise). Zuordnungen und
Suchhinweise werden im Profil gespeichert — dieselben Daten, die auch der
Profil-Editor pflegt.

**Why this priority**: Ohne aktiv bestätigte Phasen-Zuordnung startet kein sinnvolles
Screening; dieser Schritt ist das Fundament des Workflows und behebt das heutige Problem,
dass die Zuordnung passiv im Profil-Editor versteckt ist.

**Independent Test**: Mit einem Profil ohne Pre-Screening-Kriterien den Workflow starten,
alle Kriterien geführt zuordnen und prüfen, dass die Zuordnung im Profil-Editor und im
Profil-Export sichtbar ist — auch ohne dass je ein Screening läuft.

**Acceptance Scenarios**:

1. **Given** ein aktives Profil mit fünf Kriterien ohne bewusste Phasen-Zuordnung,
   **When** der Nutzer den Workflow startet, **Then** zeigt Schritt 1 alle Kriterien
   als Liste mit Name, Beschreibung und Phasen-Wahl, und „Weiter" ist erst möglich,
   wenn jedes Kriterium aktiv zugeordnet oder bestätigt wurde.
2. **Given** der Nutzer hat alle Kriterien zugeordnet und zu einem Pre-Screening-
   Kriterium einen Suchhinweis erfasst, **When** er Schritt 1 abschließt, **Then**
   sind Zuordnungen und Suchhinweise im Profil gespeichert und die Suchparameter
   (Region, Anzahl, globale Hinweise) abgefragt.
3. **Given** der Nutzer bricht in Schritt 1 ab, **When** er den Workflow später erneut
   startet, **Then** zeigen die bereits getroffenen Zuordnungen ihren gespeicherten Stand
   als Vorschlag.

---

### User Story 2 - Schritt 2: Online-Screening im Workflow (Priority: P2)

Nach Abschluss von Schritt 1 führt der Workflow direkt in das Online-Screening: Der
Lauf startet mit den soeben bestätigten Pre-Screening-Kriterien und Suchparametern,
zeigt Fortschritt und Ergebnis (Kandidaten mit Quellen), und der Nutzer wählt aus,
welche Kandidaten als Leads übernommen werden. Die Screening-Regeln sind unverändert
die von Feature 002 (nur Pre-Screening-Kriterien werden übertragen, eigener Schlüssel,
Quellenpflicht).

**Why this priority**: Der Übergang von der Kriterien-Bestätigung zum Lauf ohne
Ansichtswechsel ist der Kern des Workflow-Gedankens; das Screening selbst existiert
bereits.

**Independent Test**: Mit einem Profil mit Pre-Screening-Kriterien und hinterlegtem
Schlüssel Schritt 2 durchlaufen und prüfen, dass übernommene Kandidaten als Leads mit
Quelle „Screening" in der Rangliste erscheinen.

**Acceptance Scenarios**:

1. **Given** Schritt 1 ist abgeschlossen und ein API-Schlüssel ist hinterlegt,
   **When** der Nutzer Schritt 2 startet, **Then** läuft das Screening mit den
   bestätigten Kriterien und Parametern und zeigt die Kandidatenliste zur Auswahl.
2. **Given** kein API-Schlüssel ist hinterlegt, **When** der Nutzer Schritt 2 erreicht,
   **Then** erklärt der Workflow die Voraussetzung und bietet die Schlüssel-Eingabe an
   Ort und Stelle an.
3. **Given** der Nutzer übernimmt eine Auswahl von Kandidaten, **When** die Übernahme
   abgeschlossen ist, **Then** bietet der Workflow den direkten Übergang zu Schritt 3
   mit genau diesen Leads an.
4. **Given** der Lauf schlägt fehl oder liefert keine Kandidaten, **When** der Fehler
   angezeigt wird, **Then** kann der Nutzer den Lauf mit angepassten Parametern
   wiederholen oder den Workflow verlassen, ohne dass etwas gespeichert wurde.

---

### User Story 3 - Schritt 3: Geführte Qualifizierung Lead für Lead (Priority: P3)

Nach der Übernahme führt der Workflow durch die übernommenen Leads — einen nach dem
anderen. Je Lead sind die recherchierten Pre-Screening-Werte samt Quellen und Website
sichtbar, aber nicht editierbar; erfasst werden nur die Qualifizierungskriterien.
Die Bewertung (Score, Status, Stufe) aktualisiert sich live. Der Nutzer kann speichern
und zum nächsten Lead gehen, einen Lead überspringen oder zurückgehen. Am Ende steht
eine Zusammenfassung (wie viele Leads qualifiziert, Verteilung auf Stufen) mit Link
zur Rangliste.

**Why this priority**: Schließt den Kreis vom Screening zur fertigen Bewertung; baut
auf US1 und US2 auf und ist ohne diese nicht sinnvoll nutzbar.

**Independent Test**: Nach einer Übernahme von drei Kandidaten Schritt 3 durchlaufen:
je Lead nur Qualifizierungsfelder ausfüllen, Live-Score beobachten, am Ende die
Zusammenfassung mit der Rangliste abgleichen.

**Acceptance Scenarios**:

1. **Given** drei übernommene Leads, **When** Schritt 3 beginnt, **Then** zeigt die
   Ansicht „Lead 1 von 3" mit Pre-Screening-Werten samt Quellen (nur lesbar) und
   Eingabefeldern ausschließlich für Qualifizierungskriterien.
2. **Given** der Nutzer erfasst Werte für einen Lead, **When** er „Speichern & weiter"
   wählt, **Then** ist der Lead gespeichert und der nächste Lead wird angezeigt.
3. **Given** der Nutzer überspringt einen Lead, **When** die Warteschlange endet,
   **Then** zeigt die Zusammenfassung übersprungene Leads als offen an.
4. **Given** ein K.o.-Kriterium wird mit „nicht erfüllt" erfasst, **When** der
   Live-Score aktualisiert, **Then** ist der Status „Disqualifiziert" sofort sichtbar
   und der Nutzer kann dennoch speichern und weitergehen.

---

### Edge Cases

- Kein aktives Profil beim Workflow-Start: Der Workflow erklärt die Voraussetzung und
  verweist auf die Profil-Anlage, statt leer zu starten.
- Nutzer ordnet in Schritt 1 alle Kriterien der Qualifizierung zu: Schritt 2 ist
  gesperrt mit Erklärung; der Nutzer kann zurück zu Schritt 1 oder den Workflow
  verlassen.
- Browser wird mitten im Workflow geschlossen: Alles bereits Gespeicherte
  (Phasen-Zuordnungen, übernommene Leads) bleibt erhalten; der Workflow startet beim
  Wiedereinstieg regulär bei Schritt 1, bereits erledigte Entscheidungen erscheinen
  als Vorschlag.
- Wiedereinstieg ohne neuen Lauf: Gibt es gespeicherte Screening-Leads mit offenen
  Qualifizierungskriterien, bietet der Workflow an, direkt mit deren Qualifizierung
  (Schritt 3) fortzufahren.
- Profil wird während des Workflows in einem anderen Tab geändert: Der Workflow
  arbeitet stets auf dem gespeicherten Profilstand; beim Schrittwechsel wird neu
  gelesen.
- Offline: Schritt 1 und 3 funktionieren offline; Schritt 2 erklärt bei fehlender
  Verbindung den Netzbedarf (Verfassungsausnahme bleibt eng begrenzt).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Der Workflow MUSS den bisherigen Navigationspunkt „Screening" ersetzen
  (ein einziger Einstieg) und die drei Schritte mit sichtbarem Fortschritt
  (Schrittanzeige) führen.
- **FR-002**: Schritt 1 MUSS alle Kriterien des aktiven Profils als Liste präsentieren
  (Name, Beschreibung, aktuelle Phase als Vorschlag) und je Kriterium eine aktive
  Entscheidung Pre-Screening/Qualifizierung verlangen; der Übergang zu Schritt 2 DARF
  erst möglich sein, wenn kein Kriterium mehr unbestätigt ist. Zuordnungen MÜSSEN
  unmittelbar im Profil gespeichert werden und identisch mit der Zuordnung im
  Profil-Editor sein.
- **FR-003**: Schritt 1 MUSS je Pre-Screening-Kriterium einen optionalen Suchhinweis
  (Freitext) anbieten, der im Profil gespeichert wird, und anschließend die
  Suchparameter des Laufs (Region, Kandidatenzahl, globale Hinweise) abfragen und mit
  den bekannten Vorgaben vorbelegen.
- **FR-004**: Schritt 2 DARF NUR startbar sein, wenn mindestens ein
  Pre-Screening-Kriterium zugeordnet und ein API-Schlüssel hinterlegt ist; andernfalls
  MUSS der Workflow die fehlende Voraussetzung erklären und ihre Behebung an Ort und
  Stelle anbieten (Schlüssel-Eingabe bzw. Rücksprung zu Schritt 1).
- **FR-005**: Schritt 2 MUSS das Online-Screening mit den bestätigten Kriterien und
  Parametern ausführen und dabei denselben Regeln folgen wie das bestehende Screening
  (Übertragung nur der Pre-Screening-Kriterien, Quellenpflicht, keine Speicherung ohne
  Übernahme).
- **FR-006**: Nach der Übernahme MUSS der Workflow direkt in Schritt 3 überleiten;
  die Warteschlange von Schritt 3 besteht aus genau den soeben übernommenen Leads.
- **FR-007**: Schritt 3 MUSS je Lead die Pre-Screening-Werte samt Quellen und Website
  nur lesbar anzeigen und Eingaben ausschließlich für Qualifizierungskriterien anbieten;
  die Live-Bewertung (Score, Status, Stufe) MUSS sich bei jeder Eingabe aktualisieren.
- **FR-008**: Schritt 3 MUSS die Navigation „Speichern & weiter", „Überspringen" und
  „Zurück" sowie die Position in der Warteschlange („Lead n von m") anbieten.
- **FR-009**: Nach dem letzten Lead MUSS eine Zusammenfassung erscheinen: Anzahl
  bearbeiteter und übersprungener Leads, Verteilung auf Bewertungsstufen, Verweis auf
  die Rangliste.
- **FR-010**: Der Workflow MUSS jederzeit verlassen werden können; dabei DÜRFEN keine
  über das explizit Gespeicherte hinausgehenden Daten verloren gehen oder zurückbleiben.
  Der Workflow-Zustand selbst wird nicht dauerhaft gespeichert, sondern ergibt sich aus
  den gespeicherten Daten (Profil, Leads, Schlüssel).
- **FR-011**: Beim Wiedereinstieg MUSS der Workflow erkennen, ob gespeicherte
  Screening-Leads mit offenen Qualifizierungskriterien existieren, und deren
  Qualifizierung als direkten Einstieg in Schritt 3 anbieten.
- **FR-012**: Die übrigen Einzelansichten (Profile, Profil-Editor, Leads, Rangliste,
  CSV-Import) MÜSSEN unverändert nutzbar bleiben; die bisherige Screening-Einzelansicht
  geht in Schritt 2 des Workflows auf und entfällt als eigener Einstieg.
- **FR-013**: Erfasste Suchhinweise je Kriterium MÜSSEN bei der Recherche als Hinweise
  übertragen werden; die Verfassungsgrenze bleibt unverändert — niemals Gewichte,
  Punktregeln, Stufen, Leads oder Bewertungen.

### Key Entities

- **Kriterium (erweitert)**: Erhält einen optionalen Suchhinweis (Freitext), der
  beschreibt, wonach online gesucht werden soll; wird mit dem Profil gespeichert und
  beim Profil-Export mitgegeben. Nur für Pre-Screening-Kriterien relevant.
- **Workflow-Schritt**: Flüchtiger Zustand der Führung (Schritt 1–3, Position in der
  Warteschlange); wird nicht dauerhaft gespeichert.
- **Qualifizierungs-Warteschlange**: Geordnete Menge der in Schritt 3 zu bearbeitenden
  Leads; ergibt sich aus der Übernahme in Schritt 2 bzw. beim Wiedereinstieg aus
  gespeicherten Screening-Leads mit offenen Qualifizierungskriterien.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein Nutzer gelangt vom Workflow-Start bis zur abgeschlossenen
  Qualifizierung übernommener Kandidaten ohne einen einzigen Wechsel in eine andere
  Ansicht (ein durchgehender geführter Pfad).
- **SC-002**: Nach Abschluss von Schritt 1 hat jedes Kriterium des Profils eine aktiv
  bestätigte Phase; keine Zuordnung bleibt unbestätigt.
- **SC-003**: In Schritt 3 sind Pre-Screening-Werte in 100 % der Fälle sichtbar, aber
  nicht editierbar; editierbar sind ausschließlich Qualifizierungskriterien.
- **SC-004**: Ein Abbruch des Workflows an beliebiger Stelle führt zu keinem Verlust
  gespeicherter Daten: Phasen-Zuordnungen und übernommene Leads sind nach Abbruch
  unverändert vorhanden, nicht übernommene Kandidaten nirgends gespeichert.
- **SC-005**: Die Zusammenfassung am Ende von Schritt 3 stimmt mit der Rangliste
  überein (gleiche Anzahl bewerteter Leads, gleiche Stufen-Zuordnung).
- **SC-006**: Alle bestehenden Tests bleiben grün; die Bewertungslogik bleibt
  unverändert (identische Scores wie bei manueller Erfassung über die Einzelansichten).

## Assumptions

- Der Workflow ersetzt den bisherigen Navigationspunkt „Screening"; Profil-, Lead-
  und Ranglisten-Ansichten bleiben unverändert bestehen (Verfassung IV:
  Wiederverwendung statt Parallelstrukturen).
- Schritt 1 schreibt in dieselben Profildaten wie der Profil-Editor; es gibt keine
  separate „Workflow-Zuordnung".
- Die Warteschlange in Schritt 3 umfasst die im aktuellen Durchlauf übernommenen Leads;
  beim Wiedereinstieg ohne neuen Lauf werden gespeicherte Screening-Leads mit offenen
  Qualifizierungskriterien angeboten.
- Der Workflow-Zustand wird nicht persistiert; nach Neuladen beginnt die Führung von
  vorn, gespeicherte Daten bleiben maßgeblich.
- UI-Sprache Deutsch, bestehende Konventionen (Bestätigungsdialoge, Toasts, Escaping)
  gelten unverändert.
- Bewertungen werden weiterhin nie gespeichert, sondern stets aus Profil und Lead
  berechnet.
