// Screening-Ansicht: API-Schlüssel (lokal), Lauf-Parameter, Recherche, Prüfung
// und selektive Übernahme der Kandidaten als Leads (FR-005–FR-014).

import * as store from '../store.js';
import { evaluate } from '../core/scoring.js';
import { prescreeningCriteria, buildScreeningRequest, parseCandidates, candidateToLead } from '../core/screening.js';
import { runScreening } from '../screening-api.js';
import { esc, toast, confirmDialog, navigate, fmtScore } from '../app.js';
import { tierBadge } from './lead-form.js';

let container = null;
let profile = null;
let running = false;
let result = null; // { candidates, warnings, region }

export function render(section) {
  container = section;
  profile = store.getActiveProfile();
  if (!running) result = null;
  draw();
}

function maskKey(key) {
  return key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : '…';
}

function draw() {
  if (!profile) {
    container.innerHTML = `
      <div class="empty-state">
        Kein aktives Profil. Bitte zuerst unter <a href="#/profile">Profile</a> ein Profil anlegen und aktivieren.
      </div>`;
    return;
  }

  const pre = prescreeningCriteria(profile);
  const apiKey = store.getApiKey();

  const keyBlock = apiKey
    ? `<p>Hinterlegter Schlüssel: <code>${esc(maskKey(apiKey))}</code>
         <button class="btn btn-small" data-action="clear-key">Schlüssel löschen</button></p>`
    : `<div class="inline-fields">
         <div class="field" style="flex:3">
           <label for="api-key-input">Anthropic-API-Schlüssel</label>
           <input type="password" id="api-key-input" placeholder="sk-ant-…" autocomplete="off">
         </div>
         <button class="btn" data-action="save-key">Speichern</button>
       </div>
       <div class="hint">Der Schlüssel wird ausschließlich lokal in diesem Browser gespeichert und nur an
       api.anthropic.com gesendet — nie in Exporten. Nur auf vertrauenswürdigen Geräten hinterlegen.
       Schlüssel erhalten Sie unter platform.claude.com.</div>`;

  const preList = pre.length > 0
    ? `<p>Recherchiert wird nach den <strong>${pre.length} Pre-Screening-Kriterien</strong> des Profils:
       ${pre.map((c) => `<span class="badge">${esc(c.name)}</span>`).join(' ')}</p>
       <p class="muted">Qualitative Kriterien (2. Screening) werden nicht übertragen und bleiben zur manuellen
       Qualifizierung offen.</p>`
    : `<div class="notice notice-warn">Dieses Profil hat noch keine Pre-Screening-Kriterien.
       Markieren Sie im <a href="#/profil/${profile.id}">Profil-Editor</a> die online recherchierbaren
       Kriterien (z. B. Branche, Größe) als „Pre-Screening", um das Screening zu starten.</div>`;

  container.innerHTML = `
    <div class="view-header"><h1>Online-Screening</h1></div>
    <p class="muted">Profil: <strong>${esc(profile.name)}</strong></p>

    <div class="card">
      <h2>API-Schlüssel</h2>
      ${keyBlock}
    </div>

    <div class="card">
      <h2>Recherche-Lauf</h2>
      ${preList}
      <div class="inline-fields">
        <div class="field">
          <label for="scr-region">Region / Markt</label>
          <input type="text" id="scr-region" value="DACH" maxlength="120">
        </div>
        <div class="field" style="max-width:9rem">
          <label for="scr-count">Anzahl (5–50)</label>
          <input type="number" id="scr-count" min="5" max="50" step="1" value="20">
        </div>
      </div>
      <div class="field">
        <label for="scr-hints">Zusätzliche Hinweise (optional)</label>
        <textarea id="scr-hints" maxlength="1000" placeholder="z. B. Nische, Ausschlüsse, bevorzugte Teilregionen"></textarea>
      </div>
      <div class="notice notice-warn">Der Lauf nutzt Ihren eigenen API-Schlüssel und verursacht Kosten
      (Websuche + KI-Nutzung; erfahrungsgemäß grob 0,50–1,50&nbsp;€ pro Lauf mit 20 Kandidaten).</div>
      <button class="btn btn-primary" data-action="start" ${(!apiKey || pre.length === 0 || running) ? 'disabled' : ''}>
        Screening starten
      </button>
      <span id="scr-status" class="muted" style="margin-left: var(--space-2)"></span>
    </div>

    <div id="scr-results">${result ? '' : ''}</div>
  `;

  container.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => handleAction(el.dataset.action));
  });

  if (result) drawResults();
}

function setStatus(text) {
  const el = container.querySelector('#scr-status');
  if (el) el.textContent = text;
}

async function handleAction(action) {
  if (action === 'save-key') {
    const input = container.querySelector('#api-key-input');
    const key = input?.value.trim();
    if (!key) { toast('Bitte einen API-Schlüssel eingeben.'); return; }
    store.setApiKey(key);
    toast('Schlüssel lokal gespeichert.');
    draw();
    return;
  }
  if (action === 'clear-key') {
    if (await confirmDialog('Den lokal gespeicherten API-Schlüssel löschen?', 'Löschen')) {
      store.clearApiKey();
      toast('Schlüssel gelöscht.');
      draw();
    }
    return;
  }
  if (action === 'start') startRun();
}

async function startRun() {
  const region = container.querySelector('#scr-region').value.trim() || 'DACH';
  const count = Number(container.querySelector('#scr-count').value) || 20;
  const hints = container.querySelector('#scr-hints').value;

  let request;
  try {
    request = buildScreeningRequest(profile, { region, count, hints });
  } catch (e) {
    toast(e.message);
    return;
  }

  running = true;
  result = null;
  container.querySelector('[data-action="start"]').disabled = true;
  container.querySelector('#scr-results').innerHTML = '';

  try {
    const { output } = await runScreening(store.getApiKey(), request, setStatus);
    const parsed = parseCandidates(output, profile);
    result = { ...parsed, region, selected: new Set(parsed.candidates.map((_, i) => i)) };
    setStatus('');
    if (parsed.candidates.length === 0) {
      container.querySelector('#scr-results').innerHTML =
        '<div class="notice notice-warn">Die Recherche lieferte keine belegbaren Kandidaten. Versuchen Sie eine breitere Region oder weniger strenge Hinweise.</div>';
    } else {
      drawResults();
      if (parsed.candidates.length < Math.min(50, Math.max(5, count))) {
        toast(`${parsed.candidates.length} von ${count} angefragten Kandidaten gefunden.`);
      }
    }
  } catch (e) {
    setStatus('');
    container.querySelector('#scr-results').innerHTML =
      `<div class="notice notice-error">${esc(e.message)}</div>`;
  } finally {
    running = false;
    const btn = container.querySelector('[data-action="start"]');
    if (btn) btn.disabled = false;
  }
}

function drawResults() {
  const target = container.querySelector('#scr-results');
  if (!target || !result) return;

  const existingNames = new Set(store.listLeads(profile.id).map((l) => l.name.trim().toLowerCase()));
  const preCount = prescreeningCriteria(profile).length;

  const rows = result.candidates.map((cand, i) => {
    const ev = evaluate(profile, candidateToLead(cand, profile));
    const filled = Object.keys(cand.values).length;
    const dup = existingNames.has(cand.name.trim().toLowerCase());
    const sources = [...cand.sources, ...Object.values(cand.valueSources)]
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .map((s) => `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(s))}</a>`)
      .join(' · ');
    const unmatchedNote = cand.unmatched.length > 0
      ? `<div class="hint">Nicht zuordenbar: ${cand.unmatched.map((u) => `${esc(u.criterionName)} = „${esc(u.raw)}"`).join('; ')}</div>`
      : '';
    return `
      <tr>
        <td><input type="checkbox" data-select="${i}" ${result.selected.has(i) ? 'checked' : ''} aria-label="Kandidat auswählen"></td>
        <td>
          <strong>${esc(cand.name)}</strong>
          ${dup ? '<span class="badge badge-incomplete">evtl. Duplikat</span>' : ''}
          ${cand.website ? `<div><a href="${esc(cand.website)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(cand.website))}</a></div>` : ''}
          <div class="muted">${esc(cand.reasoning)}</div>
          ${unmatchedNote}
          <div class="hint">Quellen: ${sources}</div>
        </td>
        <td class="right">${ev.total === null ? '–' : fmtScore(ev.total)}</td>
        <td>${ev.status === 'scored' ? tierBadge(profile, ev.tierId) : ''}
            ${ev.status === 'not-evaluable' ? '<span class="badge badge-not-evaluable">Nicht bewertbar</span>' : ''}</td>
        <td class="right">${filled}/${preCount}</td>
      </tr>`;
  }).join('');

  target.innerHTML = `
    <div class="card">
      <h2>Kandidaten (${result.candidates.length})</h2>
      ${result.warnings.length > 0 ? `
        <div class="notice notice-warn"><ul>${result.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      <p class="muted">Punktzahlen beruhen nur auf den recherchierten Pre-Screening-Werten
      (fehlende Werte gemäß Profileinstellung). Das 2. Screening ergänzen Sie nach der Übernahme manuell.
      Ohne Übernahme wird nichts gespeichert.</p>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Kandidat</th><th class="right">Punktzahl</th><th>Stufe</th><th class="right">Belegt</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="row-actions" style="margin-top: var(--space-3)">
        <button class="btn" data-result-action="toggle-all">Alle an/abwählen</button>
        <button class="btn btn-primary" data-result-action="import">Auswahl als Leads übernehmen</button>
      </div>
    </div>
  `;

  target.querySelectorAll('[data-select]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const i = Number(cb.dataset.select);
      if (cb.checked) result.selected.add(i);
      else result.selected.delete(i);
    });
  });
  target.querySelectorAll('[data-result-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleResultAction(btn.dataset.resultAction));
  });
}

function shortUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

function handleResultAction(action) {
  if (action === 'toggle-all') {
    if (result.selected.size === result.candidates.length) result.selected.clear();
    else result.candidates.forEach((_, i) => result.selected.add(i));
    drawResults();
    return;
  }
  if (action === 'import') {
    if (result.selected.size === 0) { toast('Bitte mindestens einen Kandidaten auswählen.'); return; }
    const today = new Date().toISOString().slice(0, 10);
    let imported = 0;
    for (const i of [...result.selected].sort((a, b) => a - b)) {
      const lead = candidateToLead(result.candidates[i], profile, { region: result.region, date: today });
      store.saveLead(lead);
      imported++;
    }
    toast(`${imported} Lead(s) übernommen — Quelle „Screening".`);
    result = null;
    navigate('#/leads');
  }
}
