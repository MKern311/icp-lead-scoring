# Phase 0 Research: ICP Definition & Lead Scoring

**Date**: 2026-08-04 | **Plan**: [plan.md](plan.md)

Alle offenen Punkte aus dem Technical Context wurden entschieden; es verbleiben keine
NEEDS-CLARIFICATION-Marker.

## R1: Hosting & Auslieferung

- **Decision**: Statisches Hosting auf GitHub Pages, ausgeliefert aus dem `docs/`-Ordner des
  `main`-Branches.
- **Rationale**: Clarify-Entscheidung „gehostete Web-App" bei gleichzeitiger Constitution-Vorgabe
  „kein Backend, Daten lokal". GitHub Pages ist kostenlos, versioniert das Deployment mit dem
  Code und ist im Arbeitsablauf des Nutzers etabliert (Vorprojekt „protokoll" nutzt dasselbe
  Muster). Weitergabe an Dritte = URL teilen oder Repo forken.
- **Alternatives considered**: Netlify/Vercel (mehr Features, aber zusätzlicher Account und für
  eine statische App ohne Build überdimensioniert); lokale Datei ohne Hosting (verworfen durch
  Clarify-Antwort); Cloudflare Pages (kein Mehrwert gegenüber GitHub Pages hier).

## R2: Client-seitige Datenhaltung

- **Decision**: `localStorage` mit Namespace `icp.v1.*`. Ein Indexschlüssel pro Sammlung
  (`icp.v1.profiles`, `icp.v1.leads.<profileId>`), Werte als JSON. Bewertungen werden nicht
  persistiert, sondern bei Anzeige aus Profil + Lead berechnet.
- **Rationale**: Mengengerüst passt sicher: 5 000 Leads × ≈ 250 Bytes ≈ 1,25 MB, deutlich unter
  dem 5-MB-Limit. `localStorage` ist synchron und trivial zu testen/mocken (Constitution IV).
  Nicht gespeicherte Bewertungen machen FR-011 (Neuberechnung bei Profiländerung) strukturell
  unmöglich zu verletzen — es gibt keinen veralteten Score.
- **Alternatives considered**: IndexedDB (asynchron, deutlich mehr Code; erst nötig bei
  Audiodaten/Blobs oder ≫ 5 MB); OPFS/File System Access API (Safari-Lücken, Overkill);
  Speicherung berechneter Scores (verworfen: Staleness-Risiko, verletzt Prinzip II).

## R3: CSV-Verarbeitung (Import/Export)

- **Decision**: Eigener CSV-Parser/-Serializer als pures Modul (`docs/js/core/csv.js`),
  RFC-4180-Subset: Anführungszeichen-Escaping, eingebettete Zeilenumbrüche,
  Delimiter-Auto-Erkennung (`;` vor `,` — deutsches Excel exportiert semikolongetrennt),
  UTF-8 mit BOM-Toleranz beim Lesen und BOM-Ausgabe beim Export (Excel-Umlaut-Kompatibilität).
- **Rationale**: Constitution IV verbietet unbegründete Abhängigkeiten; der benötigte
  Funktionsumfang ist klein und wird vollständig durch Tests abgedeckt (Constitution V).
  Die Excel-DE-Eigenheiten (Semikolon, BOM) sind für die Zielgruppe entscheidend und in
  [contracts/csv-format.md](contracts/csv-format.md) fixiert.
- **Alternatives considered**: PapaParse vendored (~48 kB; robuster Streaming-Parser, aber
  Fremdcode + Umfang für unseren Bedarf unnötig); naives `split(',')` (verworfen: bricht bei
  Anführungszeichen/Umbrüchen, genau die Fälle aus den Edge Cases).

## R4: Offline-Fähigkeit

- **Decision**: Service Worker (`docs/sw.js`) mit cache-first-Strategie und versioniertem
  Cache-Namen (`icp-cache-vN`); beim Aktivieren alte Caches löschen; App zeigt Hinweis, wenn
  eine neue Version bereitsteht.
- **Rationale**: Spec-Annahme „nach dem ersten Laden offline nutzbar" und Constitution III
  („ohne Internetverbindung voll funktionsfähig"). Cache-first ist bei einer versionierten
  statischen App das einfachste korrekte Muster.
- **Alternatives considered**: Kein Service Worker (verletzt Offline-Zusage); Workbox
  (Abhängigkeit + Build-Nähe, unnötig für < 15 Dateien).

## R5: Scoring-Berechnung, Normalisierung, Rundung

- **Decision**: Kriterienpunkte liegen immer auf 0–100. Gesamtscore = Σ(wᵢ · pᵢ) / Σ(wᵢ) über
  die einbezogenen Kriterien; Gewichte werden zur Laufzeit auf ihre Summe normiert (dadurch ist
  „Summe ≠ 100 %" rechnerisch unschädlich, die UI zeigt trotzdem den Hinweis nach FR-015).
  Fehlende Werte je nach Profileinstellung: `neutral` = Kriterium wird aus Zähler und Nenner
  entfernt (Renormierung), `zero` = 0 Punkte bei vollem Gewicht. K.o.-Kriterien: einheitliche
  Regel „disqualifiziert, wenn Punkte < 1" (statt typ-spezifischer Sonderlogik); K.o. ohne
  Wert ⇒ Status „nicht bewertbar". Rundung: nur bei der Ausgabe, Gesamtscore auf 1 Dezimalstelle,
  `Math.round(x * 10) / 10`; interne Berechnung ungerundet. Stufen: absteigend sortiert, erste
  Stufe mit `minScore ≤ Score` gewinnt; Vergleich mit dem gerundeten Ausgabewert.
- **Rationale**: Eine einzige, dokumentierte Formel erfüllt Prinzip II (Determinismus,
  Erklärbarkeit) und deckt alle Edge Cases der Spec ab (fehlende Werte, Gewichtssumme,
  K.o. ohne Wert). Die einheitliche K.o.-Regel bleibt für alle vier Kriterientypen erklärbar.
  Vollständige Regeln inkl. Beispielen: [contracts/scoring-engine.md](contracts/scoring-engine.md).
- **Alternatives considered**: Bayessche/gewichtete Modelle mit Konfidenz (Overkill, Black-Box-
  Gefahr); Speicherung mehrerer Nachkommastellen (Scheingenauigkeit); typ-spezifische
  K.o.-Definitionen (mehr UI-Komplexität, schwerer erklärbar).

## R6: UI-Architektur ohne Framework

- **Decision**: Vanilla ES-Module. `index.html` enthält alle Views als `<section>`-Elemente;
  `app.js` schaltet Views über eine einfache Hash-Navigation (`#/profile`, `#/leads`, …).
  Rendering über Template-Literals + `innerHTML` für Listen, Event-Delegation pro View-Modul.
  Nutzereingaben werden beim Einsetzen escaped (zentrale `esc()`-Hilfsfunktion).
- **Rationale**: Constitution IV (kein Build, keine Abhängigkeiten). Der Umfang (6 Views,
  überschaubare Interaktivität) rechtfertigt kein Framework. Hash-Routing funktioniert auf
  GitHub Pages ohne Server-Konfiguration.
- **Alternatives considered**: React/Vue/Svelte (Build-Zwang bzw. CDN-Abhängigkeit, verworfen);
  Web Components (mehr Boilerplate ohne Nutzen bei dieser Größe); History-API-Routing
  (bräuchte 404-Fallback-Tricks auf Pages).

## R7: Teststrategie

- **Decision**: Node.js-eingebauter Test-Runner (`node --test tests/`), Node ≥ 20. Getestet
  werden ausschließlich die puren Core-Module (scoring, model, csv, profile-io) — inklusive
  aller Akzeptanz-Rechenfälle und Edge Cases aus der Spec. UI-Validierung erfolgt manuell
  anhand [quickstart.md](quickstart.md).
- **Rationale**: Null Dev-Abhängigkeiten (Constitution IV), volle Abdeckung der Kernlogik
  (Constitution V). Browser-E2E-Tools (Playwright) stünden in keinem Verhältnis zum Projekt.
- **Alternatives considered**: Vitest/Jest (Abhängigkeiten, Config); Playwright-E2E (später
  nachrüstbar, für v1 manuelle Quickstart-Validierung ausreichend).

## R8: Code- und Namenskonventionen

- **Decision**: Code-Bezeichner und Dateinamen englisch, UI-Texte deutsch (zentrale Ablage der
  Strings nicht nötig — einsprachig). Profil-Exportdatei: `icp-profil-<slug>-vN.json`;
  Ergebnis-Export: `leads-bewertet-<slug>-JJJJ-MM-TT.csv`.
- **Rationale**: Konvention aus dem Vorprojekt („UI deutsch / Code englisch"); englische
  Bezeichner halten den Code für Dritte (Generik-Ziel) lesbar. Dateinamensmuster folgt der
  Ablageregel des Nutzers (klein, keine Umlaute, keine Leerzeichen).
- **Alternatives considered**: Durchgehend deutsche Bezeichner (schlechter teilbar);
  i18n-Schicht (verworfen per Clarify-Entscheidung „einsprachig Deutsch").
