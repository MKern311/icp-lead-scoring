import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, createCriterion, createTier, createLead } from '../docs/js/core/model.js';
import { evaluate } from '../docs/js/core/scoring.js';
import { buildBackup, readBackup, BACKUP_FORMAT } from '../docs/js/core/backup.js';

function fixture() {
  const p = createProfile('Sicherungsprobe');
  const branche = createCriterion('select');
  branche.name = 'Branche';
  branche.weight = 60;
  branche.rules.options = [
    { id: 'opt-saas', label: 'SaaS', points: 100 },
    { id: 'opt-handel', label: 'Handel', points: 40 },
  ];
  branche.searchTargets = ['opt-saas'];

  const budget = createCriterion('boolean');
  budget.name = 'Budget';
  budget.weight = 40;
  budget.rules = { pointsYes: 100, pointsNo: 0 };

  p.criteria = [branche, budget];
  p.tiers = [createTier('A', 75), createTier('C', 0)];

  const lead = createLead(p.id);
  lead.name = 'Muster GmbH';
  lead.note = 'Aus dem Screening';
  lead.source = 'screening';
  lead.website = 'https://muster.example';
  lead.values = { [branche.id]: 'opt-saas', [budget.id]: true };
  lead.sources = { [branche.id]: { url: 'https://muster.example/ueber-uns', evidenceDate: '2026-05' } };

  return { p, branche, budget, lead };
}

test('buildBackup: trägt Profil und Leads, aber keine Profil-/Lead-IDs', () => {
  const { p, lead } = fixture();
  const backup = buildBackup(p, [lead], { exportedAt: '2026-08-27T10:00:00.000Z' });

  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.exportedAt, '2026-08-27T10:00:00.000Z');
  assert.equal(backup.profile.criteria.length, 2);
  assert.equal(backup.leads.length, 1);
  assert.equal(backup.profile.id, undefined, 'Profil-ID gehört nicht in die Sicherung');
  assert.equal(backup.leads[0].id, undefined, 'Lead-ID gehört nicht in die Sicherung');
  // Kriterien-IDs dagegen schon — ohne sie wären die Lead-Werte nicht zuzuordnen
  assert.ok(backup.profile.criteria.every((c) => typeof c.id === 'string' && c.id));
});

test('buildBackup: enthält nie einen API-Schlüssel', () => {
  const { p, lead } = fixture();
  const json = JSON.stringify(buildBackup(p, [lead]));
  assert.ok(!/apikey/i.test(json));
  assert.ok(!/sk-ant/i.test(json));
});

test('Rundlauf: Bewertung nach dem Einlesen identisch', () => {
  const { p, lead } = fixture();
  const vorher = evaluate(p, lead);

  const { profile, leads, errors, warnings } = readBackup(buildBackup(p, [lead]));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(leads.length, 1);

  const nachher = evaluate(profile, leads[0]);
  assert.equal(nachher.total, vorher.total);
  assert.equal(nachher.status, vorher.status);
  assert.equal(nachher.complete, vorher.complete);
});

test('Einlesen vergibt neue Profil- und Lead-IDs, behält Kriterien-IDs', () => {
  const { p, branche, lead } = fixture();
  const { profile, leads } = readBackup(buildBackup(p, [lead]));

  assert.notEqual(profile.id, p.id, 'Sicherung tritt neben das Original');
  assert.notEqual(leads[0].id, lead.id);
  assert.equal(leads[0].profileId, profile.id);
  assert.equal(profile.criteria[0].id, branche.id, 'Kriterien-ID trägt die Lead-Werte');
  assert.equal(leads[0].values[branche.id], 'opt-saas');
  assert.equal(leads[0].sources[branche.id].evidenceDate, '2026-05');
  assert.deepEqual(profile.criteria[0].searchTargets, ['opt-saas']);
});

test('Einlesen verwirft Werte ohne passendes Kriterium und meldet es', () => {
  const { p, lead } = fixture();
  const backup = buildBackup(p, [lead]);
  backup.leads[0].values['nicht-mehr-vorhanden'] = 'irgendwas';

  const { leads, warnings } = readBackup(backup);
  assert.equal(leads[0].values['nicht-mehr-vorhanden'], undefined);
  assert.ok(warnings.some((w) => w.includes('ohne passendes Kriterium')));
});

test('Einlesen überspringt Leads ohne Namen', () => {
  const { p, lead } = fixture();
  const backup = buildBackup(p, [lead]);
  backup.leads.push({ name: '   ', values: {} });

  const { leads, warnings } = readBackup(backup);
  assert.equal(leads.length, 1);
  assert.ok(warnings.some((w) => w.includes('ohne Namen')));
});

test('Einlesen lehnt fremde Formate und Versionen ab', () => {
  const { p } = fixture();
  assert.match(readBackup(null).errors[0], /kein gültiges Objekt/);
  assert.match(readBackup({ format: 'icp-profile', schemaVersion: 2 }).errors[0], /Unbekanntes Datei-Format/);
  assert.match(readBackup({ ...buildBackup(p, []), schemaVersion: 99 }).errors[0], /Schema-Version/);
});

test('Einlesen lehnt ein unbrauchbares Profil ab, statt es halb anzulegen', () => {
  const { p } = fixture();
  const backup = buildBackup(p, []);
  backup.profile.criteria = [];
  const { profile, errors } = readBackup(backup);
  assert.equal(profile, null);
  assert.ok(errors.length > 0);
});

test('Sicherung ohne Leads bleibt gültig', () => {
  const { p } = fixture();
  const { profile, leads, errors } = readBackup(buildBackup(p, []));
  assert.deepEqual(errors, []);
  assert.equal(leads.length, 0);
  assert.equal(profile.criteria.length, 2);
});
