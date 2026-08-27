import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeProfileCode, decodeProfileCode } from '../docs/js/core/profile-code.js';
import { exportProfile, importProfile } from '../docs/js/core/profile-io.js';
import { templates } from '../docs/js/templates.js';

const sample = () => importProfile(structuredClone(templates[0])).profile;

test('Profil-Code: Runde durch Kodieren und Dekodieren erhält das Export-Objekt', async () => {
  const original = exportProfile(sample());
  const code = await encodeProfileCode(original);
  assert.ok(code.startsWith('ICP1-'), 'komprimiertes Format erwartet');
  assert.deepEqual(await decodeProfileCode(code), original);
});

test('Profil-Code: dekodiert wieder zu einem importierbaren Profil', async () => {
  const code = await encodeProfileCode(exportProfile(sample()));
  const { profile, errors } = importProfile(await decodeProfileCode(code));
  assert.deepEqual(errors, []);
  assert.ok(profile.criteria.length > 0);
  assert.equal(profile.name, templates[0].profile.name);
});

test('Profil-Code: Kompression macht den Code deutlich kürzer als rohes JSON', async () => {
  const obj = exportProfile(sample());
  const code = await encodeProfileCode(obj);
  assert.ok(code.length < JSON.stringify(obj).length * 0.6,
    `Code (${code.length}) sollte klar unter 60 % des JSON (${JSON.stringify(obj).length}) liegen`);
});

test('Profil-Code: Leerzeichen und Zeilenumbrüche beim Einfügen werden verziehen', async () => {
  const obj = exportProfile(sample());
  const code = await encodeProfileCode(obj);
  const mangled = `  ${code.slice(0, 20)}\n${code.slice(20, 60)}  \n ${code.slice(60)} `;
  assert.deepEqual(await decodeProfileCode(mangled), obj);
});

test('Profil-Code: unbrauchbare Eingaben werfen deutsche, konkrete Meldungen', async () => {
  await assert.rejects(() => decodeProfileCode(''), /Bitte einen Profil-Code/);
  await assert.rejects(() => decodeProfileCode('   '), /Bitte einen Profil-Code/);
  await assert.rejects(() => decodeProfileCode('irgendwas'), /nicht nach einem Profil-Code/);
  await assert.rejects(() => decodeProfileCode('ICP1-!!!nicht-base64!!!'), /beschädigt/);
  await assert.rejects(() => decodeProfileCode('ICP0-' + Buffer.from('kein json').toString('base64url')),
    /keine lesbaren Profildaten/);
});

test('Profil-Code: unkomprimiertes Format bleibt lesbar (Rückfallebene)', async () => {
  const obj = exportProfile(sample());
  const raw = 'ICP0-' + Buffer.from(JSON.stringify(obj)).toString('base64url');
  assert.deepEqual(await decodeProfileCode(raw), obj);
});
