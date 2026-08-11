// Screening-Kernlogik — pure, DOM- und netzwerkfrei. Zweiphasen-Modell fixiert in
// specs/004-deep-screening/contracts/deep-screening.md, Basis-Regeln in
// specs/002-online-screening/contracts/screening.md. Verfassungskritisch: Requests
// serialisieren ausschließlich Pre-Screening-Kriterien (ohne Gewichte/Punktregeln)
// und Suchparameter — nie Bestands-Leads, Bewertungen oder fremde Kandidaten.

import { createLead } from './model.js';

export const SCREENING_MODEL = 'claude-opus-5';
export const LONGLIST_MAX_SEARCHES = 25;
export const DEEP_MAX_SEARCHES = 12;
// Grobe Richtwerte in EUR (Anzeige, keine Abrechnung)
export const COST_ESTIMATES = { longlist: [0.3, 0.8], deepPerCompany: [0.15, 0.35] };

export function prescreeningCriteria(profile) {
  return profile.criteria.filter((c) => c.stage === 'prescreening');
}

// Longlist sucht über Klassen-Filter — nur Auswahl-Kriterien taugen dafür (typbasierte
// Regel, kein Modell-Feld; Signale/Skalen/Bereiche sind je Firma teuer und zum Finden
// ungeeignet).
export function longlistCriteria(profile) {
  return prescreeningCriteria(profile).filter((c) => c.type === 'select');
}

const key = (index) => `k${index + 1}`;

function valueDescription(c) {
  switch (c.type) {
    case 'select':
      return `Auswahl aus genau diesen Ausprägungen: ${c.rules.options.map((o) => `„${o.label}"`).join(', ')}`;
    case 'range':
      return 'Zahlenwert (die tatsächliche Größe, z. B. Mitarbeiterzahl)';
    case 'boolean':
      return 'Ja (true) oder Nein (false)';
    case 'scale':
      return `Ganzzahl von ${c.rules.min} bis ${c.rules.max}`;
    default:
      return '';
  }
}

function valueSchema(c) {
  switch (c.type) {
    case 'select':
      return { anyOf: [{ type: 'string', enum: c.rules.options.map((o) => o.label) }, { type: 'null' }] };
    case 'boolean':
      return { anyOf: [{ type: 'boolean' }, { type: 'null' }] };
    case 'scale':
      return { anyOf: [{ type: 'integer' }, { type: 'null' }] };
    default:
      return { anyOf: [{ type: 'number' }, { type: 'null' }] };
  }
}

// Werte-Teilschema je Kriterium; withMeta ergänzt Konfidenz + Belegdatum (Deep).
function valuesSchema(criteria, { withMeta = false } = {}) {
  const valueProps = {};
  const keys = criteria.map((_, i) => key(i));
  criteria.forEach((c, i) => {
    const properties = {
      value: valueSchema(c),
      source: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    };
    if (withMeta) {
      properties.confidence = { anyOf: [{ type: 'string', enum: ['direct', 'inferred'] }, { type: 'null' }] };
      properties.evidenceDate = { anyOf: [{ type: 'string' }, { type: 'null' }] };
    }
    valueProps[key(i)] = {
      type: 'object',
      additionalProperties: false,
      required: withMeta ? ['value', 'source', 'confidence', 'evidenceDate'] : ['value', 'source'],
      properties,
    };
  });
  return { type: 'object', additionalProperties: false, required: keys, properties: valueProps };
}

function longlistSchema(criteria) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['companies'],
    properties: {
      companies: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'website', 'reasoning', 'sources', 'values'],
          properties: {
            name: { type: 'string' },
            website: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            reasoning: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
            values: valuesSchema(criteria),
          },
        },
      },
    },
  };
}

function deepSchema(criteria) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['found', 'website', 'summary', 'sources', 'values'],
    properties: {
      found: { type: 'boolean' },
      website: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      summary: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } },
      values: valuesSchema(criteria, { withMeta: true }),
    },
  };
}

// Kriterienzeile für den Request. targetsAsFilter: angeklickte Suchpräferenzen werden
// als harte Filter formuliert (Longlist); im Deep gibt es keine Präferenzen — dort
// werden Fakten geprüft.
function criterionLine(c, i, { targetsAsFilter = false } = {}) {
  const desc = c.description ? ` — ${c.description}` : '';
  let filter = '';
  if (targetsAsFilter && c.type === 'select' && Array.isArray(c.searchTargets) && c.searchTargets.length > 0) {
    const labels = c.rules.options.filter((o) => c.searchTargets.includes(o.id)).map((o) => o.label);
    if (labels.length > 0) filter = `\n   Erforderlich: ${labels.join(', ')}`;
  }
  // hintLabel benennt Freitext-Hinweise fachlich (z. B. „Gesuchte Rollen / Stellentitel:
  // Vertriebsleiter, SAP-Berater") — die KI weiß dann, was der Text bedeutet.
  const hintName = typeof c.hintLabel === 'string' && c.hintLabel.trim() ? c.hintLabel.trim() : 'Suchhinweis';
  const hint = typeof c.searchHint === 'string' && c.searchHint.trim()
    ? `\n   ${hintName}: ${c.searchHint.trim()}` : '';
  return `${key(i)}: ${c.name}${desc}\n   Erwarteter Wert: ${valueDescription(c)}${filter}${hint}`;
}

const LONGLIST_SYSTEM_PROMPT = `Du bist ein sorgfältiger B2B-Recherche-Assistent. Du suchst reale Unternehmen, die zu den genannten Kriterien passen, ausschließlich über öffentlich zugängliche Quellen: Firmenwebsites (Über uns, Produkte, Karriere, Impressum), Presse und News (Pressemitteilungsportale, Wirtschafts-, Fach- und Regionalmedien), Firmenverzeichnisse und öffentliche Registerauszüge, Stellenanzeigen, Messe-Ausstellerlisten und Verbandsverzeichnisse sowie öffentlich einsehbare Social-Media-Unternehmensseiten. Inhalte hinter Login oder Paywall nutzt du nicht.

Regeln:
- Erfinde nichts. Wenn du eine Angabe nicht belegen kannst, setze value auf null.
- Zeilen „Erforderlich:" sind harte Filter — Unternehmen, die sie nicht erfüllen, gehören nicht in die Liste.
- Gib zu jeder belegten Angabe die Quell-URL an (source), und zu jedem Unternehmen mindestens eine Quell-URL (sources). Unternehmen ohne belastbare Quelle lässt du weg.
- Nur reale, aktuell existierende Unternehmen. Keine Duplikate.
- reasoning: 1–2 deutsche Sätze, warum das Unternehmen passt.`;

const DEEP_SYSTEM_PROMPT = `Du bist ein sorgfältiger B2B-Recherche-Assistent. Du prüfst genau EIN vorgegebenes Unternehmen anhand konkreter Kriterien — ausschließlich über öffentlich zugängliche Quellen: Firmenwebsite, Presse und News, Firmenverzeichnisse und öffentliche Registerauszüge (Pflichtveröffentlichungen), Jobportale und Karriereseiten, Messe-Ausstellerlisten, öffentliche Übersichten von Bewertungsplattformen sowie öffentlich einsehbare Social-Media-Unternehmensseiten. Inhalte hinter Login oder Paywall nutzt du nicht.

Regeln:
- Ist keine Website angegeben, identifiziere zuerst die offizielle Website. Kannst du das Unternehmen nicht eindeutig identifizieren, setze found auf false und alle Werte auf null.
- Erfinde nichts. Jeder Wert braucht eine konkrete Quell-URL (source); ohne Quelle setze value auf null.
- Der Beleg muss zur Art des Kriteriums passen: Stellenanzeigen-Kriterien nur mit Jobportal- oder Karriereseiten-URL, Presse-/News-Kriterien nur mit Presse- oder News-URL.
- confidence: "direct", wenn die Quelle den Wert explizit nennt; "inferred", wenn du ihn aus Indizien ableitest (z. B. Größenband einer LinkedIn-Übersicht, Bilanzsumme statt Umsatz).
- evidenceDate: Stand des Belegs im Format JJJJ-MM, wenn bestimmbar, sonst null.
- summary: 1–2 deutsche Sätze zum Unternehmen; sources: die wichtigsten Quell-URLs (mindestens eine).`;

// Longlist (SC-401): nur Auswahl-Kriterien, Präferenzen als harte Filter.
export function buildLonglistRequest(profile, { region = 'DACH', count = 20, hints = '' } = {}) {
  const criteria = longlistCriteria(profile);
  if (criteria.length === 0) {
    throw new Error('Kein Auswahl-Kriterium im Pre-Screening — bitte zuerst ein Auswahlfeld (z. B. Branche oder Unternehmensgröße) aus dem Katalog übernehmen.');
  }
  const n = Math.min(50, Math.max(5, Math.round(count) || 20));
  const lines = criteria.map((c, i) => criterionLine(c, i, { targetsAsFilter: true })).join('\n');

  const userText = `Finde ${n} Unternehmen in der Region ${region}, die zu folgendem Suchprofil passen.

Kriterien (Schlüssel wie im Ausgabeformat):
${lines}
${hints.trim() ? `\nZusätzliche Hinweise: ${hints.trim()}` : ''}
Recherchiere mit der Websuche und liefere das Ergebnis exakt im vorgegebenen JSON-Format. Antworte auf Deutsch.`;

  return {
    model: SCREENING_MODEL,
    max_tokens: 16000,
    system: LONGLIST_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: longlistSchema(criteria) } },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: LONGLIST_MAX_SEARCHES }],
    messages: [{ role: 'user', content: userText }],
  };
}

// Deep (SC-402): genau ein Unternehmen — nur name/website/Region + Pre-Screening-Kriterien.
export function buildDeepScreeningRequest(profile, { name, website = null } = {}, { region = '' } = {}) {
  const criteria = prescreeningCriteria(profile);
  if (criteria.length === 0) {
    throw new Error('Keine Pre-Screening-Kriterien im Profil — bitte zuerst Kriterien als „Pre-Screening" markieren.');
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Firmenname fehlt.');
  }
  const lines = criteria.map((c, i) => criterionLine(c, i)).join('\n');
  const site = typeof website === 'string' && website.trim() ? website.trim() : null;

  const userText = `Recherchiere genau dieses eine Unternehmen:

Unternehmen: ${name.trim()}${site ? `\nWebsite: ${site}` : ''}${region ? `\nRegion (Kontext): ${region}` : ''}

Ermittle zu jedem der folgenden Kriterien den belegten Wert:
${lines}

Liefere das Ergebnis exakt im vorgegebenen JSON-Format. Antworte auf Deutsch.`;

  return {
    model: SCREENING_MODEL,
    max_tokens: 8000,
    system: DEEP_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: deepSchema(criteria) } },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: DEEP_MAX_SEARCHES }],
    messages: [{ role: 'user', content: userText }],
  };
}

export function estimateDeepCost(n) {
  const [lo, hi] = COST_ESTIMATES.deepPerCompany;
  const round2 = (x) => Math.round(x * 100) / 100;
  return { min: round2(n * lo), max: round2(n * hi) };
}

// Schritt-4-Warteschlange des Workflows (contracts/workflow.md W5): Screening-Leads,
// bei denen mindestens ein Qualifizierungskriterium noch keinen Wert hat. Wirft nie.
export function qualificationQueue(profile, leads) {
  const qual = Array.isArray(profile?.criteria)
    ? profile.criteria.filter((c) => c.stage !== 'prescreening') : [];
  if (qual.length === 0 || !Array.isArray(leads)) return [];
  return leads.filter((l) => l?.source === 'screening'
    && qual.some((c) => l.values?.[c.id] === undefined));
}

const cleanUrl = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);
const EVIDENCE_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Gemeinsames Werte-Mapping (Longlist + Deep). requireSource: Wert ohne Quelle wird
// verworfen (Anti-Halluzination, Deep). withMeta: Konfidenz/Belegdatum defensiv
// übernehmen. Warnungstexte sind testverankert.
function mapCompanyValues(valuesObj, criteria, { name, requireSource = false, withMeta = false, warnings }) {
  const values = {};
  const valueSources = {};
  const confidence = {};
  const evidenceDates = {};
  const unmatched = [];

  criteria.forEach((c, i) => {
    const entry = valuesObj?.[key(i)];
    const raw = entry?.value;
    if (raw === null || raw === undefined) return;
    const src = cleanUrl(entry.source);
    if (requireSource && !src) {
      warnings.push(`„${name}": Wert für „${c.name}" ohne Quelle — verworfen.`);
      return;
    }
    let mapped;
    if (c.type === 'select') {
      const opt = c.rules.options.find((o) => o.label.trim().toLowerCase() === String(raw).trim().toLowerCase());
      if (!opt) {
        unmatched.push({ criterionId: c.id, criterionName: c.name, raw: String(raw), source: src });
        warnings.push(`„${name}": „${raw}" ist keine Ausprägung von „${c.name}" — Wert bleibt offen.`);
        return;
      }
      mapped = opt.id;
    } else if (c.type === 'boolean') {
      if (typeof raw !== 'boolean') return;
      mapped = raw;
    } else if (c.type === 'scale') {
      const v = Math.round(Number(raw));
      if (!Number.isFinite(v) || v < c.rules.min || v > c.rules.max) {
        warnings.push(`„${name}": ${raw} liegt außerhalb der Skala von „${c.name}" — Wert bleibt offen.`);
        return;
      }
      mapped = v;
    } else {
      const v = Number(raw);
      if (!Number.isFinite(v)) return;
      mapped = v;
    }
    values[c.id] = mapped;
    if (src) valueSources[c.id] = src;
    if (withMeta) {
      if (entry.confidence === 'direct' || entry.confidence === 'inferred') confidence[c.id] = entry.confidence;
      if (typeof entry.evidenceDate === 'string' && entry.evidenceDate) {
        if (EVIDENCE_DATE_RE.test(entry.evidenceDate)) evidenceDates[c.id] = entry.evidenceDate;
        else warnings.push(`„${name}": Belegdatum „${entry.evidenceDate}" für „${c.name}" ist ungültig — weggelassen.`);
      }
    }
  });

  return { values, valueSources, confidence, evidenceDates, unmatched };
}

// Longlist-Antwort → Kandidaten. Schlüssel k1..kn entsprechen longlistCriteria
// (wie im Request). Wirft nie; alles Unerwartete wird zur Warnung.
export function parseCandidates(output, profile) {
  const criteria = longlistCriteria(profile);
  const warnings = [];
  const candidates = [];

  const companies = Array.isArray(output?.companies) ? output.companies : null;
  if (!companies) {
    return { candidates, warnings: ['Die Antwort enthielt keine Kandidatenliste.'] };
  }

  for (const company of companies) {
    const name = typeof company?.name === 'string' ? company.name.trim() : '';
    if (!name) { warnings.push('Ein Kandidat ohne Namen wurde übersprungen.'); continue; }

    const mapped = mapCompanyValues(company.values, criteria, { name, warnings });

    const sources = (Array.isArray(company.sources) ? company.sources : [])
      .map(cleanUrl).filter(Boolean);
    if (sources.length === 0 && Object.keys(mapped.valueSources).length === 0) {
      warnings.push(`„${name}" wurde verworfen — keine Quelle angegeben.`);
      continue;
    }

    candidates.push({
      name,
      website: cleanUrl(company.website),
      reasoning: typeof company.reasoning === 'string' ? company.reasoning : '',
      sources,
      valueSources: mapped.valueSources,
      values: mapped.values,
      unmatched: mapped.unmatched,
    });
  }

  return { candidates, warnings };
}

// Deep-Antwort → ein Kandidat oder null (SC-403). Wirft nie.
export function parseDeepResult(output, profile, { name = '' } = {}) {
  const warnings = [];
  if (!output || typeof output !== 'object' || output.found !== true) {
    return { candidate: null, warnings: [`„${name || 'Unbekannt'}": Unternehmen konnte nicht eindeutig identifiziert werden.`] };
  }
  const criteria = prescreeningCriteria(profile);
  const mapped = mapCompanyValues(output.values, criteria, { name, requireSource: true, withMeta: true, warnings });

  const sources = (Array.isArray(output.sources) ? output.sources : []).map(cleanUrl).filter(Boolean);
  if (sources.length === 0 && Object.keys(mapped.valueSources).length === 0) {
    warnings.push(`„${name}" wurde verworfen — keine Quelle angegeben.`);
    return { candidate: null, warnings };
  }

  return {
    candidate: {
      name: name.trim(),
      website: cleanUrl(output.website),
      reasoning: typeof output.summary === 'string' ? output.summary : '',
      sources,
      valueSources: mapped.valueSources,
      values: mapped.values,
      confidence: mapped.confidence,
      evidenceDates: mapped.evidenceDates,
      unmatched: mapped.unmatched,
    },
    warnings,
  };
}

// Longlist + Deep zusammenführen: Deep gewinnt, Longlist bleibt Fallback (ohne
// Konfidenz); Quellen-Union.
export function mergeDeepIntoCandidate(longlistCand, deepCand) {
  const sources = [...(longlistCand.sources || []), ...(deepCand.sources || [])]
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return {
    name: longlistCand.name,
    website: deepCand.website || longlistCand.website || null,
    reasoning: deepCand.reasoning || longlistCand.reasoning || '',
    sources,
    values: { ...longlistCand.values, ...deepCand.values },
    valueSources: { ...longlistCand.valueSources, ...deepCand.valueSources },
    confidence: { ...(deepCand.confidence || {}) },
    evidenceDates: { ...(deepCand.evidenceDates || {}) },
    unmatched: [...(longlistCand.unmatched || []), ...(deepCand.unmatched || [])],
  };
}

// Kandidat → Lead. Punkte entstehen ausschließlich über evaluate() (Constitution II);
// Konfidenz/Belegdatum sind Metadaten und beeinflussen die Bewertung nicht (SC-404).
// Kriterien, die es im Profil nicht mehr gibt, werden ignoriert.
export function candidateToLead(candidate, profile, { region = '', date = '' } = {}) {
  const validIds = new Set(profile.criteria.map((c) => c.id));
  const lead = createLead(profile.id);
  lead.name = candidate.name;
  lead.source = 'screening';
  if (candidate.website) lead.website = candidate.website;

  lead.values = {};
  lead.sources = {};
  for (const [id, value] of Object.entries(candidate.values)) {
    if (!validIds.has(id)) continue;
    lead.values[id] = value;
    if (candidate.valueSources[id]) lead.sources[id] = candidate.valueSources[id];
  }

  const conf = {};
  const dates = {};
  for (const [id, v] of Object.entries(candidate.confidence || {})) {
    if (id in lead.values) conf[id] = v;
  }
  for (const [id, d] of Object.entries(candidate.evidenceDates || {})) {
    if (id in lead.values) dates[id] = d;
  }
  if (Object.keys(conf).length > 0) lead.confidence = conf;
  if (Object.keys(dates).length > 0) lead.evidenceDates = dates;

  const noteParts = [];
  if (candidate.reasoning) noteParts.push(candidate.reasoning);
  const meta = ['Screening', region && `Region: ${region}`, date && `am ${date}`].filter(Boolean).join(', ');
  noteParts.push(meta);
  if (candidate.sources.length > 0) noteParts.push(`Quellen:\n${candidate.sources.map((s) => `- ${s}`).join('\n')}`);
  lead.note = noteParts.join('\n\n');

  return lead;
}
