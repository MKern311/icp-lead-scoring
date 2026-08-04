// Profil-Editor: Grunddaten, Kriterien (4 Typen mit Punktregeln), K.o., Gewichte
// inkl. Summen-Hinweis/Normalisierung (FR-015), Stufen-Editor (FR-006).

import * as store from '../store.js';
import { createProfile, createCriterion, createTier, validateProfile, weightSum, normalizeWeights, uuid, CRITERION_TYPES } from '../core/model.js';
import { esc, toast, confirmDialog, navigate, refreshActiveProfileIndicator } from '../app.js';

const TYPE_LABELS = {
  select: 'Auswahlliste',
  range: 'Zahlenbereich',
  boolean: 'Ja / Nein',
  scale: 'Skala',
};

let container = null;
let working = null;
let isNew = false;

export function render(section, params) {
  container = section;
  const id = params[0];
  isNew = id === 'new';
  if (isNew) {
    const stashed = sessionStorage.getItem('icp.newProfile');
    working = stashed ? JSON.parse(stashed) : createProfile('');
  } else {
    const profile = store.getProfile(id);
    if (!profile) {
      container.innerHTML = '<div class="empty-state">Profil nicht gefunden. <a href="#/profile">Zur Übersicht</a></div>';
      return;
    }
    working = structuredClone(profile);
  }
  draw();
}

function draw(messages = null) {
  const sum = weightSum(working);
  const sumOff = Math.abs(sum - 100) > 0.001;

  container.innerHTML = `
    <div class="view-header">
      <h1>${isNew ? 'Neues Profil' : 'Profil bearbeiten'}</h1>
      <div class="row-actions">
        <button class="btn" data-action="cancel">Abbrechen</button>
        <button class="btn btn-primary" data-action="save">Speichern</button>
      </div>
    </div>
    <div id="editor-messages">${messages || ''}</div>

    <div class="card">
      <h2>Grunddaten</h2>
      <div class="field">
        <label for="pf-name">Profilname *</label>
        <input type="text" id="pf-name" data-bind="name" maxlength="120" value="${esc(working.name)}" placeholder="z. B. Idealkunde Beratung Mittelstand">
      </div>
      <div class="field">
        <label for="pf-desc">Beschreibung</label>
        <textarea id="pf-desc" data-bind="description" maxlength="2000" placeholder="Wen beschreibt dieses Profil?">${esc(working.description)}</textarea>
      </div>
      <div class="field">
        <label for="pf-policy">Umgang mit fehlenden Werten</label>
        <select id="pf-policy" data-bind="policy">
          <option value="neutral" ${working.missingValuePolicy === 'neutral' ? 'selected' : ''}>Neutral — Kriterium wird nicht einbezogen (empfohlen)</option>
          <option value="zero" ${working.missingValuePolicy === 'zero' ? 'selected' : ''}>Streng — fehlender Wert zählt 0 Punkte</option>
        </select>
        <div class="hint">Gilt für alle Bewertungen dieses Profils. Unvollständige Leads werden immer gekennzeichnet.</div>
      </div>
    </div>

    <div class="card">
      <h2>Kriterien</h2>
      <p>
        Gewichtssumme:
        <span class="weight-sum ${sumOff ? 'off' : ''}" id="weight-sum">${String(sum).replace('.', ',')} %</span>
        ${sumOff ? '<button class="btn btn-small" data-action="normalize">Auf 100 normieren</button>' : ''}
      </p>
      ${sumOff ? '<div class="notice notice-warn">Die Gewichtssumme weicht von 100 % ab. Die Bewertung normiert die Gewichte automatisch — für klare Prozentwerte können Sie „Auf 100 normieren" nutzen.</div>' : ''}
      ${working.criteria.length === 0 ? '<div class="empty-state">Noch keine Kriterien — fügen Sie das erste hinzu.</div>' : ''}
      ${working.criteria.map((c, i) => criterionCard(c, i)).join('')}
      <div class="inline-fields">
        <div class="field">
          <label for="new-criterion-type">Neues Kriterium</label>
          <select id="new-criterion-type">
            ${CRITERION_TYPES.map((t) => `<option value="${t}">${TYPE_LABELS[t]}</option>`).join('')}
          </select>
        </div>
        <button class="btn" data-action="add-criterion">Kriterium hinzufügen</button>
      </div>
    </div>

    <div class="card">
      <h2>Stufen</h2>
      <p class="muted">Leads werden der ersten Stufe zugeordnet, deren Schwellenwert sie erreichen. Eine Auffangstufe mit Schwellenwert 0 ist Pflicht.</p>
      ${working.tiers.map((t) => `
        <div class="inline-fields" style="margin-bottom: var(--space-2)">
          <div class="field"><label>Bezeichnung</label>
            <input type="text" maxlength="40" data-bind="t:${t.id}:label" value="${esc(t.label)}"></div>
          <div class="field"><label>ab Punktzahl</label>
            <input type="number" min="0" max="100" step="1" data-bind="t:${t.id}:minScore" value="${esc(t.minScore)}"></div>
          <button class="btn btn-small" data-action="remove-tier" data-id="${t.id}">Entfernen</button>
        </div>`).join('')}
      <button class="btn" data-action="add-tier">Stufe hinzufügen</button>
    </div>
  `;

  container.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => handleAction(el.dataset));
  });
  container.querySelectorAll('[data-bind]').forEach((el) => {
    el.addEventListener('change', () => handleBind(el));
    if (el.type === 'number') el.addEventListener('input', () => handleBind(el, true));
  });
}

function criterionCard(c, index) {
  return `
    <div class="card criterion-card">
      <div class="criterion-head">
        <span class="badge">${TYPE_LABELS[c.type]}</span>
        <div class="field grow"><label>Name *</label>
          <input type="text" maxlength="80" data-bind="c:${c.id}:name" value="${esc(c.name)}" placeholder="z. B. Branche"></div>
        <div class="field" style="max-width:7rem"><label>Gewicht %</label>
          <input type="number" min="0" max="100" step="0.1" data-bind="c:${c.id}:weight" value="${esc(c.weight)}"></div>
        <label style="white-space:nowrap"><input type="checkbox" data-bind="c:${c.id}:knockout" ${c.knockout ? 'checked' : ''}> K.o.-Kriterium</label>
        <div class="row-actions">
          <button class="btn btn-small" data-action="move-criterion" data-id="${c.id}" data-dir="-1" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-small" data-action="move-criterion" data-id="${c.id}" data-dir="1" ${index === working.criteria.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-small" data-action="remove-criterion" data-id="${c.id}">Entfernen</button>
        </div>
      </div>
      ${c.knockout ? '<div class="hint">K.o.: Erreicht ein Lead hier weniger als 1 Punkt, ist er disqualifiziert — unabhängig von der Gesamtpunktzahl.</div>' : ''}
      <div class="field"><label>Beschreibung</label>
        <input type="text" maxlength="500" data-bind="c:${c.id}:description" value="${esc(c.description || '')}" placeholder="Optional: Was wird hier bewertet?"></div>
      ${rulesEditor(c)}
    </div>`;
}

function rulesEditor(c) {
  switch (c.type) {
    case 'select':
      return `
        <h3>Optionen &amp; Punkte (0–100)</h3>
        ${c.rules.options.map((o) => `
          <div class="inline-fields" style="margin-bottom: var(--space-1)">
            <div class="field"><input type="text" maxlength="80" data-bind="c:${c.id}:opt:${o.id}:label" value="${esc(o.label)}" aria-label="Options-Label"></div>
            <div class="field" style="max-width:7rem"><input type="number" min="0" max="100" step="1" data-bind="c:${c.id}:opt:${o.id}:points" value="${esc(o.points)}" aria-label="Punkte"></div>
            <button class="btn btn-small" data-action="remove-option" data-id="${c.id}" data-oid="${o.id}">–</button>
          </div>`).join('')}
        <button class="btn btn-small" data-action="add-option" data-id="${c.id}">Option hinzufügen</button>`;
    case 'range':
      return `
        <h3>Bereiche &amp; Punkte (0–100, Grenzen inklusive)</h3>
        ${c.rules.ranges.map((r, i) => `
          <div class="inline-fields" style="margin-bottom: var(--space-1)">
            <div class="field"><label>von</label><input type="number" step="any" data-bind="c:${c.id}:rg:${i}:min" value="${esc(r.min)}"></div>
            <div class="field"><label>bis</label><input type="number" step="any" data-bind="c:${c.id}:rg:${i}:max" value="${esc(r.max)}"></div>
            <div class="field"><label>Punkte</label><input type="number" min="0" max="100" step="1" data-bind="c:${c.id}:rg:${i}:points" value="${esc(r.points)}"></div>
            <button class="btn btn-small" data-action="remove-range" data-id="${c.id}" data-index="${i}">–</button>
          </div>`).join('')}
        <button class="btn btn-small" data-action="add-range" data-id="${c.id}">Bereich hinzufügen</button>
        <div class="hint">Werte außerhalb aller Bereiche erhalten 0 Punkte und werden gekennzeichnet.</div>`;
    case 'boolean':
      return `
        <div class="inline-fields">
          <div class="field"><label>Punkte bei Ja</label><input type="number" min="0" max="100" step="1" data-bind="c:${c.id}:yes" value="${esc(c.rules.pointsYes)}"></div>
          <div class="field"><label>Punkte bei Nein</label><input type="number" min="0" max="100" step="1" data-bind="c:${c.id}:no" value="${esc(c.rules.pointsNo)}"></div>
        </div>`;
    case 'scale':
      return `
        <div class="inline-fields">
          <div class="field"><label>Skala von</label><input type="number" step="1" data-bind="c:${c.id}:min" value="${esc(c.rules.min)}"></div>
          <div class="field"><label>bis</label><input type="number" step="1" data-bind="c:${c.id}:max" value="${esc(c.rules.max)}"></div>
        </div>
        <div class="hint">Der Skalenwert wird linear auf 0–100 Punkte abgebildet (Minimum = 0, Maximum = 100).</div>`;
    default:
      return '';
  }
}

function num(el) {
  const v = Number(el.value);
  return Number.isFinite(v) && el.value !== '' ? v : null;
}

function handleBind(el, soft = false) {
  const parts = el.dataset.bind.split(':');
  if (parts[0] === 'name') working.name = el.value;
  else if (parts[0] === 'description') working.description = el.value;
  else if (parts[0] === 'policy') working.missingValuePolicy = el.value;
  else if (parts[0] === 't') {
    const tier = working.tiers.find((t) => t.id === parts[1]);
    if (!tier) return;
    if (parts[2] === 'label') tier.label = el.value;
    else { const v = num(el); if (v !== null) tier.minScore = v; }
  } else if (parts[0] === 'c') {
    const c = working.criteria.find((x) => x.id === parts[1]);
    if (!c) return;
    const key = parts[2];
    if (key === 'name') c.name = el.value;
    else if (key === 'description') c.description = el.value;
    else if (key === 'knockout') c.knockout = el.checked;
    else if (key === 'weight') { const v = num(el); if (v !== null) c.weight = v; updateWeightSum(); }
    else if (key === 'opt') {
      const opt = c.rules.options.find((o) => o.id === parts[3]);
      if (!opt) return;
      if (parts[4] === 'label') opt.label = el.value;
      else { const v = num(el); if (v !== null) opt.points = v; }
    } else if (key === 'rg') {
      const rg = c.rules.ranges[Number(parts[3])];
      if (!rg) return;
      const v = num(el);
      if (v !== null) rg[parts[4]] = v;
    } else if (key === 'yes') { const v = num(el); if (v !== null) c.rules.pointsYes = v; }
    else if (key === 'no') { const v = num(el); if (v !== null) c.rules.pointsNo = v; }
    else if (key === 'min') { const v = num(el); if (v !== null) c.rules.min = v; }
    else if (key === 'max') { const v = num(el); if (v !== null) c.rules.max = v; }
  }
  if (soft) updateWeightSum();
}

function updateWeightSum() {
  const el = container.querySelector('#weight-sum');
  if (!el) return;
  const sum = weightSum(working);
  el.textContent = `${String(sum).replace('.', ',')} %`;
  el.classList.toggle('off', Math.abs(sum - 100) > 0.001);
}

async function handleAction(dataset) {
  const { action, id } = dataset;
  const criterion = id ? working.criteria.find((c) => c.id === id) : null;

  switch (action) {
    case 'cancel':
      if (await confirmDialog('Änderungen verwerfen?', 'Verwerfen')) {
        sessionStorage.removeItem('icp.newProfile');
        navigate('#/profile');
      }
      return;
    case 'save':
      save();
      return;
    case 'normalize':
      normalizeWeights(working);
      draw();
      return;
    case 'add-criterion': {
      const type = container.querySelector('#new-criterion-type').value;
      working.criteria.push(createCriterion(type));
      draw();
      return;
    }
    case 'remove-criterion':
      working.criteria = working.criteria.filter((c) => c.id !== id);
      draw();
      return;
    case 'move-criterion': {
      const dir = Number(dataset.dir);
      const idx = working.criteria.findIndex((c) => c.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= working.criteria.length) return;
      [working.criteria[idx], working.criteria[target]] = [working.criteria[target], working.criteria[idx]];
      draw();
      return;
    }
    case 'add-option':
      criterion?.rules.options.push({ id: uuid(), label: `Option ${criterion.rules.options.length + 1}`, points: 0 });
      draw();
      return;
    case 'remove-option':
      if (criterion) criterion.rules.options = criterion.rules.options.filter((o) => o.id !== dataset.oid);
      draw();
      return;
    case 'add-range': {
      const last = criterion?.rules.ranges.at(-1);
      criterion?.rules.ranges.push({ min: last ? last.max + 1 : 0, max: last ? last.max + 10 : 10, points: 0 });
      draw();
      return;
    }
    case 'remove-range':
      criterion?.rules.ranges.splice(Number(dataset.index), 1);
      draw();
      return;
    case 'add-tier':
      working.tiers.push(createTier('', 0));
      draw();
      return;
    case 'remove-tier':
      working.tiers = working.tiers.filter((t) => t.id !== id);
      draw();
      return;
  }
}

function save() {
  const { errors, warnings } = validateProfile(working);
  if (errors.length > 0) {
    draw(`
      <div class="notice notice-error">
        <strong>Bitte korrigieren Sie vor dem Speichern:</strong>
        <ul>${errors.map((e) => `<li>${esc(e.message)}</li>`).join('')}</ul>
      </div>`);
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  store.saveProfile(working);
  sessionStorage.removeItem('icp.newProfile');
  if (!store.getSettings().activeProfileId) store.setActiveProfile(working.id);
  refreshActiveProfileIndicator();
  toast(warnings.length > 0
    ? `Profil gespeichert. Hinweis: ${warnings[0].message}`
    : 'Profil gespeichert.');
  navigate('#/profile');
}
