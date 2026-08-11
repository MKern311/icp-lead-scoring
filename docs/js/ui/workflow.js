// Geführter Screening-Workflow (Feature 003, contracts/workflow.md):
// Schritt 1 Phasen-Zuordnung mit Pflicht-Bestätigung + Suchhinweise,
// Schritt 2 Online-Screening mit Übernahme (ersetzt die frühere Einzelansicht),
// Schritt 3 geführte Qualifizierung Lead für Lead. Der Workflow-Zustand ist
// flüchtig — persistiert wird nur über Profil, Leads und API-Schlüssel (FR-010).

import * as store from '../store.js';
import { evaluate } from '../core/scoring.js';
import { criterionFromCatalog } from '../core/model.js';
import { criterionCatalog } from '../templates.js';
import {
  prescreeningCriteria, buildScreeningRequest, parseCandidates, candidateToLead,
  qualificationQueue,
} from '../core/screening.js';
import { runScreening } from '../screening-api.js';
import { esc, toast, confirmDialog, navigate, fmtScore, fmtValue } from '../app.js';
import { tierBadge } from './lead-form.js';

let container = null;
let profile = null;
let step = 1;
let confirmed = new Set();                       // in dieser Sitzung aktiv bestätigte Kriterien
let params = { region: 'DACH', count: 20, hints: '' };
let running = false;
let result = null;                               // Schritt-2-Ergebnis { candidates, warnings, region, selected }
let queue = [];                                  // Schritt-3-Warteschlange (Lead-IDs)
let position = 0;
let processed = new Set();                       // gespeicherte Leads
let skipped = new Set();                         // übersprungene Leads (bleiben offen)
let drafts = new Map();                          // leadId → ungespeicherte Eingaben (W4: „Zurück")
let finished = false;

export function render(section) {
  container = section;
  profile = store.getActiveProfile();
  if (!running) {
    // Neueinstieg setzt die Führung zurück — gespeicherte Daten bleiben maßgeblich (FR-010)
    step = 1;
    confirmed = new Set();
    result = null;
    queue = [];
    position = 0;
    processed = new Set();
    skipped = new Set();
    drafts = new Map();
    finished = false;
  }
  draw();
}

// Profil bei jedem Schrittwechsel neu lesen (Edge Case: Änderung in anderem Tab)
function goToStep(n) {
  profile = store.getActiveProfile();
  step = n;
  finished = false;
  draw();
}

function stepsIndicator() {
  const labels = ['Kriterien bestätigen', 'Online-Screening', 'Qualifizierung'];
  return `<div class="workflow-steps">${labels.map((label, i) => `
    <span class="step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}">
      <span class="num">${step > i + 1 ? '✓' : i + 1}</span> ${label}
    </span>${i < 2 ? '<span class="sep">→</span>' : ''}`).join('')}
  </div>`;
}

function draw() {
  if (!profile) {
    container.innerHTML = `
      <div class="view-header"><h1>Screening-Workflow</h1></div>
      <div class="empty-state">
        Kein aktives Profil. Bitte zuerst unter <a href="#/profile">Profile</a> ein Profil anlegen und aktivieren.
      </div>`;
    return;
  }
  container.innerHTML = `
    <div class="view-header"><h1>Screening-Workflow</h1></div>
    <p class="muted">Profil: <strong>${esc(profile.name)}</strong></p>
    ${stepsIndicator()}
    <div id="wf-body"></div>
  `;
  const body = container.querySelector('#wf-body');
  if (step === 1) drawStep1(body);
  else if (step === 2) drawStep2(body);
  else drawStep3(body);
}

// --- Schritt 1: Phasen-Zuordnung mit Pflicht-Bestätigung + Suchhinweise (W2) ---

function drawStep1(body) {
  const resume = qualificationQueue(profile, store.listLeads(profile.id));
  const open = profile.criteria.filter((c) => !confirmed.has(c.id));
  const pre = prescreeningCriteria(profile);
  const allConfirmed = open.length === 0;

  const resumeBlock = resume.length > 0 && !finished ? `
    <div class="notice notice-warn">
      ${resume.length} gespeicherte Screening-Lead(s) haben noch offene Qualifizierungskriterien.
      <button class="btn btn-small" data-action="resume">Direkt mit der Qualifizierung fortfahren</button>
    </div>` : '';

  const criterionRow = (c) => {
    const isConfirmed = confirmed.has(c.id);
    // Suchpräferenz (FR-016): Auswahl-Kriterien per Klick aus den Ausprägungen,
    // Freitext nur noch bei Zahlenbereichen; Signale/Skalen brauchen keine Präferenz.
    let hintField = '';
    if (c.stage === 'prescreening' && c.type === 'select') {
      hintField = `
      <div class="field grow">
        <label>Bevorzugt suchen nach (Mehrfachauswahl)</label>
        <div class="target-picker">
          ${c.rules.options.map((o) => `<label><input type="checkbox" data-target="${c.id}:${o.id}" ${(c.searchTargets || []).includes(o.id) ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}
        </div>
        <div class="hint">Ohne Auswahl wird ohne Präferenz gesucht; bewertet werden immer alle Ausprägungen.</div>
      </div>`;
    } else if (c.stage === 'prescreening' && c.type === 'range') {
      hintField = `
      <div class="field grow">
        <label>Suchhinweis (optional)</label>
        <input type="text" maxlength="200" data-hint="${c.id}" value="${esc(c.searchHint || '')}"
          placeholder="Wonach soll gesucht werden? z. B. bevorzugt 50–250 Mitarbeiter">
      </div>`;
    }
    return `
      <div class="card criterion-card ${isConfirmed ? '' : 'unconfirmed'}">
        <div class="criterion-head">
          <div class="field grow">
            <label>${esc(c.name)}${c.knockout ? ' <span class="badge badge-knockout">K.o.</span>' : ''}</label>
            ${c.description ? `<div class="hint">${esc(c.description)}</div>` : ''}
          </div>
          <div class="field" style="max-width:16rem"><label>Screening-Phase</label>
            <select data-stage="${c.id}">
              <option value="prescreening" ${c.stage === 'prescreening' ? 'selected' : ''}>Pre-Screening (online recherchierbar)</option>
              <option value="qualification" ${c.stage !== 'prescreening' ? 'selected' : ''}>Qualifizierung (2. Screening)</option>
            </select></div>
          ${isConfirmed
            ? '<span class="badge badge-tier-0">✓ bestätigt</span>'
            : `<button class="btn btn-small" data-confirm="${c.id}">Bestätigen</button>`}
        </div>
        ${hintField}
      </div>`;
  };

  // Gruppierung (FR-015): erst recherchierbare Kriterien + Katalog, dann Qualifizierung
  const qual = profile.criteria.filter((c) => c.stage !== 'prescreening');
  const existingNames = new Set(profile.criteria.map((c) => c.name.trim().toLowerCase()));
  const suggestions = criterionCatalog
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => !existingNames.has(entry.name.trim().toLowerCase()));

  const catalogBlock = suggestions.length > 0 ? `
    <div class="card">
      <h3>Vorschläge: das kann online recherchiert werden</h3>
      <p class="muted">Per Klick als Pre-Screening-Kriterium übernehmen — Gewichte und
      Punktregeln passen Sie danach im Profil-Editor an.</p>
      ${suggestions.map(({ entry, idx }) => `
        <div class="criterion-head" style="margin-bottom: var(--space-2)">
          <div class="field grow">
            <label>${esc(entry.name)}</label>
            <div class="hint">${esc(entry.description)}${entry.type === 'select'
              ? ` · Klassen: ${entry.rules.options.map((o) => esc(o.label)).join(', ')}`
              : entry.searchHint ? ` · ${esc(entry.searchHint)}` : ''}</div>
          </div>
          <button class="btn btn-small" data-add-catalog="${idx}">+ Übernehmen</button>
        </div>`).join('')}
    </div>` : '';

  body.innerHTML = `
    ${resumeBlock}
    <div class="card">
      <h2>Schritt 1: Kriterien den Phasen zuordnen</h2>
      <p class="muted">Bestätigen Sie für jedes Kriterium, ob es online recherchierbar ist
      (Pre-Screening) oder erst im Kundenkontakt bewertbar (Qualifizierung — 2. Screening).
      Zuordnungen werden sofort im Profil gespeichert. Zu Pre-Screening-Kriterien können Sie
      einen Suchhinweis erfassen — er wird bei der Recherche mit übertragen, niemals aber
      Gewichte oder Punktwerte.</p>
      ${open.length > 0
        ? `<div class="notice notice-warn">Noch ${open.length} von ${profile.criteria.length} Kriterien unbestätigt.</div>`
        : '<div class="notice notice-ok" style="background:#e7f3ec;border:1px solid #bcd9c8;border-radius:var(--radius);padding:var(--space-2) var(--space-3)">Alle Kriterien bestätigt.</div>'}
    </div>
    <h2>Online recherchierbar — Pre-Screening (${pre.length})</h2>
    ${pre.length > 0 ? pre.map(criterionRow).join('') : '<p class="muted">Noch keine Pre-Screening-Kriterien — übernehmen Sie Vorschläge aus dem Katalog oder stellen Sie unten die Phase um.</p>'}
    ${catalogBlock}
    <h2>Nicht online recherchierbar — Qualifizierung, 2. Screening (${qual.length})</h2>
    ${qual.length > 0 ? qual.map(criterionRow).join('') : '<p class="muted">Keine Qualifizierungskriterien.</p>'}
    <div class="card">
      <h2>Suchparameter</h2>
      <div class="inline-fields">
        <div class="field">
          <label for="wf-region">Region / Markt</label>
          <input type="text" id="wf-region" value="${esc(params.region)}" maxlength="120">
        </div>
        <div class="field" style="max-width:9rem">
          <label for="wf-count">Anzahl (5–50)</label>
          <input type="number" id="wf-count" min="5" max="50" step="1" value="${esc(params.count)}">
        </div>
      </div>
      <div class="field">
        <label for="wf-hints">Globale Hinweise (optional)</label>
        <textarea id="wf-hints" maxlength="1000" placeholder="z. B. Nische, Ausschlüsse, bevorzugte Teilregionen">${esc(params.hints)}</textarea>
      </div>
      ${allConfirmed && pre.length === 0
        ? '<div class="notice notice-warn">Kein Kriterium ist als „Pre-Screening" markiert — ohne recherchierbare Kriterien kann Schritt 2 nicht starten.</div>' : ''}
      <button class="btn btn-primary" data-action="to-step-2" ${allConfirmed && pre.length > 0 ? '' : 'disabled'}>
        Weiter zu Schritt 2: Screening
      </button>
    </div>
  `;

  body.querySelectorAll('[data-stage]').forEach((el) => {
    el.addEventListener('change', () => {
      const c = profile.criteria.find((x) => x.id === el.dataset.stage);
      if (!c) return;
      c.stage = el.value;             // Suchhinweis bleibt beim Phasenwechsel erhalten
      confirmed.add(c.id);
      readParams(body);
      store.saveProfile(profile);
      draw();
    });
  });
  body.querySelectorAll('[data-hint]').forEach((el) => {
    el.addEventListener('change', () => {
      const c = profile.criteria.find((x) => x.id === el.dataset.hint);
      if (!c) return;
      c.searchHint = el.value.slice(0, 200);
      store.saveProfile(profile);
    });
  });
  body.querySelectorAll('[data-target]').forEach((el) => {
    el.addEventListener('change', () => {
      const [cid, oid] = el.dataset.target.split(':');
      const c = profile.criteria.find((x) => x.id === cid);
      if (!c) return;
      const chosen = new Set(c.searchTargets || []);
      if (el.checked) chosen.add(oid);
      else chosen.delete(oid);
      c.searchTargets = c.rules.options.map((o) => o.id).filter((id) => chosen.has(id));
      store.saveProfile(profile);
    });
  });
  body.querySelectorAll('[data-confirm]').forEach((el) => {
    el.addEventListener('click', () => {
      confirmed.add(el.dataset.confirm);
      readParams(body);
      draw();
    });
  });
  body.querySelectorAll('[data-add-catalog]').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = criterionCatalog[Number(el.dataset.addCatalog)];
      if (!entry) return;
      const c = criterionFromCatalog(entry);
      profile.criteria.push(c);
      confirmed.add(c.id);                     // Übernahme ist eine aktive Entscheidung
      readParams(body);
      store.saveProfile(profile);
      toast(`Kriterium „${c.name}" übernommen.`);
      draw();
    });
  });
  body.querySelector('[data-action="to-step-2"]')?.addEventListener('click', () => {
    readParams(body);
    goToStep(2);
  });
  body.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
    queue = qualificationQueue(profile, store.listLeads(profile.id)).map((l) => l.id);
    position = 0;
    processed = new Set();
    skipped = new Set();
    drafts = new Map();
    goToStep(3);
  });
}

function readParams(body) {
  const region = body.querySelector('#wf-region')?.value.trim();
  const count = Number(body.querySelector('#wf-count')?.value);
  const hints = body.querySelector('#wf-hints')?.value;
  params = {
    region: region || 'DACH',
    count: Number.isFinite(count) && count > 0 ? count : 20,
    hints: hints ?? params.hints,
  };
}

// --- Schritt 2: Online-Screening mit Übernahme (W1/W3) ---

function maskKey(key) {
  return key.length > 12 ? `${key.slice(0, 7)}…${key.slice(-4)}` : '…';
}

function drawStep2(body) {
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

  const hinted = pre.filter((c) => (c.searchHint || '').trim());
  body.innerHTML = `
    <div class="card">
      <h2>Schritt 2: Online-Screening</h2>
      <p>Recherchiert wird in <strong>${esc(params.region)}</strong> nach
      <strong>${esc(String(params.count))}</strong> Kandidaten anhand der
      <strong>${pre.length} Pre-Screening-Kriterien</strong>:
      ${pre.map((c) => `<span class="badge">${esc(c.name)}</span>`).join(' ')}</p>
      ${hinted.length > 0 ? `<p class="muted">Suchhinweise: ${hinted.map((c) => `${esc(c.name)}: „${esc(c.searchHint.trim())}"`).join(' · ')}</p>` : ''}
      <p class="muted">Qualifizierungskriterien werden nicht übertragen und bleiben für Schritt 3 offen.</p>
      <div class="card">
        <h2>API-Schlüssel</h2>
        ${keyBlock}
      </div>
      <div class="notice notice-warn">Der Lauf nutzt Ihren eigenen API-Schlüssel und verursacht Kosten
      (Websuche + KI-Nutzung; erfahrungsgemäß grob 0,50–1,50&nbsp;€ pro Lauf mit 20 Kandidaten).</div>
      <div class="row-actions">
        <button class="btn" data-action="back-1" ${running ? 'disabled' : ''}>Zurück zu Schritt 1</button>
        <button class="btn btn-primary" data-action="start" ${(!apiKey || pre.length === 0 || running) ? 'disabled' : ''}>
          Screening starten
        </button>
        <span id="wf-status" class="muted"></span>
      </div>
    </div>
    <div id="wf-results"></div>
  `;

  body.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => handleStep2Action(el.dataset.action, body));
  });
  if (result) drawResults(body);
}

function setStatus(text) {
  const el = container.querySelector('#wf-status');
  if (el) el.textContent = text;
}

async function handleStep2Action(action, body) {
  if (action === 'back-1') { goToStep(1); return; }
  if (action === 'save-key') {
    const key = body.querySelector('#api-key-input')?.value.trim();
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
  if (action === 'start') startRun(body);
}

async function startRun(body) {
  let request;
  try {
    request = buildScreeningRequest(profile, params);
  } catch (e) {
    toast(e.message);
    return;
  }

  running = true;
  result = null;
  body.querySelector('[data-action="start"]').disabled = true;
  body.querySelector('[data-action="back-1"]').disabled = true;
  body.querySelector('#wf-results').innerHTML = '';

  try {
    const { output } = await runScreening(store.getApiKey(), request, setStatus);
    const parsed = parseCandidates(output, profile);
    result = { ...parsed, region: params.region, selected: new Set(parsed.candidates.map((_, i) => i)) };
    setStatus('');
    if (parsed.candidates.length === 0) {
      body.querySelector('#wf-results').innerHTML =
        '<div class="notice notice-warn">Die Recherche lieferte keine belegbaren Kandidaten. Versuchen Sie eine breitere Region oder weniger strenge Hinweise.</div>';
    } else {
      drawResults(body);
    }
  } catch (e) {
    setStatus('');
    body.querySelector('#wf-results').innerHTML =
      `<div class="notice notice-error">${esc(e.message)}</div>`;
  } finally {
    running = false;
    const btn = body.querySelector('[data-action="start"]');
    if (btn) btn.disabled = false;
    const back = body.querySelector('[data-action="back-1"]');
    if (back) back.disabled = false;
  }
}

function shortUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

function drawResults(body) {
  const target = body.querySelector('#wf-results');
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
      <p class="muted">Punktzahlen beruhen nur auf den recherchierten Pre-Screening-Werten.
      Die Qualifizierung folgt in Schritt 3. Ohne Übernahme wird nichts gespeichert.</p>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Kandidat</th><th class="right">Punktzahl</th><th>Stufe</th><th class="right">Belegt</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="row-actions" style="margin-top: var(--space-3)">
        <button class="btn" data-result-action="toggle-all">Alle an/abwählen</button>
        <button class="btn btn-primary" data-result-action="import">Auswahl übernehmen &amp; weiter zu Schritt 3</button>
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
    btn.addEventListener('click', () => handleResultAction(btn.dataset.resultAction, body));
  });
}

function handleResultAction(action, body) {
  if (action === 'toggle-all') {
    if (result.selected.size === result.candidates.length) result.selected.clear();
    else result.candidates.forEach((_, i) => result.selected.add(i));
    drawResults(body);
    return;
  }
  if (action === 'import') {
    if (result.selected.size === 0) { toast('Bitte mindestens einen Kandidaten auswählen.'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const importedIds = [];
    for (const i of [...result.selected].sort((a, b) => a - b)) {
      const lead = candidateToLead(result.candidates[i], profile, { region: result.region, date: today });
      store.saveLead(lead);
      importedIds.push(lead.id);
    }
    toast(`${importedIds.length} Lead(s) übernommen — Quelle „Screening".`);
    result = null;
    queue = importedIds;                          // W3: genau die übernommenen Leads
    position = 0;
    processed = new Set();
    skipped = new Set();
    drafts = new Map();
    goToStep(3);
  }
}

// --- Schritt 3: Geführte Qualifizierung Lead für Lead (W4) ---

function drawStep3(body) {
  if (queue.length === 0 || finished || position >= queue.length) {
    drawSummary(body);
    return;
  }

  const leadId = queue[position];
  const stored = store.getLead(profile.id, leadId);
  if (!stored) {
    // Lead wurde außerhalb gelöscht — überspringen
    position += 1;
    drawStep3(body);
    return;
  }
  const working = drafts.get(leadId) || structuredClone(stored);
  drafts.set(leadId, working);

  const pre = profile.criteria.filter((c) => c.stage === 'prescreening');
  const qual = profile.criteria.filter((c) => c.stage !== 'prescreening');

  const preRows = pre.map((c) => {
    const value = working.values[c.id];
    const label = c.type === 'select'
      ? c.rules.options.find((o) => o.id === value)?.label ?? ''
      : fmtValue(value);
    const source = working.sources?.[c.id]
      ? ` <a href="${esc(working.sources[c.id])}" target="_blank" rel="noopener noreferrer">[Quelle]</a>` : '';
    return `<tr><td>${esc(c.name)}</td><td>${value === undefined ? '<span class="muted">— nicht belegt —</span>' : esc(label)}${source}</td></tr>`;
  }).join('');

  const qualFields = qual.map((c) => {
    const value = working.values[c.id];
    const koBadge = c.knockout ? ' <span class="badge badge-knockout">K.o.</span>' : '';
    let input = '';
    switch (c.type) {
      case 'select':
        input = `<select data-criterion="${c.id}">
          <option value="">— nicht angegeben —</option>
          ${c.rules.options.map((o) => `<option value="${o.id}" ${value === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>`;
        break;
      case 'boolean':
        input = `<select data-criterion="${c.id}">
          <option value="">— nicht angegeben —</option>
          <option value="yes" ${value === true ? 'selected' : ''}>Ja</option>
          <option value="no" ${value === false ? 'selected' : ''}>Nein</option>
        </select>`;
        break;
      case 'range':
        input = `<input type="number" step="any" data-criterion="${c.id}" value="${value ?? ''}" placeholder="Zahl">`;
        break;
      case 'scale':
        input = `<input type="number" step="1" min="${c.rules.min}" max="${c.rules.max}" data-criterion="${c.id}" value="${value ?? ''}" placeholder="${c.rules.min}–${c.rules.max}">`;
        break;
    }
    return `
      <div class="field">
        <label>${esc(c.name)}${koBadge}</label>
        ${c.description ? `<div class="hint">${esc(c.description)}</div>` : ''}
        ${input}
      </div>`;
  }).join('');

  body.innerHTML = `
    <div class="card">
      <h2>Schritt 3: Qualifizierung — Lead ${position + 1} von ${queue.length}</h2>
      <p><strong>${esc(working.name)}</strong>
        ${working.website ? ` · <a href="${esc(working.website)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(working.website))}</a>` : ''}</p>
      ${working.note ? `<details><summary class="muted">Notiz &amp; Recherche-Begründung</summary><p class="muted" style="white-space:pre-line">${esc(working.note)}</p></details>` : ''}
    </div>
    <div class="two-col">
      <div>
        ${pre.length > 0 ? `
        <div class="card">
          <h2>Pre-Screening (recherchiert, nur lesend)</h2>
          <div class="table-wrap"><table><tbody>${preRows}</tbody></table></div>
        </div>` : ''}
        <div class="card">
          <h2>Qualifizierung — 2. Screening</h2>
          ${qual.length > 0 ? qualFields : '<p class="muted">Dieses Profil hat keine Qualifizierungskriterien.</p>'}
          <div class="row-actions" style="margin-top: var(--space-3)">
            <button class="btn" data-action="prev" ${position === 0 ? 'disabled' : ''}>Zurück</button>
            <button class="btn" data-action="skip">Überspringen</button>
            <button class="btn btn-primary" data-action="save-next">Speichern &amp; weiter</button>
          </div>
        </div>
      </div>
      <div class="card score-panel" id="wf-score"></div>
    </div>
  `;

  body.querySelectorAll('[data-criterion]').forEach((el) => {
    const apply = () => { readLeadValue(el, working); updateStep3Score(body, working); };
    el.addEventListener('change', apply);
    if (el.type === 'number') el.addEventListener('input', apply);
  });
  body.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleStep3Action(btn.dataset.action, body, working));
  });
  updateStep3Score(body, working);
}

function readLeadValue(el, working) {
  const c = profile.criteria.find((x) => x.id === el.dataset.criterion);
  if (!c) return;
  const raw = el.value;
  if (raw === '') { delete working.values[c.id]; return; }
  if (c.type === 'select') working.values[c.id] = raw;
  else if (c.type === 'boolean') working.values[c.id] = raw === 'yes';
  else {
    const v = Number(raw);
    if (Number.isFinite(v)) working.values[c.id] = v;
    else delete working.values[c.id];
  }
}

function updateStep3Score(body, working) {
  const panel = body.querySelector('#wf-score');
  if (!panel) return;
  const ev = evaluate(profile, working);
  const badges = [];
  if (ev.status === 'scored') badges.push(tierBadge(profile, ev.tierId));
  if (ev.status === 'disqualified') badges.push('<span class="badge badge-disqualified">Disqualifiziert</span>');
  if (ev.status === 'not-evaluable') badges.push('<span class="badge badge-not-evaluable">Nicht bewertbar</span>');
  if (!ev.complete) badges.push('<span class="badge badge-incomplete">Unvollständig</span>');
  panel.innerHTML = `
    <h2>Bewertung</h2>
    <div>${badges.join(' ')}</div>
    <div class="score-value ${ev.status === 'disqualified' ? 'muted' : ''}">${ev.total === null ? '–' : fmtScore(ev.total)}</div>
    <div class="score-sub">von 100 Punkten</div>
    <p class="hint" style="text-align:left">Die Bewertung aktualisiert sich live. Den vollständigen
    Kriterien-Breakdown zeigt die <a href="#/lead/${esc(working.id)}">Lead-Einzelansicht</a>.</p>
  `;
}

function handleStep3Action(action, body, working) {
  if (action === 'prev') {
    if (position > 0) { position -= 1; drawStep3(body); }
    return;
  }
  if (action === 'skip') {
    skipped.add(working.id);
    processed.delete(working.id);
    advance(body);
    return;
  }
  if (action === 'save-next') {
    store.saveLead(working);
    drafts.delete(working.id);
    processed.add(working.id);
    skipped.delete(working.id);
    advance(body);
  }
}

function advance(body) {
  position += 1;
  if (position >= queue.length) finished = true;
  drawStep3(body);
}

function drawSummary(body) {
  if (queue.length === 0) {
    body.innerHTML = `
      <div class="card">
        <h2>Schritt 3: Qualifizierung</h2>
        <div class="empty-state">Keine Leads in der Warteschlange. Übernehmen Sie in
        Schritt 2 Kandidaten oder starten Sie den Workflow neu.</div>
        <button class="btn" data-action="restart">Zurück zu Schritt 1</button>
      </div>`;
    body.querySelector('[data-action="restart"]').addEventListener('click', () => { render(container); });
    return;
  }

  const leads = queue.map((id) => store.getLead(profile.id, id)).filter(Boolean);
  const tally = new Map();
  const sorted = [...profile.tiers].sort((a, b) => b.minScore - a.minScore);
  for (const lead of leads) {
    if (!processed.has(lead.id)) continue;
    const ev = evaluate(profile, lead);
    let label;
    if (ev.status === 'scored') label = `Stufe ${sorted.find((t) => t.id === ev.tierId)?.label ?? '?'}`;
    else if (ev.status === 'disqualified') label = 'Disqualifiziert';
    else label = 'Nicht bewertbar';
    tally.set(label, (tally.get(label) || 0) + 1);
  }
  const openCount = queue.length - processed.size;

  body.innerHTML = `
    <div class="card">
      <h2>Workflow abgeschlossen</h2>
      <p><strong>${processed.size}</strong> Lead(s) qualifiziert,
         <strong>${openCount}</strong> übersprungen/offen.</p>
      ${tally.size > 0 ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Ergebnis</th><th class="right">Anzahl</th></tr></thead>
          <tbody>${[...tally.entries()].map(([label, n]) => `<tr><td>${esc(label)}</td><td class="right">${n}</td></tr>`).join('')}</tbody>
        </table></div>` : ''}
      ${openCount > 0 ? '<p class="muted">Offene Leads erscheinen beim nächsten Workflow-Start wieder als Qualifizierungs-Angebot.</p>' : ''}
      <div class="row-actions" style="margin-top: var(--space-3)">
        <button class="btn btn-primary" data-action="to-leads">Zur Rangliste</button>
        <button class="btn" data-action="restart">Workflow neu starten</button>
      </div>
    </div>
  `;
  body.querySelector('[data-action="to-leads"]').addEventListener('click', () => navigate('#/leads'));
  body.querySelector('[data-action="restart"]').addEventListener('click', () => { render(container); });
}
