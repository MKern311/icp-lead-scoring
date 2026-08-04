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

test('exportProfile: Format-Kennung, schemaVersion, keine IDs, keine Leads', () => {
  const out = exportProfile(sampleProfile(), 'test');
  assert.equal(out.format, 'icp-profile');
  assert.equal(out.schemaVersion, 1);
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

test('importProfile akzeptiert nur Objekte', () => {
  assert.equal(importProfile('kein objekt').profile, null);
  assert.equal(importProfile(null).profile, null);
});
