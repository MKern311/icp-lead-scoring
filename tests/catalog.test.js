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

test('Katalog: jeder Eintrag ergibt ein valides Pre-Screening-Kriterium', () => {
  const p = catalogProfile();
  const { errors } = validateProfile(p);
  assert.deepEqual(errors, []);
  for (const c of p.criteria) {
    assert.equal(c.stage, 'prescreening');
    assert.ok(c.id.length > 8);
  }
});

test('Katalog: kategorisierbare Kriterien sind Auswahlfelder mit festen Klassen (FR-017)', () => {
  const byName = (n) => criterionCatalog.find((e) => e.name.startsWith(n));
  for (const name of ['Branche', 'Unternehmensgröße', 'Region', 'Umsatzklasse', 'Firmenalter']) {
    const entry = byName(name);
    assert.ok(entry, `Katalog-Eintrag „${name}" fehlt`);
    assert.equal(entry.type, 'select', `„${name}" muss ein Auswahlfeld sein`);
    assert.ok(entry.rules.options.length >= 2);
  }
});

test('Katalog: Wachstumssignale konkret getrennt — Presse/News und Stellenanzeigen (FR-017)', () => {
  const signals = criterionCatalog.filter((e) => e.name.startsWith('Wachstumssignal'));
  assert.equal(signals.length, 2);
  assert.ok(signals.some((e) => e.name.includes('Presse/News')));
  assert.ok(signals.some((e) => e.name.includes('Stellenanzeigen')));
  assert.ok(signals.every((e) => e.type === 'boolean'));
});

test('Katalog: selects ohne Freitext-Hint (Auswahl ersetzt Freitext), andere mit konkretem Hinweis', () => {
  for (const entry of criterionCatalog) {
    if (entry.type === 'select') {
      assert.equal(entry.searchHint, undefined, `${entry.name}: select braucht keinen Freitext-Hint`);
    } else {
      assert.ok((entry.searchHint || '').trim().length > 0, `${entry.name}: konkreter Hinweis fehlt`);
    }
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
  assert.equal('id' in criterionCatalog[0], false);
});

test('Katalog: vollständig als Pre-Screening serialisierbar, keine Punkte/Gewichte im Request', () => {
  const p = catalogProfile();
  assert.equal(prescreeningCriteria(p).length, criterionCatalog.length);
  const s = JSON.stringify(buildScreeningRequest(p, {}));
  assert.ok(!s.includes('weight'));
  assert.ok(!s.includes('points'));
});
