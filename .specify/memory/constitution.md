<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added sections: Core Principles (5), Zusätzliche Constraints, Development Workflow & Quality Gates, Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gate is generic, no change needed)
  - ✅ .specify/templates/spec-template.md (aligned, no change needed)
  - ✅ .specify/templates/tasks-template.md (aligned, no change needed)
- Follow-up TODOs: none
-->

# ICP Lead Scoring Constitution

## Core Principles

### I. Generik vor Spezialfall

Das Werkzeug enthält keine fest verdrahteten Branchen-, Markt- oder Geschäftsmodell-Kriterien.
Jedes Bewertungsmerkmal (Kriterium, Gewichtung, Punktregel, Stufe) MUSS vom Nutzer definierbar,
änderbar und löschbar sein. Mitgelieferte Vorlagen sind Daten, kein Code: Sie nutzen ausschließlich
dieselben Mechanismen, die jedem Nutzer offenstehen. Ein Feature, das nur für einen speziellen
Anwendungsfall funktioniert, verletzt diese Verfassung.

**Rationale**: Die Kernanforderung ist ein generisches Tool, das Dritte mit eigenen ICP-Definitionen
nutzen können. Jede Spezialisierung im Code macht das unmöglich.

### II. Nachvollziehbare Scores (NON-NEGOTIABLE)

Jede berechnete Punktzahl MUSS vollständig erklärbar sein: Für jeden bewerteten Lead ist pro
Kriterium sichtbar, welcher Rohwert zu welchen Punkten führte und mit welchem Gewicht er in die
Gesamtpunktzahl einging. Es gibt keine Black-Box-Bewertung. Rundungen und Normalisierungen
(z. B. bei Gewichtssummen ≠ 100 %) MÜSSEN deterministisch und dokumentiert sein: identische
Eingaben liefern überall identische Ergebnisse.

**Rationale**: Ein Scoring, dem der Nutzer nicht trauen kann, ist wertlos — und Weitergabe von
Profilen (Prinzip I) funktioniert nur, wenn Ergebnisse reproduzierbar sind.

### III. Lokale Datenhoheit

Alle Nutzdaten (Profile, Leads, Bewertungen) verbleiben auf dem Gerät des Nutzers. Das Werkzeug
MUSS ohne Konto, Server-Registrierung oder Internetverbindung voll funktionsfähig sein.
Datenaustausch geschieht ausschließlich durch explizite, vom Nutzer ausgelöste Exporte/Importe
(Dateien). Es werden keine Telemetrie- oder Analysedaten gesendet.

**Rationale**: Lead-Daten sind vertrauliche Geschäftsdaten (u. a. Beratungsmandate). Lokale
Datenhaltung eliminiert die Vertraulichkeits- und DSGVO-Risiken zentraler Speicherung.

### IV. Einfachheit & Ein-Personen-Betrieb

v1 ist ein Einzelnutzer-Werkzeug: keine Benutzerkonten, Rollen, Rechte oder Synchronisation.
Neue Abhängigkeiten, Build-Schritte und Infrastruktur MÜSSEN sich durch konkreten Nutzerwert
rechtfertigen (YAGNI). Installation und Start MÜSSEN ohne technisches Spezialwissen möglich sein.

**Rationale**: Zielgruppe sind Einzelpersonen (Berater, Selbstständige, Dozenten), nicht
IT-Abteilungen. Jede Betriebskomplexität senkt die Nutzbarkeit für genau diese Gruppe.

### V. Testbare Scoring-Logik

Die Bewertungslogik (Punktregeln, Gewichtung, Normalisierung, K.o.-Kriterien, Stufenzuordnung,
Umgang mit fehlenden Werten) MUSS als eigenständige, oberflächenunabhängige Einheit implementiert
und durch automatisierte Tests abgedeckt sein — einschließlich der Randfälle aus der Spezifikation.
UI-Änderungen dürfen die Scoring-Logik nicht beeinflussen können.

**Rationale**: Die Korrektheit der Berechnung ist das Kernversprechen des Produkts (Prinzip II);
sie muss unabhängig von Darstellungsfragen beweisbar bleiben.

## Zusätzliche Constraints

- Profile MÜSSEN in einem offenen, menschenlesbaren Dateiformat exportiert werden, damit
  Weitergabe und Versionierung ohne das Werkzeug selbst möglich sind.
- CSV-Import/-Export ist die einzige Pflicht-Schnittstelle in v1; CRM-Integrationen sind bewusst
  ausgeschlossen.
- Auslegungsgrenze v1: bis ca. 5 000 Leads pro Profil müssen flüssig bedienbar bleiben.
- UI-Texte einsprachig; Nutzerinhalte (Profile, Kriterien, Stufen) sind sprachneutral.

## Development Workflow & Quality Gates

- Spec-Kit-Ablauf ist verbindlich: constitution → specify → clarify → plan → tasks → implement.
  Artefakte in `specs/<feature>/` sind die Quelle der Wahrheit für den Scope.
- Vor Abschluss eines Features MÜSSEN alle Akzeptanzszenarien der Spezifikation erfüllt und die
  Tests der Scoring-Logik grün sein.
- Jede Änderung an der Scoring-Logik erfordert einen neuen oder angepassten Testfall, bevor sie
  als fertig gilt.
- Commits folgen dem Muster kleiner, nachvollziehbarer Schritte auf `main` (Solo-Projekt).

## Governance

Diese Verfassung hat Vorrang vor allen anderen Konventionen dieses Projekts. Änderungen erfolgen
durch Bearbeitung dieser Datei mit Versionssprung nach semantischer Versionierung
(MAJOR: Prinzip entfernt/umgedeutet; MINOR: Prinzip/Abschnitt ergänzt oder wesentlich erweitert;
PATCH: Klarstellungen). Jede Änderung MUSS den Sync-Impact-Report am Dateianfang aktualisieren
und die abhängigen Templates (`plan`, `spec`, `tasks`) auf Konsistenz prüfen. Plan- und
Implementierungsphasen MÜSSEN im „Constitution Check" gegen die Prinzipien I–V geprüft werden;
Abweichungen sind nur mit dokumentierter Begründung im Complexity-Tracking zulässig.

**Version**: 1.0.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-04
