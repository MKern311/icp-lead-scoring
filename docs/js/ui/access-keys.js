// Zugang für die Online-Recherche: API-Schlüssel und Lizenz an einer Stelle.
// Beides wird an zwei Punkten gebraucht — beim Anlegen/Bearbeiten eines Profils
// (damit man nicht erst mitten im Screening ausgebremst wird) und in den
// Schritten 2 und 3 des Workflows. Deshalb liegen Markup und Bindung hier
// gemeinsam; wer hier etwas ändert, ändert es überall.
//
// Der Prüfpunkt selbst bleibt unberührt in `ui/workflow.js` vor `runScreening`
// (specs/012-licence/contracts/licence.md, Regel: genau zwei Wächter). Dieses
// Modul trägt nur die Eingabe — es entscheidet nie über einen Lauf.
//
// Keiner der beiden Schlüssel gehört jemals in Export, Profil-Code oder Sicherung.

import * as store from '../store.js';
import { activate, licenceState, clearLicence, maskLicenceKey } from '../licence.js';
import { esc, toast, confirmDialog } from '../app.js';

/** Was liegt vor? Rein lokal gelesen, ohne Netz. */
export function accessState() {
  const licence = licenceState();
  return {
    apiKey: Boolean(store.getApiKey()),
    licensed: licence.known,
    ready: Boolean(store.getApiKey()) && licence.known,
  };
}

function maskKey(key) {
  return key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : '…';
}

// Schlüssel-Block mit zwei Quellen (Feature 006): Ein Schlüssel aus der lokalen
// `.env` hat Vorrang und wird nur angezeigt, nicht bearbeitet. Die Eingabe im
// Browser bleibt in beiden Fällen erreichbar — bei aktiver .env eingeklappt.
function keyInputHtml() {
  const stored = store.getBrowserApiKey();
  return stored
    ? `<p>Im Browser hinterlegt: <code>${esc(maskKey(stored))}</code>
         <button class="btn btn-small" data-access="clear-key">Schlüssel löschen</button></p>`
    : `<div class="inline-fields">
         <div class="field" style="flex:3">
           <label for="api-key-input">Anthropic-API-Schlüssel</label>
           <input type="password" id="api-key-input" placeholder="sk-ant-…" autocomplete="off">
         </div>
         <button class="btn" data-access="save-key">Speichern</button>
       </div>
       <div class="hint">Der Schlüssel wird ausschließlich lokal in diesem Browser gespeichert und nur an
       api.anthropic.com gesendet — nie in Exporten. Nur auf vertrauenswürdigen Geräten hinterlegen.
       Schlüssel erhalten Sie unter platform.claude.com.</div>`;
}

export function apiKeyBlockHtml() {
  if (store.hasEnvApiKey()) {
    return `
      <div class="key-source">
        <span class="badge badge-env">aus .env</span>
        <span class="muted">Der Schlüssel aus Ihrer lokalen <code>.env</code> wird verwendet — im Browser ist nichts zu hinterlegen.</span>
      </div>
      <details class="class-details" style="margin-top: var(--space-2)">
        <summary>Stattdessen einen Schlüssel im Browser hinterlegen</summary>
        <div class="hint" style="margin-bottom: var(--space-2)">Wird nur genutzt, wenn kein
        <code>.env</code>-Schlüssel vorliegt — etwa auf einem anderen Gerät oder nach dem Deployment.</div>
        ${keyInputHtml()}
      </details>`;
  }
  return keyInputHtml();
}

// Lizenz-Block — bewusst dasselbe Muster wie der Schlüssel-Block darüber:
// Felder im Formular, kein eigener Dialog. Der Zustand wird rein lokal gelesen
// (Ablaufdatum im Merkmal), also ohne await und ohne Netz.
export function licenceBlockHtml() {
  const state = licenceState();
  if (state.active) {
    const until = state.exp
      ? new Date(state.exp * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';
    return `
      <div class="key-source">
        <span class="badge badge-env">aktiv</span>
        <span class="muted">Freigabe gilt bis ${esc(until)} und erneuert sich bei
        jeder Recherche still.${state.key ? ` Schlüssel: <code>${esc(maskLicenceKey(state.key))}</code>` : ''}</span>
      </div>
      <div class="row-actions" style="margin-top: var(--space-2)">
        <button class="btn btn-small" data-access="clear-licence">Lizenz von diesem Gerät lösen</button>
      </div>`;
  }
  if (state.key) {
    // Merkmal abgelaufen, Schlüssel liegt vor: der nächste Recherche-Start
    // erneuert still. Kein Grund, den Menschen etwas eintippen zu lassen.
    return `
      <div class="key-source">
        <span class="badge">wird erneuert</span>
        <span class="muted">Die Freigabe ist abgelaufen und wird beim nächsten
        Recherche-Start automatisch erneuert. Schlüssel: <code>${esc(maskLicenceKey(state.key))}</code></span>
      </div>
      <div class="row-actions" style="margin-top: var(--space-2)">
        <button class="btn btn-small" data-access="clear-licence">Lizenz von diesem Gerät lösen</button>
      </div>`;
  }
  return `
    <div class="inline-fields">
      <div class="field" style="flex:3">
        <label for="licence-key-input">Lizenzschlüssel</label>
        <input type="text" id="licence-key-input" placeholder="ICP-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false">
      </div>
      <button class="btn" data-access="activate-licence">Aktivieren</button>
    </div>
    <div class="hint">Die Online-Recherche braucht eine Lizenz; ein Schlüssel gilt für zwei Geräte.
    Groß- und Kleinschreibung sowie Bindestriche sind egal. Alles andere — Profile, Leads,
    Bewertung, CSV-Export und Sicherung — funktioniert ohne Lizenz und bleibt es auch.</div>`;
}

/**
 * Beide Schlüssel in einer Karte — für Ansichten, in denen der Zugang Beiwerk ist
 * (Profil-Editor). `collapseWhenReady` klappt die Karte zu, sobald beides vorliegt:
 * dann ist sie nur noch Statusanzeige und soll keinen Platz kosten.
 */
export function accessCardHtml({ collapseWhenReady = false, intro = '' } = {}) {
  const { apiKey, licensed, ready } = accessState();
  const body = `
    ${intro ? `<p class="muted">${intro}</p>` : ''}
    <h3>API-Schlüssel (Anthropic)</h3>
    ${apiKeyBlockHtml()}
    <h3>Lizenz</h3>
    ${licenceBlockHtml()}`;

  if (ready && collapseWhenReady) {
    return `
      <details class="card overview-card">
        <summary>
          <span class="overview-title">Zugang für die Online-Recherche</span>
          <span class="muted">API-Schlüssel und Lizenz hinterlegt — bereit</span>
        </summary>
        ${body}
      </details>`;
  }

  const missing = [!apiKey ? 'API-Schlüssel' : '', !licensed ? 'Lizenz' : ''].filter(Boolean);
  const notice = missing.length === 0 ? '' : `
    <div class="notice notice-warn">Für die Online-Recherche fehlt noch: ${esc(missing.join(' und '))}.
    Profil, Leads, Bewertung, Export und Sicherung funktionieren auch ohne.</div>`;

  return `
    <div class="card">
      <h2>Zugang für die Online-Recherche</h2>
      ${notice}
      ${body}
    </div>`;
}

/**
 * Hängt die Ereignisbehandlung an eine gerenderte Zugangs-Karte.
 * `onChange()` wird nach jeder Änderung gerufen — der Aufrufer zeichnet neu.
 */
export function bindAccess(root, onChange = () => {}) {
  root.querySelectorAll('[data-access]').forEach((el) => {
    el.addEventListener('click', () => handleAccessAction(el.dataset.access, root, onChange));
  });
  // Eingabetaste wie ein Klick auf den zugehörigen Knopf — beim Einrichten tippt
  // man beide Schlüssel hintereinander und greift sonst zwischendurch zur Maus.
  bindEnter(root, '#api-key-input', 'save-key', onChange);
  bindEnter(root, '#licence-key-input', 'activate-licence', onChange);
}

function bindEnter(root, selector, action, onChange) {
  root.querySelector(selector)?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleAccessAction(action, root, onChange);
  });
}

async function handleAccessAction(action, root, onChange) {
  if (action === 'save-key') {
    const key = root.querySelector('#api-key-input')?.value.trim();
    if (!key) { toast('Bitte einen API-Schlüssel eingeben.'); return; }
    store.setApiKey(key);
    toast('Schlüssel lokal gespeichert.');
    onChange();
    return;
  }
  if (action === 'clear-key') {
    if (await confirmDialog('Den lokal gespeicherten API-Schlüssel löschen?', 'Löschen')) {
      store.clearApiKey();
      toast('Schlüssel gelöscht.');
      onChange();
    }
    return;
  }
  if (action === 'activate-licence') {
    const key = root.querySelector('#licence-key-input')?.value.trim();
    if (!key) { toast('Bitte den Lizenzschlüssel eingeben.'); return; }
    const button = root.querySelector('[data-access="activate-licence"]');
    if (button) { button.disabled = true; button.textContent = 'Prüfe …'; }
    const result = await activate(key);
    if (!result.ok) {
      if (button) { button.disabled = false; button.textContent = 'Aktivieren'; }
      toast(result.message);
      return;
    }
    toast(`Lizenz aktiviert — Gerät ${result.deviceCount} von ${result.maxDevices}.`);
    onChange();
    return;
  }
  if (action === 'clear-licence') {
    if (await confirmDialog('Die Lizenz von diesem Gerät lösen? Der Geräteplatz bleibt belegt, bis er zurückgesetzt wird.', 'Lösen')) {
      clearLicence();
      toast('Lizenz von diesem Gerät gelöst.');
      onChange();
    }
  }
}
