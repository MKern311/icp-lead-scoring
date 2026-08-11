import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfile, createCriterion, createTier, createLead,
  validateProfile, weightSum, normalizeWeights, migrateProfile,
} from '../docs/js/core/model.js';

function validProfile() {
  const p = createProfile('Test-ICP');
  const c1 = createCriterion('select');
  c1.name = 'Branche';
  c1.weight = 50;
  const c2 = createCriterion('boolean');
  c2.name = 'Budget';
  c2.weight = 50;
  p.criteria = [c1, c2];
  return p;
}

test('createProfile liefert Defaults gemäß data-model', () => {
  const p = createProfile('Neu');
  assert.equal(p.name, 'Neu');
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.missingValuePolicy, 'neutral');
  assert.ok(p.id.length > 8);
  assert.equal(p.tiers.length, 3);
  assert.ok(p.tiers.some((t) => t.minScore === 0), 'Auffangstufe vorhanden');
});

test('createCriterion liefert typgerechte Default-Regeln', () => {
  assert.ok(createCriterion('select').rules.options.length >= 2);
  assert.ok(createCriterion('range').rules.ranges.length >= 1);
  assert.equal(createCriterion('boolean').rules.pointsYes, 100);
  assert.equal(createCriterion('scale').rules.max - createCriterion('scale').rules.min >= 1, true);
});

test('createLead bindet profileId und startet ohne Werte', () => {
  const lead = createLead('profil-1');
  assert.equal(lead.profileId, 'profil-1');
  assert.deepEqual(lead.values, {});
  assert.equal(lead.source, 'manual');
});

test('validateProfile: gültiges Profil hat keine Fehler und keine Warnungen', () => {
  const { errors, warnings } = validateProfile(validProfile());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('validateProfile: fehlender Name ist Fehler', () => {
  const p = validProfile();
  p.name = '  ';
  const { errors } = validateProfile(p);
  assert.ok(errors.some((e) => e.field === 'name'));
});

test('validateProfile: Profil ohne Kriterien ist Fehler', () => {
  const p = validProfile();
  p.criteria = [];
  const { errors } = validateProfile(p);
  assert.ok(errors.some((e) => e.field === 'criteria'));
});

test('validateProfile: Gewichtssumme ungleich 100 ist Warnung, kein Fehler (FR-015)', () => {
  const p = validProfile();
  p.criteria[0].weight = 90;
  const { errors, warnings } = validateProfile(p);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.field === 'weights'));
});

test('validateProfile: überlappende Zahlenbereiche sind Fehler', () => {
  const p = validProfile();
  const c = createCriterion('range');
  c.name = 'Mitarbeiter';
  c.weight = 0;
  c.rules.ranges = [
    { min: 0, max: 50, points: 100 },
    { min: 50, max: 100, points: 60 },
  ];
  p.criteria.push(c);
  const { errors } = validateProfile(p);
  assert.ok(errors.some((e) => e.message.includes('überlappen')));
});

test('validateProfile: select braucht mindestens 2 Optionen mit eindeutigen Labels', () => {
  const p = validProfile();
  p.criteria[0].rules.options = [{ id: 'x', label: 'A', points: 100 }];
  assert.ok(validateProfile(p).errors.length > 0);
  p.criteria[0].rules.options = [
    { id: 'x', label: 'A', points: 100 },
    { id: 'y', label: 'a', points: 0 },
  ];
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('eindeutig')));
});

test('validateProfile: scale braucht Spanne von mindestens 1', () => {
  const p = validProfile();
  const c = createCriterion('scale');
  c.name = 'Reife';
  c.weight = 0;
  c.rules = { min: 3, max: 3 };
  p.criteria.push(c);
  assert.ok(validateProfile(p).errors.length > 0);
});

test('validateProfile: Stufen — mindestens 2, minScore paarweise verschieden, Auffangstufe 0 Pflicht', () => {
  const p = validProfile();
  p.tiers = [createTier('A', 75)];
  assert.ok(validateProfile(p).errors.some((e) => e.field === 'tiers'));

  p.tiers = [createTier('A', 75), createTier('B', 75), createTier('C', 0)];
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('verschieden')));

  p.tiers = [createTier('A', 75), createTier('B', 50)];
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('0')));
});

test('validateProfile: ungültige missingValuePolicy ist Fehler', () => {
  const p = validProfile();
  p.missingValuePolicy = 'sonstwas';
  assert.ok(validateProfile(p).errors.some((e) => e.field === 'missingValuePolicy'));
});

test('createCriterion: Screening-Phase default „qualification" (sichere Voreinstellung)', () => {
  assert.equal(createCriterion('select').stage, 'qualification');
});

test('validateProfile: ungültige Screening-Phase ist Fehler', () => {
  const p = validProfile();
  p.criteria[0].stage = 'irgendwas';
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('Phase')));
});

test('migrateProfile: ergänzt fehlende Phase mit „qualification", idempotent, erhält gesetzte Werte', () => {
  const p = validProfile();
  delete p.criteria[0].stage;
  p.criteria[1].stage = 'prescreening';
  migrateProfile(p);
  assert.equal(p.criteria[0].stage, 'qualification');
  assert.equal(p.criteria[1].stage, 'prescreening');
  migrateProfile(p);
  assert.equal(p.criteria[1].stage, 'prescreening');
});

test('createCriterion: searchHint startet leer, searchTargets startet leer', () => {
  assert.equal(createCriterion('select').searchHint, '');
  assert.deepEqual(createCriterion('select').searchTargets, []);
});

test('validateProfile: searchTargets — Options-IDs ok, fremde IDs oder Nicht-Array sind Fehler', () => {
  const p = validProfile();
  p.criteria[0].searchTargets = [p.criteria[0].rules.options[0].id];
  assert.deepEqual(validateProfile(p).errors, []);
  p.criteria[0].searchTargets = ['gibt-es-nicht'];
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('Suchauswahl')));
  p.criteria[0].searchTargets = 'keine-liste';
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('Suchauswahl')));
});

test('migrateProfile: ergänzt fehlendes searchTargets als leere Liste', () => {
  const p = validProfile();
  delete p.criteria[0].searchTargets;
  migrateProfile(p);
  assert.deepEqual(p.criteria[0].searchTargets, []);
});

test('validateProfile: searchHint — Text bis 200 Zeichen ok, zu lang oder Nicht-String ist Fehler', () => {
  const p = validProfile();
  p.criteria[0].searchHint = 'bevorzugt 50–250 Mitarbeiter';
  assert.deepEqual(validateProfile(p).errors, []);
  p.criteria[0].searchHint = 'x'.repeat(201);
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('Suchhinweis')));
  p.criteria[0].searchHint = 42;
  assert.ok(validateProfile(p).errors.some((e) => e.message.includes('Suchhinweis')));
});

test('migrateProfile: ergänzt fehlendes searchHint als leer, idempotent, erhält gesetzte Werte', () => {
  const p = validProfile();
  delete p.criteria[0].searchHint;
  p.criteria[1].searchHint = 'Hinweis';
  migrateProfile(p);
  assert.equal(p.criteria[0].searchHint, '');
  assert.equal(p.criteria[1].searchHint, 'Hinweis');
  migrateProfile(p);
  assert.equal(p.criteria[0].searchHint, '');
  assert.equal(p.criteria[1].searchHint, 'Hinweis');
});

test('weightSum summiert Gewichte', () => {
  assert.equal(weightSum(validProfile()), 100);
});

test('normalizeWeights skaliert proportional auf exakt 100', () => {
  const p = validProfile();
  p.criteria[0].weight = 30;
  p.criteria[1].weight = 30;
  const c3 = createCriterion('scale');
  c3.name = 'Reife';
  c3.weight = 15;
  p.criteria.push(c3);
  normalizeWeights(p);
  assert.equal(weightSum(p), 100);
  assert.equal(p.criteria[0].weight, p.criteria[1].weight);
  assert.ok(Math.abs(p.criteria[0].weight - 40) < 0.11);
});
