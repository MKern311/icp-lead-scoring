// Profil-Übersicht: anlegen, duplizieren, löschen, aktivieren, Export/Import, Vorlagen,
// Rubrik „Leads ohne Profil" (Spec-Edge-Case Profil-Löschung).

import * as store from '../store.js';
import { createProfile } from '../core/model.js';
import { exportProfile, importProfile } from '../core/profile-io.js';
import { templates } from '../templates.js';
import { esc, toast, confirmDialog, download, slugify, navigate, refreshActiveProfileIndicator } from '../app.js';

let container = null;

export function render(section) {
  container = section;
  draw();
}

function draw() {
  const profiles = store.listProfiles();
  const { activeProfileId } = store.getSettings();
  const orphans = store.orphanedLeadGroups();

  const rows = profiles.map((p) => {
    const leadCount = store.listLeads(p.id).length;
    const isActive = p.id === activeProfileId;
    return `
      <tr>
        <td>
          <strong>${esc(p.name)}</strong>
          ${isActive ? '<span class="badge badge-tier-0">aktiv</span>' : ''}
          ${p.description ? `<div class="muted">${esc(p.description.slice(0, 90))}${p.description.length > 90 ? '…' : ''}</div>` : ''}
        </td>
        <td class="right">${p.criteria.length}</td>
        <td class="right">${leadCount}</td>
        <td>
          <div class="row-actions">
            ${isActive ? '' : `<button class="btn btn-small" data-action="activate" data-id="${p.id}">Aktivieren</button>`}
            <button class="btn btn-small" data-action="edit" data-id="${p.id}">Bearbeiten</button>
            <button class="btn btn-small" data-action="duplicate" data-id="${p.id}">Duplizieren</button>
            <button class="btn btn-small" data-action="export" data-id="${p.id}">Exportieren</button>
            <button class="btn btn-small" data-action="delete" data-id="${p.id}">Löschen</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  const templateButtons = templates.map((t, i) =>
    `<button class="btn btn-small" data-action="from-template" data-index="${i}">${esc(t.profile.name.replace('Vorlage: ', ''))}</button>`
  ).join(' ');

  const orphanSection = orphans.length === 0 ? '' : `
    <div class="card">
      <h2>Leads ohne Profil</h2>
      <p class="muted">Diese Leads gehörten zu gelöschten Profilen. Sie können sie einem Profil neu zuordnen
      (übernimmt nur Name und Notiz, Kriterienwerte werden zurückgesetzt) oder löschen.</p>
      ${orphans.map((g) => `
        <div class="inline-fields" style="margin-bottom: var(--space-2)">
          <span>${g.leads.length} Lead(s) aus gelöschtem Profil</span>
          <select data-orphan-select="${esc(g.profileId)}">
            <option value="">Profil wählen …</option>
            ${profiles.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
          </select>
          <button class="btn btn-small" data-action="reassign" data-id="${esc(g.profileId)}">Zuordnen</button>
          <button class="btn btn-small" data-action="delete-orphans" data-id="${esc(g.profileId)}">Löschen</button>
        </div>`).join('')}
    </div>`;

  container.innerHTML = `
    <div class="view-header">
      <h1>ICP-Profile</h1>
      <div class="row-actions">
        <button class="btn btn-primary" data-action="new">Neues Profil</button>
        <button class="btn" data-action="import">Profil importieren</button>
      </div>
    </div>
    <div class="card">
      <h3>Aus Vorlage erstellen</h3>
      <p class="muted">Vorlagen sind Startpunkte — nach dem Erstellen frei anpassbar.</p>
      ${templateButtons}
    </div>
    ${profiles.length === 0
      ? '<div class="empty-state">Noch keine Profile. Legen Sie ein neues Profil an oder starten Sie mit einer Vorlage.</div>'
      : `<div class="table-wrap"><table>
          <thead><tr><th>Profil</th><th class="right">Kriterien</th><th class="right">Leads</th><th>Aktionen</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`}
    ${orphanSection}
    <input type="file" accept=".json,application/json" id="profile-import-file" hidden>
  `;

  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset));
  });
  container.querySelector('#profile-import-file').addEventListener('change', handleImportFile);
}

async function handleAction(action, dataset) {
  const id = dataset.id;
  switch (action) {
    case 'new': {
      const profile = createProfile('');
      sessionStorage.setItem('icp.newProfile', JSON.stringify(profile));
      navigate(`#/profil/new`);
      break;
    }
    case 'from-template': {
      const template = templates[Number(dataset.index)];
      const { profile, errors } = importProfile(template);
      if (errors.length) { toast('Vorlage konnte nicht geladen werden.'); return; }
      profile.name = store.uniqueProfileName(profile.name.replace('Vorlage: ', ''));
      store.saveProfile(profile);
      toast(`Profil „${profile.name}" aus Vorlage erstellt.`);
      navigate(`#/profil/${profile.id}`);
      break;
    }
    case 'activate':
      store.setActiveProfile(id);
      refreshActiveProfileIndicator();
      draw();
      break;
    case 'edit':
      navigate(`#/profil/${id}`);
      break;
    case 'duplicate': {
      const copy = store.duplicateProfile(id);
      if (copy) { toast(`Profil „${copy.name}" angelegt.`); draw(); }
      break;
    }
    case 'export': {
      const profile = store.getProfile(id);
      if (!profile) return;
      download(`icp-profil-${slugify(profile.name)}-v1.json`, JSON.stringify(exportProfile(profile), null, 2), 'application/json');
      toast('Profil exportiert — die Datei kann von anderen Nutzern importiert werden.');
      break;
    }
    case 'delete': {
      const profile = store.getProfile(id);
      const leadCount = store.listLeads(id).length;
      const message = leadCount > 0
        ? `Profil „${profile.name}" wirklich löschen? ${leadCount} zugehörige Lead(s) bleiben erhalten, verlieren aber ihre Bewertungsgrundlage.`
        : `Profil „${profile.name}" wirklich löschen?`;
      if (await confirmDialog(message, 'Löschen')) {
        store.deleteProfile(id);
        refreshActiveProfileIndicator();
        toast('Profil gelöscht.');
        draw();
      }
      break;
    }
    case 'reassign': {
      const select = container.querySelector(`[data-orphan-select="${CSS.escape(id)}"]`);
      const targetId = select?.value;
      if (!targetId) { toast('Bitte zuerst ein Ziel-Profil wählen.'); return; }
      const count = store.reassignLeads(id, targetId);
      toast(`${count} Lead(s) neu zugeordnet — Kriterienwerte wurden zurückgesetzt.`);
      draw();
      break;
    }
    case 'delete-orphans': {
      if (await confirmDialog('Diese Leads endgültig löschen?', 'Löschen')) {
        store.deleteAllLeads(id);
        toast('Leads gelöscht.');
        draw();
      }
      break;
    }
    case 'import':
      container.querySelector('#profile-import-file').click();
      break;
  }
}

async function handleImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Die Datei ist kein gültiges JSON.');
    return;
  }
  const { profile, errors } = importProfile(data);
  if (!profile) {
    toast(`Import abgelehnt: ${errors[0]}`);
    return;
  }
  profile.name = store.uniqueProfileName(profile.name);
  store.saveProfile(profile);
  toast(`Profil „${profile.name}" importiert.`);
  draw();
}
