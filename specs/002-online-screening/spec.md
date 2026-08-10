# Feature Specification: Zweistufiges Screening — Kriterien-Phasen & Online-Pre-Screening

**Feature Branch**: `002-online-screening`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Basierend auf den ICP-Kriterien ein Screening erstellen, das online durchläuft und Kunden in dieser Branche anhand dieser Kriterien sucht. Im Tool auswählbar, welche Kriterien recherchiert werden können. Unterscheidung zwischen Auswahlkriterien für das Pre-Screening (durch KI-Recherche) und qualitativen Kriterien für das zweite Screening. Auch Social Media und Pressenews sollen — soweit öffentlich zugänglich — durchsucht werden."

## Clarifications

### Session 2026-08-05

- Q: Wie soll das Screening umgesetzt werden? → A: Fest in die Web-App einbauen (kein externer Workflow); erfordert Constitution-Amendment v2.0.0 (Online-Ausnahme in Prinzip III).
- Q: Welchen Markt soll das Screening absuchen? → A: DACH als Voreinstellung; Region pro Lauf änderbar.
- Q: Wie viele Firmen pro Lauf? → A: ~20 kuratierte Treffer als Voreinstellung; Anzahl pro Lauf einstellbar.
- Ergänzung Nutzer: Im Tool muss auswählbar sein, welche Kriterien recherchierbar sind → jedes Kriterium erhält eine Phase: **Pre-Screening** (online recherchierbar) oder **Qualifizierung** (zweites, manuelles Screening).
- Ergänzung Nutzer: Durchsucht werden sollen neben Firmenwebsites auch Presse/News und Social Media, soweit ohne Login öffentlich zugänglich (Details: Assumptions → Datenquellen).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Kriterien in Screening-Phasen einteilen (Priority: P1)

Als Nutzer ordne ich jedem Kriterium meines ICP-Profils eine Phase zu: **Pre-Screening**
(firmografisch, online recherchierbar — z. B. Branche, Unternehmensgröße, Region) oder
**Qualifizierung** (nur im direkten Kontakt bewertbar — z. B. Budget vorhanden,
Entscheiderzugang, Schmerzpunkt). Der Profil-Editor macht die Zuordnung sichtbar; das
Lead-Formular gruppiert die Eingabefelder nach Phase, sodass das zweistufige Vorgehen
(erst Recherche, dann Gespräch) auch bei manueller Erfassung erkennbar ist.

**Why this priority**: Die Phasen-Zuordnung ist die Grundlage des Screenings — ohne sie ist
unklar, welche Kriterien online recherchiert werden dürfen (Datenschutz-Constraint der
Verfassung: nur Pre-Screening-Kriterien werden übertragen).

**Independent Test**: Profil öffnen, Kriterien den Phasen zuordnen, speichern, neu laden —
Zuordnung bleibt erhalten; Lead-Formular zeigt zwei Gruppen.

**Acceptance Scenarios**:

1. **Given** ein bestehendes Profil, **When** der Nutzer ein Kriterium auf „Pre-Screening" stellt und speichert, **Then** ist die Zuordnung nach erneutem Öffnen unverändert sichtbar.
2. **Given** ein Profil aus einer früheren Version (ohne Phasen-Feld), **When** es geöffnet wird, **Then** stehen alle Kriterien auf „Qualifizierung" (sichere Voreinstellung: nichts wird ungefragt online recherchiert).
3. **Given** ein Profil mit Kriterien beider Phasen, **When** der Nutzer einen Lead manuell erfasst, **Then** sind die Eingabefelder nach „Pre-Screening" und „Qualifizierung (2. Screening)" gruppiert.
4. **Given** die mitgelieferten Vorlagen, **When** sie geladen werden, **Then** sind firmografische Kriterien als Pre-Screening, gesprächsabhängige als Qualifizierung voreingestellt.

---

### User Story 2 - Online-Pre-Screening ausführen (Priority: P2)

Als Nutzer starte ich aus dem Tool heraus einen Recherche-Lauf: Ich hinterlege einmalig meinen
eigenen KI-API-Schlüssel (bleibt lokal im Browser), wähle Region (Voreinstellung: DACH) und
Anzahl (Voreinstellung: 20) und starte das Screening. Die Recherche sucht im öffentlichen Web
(Firmenwebsites, Presse, Verzeichnisse, Stellenanzeigen, öffentliche Social-Media-Auftritte)
nach Unternehmen, die zu den **Pre-Screening-Kriterien** meines aktiven Profils passen, und
liefert eine Kandidatenliste mit gefundenen Kriterienwerten und Quellenangaben (URLs).
Qualitative Kriterien werden nicht übertragen und bleiben leer.

**Why this priority**: Das ist der eigentliche neue Nutzen — aus dem ICP wird aktiv eine
Liste passender Unternehmen erzeugt statt nur vorhandene Leads zu bewerten.

**Independent Test**: Mit gültigem API-Schlüssel einen Lauf mit einem Profil starten, das
mindestens zwei Pre-Screening-Kriterien hat; Kandidatenliste mit Werten und mindestens einer
Quelle pro Kandidat erscheint.

**Acceptance Scenarios**:

1. **Given** ein aktives Profil mit mindestens einem Pre-Screening-Kriterium und ein hinterlegter API-Schlüssel, **When** der Nutzer den Lauf startet, **Then** zeigt das Tool den Fortschritt und anschließend eine Kandidatenliste mit Firmenname, gefundenen Werten je Pre-Screening-Kriterium und Quellen-URLs.
2. **Given** ein Profil ohne Pre-Screening-Kriterium, **When** der Nutzer die Screening-Ansicht öffnet, **Then** erklärt das Tool, dass zuerst Kriterien als „Pre-Screening" markiert werden müssen, und der Start ist gesperrt.
3. **Given** kein oder ein ungültiger API-Schlüssel, **When** der Nutzer startet, **Then** erscheint eine verständliche Fehlermeldung mit Hinweis auf die Schlüssel-Einstellung; die übrige App bleibt voll funktionsfähig.
4. **Given** ein laufendes Screening, **When** die Verbindung abbricht oder der Dienst einen Fehler meldet, **Then** zeigt das Tool den Fehler an und verwirft keine bereits eingegebenen Einstellungen.
5. **Given** ein erfolgreicher Lauf, **When** die Kandidaten angezeigt werden, **Then** ist für jeden Kandidaten erkennbar, welche Pre-Screening-Kriterien belegt werden konnten und welche nicht (Datenlücken bleiben Datenlücken — es wird nichts erfunden).

---

### User Story 3 - Kandidaten prüfen und als Leads übernehmen (Priority: P3)

Als Nutzer prüfe ich die Kandidatenliste, sehe pro Kandidat die (deterministisch aus den
gefundenen Werten berechnete) Punktzahl und wähle aus, welche Kandidaten als Leads übernommen
werden. Übernommene Leads tragen die Quelle „Screening", die gefundenen Werte samt Quellen-URLs
und erscheinen sofort in der Rangliste. Mögliche Duplikate (Name bereits im Bestand) werden
markiert. Das zweite Screening (qualitative Kriterien) ergänze ich später manuell im
Lead-Formular.

**Why this priority**: Die Prüf- und Übernahme-Stufe setzt die Verfassungs-Vorgabe um
(Recherche-Ergebnisse müssen vor Übernahme geprüft werden) und schließt den Kreis zum
bestehenden Bewertungs-Workflow.

**Independent Test**: Aus einem Lauf zwei Kandidaten auswählen und übernehmen — sie erscheinen
in der Rangliste mit Quelle „Screening" und unvollständiger Bewertung (qualitative Kriterien
offen); Quellen-URLs sind am Lead sichtbar.

**Acceptance Scenarios**:

1. **Given** eine Kandidatenliste, **When** der Nutzer einzelne Kandidaten auswählt und übernimmt, **Then** existieren genau diese als Leads mit Quelle „Screening" und den recherchierten Werten.
2. **Given** ein Kandidat mit Namensgleichheit zu einem bestehenden Lead, **When** die Liste angezeigt wird, **Then** ist er als mögliches Duplikat markiert; Übernahme bleibt möglich.
3. **Given** ein übernommener Screening-Lead, **When** der Nutzer ihn im Lead-Formular öffnet, **Then** sind die recherchierten Werte samt Quellen-Link sichtbar und die qualitativen Kriterien leer und als „2. Screening" gruppiert.
4. **Given** eine Kandidatenliste, **When** der Nutzer die Ansicht verlässt ohne zu übernehmen, **Then** wird kein Lead angelegt (Kandidaten sind flüchtig, kein stiller Import).

---

### Edge Cases

- Kein Pre-Screening-Kriterium im Profil: Screening-Start gesperrt mit Erklärungstext (US2-Szenario 2).
- API-Schlüssel fehlt/ungültig/Kontingent erschöpft: verständliche deutsche Fehlermeldung; keine Auswirkung auf Kernfunktionen.
- Recherche findet weniger Kandidaten als angefordert (z. B. 12 statt 20): Liste wird mit Hinweis angezeigt, kein Fehler.
- Recherche liefert für ein Auswahllisten-Kriterium einen Wert, der keiner Option entspricht: Wert gilt als fehlend; der gefundene Rohtext wird als Hinweis mit Quelle angezeigt, damit der Nutzer die Option ggf. ergänzen kann.
- Kandidat ohne belastbare Quelle: wird nicht angezeigt (Kuratierungs-Anspruch: keine Treffer ohne Beleg).
- Abbruch während des Laufs (Netz, Timeout): Fehlanzeige mit Wiederholungs-Möglichkeit; Einstellungen bleiben erhalten.
- Profiländerung zwischen Lauf und Übernahme: Übernahme prüft, ob die Kriterien-IDs noch existieren; entfallene Kriterien werden ignoriert und ausgewiesen.
- API-Schlüssel wird gelöscht: Screening-Ansicht fordert erneut zur Eingabe auf; gespeicherte Leads bleiben unberührt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Jedes Kriterium MUSS einer Phase zugeordnet sein: „Pre-Screening" (online recherchierbar) oder „Qualifizierung" (2. Screening, manuell); die Zuordnung ist im Profil-Editor je Kriterium wählbar und wird mit dem Profil gespeichert, exportiert und importiert.
- **FR-002**: Bestehende Profile und Importe ohne Phasen-Angabe MÜSSEN automatisch „Qualifizierung" erhalten (sichere Voreinstellung: keine ungefragte Online-Recherche).
- **FR-003**: Das Lead-Formular MUSS die Kriterien nach Phase gruppiert anzeigen („Pre-Screening", „Qualifizierung — 2. Screening").
- **FR-004**: Die mitgelieferten Vorlagen MÜSSEN sinnvolle Phasen-Voreinstellungen enthalten (firmografisch = Pre-Screening, gesprächsabhängig = Qualifizierung).
- **FR-005**: Das Tool MUSS eine Screening-Ansicht bieten, in der der Nutzer einen eigenen KI-API-Schlüssel hinterlegen kann; der Schlüssel wird ausschließlich lokal gespeichert, maskiert angezeigt, ist löschbar und ist niemals Teil von Profil-Exporten oder CSV-Dateien.
- **FR-006**: Ein Screening-Lauf MUSS konfigurierbar sein: Region (Freitext, Voreinstellung „DACH"), Anzahl Kandidaten (5–50, Voreinstellung 20), optionale Zusatzhinweise (Freitext, z. B. Nische oder Ausschlüsse).
- **FR-007**: Ein Lauf DARF ausschließlich die Pre-Screening-Kriterien (Name, Beschreibung, mögliche Ausprägungen) und die Lauf-Parameter übertragen — niemals qualitative Kriterien, Bestands-Leads, Bewertungen oder andere Nutzdaten.
- **FR-008**: Die Recherche MUSS das öffentliche Web nutzen (Firmenwebsites, Presse/News, Firmenverzeichnisse/Register, Stellenanzeigen, öffentlich zugängliche Social-Media-Auftritte) und pro Kandidat mindestens eine Quellen-URL liefern; Kandidaten ohne Quelle werden verworfen.
- **FR-009**: Gefundene Kriterienwerte MÜSSEN in die Wertetypen des Profils überführt werden (Options-Label-Abgleich, Zahlen, Ja/Nein, Skala); nicht zuordenbare oder nicht gefundene Werte bleiben leer und werden als Datenlücke ausgewiesen — das System erfindet keine Werte, und die Recherche liefert niemals Punkte oder Scores (nur Rohwerte, Constitution II).
- **FR-010**: Die Kandidatenliste MUSS pro Kandidat anzeigen: Firmenname, Kurzbegründung, gefundene Werte mit Quellen, daraus deterministisch berechnete Punktzahl/Stufe (bestehende Scoring-Engine, fehlende Werte nach Profil-Einstellung) und eine Duplikat-Markierung bei Namensgleichheit mit Bestands-Leads.
- **FR-011**: Der Nutzer MUSS Kandidaten einzeln oder gesamt auswählen und als Leads übernehmen können; übernommene Leads tragen die Quelle „Screening", die recherchierten Werte und die Quellen-URLs; ohne Übernahme wird nichts gespeichert.
- **FR-012**: Quellen-URLs übernommener Werte MÜSSEN am Lead sichtbar sein (je Kriterium und als Firmen-Website), auch nach Neuladen.
- **FR-013**: Fehlerzustände (fehlender/ungültiger Schlüssel, Netzfehler, Dienst-Fehler, 0 Treffer) MÜSSEN verständlich auf Deutsch angezeigt werden und dürfen die Kernfunktionen nicht beeinträchtigen.
- **FR-014**: Vor dem Start MUSS das Tool darauf hinweisen, dass der Lauf über den eigenen API-Schlüssel Kosten verursacht.
- **FR-015**: Die Kernfunktionen (Profile, manuelle Leads, CSV, Export/Import) MÜSSEN ohne hinterlegten Schlüssel und offline unverändert funktionieren.

### Key Entities

- **Kriterium (erweitert)**: erhält das Feld **Phase** (`Pre-Screening` | `Qualifizierung`); Voreinstellung „Qualifizierung".
- **Screening-Lauf** *(flüchtig, nicht gespeichert)*: Parameter (Region, Anzahl, Hinweise) + Ergebnis (Kandidatenliste); existiert nur in der laufenden Sitzung.
- **Kandidat** *(flüchtig)*: Firmenname, Kurzbegründung, Werte je Pre-Screening-Kriterium mit Quellen-URL, Firmen-Website, nicht zuordenbare Rohtexte, Duplikat-Kennzeichen.
- **Lead (erweitert)**: optionale Felder Firmen-Website und Quellen je Kriterienwert; neue Quelle „Screening" neben „manuell" und „Import".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein Nutzer kann die Phasen-Zuordnung eines Profils mit 5 Kriterien in unter 1 Minute vornehmen.
- **SC-002**: Ein Screening-Lauf mit Voreinstellungen (DACH, 20) liefert in unter 10 Minuten eine Kandidatenliste; jeder angezeigte Kandidat hat mindestens eine Quellen-URL.
- **SC-003**: 100 % der übernommenen Kandidaten erscheinen als Leads mit Quelle „Screening" in der Rangliste und behalten Werte und Quellen nach Neuladen.
- **SC-004**: Bei keinem Lauf werden qualitative Kriterien oder Bestands-Leads übertragen (nachprüfbar in der Anfrage-Struktur; verankert in Tests).
- **SC-005**: Die Punktzahl jedes Kandidaten ist mit der bestehenden Engine reproduzierbar: identische Werte ⇒ identische Punktzahl wie bei manueller Eingabe (0 Abweichungen).
- **SC-006**: Ohne API-Schlüssel und offline verhalten sich alle Kernfunktionen unverändert (Regressionstests der Feature-001-Szenarien bestehen weiter).

## Assumptions

- **Recherche-Dienst**: Die Recherche nutzt eine KI-API mit integrierter Websuche, direkt aus dem Browser aufrufbar (kein eigenes Backend, Constitution IV); der konkrete Dienst ist Plan-Entscheidung. Kosten trägt der Nutzer über seinen eigenen Schlüssel; ein Lauf mit Voreinstellungen liegt erfahrungsgemäß im Bereich weniger Euro-Cent bis ca. 2 €.
- **Datenquellen** *(öffentlich zugänglich, ohne Login)*: Firmenwebsites (Über-uns, Produkte, Karriere, Impressum); Presse/News (Pressemitteilungsportale, Wirtschafts-, Fach- und Regionalmedien — bei Paywalls nur Anrisse); Firmenverzeichnisse und öffentliche Registerdaten (z. B. Branchenverzeichnisse, Unternehmensregister-Auszüge, Northdata-Übersichten); Stellenanzeigen (Karriereseiten, Jobportale) als Indikator für Größe, Wachstum und Technologie; Messe-Ausstellerlisten und Verbandsverzeichnisse; Bewertungsplattformen (z. B. Kununu-Übersichtsdaten); öffentlich sichtbare Social-Media-Auftritte (Unternehmensseiten auf LinkedIn/Facebook/Instagram/YouTube, soweit ohne Login lesbar). **Nicht zugänglich**: Inhalte hinter Login (private LinkedIn-/X-Feeds, geschlossene Gruppen), Paywall-Volltexte, kommerzielle Firmendatenbanken (Dealfront, ZoomInfo o. ä.) und alles, was Scraping gegen Nutzungsbedingungen erfordern würde.
- **Datenqualität**: Recherchierte Werte (v. a. Mitarbeiterzahlen) sind Näherungen aus öffentlichen Quellen; die Quellenangabe ermöglicht die Prüfung. Das zweite Screening bleibt bewusst manuell.
- **Sprache**: Recherche-Läufe und Begründungen auf Deutsch; Quellen können anderssprachig sein.
- **Ein Lauf zur Zeit**: Parallele Läufe sind nicht vorgesehen (Einfachheit, Constitution IV).
