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
- **Geführter Screening-Workflow (vierstufig)**: Der Nav-Punkt „Screening" führt durch
  (1) **Kriterien** — Phasen-Zuordnung mit Pflicht-Bestätigung, anklickbaren
  Suchpräferenzen (statt Freitext) und einem kategorisierten **Kriterien-Katalog** mit
  über 20 online recherchierbaren Kriterienarten (Firmografie, Wachstum & Dynamik,
  Digitale Präsenz, Markt & Netzwerk — inkl. getrennter Signale wie Presse-News,
  Stellenanzeigen nach Funktionsbereich, Eigentümerstruktur, Kununu-Score),
  (2) **Kandidaten finden** — günstige Longlist-Suche über die Klassen-Filter,
  (3) **Tiefen-Screening** — je Unternehmen ein eigener Recherche-Lauf über alle
  Pre-Screening-Kriterien mit Quelle, **Konfidenz** (belegt/abgeleitet) und
  **Belegdatum** je Wert; sequenziell, abbrechbar, fortsetzbar; auch für manuell
  eingegebene Firmen, (4) **Qualifizierung** Lead für Lead mit Live-Bewertung;
  offene Screening-Leads werden beim Wiedereinstieg direkt angeboten
- **Online-Recherche** *(optional, Schritte 2–3)*: Mit eigenem Anthropic-API-Schlüssel
  per KI-Websuche, inkl. Quellen-URLs je Angabe; Werte ohne Quelle werden verworfen.
  Der Schlüssel bleibt lokal; übertragen werden nur Pre-Screening-Kriterien samt
  Suchauswahl, nie Gewichte, Leads oder Bewertungen. Kosten grob: Longlist 0,30–0,80 €,
  Tiefen-Screening 0,15–0,35 € je Unternehmen (eigener Schlüssel).
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
