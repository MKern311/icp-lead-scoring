// Lead erfassen/bearbeiten: dynamische Felder aus den Profilkriterien (FR-007),
// Live-Bewertung mit vollständigem Breakdown (FR-005, SC-004), Statuskennzeichnung (FR-010).

import * as store from '../store.js';
import { createLead } from '../core/model.js';
import { evaluate } from '../core/scoring.js';
import { esc, toast, confirmDialog, navigate, fmtScore, fmtValue } from '../app.js';

let container = null;
let profile = null;
let working = null;
let isNew = false;

export function render(section, params) {
  container = section;
  profile = store.getActiveProfile();
  if (!profile) {
    container.innerHTML = `
      <div class="empty-state">
        Kein aktives Profil. Bitte zuerst unter <a href="#/profile">Profile</a> ein Profil anlegen und aktivieren.
      </div>`;
    return;
  }

  if (store.consumeRecalcFlag(profile.id)) {
    toast('Das Profil wurde geändert — alle Bewertungen wurden neu berechnet.');
  }

  const id = params[0];
  isNew = id === 'new';
  if (isNew) {
    working = createLead(profile.id);
  } else {
    const lead = store.getLead(profile.id, id);
    if (!lead) {
      container.innerHTML = '<div class="empty-state">Lead nicht gefunden. <a href="#/leads">Zur Rangliste</a></div>';
      return;
    }
    working = structuredClone(lead);
  }
  draw();
}

function draw() {
  container.innerHTML = `
    <div class="view-header">
      <h1>${isNew ? 'Lead erfassen' : `Lead bearbeiten`}</h1>
      <div class="row-actions">
        ${isNew ? '' : '<button class="btn" data-action="delete">Löschen</button>'}
        <button class="btn" data-action="cancel">Zur Rangliste</button>
        <button class="btn btn-primary" data-action="save">Speichern</button>
      </div>
    </div>
    <p class="muted">Profil: <strong>${esc(profile.name)}</strong></p>
    <div class="two-col">
      <div>
        <div class="card">
          <div class="field">
            <label for="lead-name">Name des Leads *</label>
            <input type="text" id="lead-name" maxlength="120" value="${esc(working.name)}" placeholder="z. B. Muster GmbH">
          </div>
          <div class="field">
            <label for="lead-note">Notiz</label>
            <textarea id="lead-note" maxlength="2000" placeholder="Optional">${esc(working.note)}</textarea>
          </div>
        </div>
        <div class="card">
          <h2>Kriterien</h2>
          ${profile.criteria.map((c) => criterionField(c)).join('')}
        </div>
      </div>
      <div class="card score-panel" id="score-panel"></div>
    </div>
  `;

  container.querySelector('#lead-name').addEventListener('input', (e) => { working.name = e.target.value; });
  container.querySelector('#lead-note').addEventListener('input', (e) => { working.note = e.target.value; });
  container.querySelectorAll('[data-criterion]').forEach((el) => {
    el.addEventListener('change', () => { readValue(el); updateScore(); });
    if (el.type === 'number') el.addEventListener('input', () => { readValue(el); updateScore(); });
  });
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });
  updateScore();
}

function criterionField(c) {
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
}

function readValue(el) {
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

export function tierBadge(profileRef, tierId) {
  if (!tierId) return '';
  const sorted = [...profileRef.tiers].sort((a, b) => b.minScore - a.minScore);
  const idx = sorted.findIndex((t) => t.id === tierId);
  const tier = sorted[idx];
  return tier ? `<span class="badge badge-tier-${Math.min(idx, 4)}">${esc(tier.label)}</span>` : '';
}

function updateScore() {
  const result = evaluate(profile, working);
  const panel = container.querySelector('#score-panel');

  const statusBadges = [];
  if (result.status === 'disqualified') statusBadges.push('<span class="badge badge-disqualified">Disqualifiziert</span>');
  if (result.status === 'not-evaluable') statusBadges.push('<span class="badge badge-not-evaluable">Nicht bewertbar</span>');
  if (!result.complete) statusBadges.push('<span class="badge badge-incomplete">Unvollständig</span>');

  const missingNames = result.missing
    .map((id) => profile.criteria.find((c) => c.id === id)?.name)
    .filter(Boolean);
  const policyText = profile.missingValuePolicy === 'zero'
    ? 'fehlende Werte zählen 0 Punkte (Einstellung „streng")'
    : 'fehlende Werte werden nicht einbezogen (Einstellung „neutral")';

  let explanation = '';
  if (result.status === 'not-evaluable') {
    explanation = '<p class="muted">Ein K.o.-Kriterium hat keinen Wert oder es liegen keine bewertbaren Werte vor — der Lead kann weder qualifiziert noch disqualifiziert werden.</p>';
  } else if (result.status === 'disqualified') {
    explanation = '<p class="muted">Ein K.o.-Kriterium ist nicht erfüllt. Die Punktzahl wird nur informativ angezeigt.</p>';
  }
  if (missingNames.length > 0 && result.status !== 'not-evaluable') {
    explanation += `<p class="muted">Ohne Wert: ${missingNames.map(esc).join(', ')} — ${policyText}.</p>`;
  }

  const breakdownRows = result.breakdown.map((b) => {
    const c = profile.criteria.find((x) => x.id === b.criterionId);
    const flags = [];
    if (!b.included && b.rawValue === null && !b.invalidValue) flags.push('fehlt');
    if (b.invalidValue) flags.push('ungültig');
    if (b.outOfRange) flags.push('außerhalb der Bereiche');
    if (b.knockoutViolated) flags.push('K.o. verletzt');
    return `<tr>
      <td>${esc(c?.name || '?')}</td>
      <td>${esc(displayValue(c, b.rawValue)) || '<span class="muted">–</span>'}</td>
      <td class="right">${b.points === null ? '–' : fmtScore(b.points)}</td>
      <td class="right">${b.included ? `${fmtScore(b.normalizedWeight * 100)} %` : '–'}</td>
      <td class="right">${b.included ? fmtScore(b.contribution) : '–'}</td>
      <td>${flags.length ? `<span class="muted">${esc(flags.join(', '))}</span>` : ''}</td>
    </tr>`;
  }).join('');

  panel.innerHTML = `
    <h2>Bewertung</h2>
    <div>${statusBadges.join(' ')} ${result.status === 'scored' ? tierBadge(profile, result.tierId) : ''}</div>
    <div class="score-value ${result.status === 'disqualified' ? 'muted' : ''}">${result.total === null ? '–' : fmtScore(result.total)}</div>
    <div class="score-sub">von 100 Punkten</div>
    ${explanation}
    <div class="table-wrap" style="text-align:left">
      <table>
        <thead><tr><th>Kriterium</th><th>Wert</th><th class="right">Punkte</th><th class="right">Gewicht</th><th class="right">Beitrag</th><th></th></tr></thead>
        <tbody>${breakdownRows}</tbody>
      </table>
    </div>
    <p class="hint" style="text-align:left">Beitrag = normiertes Gewicht × Punkte. Die Beiträge addieren sich zur Gesamtpunktzahl.</p>
  `;
}

function displayValue(criterion, rawValue) {
  if (rawValue === null || rawValue === undefined) return '';
  if (criterion?.type === 'select') {
    return criterion.rules.options.find((o) => o.id === rawValue)?.label || String(rawValue);
  }
  return fmtValue(rawValue);
}

async function handleAction(action) {
  if (action === 'cancel') { navigate('#/leads'); return; }
  if (action === 'delete') {
    if (await confirmDialog(`Lead „${working.name || 'ohne Namen'}" löschen?`, 'Löschen')) {
      store.deleteLead(profile.id, working.id);
      toast('Lead gelöscht.');
      navigate('#/leads');
    }
    return;
  }
  if (action === 'save') {
    if (!working.name.trim()) {
      toast('Bitte einen Namen für den Lead angeben.');
      container.querySelector('#lead-name').focus();
      return;
    }
    store.saveLead(working);
    toast('Lead gespeichert.');
    navigate('#/leads');
  }
}
