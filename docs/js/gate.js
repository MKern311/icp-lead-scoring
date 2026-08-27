// Zugangshürde für die öffentlich erreichbare Seite (Feature 007).
//
// WAS DAS IST — und was nicht: Diese Prüfung läuft im Browser des Besuchers.
// Sie hält Gelegenheitsbesucher und Suchmaschinen-Zufallsfunde ab. Sie ist
// KEIN Schutz für Geheimnisse: Wer den Quelltext dieser Datei öffnet, sieht
// den Aufbau, und alle Dateien unter `docs/` sind ohnehin öffentlich abrufbar.
// Deshalb darf hinter dieser Hürde niemals etwas Vertrauliches liegen —
// insbesondere kein API-Schlüssel (Verfassung III).
//
// Das Passwort steht als SHA-256-Hash hier, damit es nicht im Klartext im
// Quelltext auftaucht. Für ein kurzes Wort ist das eine Formalie, keine
// kryptografische Absicherung.

const PASSWORD_HASH = '06757f68e16377c288b657571c4b5155ccf860f606dd71fcfa441c25d117310e';
const UNLOCK_KEY = 'icp.v1.gate';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function alreadyUnlocked() {
  try {
    return localStorage.getItem(UNLOCK_KEY) === PASSWORD_HASH;
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(UNLOCK_KEY, PASSWORD_HASH);
  } catch { /* Privater Modus — dann fragt die Seite beim nächsten Aufruf erneut. */ }
}

function askForPassword() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gate';
    overlay.innerHTML = `
      <form class="gate-box" autocomplete="off">
        <span class="eyebrow">Zugang</span>
        <h1>ICP Lead Scoring</h1>
        <p class="muted">Diese Seite ist nicht für die Allgemeinheit gedacht. Bitte das
        Zugangswort eingeben.</p>
        <div class="field">
          <label for="gate-input">Zugangswort</label>
          <input type="password" id="gate-input" autocomplete="current-password" autofocus>
        </div>
        <p class="gate-error" role="alert" hidden>Das Wort stimmt nicht.</p>
        <button type="submit" class="btn btn-primary">Weiter</button>
        <p class="hint">Die Hürde hält Zufallsbesucher ab — vertrauliche Daten gehören
        nicht auf diese Seite. Ihre Profile und Leads bleiben ohnehin nur in diesem Browser.</p>
      </form>`;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('form');
    const input = overlay.querySelector('#gate-input');
    const error = overlay.querySelector('.gate-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = (await sha256Hex(input.value.trim())) === PASSWORD_HASH;
      if (!ok) {
        error.hidden = false;
        input.select();
        return;
      }
      remember();
      overlay.remove();
      resolve();
    });
    input.addEventListener('input', () => { error.hidden = true; });
  });
}

// Lokal (node serve.mjs) entfällt die Hürde — dort arbeitet nur, wer ohnehin
// Zugriff auf das Gerät hat.
const isLocal = LOCAL_HOSTS.includes(location.hostname);
if (!isLocal && !alreadyUnlocked()) {
  await askForPassword();
}

await import('./app.js');
