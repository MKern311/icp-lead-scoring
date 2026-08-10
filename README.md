# ICP Lead Scoring

Generisches Werkzeug, um ein **Ideal Customer Profile (ICP)** zu definieren und Leads
dagegen nachvollziehbar zu bewerten — als statische Web-App ohne Backend.
Alle Daten bleiben lokal im Browser; es gibt kein Konto und keine Telemetrie.

## Funktionen

- **ICP-Profile frei definieren**: eigene Kriterien (Auswahlliste, Zahlenbereich, Ja/Nein,
  Skala) mit Gewichtung, Punktregeln und K.o.-Kriterien; Bewertungsstufen (z. B. A/B/C)
  mit eigenen Schwellenwerten
- **Leads bewerten**: einzeln mit Live-Ergebnis oder massenhaft per CSV-Import mit
  Spaltenzuordnung; jede Punktzahl ist bis auf Kriterienebene aufgeschlüsselt
- **Rangliste**: sortieren, filtern, als Excel-taugliche CSV exportieren (Semikolon, UTF-8-BOM)
- **Zweistufiges Screening**: Kriterien sind einer Phase zugeordnet — **Pre-Screening**
  (firmografisch, online recherchierbar) oder **Qualifizierung** (2. Screening, manuell
  im Kundenkontakt); Pre-Screening-Kriterien können einen **Suchhinweis** tragen
  (z. B. „bevorzugt 50–250 Mitarbeiter"), der die Online-Recherche lenkt
- **Geführter Screening-Workflow**: Der Nav-Punkt „Screening" führt in drei Schritten
  durch den Prozess — (1) Phasen-Zuordnung aller Kriterien mit Pflicht-Bestätigung und
  Suchhinweisen, (2) Online-Screening mit Prüfung und Übernahme der Kandidaten,
  (3) geführte Qualifizierung Lead für Lead mit Live-Bewertung und Abschluss-Übersicht;
  offene Screening-Leads werden beim Wiedereinstieg direkt zur Qualifizierung angeboten
- **Online-Screening** *(optional, Schritt 2)*: Mit eigenem Anthropic-API-Schlüssel
  recherchiert das Tool per KI-Websuche Unternehmen, die zu den Pre-Screening-Kriterien
  passen (Region und Anzahl wählbar), inkl. Quellen-URLs je Angabe. Der Schlüssel bleibt
  lokal; übertragen werden nur die Pre-Screening-Kriterien samt Suchhinweisen, nie
  Gewichte, Leads oder Bewertungen. Der Lauf kostet über den eigenen Schlüssel grob
  0,50–1,50 €.
- **Generik**: Profile als JSON-Datei exportieren/importieren — andere Nutzer erhalten
  identische Bewertungslogik; zwei anpassbare Beispiel-Vorlagen sind enthalten
- **Offline-Kern**: Alle Kernfunktionen nach dem ersten Laden auch ohne Internetverbindung
  nutzbar (Service Worker); nur das Online-Screening braucht Netz und Schlüssel

## Nutzung

Die App ist eine statische Site — den Ordner `docs/` beliebig hosten (z. B. GitHub Pages)
oder lokal starten:

```bash
python3 -m http.server 8080 --directory docs
# → http://localhost:8080
```

## Tests

Die gesamte Kernlogik (Scoring, Modell-Validierung, CSV, Profil-Export/-Import) ist
testgedeckt — ohne Abhängigkeiten, nur mit dem Node-Test-Runner (Node ≥ 20):

```bash
node --test tests/*.test.js
```

## Projektstruktur

```text
docs/            Web-App (deploybarer Pages-Root)
  js/core/       Pure, DOM-freie Logik: scoring, model, csv, profile-io
  js/ui/         Views (deutsch): Profile, Editor, Lead, Rangliste, Import
tests/           node --test
specs/           Spec-Kit-Artefakte: Spezifikation, Plan, Contracts, Tasks
.specify/        Spec-Kit-Konfiguration inkl. Projekt-Verfassung
```

Verbindliche Regeln (Generik, nachvollziehbare Scores, lokale Datenhoheit, Einfachheit,
testbare Scoring-Logik): [.specify/memory/constitution.md](.specify/memory/constitution.md).
Die Rechenregeln der Bewertung sind in
[specs/001-icp-lead-scoring/contracts/scoring-engine.md](specs/001-icp-lead-scoring/contracts/scoring-engine.md) fixiert.
