// Profil-Export/-Import — Format fixiert in contracts/profile-export.schema.json.
// Export enthält keine IDs und keine Leads; Import vergibt stets neue IDs.

import { uuid, CRITERION_TYPES, MISSING_POLICIES, STAGES, validateProfile } from './model.js';

export function exportProfile(profile, appVersion = '2') {
  return {
    format: 'icp-profile',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    appVersion,
    profile: {
      name: profile.name,
      description: profile.description || '',
      missingValuePolicy: profile.missingValuePolicy,
      criteria: profile.criteria.map((c) => ({
        name: c.name,
        description: c.description || '',
        type: c.type,
        weight: c.weight,
        knockout: !!c.knockout,
        stage: STAGES.includes(c.stage) ? c.stage : 'qualification',
        // Suchhinweis nur schreiben, wenn gesetzt — leere Felder blähen Exporte nicht auf
        ...(typeof c.searchHint === 'string' && c.searchHint.trim() ? { searchHint: c.searchHint } : {}),
        rules: exportRules(c),
      })),
      tiers: profile.tiers.map((t) => ({ label: t.label, minScore: t.minScore })),
    },
  };
}

function exportRules(criterion) {
  const r = criterion.rules;
  switch (criterion.type) {
    case 'select':
      return { options: r.options.map((o) => ({ label: o.label, points: o.points })) };
    case 'range':
      return { ranges: r.ranges.map((g) => ({ min: g.min, max: g.max, points: g.points })) };
    case 'boolean':
      return { pointsYes: r.pointsYes, pointsNo: r.pointsNo };
    case 'scale':
      return { min: r.min, max: r.max };
    default:
      return {};
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = Number.isInteger;
const pts = (v) => isInt(v) && v >= 0 && v <= 100;

// Handgeschriebene Schema-Prüfung (keine Abhängigkeiten, Constitution IV).
export function importProfile(data) {
  const errors = [];
  if (!isObj(data)) return { profile: null, errors: ['Die Datei enthält kein gültiges Objekt.'] };
  if (data.format !== 'icp-profile') return { profile: null, errors: ['Unbekanntes Datei-Format — erwartet wird ein ICP-Profil-Export.'] };
  if (data.schemaVersion !== 1 && data.schemaVersion !== 2) return { profile: null, errors: [`Nicht unterstützte Schema-Version: ${data.schemaVersion}.`] };
  const p = data.profile;
  if (!isObj(p)) return { profile: null, errors: ['Feld „profile" fehlt oder ist ungültig.'] };

  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120) errors.push('Profilname fehlt oder ist ungültig.');
  if (!MISSING_POLICIES.includes(p.missingValuePolicy)) errors.push('Einstellung „missingValuePolicy" fehlt oder ist ungültig.');
  if (!Array.isArray(p.criteria) || p.criteria.length < 1 || p.criteria.length > 50) errors.push('1–50 Kriterien erforderlich.');
  if (!Array.isArray(p.tiers) || p.tiers.length < 2 || p.tiers.length > 10) errors.push('2–10 Stufen erforderlich.');
  if (errors.length > 0) return { profile: null, errors };

  const criteria = [];
  p.criteria.forEach((c, i) => {
    const label = `Kriterium ${i + 1}`;
    if (!isObj(c)) { errors.push(`${label}: ungültig.`); return; }
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 80) errors.push(`${label}: Name fehlt oder ist ungültig.`);
    if (!CRITERION_TYPES.includes(c.type)) { errors.push(`${label}: unbekannter Typ „${c.type}".`); return; }
    if (!isNum(c.weight) || c.weight < 0 || c.weight > 100) errors.push(`${label}: Gewichtung 0–100 erforderlich.`);
    if (typeof c.knockout !== 'boolean') errors.push(`${label}: Feld „knockout" (true/false) erforderlich.`);
    if (c.stage !== undefined && !STAGES.includes(c.stage)) errors.push(`${label}: ungültige Screening-Phase „${c.stage}".`);
    if (c.searchHint !== undefined && (typeof c.searchHint !== 'string' || c.searchHint.length > 200)) {
      errors.push(`${label}: Suchhinweis muss Text mit max. 200 Zeichen sein.`);
    }

    const r = c.rules;
    let rules = null;
    if (c.type === 'select') {
      if (!isObj(r) || !Array.isArray(r.options) || r.options.length < 2 || r.options.length > 20
        || !r.options.every((o) => isObj(o) && typeof o.label === 'string' && o.label.trim() && pts(o.points))) {
        errors.push(`${label}: Auswahlliste braucht 2–20 Optionen mit Label und Punkten 0–100.`);
      } else {
        rules = { options: r.options.map((o) => ({ id: uuid(), label: o.label, points: o.points })) };
      }
    } else if (c.type === 'range') {
      if (!isObj(r) || !Array.isArray(r.ranges) || r.ranges.length < 1 || r.ranges.length > 20
        || !r.ranges.every((g) => isObj(g) && isNum(g.min) && isNum(g.max) && g.min <= g.max && pts(g.points))) {
        errors.push(`${label}: Zahlenbereiche brauchen min ≤ max und Punkte 0–100.`);
      } else {
        rules = { ranges: r.ranges.map((g) => ({ min: g.min, max: g.max, points: g.points })) };
      }
    } else if (c.type === 'boolean') {
      if (!isObj(r) || !pts(r.pointsYes) || !pts(r.pointsNo)) {
        errors.push(`${label}: Ja/Nein braucht Punkte 0–100 für beide Fälle.`);
      } else {
        rules = { pointsYes: r.pointsYes, pointsNo: r.pointsNo };
      }
    } else if (c.type === 'scale') {
      if (!isObj(r) || !isInt(r.min) || !isInt(r.max) || r.max - r.min < 1) {
        errors.push(`${label}: Skala braucht ganzzahliges min/max mit Spanne ≥ 1.`);
      } else {
        rules = { min: r.min, max: r.max };
      }
    }
    if (rules) {
      criteria.push({
        id: uuid(),
        name: c.name,
        description: typeof c.description === 'string' ? c.description : '',
        type: c.type,
        weight: c.weight,
        knockout: c.knockout === true,
        // v1-Exporte kennen keine Phase — sichere Voreinstellung (FR-002)
        stage: STAGES.includes(c.stage) ? c.stage : 'qualification',
        searchHint: typeof c.searchHint === 'string' ? c.searchHint : '',
        rules,
      });
    }
  });

  const tiers = [];
  p.tiers.forEach((t, i) => {
    if (!isObj(t) || typeof t.label !== 'string' || !t.label.trim() || t.label.length > 40 || !isNum(t.minScore) || t.minScore < 0 || t.minScore > 100) {
      errors.push(`Stufe ${i + 1}: Label und Schwellenwert 0–100 erforderlich.`);
    } else {
      tiers.push({ id: uuid(), label: t.label, minScore: t.minScore });
    }
  });

  if (errors.length > 0) return { profile: null, errors };

  const profile = {
    id: uuid(),
    schemaVersion: 1,
    name: p.name,
    description: typeof p.description === 'string' ? p.description : '',
    missingValuePolicy: p.missingValuePolicy,
    criteria,
    tiers,
  };

  const check = validateProfile(profile);
  if (check.errors.length > 0) {
    return { profile: null, errors: check.errors.map((e) => e.message) };
  }
  return { profile, errors: [] };
}
