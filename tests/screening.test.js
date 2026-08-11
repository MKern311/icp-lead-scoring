import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, createCriterion, createTier } from '../docs/js/core/model.js';
import { evaluate } from '../docs/js/core/scoring.js';
import {
  prescreeningCriteria, longlistCriteria,
  buildLonglistRequest, buildDeepScreeningRequest,
  parseCandidates, parseDeepResult, mergeDeepIntoCandidate, candidateToLead,
  qualificationQueue, estimateDeepCost,
  SCREENING_MODEL, LONGLIST_MAX_SEARCHES, DEEP_MAX_SEARCHES,
} from '../docs/js/core/screening.js';

function fixture() {
  const p = createProfile('Screening-Fixture');
  const branche = createCriterion('select');
  branche.name = 'Branche';
  branche.weight = 40;
  branche.stage = 'prescreening';
  branche.rules.options = [
    { id: 'saas', label: 'SaaS', points: 100 },
    { id: 'handel', label: 'Handel', points: 40 },
    { id: 'sonstige', label: 'Sonstige', points: 0 },
  ];
  const mitarbeiter = createCriterion('range');
  mitarbeiter.name = 'Mitarbeiter';
  mitarbeiter.weight = 30;
  mitarbeiter.stage = 'prescreening';
  mitarbeiter.rules.ranges = [
    { min: 10, max: 50, points: 100 },
    { min: 51, max: 200, points: 60 },
  ];
  const reife = createCriterion('scale');
  reife.name = 'Digitalisierungsgrad';
  reife.weight = 10;
  reife.stage = 'prescreening';
  reife.rules = { min: 1, max: 5 };
  const budget = createCriterion('boolean');
  budget.name = 'Budget vorhanden';
  budget.weight = 20;
  budget.knockout = true;
  budget.stage = 'qualification';
  p.criteria = [branche, mitarbeiter, reife, budget];
  p.tiers = [createTier('A', 75), createTier('B', 50), createTier('C', 0)];
  return { p, branche, mitarbeiter, reife, budget };
}

// --- Longlist (contracts/deep-screening.md L, SC-401) ---

test('longlistCriteria: nur Auswahl-Kriterien des Pre-Screenings', () => {
  const { p, branche } = fixture();
  assert.deepEqual(longlistCriteria(p).map((c) => c.id), [branche.id]);
});

test('prescreeningCriteria liefert alle Pre-Screening-Kriterien in Profilreihenfolge', () => {
  const { p, branche, mitarbeiter, reife } = fixture();
  assert.deepEqual(prescreeningCriteria(p).map((c) => c.id), [branche.id, mitarbeiter.id, reife.id]);
});

test('buildLonglistRequest: Modell, Tool, Structured Output gemäß Contract', () => {
  const { p } = fixture();
  const req = buildLonglistRequest(p, { region: 'DACH', count: 20 });
  assert.equal(req.model, SCREENING_MODEL);
  assert.equal(req.max_tokens, 16000);
  assert.equal(req.tools[0].type, 'web_search_20260209');
  assert.equal(req.tools[0].max_uses, LONGLIST_MAX_SEARCHES);
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.equal(req.thinking, undefined);
  assert.equal(req.temperature, undefined);
  assert.ok(req.messages[0].content.includes('DACH'));
  assert.ok(req.messages[0].content.includes('20 Unternehmen'));
});

test('SC-401: Longlist enthält keine Nicht-Auswahl-Kriterien, Gewichte, Punkte, Stufen oder Leads', () => {
  const { p } = fixture();
  const s = JSON.stringify(buildLonglistRequest(p, {}));
  assert.ok(!s.includes('Mitarbeiter'), 'range-Pre-Screening-Kriterium darf nicht in die Longlist');
  assert.ok(!s.includes('Digitalisierungsgrad'), 'scale-Pre-Screening-Kriterium darf nicht in die Longlist');
  assert.ok(!s.includes('Budget vorhanden'), 'Qualifizierungs-Kriterium darf nicht übertragen werden');
  assert.ok(!s.includes('weight'));
  assert.ok(!s.includes('points'));
  assert.ok(!s.includes('knockout'));
  assert.ok(!s.includes('minScore'));
  assert.ok(!s.includes('Screening-Fixture'));
  assert.ok(!s.includes('leads'));
});

test('Longlist-Schema: nur Auswahl-Schlüssel, enum je select, null erlaubt, keine Score-Felder', () => {
  const { p, branche } = fixture();
  const schema = buildLonglistRequest(p, {}).output_config.format.schema;
  const values = schema.properties.companies.items.properties.values;
  assert.deepEqual(values.required, ['k1']);
  const enumBranch = values.properties.k1.properties.value.anyOf.find((a) => a.enum);
  assert.deepEqual(enumBranch.enum, branche.rules.options.map((o) => o.label));
  assert.ok(values.properties.k1.properties.value.anyOf.some((a) => a.type === 'null'));
  assert.ok(!JSON.stringify(schema).includes('score'));
});

test('buildLonglistRequest: Anzahl 5–50 begrenzt; wirft ohne Auswahl-Kriterium', () => {
  const { p } = fixture();
  assert.ok(buildLonglistRequest(p, { count: 500 }).messages[0].content.includes('50 Unternehmen'));
  assert.ok(buildLonglistRequest(p, { count: 1 }).messages[0].content.includes('5 Unternehmen'));
  const noSelect = createProfile('Ohne Auswahl');
  const c = createCriterion('range');
  c.name = 'Nur Zahl';
  c.stage = 'prescreening';
  noSelect.criteria = [c];
  assert.throws(() => buildLonglistRequest(noSelect, {}), /Auswahl/);
});

test('Longlist: Suchpräferenzen werden zu harten Filtern (Erforderlich), nie für Qualifizierung', () => {
  const f = fixture();
  f.branche.searchTargets = ['saas', 'handel'];
  f.budget.searchTargets = ['x'];
  const s = JSON.stringify(buildLonglistRequest(f.p, {}));
  assert.ok(s.includes('Erforderlich: SaaS, Handel'));
  assert.ok(!s.includes('Bevorzugt:'));
  assert.ok(!s.includes('Budget vorhanden'));
});

test('Longlist: leere Suchpräferenz erzeugt keine Filterzeile in der Kriterienliste', () => {
  const f = fixture();
  f.branche.searchTargets = [];
  const content = buildLonglistRequest(f.p, {}).messages[0].content;
  assert.ok(!content.includes('Erforderlich:'));
});

function longlistOutput() {
  return {
    companies: [
      {
        name: 'Muster Software GmbH',
        website: 'https://muster.example',
        reasoning: 'Passt gut.',
        sources: ['https://muster.example/ueber-uns'],
        values: { k1: { value: 'SaaS', source: 'https://muster.example' } },
      },
    ],
  };
}

test('parseCandidates: Longlist-Werte gemappt (Schlüssel = Auswahl-Kriterien)', () => {
  const f = fixture();
  const { candidates, warnings } = parseCandidates(longlistOutput(), f.p);
  assert.equal(warnings.length, 0);
  assert.equal(candidates[0].values[f.branche.id], 'saas');
  assert.equal(candidates[0].valueSources[f.branche.id], 'https://muster.example');
});

test('parseCandidates: Label case-insensitiv; ohne Quelle verworfen; kaputte Antwort wirft nicht', () => {
  const f = fixture();
  const out = longlistOutput();
  out.companies[0].values.k1.value = '  handel ';
  assert.equal(parseCandidates(out, f.p).candidates[0].values[f.branche.id], 'handel');

  const noSource = longlistOutput();
  noSource.companies[0].sources = [];
  noSource.companies[0].values.k1.source = null;
  const { candidates, warnings } = parseCandidates(noSource, f.p);
  assert.equal(candidates.length, 0);
  assert.ok(warnings.some((w) => w.includes('verworfen')));

  assert.deepEqual(parseCandidates(null, f.p).candidates, []);
  assert.deepEqual(parseCandidates({ companies: 'nope' }, f.p).candidates, []);
});

// --- Deep (contracts/deep-screening.md D/P, SC-402/403) ---

test('buildDeepScreeningRequest: ein Unternehmen, alle Pre-Screening-Kriterien, Meta-Schema', () => {
  const { p } = fixture();
  const req = buildDeepScreeningRequest(p, { name: 'Muster Software GmbH', website: 'https://muster.example' }, { region: 'DACH' });
  const s = JSON.stringify(req);
  assert.ok(s.includes('Muster Software GmbH'));
  assert.ok(s.includes('https://muster.example'));
  assert.ok(s.includes('Branche') && s.includes('Mitarbeiter') && s.includes('Digitalisierungsgrad'));
  assert.equal(req.tools[0].max_uses, DEEP_MAX_SEARCHES);
  assert.equal(req.max_tokens, 8000);
  const k1 = req.output_config.format.schema.properties.values.properties.k1;
  assert.deepEqual(k1.required, ['value', 'source', 'confidence', 'evidenceDate']);
  const confEnum = k1.properties.confidence.anyOf.find((a) => a.enum);
  assert.deepEqual(confEnum.enum, ['direct', 'inferred']);
  assert.ok(req.output_config.format.schema.required.includes('found'));
});

test('SC-402: Deep serialisiert nur Name/Website — keine fremden Kandidaten-Felder, Gewichte, Punkte, Quali-Kriterien', () => {
  const { p } = fixture();
  const candidate = {
    name: 'Muster Software GmbH',
    website: 'https://muster.example',
    reasoning: 'GEHEIME-LONGLIST-BEGRUENDUNG',
    values: { irgendwas: 'GEHEIMER-WERT' },
    otherCandidates: ['GEHEIME-ANDERE-FIRMA'],
  };
  const s = JSON.stringify(buildDeepScreeningRequest(p, candidate, { region: 'DACH' }));
  assert.ok(!s.includes('GEHEIME-LONGLIST-BEGRUENDUNG'));
  assert.ok(!s.includes('GEHEIMER-WERT'));
  assert.ok(!s.includes('GEHEIME-ANDERE-FIRMA'));
  assert.ok(!s.includes('Budget vorhanden'));
  assert.ok(!s.includes('weight'));
  assert.ok(!s.includes('points'));
  assert.ok(!s.includes('minScore'));
  assert.ok(!s.includes('Screening-Fixture'));
});

test('buildDeepScreeningRequest: Suchhinweise dabei, Suchpräferenzen nicht; wirft ohne Namen', () => {
  const f = fixture();
  f.mitarbeiter.searchHint = 'bevorzugt 50–250 Mitarbeiter';
  f.branche.searchTargets = ['saas'];
  const s = JSON.stringify(buildDeepScreeningRequest(f.p, { name: 'Muster GmbH' }));
  assert.ok(s.includes('Suchhinweis: bevorzugt 50–250 Mitarbeiter'));
  assert.ok(!s.includes('Erforderlich:'));
  assert.throws(() => buildDeepScreeningRequest(f.p, { name: '  ' }), /Firmenname/);
});

test('buildDeepScreeningRequest: hintLabel beschriftet den Freitext-Hinweis (Stellenanzeigen-Rollen)', () => {
  const f = fixture();
  f.reife.hintLabel = 'Gesuchte Rollen / Stellentitel';
  f.reife.searchHint = 'Vertriebsleiter, SAP-Berater';
  const s = JSON.stringify(buildDeepScreeningRequest(f.p, { name: 'Muster GmbH' }));
  assert.ok(s.includes('Gesuchte Rollen / Stellentitel: Vertriebsleiter, SAP-Berater'));
  assert.ok(!s.includes('Suchhinweis: Vertriebsleiter'));
});

function deepOutput() {
  return {
    found: true,
    website: 'https://muster.example',
    summary: 'Solider SaaS-Anbieter.',
    sources: ['https://muster.example/ueber-uns'],
    values: {
      k1: { value: 'SaaS', source: 'https://muster.example', confidence: 'direct', evidenceDate: '2026-05' },
      k2: { value: 42, source: 'https://register.example/muster', confidence: 'inferred', evidenceDate: null },
      k3: { value: 3.4, source: 'https://muster.example/karriere', confidence: null, evidenceDate: null },
    },
  };
}

test('parseDeepResult: Werte, Konfidenz und Belegdatum typgerecht übernommen', () => {
  const f = fixture();
  const { candidate, warnings } = parseDeepResult(deepOutput(), f.p, { name: 'Muster Software GmbH' });
  assert.equal(warnings.length, 0);
  assert.equal(candidate.values[f.branche.id], 'saas');
  assert.equal(candidate.values[f.mitarbeiter.id], 42);
  assert.equal(candidate.values[f.reife.id], 3);
  assert.equal(candidate.confidence[f.branche.id], 'direct');
  assert.equal(candidate.confidence[f.mitarbeiter.id], 'inferred');
  assert.equal(f.reife.id in candidate.confidence, false);
  assert.equal(candidate.evidenceDates[f.branche.id], '2026-05');
  assert.equal(f.mitarbeiter.id in candidate.evidenceDates, false);
});

test('SC-403: Deep-Wert ohne Quelle wird verworfen (Warnung)', () => {
  const f = fixture();
  const out = deepOutput();
  out.values.k2.source = null;
  const { candidate, warnings } = parseDeepResult(out, f.p, { name: 'Muster' });
  assert.equal(f.mitarbeiter.id in candidate.values, false);
  assert.ok(warnings.some((w) => w.includes('ohne Quelle')));
});

test('parseDeepResult: ungültige Konfidenz weggelassen, ungültiges Belegdatum weggelassen + Warnung', () => {
  const f = fixture();
  const out = deepOutput();
  out.values.k1.confidence = 'vielleicht';
  out.values.k1.evidenceDate = 'Mai 2026';
  out.values.k2.evidenceDate = '2026-13';
  const { candidate, warnings } = parseDeepResult(out, f.p, { name: 'Muster' });
  assert.equal(candidate.values[f.branche.id], 'saas');
  assert.equal(f.branche.id in candidate.confidence, false);
  assert.equal(f.branche.id in candidate.evidenceDates, false);
  assert.equal(warnings.filter((w) => w.includes('Belegdatum')).length, 2);
});

test('parseDeepResult: found=false oder kaputte Antwort ⇒ null + Warnung; keine Quellen ⇒ null', () => {
  const f = fixture();
  const notFound = { ...deepOutput(), found: false };
  assert.equal(parseDeepResult(notFound, f.p, { name: 'X' }).candidate, null);
  assert.equal(parseDeepResult(null, f.p, { name: 'X' }).candidate, null);
  const noSources = deepOutput();
  noSources.sources = [];
  noSources.values.k1.source = null;
  noSources.values.k2.source = '';
  noSources.values.k3.source = null;
  const { candidate, warnings } = parseDeepResult(noSources, f.p, { name: 'X' });
  assert.equal(candidate, null);
  assert.ok(warnings.some((w) => w.includes('verworfen')));
});

test('mergeDeepIntoCandidate: Deep gewinnt, Longlist bleibt Fallback, Quellen-Union, Konfidenz nur aus Deep', () => {
  const f = fixture();
  const longlist = parseCandidates(longlistOutput(), f.p).candidates[0];
  const out = deepOutput();
  out.values.k1.value = 'Handel'; // Deep widerspricht Longlist
  const deep = parseDeepResult(out, f.p, { name: 'Muster Software GmbH' }).candidate;
  const merged = mergeDeepIntoCandidate(longlist, deep);
  assert.equal(merged.values[f.branche.id], 'handel');
  assert.equal(merged.values[f.mitarbeiter.id], 42);
  assert.equal(merged.confidence[f.mitarbeiter.id], 'inferred');
  assert.ok(merged.sources.includes('https://muster.example/ueber-uns'));
  assert.equal(new Set(merged.sources).size, merged.sources.length, 'Quellen dedupliziert');
  assert.equal(merged.name, 'Muster Software GmbH');
});

test('candidateToLead: Konfidenz/Belegdatum nur für gültige Kriterien mit Wert; Quelle „screening"', () => {
  const f = fixture();
  const deep = parseDeepResult(deepOutput(), f.p, { name: 'Muster Software GmbH' }).candidate;
  const lead = candidateToLead(deep, f.p, { region: 'DACH', date: '2026-08-11' });
  assert.equal(lead.source, 'screening');
  assert.equal(lead.confidence[f.branche.id], 'direct');
  assert.equal(lead.evidenceDates[f.branche.id], '2026-05');

  const shrunk = structuredClone(f.p);
  shrunk.criteria = shrunk.criteria.filter((c) => c.id !== f.branche.id);
  const lead2 = candidateToLead(deep, shrunk);
  assert.equal(lead2.confidence?.[f.branche.id], undefined);
});

test('SC-404: evaluate identisch mit und ohne Konfidenz-Metadaten (Verfassung II)', () => {
  const f = fixture();
  const deep = parseDeepResult(deepOutput(), f.p, { name: 'Muster Software GmbH' }).candidate;
  const withMeta = candidateToLead(deep, f.p);
  const bare = { id: 'm', profileId: f.p.id, name: withMeta.name, values: { ...withMeta.values }, source: 'manual' };
  const a = evaluate(f.p, withMeta);
  const b = evaluate(f.p, bare);
  assert.equal(a.total, b.total);
  assert.equal(a.status, b.status);
  assert.equal(a.tierId, b.tierId);
});

test('estimateDeepCost: Spanne je Firma × Anzahl, 2 Nachkommastellen', () => {
  assert.deepEqual(estimateDeepCost(10), { min: 1.5, max: 3.5 });
  assert.deepEqual(estimateDeepCost(0), { min: 0, max: 0 });
});

// --- Warteschlange (Feature 003, unverändert) ---

test('qualificationQueue: nur Screening-Leads mit offenen Qualifizierungskriterien, Bestandsreihenfolge', () => {
  const f = fixture();
  const open = { id: 'l1', profileId: f.p.id, name: 'Offen', values: {}, source: 'screening' };
  const done = { id: 'l2', profileId: f.p.id, name: 'Fertig', values: { [f.budget.id]: false }, source: 'screening' };
  const manual = { id: 'l3', profileId: f.p.id, name: 'Manuell', values: {}, source: 'manual' };
  const open2 = { id: 'l5', profileId: f.p.id, name: 'Offen 2', values: { [f.branche.id]: 'saas' }, source: 'screening' };
  assert.deepEqual(qualificationQueue(f.p, [open, done, manual, open2]).map((l) => l.id), ['l1', 'l5']);
  assert.deepEqual(qualificationQueue(f.p, null), []);
  assert.deepEqual(qualificationQueue(null, [{ id: 'x' }]), []);
});
