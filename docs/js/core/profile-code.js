// Profil als Textcode teilen (Feature 007) — pure, DOM-frei.
//
// Der Code trägt das vollständige Export-Objekt (dasselbe Format wie die
// JSON-Datei, siehe contracts/profile-export.schema.json) komprimiert und
// base64url-kodiert. Kein Server, kein Konto: Der Code ist die Daten. Genau
// deshalb funktioniert er auch auf statischem Hosting wie GitHub Pages.
//
// Format: `ICP1-<base64url(gzip(json))>` — `ICP0-` ist die unkomprimierte
// Rückfallebene für Umgebungen ohne CompressionStream.

const PREFIX_GZIP = 'ICP1-';
const PREFIX_RAW = 'ICP0-';

const hasCompression = () => typeof CompressionStream === 'function';

function bytesToBase64url(bytes) {
  let binary = '';
  const CHUNK = 0x8000;                       // in Blöcken, sonst sprengt der Spread den Stack
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64urlToBytes(text) {
  const padded = text.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function streamThrough(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Export-Objekt → Code. Wirft nur, wenn das Objekt nicht serialisierbar ist.
export async function encodeProfileCode(exportObject) {
  const json = JSON.stringify(exportObject);
  const bytes = new TextEncoder().encode(json);
  if (!hasCompression()) return PREFIX_RAW + bytesToBase64url(bytes);
  const packed = await streamThrough(bytes, new CompressionStream('gzip'));
  return PREFIX_GZIP + bytesToBase64url(packed);
}

// Code → Export-Objekt. Wirft mit deutscher Meldung, wenn der Code unbrauchbar ist.
export async function decodeProfileCode(code) {
  const text = String(code || '').trim().replace(/\s+/g, '');
  if (!text) throw new Error('Bitte einen Profil-Code einfügen.');

  let prefix = null;
  if (text.startsWith(PREFIX_GZIP)) prefix = PREFIX_GZIP;
  else if (text.startsWith(PREFIX_RAW)) prefix = PREFIX_RAW;
  if (!prefix) {
    throw new Error('Das sieht nicht nach einem Profil-Code aus — er beginnt mit „ICP1-".');
  }

  let bytes;
  try {
    bytes = base64urlToBytes(text.slice(prefix.length));
  } catch {
    throw new Error('Der Profil-Code ist unvollständig oder beschädigt.');
  }

  let json;
  try {
    if (prefix === PREFIX_GZIP) {
      if (typeof DecompressionStream !== 'function') {
        throw new Error('Dieser Browser kann den Code nicht entpacken — bitte die JSON-Datei nutzen.');
      }
      bytes = await streamThrough(bytes, new DecompressionStream('gzip'));
    }
    json = new TextDecoder().decode(bytes);
  } catch (e) {
    if (e.message.includes('entpacken')) throw e;
    throw new Error('Der Profil-Code ist unvollständig oder beschädigt.');
  }

  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Der Profil-Code enthält keine lesbaren Profildaten.');
  }
}
