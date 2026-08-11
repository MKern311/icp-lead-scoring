// Entity-Factories und Validierung — pure, DOM-frei (data-model.md).

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2, 12);
}

export const CRITERION_TYPES = ['select', 'range', 'boolean', 'scale'];
export const MISSING_POLICIES = ['neutral', 'zero'];
// Screening-Phasen: prescreening = online recherchierbar, qualification = 2. Screening
// (manuell). Sichere Voreinstellung ist qualification — nichts wird ungefragt übertragen.
export const STAGES = ['prescreening', 'qualification'];

export function createProfile(name = '') {
  return {
    id: uuid(),
    schemaVersion: 1,
    name,
    description: '',
    missingValuePolicy: 'neutral',
    criteria: [],
    tiers: [createTier('A', 75), createTier('B', 50), createTier('C', 0)],
  };
}

export function createCriterion(type) {
  const base = { id: uuid(), name: '', description: '', type, weight: 10, knockout: false, stage: 'qualification', searchHint: '', searchTargets: [] };
  switch (type) {
    case 'select':
      base.rules = {
        options: [
          { id: uuid(), label: 'Option 1', points: 100 },
          { id: uuid(), label: 'Option 2', points: 0 },
        ],
      };
      break;
    case 'range':
      base.rules = { ranges: [{ min: 0, max: 10, points: 100 }] };
      break;
    case 'boolean':
      base.rules = { pointsYes: 100, pointsNo: 0 };
      break;
    case 'scale':
      base.rules = { min: 1, max: 5 };
      break;
    default:
      throw new Error(`Unbekannter Kriterientyp: ${type}`);
  }
  return base;
}

export function createTier(label, minScore) {
  return { id: uuid(), label, minScore };
}

// Übernahme eines Katalog-Eintrags (FR-014/FR-407): neue IDs, Phase Pre-Screening,
// Regeln kopiert, Belegquelle (evidence) in die Beschreibung übernommen — der
// Katalog selbst bleibt unverändert (reine Daten).
export function criterionFromCatalog(entry) {
  const c = createCriterion(entry.type);
  c.name = entry.name;
  c.description = [entry.description || '', entry.evidence ? `Beleg: ${entry.evidence}.` : '']
    .filter(Boolean).join(' ').slice(0, 500);
  c.weight = typeof entry.weight === 'number' ? entry.weight : 10;
  c.stage = 'prescreening';
  c.searchHint = entry.searchHint || '';
  if (entry.rules) {
    c.rules = entry.type === 'select'
      ? { options: entry.rules.options.map((o) => ({ id: uuid(), label: o.label, points: o.points })) }
      : structuredClone(entry.rules);
  }
  return c;
}

export function createLead(profileId) {
  return { id: uuid(), profileId, name: '', note: '', values: {}, source: 'manual' };
}

// Migration für Profile aus älteren Beständen/Exporten: Kriterien ohne (gültige)
// Phase erhalten die sichere Voreinstellung „qualification", fehlendes searchHint
// wird leer ergänzt. Idempotent.
export function migrateProfile(profile) {
  if (profile?.criteria) {
    for (const c of profile.criteria) {
      if (!STAGES.includes(c.stage)) c.stage = 'qualification';
      if (typeof c.searchHint !== 'string') c.searchHint = '';
      if (!Array.isArray(c.searchTargets)) c.searchTargets = [];
    }
  }
  return profile;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const inRange = (v, lo, hi) => isNum(v) && v >= lo && v <= hi;
const strOk = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

export function weightSum(profile) {
  const sum = profile.criteria.reduce((acc, c) => acc + (isNum(c.weight) ? c.weight : 0), 0);
  return Math.round(sum * 100) / 100;
}

// Skaliert alle Gewichte proportional, sodass die Summe exakt 100 ergibt
// (letztes Kriterium gleicht Rundungsdifferenzen aus — deterministisch).
export function normalizeWeights(profile) {
  const sum = weightSum(profile);
  if (sum <= 0) return profile;
  let assigned = 0;
  profile.criteria.forEach((c, i) => {
    if (i < profile.criteria.length - 1) {
      c.weight = Math.round((c.weight / sum) * 1000) / 10;
      assigned += c.weight;
    } else {
      c.weight = Math.round((100 - assigned) * 10) / 10;
    }
  });
  return profile;
}

function validateCriterion(c, idx, errors) {
  const label = c.name?.trim() || `Kriterium ${idx + 1}`;
  const field = `criteria.${idx}`;
  if (!strOk(c.name, 1, 80)) errors.push({ field, message: `${label}: Name ist Pflicht (max. 80 Zeichen).` });
  if (c.description && !strOk(c.description, 0, 500)) errors.push({ field, message: `${label}: Beschreibung zu lang (max. 500 Zeichen).` });
  if (!CRITERION_TYPES.includes(c.type)) { errors.push({ field, message: `${label}: unbekannter Typ.` }); return; }
  if (!STAGES.includes(c.stage)) errors.push({ field, message: `${label}: ungültige Screening-Phase.` });
  if (c.searchHint !== undefined && (typeof c.searchHint !== 'string' || c.searchHint.length > 200)) {
    errors.push({ field, message: `${label}: Suchhinweis muss Text mit max. 200 Zeichen sein.` });
  }
  if (c.searchTargets !== undefined) {
    const optionIds = c.type === 'select' ? new Set((c.rules?.options || []).map((o) => o.id)) : null;
    if (!Array.isArray(c.searchTargets) || c.searchTargets.some((t) => typeof t !== 'string')
      || (optionIds && c.searchTargets.some((t) => !optionIds.has(t)))) {
      errors.push({ field, message: `${label}: ungültige Suchauswahl (nur vorhandene Ausprägungen).` });
    }
  }
  if (!inRange(c.weight, 0, 100)) errors.push({ field, message: `${label}: Gewichtung muss zwischen 0 und 100 liegen.` });

  const r = c.rules || {};
  if (c.type === 'select') {
    const opts = r.options || [];
    if (opts.length < 2 || opts.length > 20) {
      errors.push({ field, message: `${label}: 2–20 Optionen erforderlich.` });
    }
    const seen = new Set();
    for (const o of opts) {
      if (!strOk(o.label, 1, 80)) errors.push({ field, message: `${label}: jede Option braucht ein Label (max. 80 Zeichen).` });
      const key = (o.label || '').trim().toLowerCase();
      if (seen.has(key)) errors.push({ field, message: `${label}: Options-Labels müssen eindeutig sein.` });
      seen.add(key);
      if (!isInt(o.points) || !inRange(o.points, 0, 100)) errors.push({ field, message: `${label}: Punkte je Option ganzzahlig 0–100.` });
    }
  } else if (c.type === 'range') {
    const ranges = r.ranges || [];
    if (ranges.length < 1 || ranges.length > 20) {
      errors.push({ field, message: `${label}: 1–20 Bereiche erforderlich.` });
    }
    for (const rg of ranges) {
      if (!isNum(rg.min) || !isNum(rg.max) || rg.min > rg.max) errors.push({ field, message: `${label}: Bereich braucht min ≤ max.` });
      if (!isInt(rg.points) || !inRange(rg.points, 0, 100)) errors.push({ field, message: `${label}: Punkte je Bereich ganzzahlig 0–100.` });
    }
    const sorted = [...ranges].sort((a, b) => a.min - b.min);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].min <= sorted[i - 1].max) {
        errors.push({ field, message: `${label}: Bereiche dürfen sich nicht überlappen.` });
        break;
      }
    }
  } else if (c.type === 'boolean') {
    if (!isInt(r.pointsYes) || !inRange(r.pointsYes, 0, 100) || !isInt(r.pointsNo) || !inRange(r.pointsNo, 0, 100)) {
      errors.push({ field, message: `${label}: Punkte für Ja und Nein ganzzahlig 0–100.` });
    }
  } else if (c.type === 'scale') {
    if (!isInt(r.min) || !isInt(r.max) || r.max - r.min < 1) {
      errors.push({ field, message: `${label}: Skala braucht ganzzahliges min/max mit Spanne ≥ 1.` });
    }
  }
}

export function validateProfile(profile) {
  const errors = [];
  const warnings = [];

  if (!strOk(profile.name, 1, 120)) errors.push({ field: 'name', message: 'Profilname ist Pflicht (max. 120 Zeichen).' });
  if (profile.description && profile.description.length > 2000) errors.push({ field: 'description', message: 'Beschreibung zu lang (max. 2000 Zeichen).' });
  if (!MISSING_POLICIES.includes(profile.missingValuePolicy)) errors.push({ field: 'missingValuePolicy', message: 'Ungültige Einstellung für fehlende Werte.' });

  const criteria = profile.criteria || [];
  if (criteria.length < 1 || criteria.length > 50) {
    errors.push({ field: 'criteria', message: 'Ein Profil braucht 1–50 Kriterien.' });
  }
  criteria.forEach((c, i) => validateCriterion(c, i, errors));

  const tiers = profile.tiers || [];
  if (tiers.length < 2 || tiers.length > 10) {
    errors.push({ field: 'tiers', message: 'Ein Profil braucht 2–10 Stufen.' });
  } else {
    for (const t of tiers) {
      if (!strOk(t.label, 1, 40)) errors.push({ field: 'tiers', message: 'Jede Stufe braucht eine Bezeichnung (max. 40 Zeichen).' });
      if (!inRange(t.minScore, 0, 100)) errors.push({ field: 'tiers', message: 'Stufen-Schwellenwerte müssen zwischen 0 und 100 liegen.' });
    }
    const scores = tiers.map((t) => t.minScore);
    if (new Set(scores).size !== scores.length) errors.push({ field: 'tiers', message: 'Stufen-Schwellenwerte müssen paarweise verschieden sein.' });
    if (!scores.includes(0)) errors.push({ field: 'tiers', message: 'Eine Auffangstufe mit Schwellenwert 0 ist Pflicht.' });
  }

  if (criteria.length > 0) {
    const sum = weightSum(profile);
    if (Math.abs(sum - 100) > 0.001 && sum > 0) {
      warnings.push({ field: 'weights', message: `Gewichtssumme ist ${sum} statt 100 — die Bewertung normiert automatisch, Sie können auch „Auf 100 normieren" nutzen.` });
    }
    if (sum <= 0) errors.push({ field: 'weights', message: 'Mindestens ein Kriterium braucht ein Gewicht größer 0.' });
  }

  return { errors, warnings };
}
