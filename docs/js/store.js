// Einzige Persistenzschicht — alle localStorage-Zugriffe laufen hier durch (data-model.md).

import { uuid, migrateProfile } from './core/model.js';

const NS = 'icp.v1.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(NS + key, JSON.stringify(value));
}

function remove(key) {
  localStorage.removeItem(NS + key);
}

const now = () => new Date().toISOString();

// --- Profile ---

export function listProfiles() {
  return read('profiles', []).map(migrateProfile);
}

export function getProfile(id) {
  return listProfiles().find((p) => p.id === id) || null;
}

export function saveProfile(profile) {
  const profiles = listProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  const stamp = now();
  if (idx >= 0) {
    profile.createdAt = profiles[idx].createdAt;
    profile.updatedAt = stamp;
    profiles[idx] = profile;
    setRecalcFlag(profile.id); // FR-011: Bewertungen beruhen auf geändertem Profil
  } else {
    profile.createdAt = stamp;
    profile.updatedAt = stamp;
    profiles.push(profile);
  }
  write('profiles', profiles);
  return profile;
}

// Löscht nur das Profil — Leads bleiben erhalten (Spec-Edge-Case) und
// erscheinen als „Leads ohne Profil" in der Profil-Übersicht.
export function deleteProfile(id) {
  write('profiles', listProfiles().filter((p) => p.id !== id));
  remove(`workflow.${id}`);
  const settings = getSettings();
  if (settings.activeProfileId === id) {
    setSettings({ ...settings, activeProfileId: null });
  }
}

export function duplicateProfile(id) {
  const src = getProfile(id);
  if (!src) return null;
  const copy = structuredClone(src);
  copy.id = uuid();
  copy.name = `${src.name} (Kopie)`;
  copy.criteria.forEach((c) => {
    c.id = uuid();
    if (c.rules?.options) c.rules.options.forEach((o) => { o.id = uuid(); });
  });
  copy.tiers.forEach((t) => { t.id = uuid(); });
  delete copy.createdAt;
  delete copy.updatedAt;
  return saveProfile(copy);
}

export function uniqueProfileName(name) {
  const names = new Set(listProfiles().map((p) => p.name));
  if (!names.has(name)) return name;
  let n = 2;
  while (names.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

// --- Leads ---

export function listLeads(profileId) {
  return read(`leads.${profileId}`, []);
}

export function saveLead(lead) {
  const leads = listLeads(lead.profileId);
  const idx = leads.findIndex((l) => l.id === lead.id);
  const stamp = now();
  if (idx >= 0) {
    lead.createdAt = leads[idx].createdAt;
    lead.updatedAt = stamp;
    leads[idx] = lead;
  } else {
    lead.createdAt = stamp;
    lead.updatedAt = stamp;
    leads.push(lead);
  }
  write(`leads.${lead.profileId}`, leads);
  return lead;
}

export function getLead(profileId, id) {
  return listLeads(profileId).find((l) => l.id === id) || null;
}

export function deleteLead(profileId, id) {
  write(`leads.${profileId}`, listLeads(profileId).filter((l) => l.id !== id));
}

export function deleteAllLeads(profileId) {
  remove(`leads.${profileId}`);
}

// Leads, deren Profil gelöscht wurde (Spec-Edge-Case Profil-Löschung).
export function orphanedLeadGroups() {
  const knownIds = new Set(listProfiles().map((p) => p.id));
  const groups = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(`${NS}leads.`)) continue;
    const profileId = key.slice(`${NS}leads.`.length);
    if (knownIds.has(profileId)) continue;
    const leads = read(`leads.${profileId}`, []);
    if (leads.length > 0) groups.push({ profileId, leads });
    else remove(`leads.${profileId}`);
  }
  return groups;
}

// Neuzuordnung übernimmt nur Name/Notiz und setzt Kriterienwerte zurück (data-model.md).
export function reassignLeads(fromProfileId, toProfileId) {
  const source = read(`leads.${fromProfileId}`, []);
  const target = listLeads(toProfileId);
  const stamp = now();
  for (const lead of source) {
    target.push({ ...lead, id: uuid(), profileId: toProfileId, values: {}, updatedAt: stamp });
  }
  write(`leads.${toProfileId}`, target);
  remove(`leads.${fromProfileId}`);
  return source.length;
}

// --- Einstellungen & Neuberechnungs-Hinweis (FR-011) ---

export function getSettings() {
  return read('settings', { activeProfileId: null, recalc: {} });
}

export function setSettings(settings) {
  write('settings', settings);
}

export function getActiveProfile() {
  const { activeProfileId } = getSettings();
  return activeProfileId ? getProfile(activeProfileId) : null;
}

export function setActiveProfile(id) {
  setSettings({ ...getSettings(), activeProfileId: id });
}

function setRecalcFlag(profileId) {
  const s = getSettings();
  s.recalc = { ...(s.recalc || {}), [profileId]: true };
  setSettings(s);
}

// --- Suchparameter des Workflows (je Profil) ---
// Reine Bedien-Bequemlichkeit: Region, Anzahl und globale Hinweise überleben einen
// Neustart. Keine Bewertungen, keine Ergebnisse — die bleiben flüchtig (FR-010).

export function getWorkflowParams(profileId) {
  const raw = read(`workflow.${profileId}`, null);
  if (!raw || typeof raw !== 'object') return null;
  const count = Number(raw.count);
  return {
    region: typeof raw.region === 'string' && raw.region.trim() ? raw.region.slice(0, 120) : 'DACH',
    count: Number.isFinite(count) ? Math.min(50, Math.max(5, Math.round(count))) : 20,
    hints: typeof raw.hints === 'string' ? raw.hints.slice(0, 1000) : '',
  };
}

export function setWorkflowParams(profileId, { region, count, hints }) {
  write(`workflow.${profileId}`, { region, count, hints });
}

// --- API-Schlüssel (Screening) — eigener Key, niemals Teil von Exporten ---
// Zwei Quellen mit klarer Rangfolge (Feature 006): ein Schlüssel aus der lokalen
// `.env` (nur über `node serve.mjs` verfügbar) hat Vorrang; sonst gilt der im
// Browser hinterlegte. Der .env-Schlüssel wird bewusst NICHT in localStorage
// gespiegelt — er soll mit dem Server verschwinden, nicht im Browser zurückbleiben.

let envApiKey = null;

export async function loadLocalConfig() {
  try {
    const res = await fetch('./__local-config', { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    if (!res.ok) return;
    const cfg = await res.json();
    if (typeof cfg?.apiKey === 'string' && cfg.apiKey.trim()) envApiKey = cfg.apiKey.trim();
  } catch {
    // Statisches Hosting, offline oder Server ohne Endpunkt — der Browser-Schlüssel bleibt maßgeblich.
  }
}

export function hasEnvApiKey() {
  return envApiKey !== null;
}

export function getApiKey() {
  return envApiKey || localStorage.getItem(`${NS}apikey`) || null;
}

export function getBrowserApiKey() {
  return localStorage.getItem(`${NS}apikey`) || null;
}

export function setApiKey(key) {
  localStorage.setItem(`${NS}apikey`, key.trim());
}

export function clearApiKey() {
  localStorage.removeItem(`${NS}apikey`);
}

// true genau einmal nach einer Profiländerung — die UI zeigt dann den Hinweis.
export function consumeRecalcFlag(profileId) {
  const s = getSettings();
  if (s.recalc?.[profileId]) {
    delete s.recalc[profileId];
    setSettings(s);
    return true;
  }
  return false;
}
