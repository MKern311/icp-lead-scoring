// Mitgelieferte Beispiel-Profile — reine Daten im Export-Format (Constitution I:
// Vorlagen nutzen exakt dieselben Mechanismen wie Nutzerprofile, kein Sondercode).
// Instanziierung läuft über profile-io.importProfile (neue IDs, volle Validierung).

// Katalog online recherchierbarer Kriterien (Feature 004, FR-407) — reine Daten.
// Schritt 1 des Workflows bietet sie kategorisiert zum Übernehmen an; Gewichte und
// Punktregeln sind Startwerte und im Profil-Editor frei anpassbar (Verfassung I).
// Kategorisierbare Kriterien sind Auswahlfelder mit festen Klassen (Suchpräferenz
// per Mehrfachauswahl, FR-016); Klassen folgen EU-Standards, wo es sie gibt
// (Branche: NACE Rev. 2 Abschnitte; Mitarbeiter/Umsatz: EU-KMU-Definition
// 2003/361/EG). Signale sind einzelne, konkret belegbare Ja/Nein-Kriterien mit
// Belegzeitraum 12 Monate; `hintLabel` markiert Kriterien mit beschriftetem
// Freitextfeld (z. B. gesuchte Stellentitel); `evidence` nennt die Belegquellen
// und wird bei der Übernahme an die Beschreibung angehängt. `replaces` nennt
// frühere Katalog-Namen des Eintrags — Schritt 1 erkennt darüber veraltete
// Profil-Kriterien und bietet Ersetzen an (reine Daten, keine Automatik).
export const criterionCatalog = [
  // --- Firmografie ---
  {
    name: 'Branche',
    category: 'Firmografie',
    description: 'Wirtschaftszweig nach NACE Rev. 2 (EU-Klassifikation, Abschnitte A–S).',
    evidence: 'Website, Firmenverzeichnisse, Registereinträge (Unternehmensgegenstand)',
    type: 'select',
    weight: 15,
    rules: {
      options: [
        { label: 'A — Land- und Forstwirtschaft, Fischerei', points: 30 },
        { label: 'B — Bergbau und Gewinnung von Steinen und Erden', points: 30 },
        { label: 'C — Verarbeitendes Gewerbe', points: 90 },
        { label: 'D — Energieversorgung', points: 60 },
        { label: 'E — Wasserversorgung, Abwasser- und Abfallentsorgung', points: 50 },
        { label: 'F — Baugewerbe', points: 60 },
        { label: 'G — Handel, Instandhaltung und Reparatur von Kraftfahrzeugen', points: 60 },
        { label: 'H — Verkehr und Lagerei', points: 50 },
        { label: 'I — Gastgewerbe', points: 30 },
        { label: 'J — Information und Kommunikation', points: 100 },
        { label: 'K — Finanz- und Versicherungsdienstleistungen', points: 60 },
        { label: 'L — Grundstücks- und Wohnungswesen', points: 40 },
        { label: 'M — Freiberufliche, wissenschaftliche und technische Dienstleistungen', points: 80 },
        { label: 'N — Sonstige wirtschaftliche Dienstleistungen', points: 50 },
        { label: 'O — Öffentliche Verwaltung, Verteidigung, Sozialversicherung', points: 30 },
        { label: 'P — Erziehung und Unterricht', points: 40 },
        { label: 'Q — Gesundheits- und Sozialwesen', points: 50 },
        { label: 'R — Kunst, Unterhaltung und Erholung', points: 30 },
        { label: 'S — Sonstige Dienstleistungen', points: 30 },
      ],
    },
  },
  {
    name: 'Unternehmensgröße (Mitarbeiter)',
    category: 'Firmografie',
    description: 'Größenklasse nach der EU-KMU-Definition (Empfehlung 2003/361/EG).',
    evidence: 'LinkedIn-Übersicht, Karriereseite, Registerdaten, Jobportale',
    type: 'select',
    weight: 15,
    rules: {
      options: [
        { label: 'Kleinstunternehmen (unter 10 Mitarbeiter)', points: 20 },
        { label: 'Kleines Unternehmen (10–49 Mitarbeiter)', points: 60 },
        { label: 'Mittleres Unternehmen (50–249 Mitarbeiter)', points: 100 },
        { label: 'Großunternehmen (250 und mehr Mitarbeiter)', points: 50 },
      ],
    },
  },
  {
    name: 'Region / Standort',
    category: 'Firmografie',
    description: 'Hauptsitz laut Impressum.',
    evidence: 'Impressum, Standortseiten',
    type: 'select',
    weight: 10,
    rules: {
      options: [
        { label: 'Baden-Württemberg', points: 100 },
        { label: 'Bayern', points: 90 },
        { label: 'Nordrhein-Westfalen', points: 70 },
        { label: 'Hessen', points: 70 },
        { label: 'Rheinland-Pfalz / Saarland', points: 60 },
        { label: 'Norddeutschland (HH, HB, SH, NI)', points: 50 },
        { label: 'Ostdeutschland (BE, BB, SN, ST, TH, MV)', points: 50 },
        { label: 'Österreich', points: 60 },
        { label: 'Schweiz', points: 60 },
      ],
    },
  },
  {
    name: 'Umsatzklasse',
    category: 'Firmografie',
    description: 'Jahresumsatz-Klasse nach der EU-KMU-Definition (Empfehlung 2003/361/EG). Kleine Gesellschaften publizieren oft keinen Umsatz — dann bleibt der Wert offen oder wird aus der Bilanzsumme abgeleitet.',
    evidence: 'Pflichtveröffentlichungen im Bundesanzeiger (z. B. via Northdata-Basisansicht), Presse',
    type: 'select',
    weight: 10,
    rules: {
      options: [
        { label: 'bis 2 Mio. € (Kleinstunternehmen)', points: 20 },
        { label: 'über 2 bis 10 Mio. € (kleines Unternehmen)', points: 60 },
        { label: 'über 10 bis 50 Mio. € (mittleres Unternehmen)', points: 100 },
        { label: 'über 50 Mio. € (Großunternehmen)', points: 50 },
      ],
    },
  },
  {
    name: 'Firmenalter',
    category: 'Firmografie',
    replaces: ['Firmenalter (Jahre)'],
    description: 'Altersklasse laut Gründungsjahr.',
    evidence: 'Registereinträge, Website (Über uns), Wikipedia',
    type: 'select',
    weight: 5,
    rules: {
      options: [
        { label: 'unter 5 Jahre', points: 30 },
        { label: '5–14 Jahre', points: 70 },
        { label: '15–49 Jahre', points: 100 },
        { label: '50 Jahre und älter', points: 90 },
      ],
    },
  },
  {
    name: 'Eigentümerstruktur',
    category: 'Firmografie',
    description: 'Wer steht hinter dem Unternehmen?',
    evidence: 'Website (Über uns), Registerdaten, Presse',
    type: 'select',
    weight: 10,
    rules: {
      options: [
        { label: 'Familien- / inhabergeführt', points: 100 },
        { label: 'Konzerntochter', points: 50 },
        { label: 'Investor / Private Equity', points: 60 },
        { label: 'Börsennotiert', points: 40 },
        { label: 'Öffentliche Hand', points: 30 },
        { label: 'Stiftung / Genossenschaft', points: 60 },
      ],
    },
  },
  {
    name: 'Standorte',
    category: 'Firmografie',
    description: 'Standort-Struktur des Unternehmens.',
    evidence: 'Website (Standorte), Impressum',
    type: 'select',
    weight: 5,
    rules: {
      options: [
        { label: 'Ein Standort', points: 70 },
        { label: 'Mehrere Standorte national', points: 100 },
        { label: 'International', points: 60 },
      ],
    },
  },
  // --- Wachstum & Dynamik (je Signal ein eigenes, konkret belegbares Kriterium,
  // Belegzeitraum einheitlich 12 Monate; kein übergreifendes Sammel-Signal) ---
  {
    name: 'Signal: Expansion / Investition / Wachstum',
    category: 'Wachstum & Dynamik',
    replaces: ['Signal: Expansion / Investition', 'Wachstumssignal: Presse/News', 'Wachstumssignale'],
    description: 'Expansions-, Investitions- oder Wachstumsmeldung in den letzten 12 Monaten.',
    evidence: 'Pressemitteilungen, Wirtschafts- und Regionalmedien',
    type: 'boolean',
    weight: 10,
    searchHint: 'Presse und News der letzten 12 Monate prüfen',
    rules: { pointsYes: 100, pointsNo: 30 },
  },
  {
    name: 'Stellenanzeigen (gesuchte Rollen)',
    category: 'Wachstum & Dynamik',
    replaces: [
      'Stellenanzeigen: aktiv', 'Stellenanzeigen: IT / Digitalisierung',
      'Stellenanzeigen: Vertrieb / Marketing', 'Stellenanzeigen: Führungspositionen',
      'Wachstumssignal: Stellenanzeigen',
    ],
    description: 'Aktuell offene Stellen für die angegebenen Rollen ausgeschrieben; ohne Rollen-Angabe zählt jede offene Stelle.',
    evidence: 'Jobportale (Stepstone, Indeed, karriere.at), Karriereseite',
    type: 'boolean',
    weight: 10,
    hintLabel: 'Gesuchte Rollen / Stellentitel',
    rules: { pointsYes: 100, pointsNo: 30 },
  },
  {
    name: 'Signal: Führungswechsel',
    category: 'Wachstum & Dynamik',
    description: 'Neue Geschäftsführung oder C-Level-Position in den letzten 12 Monaten.',
    evidence: 'Presse, LinkedIn-Unternehmensseite, Website',
    type: 'boolean',
    weight: 5,
    searchHint: 'Presse und LinkedIn-Unternehmensseite der letzten 12 Monate auf Führungswechsel prüfen',
    rules: { pointsYes: 100, pointsNo: 50 },
  },
  {
    name: 'Signal: Übernahme / Fusion',
    category: 'Wachstum & Dynamik',
    description: 'Übernahme, Beteiligung oder Fusion in den letzten 12 Monaten.',
    evidence: 'Presse, Registerbekanntmachungen',
    type: 'boolean',
    weight: 5,
    searchHint: 'Presse und Registerbekanntmachungen der letzten 12 Monate prüfen',
    rules: { pointsYes: 100, pointsNo: 50 },
  },
  {
    name: 'Signal: Auszeichnung / Zertifizierung',
    category: 'Wachstum & Dynamik',
    description: 'Preis, Siegel oder Zertifizierung in den letzten 12 Monaten.',
    evidence: 'Website (News), Presse, Auszeichnungslisten',
    type: 'boolean',
    weight: 5,
    searchHint: 'Website-News und Auszeichnungslisten der letzten 12 Monate prüfen',
    rules: { pointsYes: 100, pointsNo: 50 },
  },
  // --- Digitale Präsenz ---
  {
    name: 'Social Media aktiv',
    category: 'Digitale Präsenz',
    replaces: ['Online-Sichtbarkeit'],
    description: 'Beiträge auf öffentlichen Unternehmensseiten in den letzten 3 Monaten.',
    evidence: 'Öffentliche LinkedIn-/Instagram-/YouTube-Unternehmensseiten',
    type: 'boolean',
    weight: 5,
    searchHint: 'Öffentliche Social-Media-Unternehmensseiten auf aktuelle Beiträge prüfen',
    rules: { pointsYes: 100, pointsNo: 40 },
  },
  {
    name: 'KI- / Digitalisierungsbezug',
    category: 'Digitale Präsenz',
    replaces: ['Digitalisierungs- / KI-Reife'],
    description: 'KI oder Digitalisierung aktuell sichtbar in Website, News oder Stellenanzeigen.',
    evidence: 'Website, Presse, Stellenanzeigen',
    type: 'boolean',
    weight: 10,
    searchHint: 'Website, News und Stellenanzeigen nach KI- und Digitalisierungsthemen durchsuchen',
    rules: { pointsYes: 100, pointsNo: 30 },
  },
  // --- Markt & Netzwerk ---
  {
    name: 'B2B/B2C-Fokus',
    category: 'Markt & Netzwerk',
    description: 'Primäre Zielgruppe des Unternehmens.',
    evidence: 'Website (Zielgruppen, Produkte)',
    type: 'select',
    weight: 5,
    rules: {
      options: [
        { label: 'B2B', points: 100 },
        { label: 'B2B und B2C', points: 70 },
        { label: 'B2C', points: 30 },
      ],
    },
  },
];

// Frühere Katalog-Einträge ohne Nachfolger (Nutzer-Entscheidung 2026-08-11:
// zu weich oder nicht relevant). Schritt 1 markiert Profil-Kriterien mit diesen
// Namen als veraltet — entfernt wird nur auf ausdrücklichen Klick.
export const retiredCriterionNames = [
  'Online-Shop / Kundenportal',
  'Website-Reife',
  'Mehrsprachige Website',
  'Messe-Aussteller',
  'Kununu-Score',
];

export const templates = [
  {
    format: 'icp-profile',
    schemaVersion: 1,
    appVersion: '1',
    profile: {
      name: 'Vorlage: B2B-Dienstleistung (Beratung)',
      description: 'Beispielprofil für Beratungs- und Dienstleistungsangebote im B2B. Passen Sie Kriterien, Gewichte und Punktwerte an Ihr Geschäft an.',
      missingValuePolicy: 'neutral',
      criteria: [
        {
          name: 'Branche',
          description: 'Wie gut passt die Branche zu Ihrem Angebot?',
          type: 'select',
          weight: 25,
          knockout: false,
          stage: 'prescreening',
          // Bevorzugte Klassen werden im Workflow angeklickt (searchTargets) — kein Freitext.
          searchTargets: ['IT / Software', 'Industrie / Fertigung'],
          rules: {
            options: [
              { label: 'IT / Software', points: 100 },
              { label: 'Industrie / Fertigung', points: 80 },
              { label: 'Handel', points: 60 },
              { label: 'Öffentlicher Sektor', points: 40 },
              { label: 'Sonstige', points: 20 },
            ],
          },
        },
        {
          // Auswahlfeld statt Zahlenbereich: nur Auswahl-Kriterien taugen als
          // Klassen-Filter der Longlist. Klassen nach EU-KMU-Definition 2003/361/EG.
          name: 'Unternehmensgröße (Mitarbeiter)',
          description: 'Sweet Spot: Mittelstand mit etablierten Strukturen (Größenklassen nach EU-KMU-Definition).',
          type: 'select',
          weight: 20,
          knockout: false,
          stage: 'prescreening',
          searchTargets: ['Mittleres Unternehmen (50–249 Mitarbeiter)'],
          rules: {
            options: [
              { label: 'Kleinstunternehmen (unter 10 Mitarbeiter)', points: 30 },
              { label: 'Kleines Unternehmen (10–49 Mitarbeiter)', points: 70 },
              { label: 'Mittleres Unternehmen (50–249 Mitarbeiter)', points: 100 },
              { label: 'Großunternehmen (250 und mehr Mitarbeiter)', points: 60 },
            ],
          },
        },
        {
          name: 'Projektbudget vorhanden',
          description: 'Ohne Budget kein Mandat — K.o.-Kriterium.',
          type: 'boolean',
          weight: 25,
          knockout: true,
          stage: 'qualification',
          rules: { pointsYes: 100, pointsNo: 0 },
        },
        {
          name: 'Zugang zum Entscheider',
          description: '1 = kein Kontakt, 5 = direkter Draht zur Geschäftsführung.',
          type: 'scale',
          weight: 15,
          knockout: false,
          stage: 'qualification',
          rules: { min: 1, max: 5 },
        },
        {
          name: 'Zeithorizont',
          description: 'Wann soll das Projekt starten?',
          type: 'select',
          weight: 15,
          knockout: false,
          stage: 'qualification',
          rules: {
            options: [
              { label: 'Sofort', points: 100 },
              { label: '3–6 Monate', points: 70 },
              { label: '6–12 Monate', points: 40 },
              { label: 'Unklar', points: 10 },
            ],
          },
        },
      ],
      tiers: [
        { label: 'A', minScore: 75 },
        { label: 'B', minScore: 50 },
        { label: 'C', minScore: 0 },
      ],
    },
  },
  {
    format: 'icp-profile',
    schemaVersion: 1,
    appVersion: '1',
    profile: {
      name: 'Vorlage: SaaS-Produkt (B2B)',
      description: 'Beispielprofil für den Vertrieb eines B2B-SaaS-Produkts. Passen Sie Kriterien, Gewichte und Punktwerte an Ihr Produkt an.',
      missingValuePolicy: 'neutral',
      criteria: [
        {
          // Auswahlfeld statt Zahlenbereich: Klassen-Filter der Longlist brauchen
          // Auswahl-Kriterien. Klassen nach EU-KMU-Definition 2003/361/EG.
          name: 'Unternehmensgröße (Mitarbeiter)',
          description: 'Größenklasse des Unternehmens — bestimmt die Zahl potenzieller Nutzer (EU-KMU-Definition).',
          type: 'select',
          weight: 20,
          knockout: false,
          stage: 'prescreening',
          searchTargets: ['Kleines Unternehmen (10–49 Mitarbeiter)', 'Mittleres Unternehmen (50–249 Mitarbeiter)'],
          rules: {
            options: [
              { label: 'Kleinstunternehmen (unter 10 Mitarbeiter)', points: 40 },
              { label: 'Kleines Unternehmen (10–49 Mitarbeiter)', points: 100 },
              { label: 'Mittleres Unternehmen (50–249 Mitarbeiter)', points: 80 },
              { label: 'Großunternehmen (250 und mehr Mitarbeiter)', points: 50 },
            ],
          },
        },
        {
          name: 'Cloud-Nutzung möglich',
          description: 'Erlaubt die IT-Richtlinie Cloud-Software? K.o.-Kriterium.',
          type: 'boolean',
          weight: 20,
          knockout: true,
          stage: 'qualification',
          rules: { pointsYes: 100, pointsNo: 0 },
        },
        {
          name: 'Branchen-Fit',
          description: 'Passt die Branche zum Produktfokus?',
          type: 'select',
          weight: 25,
          knockout: false,
          stage: 'prescreening',
          searchTargets: ['Technologie', 'Professional Services'],
          rules: {
            options: [
              { label: 'Technologie', points: 100 },
              { label: 'Professional Services', points: 80 },
              { label: 'Handel / E-Commerce', points: 60 },
              { label: 'Sonstige', points: 30 },
            ],
          },
        },
        {
          name: 'Schmerzpunkt-Intensität',
          description: '1 = nice-to-have, 10 = drängendes Problem.',
          type: 'scale',
          weight: 20,
          knockout: false,
          stage: 'qualification',
          rules: { min: 1, max: 10 },
        },
        {
          name: 'Bestehende Lösung',
          description: 'Was nutzt der Lead heute?',
          type: 'select',
          weight: 15,
          knockout: false,
          stage: 'qualification',
          rules: {
            options: [
              { label: 'Keine', points: 100 },
              { label: 'Tabellenkalkulation', points: 80 },
              { label: 'Wettbewerber-Produkt', points: 40 },
              { label: 'Eigenentwicklung', points: 30 },
            ],
          },
        },
      ],
      tiers: [
        { label: 'Hot', minScore: 75 },
        { label: 'Warm', minScore: 50 },
        { label: 'Cold', minScore: 0 },
      ],
    },
  },
];
