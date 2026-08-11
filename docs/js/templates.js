// Mitgelieferte Beispiel-Profile — reine Daten im Export-Format (Constitution I:
// Vorlagen nutzen exakt dieselben Mechanismen wie Nutzerprofile, kein Sondercode).
// Instanziierung läuft über profile-io.importProfile (neue IDs, volle Validierung).

// Katalog online recherchierbarer Kriterien (Feature 003, FR-014) — reine Daten.
// Schritt 1 des Workflows bietet sie zum Übernehmen an; Gewichte und Punktregeln
// sind Startwerte und im Profil-Editor frei anpassbar (Verfassung I).
export const criterionCatalog = [
  {
    name: 'Branche',
    description: 'Über Website, Verzeichnisse und Presse belegbar.',
    type: 'select',
    weight: 15,
    searchHint: 'Bevorzugte Branchen eintragen, z. B. IT/Software und Industrie',
    rules: {
      options: [
        { label: 'IT / Software', points: 100 },
        { label: 'Industrie / Fertigung', points: 80 },
        { label: 'Handel / E-Commerce', points: 60 },
        { label: 'Dienstleistung', points: 60 },
        { label: 'Öffentlicher Sektor', points: 40 },
        { label: 'Sonstige', points: 20 },
      ],
    },
  },
  {
    name: 'Unternehmensgröße (Mitarbeiter)',
    description: 'Registerdaten, Karriereseiten, Jobportale, LinkedIn-Unternehmensseite.',
    type: 'range',
    weight: 15,
    searchHint: 'z. B. bevorzugt 50–250 Mitarbeiter',
    rules: {
      ranges: [
        { min: 1, max: 9, points: 30 },
        { min: 10, max: 49, points: 70 },
        { min: 50, max: 249, points: 100 },
        { min: 250, max: 5000, points: 60 },
      ],
    },
  },
  {
    name: 'Region / Standort',
    description: 'Impressum und Standortangaben der Website.',
    type: 'select',
    weight: 10,
    searchHint: 'z. B. bevorzugt Süddeutschland',
    rules: {
      options: [
        { label: 'Deutschland', points: 100 },
        { label: 'Österreich', points: 80 },
        { label: 'Schweiz', points: 80 },
        { label: 'Sonstige', points: 20 },
      ],
    },
  },
  {
    name: 'Umsatzklasse',
    description: 'Öffentliche Registerdaten (z. B. Northdata) — oft nur grob belegbar.',
    type: 'select',
    weight: 10,
    searchHint: 'z. B. bevorzugt 10–50 Mio. € Jahresumsatz',
    rules: {
      options: [
        { label: 'unter 1 Mio. €', points: 20 },
        { label: '1–10 Mio. €', points: 60 },
        { label: '10–50 Mio. €', points: 100 },
        { label: 'über 50 Mio. €', points: 70 },
      ],
    },
  },
  {
    name: 'Firmenalter (Jahre)',
    description: 'Gründungsjahr aus Register, Website oder Presse.',
    type: 'range',
    weight: 5,
    searchHint: 'z. B. bevorzugt etablierte Unternehmen ab 10 Jahren',
    rules: {
      ranges: [
        { min: 0, max: 4, points: 30 },
        { min: 5, max: 14, points: 70 },
        { min: 15, max: 200, points: 100 },
      ],
    },
  },
  {
    name: 'Wachstumssignale',
    description: 'Presse-News, Stellenanzeigen, Expansionsmeldungen der letzten 12 Monate.',
    type: 'boolean',
    weight: 15,
    searchHint: 'Stellenanzeigen und News der letzten 12 Monate prüfen',
    rules: { pointsYes: 100, pointsNo: 30 },
  },
  {
    name: 'Digitalisierungs- / KI-Reife',
    description: 'Website, Karriereseite, Tech-Stellenprofile, veröffentlichte Projekte.',
    type: 'scale',
    weight: 15,
    searchHint: '1 = analog unterwegs, 5 = digital führend',
    rules: { min: 1, max: 5 },
  },
  {
    name: 'Online-Sichtbarkeit',
    description: 'Website-Qualität und öffentlich gepflegte Social-Media-Unternehmensseiten.',
    type: 'scale',
    weight: 10,
    searchHint: 'Website und öffentliche Social-Media-Präsenz (LinkedIn, Instagram, YouTube)',
    rules: { min: 1, max: 5 },
  },
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
          searchHint: 'Bevorzugt IT/Software und Industrie/Fertigung',
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
          name: 'Unternehmensgröße (Mitarbeiter)',
          description: 'Sweet Spot: Mittelstand mit etablierten Strukturen.',
          type: 'range',
          weight: 20,
          knockout: false,
          stage: 'prescreening',
          searchHint: 'Bevorzugt 50–249 Mitarbeiter',
          rules: {
            ranges: [
              { min: 1, max: 9, points: 30 },
              { min: 10, max: 49, points: 70 },
              { min: 50, max: 249, points: 100 },
              { min: 250, max: 5000, points: 60 },
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
          name: 'Teamgröße (Nutzer)',
          description: 'Wie viele Personen würden das Produkt nutzen?',
          type: 'range',
          weight: 20,
          knockout: false,
          stage: 'prescreening',
          searchHint: 'Bevorzugt Teams mit 11–50 potenziellen Nutzern',
          rules: {
            ranges: [
              { min: 1, max: 10, points: 40 },
              { min: 11, max: 50, points: 100 },
              { min: 51, max: 200, points: 80 },
              { min: 201, max: 10000, points: 50 },
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
          searchHint: 'Bevorzugt Technologie und Professional Services',
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
