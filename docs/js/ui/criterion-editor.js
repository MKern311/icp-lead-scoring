// Bausteine zum Bearbeiten eines Kriteriums (Feature 007) — genutzt vom
// Screening-Workflow (Schritt 1), damit Kriterien dort angepasst werden können,
// wo man sie beurteilt. Der Profil-Editor hat historisch eine eigene, gleichwertige
// Bindung (`data-bind`); beide folgen denselben Regeln aus `core/model.js`. Wer
// hier etwas ändert, prüft `ui/profile-editor.js` mit.
//
// Aufbau: `criterionEditorHtml(c)` liefert die Felder; Änderungen laufen über
// `applyCriterionEdit(c, el)` und Schaltflächen über `handleCriterionAction(c, …)`.
// Beide melden zurück, ob die Ansicht neu gezeichnet werden muss.

import { uuid } from '../core/model.js';
import { esc } from '../app.js';

export const TYPE_LABELS = {
  select: 'Auswahl', range: 'Zahlenbereich', boolean: 'Ja/Nein', scale: 'Skala',
};

// Punktregeln je Typ — die Werte bleiben lokal und werden nie übertragen.
export function rulesEditorHtml(c) {
  switch (c.type) {
    case 'select':
      return `
        <h4>Ausprägungen &amp; Punkte (0–100)</h4>
        ${c.rules.options.map((o) => `
          <div class="inline-fields" style="margin-bottom: var(--space-1)">
            <div class="field"><input type="text" maxlength="80" data-cedit="opt:${o.id}:label" value="${esc(o.label)}" aria-label="Bezeichnung der Ausprägung"></div>
            <div class="field" style="max-width:7rem"><input type="number" min="0" max="100" step="1" data-cedit="opt:${o.id}:points" value="${esc(o.points)}" aria-label="Punkte"></div>
            <button class="btn btn-small" data-cedit-action="remove-option" data-oid="${o.id}" ${c.rules.options.length <= 2 ? 'disabled title="Mindestens zwei Ausprägungen"' : ''}>Entfernen</button>
          </div>`).join('')}
        <button class="btn btn-small" data-cedit-action="add-option">+ Ausprägung</button>`;
    case 'range':
      return `
        <h4>Bereiche &amp; Punkte (0–100, Grenzen inklusive)</h4>
        ${c.rules.ranges.map((r, i) => `
          <div class="inline-fields" style="margin-bottom: var(--space-1)">
            <div class="field"><label>von</label><input type="number" step="any" data-cedit="rg:${i}:min" value="${esc(r.min)}"></div>
            <div class="field"><label>bis</label><input type="number" step="any" data-cedit="rg:${i}:max" value="${esc(r.max)}"></div>
            <div class="field"><label>Punkte</label><input type="number" min="0" max="100" step="1" data-cedit="rg:${i}:points" value="${esc(r.points)}"></div>
            <button class="btn btn-small" data-cedit-action="remove-range" data-index="${i}" ${c.rules.ranges.length <= 1 ? 'disabled title="Mindestens ein Bereich"' : ''}>Entfernen</button>
          </div>`).join('')}
        <button class="btn btn-small" data-cedit-action="add-range">+ Bereich</button>
        <div class="hint">Werte außerhalb aller Bereiche erhalten 0 Punkte und werden gekennzeichnet.</div>`;
    case 'boolean':
      return `
        <div class="inline-fields">
          <div class="field"><label>Punkte bei Ja</label><input type="number" min="0" max="100" step="1" data-cedit="yes" value="${esc(c.rules.pointsYes)}"></div>
          <div class="field"><label>Punkte bei Nein</label><input type="number" min="0" max="100" step="1" data-cedit="no" value="${esc(c.rules.pointsNo)}"></div>
        </div>`;
    case 'scale':
      return `
        <div class="inline-fields">
          <div class="field"><label>Skala von</label><input type="number" step="1" data-cedit="min" value="${esc(c.rules.min)}"></div>
          <div class="field"><label>bis</label><input type="number" step="1" data-cedit="max" value="${esc(c.rules.max)}"></div>
        </div>
        <div class="hint">Der Skalenwert wird linear auf 0–100 Punkte abgebildet.</div>`;
    default:
      return '';
  }
}

// Vollständiger Editor eines Kriteriums (ohne Phasen-Wahl — die sitzt im Workflow
// bereits in der Kopfzeile und wird dort mit `includeStage: false` ausgelassen).
export function criterionEditorHtml(c, { includeStage = true } = {}) {
  return `
    <div class="criterion-editor" data-cedit-for="${c.id}">
      <div class="inline-fields">
        <div class="field grow"><label>Name *</label>
          <input type="text" maxlength="80" data-cedit="name" value="${esc(c.name)}"></div>
        <div class="field" style="max-width:7rem"><label>Gewicht %</label>
          <input type="number" min="0" max="100" step="0.1" data-cedit="weight" value="${esc(c.weight)}"></div>
        ${includeStage ? `
        <div class="field" style="max-width:15rem"><label>Screening-Phase</label>
          <select data-cedit="stage">
            <option value="prescreening" ${c.stage === 'prescreening' ? 'selected' : ''}>Pre-Screening</option>
            <option value="qualification" ${c.stage !== 'prescreening' ? 'selected' : ''}>Qualifizierung</option>
          </select></div>` : ''}
      </div>
      <div class="field"><label>Beschreibung</label>
        <input type="text" maxlength="500" data-cedit="description" value="${esc(c.description || '')}"
          placeholder="Was wird hier bewertet? Bei der Recherche hilft eine genaue Beschreibung."></div>
      <label style="display:inline-flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-3)">
        <input type="checkbox" data-cedit="knockout" ${c.knockout ? 'checked' : ''}> K.-o.-Kriterium
      </label>
      ${c.knockout ? '<div class="hint" style="margin-bottom:var(--space-3)">Erreicht ein Lead hier weniger als 1 Punkt, ist er disqualifiziert — unabhängig von der Gesamtpunktzahl.</div>' : ''}
      ${rulesEditorHtml(c)}
    </div>`;
}

const num = (el) => {
  const v = Number(el.value);
  return Number.isFinite(v) && el.value !== '' ? v : null;
};

// Übernimmt eine Feldänderung ins Kriterium. Rückgabe: true, wenn neu gezeichnet
// werden muss (Struktur- oder Sichtbarkeitsänderung).
export function applyCriterionEdit(c, el) {
  const parts = String(el.dataset.cedit || '').split(':');
  const key = parts[0];
  switch (key) {
    case 'name': c.name = el.value; return false;
    case 'description': c.description = el.value; return false;
    case 'searchHint': c.searchHint = el.value.slice(0, 200); return false;
    case 'stage': c.stage = el.value; return true;
    case 'knockout': c.knockout = el.checked; return true;
    case 'weight': { const v = num(el); if (v !== null) c.weight = v; return false; }
    case 'opt': {
      const opt = c.rules.options.find((o) => o.id === parts[1]);
      if (!opt) return false;
      if (parts[2] === 'label') {
        opt.label = el.value;
        return true;   // Suchauswahl zeigt Labels — neu zeichnen
      }
      const v = num(el);
      if (v !== null) opt.points = v;
      return false;
    }
    case 'rg': {
      const rg = c.rules.ranges[Number(parts[1])];
      if (!rg) return false;
      const v = num(el);
      if (v !== null) rg[parts[2]] = v;
      return false;
    }
    case 'yes': { const v = num(el); if (v !== null) c.rules.pointsYes = v; return false; }
    case 'no': { const v = num(el); if (v !== null) c.rules.pointsNo = v; return false; }
    case 'min': { const v = num(el); if (v !== null) c.rules.min = v; return false; }
    case 'max': { const v = num(el); if (v !== null) c.rules.max = v; return false; }
    default: return false;
  }
}

// Schaltflächen des Editors. Rückgabe: true, wenn behandelt (dann neu zeichnen).
export function handleCriterionAction(c, action, dataset = {}) {
  if (action === 'add-option' && c.type === 'select') {
    if (c.rules.options.length >= 20) return false;
    c.rules.options.push({ id: uuid(), label: 'Neue Ausprägung', points: 50 });
    return true;
  }
  if (action === 'remove-option' && c.type === 'select') {
    if (c.rules.options.length <= 2) return false;
    const id = dataset.oid;
    c.rules.options = c.rules.options.filter((o) => o.id !== id);
    // Suchauswahl mitziehen — sie darf nie auf eine gelöschte Ausprägung zeigen
    if (Array.isArray(c.searchTargets)) c.searchTargets = c.searchTargets.filter((t) => t !== id);
    return true;
  }
  if (action === 'add-range' && c.type === 'range') {
    if (c.rules.ranges.length >= 20) return false;
    const last = c.rules.ranges[c.rules.ranges.length - 1];
    const min = last ? last.max + 1 : 0;
    c.rules.ranges.push({ min, max: min + 9, points: 50 });
    return true;
  }
  if (action === 'remove-range' && c.type === 'range') {
    if (c.rules.ranges.length <= 1) return false;
    c.rules.ranges.splice(Number(dataset.index), 1);
    return true;
  }
  return false;
}

// Hängt die Ereignisbehandlung an einen gerenderten Editor. `onChange(needsRedraw)`
// wird nach jeder Änderung gerufen — der Aufrufer speichert und zeichnet.
export function bindCriterionEditor(root, criterion, onChange) {
  root.querySelectorAll('[data-cedit]').forEach((el) => {
    const evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => onChange(applyCriterionEdit(criterion, el)));
    if (evt === 'input') el.addEventListener('change', () => onChange(false));
  });
  root.querySelectorAll('[data-cedit-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (handleCriterionAction(criterion, btn.dataset.ceditAction, btn.dataset)) onChange(true);
    });
  });
}
