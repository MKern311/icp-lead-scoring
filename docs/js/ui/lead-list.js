// Rangliste: alle Leads des aktiven Profils, live bewertet (nie gespeichert, FR-011),
// Sortierung/Filter (FR-009) und CSV-Export für deutsches Excel (contracts/csv-format.md).

import * as store from '../store.js';
import { evaluate } from '../core/scoring.js';
import { serialize } from '../core/csv.js';
import { esc, toast, navigate, download, slugify, fmtScore, fmtValue } from '../app.js';
import { tierBadge } from './lead-form.js';

let container = null;
let profile = null;
let sortBy = 'score';
let filterBy = 'all';

export function render(section) {
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
  draw();
}

function evaluatedLeads() {
  return store.listLeads(profile.id).map((lead) => ({ lead, result: evaluate(profile, lead) }));
}

function applyFilter(items) {
  switch (filterBy) {
    case 'all': return items;
    case 'disqualified': return items.filter((x) => x.result.status === 'disqualified');
    case 'not-evaluable': return items.filter((x) => x.result.status === 'not-evaluable');
    case 'incomplete': return items.filter((x) => !x.result.complete);
    default: return items.filter((x) => x.result.tierId === filterBy);
  }
}

function applySort(items) {
  if (sortBy === 'name') return items.sort((a, b) => a.lead.name.localeCompare(b.lead.name, 'de'));
  return items.sort((a, b) => (b.result.total ?? -1) - (a.result.total ?? -1));
}

function statusLabel(result) {
  if (result.status === 'disqualified') return 'disqualifiziert';
  if (result.status === 'not-evaluable') return 'nicht bewertbar';
  return 'bewertet';
}

function draw() {
  const all = evaluatedLeads();
  const items = applySort(applyFilter(all));
  const incompleteCount = all.filter((x) => !x.result.complete).length;

  const tierOptions = [...profile.tiers]
    .sort((a, b) => b.minScore - a.minScore)
    .map((t) => `<option value="${t.id}" ${filterBy === t.id ? 'selected' : ''}>Stufe ${esc(t.label)}</option>`)
    .join('');

  const rows = items.map(({ lead, result }) => `
    <tr class="clickable-row" data-lead="${lead.id}">
      <td><strong>${esc(lead.name)}</strong>${lead.note ? `<div class="muted">${esc(lead.note.slice(0, 60))}${lead.note.length > 60 ? '…' : ''}</div>` : ''}</td>
      <td class="right">${result.total === null ? '–' : fmtScore(result.total)}</td>
      <td>${result.status === 'scored' ? tierBadge(profile, result.tierId) : ''}
          ${result.status === 'disqualified' ? '<span class="badge badge-disqualified">Disqualifiziert</span>' : ''}
          ${result.status === 'not-evaluable' ? '<span class="badge badge-not-evaluable">Nicht bewertbar</span>' : ''}</td>
      <td>${result.complete ? 'ja' : '<span class="badge badge-incomplete">unvollständig</span>'}</td>
      <td class="muted">${lead.source === 'csv' ? 'Import' : lead.source === 'screening' ? 'Screening' : 'manuell'}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="view-header">
      <h1>Rangliste</h1>
      <div class="row-actions">
        <button class="btn" data-action="export" ${all.length === 0 ? 'disabled' : ''}>CSV exportieren</button>
        <button class="btn" data-action="import">CSV importieren</button>
        <button class="btn btn-primary" data-action="new">Neuer Lead</button>
      </div>
    </div>
    <p class="muted">Profil: <strong>${esc(profile.name)}</strong> — ${all.length} Lead(s)${incompleteCount > 0 ? `, davon ${incompleteCount} unvollständig` : ''}</p>
    <div class="inline-fields" style="margin-bottom: var(--space-3)">
      <div class="field">
        <label for="sort-select">Sortierung</label>
        <select id="sort-select">
          <option value="score" ${sortBy === 'score' ? 'selected' : ''}>Punktzahl (absteigend)</option>
          <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name (A–Z)</option>
        </select>
      </div>
      <div class="field">
        <label for="filter-select">Filter</label>
        <select id="filter-select">
          <option value="all" ${filterBy === 'all' ? 'selected' : ''}>Alle</option>
          ${tierOptions}
          <option value="disqualified" ${filterBy === 'disqualified' ? 'selected' : ''}>Disqualifiziert</option>
          <option value="not-evaluable" ${filterBy === 'not-evaluable' ? 'selected' : ''}>Nicht bewertbar</option>
          <option value="incomplete" ${filterBy === 'incomplete' ? 'selected' : ''}>Unvollständig</option>
        </select>
      </div>
    </div>
    ${all.length === 0
      ? '<div class="empty-state">Noch keine Leads. Erfassen Sie einen Lead oder importieren Sie eine CSV-Datei.</div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Lead</th><th class="right">Punktzahl</th><th>Stufe / Status</th><th>Vollständig</th><th>Quelle</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`}
  `;

  container.querySelector('#sort-select').addEventListener('change', (e) => { sortBy = e.target.value; draw(); });
  container.querySelector('#filter-select').addEventListener('change', (e) => { filterBy = e.target.value; draw(); });
  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });
  container.querySelectorAll('[data-lead]').forEach((row) => {
    row.addEventListener('click', () => navigate(`#/lead/${row.dataset.lead}`));
  });
}

function handleAction(action) {
  if (action === 'new') { navigate('#/lead/new'); return; }
  if (action === 'import') { navigate('#/import'); return; }
  if (action === 'export') exportCsv();
}

// Export gemäß contracts/csv-format.md: Rohwerte, Punktzahl (Dezimal-Komma), Stufe, Status.
function exportCsv() {
  const items = applySort(applyFilter(evaluatedLeads()));
  const header = ['Lead', 'Notiz', ...profile.criteria.map((c) => c.name), 'Punktzahl', 'Stufe', 'Status', 'Vollständig'];
  const rows = items.map(({ lead, result }) => {
    const values = profile.criteria.map((c) => {
      const raw = lead.values[c.id];
      if (raw === undefined || raw === null || raw === '') return '';
      if (c.type === 'select') return c.rules.options.find((o) => o.id === raw)?.label || '';
      return fmtValue(raw);
    });
    const tier = result.status === 'scored'
      ? profile.tiers.find((t) => t.id === result.tierId)?.label || ''
      : '';
    return [
      lead.name,
      lead.note || '',
      ...values,
      result.total === null ? '' : fmtScore(result.total),
      tier,
      statusLabel(result),
      result.complete ? 'ja' : 'nein',
    ];
  });
  const today = new Date().toISOString().slice(0, 10);
  download(`leads-bewertet-${slugify(profile.name)}-${today}.csv`, serialize(header, rows), 'text/csv');
  toast(`${rows.length} Lead(s) exportiert.`);
}
