# icp-lead-scoring — Agent Context

Generisches ICP-Definitions- und Lead-Scoring-Tool. Statische Web-App ohne Backend;
optionales Online-Screening (Claude API + Websuche, eigener Nutzer-Schlüssel).

## Verbindliche Artefakte (Quelle der Wahrheit)

- Verfassung: `.specify/memory/constitution.md` (v2.0.0 — Generik, nachvollziehbare Scores,
  lokale Datenhoheit & Offline-Kern mit eng begrenzter Online-Ausnahme, Einfachheit,
  testbare Logik)
- Feature 001: `specs/001-icp-lead-scoring/` (Scoring-Kern, CSV, Profile)
- Feature 002: `specs/002-online-screening/` (Kriterien-Phasen, Online-Pre-Screening;
  Screening-Regeln fixiert in `contracts/screening.md`)
- Feature 003: `specs/003-guided-workflow/` (geführter Workflow auf `#/screening`,
  Suchpräferenzen je Kriterium; Regeln in `contracts/workflow.md`)
- Feature 004: `specs/004-deep-screening/` (Zweiphasen-Screening: Longlist über
  Klassen-Filter + Tiefen-Screening je Unternehmen mit Konfidenz/Belegdatum;
  Regeln fixiert in `contracts/deep-screening.md`)
- Feature 005: `specs/005-research-quality/` (Bezugsdatum im Prompt, Beleg-Alter,
  Nachsuche mit Ausschlussliste, Verlassen-Schutz, Ist-Kosten, 2 Firmen parallel;
  Regeln fixiert in `contracts/research-quality.md`)
- Feature 006: `specs/006-onboarding-brand/` (Einstiegserklärung, Schlüssel aus
  lokaler `.env` mit Browser-Eingabe als Fallback, Markenauftritt)
- Feature 007: `specs/007-editing-sharing-access/` (Kriterien im Workflow anpassen
  und entfernen, Profil-Code zum Teilen, Zugangshürde auf der öffentlichen Seite)
- Feature 008: `specs/008-score-transparency/` (erreichbare Punktzahl je Kriterium und
  je Profil, Hinweis auf unerreichbare Stufen; Regeln 8–10 im Scoring-Contract)
- Feature 009: `specs/009-criteria-overview/` (aufklappbare Kriterien-Übersicht im
  Profil-Editor: Gewichte mit Summenzeile, K.o., Reihenfolge, Entfernen, Sortierung)
- Feature 010: `specs/010-backup/` (Vollsicherung Profil + Leads in einer Datei;
  Format fixiert in `contracts/backup-format.md`)
- Feature 011: `specs/011-schema-limits/` (FR-1001: Antwortschema fester Größe —
  `values` als Liste, keine Unions, keine optionalen Felder, keine enums)

## Stack & Regeln

- Vanilla JavaScript (ES2022, ES-Module), HTML5, CSS3 — **kein** Framework, **kein**
  Build-Schritt, **keine** Abhängigkeiten (auch keine Dev-Dependencies)
- `docs/` = GitHub-Pages-Root (deploybar wie er ist); `docs/js/core/` = pure, DOM-freie
  Module (scoring, model, csv, profile-io) — nur diese werden getestet
- Persistenz ausschließlich über `docs/js/store.js` (localStorage, Namespace `icp.v1.*`);
  Bewertungen werden nie gespeichert, immer via `evaluate(profile, lead)` berechnet.
  Suchparameter des Workflows liegen unter `icp.v1.workflow.<profileId>` (nur Region,
  Anzahl, Hinweise — nie Ergebnisse)
- Screening: Kriterien haben `stage` (`prescreening` = online recherchierbar,
  `qualification` = 2. Screening; Default qualification), `searchTargets` (bevorzugte
  Options-IDs bei Auswahl-Kriterien, per Klick — Longlist nutzt sie als harte
  „Erforderlich:"-Filter), optional `searchHint` (Freitext ≤ 200 Zeichen; UI bei range
  und bei Kriterien mit `hintLabel`) und optional `hintLabel` (≤ 80 Zeichen,
  beschriftet das Freitextfeld und ersetzt im Request das Präfix „Suchhinweis:" —
  z. B. Stellenanzeigen-Rollen); alles nur für Pre-Screening serialisiert. Katalog-
  Klassen folgen EU-Standards (NACE Rev. 2 Abschnitte, EU-KMU-Definition 2003/361/EG),
  Wachstumssignale sind 5 Einzelkriterien mit Belegzeitraum 12 Monate. `core/screening.js` ist
  pure und darf nur Pre-Screening-Kriterien serialisieren (testverankert, SC-004); die KI
  liefert nur Rohwerte + Quellen, nie Punkte. API-Schlüssel unter `icp.v1.apikey`, nie
  exportieren. Die Route `#/screening` rendert den geführten Workflow (`ui/workflow.js`,
  4 Schritte: Kriterien → Longlist → Tiefen-Screening → Qualifizierung). Longlist nutzt
  nur select-Kriterien (`longlistCriteria`, Targets = harte Filter); Deep recherchiert
  je Unternehmen (`buildDeepScreeningRequest`, Konfidenz `direct|inferred` +
  Belegdatum `JJJJ-MM` je Wert, Quellenpflicht in `parseDeepResult`) — nie für
  gespeicherte Leads. `qualificationQueue` bestimmt offene Screening-Leads für
  Schritt 4. Katalog: `criterionCatalog` (`templates.js`, kategorisierte reine Daten)
  per `criterionFromCatalog` übernehmen. Beide Requests nennen das Bezugsdatum
  (`todayIso()`); die Nachsuche schließt Kandidaten **des laufenden Laufs** per
  `exclude` aus (nie gespeicherte Leads). Beleg-Alter (`isEvidenceStale`, 12 Monate)
  und Kosten (`usageCost`, USD) werden zur Renderzeit berechnet, nie gespeichert;
  `DEEP_CONCURRENCY = 2` Firmen laufen gleichzeitig. Kriterien lassen sich in
  Schritt 1 über `ui/criterion-editor.js` anpassen (Name, Gewicht, K.o., Ausprägungen
  samt Punkten) und entfernen — der Profil-Editor hat dafür historisch eine eigene,
  gleichwertige Bindung, beide sind bei Änderungen gemeinsam zu prüfen.
- Profile teilen: `core/profile-code.js` kodiert das Export-Objekt als
  `ICP1-<base64url(gzip)>` — trägt die Daten selbst, braucht keinen Server, enthält
  nie Leads oder Schlüssel
- Sichern: `core/backup.js` (`icp-backup`, schemaVersion 1) legt Profil **und** Leads in
  einer Datei ab. Anders als der Profil-Export trägt die Sicherung die internen IDs von
  Kriterien/Ausprägungen mit — `lead.values` und `lead.sources` sind danach abgelegt.
  Einlesen vergibt neue Profil-/Lead-IDs und überschreibt nie; `handleImportFile` in
  `ui/profile-list.js` erkennt beide Formate an `format`. Nie mit Schlüssel, nie mit
  Punktzahlen
- Zugang: `js/gate.js` lädt `app.js` erst nach Wortprüfung (SHA-256), auf localhost
  sofort. **Keine Sicherheitsgrenze** — alles unter `docs/` ist öffentlich abrufbar;
  Geheimnisse gehören dort niemals hin
- Erreichbare Punktzahl: `criterionPointRange`/`scoreRange`/`unreachableTiers` in
  `core/scoring.js` leiten die Spanne allein aus den Punktregeln ab (100 nur erreichbar,
  wenn jedes Kriterium eine 100-Punkte-Ausprägung hat). Zur Renderzeit berechnet, nie
  gespeichert. Gemeinsame Textbausteine (`pointRangeText`, `scoreRangeHtml`) liegen in
  `ui/criterion-editor.js` und werden von Workflow, Profil-Editor, Lead-Formular und
  Rangliste genutzt
- Tests: `node --test tests/*.test.js` (Node ≥ 20); Scoring-Regeln sind in
  `specs/001-icp-lead-scoring/contracts/scoring-engine.md` fixiert — Änderungen dort zuerst
- UI-Texte deutsch, Code-Bezeichner englisch; Nutzereingaben beim Rendern immer escapen
- Design folgt manuelkern.com (`app/globals.css` + `docs/2026-08-10_design-modernisierungs-
  plan_v1.md`): Indigo `#292C87` trägt die Struktur, Coral `#D93D29` **ausschließlich**
  die primäre Aktion und den Fokus-Ring, Navy `#0f1140` die Überschriften. Archivo für
  Überschriften, Inter für Fließtext — beide lokal unter `docs/fonts/`, keine externen
  Requests. Bewegung: Press 120 ms, Hover 200 ms (nur hinter `@media (hover: hover)`),
  nur `transform`/`opacity`, `prefers-reduced-motion` global respektiert. Kein Dark Mode
- CSV: Semikolon-Auto-Erkennung, UTF-8-BOM beim Export (deutsches Excel), Details in
  `contracts/csv-format.md`

## Befehle

```bash
node --test tests/*.test.js     # Kernlogik-Tests
node serve.mjs                  # lokal starten (http://localhost:8080, liest .env)
```

`serve.mjs` liefert `docs/` aus und reicht `ANTHROPIC_API_KEY` aus `.env` unter
`/__local-config` an den Browser (nur localhost, `no-store`, bei jeder Anfrage neu
gelesen). `.env` ist gitignored — Vorlage: `.env.example`. Ohne Server (GitHub Pages)
greift unverändert die Schlüssel-Eingabe im Browser.
