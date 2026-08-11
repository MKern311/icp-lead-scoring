import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, createTier, criterionFromCatalog, validateProfile } from '../docs/js/core/model.js';
import { criterionCatalog } from '../docs/js/templates.js';
import { prescreeningCriteria, buildScreeningRequest } from '../docs/js/core/screening.js';

function catalogProfile() {
  const p = createProfile('Katalog-Test');
  p.criteria = criterionCatalog.map((entry) => criterionFromCatalog(entry));
  p.tiers = [createTier('A', 75), createTier('B', 50), createTier('C', 0)];
  return p;
}

test('Katalog: jeder Eintrag ergibt ein valides Pre-Screening-Kriterium mit Suchhinweis', () => {
  const p = catalogProfile();
  const { errors } = validateProfile(p);
  assert.deepEqual(errors, []);
  for (const c of p.criteria) {
    assert.equal(c.stage, 'prescreening');
    assert.ok(c.searchHint.trim().length > 0, `${c.name}: Suchhinweis fehlt`);
    assert.ok(c.id.length > 8);
  }
});

test('Katalog: Namen eindeutig, Übernahme vergibt neue IDs (auch für Optionen)', () => {
  const names = criterionCatalog.map((e) => e.name.trim().toLowerCase());
  assert.equal(new Set(names).size, names.length);

  const a = criterionFromCatalog(criterionCatalog[0]);
  const b = criterionFromCatalog(criterionCatalog[0]);
  assert.notEqual(a.id, b.id);
  if (a.rules.options) {
    assert.notEqual(a.rules.options[0].id, b.rules.options[0].id);
    assert.ok(a.rules.options.every((o) => typeof o.id === 'string' && o.id.length > 8));
  }
  // Katalog-Daten bleiben unangetastet (keine ID-Mutation an der Quelle)
  assert.equal('id' in criterionCatalog[0], false);
});

test('Katalog: vollständig als Pre-Screening serialisierbar, Hints im Request', () => {
  const p = catalogProfile();
  assert.equal(prescreeningCriteria(p).length, criterionCatalog.length);
  const s = JSON.stringify(buildScreeningRequest(p, {}));
  assert.ok(s.includes('Suchhinweis:'));
  assert.ok(!s.includes('weight'));
  assert.ok(!s.includes('points'));
});
