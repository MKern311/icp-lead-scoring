import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile, createTier, criterionFromCatalog, validateProfile } from '../docs/js/core/model.js';
import { criterionCatalog } from '../docs/js/templates.js';
import {
  prescreeningCriteria, longlistCriteria, buildDeepScreeningRequest, buildLonglistRequest,
} from '../docs/js/core/screening.js';

const CATEGORIES = ['Firmografie', 'Wachstum & Dynamik', 'Digitale Präsenz', 'Markt & Netzwerk'];

function catalogProfile() {
  const p = createProfile('Katalog-Test');
  p.criteria = criterionCatalog.map((entry) => criterionFromCatalog(entry));
  p.tiers = [createTier('A', 75), createTier('B', 50), createTier('C', 0)];
  return p;
}

test('Katalog: jeder Eintrag ergibt ein valides Pre-Screening-Kriterium', () => {
  const p = catalogProfile();
  assert.deepEqual(validateProfile(p).errors, []);
  for (const c of p.criteria) {
    assert.equal(c.stage, 'prescreening');
    assert.ok(c.id.length > 8);
    assert.ok(c.description.length <= 500);
  }
});

test('Katalog: jede Kategorie aus fester Menge, Belegquelle vorhanden und in description übernommen', () => {
  for (const entry of criterionCatalog) {
    assert.ok(CATEGORIES.includes(entry.category), `${entry.name}: unbekannte Kategorie „${entry.category}"`);
    assert.ok((entry.evidence || '').trim().length > 0, `${entry.name}: Belegquelle fehlt`);
    const c = criterionFromCatalog(entry);
    assert.ok(c.description.includes('Beleg:'), `${entry.name}: Belegquelle nicht in description`);
  }
  assert.ok(criterionCatalog.length >= 15, 'Katalog soll granular bleiben (≥ 15 fokussierte Einträge)');
});

test('Katalog: kategorisierbare Kriterien sind Auswahlfelder mit festen Klassen (FR-407)', () => {
  const byName = (n) => criterionCatalog.find((e) => e.name.startsWith(n));
  for (const name of ['Branche', 'Unternehmensgröße', 'Region', 'Umsatzklasse', 'Firmenalter', 'Eigentümerstruktur', 'Standorte']) {
    const entry = byName(name);
    assert.ok(entry, `Katalog-Eintrag „${name}" fehlt`);
    assert.equal(entry.type, 'select', `„${name}" muss ein Auswahlfeld sein`);
    assert.ok(entry.rules.options.length >= 2 && entry.rules.options.length <= 20);
  }
});

test('Katalog: genau 5 konkrete Wachstums-Signale, Belegzeitraum 12 Monate oder Aktualitätsbezug', () => {
  const growth = criterionCatalog.filter((e) => e.category === 'Wachstum & Dynamik');
  assert.equal(growth.length, 5, 'genau die 5 vereinbarten Signale — kein übergreifendes Sammel-Signal');
  assert.ok(growth.every((e) => e.type === 'boolean'));
  for (const e of growth) {
    assert.ok(/12\s*Monat|[Aa]ktuell/.test(e.description), `${e.name}: Belegzeitraum (12 Monate) oder Aktualität fehlt in description`);
  }
  const names = growth.map((e) => e.name);
  assert.ok(names.some((n) => n.includes('Expansion')));
  assert.ok(names.some((n) => n.includes('Stellenanzeigen')));
  assert.ok(names.some((n) => n.includes('Führungswechsel')));
  assert.ok(names.some((n) => n.includes('Übernahme')));
  assert.ok(names.some((n) => n.includes('Auszeichnung')));
  assert.ok(!names.some((n) => n.startsWith('Stellenanzeigen:')), 'keine getrennten Stellenanzeigen-Varianten — Rollen kommen als Freitext');
});

test('Katalog: selects ohne Freitext-Hint, andere mit konkretem Hinweis oder beschriftetem Freitextfeld', () => {
  for (const entry of criterionCatalog) {
    if (entry.type === 'select') {
      assert.equal(entry.searchHint, undefined, `${entry.name}: select braucht keinen Freitext-Hint`);
      assert.equal(entry.hintLabel, undefined, `${entry.name}: select braucht kein Freitextfeld`);
    } else {
      assert.ok((entry.searchHint || '').trim().length > 0 || (entry.hintLabel || '').trim().length > 0,
        `${entry.name}: konkreter Hinweis oder hintLabel fehlt`);
    }
  }
  // Stellenanzeigen: Rollen/Stellentitel als beschriftetes Freitextfeld (Nutzer-Eingabe)
  const jobs = criterionCatalog.find((e) => e.name.includes('Stellenanzeigen'));
  assert.ok(jobs, 'Stellenanzeigen-Kriterium fehlt');
  assert.equal(jobs.hintLabel, 'Gesuchte Rollen / Stellentitel');
  assert.equal(criterionFromCatalog(jobs).hintLabel, 'Gesuchte Rollen / Stellentitel');
});

test('Katalog: EU-Standards — NACE-Branchen, EU-KMU-Klassen, Region ohne Sonstige, Streichungen', () => {
  const branche = criterionCatalog.find((e) => e.name === 'Branche');
  assert.ok(branche.description.includes('NACE'), 'Branche folgt NACE');
  assert.equal(branche.rules.options.length, 19, 'NACE-Abschnitte A–S');
  const groesse = criterionCatalog.find((e) => e.name.startsWith('Unternehmensgröße'));
  assert.equal(groesse.type, 'select');
  assert.equal(groesse.rules.options.length, 4, 'EU-KMU: Kleinst / klein / mittel / groß');
  assert.ok(groesse.rules.options.some((o) => o.label.includes('Kleinstunternehmen')));
  assert.ok(groesse.description.includes('2003/361'));
  const umsatz = criterionCatalog.find((e) => e.name === 'Umsatzklasse');
  assert.equal(umsatz.rules.options.length, 4);
  assert.ok(umsatz.description.includes('2003/361'));
  const region = criterionCatalog.find((e) => e.name.startsWith('Region'));
  assert.ok(!region.rules.options.some((o) => o.label === 'Sonstige'), 'Region ohne „Sonstige"');
  const names = criterionCatalog.map((e) => e.name);
  for (const gone of ['Online-Shop', 'Website-Reife', 'Mehrsprachige', 'Messe', 'Kununu']) {
    assert.ok(!names.some((n) => n.includes(gone)), `„${gone}" soll entfernt sein`);
  }
});

test('Katalog: Namen eindeutig, Übernahme vergibt neue IDs, Quelle bleibt unmutiert', () => {
  const names = criterionCatalog.map((e) => e.name.trim().toLowerCase());
  assert.equal(new Set(names).size, names.length);

  const a = criterionFromCatalog(criterionCatalog[0]);
  const b = criterionFromCatalog(criterionCatalog[0]);
  assert.notEqual(a.id, b.id);
  if (a.rules.options) assert.notEqual(a.rules.options[0].id, b.rules.options[0].id);
  assert.equal('id' in criterionCatalog[0], false);
  assert.equal('stage' in criterionCatalog[0], false, 'stage entsteht erst bei der Übernahme');
});

test('Katalog: Deep-Request serialisiert alle Einträge, Longlist nur die Auswahlfelder — nie Punkte/Gewichte', () => {
  const p = catalogProfile();
  assert.equal(prescreeningCriteria(p).length, criterionCatalog.length);
  const deep = JSON.stringify(buildDeepScreeningRequest(p, { name: 'Muster GmbH' }));
  assert.ok(!deep.includes('weight') && !deep.includes('points'));
  const selectCount = criterionCatalog.filter((e) => e.type === 'select').length;
  assert.equal(longlistCriteria(p).length, selectCount);
  const long = buildLonglistRequest(p, {}).messages[0].content;
  const growthEntry = criterionCatalog.find((e) => e.category === 'Wachstum & Dynamik');
  assert.ok(!long.includes(growthEntry.name), 'Signale gehören nicht in die Longlist');
});
