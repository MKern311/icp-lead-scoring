# Contract: Geführter Screening-Workflow

Verbindliche Regeln für `docs/js/ui/workflow.js` und die zugehörige pure Logik in
`docs/js/core/`. Ergänzt den Screening-Contract
(`specs/002-online-screening/contracts/screening.md`) — dieser bleibt für
Request-Aufbau, Antwort-Parsing und Netzwerkschicht maßgeblich.

## W1: Einstieg & Schritt-Gates

**Feature 004**: Der Workflow ist vierstufig — 1 Kriterien · 2 Kandidaten finden
(Longlist) · 3 Tiefen-Screening (optional überspringbar) · 4 Qualifizierung.
Schritt-2/3-Regeln in `specs/004-deep-screening/contracts/deep-screening.md`;
Tiefen-Screening nie für gespeicherte Leads (Verfassung III). Der Wiedereinstieg
über `qualificationQueue` zielt auf Schritt 4.

- Route `#/screening` rendert den Workflow; es gibt keinen weiteren Screening-Einstieg.
- Ohne aktives Profil: Erklärung + Verweis auf Profil-Anlage; kein Schritt startet.
- Schritt 1 → 2 nur, wenn (a) jedes Kriterium des aktiven Profils in dieser Sitzung
  aktiv bestätigt oder zugeordnet wurde und (b) mindestens ein Kriterium
  `stage === 'prescreening'` hat. Verletzung ⇒ „Weiter" gesperrt mit Begründung.
- Schritt 2 startet den Lauf nur mit hinterlegtem API-Schlüssel; sonst
  Schlüssel-Eingabe an Ort und Stelle (bestehende Maskierungs- und Speicherregeln,
  Key `icp.v1.apikey`).
- Schritt 2 → 3 nach Übernahme von ≥ 1 Kandidaten; bei 0 übernommenen Kandidaten
  bleibt der Workflow in Schritt 2 (Lauf wiederholbar mit angepassten Parametern).
- Wiedereinstieg: Ist `qualificationQueue(profile, leads)` nicht leer, bietet der
  Workflow vor Schritt 1 den Direkteinstieg in Schritt 3 mit dieser Warteschlange an.

## W2: Schritt 1 — Bestätigungspflicht & Suchhinweise

- Alle Kriterien erscheinen als Liste (Name, Beschreibung, Phasen-Wahl mit aktueller
  Phase als Vorschlag). Eine Zuordnung gilt erst als bestätigt, wenn der Nutzer sie in
  dieser Workflow-Sitzung aktiv gesetzt oder explizit bestätigt hat.
- Phasen-Änderungen und Suchhinweise werden sofort im Profil gespeichert
  (`store.saveProfile`) — identische Daten wie im Profil-Editor.
- Suchpräferenz (FR-016): Bei Pre-Screening-Kriterien vom Typ Auswahlliste wird die
  Präferenz als Mehrfachauswahl der Ausprägungen angeklickt (`searchTargets`,
  Options-IDs) — kein Freitext. Freitext-`searchHint` (max. 200 Zeichen, getrimmt)
  erscheint bei Zahlenbereichs-Kriterien sowie bei Kriterien mit nicht-leerem
  `hintLabel` (max. 80 Zeichen) — das Label beschriftet das Feld fachlich (z. B.
  „Gesuchte Rollen / Stellentitel" beim Stellenanzeigen-Kriterium) und ersetzt im
  Request das Präfix „Suchhinweis:". Übrige Ja/Nein- und Skalen-Kriterien brauchen
  keine Präferenz-Eingabe. Werte bleiben bei Phasenwechsel erhalten;
  gelöschte Optionen werden aus `searchTargets` entfernt.
- Danach Suchparameter: Region (Default „DACH"), Anzahl 5–50 (Default 20), globale
  Hinweise — Vorbelegung wie bisheriger Screening-Lauf.
- **Gruppierung (FR-015)**: erst Pre-Screening-Kriterien, dann Katalog-Vorschläge,
  dann Qualifizierungskriterien; Phasenwechsel verschiebt zwischen den Gruppen.
- **Kriterien-Katalog (FR-014)**: `criterionCatalog` in `docs/js/templates.js` (reine
  Daten; Klassen folgen EU-Standards, wo vorhanden: Branche = NACE-Rev.-2-Abschnitte
  A–S, Mitarbeiter-/Umsatzklassen = EU-KMU-Definition 2003/361/EG; Wachstums-Signale
  einzeln mit Belegzeitraum 12 Monate, Stellenanzeigen-Rollen als beschriftetes
  Freitextfeld via `hintLabel`); Übernahme per
  `criterionFromCatalog(entry)` (pure, `core/model.js`) — neue IDs, sofort
  `store.saveProfile`, Eintrag gilt als bestätigt. Testverankert: jeder Katalog-Eintrag
  ergibt ein valides Kriterium (`validateProfile` ohne Fehler), Katalog-Namen sind
  eindeutig; bereits vorhandene Namen (case-insensitiv) werden nicht angeboten.

## W3: Schritt 2 — Lauf & Übernahme

- Request-Aufbau ausschließlich über `buildScreeningRequest` (Contract SC-004 bleibt
  testverankert). Neu dort: je Pre-Screening-Kriterium mit nicht-leerem `searchHint`
  wird eine Zeile `Suchhinweis: <text>` an die Kriterienbeschreibung angehängt.
  Suchhinweise von Qualifizierungskriterien erscheinen nie im Request.
- Fortschritt, Fehlerbilder, Ergebnistabelle, Auswahl und Übernahme verhalten sich wie
  in Feature 002 spezifiziert (Quellen-Links, Duplikat-Badge, keine Speicherung ohne
  Übernahme). Die Übernahme merkt sich die IDs der gespeicherten Leads als
  Schritt-3-Warteschlange.

## W4: Schritt 3 — Geführte Qualifizierung

- Anzeige je Lead: Kopf (Name, Website-Link, „Lead n von m"), Pre-Screening-Werte
  nur lesend mit Quell-Links, Eingabefelder ausschließlich für Kriterien mit
  `stage !== 'prescreening'`, Live-Panel über `evaluate(profile, lead)`.
- Aktionen: „Speichern & weiter" (persistiert via `store.saveLead`, dann nächster
  Lead), „Überspringen" (keine Speicherung, Lead gilt als offen), „Zurück"
  (vorheriger Lead, Eingaben des aktuellen Leads bleiben im Arbeitsspeicher).
- Nach dem letzten Lead: Zusammenfassung (bearbeitet/übersprungen, Stufen-Verteilung
  via `evaluate`) + Link zur Rangliste. Keine Persistenz der Zusammenfassung.

## W5: Pure Logik (testverankert)

- `qualificationQueue(profile, leads)` (in `core/screening.js`): Leads mit
  `source === 'screening'` und mindestens einem Qualifizierungskriterium ohne Wert;
  Bestandsreihenfolge; wirft nie.
- `model.js`: `searchHint` optional, String, getrimmt, ≤ 200 Zeichen; `hintLabel`
  optional, String, ≤ 80 Zeichen (beschriftet das Freitextfeld); Validierung
  lehnt andere Typen ab; `migrateProfile` ergänzt jeweils `''`.
- `profile-io.js`: Export schreibt `searchHint`/`hintLabel` nur, wenn nicht leer;
  Import: fehlend ⇒ `''`, Nicht-String ⇒ Fehler; `schemaVersion` bleibt 2.
- Erweiterter SC-004-Anker: Der serialisierte Request enthält (a) weiterhin keine
  Gewichte/Punkte/Stufen/Leads/Profilnamen und (b) keinen `searchHint` eines
  Qualifizierungskriteriums; der `searchHint` eines Pre-Screening-Kriteriums ist
  enthalten.
