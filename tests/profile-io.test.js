import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, createCriterion, createTier, validateProfile } from '../docs/js/core/model.js';
import { evaluate } from '../docs/js/core/scoring.js';
import { exportProfile, importProfile } from '../docs/js/core/profile-io.js';

function sampleProfile() {
  const p = createProfile('Export-Test');
  p.description = 'Beschreibung';
  p.missingValuePolicy = 'zero';

  const sel = createCriterion('select');
  sel.name = 'Branche';
  sel.weight = 50;
  sel.rules.options = [
    { id: 'a', label: 'SaaS', points: 100 },
    { id: 'b', label: 'Handel', points: 40 },
  ];
  const bool = createCriterion('boolean');
  bool.name = 'Budget';
  bool.weight = 50;
  bool.knockout = true;
  p.criteria = [sel, bool];
  p.tiers = [createTier('Hot', 70), createTier('Cold', 0)];
  return p;
}

test('exportProfile: Format-Kennung, schemaVersion 2, keine IDs, keine Leads', () => {
  const out = exportProfile(sampleProfile(), 'test');
  assert.equal(out.format, 'icp-profile');
  assert.equal(out.schemaVersion, 2);
  assert.equal(out.profile.criteria[0].stage, 'qualification');
  assert.equal(out.profile.name, 'Export-Test');
  assert.equal('id' in out.profile, false);
  assert.equal('id' in out.profile.criteria[0], false);
  assert.equal('id' in out.profile.criteria[0].rules.options[0], false);
  assert.equal('id' in out.profile.tiers[0], false);
  assert.equal('leads' in out.profile, false);
});

test('Roundtrip: Export → Import liefert identische Bewertungsergebnisse (SC-005)', () => {
  const original = sampleProfile();
  const { profile: imported, errors } = importProfile(exportProfile(original));
  assert.deepEqual(errors, []);
  assert.notEqual(imported.id, original.id);
  assert.deepEqual(validateProfile(imported).errors, []);

  // Referenz-Lead: Werte über Struktur-Position übertragen (IDs sind neu).
  const valOrig = { [original.criteria[0].id]: original.criteria[0].rules.options[1].id, [original.criteria[1].id]: true };
  const valImp = { [imported.criteria[0].id]: imported.criteria[0].rules.options[1].id, [imported.criteria[1].id]: true };
  const rOrig = evaluate(original, { id: 'l', profileId: original.id, name: 'L', values: valOrig });
  const rImp = evaluate(imported, { id: 'l', profileId: imported.id, name: 'L', values: valImp });
  assert.equal(rImp.total, rOrig.total);
  assert.equal(rImp.status, rOrig.status);
  assert.equal(
    imported.tiers.find((t) => t.id === rImp.tierId)?.label,
    original.tiers.find((t) => t.id === rOrig.tierId)?.label,
  );
});

test('importProfile lehnt falsches Format verständlich ab', () => {
  const { profile, errors } = importProfile({ format: 'irgendwas', schemaVersion: 1, profile: {} });
  assert.equal(profile, null);
  assert.ok(errors.some((e) => e.includes('Format')));
});

test('importProfile lehnt fehlende Pflichtfelder ab', () => {
  const out = exportProfile(sampleProfile());
  delete out.profile.tiers;
  const { profile, errors } = importProfile(out);
  assert.equal(profile, null);
  assert.ok(errors.length > 0);
});

test('importProfile lehnt unbekannten Kriterientyp ab', () => {
  const out = exportProfile(sampleProfile());
  out.profile.criteria[0].type = 'magie';
  const { profile, errors } = importProfile(out);
  assert.equal(profile, null);
  assert.ok(errors.some((e) => e.includes('Typ')));
});

test('importProfile lehnt Punkte außerhalb 0–100 ab', () => {
  const out = exportProfile(sampleProfile());
  out.profile.criteria[0].rules.options[0].points = 150;
  const { profile, errors } = importProfile(out);
  assert.equal(profile, null);
  assert.ok(errors.length > 0);
});

test('Screening-Phase überlebt den Roundtrip', () => {
  const original = sampleProfile();
  original.criteria[0].stage = 'prescreening';
  const { profile: imported, errors } = importProfile(exportProfile(original));
  assert.deepEqual(errors, []);
  assert.equal(imported.criteria[0].stage, 'prescreening');
  assert.equal(imported.criteria[1].stage, 'qualification');
});

test('importProfile akzeptiert v1-Exporte ohne Phase (Default „qualification")', () => {
  const out = exportProfile(sampleProfile());
  out.schemaVersion = 1;
  for (const c of out.profile.criteria) delete c.stage;
  const { profile, errors } = importProfile(out);
  assert.deepEqual(errors, []);
  assert.ok(profile.criteria.every((c) => c.stage === 'qualification'));
});

test('importProfile lehnt ungültige Phase ab', () => {
  const out = exportProfile(sampleProfile());
  out.profile.criteria[0].stage = 'bogus';
  const { profile, errors } = importProfile(out);
  assert.equal(profile, null);
  assert.ok(errors.some((e) => e.includes('Phase')));
});

test('searchHint überlebt den Roundtrip; leere Hints werden nicht exportiert', () => {
  const original = sampleProfile();
  original.criteria[0].stage = 'prescreening';
  original.criteria[0].searchHint = 'bevorzugt DACH-Mittelstand';
  const out = exportProfile(original);
  assert.equal(out.schemaVersion, 2);
  assert.equal(out.profile.criteria[0].searchHint, 'bevorzugt DACH-Mittelstand');
  assert.equal('searchHint' in out.profile.criteria[1], false);
  const { profile: imported, errors } = importProfile(out);
  assert.deepEqual(errors, []);
  assert.equal(imported.criteria[0].searchHint, 'bevorzugt DACH-Mittelstand');
  assert.equal(imported.criteria[1].searchHint, '');
});

test('searchTargets überleben den Roundtrip als Options-Labels', () => {
  const original = sampleProfile();
  original.criteria[0].stage = 'prescreening';
  original.criteria[0].searchTargets = [original.criteria[0].rules.options[1].id]; // „Handel"
  const out = exportProfile(original);
  assert.deepEqual(out.profile.criteria[0].searchTargets, ['Handel']);
  assert.equal('searchTargets' in out.profile.criteria[1], false);
  const { profile: imported, errors } = importProfile(out);
  assert.deepEqual(errors, []);
  const handelId = imported.criteria[0].rules.options.find((o) => o.label === 'Handel').id;
  assert.deepEqual(imported.criteria[0].searchTargets, [handelId]);
});

test('importProfile: unbekanntes searchTargets-Label wird abgelehnt', () => {
  const out = exportProfile(sampleProfile());
  out.profile.criteria[0].searchTargets = ['Maschinenbau'];
  const { profile, errors } = importProfile(out);
  assert.equal(profile, null);
  assert.ok(errors.some((e) => e.includes('Suchauswahl')));
});

test('importProfile: fehlendes searchHint ⇒ leer, Nicht-String wird abgelehnt', () => {
  const out = exportProfile(sampleProfile());
  const { profile } = importProfile(out);
  assert.ok(profile.criteria.every((c) => c.searchHint === ''));
  out.profile.criteria[0].searchHint = 42;
  const rejected = importProfile(out);
  assert.equal(rejected.profile, null);
  assert.ok(rejected.errors.some((e) => e.includes('Suchhinweis')));
});

test('importProfile akzeptiert nur Objekte', () => {
  assert.equal(importProfile('kein objekt').profile, null);
  assert.equal(importProfile(null).profile, null);
});
