<!--
Sync Impact Report
- Version change: 2.0.0 → 3.0.0 (MAJOR: aus Prinzip IV wird der Satz „Online-Funktionen nach
  Prinzip III kommen ohne eigenes Backend aus" gestrichen; Prinzip III erhält eine zweite,
  eng begrenzte Online-Ausnahme für die Lizenzprüfung)
- Modified principles:
  - III. Lokale Datenhoheit & Offline-Kern → zweite Ausnahme: Lizenzprüfung, mit abschließender
    Aufzählung der übertragbaren Felder und Fail-open-Pflicht
  - IV. Einfachheit & Ein-Personen-Betrieb → Backend-Verbot durch eine benannte Ausnahme ersetzt;
    Lizenzschlüssel ausdrücklich als kein Benutzerkonto festgehalten
- Added sections: none
- Removed sections: none
- Warum MAJOR und nicht MINOR: Die Governance-Regel stuft „Prinzip entfernt/umgedeutet" als MAJOR
  ein. Prinzip IV verliert einen Satz, der bisher jedes eigene Backend ausschloss — dieselbe Art
  Einschränkung, die schon den Sprung 1.0.0 → 2.0.0 begründete. Als Erweiterung wäre das
  schöngeredet.
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (generischer Constitution-Check, keine Änderung nötig)
  - ✅ .specify/templates/spec-template.md (keine Änderung nötig)
  - ✅ .specify/templates/tasks-template.md (keine Änderung nötig)
- Follow-up TODOs: none
-->

# ICP Lead Scoring Constitution

## Core Principles

### I. Generik vor Spezialfall

Das Werkzeug enthält keine fest verdrahteten Branchen-, Markt- oder Geschäftsmodell-Kriterien.
Jedes Bewertungsmerkmal (Kriterium, Gewichtung, Punktregel, Stufe, Screening-Phase) MUSS vom
Nutzer definierbar, änderbar und löschbar sein. Mitgelieferte Vorlagen sind Daten, kein Code:
Sie nutzen ausschließlich dieselben Mechanismen, die jedem Nutzer offenstehen. Ein Feature,
das nur für einen speziellen Anwendungsfall funktioniert, verletzt diese Verfassung.

**Rationale**: Die Kernanforderung ist ein generisches Tool, das Dritte mit eigenen
ICP-Definitionen nutzen können. Jede Spezialisierung im Code macht das unmöglich.

### II. Nachvollziehbare Scores (NON-NEGOTIABLE)

Jede berechnete Punktzahl MUSS vollständig erklärbar sein: Für jeden bewerteten Lead ist pro
Kriterium sichtbar, welcher Rohwert zu welchen Punkten führte und mit welchem Gewicht er in die
Gesamtpunktzahl einging. Es gibt keine Black-Box-Bewertung. Rundungen und Normalisierungen
(z. B. bei Gewichtssummen ≠ 100 %) MÜSSEN deterministisch und dokumentiert sein: identische
Eingaben liefern überall identische Ergebnisse. KI-gestützte Recherche darf ausschließlich
**Rohwerte mit Quellenangabe** liefern — niemals Punkte, Gewichte oder Scores; die Bewertung
selbst bleibt in jeder Ausbaustufe deterministisch regelbasiert.

**Rationale**: Ein Scoring, dem der Nutzer nicht trauen kann, ist wertlos — und Weitergabe von
Profilen (Prinzip I) funktioniert nur, wenn Ergebnisse reproduzierbar sind.

### III. Lokale Datenhoheit & Offline-Kern

Alle Nutzdaten (Profile, Leads, Bewertungen, API-Schlüssel) verbleiben auf dem Gerät des
Nutzers. Die **Kernfunktionen** (Profile definieren, Leads erfassen/bewerten, CSV- und
Profil-Import/-Export) MÜSSEN ohne Konto, Server-Registrierung und Internetverbindung voll
funktionsfähig sein. **Optionale Online-Funktionen** (z. B. Recherche-Screening) sind zulässig,
wenn sie kumulativ: (a) nur durch explizite Nutzeraktion ausgelöst werden, (b) einen vom Nutzer
selbst hinterlegten API-Schlüssel verwenden, der ausschließlich lokal gespeichert wird und
niemals in Repo, Export oder Vorlagen gelangt, (c) ausschließlich Profil-Definitionsdaten
(Kriterien der Pre-Screening-Phase, Suchparameter) übertragen — niemals Bestands-Leads oder
Bewertungen — und (d) bei fehlender Verbindung oder fehlendem Schlüssel die Kernfunktionen
unberührt lassen. Es werden keine Telemetrie- oder Analysedaten gesendet.

Als **zweite und abschließende Ausnahme** ist eine Lizenzprüfung zulässig, wenn sie kumulativ:
(a) ausschließlich vor dem Start einer Online-Recherche greift — nie vor Kernfunktionen,
(b) ausschließlich Lizenzschlüssel, Gerätekennung, Gerätebezeichnung und das daraus erzeugte
Freigabe-Merkmal überträgt (abschließende Aufzählung — niemals Profile, Kriterien, Leads,
Bewertungen oder den API-Schlüssel des Nutzers), (c) **fail-open** arbeitet: nur eine eindeutige
Absage des Lizenzdienstes hält eine Recherche an; Netzfehler, Zeitüberschreitung und
Serverfehler tun es nie, und (d) Export, Sicherung und jede andere Kernfunktion auch bei
abgelaufener oder gesperrter Lizenz unangetastet lässt. Daten werden nie als Geisel genommen.

**Rationale**: Lead-Daten sind vertrauliche Geschäftsdaten (u. a. Beratungsmandate). Der
Offline-Kern eliminiert Vertraulichkeits- und DSGVO-Risiken; die eng begrenzte Online-Ausnahme
ermöglicht Recherche-Nutzen, ohne die Datenhoheit über Bestandsdaten aufzugeben. Die
Lizenzprüfung sitzt bewusst genau dort, wo das Werkzeug ohnehin online ist — sie verschiebt die
Offline-Grenze nicht, sondern legt sich auf sie.

### IV. Einfachheit & Ein-Personen-Betrieb

v1 ist ein Einzelnutzer-Werkzeug: keine Benutzerkonten, Rollen, Rechte oder Synchronisation.
Neue Abhängigkeiten, Build-Schritte und Infrastruktur MÜSSEN sich durch konkreten Nutzerwert
rechtfertigen (YAGNI). Installation und Start MÜSSEN ohne technisches Spezialwissen möglich
sein. Recherche-Funktionen nach Prinzip III kommen ohne eigenes Backend aus; das **einzige**
zulässige eigene Backend ist der Lizenzdienst nach Prinzip III, und auch er MUSS abschaltbar
bleiben, ohne dass eine Kernfunktion ausfällt.

Ein Lizenzschlüssel ist **kein Benutzerkonto**: kein Login, kein Passwort, kein Profil auf einem
Server, keine wiederkehrende Zahlung. Er ist eine Zahlungskonvention und ausdrücklich kein
Kopierschutz — eine Prüfung, die im Browser läuft, ist umgehbar, und der Versuch, sie zu
„härten", verletzt regelmäßig den Offline-Kern.

**Rationale**: Zielgruppe sind Einzelpersonen (Berater, Selbstständige, Dozenten), nicht
IT-Abteilungen. Jede Betriebskomplexität senkt die Nutzbarkeit für genau diese Gruppe. Der
Lizenzdienst ist die einzige Ausnahme, weil das Werkzeug sonst nicht verkäuflich wäre — er
trägt genau zwei Tabellen und lässt sich einzeln abschalten.

### V. Testbare Scoring-Logik

Die Bewertungslogik (Punktregeln, Gewichtung, Normalisierung, K.o.-Kriterien, Stufenzuordnung,
Umgang mit fehlenden Werten) sowie die pure Logik von Online-Funktionen (Anfrage-Aufbau,
Antwort-Validierung, Werte-Zuordnung) MUSS als eigenständige, oberflächen- und netzwerkfreie
Einheit implementiert und durch automatisierte Tests abgedeckt sein — einschließlich der
Randfälle aus der Spezifikation. UI- und Netzwerkschichten dürfen die Kernlogik nicht
beeinflussen können.

**Rationale**: Die Korrektheit der Berechnung ist das Kernversprechen des Produkts (Prinzip II);
sie muss unabhängig von Darstellungs- und Übertragungsfragen beweisbar bleiben.

## Zusätzliche Constraints

- Profile MÜSSEN in einem offenen, menschenlesbaren Dateiformat exportiert werden, damit
  Weitergabe und Versionierung ohne das Werkzeug selbst möglich sind. API-Schlüssel und
  Lizenzdaten (Lizenzschlüssel, Freigabe-Merkmal, Gerätekennung) sind nie Teil eines Exports,
  einer Sicherung oder eines Profil-Codes.
- CSV-Import/-Export bleibt die Pflicht-Schnittstelle für Lead-Daten; das Recherche-Screening
  ist eine optionale Online-Funktion nach Prinzip III. CRM-Integrationen bleiben ausgeschlossen.
- Recherche-Ergebnisse MÜSSEN vor Übernahme in den Lead-Bestand vom Nutzer geprüft und
  ausgewählt werden können; übernommene Werte tragen ihre Quellenangabe.
- Auslegungsgrenze: bis ca. 5 000 Leads pro Profil müssen flüssig bedienbar bleiben.
- UI-Texte einsprachig Deutsch; Nutzerinhalte (Profile, Kriterien, Stufen) sind sprachneutral.

## Development Workflow & Quality Gates

- Spec-Kit-Ablauf ist verbindlich: constitution → specify → clarify → plan → tasks → implement.
  Artefakte in `specs/<feature>/` sind die Quelle der Wahrheit für den Scope.
- Vor Abschluss eines Features MÜSSEN alle Akzeptanzszenarien der Spezifikation erfüllt und die
  Tests der Kernlogik grün sein.
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

**Version**: 3.0.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-31
