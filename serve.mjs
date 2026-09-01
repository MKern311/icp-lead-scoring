// Lokaler Entwicklungsserver — liefert `docs/` aus und reicht den Schlüssel aus `.env`
// an den Browser weiter (Feature 006). Ohne Abhängigkeiten, nur Node-Bordmittel.
//
//   node serve.mjs [--port 8080]
//
// Verfassung III: Der Schlüssel bleibt auf dem Gerät. Der Endpunkt antwortet nur auf
// Anfragen von localhost und schickt niemals Cache-Header. `docs/` selbst bleibt
// unverändert deploybar — auf GitHub Pages existiert dieser Endpunkt schlicht nicht,
// dort greift die Schlüssel-Eingabe im Browser.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('./docs', import.meta.url)));
const ENV_FILE = resolve(fileURLToPath(new URL('./.env', import.meta.url)));
const CONFIG_PATH = '/__local-config';

const portArg = process.argv.indexOf('--port');
const PORT = portArg > -1 ? Number(process.argv[portArg + 1]) : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Minimaler .env-Parser: KEY=VALUE je Zeile, `#` leitet einen Kommentar ein,
// Anführungszeichen um den Wert werden entfernt. Kein dotenv nötig.
async function readEnv() {
  let raw;
  try {
    raw = await readFile(ENV_FILE, 'utf8');
  } catch {
    return {};
  }
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) env[key] = value;
  }
  return env;
}

const isLocal = (req) => {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === CONFIG_PATH) {
    if (!isLocal(req)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    // Der Schlüssel wird bei jeder Anfrage frisch gelesen — .env ändern wirkt
    // nach einem Neuladen der Seite, ohne Server-Neustart.
    const env = await readEnv();
    const apiKey = env.ANTHROPIC_API_KEY || '';
    // LICENCE_API: nur fürs Entwickeln gegen einen lokal laufenden Lizenzdienst.
    // Ohne Eintrag gilt die Konstante in js/licence.js.
    const licenceApi = env.LICENCE_API || '';
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    }).end(JSON.stringify({ apiKey, licenceApi, source: apiKey ? '.env' : null }));
    return;
  }

  // Pfad auf docs/ begrenzen (kein Ausbruch über ../)
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (rel === '/' || rel.endsWith('/')) filePath = join(filePath, 'index.html');

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
  }
});

server.listen(PORT, '127.0.0.1', async () => {
  const env = await readEnv();
  const keyState = env.ANTHROPIC_API_KEY
    ? `API-Schlüssel aus .env geladen (…${env.ANTHROPIC_API_KEY.slice(-4)})`
    : 'Kein Schlüssel in .env — die Eingabe im Browser bleibt möglich';
  console.log(`ICP Lead Scoring läuft auf http://localhost:${PORT}`);
  console.log(keyState);
});
