# Research: Geführter Screening-Workflow

Alle Unklarheiten aus dem Technical Context sind aufgelöst; keine offenen
NEEDS CLARIFICATION.

## R1: Routing & Ablösung der Screening-Einzelansicht

- **Decision**: Die Route `#/screening` und der Nav-Punkt „Screening" bleiben bestehen,
  rendern aber das neue Modul `ui/workflow.js`. `ui/screening.js` entfällt; seine
  Bausteine (Schlüssel-Verwaltung, Lauf-Ausführung mit Fortschritt, Ergebnistabelle
  mit Übernahme) wandern als Schritt-2-Renderer in das Workflow-Modul. Der interne
  Schritt-Zustand (1/2/3, Warteschlangen-Position) lebt im Modul, nicht in der URL.
- **Rationale**: Clarify-Entscheidung „Workflow ersetzt Screening-Tab". Ein Einstieg,
  keine Parallelstruktur (Verfassung IV). Hash-Routen pro Schritt brächten
  Deep-Link-Zustände, die ohne persistierten Workflow-Zustand ins Leere führen.
- **Alternatives considered**: Eigene Route `#/workflow` neben `#/screening`
  (verworfen: Dopplung); Unterrouten `#/screening/1..3` (verworfen: Zustand ist
  flüchtig, Deep-Links wären irreführend).

## R2: Datenmodell für Suchhinweise (`searchHint`)

- **Decision**: `criterion.searchHint` — optionaler String, getrimmt, max. 200 Zeichen,
  Default `''`. Validierung in `model.js`; editierbar im Workflow-Schritt 1 und im
  Profil-Editor (nur bei Pre-Screening-Kriterien angezeigt, bleibt aber beim
  Phasenwechsel erhalten). Export: `schemaVersion` bleibt **2**, `searchHint` wird als
  optionales Feld geschrieben und beim Import akzeptiert (fehlend ⇒ `''`).
- **Rationale**: Additives, optionales Feld — alte v2-Dateien bleiben gültig, ältere
  App-Stände ignorieren das Feld beim Import verlustarm. Ein Versionssprung auf 3
  würde v2-Importer grundlos ausschließen.
- **Alternatives considered**: schemaVersion 3 (verworfen: bricht Kompatibilität ohne
  strukturelle Not); Hinweise nur im globalen Lauf-Hinweisfeld (verworfen:
  Clarify-Entscheidung verlangt Hinweis je Kriterium, gespeichert im Profil).

## R3: Serialisierung der Suchhinweise im Request

- **Decision**: `buildScreeningRequest` hängt je Pre-Screening-Kriterium mit nicht-leerem
  `searchHint` eine Zeile `   Suchhinweis: <text>` an die Kriterienzeile an. Hinweise
  von Qualifizierungskriterien werden nie serialisiert (folgt aus der bestehenden
  Filterung auf `prescreeningCriteria`). Der Screening-Contract von Feature 002
  (`specs/002-online-screening/contracts/screening.md`) wird um diese Regel ergänzt;
  der SC-004-Testanker wird erweitert: Suchhinweis eines Qualifizierungskriteriums
  darf im Request-JSON nicht vorkommen.
- **Rationale**: Freitext-Hinweise sind Suchparameter im Sinne von Verfassung III (c);
  die Grenze (nie Gewichte/Punkte/Stufen/Leads) bleibt strukturell gewahrt, weil der
  Request-Builder diese Felder weiterhin gar nicht liest.
- **Alternatives considered**: Hinweise ins globale `hints`-Feld konkatenieren
  (verworfen: verliert den Kriterienbezug für die Recherche); eigenes Schema-Feld je
  Kriterium im JSON-Output (verworfen: Hinweise steuern die Suche, nicht das
  Ausgabeformat).

## R4: Warteschlange für Schritt 3 (Wiedereinstieg)

- **Decision**: Neue pure Funktion `qualificationQueue(profile, leads)` in
  `core/screening.js`: liefert Leads mit `source === 'screening'`, bei denen mindestens
  ein Qualifizierungskriterium (`stage !== 'prescreening'`) keinen Wert hat —
  in stabiler Reihenfolge des Bestands. Nach einer Übernahme in Schritt 2 besteht die
  Warteschlange aus genau den übernommenen Leads (IDs aus der Übernahme); beim
  Wiedereinstieg ohne Lauf wird `qualificationQueue` angeboten.
- **Rationale**: Clarify-Entscheidung; pure Funktion macht die Regel testbar
  (Verfassung V) und hält die UI dünn.
- **Alternatives considered**: Alle Leads mit offenen Kriterien inkl. manuell/CSV
  (verworfen per Clarify); Persistierung der Warteschlange (verworfen: Workflow-Zustand
  bleibt flüchtig, FR-010).

## R5: Wiederverwendung in Schritt 3 (Qualifizierungs-Formular)

- **Decision**: Schritt 3 rendert ein kompaktes eigenes Formular im Workflow-Modul:
  oben Lead-Kopf (Name, Website, Position „Lead n von m"), dann Pre-Screening-Werte
  nur lesend (Wert + Quelle als Link), dann Eingabefelder ausschließlich für
  Qualifizierungskriterien, rechts das Live-Bewertungspanel. Wiederverwendet werden
  `evaluate` (Scoring), `tierBadge` (Export aus `lead-form.js`), `fmtScore`/`fmtValue`/
  `esc` aus `app.js` und `store.saveLead`. `ui/lead-form.js` bleibt als Einzelansicht
  unverändert.
- **Rationale**: Das Lead-Formular ist an Route und Vollansicht gebunden; ein
  erzwungener Umbau auf Doppelnutzung würde beide Ansichten verkomplizieren
  (Verfassung IV). Die geteilte Logik (Scoring, Formatierung, Persistenz) ist bereits
  zentralisiert — dupliziert wird nur schlankes Markup.
- **Alternatives considered**: `lead-form.js` parametrisieren und einbetten (verworfen:
  Route-/Zustandskopplung, höhere Komplexität); iframe-/Navigation zur Einzelansicht
  je Lead (verworfen: bricht die Führung, SC-001).

## R6: Service-Worker-Versionierung

- **Decision**: `CACHE = 'icp-cache-v3'`; ASSETS: `js/ui/workflow.js` ersetzt
  `js/ui/screening.js`.
- **Rationale**: Bestehendes Muster aus Feature 002 (Cache-Name hochzählen bei
  Asset-Änderungen), sonst liefert der alte Cache entfernte Dateien aus.
- **Alternatives considered**: keine.
