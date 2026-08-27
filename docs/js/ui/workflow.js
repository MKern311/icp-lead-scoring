// Geführter Screening-Workflow (Features 003 + 004, contracts/workflow.md +
// contracts/deep-screening.md): Schritt 1 Phasen-Zuordnung mit Katalog,
// Schritt 2 Longlist (Klassen-Filter), Schritt 3 Tiefen-Screening je Unternehmen
// (Konfidenz + Belegdatum, abbrechbar), Schritt 4 Qualifizierung Lead für Lead.
// Der Workflow-Zustand ist flüchtig — persistiert wird nur über Profil, Leads und
// API-Schlüssel (FR-010). Tiefen-Screening nie für gespeicherte Leads (Verfassung III).

import * as store from '../store.js';
import { evaluate } from '../core/scoring.js';
import { criterionFromCatalog, profileCatalogFindings, weightSum, normalizeWeights } from '../core/model.js';
import { criterionCatalog, retiredCriterionNames } from '../templates.js';
import {
  prescreeningCriteria, longlistCriteria,
  buildLonglistRequest, buildDeepScreeningRequest,
  parseCandidates, parseDeepResult, mergeDeepIntoCandidate, candidateToLead,
  qualificationQueue, estimateDeepCost, usageCost, addUsage, isEvidenceStale, todayIso,
  COST_ESTIMATES, PRICING, DEEP_CONCURRENCY, EVIDENCE_MAX_AGE_MONTHS,
} from '../core/screening.js';
import { runScreening } from '../screening-api.js';
import { esc, toast, confirmDialog, navigate, fmtScore, fmtValue, setLeaveGuard } from '../app.js';
import { tierBadge } from './lead-form.js';
import { criterionEditorHtml, bindCriterionEditor, scoreRangeHtml, scoreScaleLabel, TYPE_LABELS } from './criterion-editor.js';

let container = null;
let profile = null;
let step = 1;
let confirmed = new Set();                       // in dieser Sitzung aktiv bestätigte Kriterien
let keptFindings = new Set();                    // „Behalten"-Entscheidungen der Aufräum-Box (flüchtig)
let editing = new Set();                         // aufgeklappte Kriterien-Editoren (Schritt 1)
let params = { region: 'DACH', count: 20, hints: '' };
let running = false;                             // Longlist-Lauf aktiv
let result = null;                               // Longlist-Ergebnis { candidates, warnings, region, selected }
let deepRun = null;                              // { entries, running, controllers } — flüchtig
let costLog = null;                              // { usage, runs } — tatsächliche Kosten dieser Sitzung
let today = todayIso();
let queue = [];                                  // Schritt-4-Warteschlange (Lead-IDs)
let position = 0;
let processed = new Set();
let skipped = new Set();
let drafts = new Map();
let finished = false;

export function render(section) {
  container = section;
  profile = store.getActiveProfile();
  if (!running && !deepRun?.running) {
    // Neueinstieg setzt die Führung zurück — gespeicherte Daten bleiben maßgeblich (FR-010)
    step = 1;
    confirmed = new Set();
    keptFindings = new Set();
    editing = new Set();
    result = null;
    deepRun = null;
    costLog = null;
    today = todayIso();
    queue = [];
    position = 0;
    processed = new Set();
    skipped = new Set();
    drafts = new Map();
    finished = false;
    // Suchparameter des Profils weiterverwenden (reine Bequemlichkeit, FR-411)
    if (profile) params = store.getWorkflowParams(profile.id) || { region: 'DACH', count: 20, hints: '' };
  }
  setLeaveGuard(unsavedWarning);
  draw();
}

// Schutz vor Verlust bezahlter Recherche (FR-410): laufender Lauf oder Ergebnisse,
// die noch nicht als Leads übernommen wurden.
function unsavedWarning() {
  if (running || deepRun?.running) {
    return 'Es läuft gerade eine Recherche. Wenn Sie die Ansicht verlassen, geht der Lauf verloren — trotzdem fortfahren?';
  }
  const deepDone = deepRun?.entries.filter((e) => e.status === 'done').length || 0;
  const longlist = result?.candidates.length || 0;
  if (deepDone > 0) {
    return `${deepDone} tief geprüfte(s) Unternehmen wurde(n) noch nicht übernommen und geht/gehen beim Verlassen verloren — trotzdem fortfahren?`;
  }
  if (longlist > 0) {
    return `${longlist} recherchierte Kandidaten wurden noch nicht übernommen und gehen beim Verlassen verloren — trotzdem fortfahren?`;
  }
  return null;
}

// Profil bei jedem Schrittwechsel neu lesen (Edge Case: Änderung in anderem Tab)
function goToStep(n) {
  profile = store.getActiveProfile();
  step = n;
  finished = false;
  draw();
}

function stepsIndicator() {
  const labels = ['Kriterien', 'Kandidaten finden', 'Tiefen-Screening', 'Qualifizierung'];
  return `<div class="workflow-steps">${labels.map((label, i) => `
    <span class="step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}">
      <span class="num">${step > i + 1 ? '✓' : i + 1}</span> ${label}
    </span>${i < labels.length - 1 ? '<span class="sep">→</span>' : ''}`).join('')}
  </div>`;
}

// --- Kosten: Schätzung vorab, tatsächlicher Verbrauch danach (FR-412) ---

function fmtUsd(value) {
  if (value > 0 && value < 0.01) return 'unter 0,01 $';
  return `${value.toFixed(2).replace('.', ',')} $`;
}

const fmtAmount = (v) => v.toFixed(2).replace('.', ',');

function trackCost(usage) {
  costLog = { usage: addUsage(costLog?.usage, usage), runs: (costLog?.runs || 0) + 1 };
}

function costSummaryHtml() {
  if (!costLog) return '';
  const c = usageCost(costLog.usage);
  const runs = costLog.runs === 1 ? '1 Lauf' : `${costLog.runs} Läufe`;
  return `<p class="muted">Tatsächlich verbraucht in dieser Sitzung: <strong>${fmtUsd(c.total)}</strong>
    (${runs}, ${c.searches} Websuchen) — Listenpreis ohne Steuern, maßgeblich ist Ihre Abrechnung.</p>`;
}

function staleBadge(evidenceDate) {
  return isEvidenceStale(evidenceDate, today)
    ? ` <span class="badge badge-stale" title="Beleg älter als ${EVIDENCE_MAX_AGE_MONTHS} Monate">Beleg veraltet</span>` : '';
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
  else if (step === 3) drawStep3(body);
  else drawStep4(body);
}


// Gewichtssumme (Feature 007): Nach dem Entfernen oder Anpassen von Kriterien
// stimmt sie oft nicht mehr — die Bewertung normiert zwar automatisch, aber der
// Hinweis macht die Verschiebung sichtbar.
function weightHintHtml() {
  const sum = weightSum(profile);
  if (Math.abs(sum - 100) < 0.001) {
    return `<span class="muted">Gewichtssumme: <strong>100 %</strong></span>`;
  }
  return `<span class="muted">Gewichtssumme: <strong class="weight-sum off">${esc(fmtValue(sum))} %</strong>
    — die Bewertung normiert automatisch.</span>
    <button class="btn btn-small" data-action="normalize">Auf 100 % normieren</button>`;
}

function updateHeaderHints(body) {
  const rangeEl = body.querySelector('#wf-score-range');
  if (rangeEl) rangeEl.innerHTML = scoreRangeHtml(profile);

  const el = body.querySelector('#wf-weight-hint');
  if (!el) return;
  el.innerHTML = weightHintHtml();
  el.querySelector('[data-action="normalize"]')?.addEventListener('click', () => {
    normalizeWeights(profile);
    store.saveProfile(profile);
    readParams(body);
    toast('Gewichte auf 100 % normiert.');
    draw();
  });
}

// --- Schritt 1: Phasen-Zuordnung + kategorisierter Katalog (W2, FR-014/015/016) ---

function drawStep1(body) {
  const resume = qualificationQueue(profile, store.listLeads(profile.id));
  const open = profile.criteria.filter((c) => !confirmed.has(c.id));
  const pre = prescreeningCriteria(profile);
  const longlist = longlistCriteria(profile);
  const allConfirmed = open.length === 0;

  const resumeBlock = resume.length > 0 && !finished ? `
    <div class="notice notice-warn">
      ${resume.length} gespeicherte Screening-Lead(s) haben noch offene Qualifizierungskriterien.
      <button class="btn btn-small" data-action="resume">Direkt mit der Qualifizierung fortfahren</button>
    </div>` : '';

  const criterionRow = (c) => {
    const isConfirmed = confirmed.has(c.id);
    // Suchpräferenz (FR-016): Auswahl-Kriterien per Klick aus den Ausprägungen.
    // Freitext nur bei Zahlenbereichen und bei Kriterien mit hintLabel (z. B.
    // gesuchte Stellentitel); übrige Signale/Skalen brauchen keine Präferenz.
    let hintField = '';
    if (c.stage === 'prescreening' && c.type === 'select') {
      hintField = `
      <div class="field grow">
        <label>Bevorzugt suchen nach (Mehrfachauswahl — wirkt als harter Filter der Kandidatensuche)</label>
        <div class="target-picker">
          ${c.rules.options.map((o) => `<label><input type="checkbox" data-target="${c.id}:${o.id}" ${(c.searchTargets || []).includes(o.id) ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}
        </div>
        <div class="hint">Ohne Auswahl wird ohne Filter gesucht; bewertet werden immer alle Ausprägungen.</div>
      </div>`;
    } else if (c.stage === 'prescreening' && (c.type === 'range' || (c.hintLabel || '').trim())) {
      const labeled = (c.hintLabel || '').trim();
      hintField = `
      <div class="field grow">
        <label>${esc(labeled || 'Suchhinweis (optional)')}</label>
        <input type="text" maxlength="200" data-hint="${c.id}" value="${esc(c.searchHint || '')}"
          placeholder="${labeled
            ? 'z. B. Vertriebsleiter, SAP-Berater, Marketing Manager — mehrere durch Komma trennen'
            : 'Wonach soll gesucht werden? z. B. bevorzugt 50–250 Mitarbeiter'}">
      </div>`;
    }
    const isEditing = editing.has(c.id);
    return `
      <div class="card criterion-card ${isConfirmed ? '' : 'unconfirmed'}">
        <div class="criterion-head">
          <div class="field grow">
            <label>${esc(c.name)}
              <span class="badge badge-type">${esc(TYPE_LABELS[c.type] || c.type)}</span>
              <span class="muted" style="font-weight:400">${esc(fmtValue(c.weight))} %</span>
              ${c.knockout ? '<span class="badge badge-knockout">K.o.</span>' : ''}</label>
            ${c.description ? `<div class="hint">${esc(c.description)}</div>` : ''}
          </div>
          <div class="field" style="max-width:15rem"><label>Screening-Phase</label>
            <select data-stage="${c.id}">
              <option value="prescreening" ${c.stage === 'prescreening' ? 'selected' : ''}>Pre-Screening (online recherchierbar)</option>
              <option value="qualification" ${c.stage !== 'prescreening' ? 'selected' : ''}>Qualifizierung (2. Screening)</option>
            </select></div>
          <div class="row-actions">
            <button class="btn btn-small" data-edit="${c.id}">${isEditing ? 'Fertig' : 'Anpassen'}</button>
            <button class="btn btn-small btn-danger" data-drop="${c.id}">Entfernen</button>
            ${isConfirmed
              ? '<span class="badge badge-tier-0">✓ bestätigt</span>'
              : `<button class="btn btn-small" data-confirm="${c.id}">Bestätigen</button>`}
          </div>
        </div>
        ${isEditing ? `<div class="criterion-edit-box">${criterionEditorHtml(c, { includeStage: false })}</div>` : ''}
        ${hintField}
      </div>`;
  };

  // Aufräum-Box: Kriterien aus älteren Katalog-Versionen (umbenannt/zusammengeführt/
  // entfernt) und Dubletten — nichts wird automatisch gelöscht, jede Aktion ist ein Klick.
  const existingNames = new Set(profile.criteria.map((c) => c.name.trim().toLowerCase()));
  const findings = profileCatalogFindings(profile, criterionCatalog, retiredCriterionNames)
    .filter((f) => !keptFindings.has(`${f.criterionId}:${f.kind}`));
  const cleanupBlock = findings.length > 0 ? `
    <div class="card">
      <h3>Aufräumen empfohlen: ${findings.length} ${findings.length === 1 ? 'Kriterium stammt' : 'Kriterien stammen'} aus einer älteren Katalog-Version</h3>
      <p class="muted">Der Katalog wurde überarbeitet (EU-Klassen, zusammengeführte Signale).
      Nichts wird automatisch gelöscht — „Ersetzen" übernimmt den Nachfolger mit Gewicht
      und K.o.-Status, „Behalten" lässt das Kriterium unverändert.</p>
      ${findings.map((f) => {
        // Bei type-mismatch ist der „Nachfolger" der gleichnamige Katalog-Eintrag —
        // ersetzen heißt hier: denselben Namen mit festen Klassen übernehmen.
        const isTypeFix = f.kind === 'type-mismatch';
        const successorInProfile = !isTypeFix && f.successor && existingNames.has(f.successor.trim().toLowerCase());
        const text = f.kind === 'duplicate' ? 'Doppelt im Profil vorhanden.'
          : f.kind === 'retired' ? 'Im überarbeiteten Katalog nicht mehr enthalten.'
          : isTypeFix ? 'Liegt als Freitext-/Zahlenfeld vor, im Katalog als Auswahlfeld mit festen Klassen. Nur Auswahlfelder wirken als Filter der Kandidatensuche (Schritt 2).'
          : successorInProfile ? `Ersetzt durch „${esc(f.successor)}" — der Nachfolger ist bereits im Profil.`
          : `Ersetzt durch „${esc(f.successor)}".`;
        return `
        <div class="criterion-head" style="margin-bottom: var(--space-2)">
          <div class="field grow"><label>${esc(f.name)}</label><div class="hint">${text}</div></div>
          <div class="row-actions">
            ${(f.kind === 'replaced' && !successorInProfile) || isTypeFix
              ? `<button class="btn btn-small btn-primary" data-fix-replace="${f.criterionId}">${isTypeFix ? 'In Klassen umstellen' : 'Ersetzen'}</button>` : ''}
            <button class="btn btn-small" data-fix-remove="${f.criterionId}">Entfernen</button>
            <button class="btn btn-small" data-fix-keep="${f.criterionId}:${f.kind}">Behalten</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : '';

  // Gruppierung (FR-015): Pre-Screening-Kriterien nach Katalog-Kategorien geordnet
  // (Zuordnung über Katalog-Namen inkl. früherer Namen), dann Katalog, dann Qualifizierung.
  const qual = profile.criteria.filter((c) => c.stage !== 'prescreening');
  const suggestions = criterionCatalog
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => !existingNames.has(entry.name.trim().toLowerCase()));

  const categoryOf = new Map();
  for (const entry of criterionCatalog) {
    categoryOf.set(entry.name.trim().toLowerCase(), entry.category);
    for (const old of entry.replaces || []) categoryOf.set(old.trim().toLowerCase(), entry.category);
  }
  const categories = [...new Set(criterionCatalog.map((e) => e.category))];
  const preGroups = [
    ...categories.map((cat) => ({
      title: cat,
      items: pre.filter((c) => categoryOf.get(c.name.trim().toLowerCase()) === cat),
    })),
    { title: 'Weitere Kriterien', items: pre.filter((c) => !categoryOf.has(c.name.trim().toLowerCase())) },
  ].filter((g) => g.items.length > 0);
  const preBlock = pre.length > 0
    ? preGroups.map((g) => `<h4 class="catalog-category">${esc(g.title)}</h4>${g.items.map(criterionRow).join('')}`).join('')
    : '<p class="muted">Noch keine Pre-Screening-Kriterien — übernehmen Sie Vorschläge aus dem Katalog oder stellen Sie unten die Phase um.</p>';

  const catalogBlock = suggestions.length > 0 ? `
    <div class="card">
      <h3>Vorschläge: das kann online recherchiert werden</h3>
      <p class="muted">Per Klick als Pre-Screening-Kriterium übernehmen — Gewichte und
      Punktregeln passen Sie danach im Profil-Editor an. „Beleg" nennt die Quellen, mit
      denen die Recherche den Wert nachweist.</p>
      ${categories.map((cat) => {
        const items = suggestions.filter(({ entry }) => entry.category === cat);
        if (items.length === 0) return '';
        return `<h4 class="catalog-category">${esc(cat)}</h4>
          ${items.map(({ entry, idx }) => `
          <div class="criterion-head" style="margin-bottom: var(--space-2)">
            <div class="field grow">
              <label>${esc(entry.name)}</label>
              <div class="hint">${esc(entry.description)} · Beleg: ${esc(entry.evidence)}</div>
              ${entry.type === 'select' ? `
              <details class="class-details">
                <summary>${entry.rules.options.length} Klassen anzeigen</summary>
                <div class="hint">${entry.rules.options.map((o) => esc(o.label)).join(' · ')}</div>
              </details>` : ''}
            </div>
            <button class="btn btn-small" data-add-catalog="${idx}">+ Übernehmen</button>
          </div>`).join('')}`;
      }).join('')}
    </div>` : '';

  body.innerHTML = `
    ${resumeBlock}
    <div class="card">
      <h2>Schritt 1: Kriterien den Phasen zuordnen</h2>
      <p class="muted">Bestätigen Sie für jedes Kriterium, ob es online recherchierbar ist
      (Pre-Screening) oder erst im Kundenkontakt bewertbar (Qualifizierung — 2. Screening).
      Zuordnungen werden sofort im Profil gespeichert. Übertragen werden nur
      Pre-Screening-Kriterien und Ihre Suchauswahl — niemals Gewichte oder Punktwerte.</p>
      ${open.length > 0
        ? `<div class="notice notice-warn">Noch ${open.length} von ${profile.criteria.length} Kriterien unbestätigt.
             <button class="btn btn-small" data-action="confirm-all">Alle ${open.length} bestätigen</button></div>`
        : '<div class="notice notice-ok">Alle Kriterien bestätigt.</div>'}
      <div class="row-actions" id="wf-weight-hint">${weightHintHtml()}</div>
      <div id="wf-score-range">${scoreRangeHtml(profile)}</div>
      <p class="hint">Über „Anpassen" ändern Sie Name, Beschreibung, Gewicht, K.-o.-Status und die
      Ausprägungen samt Punkten — dieselben Regeln wie im Profil-Editor, nur ohne den Umweg.</p>
    </div>
    ${cleanupBlock}
    <h2>Online recherchierbar — Pre-Screening (${pre.length})</h2>
    ${preBlock}
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
      ${allConfirmed && longlist.length === 0
        ? '<div class="notice notice-warn">Kein Auswahl-Kriterium im Pre-Screening — die Kandidatensuche braucht Klassen-Filter (z. B. Branche oder Unternehmensgröße aus dem Katalog). Eigene Unternehmen können Sie trotzdem direkt im Tiefen-Screening prüfen.</div>' : ''}
      <div class="row-actions">
        <button class="btn btn-primary" data-action="to-step-2" ${allConfirmed && longlist.length > 0 ? '' : 'disabled'}>
          Weiter zu Schritt 2: Kandidaten finden
        </button>
        <button class="btn" data-action="to-step-3" ${allConfirmed && pre.length > 0 ? '' : 'disabled'}>
          Direkt zu Schritt 3: eigene Unternehmen prüfen
        </button>
      </div>
    </div>
  `;

  body.querySelectorAll('[data-stage]').forEach((el) => {
    el.addEventListener('change', () => {
      const c = profile.criteria.find((x) => x.id === el.dataset.stage);
      if (!c) return;
      c.stage = el.value;             // Suchpräferenzen/-hinweise bleiben beim Phasenwechsel erhalten
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
  // Kriterium anpassen (Feature 007): Editor auf-/zuklappen. Der Zustand liegt in
  // `editing`, damit ein Neuzeichnen den geöffneten Editor nicht schließt.
  body.querySelectorAll('[data-edit]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.edit;
      if (editing.has(id)) editing.delete(id);
      else editing.add(id);
      readParams(body);
      draw();
    });
  });
  body.querySelectorAll('[data-drop]').forEach((el) => {
    el.addEventListener('click', async () => {
      const c = profile.criteria.find((x) => x.id === el.dataset.drop);
      if (!c) return;
      if (profile.criteria.length <= 1) {
        toast('Ein Profil braucht mindestens ein Kriterium.');
        return;
      }
      if (!await confirmDialog(`Kriterium „${c.name}" aus dem Profil entfernen? Bereits erfasste Werte dieses Kriteriums gehen bei den Leads verloren.`, 'Entfernen')) return;
      profile.criteria = profile.criteria.filter((x) => x.id !== c.id);
      confirmed.delete(c.id);
      editing.delete(c.id);
      store.saveProfile(profile);
      toast(`„${c.name}" entfernt. Prüfen Sie die Gewichtung.`);
      draw();
    });
  });
  // Felder des aufgeklappten Editors an das Profil binden
  body.querySelectorAll('.criterion-editor').forEach((root) => {
    const c = profile.criteria.find((x) => x.id === root.dataset.ceditFor);
    if (!c) return;
    bindCriterionEditor(root, c, (needsRedraw) => {
      store.saveProfile(profile);
      confirmed.add(c.id);          // wer anpasst, hat entschieden
      if (needsRedraw) { readParams(body); draw(); }
      else updateHeaderHints(body);
    });
  });
  body.querySelector('[data-action="normalize"]')?.addEventListener('click', () => {
    normalizeWeights(profile);
    store.saveProfile(profile);
    readParams(body);
    toast('Gewichte auf 100 % normiert.');
    draw();
  });
  body.querySelector('[data-action="confirm-all"]')?.addEventListener('click', () => {
    // Sammelbestätigung: die vorgeschlagene Phase jedes Kriteriums wird übernommen.
    profile.criteria.forEach((c) => confirmed.add(c.id));
    readParams(body);
    draw();
  });
  body.querySelectorAll('[data-fix-replace]').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = profile.criteria.findIndex((c) => c.id === el.dataset.fixReplace);
      if (idx < 0) return;
      const old = profile.criteria[idx];
      const finding = profileCatalogFindings(profile, criterionCatalog, retiredCriterionNames)
        .find((f) => f.criterionId === old.id && (f.kind === 'replaced' || f.kind === 'type-mismatch'));
      const entry = criterionCatalog.find((e) => e.name === finding?.successor);
      if (!entry) return;
      const c = criterionFromCatalog(entry);
      c.weight = old.weight;               // Gewicht und K.o.-Status des alten Kriteriums bleiben
      c.knockout = old.knockout;
      c.stage = old.stage;                 // bewusste Phasen-Zuordnung bleibt erhalten
      profile.criteria.splice(idx, 1, c);
      confirmed.delete(old.id);
      confirmed.add(c.id);
      readParams(body);
      store.saveProfile(profile);
      toast(finding.kind === 'type-mismatch'
        ? `„${c.name}" auf feste Klassen umgestellt — Punkte im Profil-Editor prüfen.`
        : `„${old.name}" durch „${c.name}" ersetzt.`);
      draw();
    });
  });
  body.querySelectorAll('[data-fix-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = profile.criteria.findIndex((c) => c.id === el.dataset.fixRemove);
      if (idx < 0) return;
      const [removed] = profile.criteria.splice(idx, 1);
      confirmed.delete(removed.id);
      readParams(body);
      store.saveProfile(profile);
      toast(`Kriterium „${removed.name}" entfernt.`);
      draw();
    });
  });
  body.querySelectorAll('[data-fix-keep]').forEach((el) => {
    el.addEventListener('click', () => {
      keptFindings.add(el.dataset.fixKeep);
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
  body.querySelector('[data-action="to-step-3"]')?.addEventListener('click', () => {
    readParams(body);
    goToStep(3);
  });
  body.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
    queue = qualificationQueue(profile, store.listLeads(profile.id)).map((l) => l.id);
    position = 0;
    processed = new Set();
    skipped = new Set();
    drafts = new Map();
    goToStep(4);
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
  store.setWorkflowParams(profile.id, params);   // beim nächsten Start wieder vorbelegt
}

// --- Schritt 2: Longlist — Kandidaten über Klassen-Filter finden (FR-401) ---

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
}

function keyBlockHtml() {
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

function drawStep2(body) {
  const longlist = longlistCriteria(profile);
  const apiKey = store.getApiKey();
  const [costLo, costHi] = COST_ESTIMATES.longlist;

  const filters = longlist
    .filter((c) => (c.searchTargets || []).length > 0)
    .map((c) => `${esc(c.name)}: ${c.rules.options.filter((o) => c.searchTargets.includes(o.id)).map((o) => esc(o.label)).join(', ')}`);

  body.innerHTML = `
    <div class="card">
      <h2>Schritt 2: Kandidaten finden (Longlist)</h2>
      <p>Gesucht werden <strong>${esc(String(params.count))}</strong> Kandidaten in
      <strong>${esc(params.region)}</strong> über die Klassen-Filter:
      ${longlist.map((c) => `<span class="badge">${esc(c.name)}</span>`).join(' ')}</p>
      ${filters.length > 0
        ? `<p class="muted">Harte Filter: ${filters.join(' · ')}</p>`
        : '<p class="muted">Keine Suchauswahl angeklickt — es wird ohne harte Filter gesucht.</p>'}
      <p class="muted">Die übrigen Pre-Screening-Kriterien (Signale, Skalen, Zahlen) werden erst im
      Tiefen-Screening (Schritt 3) je Unternehmen recherchiert.</p>
      <div class="card">
        <h2>API-Schlüssel</h2>
        ${keyBlockHtml()}
      </div>
      <div class="notice notice-warn">Der Lauf nutzt Ihren eigenen API-Schlüssel; Kosten grob
      ${fmtAmount(costLo)}–${fmtAmount(costHi)}&nbsp;$.</div>
      ${costSummaryHtml()}
      <div class="row-actions">
        <button class="btn" data-action="back-1" ${running ? 'disabled' : ''}>Zurück zu Schritt 1</button>
        <button class="btn btn-primary" data-action="start" ${(!apiKey || longlist.length === 0 || running) ? 'disabled' : ''}>
          Longlist-Suche starten
        </button>
        <span id="wf-status" class="muted"></span>
      </div>
    </div>
    <div id="wf-results"></div>
  `;

  body.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => handleStep2Action(el.dataset.action, body));
  });
  if (result) drawLonglistResults(body);
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
  if (action === 'start') startLonglist(body);
}

// Kandidaten sind vorausgewählt — außer sie tragen den Namen eines bestehenden Leads.
function preselect(candidates, offset = 0) {
  const existing = new Set(store.listLeads(profile.id).map((l) => l.name.trim().toLowerCase()));
  const selected = new Set();
  candidates.forEach((c, i) => {
    if (!existing.has(c.name.trim().toLowerCase())) selected.add(offset + i);
  });
  return selected;
}

// append: Nachsuche mit Ausschluss der bereits gefundenen Namen (FR-409). Übergeben
// werden ausschließlich Kandidaten dieses Laufs — nie gespeicherte Leads.
async function startLonglist(body, { append = false } = {}) {
  const previous = append && result ? result.candidates : [];
  let request;
  try {
    request = buildLonglistRequest(profile, { ...params, today, exclude: previous.map((c) => c.name) });
  } catch (e) {
    toast(e.message);
    return;
  }

  const lockButtons = (locked) => {
    const start = body.querySelector('[data-action="start"]');
    if (start) start.disabled = locked;
    const back = body.querySelector('[data-action="back-1"]');
    if (back) back.disabled = locked;
  };

  running = true;
  if (!append) {
    result = null;
    body.querySelector('#wf-results').innerHTML = '';
  }
  lockButtons(true);

  let error = null;
  let message = '';
  try {
    const { output, usage } = await runScreening(store.getApiKey(), request, setStatus);
    trackCost(usage);
    const parsed = parseCandidates(output, profile);

    if (append) {
      // Namensgleiche Treffer aus dem Vorlauf verwerfen — die KI hält den Ausschluss
      // nicht immer ein.
      const known = new Set(previous.map((c) => c.name.trim().toLowerCase()));
      const fresh = parsed.candidates.filter((c) => !known.has(c.name.trim().toLowerCase()));
      const dropped = parsed.candidates.length - fresh.length;
      result = {
        candidates: [...previous, ...fresh],
        warnings: [...result.warnings, ...parsed.warnings],   // Verworfenes bleibt sichtbar
        region: params.region,
        selected: new Set([...result.selected, ...preselect(fresh, previous.length)]),
      };
      message = fresh.length > 0
        ? `${fresh.length} weitere Kandidaten gefunden${dropped > 0 ? ` (${dropped} Wiederholung(en) verworfen)` : ''}.`
        : 'Keine weiteren Kandidaten gefunden — die Suche ist ausgeschöpft.';
    } else {
      result = { ...parsed, region: params.region, selected: preselect(parsed.candidates) };
    }
  } catch (e) {
    error = e;
  }

  // Erst entsperren, dann zeichnen — sonst rendert die Ergebnisansicht ihre
  // eigenen Schaltflächen als deaktiviert.
  running = false;
  setStatus('');
  lockButtons(false);

  const target = body.querySelector('#wf-results');
  if (error) {
    if (append) { toast(error.message); drawLonglistResults(body); }
    else if (target) target.innerHTML = `<div class="notice notice-error">${esc(error.message)}</div>`;
    return;
  }
  if (message) toast(message);
  if (result.candidates.length === 0 && target) {
    target.innerHTML =
      '<div class="notice notice-warn">Die Suche lieferte keine belegbaren Kandidaten. Versuchen Sie eine breitere Region oder weniger harte Filter.</div>';
    return;
  }
  drawLonglistResults(body);
}

function shortUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

function drawLonglistResults(body) {
  const target = body.querySelector('#wf-results');
  if (!target || !result) return;

  const existingNames = new Set(store.listLeads(profile.id).map((l) => l.name.trim().toLowerCase()));
  const longlist = longlistCriteria(profile);

  const rows = result.candidates.map((cand, i) => {
    const dup = existingNames.has(cand.name.trim().toLowerCase());
    const classValues = longlist.map((c) => {
      const v = cand.values[c.id];
      const label = v === undefined ? '–' : (c.rules.options.find((o) => o.id === v)?.label ?? '–');
      return `${esc(c.name)}: <strong>${esc(label)}</strong>`;
    }).join(' · ');
    const sources = [...cand.sources, ...Object.values(cand.valueSources)]
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .map((s) => `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(s))}</a>`)
      .join(' · ');
    return `
      <tr>
        <td><input type="checkbox" data-select="${i}" ${result.selected.has(i) ? 'checked' : ''} aria-label="Kandidat auswählen"></td>
        <td>
          <strong>${esc(cand.name)}</strong>
          ${dup ? '<span class="badge badge-incomplete">evtl. Duplikat</span>' : ''}
          ${cand.website ? `<div><a href="${esc(cand.website)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(cand.website))}</a></div>` : ''}
          <div class="muted">${esc(cand.reasoning)}</div>
          <div class="hint">${classValues}</div>
          <div class="hint">Quellen: ${sources}</div>
        </td>
      </tr>`;
  }).join('');

  const dupCount = result.candidates.filter((c) => existingNames.has(c.name.trim().toLowerCase())).length;

  target.innerHTML = `
    <div class="card">
      <h2>Kandidaten (${result.candidates.length})</h2>
      ${result.warnings.length > 0 ? `
        <div class="notice notice-warn"><ul>${result.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      <p class="muted">Die Longlist zeigt nur die Klassen-Filter. Das granulare Bild (Signale,
      Konfidenz, Belegdatum) entsteht im Tiefen-Screening. Ohne Übernahme wird nichts gespeichert.</p>
      ${dupCount > 0 ? `<p class="muted">${dupCount} Kandidat(en) tragen den Namen bestehender Leads und sind
        deshalb nicht vorausgewählt.</p>` : ''}
      ${costSummaryHtml()}
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Kandidat</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="row-actions" style="margin-top: var(--space-3)">
        <button class="btn" data-result-action="toggle-all">Alle an/abwählen</button>
        <button class="btn" data-result-action="more" ${running ? 'disabled' : ''}>Weitere Kandidaten suchen</button>
        <button class="btn btn-primary" data-result-action="deep">Tiefen-Screening für Auswahl</button>
        <button class="btn" data-result-action="import">Auswahl ohne Tiefen-Screening übernehmen</button>
      </div>
      <div class="hint">„Weitere Kandidaten suchen" startet einen neuen Lauf, der die oben
      gefundenen Unternehmen ausschließt — kostet erneut ${fmtAmount(COST_ESTIMATES.longlist[0])}–${fmtAmount(COST_ESTIMATES.longlist[1])}&nbsp;$.</div>
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
    btn.addEventListener('click', () => handleLonglistAction(btn.dataset.resultAction, body));
  });
}

function importCandidates(candidates) {
  const duplicates = candidates.filter((c) => isExistingLeadName(c.name)).length;
  const importedIds = [];
  for (const cand of candidates) {
    const lead = candidateToLead(cand, profile, { region: params.region, date: today });
    store.saveLead(lead);
    importedIds.push(lead.id);
  }
  toast(`${importedIds.length} Lead(s) übernommen — Quelle „Screening".${
    duplicates > 0 ? ` ${duplicates} davon tragen den Namen bestehender Leads.` : ''}`);
  queue = importedIds;
  position = 0;
  processed = new Set();
  skipped = new Set();
  drafts = new Map();
  goToStep(4);
}

function handleLonglistAction(action, body) {
  if (action === 'toggle-all') {
    if (result.selected.size === result.candidates.length) result.selected.clear();
    else result.candidates.forEach((_, i) => result.selected.add(i));
    drawLonglistResults(body);
    return;
  }
  if (action === 'more') {
    if (running) return;
    body.querySelectorAll('[data-result-action]').forEach((el) => { el.disabled = true; });
    startLonglist(body, { append: true });
    return;
  }
  const chosen = [...result.selected].sort((a, b) => a - b).map((i) => result.candidates[i]);
  if (chosen.length === 0) { toast('Bitte mindestens einen Kandidaten auswählen.'); return; }
  if (action === 'import') {
    result = null;
    importCandidates(chosen);
    return;
  }
  if (action === 'deep') {
    // Tiefen-Screening nur für Kandidaten des laufenden Laufs (Verfassung III)
    deepRun = deepRun?.running ? deepRun : { entries: [], running: false, controllers: new Set() };
    for (const cand of chosen) {
      if (deepRun.entries.some((e) => e.name.trim().toLowerCase() === cand.name.trim().toLowerCase())) continue;
      deepRun.entries.push({
        name: cand.name, website: cand.website, longlistCandidate: cand,
        status: 'pending', candidate: null, error: '', warnings: [], selected: !isExistingLeadName(cand.name),
      });
    }
    goToStep(3);
  }
}

// Trägt bereits ein gespeicherter Lead diesen Namen? Steuert die Vorauswahl bei der
// Übernahme — bewusstes Anwählen bleibt möglich.
function isExistingLeadName(name) {
  const n = String(name || '').trim().toLowerCase();
  return store.listLeads(profile.id).some((l) => l.name.trim().toLowerCase() === n);
}

// --- Schritt 3: Tiefen-Screening je Unternehmen (FR-402–406) ---

function drawStep3(body) {
  if (!deepRun) deepRun = { entries: [], running: false, controllers: new Set() };
  const apiKey = store.getApiKey();
  const pre = prescreeningCriteria(profile);

  body.innerHTML = `
    <div class="card">
      <h2>Schritt 3: Tiefen-Screening</h2>
      <p class="muted">Je Unternehmen läuft eine eigene Recherche über alle
      ${pre.length} Pre-Screening-Kriterien — mit Quelle, Konfidenz (belegt/abgeleitet)
      und Belegdatum je Wert. Werte ohne Quelle werden verworfen.</p>
      ${apiKey ? '' : `<div class="card"><h2>API-Schlüssel</h2>${keyBlockHtml()}</div>`}
      <div class="inline-fields">
        <div class="field grow">
          <label for="deep-name">Eigenes Unternehmen prüfen — Name</label>
          <input type="text" id="deep-name" maxlength="120" placeholder="z. B. Muster GmbH">
        </div>
        <div class="field grow">
          <label for="deep-website">Website (optional)</label>
          <input type="text" id="deep-website" maxlength="200" placeholder="https://…">
        </div>
        <button class="btn" data-action="add-manual">Hinzufügen</button>
      </div>
      <div id="deep-controls"></div>
      <div id="deep-entries"></div>
    </div>
    <div id="deep-results"></div>
  `;

  body.querySelector('[data-action="add-manual"]').addEventListener('click', () => {
    const name = body.querySelector('#deep-name').value.trim();
    const website = body.querySelector('#deep-website').value.trim() || null;
    if (!name) { toast('Bitte einen Firmennamen eingeben.'); return; }
    if (deepRun.entries.some((e) => e.name.trim().toLowerCase() === name.toLowerCase())) {
      toast('Dieses Unternehmen steht bereits in der Liste.');
      return;
    }
    deepRun.entries.push({
      name, website, longlistCandidate: null,
      status: 'pending', candidate: null, error: '', warnings: [], selected: !isExistingLeadName(name),
    });
    body.querySelector('#deep-name').value = '';
    body.querySelector('#deep-website').value = '';
    renderDeepControls(body);
    renderDeepEntries(body);
  });
  body.querySelectorAll('[data-action="save-key"], [data-action="clear-key"]').forEach((el) => {
    el.addEventListener('click', () => handleStep2Action(el.dataset.action, body));
  });

  renderDeepControls(body);
  renderDeepEntries(body);
  renderDeepResults(body);
}

function renderDeepControls(body) {
  const target = body.querySelector('#deep-controls');
  if (!target) return;
  const pending = deepRun.entries.filter((e) => e.status === 'pending').length;
  const total = deepRun.entries.length;
  const cost = estimateDeepCost(pending);
  const apiKey = store.getApiKey();
  const batches = Math.ceil(pending / DEEP_CONCURRENCY);

  target.innerHTML = `
    ${total > 15 ? '<div class="notice notice-warn">Mehr als 15 Unternehmen — das dauert lange und kostet entsprechend. Empfehlung: 5–10 je Lauf.</div>' : ''}
    ${pending > 0 ? `<p class="muted">Noch ${pending} Unternehmen offen — geschätzt
      ${fmtAmount(cost.min)}–${fmtAmount(cost.max)}&nbsp;$ und ca. ${batches * 2}–${batches * 3} Minuten
      (${DEEP_CONCURRENCY} gleichzeitig, abbrechbar; Teilergebnisse bleiben erhalten).</p>` : ''}
    ${costSummaryHtml()}
    <div class="row-actions">
      <button class="btn" data-deep="back" ${deepRun.running ? 'disabled' : ''}>Zurück zu Schritt 2</button>
      ${deepRun.running
        ? '<button class="btn" data-deep="abort">Abbrechen</button>'
        : `<button class="btn btn-primary" data-deep="start" ${(!apiKey || pending === 0) ? 'disabled' : ''}>
             ${deepRun.entries.some((e) => e.status === 'done' || e.status === 'error') ? 'Fortsetzen' : 'Tiefen-Screening starten'}
           </button>`}
      <span id="deep-status" class="muted"></span>
    </div>
  `;
  target.querySelectorAll('[data-deep]').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.deep === 'back') { goToStep(2); return; }
      if (el.dataset.deep === 'abort') {
        deepRun.running = false;
        deepRun.controllers?.forEach((c) => c.abort());
        return;
      }
      if (el.dataset.deep === 'start') runDeepLoop(body);
    });
  });
}

const DEEP_STATUS_LABELS = {
  pending: 'wartet',
  running: 'läuft …',
  done: 'fertig',
  error: 'Fehler',
};

function renderDeepEntries(body) {
  const target = body.querySelector('#deep-entries');
  if (!target) return;
  if (deepRun.entries.length === 0) {
    target.innerHTML = '<div class="empty-state">Keine Unternehmen in der Liste — wählen Sie Kandidaten in Schritt 2 aus oder fügen Sie oben ein eigenes Unternehmen hinzu.</div>';
    return;
  }
  target.innerHTML = `
    <ul class="deep-list">
      ${deepRun.entries.map((e, i) => `
        <li class="deep-entry deep-${e.status}">
          <span class="deep-status">${DEEP_STATUS_LABELS[e.status]}</span>
          <strong>${esc(e.name)}</strong>
          ${e.website ? `<span class="muted">${esc(shortUrl(e.website))}</span>` : ''}
          ${e.status === 'error' ? `<span class="muted">${esc(e.error)}</span>
            <button class="btn btn-small" data-retry="${i}">Erneut versuchen</button>` : ''}
          ${e.status === 'pending' && !deepRun.running ? `<button class="btn btn-small" data-remove="${i}">Entfernen</button>` : ''}
        </li>`).join('')}
    </ul>
  `;
  target.querySelectorAll('[data-retry]').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = deepRun.entries[Number(el.dataset.retry)];
      if (entry) { entry.status = 'pending'; entry.error = ''; }
      renderDeepControls(body);
      renderDeepEntries(body);
    });
  });
  target.querySelectorAll('[data-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      deepRun.entries.splice(Number(el.dataset.remove), 1);
      renderDeepControls(body);
      renderDeepEntries(body);
    });
  });
}

function updateDeepStatus(body) {
  const statusEl = body.querySelector('#deep-status');
  if (!statusEl) return;
  if (!deepRun.running) { statusEl.textContent = ''; return; }
  const active = deepRun.entries.filter((e) => e.status === 'running').map((e) => e.name);
  const done = deepRun.entries.filter((e) => e.status === 'done' || e.status === 'error').length;
  statusEl.textContent = active.length > 0
    ? `${done} von ${deepRun.entries.length} fertig — läuft: ${active.join(', ')} …`
    : `${done} von ${deepRun.entries.length} fertig …`;
}

// Ein Arbeiter je Nebenläufigkeit: greift sich das nächste offene Unternehmen.
// Die Auswahl läuft synchron vor dem ersten await — zwei Arbeiter können sich
// denselben Eintrag nicht greifen.
async function deepWorker(body) {
  while (deepRun?.running) {
    const entry = deepRun.entries.find((e) => e.status === 'pending');
    if (!entry) return;
    entry.status = 'running';
    renderDeepEntries(body);
    updateDeepStatus(body);

    let request;
    try {
      request = buildDeepScreeningRequest(profile, entry, { region: params.region, today });
    } catch (e) {
      entry.status = 'error';
      entry.error = e.message;
      renderDeepEntries(body);
      continue;
    }

    const controller = new AbortController();
    deepRun.controllers.add(controller);
    try {
      const { output, usage } = await runScreening(store.getApiKey(), request, () => {}, { signal: controller.signal });
      trackCost(usage);
      const { candidate, warnings } = parseDeepResult(output, profile, { name: entry.name });
      entry.warnings = warnings;
      if (candidate) {
        entry.candidate = entry.longlistCandidate
          ? mergeDeepIntoCandidate(entry.longlistCandidate, candidate)
          : candidate;
        entry.status = 'done';
      } else {
        entry.status = 'error';
        entry.error = warnings.join(' ');
      }
    } catch (e) {
      if (e.aborted) {
        entry.status = 'pending';               // zurück in die Warteschlange (Teilergebnisse bleiben)
        return;
      }
      entry.status = 'error';
      entry.error = e.message;
      if (e.message.includes('Rate-Limit')) {   // 429: Lauf pausieren, kein Auto-Retry (Kosten)
        deepRun.running = false;
      }
    } finally {
      deepRun.controllers.delete(controller);
    }
    renderDeepEntries(body);
    renderDeepResults(body);
    updateDeepStatus(body);
  }
}

async function runDeepLoop(body) {
  if (deepRun.running) return;
  deepRun.running = true;
  deepRun.controllers = new Set();
  renderDeepControls(body);

  const workers = Array.from({ length: DEEP_CONCURRENCY }, () => deepWorker(body));
  await Promise.all(workers);

  deepRun.running = false;
  deepRun.controllers = new Set();
  updateDeepStatus(body);
  renderDeepControls(body);
  renderDeepEntries(body);
  renderDeepResults(body);
}

function confidenceBadge(conf) {
  if (conf === 'direct') return '<span class="badge badge-confidence-direct">belegt</span>';
  if (conf === 'inferred') return '<span class="badge badge-confidence-inferred">abgeleitet</span>';
  return '';
}

function renderDeepResults(body) {
  const target = body.querySelector('#deep-results');
  if (!target || !deepRun) return;
  const done = deepRun.entries.filter((e) => e.status === 'done');
  if (done.length === 0) { target.innerHTML = ''; return; }

  const pre = prescreeningCriteria(profile);
  let staleTotal = 0;
  const cards = done.map((entry) => {
    const cand = entry.candidate;
    const ev = evaluate(profile, candidateToLead(cand, profile));
    const rows = pre.map((c) => {
      const v = cand.values[c.id];
      let label;
      if (v === undefined) label = '<span class="muted">offen</span>';
      else if (c.type === 'select') label = esc(c.rules.options.find((o) => o.id === v)?.label ?? String(v));
      else label = esc(fmtValue(v));
      const src = cand.valueSources[c.id]
        ? ` <a href="${esc(cand.valueSources[c.id])}" target="_blank" rel="noopener noreferrer">[Quelle]</a>` : '';
      const evidenceDate = cand.evidenceDates?.[c.id];
      const date = evidenceDate ? ` <span class="muted">Stand ${esc(evidenceDate)}</span>` : '';
      if (isEvidenceStale(evidenceDate, today)) staleTotal += 1;
      return `<tr><td>${esc(c.name)}</td><td>${label} ${confidenceBadge(cand.confidence?.[c.id])}${date}${staleBadge(evidenceDate)}${src}</td></tr>`;
    }).join('');
    const i = deepRun.entries.indexOf(entry);
    const dup = isExistingLeadName(cand.name);
    return `
      <div class="card">
        <div class="criterion-head">
          <label style="display:flex;align-items:center;gap:var(--space-2)">
            <input type="checkbox" data-deep-select="${i}" ${entry.selected ? 'checked' : ''}>
            <strong>${esc(cand.name)}</strong>
            ${dup ? '<span class="badge badge-incomplete">evtl. Duplikat</span>' : ''}
          </label>
          ${cand.website ? `<a href="${esc(cand.website)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(cand.website))}</a>` : ''}
          <span>Vorläufig: ${ev.total === null ? '–' : fmtScore(ev.total)} ${ev.status === 'scored' ? tierBadge(profile, ev.tierId) : ''}
            ${ev.status === 'not-evaluable' ? '<span class="badge badge-not-evaluable">Nicht bewertbar</span>' : ''}</span>
        </div>
        ${cand.reasoning ? `<p class="muted">${esc(cand.reasoning)}</p>` : ''}
        ${entry.warnings.length > 0 ? `<div class="hint">${entry.warnings.map((w) => esc(w)).join(' · ')}</div>` : ''}
        <div class="table-wrap"><table><tbody>${rows}</tbody></table></div>
      </div>`;
  }).join('');

  target.innerHTML = `
    <h2>Geprüfte Unternehmen (${done.length})</h2>
    <p class="muted">Ohne Übernahme wird nichts gespeichert. Die Qualifizierung (Schritt 4)
    ergänzt danach die nicht recherchierbaren Kriterien.</p>
    ${staleTotal > 0 ? `<div class="notice notice-warn">${staleTotal} Wert(e) stützen sich auf Belege,
      die älter als ${EVIDENCE_MAX_AGE_MONTHS} Monate sind — vor der Ansprache gegenprüfen.</div>` : ''}
    ${cards}
    <div class="row-actions" style="margin-bottom: var(--space-4)">
      <button class="btn btn-primary" data-deep-import ${deepRun.running ? 'disabled' : ''}>
        Auswahl übernehmen &amp; weiter zu Schritt 4
      </button>
      ${deepRun.running ? '<span class="muted">Übernahme möglich, sobald der Lauf beendet oder abgebrochen ist.</span>' : ''}
    </div>
  `;

  target.querySelectorAll('[data-deep-select]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const entry = deepRun.entries[Number(cb.dataset.deepSelect)];
      if (entry) entry.selected = cb.checked;
    });
  });
  target.querySelector('[data-deep-import]').addEventListener('click', () => {
    if (deepRun.running) return;
    const chosen = deepRun.entries.filter((e) => e.status === 'done' && e.selected).map((e) => e.candidate);
    if (chosen.length === 0) { toast('Bitte mindestens ein Unternehmen auswählen.'); return; }
    deepRun = null;
    result = null;
    importCandidates(chosen);
  });
}

// --- Schritt 4: Geführte Qualifizierung Lead für Lead (W4, unverändert aus 003) ---

function drawStep4(body) {
  if (queue.length === 0 || finished || position >= queue.length) {
    drawSummary(body);
    return;
  }

  const leadId = queue[position];
  const stored = store.getLead(profile.id, leadId);
  if (!stored) {
    position += 1;
    drawStep4(body);
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
    const evidenceDate = working.evidenceDates?.[c.id];
    const date = evidenceDate ? ` <span class="muted">Stand ${esc(evidenceDate)}</span>` : '';
    return `<tr><td>${esc(c.name)}</td><td>${value === undefined ? '<span class="muted">— nicht belegt —</span>' : esc(label)} ${confidenceBadge(working.confidence?.[c.id])}${date}${staleBadge(evidenceDate)}${source}</td></tr>`;
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
      <h2>Schritt 4: Qualifizierung — Lead ${position + 1} von ${queue.length}</h2>
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
    const apply = () => { readLeadValue(el, working); updateStep4Score(body, working); };
    el.addEventListener('change', apply);
    if (el.type === 'number') el.addEventListener('input', apply);
  });
  body.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleStep4Action(btn.dataset.action, body, working));
  });
  updateStep4Score(body, working);
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

function updateStep4Score(body, working) {
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
    <div class="score-sub">${scoreScaleLabel(profile)}</div>
    <p class="hint" style="text-align:left">Die Bewertung aktualisiert sich live. Den vollständigen
    Kriterien-Breakdown zeigt die <a href="#/lead/${esc(working.id)}">Lead-Einzelansicht</a>.</p>
  `;
}

function handleStep4Action(action, body, working) {
  if (action === 'prev') {
    if (position > 0) { position -= 1; drawStep4(body); }
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
  drawStep4(body);
}

function drawSummary(body) {
  if (queue.length === 0) {
    body.innerHTML = `
      <div class="card">
        <h2>Schritt 4: Qualifizierung</h2>
        <div class="empty-state">Keine Leads in der Warteschlange. Übernehmen Sie in
        Schritt 2 oder 3 Unternehmen oder starten Sie den Workflow neu.</div>
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
