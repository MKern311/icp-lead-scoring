// Screening-Kernlogik — pure, DOM- und netzwerkfrei. Regeln fixiert in
// specs/002-online-screening/contracts/screening.md. Verfassungskritisch:
// buildScreeningRequest serialisiert ausschließlich Pre-Screening-Kriterien
// (ohne Gewichte/Punktregeln) und Lauf-Parameter — nie Leads oder Bewertungen.

import { createLead } from './model.js';

export const SCREENING_MODEL = 'claude-opus-5';
export const MAX_WEB_SEARCHES = 40;

export function prescreeningCriteria(profile) {
  return profile.criteria.filter((c) => c.stage === 'prescreening');
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

function buildOutputSchema(criteria) {
  const valueProps = {};
  const keys = criteria.map((_, i) => key(i));
  criteria.forEach((c, i) => {
    valueProps[key(i)] = {
      type: 'object',
      additionalProperties: false,
      required: ['value', 'source'],
      properties: {
        value: valueSchema(c),
        source: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
    };
  });
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
            values: { type: 'object', additionalProperties: false, required: keys, properties: valueProps },
          },
        },
      },
    },
  };
}

const SYSTEM_PROMPT = `Du bist ein sorgfältiger B2B-Recherche-Assistent. Du suchst reale Unternehmen, die zu den genannten Kriterien passen, ausschließlich über öffentlich zugängliche Quellen: Firmenwebsites (Über uns, Produkte, Karriere, Impressum), Presse und News (Pressemitteilungsportale, Wirtschafts-, Fach- und Regionalmedien), Firmenverzeichnisse und öffentliche Registerauszüge, Stellenanzeigen, Messe-Ausstellerlisten und Verbandsverzeichnisse sowie öffentlich einsehbare Social-Media-Unternehmensseiten. Inhalte hinter Login oder Paywall nutzt du nicht.

Regeln:
- Erfinde nichts. Wenn du eine Angabe nicht belegen kannst, setze value auf null.
- Gib zu jeder belegten Angabe die Quell-URL an (source), und zu jedem Unternehmen mindestens eine Quell-URL (sources). Unternehmen ohne belastbare Quelle lässt du weg.
- Nur reale, aktuell existierende Unternehmen. Keine Duplikate.
- reasoning: 1–2 deutsche Sätze, warum das Unternehmen passt.
- Bevorzuge Unternehmen, die möglichst viele Kriterien gut erfüllen.`;

// Nur Pre-Screening-Kriterien + Lauf-Parameter — keine Gewichte, Punktregeln,
// Stufen, Profilnamen, Leads oder Bewertungen (Constitution III c, SC-004).
export function buildScreeningRequest(profile, { region = 'DACH', count = 20, hints = '' } = {}) {
  const criteria = prescreeningCriteria(profile);
  if (criteria.length === 0) {
    throw new Error('Keine Pre-Screening-Kriterien im Profil — bitte zuerst Kriterien als „Pre-Screening" markieren.');
  }
  const n = Math.min(50, Math.max(5, Math.round(count) || 20));

  const criteriaLines = criteria.map((c, i) => {
    const desc = c.description ? ` — ${c.description}` : '';
    // Suchparameter je Kriterium (Feature 003) — nur Pre-Screening-Kriterien erreichen
    // diese Stelle (Filter oben, SC-004). searchTargets: vom Nutzer angeklickte
    // bevorzugte Ausprägungen (FR-016); searchHint: Freitext (v. a. Zahlenbereiche).
    const targetLabels = c.type === 'select' && Array.isArray(c.searchTargets) && c.searchTargets.length > 0
      ? c.rules.options.filter((o) => c.searchTargets.includes(o.id)).map((o) => o.label)
      : [];
    const targets = targetLabels.length > 0 ? `\n   Bevorzugt: ${targetLabels.join(', ')}` : '';
    const hint = typeof c.searchHint === 'string' && c.searchHint.trim()
      ? `\n   Suchhinweis: ${c.searchHint.trim()}` : '';
    return `${key(i)}: ${c.name}${desc}\n   Erwarteter Wert: ${valueDescription(c)}${targets}${hint}`;
  }).join('\n');

  const userText = `Finde ${n} Unternehmen in der Region ${region}, die zu folgendem Suchprofil passen.

Kriterien (Schlüssel wie im Ausgabeformat):
${criteriaLines}
${hints.trim() ? `\nZusätzliche Hinweise: ${hints.trim()}` : ''}
Recherchiere mit der Websuche und liefere das Ergebnis exakt im vorgegebenen JSON-Format. Antworte auf Deutsch.`;

  return {
    model: SCREENING_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: buildOutputSchema(criteria) } },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_WEB_SEARCHES }],
    messages: [{ role: 'user', content: userText }],
  };
}

// Schritt-3-Warteschlange des Workflows (contracts/workflow.md W5): Screening-Leads,
// bei denen mindestens ein Qualifizierungskriterium noch keinen Wert hat. Wirft nie.
export function qualificationQueue(profile, leads) {
  const qual = Array.isArray(profile?.criteria)
    ? profile.criteria.filter((c) => c.stage !== 'prescreening') : [];
  if (qual.length === 0 || !Array.isArray(leads)) return [];
  return leads.filter((l) => l?.source === 'screening'
    && qual.some((c) => l.values?.[c.id] === undefined));
}

const cleanUrl = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);

// Antwort → Kandidaten. Wirft nie; alles Unerwartete wird zur Warnung.
export function parseCandidates(output, profile) {
  const criteria = prescreeningCriteria(profile);
  const warnings = [];
  const candidates = [];

  const companies = Array.isArray(output?.companies) ? output.companies : null;
  if (!companies) {
    return { candidates, warnings: ['Die Antwort enthielt keine Kandidatenliste.'] };
  }

  for (const company of companies) {
    const name = typeof company?.name === 'string' ? company.name.trim() : '';
    if (!name) { warnings.push('Ein Kandidat ohne Namen wurde übersprungen.'); continue; }

    const values = {};
    const valueSources = {};
    const unmatched = [];

    criteria.forEach((c, i) => {
      const entry = company.values?.[key(i)];
      const raw = entry?.value;
      if (raw === null || raw === undefined) return;
      let mapped;
      if (c.type === 'select') {
        const opt = c.rules.options.find((o) => o.label.trim().toLowerCase() === String(raw).trim().toLowerCase());
        if (!opt) {
          unmatched.push({ criterionId: c.id, criterionName: c.name, raw: String(raw), source: cleanUrl(entry.source) });
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
      const src = cleanUrl(entry.source);
      if (src) valueSources[c.id] = src;
    });

    const sources = (Array.isArray(company.sources) ? company.sources : [])
      .map(cleanUrl).filter(Boolean);
    if (sources.length === 0 && Object.keys(valueSources).length === 0) {
      warnings.push(`„${name}" wurde verworfen — keine Quelle angegeben.`);
      continue;
    }

    candidates.push({
      name,
      website: cleanUrl(company.website),
      reasoning: typeof company.reasoning === 'string' ? company.reasoning : '',
      sources,
      valueSources,
      values,
      unmatched,
    });
  }

  return { candidates, warnings };
}

// Kandidat → Lead. Punkte entstehen ausschließlich über evaluate() (Constitution II).
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

  const noteParts = [];
  if (candidate.reasoning) noteParts.push(candidate.reasoning);
  const meta = ['Screening', region && `Region: ${region}`, date && `am ${date}`].filter(Boolean).join(', ');
  noteParts.push(meta);
  if (candidate.sources.length > 0) noteParts.push(`Quellen:\n${candidate.sources.map((s) => `- ${s}`).join('\n')}`);
  lead.note = noteParts.join('\n\n');

  return lead;
}
