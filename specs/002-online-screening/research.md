# Phase 0 Research: Online-Screening

**Date**: 2026-08-05 | **Plan**: [plan.md](plan.md)

## R1: Recherche-Dienst

- **Decision**: Claude API (Anthropic) mit server-seitigem Websuche-Tool
  (`web_search_20260209`), Modell `claude-opus-5`, direkter Browser-Zugriff via `fetch` mit
  dem Header `anthropic-dangerous-direct-browser-access: true`.
- **Rationale**: Einziger Dienst, der KI-Recherche **und** Websuche in einem API-Aufruf ohne
  eigenes Backend browserfähig bereitstellt (CORS-Opt-in). Ein Schlüssel, ein Anbieter, die
  Suche läuft server-seitig — der Browser führt keine Scraping-Logik aus. Der Nutzer besitzt
  bereits ein Anthropic-Konto (Vorprojekt nutzt dasselbe Muster). Modellwahl gemäß
  API-Referenz: `claude-opus-5` als Standard; kein `thinking`-Parameter (adaptiv per Default),
  keine Sampling-Parameter (würden 400 liefern).
- **Alternatives considered**: Google Custom Search API (nur Roh-Suchtreffer, Extraktion
  müsste clientseitig gebaut werden); Perplexity/Tavily (weitere Anbieter-Abhängigkeit,
  CORS unklar); eigenes Backend/Proxy (verletzt Constitution IV).

## R2: Strukturierte Kandidatenliste

- **Decision**: `output_config.format` (json_schema) mit **dynamisch aus dem Profil erzeugtem
  Schema**: Jedes Pre-Screening-Kriterium erhält einen stabilen Schlüssel `k1..kn`; je Schlüssel
  `{value, source}` mit typgerechtem `value` (select: enum der Options-Labels | null;
  range/scale: number | null; boolean: boolean | null) und `source` (URL | null). Dazu je
  Kandidat `name`, `website`, `reasoning`, `sources` (min. 1 URL).
- **Rationale**: Garantiert parsebares JSON ohne Retry-Logik; Options-Labels als enum zwingen
  die Zuordnung zur Auswahlliste bereits im Modell; `null` erzwingt „nicht gefunden bleibt
  leer" (FR-009). Punkte/Scores kommen im Schema nicht vor (Constitution II strukturell).
  Citations-Feature ist mit `output_config.format` inkompatibel (400) — Quellen-URLs daher
  als Schema-Felder.
- **Alternatives considered**: Freitext + eigenes Parsing (fehleranfällig); Tool-Use mit
  strict tool (gleichwertig, aber mehr Umlauf-Logik); Citations-API (inkompatibel, s. o.).

## R3: Lange Läufe & Fehlerbilder

- **Decision**: Nicht-Streaming-Request mit `max_tokens: 16000`; `stop_reason "pause_turn"`
  (Server-Tool-Iterationslimit) wird behandelt, indem Assistenten-Antwort angehängt und der
  Request wiederholt wird (max. 6 Fortsetzungen); `web_search.max_uses: 40` begrenzt Suchen
  und damit Kosten. Fehler-Mapping auf Deutsch: 401 (Schlüssel), 429 (Rate-Limit), 529
  (überlastet), `refusal` (abgelehnt), Netzwerkfehler.
- **Rationale**: Streaming-SSE-Parsing wäre für v1 unnötige Komplexität (Constitution IV);
  16K Tokens liegen innerhalb der Nicht-Streaming-Empfehlung der API-Referenz und reichen
  für ~20 Kandidaten. `pause_turn` ist bei websuche-lastigen Läufen der Normalfall, nicht
  die Ausnahme — ohne Behandlung würden Läufe still unvollständig abbrechen.
- **Alternatives considered**: Streaming mit Fortschritts-Text (v2-Kandidat); mehrere kleine
  Läufe à 5 Kandidaten (mehr Requests, Duplikat-Risiko zwischen Läufen).

## R4: Phasen-Modell & Datenmigration

- **Decision**: `Criterion.stage: "prescreening" | "qualification"`, Default (und Migration
  für Bestandsdaten/Importe ohne Feld) = `"qualification"`. Profil-Export-Schema wird auf
  `schemaVersion 2` gehoben; Import akzeptiert 1 und 2. Migration als pure Funktion
  `migrateProfile()` in model.js, angewandt beim Lesen in store.js und beim Import.
- **Rationale**: Sichere Voreinstellung — nichts wird ungefragt recherchierbar (FR-002,
  Constitution III). Pure Migrationsfunktion bleibt testbar (Prinzip V).
- **Alternatives considered**: `researchable: boolean` (weniger sprechend, Spec verlangt
  explizit die Zwei-Phasen-Semantik); Default `prescreening` (verworfen: Datenschutz).

## R5: Schlüssel-Verwahrung

- **Decision**: `localStorage`-Key `icp.v1.apikey`, maskierte Anzeige (`sk-ant-…xxxx`),
  löschbar; niemals Teil von Profil-Export, CSV oder Vorlagen; Screening-Ansicht warnt,
  dass der Schlüssel nur auf vertrauenswürdigen Geräten hinterlegt werden sollte.
- **Rationale**: Einfachste lokale Verwahrung im Rahmen der Constitution III (b);
  Verschlüsselung im Browser wäre Scheinsicherheit ohne Server-Geheimnis.
- **Alternatives considered**: sessionStorage (nervt: Eingabe je Sitzung); IndexedDB
  (kein Sicherheitsgewinn).
