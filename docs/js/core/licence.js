// Pure Lizenzlogik — DOM-frei, netzfrei, ohne Uhr. Nur diese Ebene wird getestet
// (Verfassung V). Alles, was Netz oder localStorage berührt, liegt in
// `js/licence.js`.
//
// Verbindlich: specs/012-licence/contracts/licence.md

// --- Schlüssel ------------------------------------------------------------
//
// ACHTUNG: `normaliseKey` gibt es ein zweites Mal im Lizenzdienst
// (icp-licence/src/core/key.js). Beide Fassungen müssen sich gleich verhalten,
// sonst wird ein vertippter Kundenschlüssel an einer Stelle angenommen und an
// der anderen abgelehnt. Die Fallvektoren stehen wortgleich in beiden Testdateien.

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford, ohne I L O U
const KEY_PREFIX = 'ICP';
const KEY_LENGTH = 12;
const FOLD = { O: '0', I: '1', L: '1' };

export function normaliseKey(input) {
  if (typeof input !== 'string') return null;

  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');

  // Präfix schlucken, BEVOR gefaltet wird — sonst würde aus ICP ein 1CP.
  if (s.length === KEY_PREFIX.length + KEY_LENGTH && s.startsWith(KEY_PREFIX)) {
    s = s.slice(KEY_PREFIX.length);
  }
  if (s.length !== KEY_LENGTH) return null;

  let body = '';
  for (const ch of s) {
    const folded = FOLD[ch] ?? ch;
    if (!ALPHABET.includes(folded)) return null;
    body += folded;
  }
  return `${KEY_PREFIX}-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

// --- Freigabe-Merkmal -----------------------------------------------------

/**
 * Liest die Nutzlast aus dem Merkmal. Prüft die Signatur BEWUSST NICHT — der
 * Browser hat das Geheimnis nicht und darf es nie haben. Für die echte Prüfung
 * ist `/v1/verify` da.
 */
export function tokenPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0]) return null;

  try {
    const b64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.l !== 'string' || typeof raw.d !== 'string') return null;
    if (typeof raw.exp !== 'number' || !Number.isFinite(raw.exp)) return null;
    return { licenceId: raw.l, deviceId: raw.d, exp: raw.exp };
  } catch {
    return null;
  }
}

/** Nur das Ablaufdatum. Auf der Grenze gilt das Merkmal als abgelaufen. */
export function isTokenValid(token, nowMs) {
  const payload = tokenPayload(token);
  return payload !== null && payload.exp * 1000 > nowMs;
}

// --- Gerätebezeichnung ----------------------------------------------------

const BROWSERS = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/CriOS\//, 'Chrome'],
  [/Chrome\/|Chromium\//, 'Chrome'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Windows NT/, 'Windows'],
  [/Linux/, 'Linux'],
];

/**
 * Macht aus einem User-Agent eine kurze, menschenlesbare Bezeichnung.
 *
 * Bewusst NUR Browser und Betriebssystem: die Bezeichnung geht an den
 * Lizenzserver, und dorthin gehört kein vollständiger User-Agent (Verfassung III
 * zählt abschließend auf, was übertragen werden darf).
 */
export function deviceLabelFrom(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent) return 'Unbekanntes Gerät';

  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1] ?? null;
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1] ?? null;

  if (browser && system) return `${browser} auf ${system}`;
  if (browser) return browser;
  if (system) return system;
  return 'Unbekanntes Gerät';
}

// --- Meldungen ------------------------------------------------------------

/**
 * Deutscher Satz zu einer fehlgeschlagenen Aktivierung. Der Dienst liefert für
 * die fachlichen Fälle bereits gute Texte (samt Gerätenamen) — die haben
 * Vorrang. Gibt nie HTML zurück; das Escapen macht die Oberfläche.
 */
export function activationErrorText(status, body) {
  const fromServer = typeof body?.message === 'string' && body.message.trim()
    ? body.message.trim()
    : null;
  if (fromServer) return fromServer;

  if (status === 400) return 'Dieser Lizenzschlüssel hat nicht die erwartete Form (ICP-XXXX-XXXX-XXXX).';
  if (status === 403) return 'Diese Lizenz ist gesperrt. Bitte wenden Sie sich an den Verkäufer.';
  if (status === 404) return 'Dieser Lizenzschlüssel ist unbekannt. Bitte prüfen Sie die Schreibweise.';
  if (status === 409) return 'Es sind bereits zwei Geräte aktiviert. Bitte wenden Sie sich an den Verkäufer, um eines zu lösen.';
  if (status === 429) return 'Zu viele Versuche. Bitte versuchen Sie es in einigen Minuten erneut.';
  if (status >= 500) return 'Der Lizenzserver antwortet gerade nicht. Bitte später erneut versuchen.';
  if (!status) return 'Der Lizenzserver ist nicht erreichbar. Bitte prüfen Sie Ihre Internetverbindung.';
  return 'Die Aktivierung ist fehlgeschlagen. Bitte später erneut versuchen.';
}

// --- Die Fail-open-Regel --------------------------------------------------

/**
 * Entscheidet aus der Antwort des Dienstes, ob eine Recherche laufen darf.
 *
 * `pass`  — laufen lassen
 * `block` — anhalten (der Dienst hat eindeutig nein gesagt)
 * `renew` — Merkmal abgelaufen, still neu aktivieren und dann laufen lassen
 *
 * ALLES andere ist `pass`. Ein nicht erreichbarer Server, eine Zeitüberschreitung
 * und ein Serverfehler halten niemanden auf — nur eine eindeutige Absage tut das
 * (Verfassung III, Contract Regel 6).
 */
export function runVerdict(outcome) {
  if (!outcome || outcome.networkError || outcome.timeout) return 'pass';
  if (outcome.status !== 200) return 'pass';

  const body = outcome.body;
  if (!body || typeof body !== 'object') return 'pass';
  if (body.ok !== false) return 'pass';

  return body.reason === 'expired' ? 'renew' : 'block';
}
