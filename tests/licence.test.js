import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseKey, tokenPayload, isTokenValid, deviceLabelFrom,
  activationErrorText, runVerdict, ALPHABET,
} from '../docs/js/core/licence.js';
import { buildBackup } from '../docs/js/core/backup.js';
import { exportProfile } from '../docs/js/core/profile-io.js';
import { createProfile, createCriterion, createTier, createLead } from '../docs/js/core/model.js';

// ---------------------------------------------------------------------------
// GEMEINSAME FALLVEKTOREN — wortgleich in icp-licence/tests/key.test.js.
// Contract Regel 2: `normaliseKey` existiert in beiden Repos. Läuft sie
// auseinander, wird ein vertippter Kundenschlüssel an einer Stelle angenommen
// und an der anderen abgelehnt. Änderungen deshalb IMMER hier und dort.
// ---------------------------------------------------------------------------
const KEY_VECTORS = [
  ['ICP-ABCD-EFGH-JKMN', 'ICP-ABCD-EFGH-JKMN'],   // kanonisch bleibt kanonisch
  [' icp-abcd-efgh-jkmn ', 'ICP-ABCD-EFGH-JKMN'], // Kleinschreibung, Leerzeichen aussen
  ['icpabcdefghjkmn', 'ICP-ABCD-EFGH-JKMN'],      // ohne Bindestriche, mit Praefix
  ['ABCDEFGHJKMN', 'ICP-ABCD-EFGH-JKMN'],         // ohne Praefix
  ['ICP ABCD EFGH JKMN', 'ICP-ABCD-EFGH-JKMN'],   // Leerzeichen statt Bindestriche
  ['ICP-OOOO-IIII-LLLL', 'ICP-0000-1111-1111'],   // Faltung O->0, I->1, L->1
  ['icp-o1il-2345-6789', 'ICP-0111-2345-6789'],   // Faltung gemischt
  ['ICP-UUUU-2345-6789', null],                   // U ist nicht im Alphabet
  ['ICP-ABCD-EFGH-JKM', null],                    // elf Nutzzeichen
  ['ICP-ABCD-EFGH-JKMNP', null],                  // dreizehn Nutzzeichen
  ['', null],
  ['abc', null],
];

// Merkmal bauen wie der Dienst: base64url(JSON).signatur — die Signatur ist hier
// beliebig, weil der Browser sie bewusst nicht prüft.
function token({ licenceId = 'lic-1', deviceId = 'dev-1', exp = 2_000_000_000 } = {}, sig = 'sig') {
  const payload = Buffer.from(JSON.stringify({ l: licenceId, d: deviceId, exp }), 'utf8').toString('base64url');
  return `${payload}.${sig}`;
}

// --- Schlüssel ------------------------------------------------------------

test('FR-1202 normaliseKey: die gemeinsamen Fallvektoren (Contract Regel 2)', () => {
  for (const [input, expected] of KEY_VECTORS) {
    assert.equal(normaliseKey(input), expected, `Eingabe: ${JSON.stringify(input)}`);
  }
});

test('normaliseKey: wirft bei keiner Eingabe, auch nicht bei Nicht-Strings', () => {
  for (const input of [null, undefined, 42, {}, [], true, NaN]) {
    assert.equal(normaliseKey(input), null, `Eingabe: ${String(input)}`);
  }
});

test('normaliseKey: ist idempotent', () => {
  for (const [input] of KEY_VECTORS) {
    const once = normaliseKey(input);
    assert.equal(normaliseKey(once), once);
  }
});

test('ALPHABET: 32 Zeichen ohne I, L, O und U — identisch zum Dienst', () => {
  assert.equal(ALPHABET, '0123456789ABCDEFGHJKMNPQRSTVWXYZ');
  assert.equal(ALPHABET.length, 32);
});

// --- Merkmal --------------------------------------------------------------

test('tokenPayload: liest die Nutzlast, ohne die Signatur zu prüfen', () => {
  const payload = tokenPayload(token({ licenceId: 'lic-9', deviceId: 'dev-9', exp: 123 }, 'voelliger-unsinn'));
  assert.deepEqual(payload, { licenceId: 'lic-9', deviceId: 'dev-9', exp: 123 });
});

test('tokenPayload: Nicht-ASCII in der Gerätekennung übersteht die Runde', () => {
  assert.equal(tokenPayload(token({ deviceId: 'Gerät-Müller-日本' })).deviceId, 'Gerät-Müller-日本');
});

test('tokenPayload: unbrauchbare Eingaben → null, wirft nie', () => {
  const cases = [
    '', 'abc', 'a.b.c', '.', '.sig', null, undefined, 42, {}, [],
    `${Buffer.from('kein json', 'utf8').toString('base64url')}.sig`,
    `${Buffer.from('null', 'utf8').toString('base64url')}.sig`,
    `${Buffer.from('{"l":"a"}', 'utf8').toString('base64url')}.sig`,
    `${Buffer.from('{"l":1,"d":"b","exp":5}', 'utf8').toString('base64url')}.sig`,
    `${Buffer.from('{"l":"a","d":"b","exp":"bald"}', 'utf8').toString('base64url')}.sig`,
  ];
  for (const input of cases) {
    assert.equal(tokenPayload(input), null, `Eingabe: ${JSON.stringify(input)}`);
  }
});

test('isTokenValid: auf der Grenze abgelaufen, eine Sekunde später gültig', () => {
  const exp = 1_800_000_000;
  assert.equal(isTokenValid(token({ exp }), exp * 1000), false, 'exp === jetzt heißt vorbei');
  assert.equal(isTokenValid(token({ exp }), exp * 1000 - 1), true);
  assert.equal(isTokenValid(null, 0), false);
  assert.equal(isTokenValid('', 0), false);
});

// --- Gerätebezeichnung ----------------------------------------------------

test('deviceLabelFrom: die gängigen Kombinationen', () => {
  const cases = [
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', 'Chrome auf macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1', 'Safari auf iOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0', 'Firefox auf Windows'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0', 'Edge auf Windows'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36', 'Chrome auf Android'],
  ];
  for (const [ua, expected] of cases) {
    assert.equal(deviceLabelFrom(ua), expected, ua.slice(0, 40));
  }
});

test('deviceLabelFrom: Unbekanntes fällt auf einen neutralen Namen zurück', () => {
  for (const ua of ['', null, undefined, 42, 'irgendwas']) {
    assert.equal(deviceLabelFrom(ua), 'Unbekanntes Gerät', `Eingabe: ${String(ua)}`);
  }
});

test('FR-1206 deviceLabelFrom: gibt nie den vollständigen User-Agent weiter', () => {
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
  const label = deviceLabelFrom(ua);
  assert.ok(label.length <= 80);
  assert.ok(!label.includes('Mozilla'), 'nur Browser und System verlassen das Gerät');
  assert.ok(!label.includes('AppleWebKit'));
  assert.ok(!label.includes('537.36'));
});

// --- Meldungen ------------------------------------------------------------

test('activationErrorText: je Statuscode ein eigener deutscher Satz', () => {
  const texts = [400, 403, 404, 409, 429, 500, 0].map((s) => activationErrorText(s, null));
  for (const t of texts) {
    assert.equal(typeof t, 'string');
    assert.ok(t.length > 10);
    assert.ok(!t.includes('undefined'));
    assert.ok(!t.includes('<'), 'nie HTML — das Escapen macht die Oberfläche');
  }
  assert.equal(new Set(texts).size, texts.length, 'die Sätze unterscheiden sich');
});

test('activationErrorText: die Meldung des Dienstes hat Vorrang (nennt die Geräte)', () => {
  const body = { error: 'device_limit', message: 'Alle 2 Geräteplätze sind belegt: Chrome auf macOS (zuletzt am 14.08.).' };
  assert.equal(activationErrorText(409, body), body.message);
});

test('activationErrorText: unbekannter Status ergibt einen allgemeinen Satz, nie undefined', () => {
  const text = activationErrorText(418, null);
  assert.ok(text.length > 10);
  assert.ok(!text.includes('undefined'));
});

// --- Die Fail-open-Regel --------------------------------------------------

test('FR-1205 runVerdict: die Tabelle aus Contract Regel 6', () => {
  const table = [
    [{ status: 200, body: { ok: true } }, 'pass'],
    [{ status: 200, body: { ok: false, reason: 'revoked' } }, 'block'],
    [{ status: 200, body: { ok: false, reason: 'unknown' } }, 'block'],
    [{ status: 200, body: { ok: false, reason: 'invalid' } }, 'block'],
    [{ status: 200, body: { ok: false, reason: 'expired' } }, 'renew'],
    [{ status: 200, body: { ok: false } }, 'block'],
    [{ status: 200, body: { ok: false, reason: 'kuenftiger-grund' } }, 'block'],
    [{ status: 500 }, 'pass'],
    [{ status: 502 }, 'pass'],
    [{ status: 503 }, 'pass'],
    [{ status: 400, body: { error: 'missing_token' } }, 'pass'],
    [{ networkError: true }, 'pass'],
    [{ timeout: true }, 'pass'],
    [{ status: 200, body: null }, 'pass'],
    [{ status: 200, body: 'kein objekt' }, 'pass'],
    [null, 'pass'],
    [undefined, 'pass'],
  ];
  for (const [outcome, expected] of table) {
    assert.equal(runVerdict(outcome), expected, JSON.stringify(outcome));
  }
});

test('FR-1205 runVerdict: nur eine eindeutige Absage hält an — sonst nichts', () => {
  // Jede denkbare Störung muss durchlassen. Wäre es umgekehrt, sperrte ein
  // Ausfall des Lizenzservers zahlende Kunden aus.
  const stoerungen = [
    { networkError: true }, { timeout: true }, { status: 0 }, { status: 404 },
    { status: 500 }, { status: 504 }, { status: 200 }, { status: 200, body: {} },
  ];
  for (const outcome of stoerungen) {
    assert.equal(runVerdict(outcome), 'pass', JSON.stringify(outcome));
  }
});

// --- Nichts davon gehört in einen Export ----------------------------------

test('FR-1206 Lizenzdaten erscheinen nie in Sicherung oder Profil-Export', () => {
  const profile = createProfile('Lizenzprobe');
  const criterion = createCriterion('select');
  criterion.name = 'Branche';
  criterion.weight = 100;
  criterion.rules.options = [{ id: 'opt-handel', label: 'Handel', points: 100 }];
  profile.criteria = [criterion];
  profile.tiers = [createTier('A', 75)];
  const lead = createLead(profile.id);
  lead.name = 'Muster GmbH';
  lead.values = { [criterion.id]: 'opt-handel' };

  const key = 'ICP-ABCD-EFGH-JKMN';
  const merkmal = token();

  for (const [name, json] of [
    ['Sicherung', JSON.stringify(buildBackup(profile, [lead]))],
    ['Profil-Export', JSON.stringify(exportProfile(profile))],
  ]) {
    assert.ok(!json.includes(key), `${name} enthält den Lizenzschlüssel`);
    assert.ok(!json.includes(merkmal), `${name} enthält das Freigabe-Merkmal`);
    assert.ok(!/licence|licencekey|deviceId/i.test(json), `${name} enthält ein Lizenzfeld`);
  }
});
