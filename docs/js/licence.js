// Lizenz: Netz und Speicher. Die pure Logik liegt in `core/licence.js` und ist
// dort getestet; hier steht nur, was ohne Browser nicht geht.
//
// Der Prüfpunkt sitzt ausschließlich vor einer Online-Recherche. Profile, Leads,
// Bewertung, CSV, Profil-Code und Sicherung laufen ohne Lizenz — auch bei
// abgelaufener oder gesperrter (Verfassung III, Contract Regel 7).
//
// Verbindlich: specs/012-licence/contracts/licence.md

import * as store from './store.js';
import {
  normaliseKey, tokenPayload, isTokenValid, deviceLabelFrom,
  activationErrorText, runVerdict,
} from './core/licence.js';

// Kurz genug, dass niemand darauf wartet — und lang genug für einen kalt
// gestarteten Render-Dienst, der gerade aufwacht.
const VERIFY_TIMEOUT_MS = 3000;
// Beim Aktivieren wartet der Mensch bewusst; hier darf es länger dauern.
const ACTIVATE_TIMEOUT_MS = 15000;

/** Anzeigeform des hinterlegten Schlüssels: ICP-ABCD-…-JKMN */
export function maskLicenceKey(key) {
  if (typeof key !== 'string' || key.length < 12) return '…';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

/**
 * Was die Oberfläche zum Zeichnen braucht — rein lokal, ohne Netz.
 *
 * `known` ist der Zustand, an dem die Schaltflächen hängen: Ein abgelaufenes
 * Merkmal bei hinterlegtem Schlüssel gilt als bekannt, denn `ensureLicence`
 * erneuert es beim Klick still. Hinge der Knopf an `active`, könnte genau dieser
 * Klick nie stattfinden — die Erneuerung liefe ins Leere.
 */
export function licenceState() {
  const token = store.getLicenceToken();
  const payload = tokenPayload(token);
  const active = isTokenValid(token, Date.now());
  const key = store.getLicenceKey();
  return { active, exp: payload?.exp ?? null, key, known: active || Boolean(key) };
}

export function clearLicence() {
  store.clearLicence();
}

/**
 * Aktiviert einen Schlüssel auf diesem Gerät.
 * → `{ ok: true, deviceCount, maxDevices }` oder `{ ok: false, message }`
 *
 * Anders als die Prüfung ist die Aktivierung NICHT fail-open: ohne Antwort des
 * Dienstes gibt es kein Merkmal.
 */
export async function activate(rawKey) {
  const key = normaliseKey(rawKey);
  if (!key) return { ok: false, message: activationErrorText(400, null) };

  let res;
  let body = null;
  try {
    res = await fetch(`${store.licenceApiBase()}/v1/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key,
        deviceId: store.getDeviceId(),
        label: deviceLabelFrom(navigator.userAgent),
      }),
      signal: AbortSignal.timeout(ACTIVATE_TIMEOUT_MS),
    });
    body = await res.json().catch(() => null);
  } catch {
    return { ok: false, message: activationErrorText(0, null) };
  }

  if (!res.ok) return { ok: false, message: activationErrorText(res.status, body) };
  if (typeof body?.token !== 'string') {
    return { ok: false, message: activationErrorText(500, null) };
  }

  store.setLicenceToken(body.token);
  store.setLicenceKey(key);
  return { ok: true, deviceCount: body.deviceCount, maxDevices: body.maxDevices };
}

/**
 * Fragt den Dienst. Gibt das Rohergebnis für `runVerdict` zurück — die
 * Entscheidung selbst trifft die pure Logik.
 */
async function askServer() {
  const token = store.getLicenceToken();
  if (!token) return { status: 200, body: { ok: false, reason: 'invalid' } };

  try {
    const res = await fetch(`${store.licenceApiBase()}/v1/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);

    // Stille Erneuerung: der Dienst schickt bei Erfolg ein frisches Merkmal.
    if (res.status === 200 && body?.ok === true && typeof body.token === 'string') {
      store.setLicenceToken(body.token);
    }
    return { status: res.status, body };
  } catch (err) {
    return err?.name === 'TimeoutError' ? { timeout: true } : { networkError: true };
  }
}

/**
 * Der Wächter vor jeder Online-Recherche.
 * → `{ ok: true }` oder `{ ok: false, reason, message }`
 *
 * `reason`: `none` (noch nie aktiviert) · `expired` (Merkmal alt, kein Schlüssel
 * hinterlegt) · `blocked` (der Dienst hat eindeutig nein gesagt).
 *
 * Netzfehler, Zeitüberschreitung und Serverfehler halten NIEMANDEN auf.
 */
export async function ensureLicence() {
  const token = store.getLicenceToken();
  const storedKey = store.getLicenceKey();

  // Kein Merkmal oder abgelaufen: mit dem hinterlegten Schlüssel still neu
  // aktivieren. Das trifft Zweig 2 der Geräteregel und verbraucht keinen Platz.
  if (!token || !isTokenValid(token, Date.now())) {
    return storedKey ? renew(storedKey) : needKey(token ? 'expired' : 'none');
  }

  const verdict = runVerdict(await askServer());
  if (verdict === 'pass') return { ok: true };
  if (verdict === 'renew') return storedKey ? renew(storedKey) : needKey('expired');

  // block: der Dienst hat eindeutig nein gesagt. Das Merkmal ist wertlos —
  // der SCHLÜSSEL aber möglicherweise nicht: Bei zurückgesetzten Geräten oder
  // gewechseltem TOKEN_SECRET antwortet der Dienst ebenfalls mit nein, und ein
  // neuer Anlauf trägt das Gerät einfach wieder ein. Scheitert auch der, trägt
  // seine Meldung den wahren Grund (etwa "Diese Lizenz ist gesperrt").
  store.clearLicenceToken();
  return storedKey ? renew(storedKey) : needKey('blocked');
}

function needKey(reason) {
  return {
    ok: false,
    reason,
    message: reason === 'none'
      ? 'Für die Online-Recherche wird ein Lizenzschlüssel gebraucht.'
      : 'Die Freigabe ist nicht mehr gültig. Bitte den Lizenzschlüssel erneut eintragen.',
  };
}

async function renew(key) {
  const result = await activate(key);
  return result.ok ? { ok: true } : { ok: false, reason: 'blocked', message: result.message };
}
