// Vollsicherung: Profil **und** Leads in einer Datei (Feature 010) — pure, DOM-frei.
// Format fixiert in `specs/010-backup/contracts/backup-format.md`.
//
// Warum ein eigenes Format neben `profile-io.js`? Der Profil-Export ist zum *Teilen*
// gedacht und trägt bewusst keine IDs — der Import vergibt neue. Eine Sicherung muss
// dagegen den Stand *wiederherstellen*: Lead-Werte und Quellenangaben sind nach
// Kriterien-ID abgelegt (`lead.values[criterionId]`, `lead.sources[criterionId]`).
// Ohne diese IDs verlöre jede Sicherung genau das, wofür sie gemacht ist. Deshalb
// trägt sie die internen IDs der Kriterien, Ausprägungen und Stufen mit.
//
// Was sie nie enthält: den API-Schlüssel (er wird nicht einmal gelesen) und die
// Profil-/Lead-IDs selbst — die vergibt das Einlesen neu, damit eine Sicherung
// neben dem Original bestehen kann, statt es zu überschreiben.

import { uuid, CRITERION_TYPES, MISSING_POLICIES, STAGES, validateProfile } from './model.js';

export const BACKUP_FORMAT = 'icp-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_LEADS = 5000;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

// Profil + Leads → Sicherungsobjekt. Reine Umformung, keine Bewertung: Punktzahlen
// werden nie gespeichert, sondern immer aus Profil und Werten berechnet (Verfassung II).
export function buildBackup(profile, leads = [], { appVersion = '2', exportedAt = new Date().toISOString() } = {}) {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    appVersion,
    profile: {
      name: profile.name,
      description: str(profile.description),
      missingValuePolicy: profile.missingValuePolicy,
      criteria: profile.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: str(c.description),
        type: c.type,
        weight: c.weight,
        knockout: !!c.knockout,
        stage: STAGES.includes(c.stage) ? c.stage : 'qualification',
        searchHint: str(c.searchHint),
        hintLabel: str(c.hintLabel),
        searchTargets: Array.isArray(c.searchTargets) ? [...c.searchTargets] : [],
        rules: structuredClone(c.rules),
      })),
      tiers: profile.tiers.map((t) => ({ id: t.id, label: t.label, minScore: t.minScore })),
    },
    leads: leads.map((l) => ({
      name: l.name,
      note: str(l.note),
      source: l.source || 'manual',
      website: str(l.website),
      values: isObj(l.values) ? { ...l.values } : {},
      sources: isObj(l.sources) ? structuredClone(l.sources) : undefined,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
  };
}

// Sicherungsobjekt → { profile, leads, errors, warnings }.
// `errors` bricht ab, `warnings` beschreibt, was übernommen, aber bereinigt wurde —
// eine Sicherung soll auch dann noch retten, was zu retten ist, wenn Randdaten fehlen.
export function readBackup(data) {
  const errors = [];
  const warnings = [];

  if (!isObj(data)) return { profile: null, leads: [], errors: ['Die Datei enthält kein gültiges Objekt.'], warnings };
  if (data.format !== BACKUP_FORMAT) {
    return { profile: null, leads: [], errors: ['Unbekanntes Datei-Format — erwartet wird eine ICP-Sicherung.'], warnings };
  }
  if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return { profile: null, leads: [], errors: [`Nicht unterstützte Schema-Version: ${data.schemaVersion}.`], warnings };
  }

  const p = data.profile;
  if (!isObj(p)) return { profile: null, leads: [], errors: ['Feld „profile" fehlt oder ist ungültig.'], warnings };
  if (!Array.isArray(p.criteria) || !Array.isArray(p.tiers)) {
    return { profile: null, leads: [], errors: ['Die Sicherung enthält keine Kriterien oder Stufen.'], warnings };
  }

  const criteria = p.criteria.map((c, i) => {
    if (!isObj(c)) return null;
    if (!c.id) warnings.push(`Kriterium ${i + 1} hatte keine Kennung — Lead-Werte dazu gehen verloren.`);
    return {
      id: c.id || uuid(),
      name: str(c.name),
      description: str(c.description),
      type: CRITERION_TYPES.includes(c.type) ? c.type : 'select',
      weight: typeof c.weight === 'number' ? c.weight : 0,
      knockout: c.knockout === true,
      stage: STAGES.includes(c.stage) ? c.stage : 'qualification',
      searchHint: str(c.searchHint),
      hintLabel: str(c.hintLabel),
      searchTargets: Array.isArray(c.searchTargets) ? c.searchTargets.filter((t) => typeof t === 'string') : [],
      rules: isObj(c.rules) ? structuredClone(c.rules) : {},
    };
  }).filter(Boolean);

  const tiers = p.tiers.filter(isObj).map((t) => ({
    id: t.id || uuid(),
    label: str(t.label),
    minScore: typeof t.minScore === 'number' ? t.minScore : 0,
  }));

  const profile = {
    id: uuid(),                    // neue Kennung: die Sicherung tritt neben das Original, nicht an seine Stelle
    schemaVersion: 1,
    name: str(p.name),
    description: str(p.description),
    missingValuePolicy: MISSING_POLICIES.includes(p.missingValuePolicy) ? p.missingValuePolicy : 'neutral',
    criteria,
    tiers,
  };

  const check = validateProfile(profile);
  if (check.errors.length > 0) {
    return { profile: null, leads: [], errors: check.errors.map((e) => e.message), warnings };
  }

  const known = new Set(criteria.map((c) => c.id));
  const rawLeads = Array.isArray(data.leads) ? data.leads : [];
  if (rawLeads.length > MAX_LEADS) {
    return { profile: null, leads: [], errors: [`Die Sicherung enthält ${rawLeads.length} Leads — mehr als ${MAX_LEADS} werden nicht eingelesen.`], warnings };
  }

  let dropped = 0;
  let skipped = 0;
  const leads = [];
  for (const l of rawLeads) {
    if (!isObj(l) || !str(l.name).trim()) { skipped += 1; continue; }
    // Werte, deren Kriterium es nicht mehr gibt, bleiben draußen — sonst schleppt
    // die Wiederherstellung Karteileichen ein, die nie wieder sichtbar werden.
    const values = {};
    for (const [key, value] of Object.entries(isObj(l.values) ? l.values : {})) {
      if (known.has(key)) values[key] = value;
      else dropped += 1;
    }
    const sources = {};
    for (const [key, value] of Object.entries(isObj(l.sources) ? l.sources : {})) {
      if (known.has(key)) sources[key] = value;
    }
    leads.push({
      id: uuid(),
      profileId: profile.id,
      name: str(l.name).slice(0, 200),
      note: str(l.note),
      values,
      source: ['manual', 'csv', 'screening'].includes(l.source) ? l.source : 'manual',
      ...(str(l.website) ? { website: str(l.website) } : {}),
      ...(Object.keys(sources).length > 0 ? { sources } : {}),
      createdAt: str(l.createdAt) || undefined,
      updatedAt: str(l.updatedAt) || undefined,
    });
  }

  if (skipped > 0) warnings.push(`${skipped} Lead(s) ohne Namen übersprungen.`);
  if (dropped > 0) warnings.push(`${dropped} Wert(e) ohne passendes Kriterium verworfen.`);

  return { profile, leads, errors: [], warnings };
}
