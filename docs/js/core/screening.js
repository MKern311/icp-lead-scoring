// Screening-Kernlogik — pure, DOM- und netzwerkfrei. Zweiphasen-Modell fixiert in
// specs/004-deep-screening/contracts/deep-screening.md, Basis-Regeln in
// specs/002-online-screening/contracts/screening.md. Verfassungskritisch: Requests
// serialisieren ausschließlich Pre-Screening-Kriterien (ohne Gewichte/Punktregeln)
// und Suchparameter — nie Bestands-Leads, Bewertungen oder fremde Kandidaten.

import { createLead } from './model.js';

export const SCREENING_MODEL = 'claude-opus-5';
export const LONGLIST_MAX_SEARCHES = 25;
export const DEEP_MAX_SEARCHES = 12;
// Zwei Firmen gleichzeitig: halbiert die Wartezeit, bleibt weit unter dem Rate-Limit.
export const DEEP_CONCURRENCY = 2;
// Grobe Richtwerte in USD — Abrechnungswährung der API (Anzeige, keine Abrechnung)
// Gemessen am 27.08.2026 (Opus 5, 12 Suchen): 103k Eingabe + 3,1k Ausgabe = 0,71 $ für
// ein Unternehmen. Die Spanne bildet wenige bis maximal viele Suchen ab. Die
// Longlist-Spanne ist rechnerisch hergeleitet, nicht gemessen.
export const COST_ESTIMATES = { longlist: [0.35, 1.2], deepPerCompany: [0.2, 0.8] };
// Listenpreise claude-opus-5 (USD je 1 Mio. Token) + Websuche (USD je 1.000 Suchen).
// Cache-Faktoren gemäß Anthropic-Preisliste; diese Requests cachen nicht, defensiv trotzdem.
export const PRICING = {
  currency: 'USD',
  inputPerMTok: 5,
  outputPerMTok: 25,
  cacheWriteFactor: 1.25,
  cacheReadFactor: 0.1,
  webSearchPer1000: 10,
};
// Belege älter als 12 Monate gelten als veraltet (Belegzeitraum der Wachstumssignale).
export const EVIDENCE_MAX_AGE_MONTHS = 12;

export function prescreeningCriteria(profile) {
  return profile.criteria.filter((c) => c.stage === 'prescreening');
}

// Longlist sucht über Klassen-Filter — nur Auswahl-Kriterien taugen dafür (typbasierte
// Regel, kein Modell-Feld; Signale/Skalen/Bereiche sind je Firma teuer und zum Finden
// ungeeignet).
export function longlistCriteria(profile) {
  return prescreeningCriteria(profile).filter((c) => c.type === 'select');
}

// --- Datum & Beleg-Alter ---

// Heutiges Datum als JJJJ-MM-TT (lokale Zeitzone). Einziger nicht-deterministische
// Punkt des Moduls; alle Funktionen nehmen das Datum als Parameter entgegen.
export function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const monthIndex = (s) => {
  const m = /^(\d{4})-(0[1-9]|1[0-2])/.exec(String(s || ''));
  return m ? Number(m[1]) * 12 + Number(m[2]) : null;
};

// Ist der Beleg älter als maxMonths? Pure — beide Daten werden übergeben.
// Unbekannte oder ungültige Daten gelten nie als veraltet (keine Falschmeldung).
export function isEvidenceStale(evidenceDate, today, maxMonths = EVIDENCE_MAX_AGE_MONTHS) {
  const from = monthIndex(evidenceDate);
  const to = monthIndex(today);
  if (from === null || to === null) return false;
  return to - from > maxMonths;
}

// --- Kosten (Anzeige) ---

const posNum = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

// Summiert zwei usage-Objekte der API — nötig, weil ein Lauf mit pause_turn aus
// mehreren Requests besteht und jeder sein eigenes usage liefert.
export function addUsage(a, b) {
  const sum = (k) => posNum(a?.[k]) + posNum(b?.[k]);
  return {
    input_tokens: sum('input_tokens'),
    output_tokens: sum('output_tokens'),
    cache_creation_input_tokens: sum('cache_creation_input_tokens'),
    cache_read_input_tokens: sum('cache_read_input_tokens'),
    server_tool_use: {
      web_search_requests: posNum(a?.server_tool_use?.web_search_requests)
        + posNum(b?.server_tool_use?.web_search_requests),
    },
  };
}

// Tatsächliche Kosten eines Laufs aus dem usage-Objekt (USD). Wirft nie.
export function usageCost(usage) {
  const searches = posNum(usage?.server_tool_use?.web_search_requests);
  const input = (posNum(usage?.input_tokens)
    + posNum(usage?.cache_creation_input_tokens) * PRICING.cacheWriteFactor
    + posNum(usage?.cache_read_input_tokens) * PRICING.cacheReadFactor) / 1e6 * PRICING.inputPerMTok;
  const output = posNum(usage?.output_tokens) / 1e6 * PRICING.outputPerMTok;
  const search = searches / 1000 * PRICING.webSearchPer1000;
  const round4 = (x) => Math.round(x * 10000) / 10000;
  return { input: round4(input), output: round4(output), search: round4(search), total: round4(input + output + search), searches };
}

const key = (index) => `k${index + 1}`;

function valueDescription(c) {
  switch (c.type) {
    case 'select':
      return `Auswahl aus genau diesen Ausprägungen: ${c.rules.options.map((o) => `„${o.label}"`).join(', ')}`;
    case 'range':
      return 'Zahlenwert (die tatsächliche Größe, z. B. Mitarbeiterzahl)';
    case 'boolean':
      return 'Genau „Ja" oder „Nein"';
    case 'scale':
      return `Ganzzahl von ${c.rules.min} bis ${c.rules.max}`;
    default:
      return '';
  }
}

// Schema-Grenzen der API (FR-1001): Sie lehnt Schemas mit mehr als 16 union-typisierten
// **und** mehr als 24 optionalen Parametern ab — beides skaliert mit der Zahl der
// Kriterien, beides war bei einem gewachsenen Profil schnell gerissen (12 Kriterien
// ergaben 49). Deshalb ist hier **jedes** Feld erforderlich und einfach typisiert:
// „unbekannt" ist der leere Text, nicht null und nicht ein fehlendes Feld. Damit ist
// das Schema union- und optionsfrei und die Zahl der Kriterien wieder egal.
//
// Preis dafür: Zahlen und Ja/Nein kommen als Text zurück (ein Typ je Feld, sonst
// bräuchte es wieder eine Union). `mapCompanyValues` wandelt sie zurück; der Prompt
// nennt zu jedem Kriterium das erwartete Format.
const UNKNOWN = '';

// Alle Werte sind schlichter Text. Kein enum: Die dritte Grenze der API ist die Größe
// der kompilierten Grammatik, und Ausprägungs-Listen sind dort der größte Posten — mit
// enum war schon bei 16 Kriterien à 5 Klassen Schluss. Die zulässigen Ausprägungen
// stehen ohnehin wörtlich im Prompt (`valueDescription`), und `mapCompanyValues` prüft
// jeden Wert gegen die Liste und verwirft, was nicht passt. Die Grenze wird also nicht
// aufgegeben, sie wandert nur vom Schema in die Auswertung — wo sie ohnehin nötig war.
function valueSchema() {
  return { type: 'string' };
}

// Werte als **Liste**, nicht als Objekt mit einem Feld je Kriterium (FR-1001).
// Der Grund ist die dritte Grenze der API: Die Größe der kompilierten Grammatik wächst
// mit der Zahl der Felder in einem Objekt — mit einem Feld je Kriterium war ab etwa
// 13 Kriterien Schluss, unabhängig von Unions oder optionalen Feldern. Als Liste hat
// das Schema eine **feste** Größe, egal wie viele Kriterien ein Profil hat.
// `key` benennt das Kriterium (k1, k2, … — dieselben Kürzel wie im Prompt).
function valuesSchema({ withMeta = false } = {}) {
  const properties = {
    key: { type: 'string' },
    value: valueSchema(),
    source: { type: 'string' },
  };
  if (withMeta) {
    properties.confidence = { type: 'string', enum: ['direct', 'inferred', UNKNOWN] };
    properties.evidenceDate = { type: 'string' };
  }
  return {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: Object.keys(properties),   // alles erforderlich — leer heißt unbekannt
      properties,
    },
  };
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
            website: { type: 'string' },
            reasoning: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
            values: valuesSchema(),
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
      website: { type: 'string' },
      summary: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } },
      values: valuesSchema({ withMeta: true }),
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
- Erfinde nichts. Kannst du eine Angabe nicht belegen, setze value auf "" (leerer Text) — rate nie.
- Zeilen „Erforderlich:" sind harte Filter — Unternehmen, die sie nicht erfüllen, gehören nicht in die Liste.
- Gib zu jeder belegten Angabe die Quell-URL an (source), und zu jedem Unternehmen mindestens eine Quell-URL (sources). Unternehmen ohne belastbare Quelle lässt du weg.
- Nur reale, aktuell existierende Unternehmen. Keine Duplikate.
- reasoning: 1–2 deutsche Sätze, warum das Unternehmen passt.
- values ist eine Liste mit genau einem Eintrag je Kriterium; key ist das Kürzel aus der Kriterienliste (k1, k2, …).`;

const DEEP_SYSTEM_PROMPT = `Du bist ein sorgfältiger B2B-Recherche-Assistent. Du prüfst genau EIN vorgegebenes Unternehmen anhand konkreter Kriterien — ausschließlich über öffentlich zugängliche Quellen: Firmenwebsite, Presse und News, Firmenverzeichnisse und öffentliche Registerauszüge (Pflichtveröffentlichungen), Jobportale und Karriereseiten, Messe-Ausstellerlisten, öffentliche Übersichten von Bewertungsplattformen sowie öffentlich einsehbare Social-Media-Unternehmensseiten. Inhalte hinter Login oder Paywall nutzt du nicht.

Regeln:
- Ist keine Website angegeben, identifiziere zuerst die offizielle Website. Kannst du das Unternehmen nicht eindeutig identifizieren, setze found auf false und alle Werte auf "".
- Erfinde nichts. Jeder Wert braucht eine konkrete Quell-URL (source); ohne Quelle setze value und source auf "".
- Der Beleg muss zur Art des Kriteriums passen: Stellenanzeigen-Kriterien nur mit Jobportal- oder Karriereseiten-URL, Presse-/News-Kriterien nur mit Presse- oder News-URL.
- confidence: "direct", wenn die Quelle den Wert explizit nennt; "inferred", wenn du ihn aus Indizien ableitest (z. B. Größenband einer LinkedIn-Übersicht, Bilanzsumme statt Umsatz); "" ohne Wert.
- Zahlen und Ja/Nein kommen als Text: eine blanke Zahl ohne Einheit (z. B. "250"), bzw. genau "Ja" oder "Nein". Keine Bereiche, keine Zusätze.
- evidenceDate: Stand des Belegs im Format JJJJ-MM, wenn bestimmbar — sonst "".
- summary: 1–2 deutsche Sätze zum Unternehmen; sources: die wichtigsten Quell-URLs (mindestens eine).
- values ist eine Liste mit genau einem Eintrag je Kriterium; key ist das Kürzel aus der Kriterienliste (k1, k2, …).`;

// Datumszeile: ohne sie legt das Modell den Bezugspunkt für „letzte 12 Monate"
// selbst fest und datiert Belege falsch (FR-408).
const MAX_EXCLUDED = 150;
function dateLine(today) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))
    ? `Heutiges Datum: ${today}. Zeitangaben wie „in den letzten 12 Monaten" oder „aktuell" beziehen sich immer auf dieses Datum.\n\n`
    : '';
}

// Longlist (SC-401): nur Auswahl-Kriterien, Präferenzen als harte Filter.
// `exclude` = Namen bereits gefundener Kandidaten desselben Laufs (FR-409); der
// Aufrufer darf hier niemals gespeicherte Leads übergeben (Verfassung III).
export function buildLonglistRequest(profile, { region = 'DACH', count = 20, hints = '', today = todayIso(), exclude = [] } = {}) {
  const criteria = longlistCriteria(profile);
  if (criteria.length === 0) {
    throw new Error('Kein Auswahl-Kriterium im Pre-Screening — bitte zuerst ein Auswahlfeld (z. B. Branche oder Unternehmensgröße) aus dem Katalog übernehmen.');
  }
  const n = Math.min(50, Math.max(5, Math.round(count) || 20));
  const lines = criteria.map((c, i) => criterionLine(c, i, { targetsAsFilter: true })).join('\n');

  const excluded = (Array.isArray(exclude) ? exclude : [])
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => name.trim().slice(0, 120))
    .slice(0, MAX_EXCLUDED);
  const excludeBlock = excluded.length > 0
    ? `\nDiese Unternehmen sind bereits gefunden — schlage sie NICHT erneut vor (auch keine Schreibvarianten desselben Unternehmens):\n${excluded.map((name) => `- ${name}`).join('\n')}\n`
    : '';

  const userText = `${dateLine(today)}Finde ${n} Unternehmen in der Region ${region}, die zu folgendem Suchprofil passen.

Kriterien (Schlüssel wie im Ausgabeformat):
${lines}
${excludeBlock}${hints.trim() ? `\nZusätzliche Hinweise: ${hints.trim()}` : ''}
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
export function buildDeepScreeningRequest(profile, { name, website = null } = {}, { region = '', today = todayIso() } = {}) {
  const criteria = prescreeningCriteria(profile);
  if (criteria.length === 0) {
    throw new Error('Keine Pre-Screening-Kriterien im Profil — bitte zuerst Kriterien als „Pre-Screening" markieren.');
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Firmenname fehlt.');
  }
  const lines = criteria.map((c, i) => criterionLine(c, i)).join('\n');
  const site = typeof website === 'string' && website.trim() ? website.trim() : null;

  const userText = `${dateLine(today)}Recherchiere genau dieses eine Unternehmen:

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

// Rückwandlung der Textwerte aus dem Schema (FR-1001). Bewusst eng: „250" wird zu 250,
// „ca. 250 Mitarbeiter" nicht — ein geratener Wert wäre schlimmer als ein offener.
function toBoolean(raw) {
  if (typeof raw === 'boolean') return raw;
  const t = String(raw).trim().toLowerCase();
  if (['ja', 'true', 'yes'].includes(t)) return true;
  if (['nein', 'false', 'no'].includes(t)) return false;
  return null;
}

function toNumber(raw) {
  if (typeof raw === 'number') return raw;
  const t = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}
const EVIDENCE_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Gemeinsames Werte-Mapping (Longlist + Deep). requireSource: Wert ohne Quelle wird
// verworfen (Anti-Halluzination, Deep). withMeta: Konfidenz/Belegdatum defensiv
// übernehmen. Warnungstexte sind testverankert.
// Antwortwerte auf eine Zuordnung Kürzel → Eintrag bringen. Neu ist die Listenform
// (siehe valuesSchema); die frühere Objektform bleibt lesbar, damit gespeicherte
// Antworten und Handbearbeitung nicht brechen.
function valuesByKey(raw) {
  if (Array.isArray(raw)) {
    const map = {};
    for (const entry of raw) {
      const k = typeof entry?.key === 'string' ? entry.key.trim() : '';
      if (k) map[k] = entry;
    }
    return map;
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function mapCompanyValues(rawValues, criteria, { name, requireSource = false, withMeta = false, warnings }) {
  const valuesObj = valuesByKey(rawValues);
  const values = {};
  const valueSources = {};
  const confidence = {};
  const evidenceDates = {};
  const unmatched = [];

  criteria.forEach((c, i) => {
    const entry = valuesObj?.[key(i)];
    const raw = entry?.value;
    // Leerer Text ist das vereinbarte „unbekannt" (FR-1001); null/undefined bleiben
    // zulässig, damit ältere Antworten und Handbearbeitung weiter funktionieren.
    if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) return;
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
      // Kommt als Text („Ja"/„Nein"), weil das Schema je Feld nur einen Typ kennt
      const b = toBoolean(raw);
      if (b === null) {
        warnings.push(`„${name}": „${raw}" ist kein Ja/Nein für „${c.name}" — Wert bleibt offen.`);
        return;
      }
      mapped = b;
    } else if (c.type === 'scale') {
      const v = Math.round(toNumber(raw));
      if (!Number.isFinite(v) || v < c.rules.min || v > c.rules.max) {
        warnings.push(`„${name}": ${raw} liegt außerhalb der Skala von „${c.name}" — Wert bleibt offen.`);
        return;
      }
      mapped = v;
    } else {
      const v = toNumber(raw);
      if (!Number.isFinite(v)) {
        warnings.push(`„${name}": „${raw}" ist keine Zahl für „${c.name}" — Wert bleibt offen.`);
        return;
      }
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
