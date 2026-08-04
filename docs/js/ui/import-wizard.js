// CSV-Import-Assistent (FR-008): Datei → Spaltenzuordnung (Vorbelegung bei
// Namensgleichheit) → Import mit Fehlerbericht und Duplikat-Meldung (contracts/csv-format.md).

import * as store from '../store.js';
import { createLead } from '../core/model.js';
import { parse, parseGermanNumber, parseBooleanWord } from '../core/csv.js';
import { esc, toast, navigate } from '../app.js';

let container = null;
let profile = null;
let parsed = null; // { header, rows, errors, delimiter }

export function render(section) {
  container = section;
  profile = store.getActiveProfile();
  parsed = null;
  if (!profile) {
    container.innerHTML = `
      <div class="empty-state">
        Kein aktives Profil. Bitte zuerst unter <a href="#/profile">Profile</a> ein Profil anlegen und aktivieren.
      </div>`;
    return;
  }
  drawStep1();
}

function drawStep1() {
  container.innerHTML = `
    <div class="view-header"><h1>CSV-Import</h1></div>
    <p class="muted">Profil: <strong>${esc(profile.name)}</strong></p>
    <div class="card">
      <p>Wählen Sie eine CSV-Datei (Semikolon- oder Komma-getrennt, erste Zeile = Spaltennamen).
      Excel-Exporte mit Umlauten werden unterstützt.</p>
      <input type="file" id="csv-file" accept=".csv,.txt,text/csv">
    </div>
  `;
  container.querySelector('#csv-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parsed = parse(await file.text());
    if (parsed.header.length === 0) {
      toast(parsed.errors[0]?.reason || 'Datei konnte nicht gelesen werden.');
      return;
    }
    if (parsed.rows.length === 0) {
      toast('Die Datei enthält keine Datenzeilen (nur eine Kopfzeile).');
      return;
    }
    drawStep2();
  });
}

function autoMapping() {
  const nameHints = ['name', 'lead', 'firma', 'unternehmen', 'kunde'];
  const noteHints = ['notiz', 'note', 'bemerkung', 'kommentar'];
  return parsed.header.map((col) => {
    const key = col.trim().toLowerCase();
    const criterion = profile.criteria.find((c) => c.name.trim().toLowerCase() === key);
    if (criterion) return `criterion:${criterion.id}`;
    if (nameHints.includes(key)) return 'name';
    if (noteHints.includes(key)) return 'note';
    return 'ignore';
  });
}

function drawStep2() {
  const mapping = autoMapping();
  const preview = parsed.rows.slice(0, 5);

  container.innerHTML = `
    <div class="view-header"><h1>CSV-Import — Spalten zuordnen</h1></div>
    <p class="muted">${parsed.rows.length} Datenzeile(n) erkannt (Trennzeichen „${esc(parsed.delimiter)}").
      ${parsed.errors.length > 0 ? `${parsed.errors.length} Zeile(n) mit Formatfehlern werden übersprungen.` : ''}</p>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>CSV-Spalte</th><th>Zuordnung</th><th>Vorschau</th></tr></thead>
        <tbody>
          ${parsed.header.map((col, i) => `
            <tr>
              <td><strong>${esc(col)}</strong></td>
              <td>
                <select data-map="${i}">
                  <option value="ignore" ${mapping[i] === 'ignore' ? 'selected' : ''}>Ignorieren</option>
                  <option value="name" ${mapping[i] === 'name' ? 'selected' : ''}>Lead-Name *</option>
                  <option value="note" ${mapping[i] === 'note' ? 'selected' : ''}>Notiz</option>
                  ${profile.criteria.map((c) => `
                    <option value="criterion:${c.id}" ${mapping[i] === `criterion:${c.id}` ? 'selected' : ''}>Kriterium: ${esc(c.name)}</option>`).join('')}
                </select>
              </td>
              <td class="muted">${preview.map((r) => esc(r[i])).filter(Boolean).slice(0, 3).join(' · ')}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="hint">Genau eine Spalte muss als „Lead-Name" zugeordnet sein. Werte: Auswahllisten über das Options-Label,
      Zahlen mit Komma oder Punkt, Ja/Nein als ja/nein/x/1/0.</p>
      <div class="row-actions">
        <button class="btn" data-action="back">Andere Datei wählen</button>
        <button class="btn btn-primary" data-action="run-import">Importieren</button>
      </div>
    </div>
  `;

  container.querySelector('[data-action="back"]').addEventListener('click', drawStep1);
  container.querySelector('[data-action="run-import"]').addEventListener('click', runImport);
}

function currentMapping() {
  return [...container.querySelectorAll('[data-map]')].map((sel) => sel.value);
}

function convertValue(criterion, cell) {
  const raw = cell.trim();
  if (raw === '') return { empty: true };
  switch (criterion.type) {
    case 'select': {
      const opt = criterion.rules.options.find((o) => o.label.trim().toLowerCase() === raw.toLowerCase());
      return opt ? { value: opt.id } : { error: `„${raw}" ist keine bekannte Option` };
    }
    case 'range': {
      const num = parseGermanNumber(raw);
      return num === null ? { error: `„${raw}" ist keine Zahl` } : { value: num };
    }
    case 'scale': {
      const num = parseGermanNumber(raw);
      if (num === null) return { error: `„${raw}" ist keine Zahl` };
      if (num < criterion.rules.min || num > criterion.rules.max) {
        return { error: `„${raw}" liegt außerhalb der Skala ${criterion.rules.min}–${criterion.rules.max}` };
      }
      return { value: num };
    }
    case 'boolean': {
      const bool = parseBooleanWord(raw);
      return bool === null ? { error: `„${raw}" ist kein Ja/Nein-Wert` } : { value: bool };
    }
    default:
      return { error: 'Unbekannter Kriterientyp' };
  }
}

function runImport() {
  const mapping = currentMapping();
  const nameCount = mapping.filter((m) => m === 'name').length;
  if (nameCount !== 1) {
    toast('Bitte genau eine Spalte als „Lead-Name" zuordnen.');
    return;
  }
  const usedCriteria = mapping.filter((m) => m.startsWith('criterion:'));
  if (new Set(usedCriteria).size !== usedCriteria.length) {
    toast('Jedes Kriterium darf nur einer Spalte zugeordnet sein.');
    return;
  }

  const nameIdx = mapping.indexOf('name');
  const noteIdx = mapping.indexOf('note');
  const existingNames = new Set(store.listLeads(profile.id).map((l) => l.name.trim().toLowerCase()));
  const seenNames = new Set();

  const cellErrors = [...parsed.errors.map((e) => ({ line: e.line, column: '', reason: e.reason }))];
  const duplicates = [];
  let imported = 0;

  parsed.rows.forEach((row, rowIdx) => {
    const line = rowIdx + 2; // 1-basiert inkl. Kopfzeile (Näherung bei mehrzeiligen Feldern)
    const name = row[nameIdx].trim();
    if (!name) {
      cellErrors.push({ line, column: parsed.header[nameIdx], reason: 'Lead-Name fehlt — Zeile übersprungen.' });
      return;
    }
    const key = name.toLowerCase();
    if (existingNames.has(key) || seenNames.has(key)) duplicates.push(name);
    seenNames.add(key);

    const lead = createLead(profile.id);
    lead.name = name;
    lead.source = 'csv';
    if (noteIdx >= 0) lead.note = row[noteIdx].trim();

    mapping.forEach((m, colIdx) => {
      if (!m.startsWith('criterion:')) return;
      const criterion = profile.criteria.find((c) => c.id === m.slice('criterion:'.length));
      if (!criterion) return;
      const res = convertValue(criterion, row[colIdx]);
      if (res.error) {
        cellErrors.push({ line, column: parsed.header[colIdx], reason: `${res.error} — Wert gilt als fehlend.` });
      } else if (!res.empty) {
        lead.values[criterion.id] = res.value;
      }
    });

    store.saveLead(lead);
    imported++;
  });

  drawReport(imported, cellErrors, duplicates);
}

function drawReport(imported, errors, duplicates) {
  container.innerHTML = `
    <div class="view-header"><h1>CSV-Import — Ergebnis</h1></div>
    <div class="notice notice-ok"><strong>${imported}</strong> Lead(s) importiert und bewertet.</div>
    ${duplicates.length > 0 ? `
      <div class="notice notice-warn">
        <strong>${duplicates.length} mögliche(s) Duplikat(e)</strong> (gleicher Name, trotzdem importiert):
        ${duplicates.slice(0, 10).map(esc).join(', ')}${duplicates.length > 10 ? ' …' : ''}
      </div>` : ''}
    ${errors.length > 0 ? `
      <div class="notice notice-error">
        <strong>${errors.length} Hinweis(e):</strong>
        <ul>${errors.slice(0, 20).map((e) => `<li>Zeile ${e.line}${e.column ? `, Spalte „${esc(e.column)}"` : ''}: ${esc(e.reason)}</li>`).join('')}</ul>
        ${errors.length > 20 ? `<p>… und ${errors.length - 20} weitere.</p>` : ''}
      </div>` : ''}
    <div class="row-actions">
      <button class="btn btn-primary" data-action="to-list">Zur Rangliste</button>
      <button class="btn" data-action="again">Weitere Datei importieren</button>
    </div>
  `;
  container.querySelector('[data-action="to-list"]').addEventListener('click', () => navigate('#/leads'));
  container.querySelector('[data-action="again"]').addEventListener('click', drawStep1);
}
