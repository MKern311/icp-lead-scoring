// Entry: Hash-Routing, View-Wiring, gemeinsame UI-Helfer, SW-Registrierung.

import * as store from './store.js';
import * as profileList from './ui/profile-list.js';
import * as profileEditor from './ui/profile-editor.js';
import * as leadList from './ui/lead-list.js';
import * as leadForm from './ui/lead-form.js';
import * as importWizard from './ui/import-wizard.js';
import * as screening from './ui/screening.js';

// --- Gemeinsame Helfer (von allen Views importiert) ---

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Zahl mit Dezimal-Komma (deutsche Anzeige), 1 Nachkommastelle.
export function fmtScore(value) {
  return value === null || value === undefined ? '–' : value.toFixed(1).replace('.', ',');
}

export function fmtValue(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return String(value).replace('.', ',');
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  return String(value);
}

export function toast(message) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function confirmDialog(message, okLabel = 'Fortfahren') {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-message').textContent = message;
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    okBtn.textContent = okLabel;
    const done = (result) => {
      dialog.close();
      okBtn.onclick = cancelBtn.onclick = dialog.oncancel = null;
      resolve(result);
    };
    okBtn.onclick = () => done(true);
    cancelBtn.onclick = () => done(false);
    dialog.oncancel = (e) => { e.preventDefault(); done(false); };
    dialog.showModal();
  });
}

export function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(name) {
  return String(name).toLowerCase()
    .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'profil';
}

export function navigate(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}

export function refreshActiveProfileIndicator() {
  const el = document.getElementById('active-profile-indicator');
  const active = store.getActiveProfile();
  el.textContent = active ? `Aktives Profil: ${active.name}` : 'Kein aktives Profil';
}

// --- Routing ---

const routes = [
  { pattern: /^#\/profile$/, section: 'view-profile-list', mod: () => profileList, nav: 'profile' },
  { pattern: /^#\/profil\/([\w-]+)$/, section: 'view-profile-editor', mod: () => profileEditor, nav: 'profile' },
  { pattern: /^#\/leads$/, section: 'view-lead-list', mod: () => leadList, nav: 'leads' },
  { pattern: /^#\/lead\/([\w-]+)$/, section: 'view-lead-form', mod: () => leadForm, nav: 'leads' },
  { pattern: /^#\/import$/, section: 'view-import', mod: () => importWizard, nav: 'import' },
  { pattern: /^#\/screening$/, section: 'view-screening', mod: () => screening, nav: 'screening' },
];

function router() {
  const hash = location.hash || '#/profile';
  const route = routes.find((r) => r.pattern.test(hash)) || routes[0];
  const params = hash.match(route.pattern)?.slice(1) || [];

  document.querySelectorAll('.view').forEach((s) => { s.hidden = true; });
  document.querySelectorAll('.main-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === route.nav);
  });

  const section = document.getElementById(route.section);
  section.hidden = false;
  route.mod().render(section, params);
  refreshActiveProfileIndicator();
}

window.addEventListener('hashchange', router);
router();

// --- Service Worker (offline nach erstem Laden, Constitution III) ---

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Neue Version verfügbar — Seite neu laden, um sie zu nutzen.');
        }
      });
    });
  }).catch(() => { /* Offline-Fähigkeit ist optional verfügbar, Fehler nicht kritisch */ });
}
