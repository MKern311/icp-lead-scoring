import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, createCriterion, createTier } from '../docs/js/core/model.js';
import { evaluate, evaluateAll, round1 } from '../docs/js/core/scoring.js';

// Referenzprofil aus contracts/scoring-engine.md
function contractProfile(missingValuePolicy = 'neutral') {
  const p = createProfile('Referenz');
  p.missingValuePolicy = missingValuePolicy;

  const branche = createCriterion('select');
  branche.name = 'Branche';
  branche.weight = 40;
  branche.rules.options = [
    { id: 'saas', label: 'SaaS', points: 100 },
    { id: 'handel', label: 'Handel', points: 40 },
    { id: 'sonstige', label: 'Sonstige', points: 0 },
  ];

  const mitarbeiter = createCriterion('range');
  mitarbeiter.name = 'Mitarbeiter';
  mitarbeiter.weight = 30;
  mitarbeiter.rules.ranges = [
    { min: 10, max: 50, points: 100 },
    { min: 51, max: 200, points: 60 },
  ];

  const budget = createCriterion('boolean');
  budget.name = 'Budget vorhanden';
  budget.weight = 30;
  budget.knockout = true;
  budget.rules = { pointsYes: 100, pointsNo: 0 };

  p.criteria = [branche, mitarbeiter, budget];
  p.tiers = [createTier('A', 75), createTier('B', 50), createTier('C', 0)];
  return { p, branche, mitarbeiter, budget };
}

function lead(p, values) {
  return { id: 'lead-1', profileId: p.id, name: 'Test', values, source: 'manual' };
}

test('L1: Volltreffer ⇒ scored, 100.0, Stufe A', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const r = evaluate(p, lead(p, { [branche.id]: 'saas', [mitarbeiter.id]: 30, [budget.id]: true }));
  assert.equal(r.status, 'scored');
  assert.equal(r.total, 100.0);
  assert.equal(p.tiers.find((t) => t.id === r.tierId)?.label, 'A');
  assert.equal(r.complete, true);
});

test('L2: gemischte Werte ⇒ 64.0, Stufe B', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const r = evaluate(p, lead(p, { [branche.id]: 'handel', [mitarbeiter.id]: 120, [budget.id]: true }));
  assert.equal(r.total, 64.0);
  assert.equal(p.tiers.find((t) => t.id === r.tierId)?.label, 'B');
});

test('L3: K.o. verletzt ⇒ disqualified, informativer Score 70.0, keine Stufe', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const r = evaluate(p, lead(p, { [branche.id]: 'saas', [mitarbeiter.id]: 30, [budget.id]: false }));
  assert.equal(r.status, 'disqualified');
  assert.equal(r.total, 70.0);
  assert.equal(r.tierId, null);
  const b = r.breakdown.find((x) => x.criterionId === budget.id);
  assert.equal(b.knockoutViolated, true);
});

test('L4: Wert außerhalb aller Bereiche ⇒ 0 Punkte + outOfRange-Flag, 70.0 → B', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const r = evaluate(p, lead(p, { [branche.id]: 'saas', [mitarbeiter.id]: 300, [budget.id]: true }));
  assert.equal(r.status, 'scored');
  assert.equal(r.total, 70.0);
  const b = r.breakdown.find((x) => x.criterionId === mitarbeiter.id);
  assert.equal(b.outOfRange, true);
  assert.equal(b.points, 0);
  assert.equal(r.complete, true);
});

test('L5 (neutral): fehlender Wert ⇒ Renormierung, 100.0, unvollständig', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile('neutral');
  const r = evaluate(p, lead(p, { [branche.id]: 'saas', [budget.id]: true }));
  assert.equal(r.status, 'scored');
  assert.equal(r.total, 100.0);
  assert.equal(r.complete, false);
  assert.deepEqual(r.missing, [mitarbeiter.id]);
  const b = r.breakdown.find((x) => x.criterionId === mitarbeiter.id);
  assert.equal(b.included, false);
  assert.equal(b.points, null);
});

test('L5-Variante (zero): fehlender Wert ⇒ 0 Punkte bei vollem Gewicht = 70.0', () => {
  const { p, branche, budget } = contractProfile('zero');
  const r = evaluate(p, lead(p, { [branche.id]: 'saas', [budget.id]: true }));
  assert.equal(r.status, 'scored');
  assert.equal(r.total, 70.0);
  assert.equal(r.complete, false);
});

test('L6: K.o.-Kriterium ohne Wert ⇒ not-evaluable, total null', () => {
  const { p, branche, mitarbeiter } = contractProfile();
  const r = evaluate(p, lead(p, { [branche.id]: 'saas', [mitarbeiter.id]: 30 }));
  assert.equal(r.status, 'not-evaluable');
  assert.equal(r.total, null);
  assert.equal(r.tierId, null);
});

test('Stufengrenze: 74 ⇒ B, 75 ⇒ A (Vergleich mit gerundetem Wert)', () => {
  const p = createProfile('Grenze');
  const c = createCriterion('select');
  c.name = 'Einziges';
  c.weight = 100;
  c.rules.options = [
    { id: 'o74', label: '74', points: 74 },
    { id: 'o75', label: '75', points: 75 },
  ];
  p.criteria = [c];
  const r74 = evaluate(p, lead(p, { [c.id]: 'o74' }));
  const r75 = evaluate(p, lead(p, { [c.id]: 'o75' }));
  assert.equal(p.tiers.find((t) => t.id === r74.tierId)?.label, 'B');
  assert.equal(p.tiers.find((t) => t.id === r75.tierId)?.label, 'A');
});

test('Gewichtsnormierung: Gewichte 4/3/3 liefern dieselben Ergebnisse wie 40/30/30', () => {
  const a = contractProfile();
  const b = contractProfile();
  b.branche.weight = 4;
  b.mitarbeiter.weight = 3;
  b.budget.weight = 3;
  const values = (f) => ({ [f.branche.id]: 'handel', [f.mitarbeiter.id]: 120, [f.budget.id]: true });
  assert.equal(evaluate(a.p, lead(a.p, values(a))).total, evaluate(b.p, lead(b.p, values(b))).total);
});

test('Unbekannte select-Option ⇒ Wert gilt als fehlend mit invalidValue-Flag', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const r = evaluate(p, lead(p, { [branche.id]: 'gibtsnicht', [mitarbeiter.id]: 30, [budget.id]: true }));
  assert.equal(r.complete, false);
  const b = r.breakdown.find((x) => x.criterionId === branche.id);
  assert.equal(b.invalidValue, true);
  assert.equal(b.included, false);
});

test('Skala: lineare Abbildung und Rundung nur am Gesamtwert', () => {
  const p = createProfile('Skala');
  const c = createCriterion('scale');
  c.name = 'Reife';
  c.weight = 100;
  c.rules = { min: 1, max: 4 };
  p.criteria = [c];
  const r = evaluate(p, lead(p, { [c.id]: 3 }));
  assert.equal(r.total, 66.7); // (3-1)/3*100 = 66.666… → round1
});

test('round1 rundet kaufmännisch auf eine Dezimalstelle', () => {
  assert.equal(round1(66.6666), 66.7);
  assert.equal(round1(74.95), 75);
  assert.equal(round1(0), 0);
});

test('Σ contribution ergibt den ungerundeten Gesamtwert', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const r = evaluate(p, lead(p, { [branche.id]: 'handel', [mitarbeiter.id]: 120, [budget.id]: true }));
  const sum = r.breakdown.reduce((acc, b) => acc + (b.contribution || 0), 0);
  assert.equal(round1(sum), r.total);
});

test('Alle Werte fehlend (neutral) ⇒ not-evaluable', () => {
  const { p } = contractProfile();
  const r = evaluate(p, lead(p, {}));
  assert.equal(r.status, 'not-evaluable');
});

test('evaluateAll bewertet alle Leads deterministisch identisch zu evaluate', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const leads = [
    lead(p, { [branche.id]: 'saas', [mitarbeiter.id]: 30, [budget.id]: true }),
    lead(p, { [branche.id]: 'handel', [mitarbeiter.id]: 120, [budget.id]: true }),
  ];
  const all = evaluateAll(p, leads);
  assert.equal(all.length, 2);
  assert.deepEqual(all[0], evaluate(p, leads[0]));
});

test('Performance: 5000 Leads bewerten und sortieren unter 1 Sekunde', () => {
  const { p, branche, mitarbeiter, budget } = contractProfile();
  const options = ['saas', 'handel', 'sonstige'];
  const leads = Array.from({ length: 5000 }, (_, i) => ({
    id: `l${i}`,
    profileId: p.id,
    name: `Lead ${i}`,
    values: {
      [branche.id]: options[i % 3],
      [mitarbeiter.id]: (i % 250) + 1,
      [budget.id]: i % 2 === 0,
    },
    source: 'csv',
  }));
  const start = process.hrtime.bigint();
  const results = evaluateAll(p, leads);
  results
    .map((r, i) => ({ r, lead: leads[i] }))
    .sort((a, b) => (b.r.total ?? -1) - (a.r.total ?? -1));
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(results.length, 5000);
  assert.ok(ms < 1000, `Dauer ${ms.toFixed(0)} ms überschreitet 1000 ms`);
});
