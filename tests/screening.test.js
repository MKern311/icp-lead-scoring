import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, createCriterion, createTier } from '../docs/js/core/model.js';
import { evaluate } from '../docs/js/core/scoring.js';
import {
  prescreeningCriteria, buildScreeningRequest, parseCandidates, candidateToLead,
  SCREENING_MODEL,
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

test('prescreeningCriteria liefert nur Pre-Screening-Kriterien in Profilreihenfolge', () => {
  const { p, branche, mitarbeiter, reife } = fixture();
  assert.deepEqual(prescreeningCriteria(p).map((c) => c.id), [branche.id, mitarbeiter.id, reife.id]);
});

test('buildScreeningRequest: Modell, Tool, Structured Output gemäß Contract', () => {
  const { p } = fixture();
  const req = buildScreeningRequest(p, { region: 'DACH', count: 20 });
  assert.equal(req.model, SCREENING_MODEL);
  assert.equal(req.max_tokens, 16000);
  assert.equal(req.tools.length, 1);
  assert.equal(req.tools[0].type, 'web_search_20260209');
  assert.ok(req.tools[0].max_uses > 0);
  assert.equal(req.output_config.format.type, 'json_schema');
  assert.equal(req.thinking, undefined);
  assert.equal(req.temperature, undefined);
  assert.equal(req.messages.length, 1);
  assert.ok(req.messages[0].content.includes('DACH'));
  assert.ok(req.messages[0].content.includes('20 Unternehmen'));
});

test('SC-004: Request enthält keine qualitativen Kriterien, Gewichte, Punkte, Stufen oder Leads', () => {
  const { p } = fixture();
  const s = JSON.stringify(buildScreeningRequest(p, {}));
  assert.ok(!s.includes('Budget vorhanden'), 'Qualifizierungs-Kriterium darf nicht übertragen werden');
  assert.ok(!s.includes('weight'));
  assert.ok(!s.includes('points'));
  assert.ok(!s.includes('knockout'));
  assert.ok(!s.includes('minScore'));
  assert.ok(!s.includes('Screening-Fixture'), 'Profilname wird nicht übertragen');
  assert.ok(!s.includes('leads'));
});

test('Schema: Schlüssel je Pre-Screening-Kriterium, enum für select, null erlaubt, keine Score-Felder', () => {
  const { p, branche } = fixture();
  const schema = buildScreeningRequest(p, {}).output_config.format.schema;
  const values = schema.properties.companies.items.properties.values;
  assert.deepEqual(values.required, ['k1', 'k2', 'k3']);
  const k1Value = values.properties.k1.properties.value;
  const enumBranch = k1Value.anyOf.find((a) => a.enum);
  assert.deepEqual(enumBranch.enum, branche.rules.options.map((o) => o.label));
  assert.ok(k1Value.anyOf.some((a) => a.type === 'null'));
  assert.ok(!JSON.stringify(schema).includes('score'));
});

test('buildScreeningRequest: Anzahl wird auf 5–50 begrenzt, wirft ohne Pre-Screening-Kriterien', () => {
  const { p } = fixture();
  assert.ok(buildScreeningRequest(p, { count: 500 }).messages[0].content.includes('50 Unternehmen'));
  assert.ok(buildScreeningRequest(p, { count: 1 }).messages[0].content.includes('5 Unternehmen'));
  const empty = createProfile('Leer');
  const c = createCriterion('boolean');
  c.name = 'Nur Qualifizierung';
  empty.criteria = [c];
  assert.throws(() => buildScreeningRequest(empty, {}));
});

function sampleOutput({ p, branche, mitarbeiter, reife }) {
  return {
    companies: [
      {
        name: 'Muster Software GmbH',
        website: 'https://muster.example',
        reasoning: 'Passt gut.',
        sources: ['https://muster.example/ueber-uns'],
        values: {
          k1: { value: 'saas'.toUpperCase() === 'SAAS' ? 'SaaS' : 'SaaS', source: 'https://muster.example' },
          k2: { value: 42, source: 'https://register.example/muster' },
          k3: { value: 3.4, source: null },
        },
      },
    ],
  };
}

test('parseCandidates: Werte typgerecht gemappt, Quellen je Kriterium erfasst', () => {
  const f = fixture();
  const { candidates, warnings } = parseCandidates(sampleOutput(f), f.p);
  assert.equal(warnings.length, 0);
  assert.equal(candidates.length, 1);
  const c = candidates[0];
  assert.equal(c.values[f.branche.id], 'saas');
  assert.equal(c.values[f.mitarbeiter.id], 42);
  assert.equal(c.values[f.reife.id], 3); // 3.4 gerundet
  assert.equal(c.valueSources[f.branche.id], 'https://muster.example');
  assert.equal(c.valueSources[f.reife.id], undefined);
});

test('parseCandidates: select-Label case-insensitiv; null-Werte bleiben offen', () => {
  const f = fixture();
  const out = sampleOutput(f);
  out.companies[0].values.k1.value = '  handel ';
  out.companies[0].values.k2.value = null;
  const { candidates } = parseCandidates(out, f.p);
  assert.equal(candidates[0].values[f.branche.id], 'handel');
  assert.equal(f.mitarbeiter.id in candidates[0].values, false);
});

test('parseCandidates: Kandidat ohne jede Quelle wird verworfen', () => {
  const f = fixture();
  const out = sampleOutput(f);
  out.companies[0].sources = [];
  out.companies[0].values.k1.source = null;
  out.companies[0].values.k2.source = '';
  const { candidates, warnings } = parseCandidates(out, f.p);
  assert.equal(candidates.length, 0);
  assert.ok(warnings.some((w) => w.includes('verworfen')));
});

test('parseCandidates: unbekanntes Label und Skala außerhalb ⇒ Wert offen + Warnung', () => {
  const f = fixture();
  const out = sampleOutput(f);
  out.companies[0].values.k1.value = 'Maschinenbau';
  out.companies[0].values.k3.value = 99;
  const { candidates, warnings } = parseCandidates(out, f.p);
  const c = candidates[0];
  assert.equal(f.branche.id in c.values, false);
  assert.equal(f.reife.id in c.values, false);
  assert.equal(c.unmatched.length, 1);
  assert.equal(c.unmatched[0].raw, 'Maschinenbau');
  assert.equal(warnings.length, 2);
});

test('parseCandidates: kaputte Antwort wirft nicht', () => {
  const f = fixture();
  assert.deepEqual(parseCandidates(null, f.p).candidates, []);
  assert.deepEqual(parseCandidates({ companies: 'nope' }, f.p).candidates, []);
});

test('candidateToLead: Quelle „screening", Website, Quellen-Map, Notiz', () => {
  const f = fixture();
  const { candidates } = parseCandidates(sampleOutput(f), f.p);
  const lead = candidateToLead(candidates[0], f.p, { region: 'DACH', date: '2026-08-05' });
  assert.equal(lead.source, 'screening');
  assert.equal(lead.profileId, f.p.id);
  assert.equal(lead.website, 'https://muster.example');
  assert.equal(lead.sources[f.branche.id], 'https://muster.example');
  assert.ok(lead.note.includes('Region: DACH'));
  assert.ok(lead.note.includes('https://muster.example/ueber-uns'));
});

test('candidateToLead: entfallene Kriterien werden ignoriert', () => {
  const f = fixture();
  const { candidates } = parseCandidates(sampleOutput(f), f.p);
  const shrunk = structuredClone(f.p);
  shrunk.criteria = shrunk.criteria.filter((c) => c.id !== f.mitarbeiter.id);
  const lead = candidateToLead(candidates[0], shrunk);
  assert.equal(f.mitarbeiter.id in lead.values, false);
  assert.equal(lead.values[f.branche.id], 'saas');
});

test('SC-005: Screening-Lead und manuell erfasster Lead mit gleichen Werten scoren identisch', () => {
  const f = fixture();
  const { candidates } = parseCandidates(sampleOutput(f), f.p);
  const screeningLead = candidateToLead(candidates[0], f.p);
  const manualLead = { id: 'm', profileId: f.p.id, name: 'Muster Software GmbH', values: { ...screeningLead.values }, source: 'manual' };
  const a = evaluate(f.p, screeningLead);
  const b = evaluate(f.p, manualLead);
  assert.equal(a.total, b.total);
  assert.equal(a.status, b.status);
  assert.equal(a.tierId, b.tierId);
});
