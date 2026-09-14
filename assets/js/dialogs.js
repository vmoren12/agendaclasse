/**
 * Diàlegs de l'aplicació: el formulari d'entrada i el full de configuració.
 * Fan servir l'element natiu <dialog>, que ja porta focus atrapat i tecla Esc.
 */

import { $, $$, clear, el } from './dom.js';
import { formatShort, fromKey, toKey, today } from './dates.js';
import {
  ACCENTS, BACKUP_UNITS, PALETTE, TYPES, VIEWS, addEntry, addSubject, backupUnit,
  countEntriesBySubject, data, deleteEntry, deleteSubject, getEntry, isClassId,
  isReadOnly, isRepoName, subscribe, updateEntry, updateSettings, updateBackupSettings,
  updatePublishSettings, updateSubject, clearEntries,
} from './store.js';
import { applyTheme } from './theme.js';
import { applyImport, backupStatusText, exportNow, readBackupFile } from './backup.js';
import {
  calendarUrl, currentRepo, getToken, googleCalendarUrl, hasToken, hasUnpublishedChanges,
  publishClass, setToken, studentUrl, suggestClassId, webcalUrl,
} from './publish.js';
import { formatDateTime } from './dates.js';
import { toast } from './toast.js';

const VIEW_LABELS = {
  day: 'Dia', week: 'Setmana', month: 'Mes', year: 'Any', agenda: 'Agenda',
};

let hooks = {};

export function initDialogs(options = {}) {
  hooks = options;
  initEntryDialog();
  initSettingsDialog();
  initImportDialog();
  initPublishSection();
  initCalendarDialog();
}

/* ---------------------------- Diàleg d'entrada ---------------------------- */

let editingId = null;
let selectedType = 'tasca';

function setTypeChips() {
  $$('#typeChips .chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.type === selectedType));
  });
}

function fillSubjectOptions(selectedId) {
  const select = clear($('#fSubject'));
  select.append(el('option', { value: '', text: 'Sense matèria' }));
  data.subjects.forEach((subject) => {
    select.append(el('option', { value: subject.id, text: subject.name }));
  });
  select.value = selectedId || '';
}

function initEntryDialog() {
  const dialog = $('#entryDialog');

  $('#typeChips').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    selectedType = chip.dataset.type;
    setTypeChips();
  });

  $('#btnCancelEntry').addEventListener('click', () => dialog.close());

  $('#entryForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = {
      date: $('#fDate').value,
      title: $('#fTitle').value.trim(),
      type: selectedType,
      subjectId: $('#fSubject').value || null,
      notes: $('#fNotes').value.trim(),
      done: $('#fDone').checked,
    };
    if (!values.date || !values.title) return;

    if (editingId) updateEntry(editingId, values);
    else addEntry(values);

    dialog.close();
    hooks.onEntrySaved?.(values.date);
  });

  const deleteBtn = $('#btnDeleteEntry');
  deleteBtn.addEventListener('click', () => {
    if (deleteBtn.dataset.armed === 'true') {
      deleteEntry(editingId);
      dialog.close();
      toast('Entrada eliminada.');
      return;
    }
    deleteBtn.dataset.armed = 'true';
    deleteBtn.textContent = 'Confirmar eliminació';
    setTimeout(() => {
      if (!dialog.open) return;
      deleteBtn.dataset.armed = 'false';
      deleteBtn.textContent = 'Eliminar';
    }, 4000);
  });

  // Clic fora del full: tancar.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

/**
 * @param {{id?: string|null, dateKey?: string}} options
 */
export function openEntryDialog({ id = null, dateKey = null } = {}) {
  const dialog = $('#entryDialog');
  const form = $('#entryForm');
  const deleteBtn = $('#btnDeleteEntry');
  editingId = id;

  form.reset();
  deleteBtn.dataset.armed = 'false';
  deleteBtn.textContent = 'Eliminar';

  if (id) {
    const entry = getEntry(id);
    if (!entry) return;
    $('#entryDialogTitle').textContent = 'Editar entrada';
    $('#entryDialogSub').textContent = formatShort(fromKey(entry.date));
    $('#fDate').value = entry.date;
    $('#fTitle').value = entry.title;
    $('#fNotes').value = entry.notes || '';
    $('#fDone').checked = Boolean(entry.done);
    selectedType = entry.type;
    fillSubjectOptions(entry.subjectId);
    deleteBtn.hidden = false;
  } else {
    const key = dateKey || toKey(today());
    $('#entryDialogTitle').textContent = 'Nova entrada';
    $('#entryDialogSub').textContent = formatShort(fromKey(key));
    $('#fDate').value = key;
    selectedType = 'tasca';
    fillSubjectOptions(null);
    deleteBtn.hidden = true;
  }

  setTypeChips();
  dialog.showModal();
  setTimeout(() => $('#fTitle').focus(), 40);
}

/* -------------------------- Diàleg de configuració ------------------------ */

let unsubscribeSettings = null;

function renderAccentSwatches() {
  const wrap = clear($('#accentSwatches'));
  ACCENTS.forEach((accent) => {
    wrap.append(el('button', {
      class: 'swatch',
      type: 'button',
      style: `--c:${accent.color}`,
      title: accent.label,
      'aria-label': `Accent ${accent.label}`,
      'aria-pressed': String(data.settings.accent === accent.id),
      onClick: () => {
        updateSettings({ accent: accent.id });
        applyTheme(data.settings);
        renderAccentSwatches();
      },
    }));
  });
}

function renderThemeChips() {
  $$('#themeChips .chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.mode === data.settings.themeMode));
  });
}

function renderSubjectRows() {
  const wrap = clear($('#subjectRows'));

  if (data.subjects.length === 0) {
    wrap.append(el('p', { class: 'hint', text: 'Encara no hi ha matèries. Afegeix-ne una per donar color a les entrades.' }));
  }

  data.subjects.forEach((subject) => {
    const used = countEntriesBySubject(subject.id);
    const row = el('div', { class: 'subject-row', style: `--c:${subject.color}` });

    row.append(el('input', {
      type: 'text',
      value: subject.name,
      'aria-label': `Nom de la matèria ${subject.name}`,
      maxLength: 60,
      onChange: (event) => {
        const name = event.target.value.trim();
        if (!name) {
          event.target.value = subject.name;
          return;
        }
        updateSubject(subject.id, { name });
      },
    }));

    row.append(el('input', {
      type: 'color',
      value: subject.color,
      list: 'paletteList',
      'aria-label': `Color de ${subject.name}`,
      onInput: (event) => {
        row.style.setProperty('--c', event.target.value);
      },
      onChange: (event) => updateSubject(subject.id, { color: event.target.value }),
    }));

    row.append(el('span', { class: 'count', text: used === 1 ? '1 entrada' : `${used} entrades` }));

    row.append(el('button', {
      class: 'icon-btn',
      type: 'button',
      text: 'Treure',
      'aria-label': `Eliminar la matèria ${subject.name}`,
      onClick: () => {
        const message = used > 0
          ? `Vols eliminar "${subject.name}"? Les ${used} entrades que la fan servir es quedaran sense matèria.`
          : `Vols eliminar "${subject.name}"?`;
        if (window.confirm(message)) deleteSubject(subject.id);
      },
    }));

    wrap.append(row);
  });
}

function renderBackupFields() {
  const { mode, everyChanges, every, unit } = data.settings.backup;
  $('#backupMode').value = mode;
  $('#setEveryChanges').value = everyChanges;
  $('#setEvery').value = every;
  $('#setEvery').max = backupUnit(unit).max;
  $('#setUnit').value = unit;
  $('#backupChangesField').hidden = mode !== 'changes';
  $('#backupTimeField').hidden = mode !== 'time';
  $('#backupStatus').textContent = backupStatusText();
}

function renderSettings() {
  const student = isReadOnly();

  // En mode alumne només té sentit l'aparença.
  ['#sectionClass', '#sectionSubjects', '#sectionBackup', '#sectionPublish'].forEach((id) => {
    $(id).hidden = student;
  });
  $('#btnClearEntries').hidden = student;
  $('#btnLeaveClass').hidden = !student;
  $('#btnInstall').hidden = !hooks.canInstall?.();

  renderThemeChips();
  renderAccentSwatches();
  if (student) return;

  $('#setClassName').value = data.settings.className;
  $('#setDefaultView').value = data.settings.defaultView;
  renderSubjectRows();
  renderBackupFields();
  renderPublishFields();
}

/* ---------------------- Publicació per als alumnes ------------------------ */

let publishing = false;

/**
 * Publica i explica com ha anat. La fan servir tant el botó de Configuració
 * com el botó flotant, així que mai hi ha dues publicacions alhora.
 * @returns {Promise<boolean>} si ha anat bé
 */
export async function publishNow() {
  if (publishing) return false;
  publishing = true;
  try {
    const result = await publishClass();
    toast(`Publicades ${result.entries} entrades. Els alumnes ho veuran d'aquí a un minut.`);
    return true;
  } catch (err) {
    toast(err.message || "No s'ha pogut publicar.");
    return false;
  } finally {
    publishing = false;
  }
}

function renderPublishFields() {
  const { classId, lastPublishedAt } = data.settings.publish;
  $('#setToken').value = hasToken() ? '\u2022'.repeat(16) : '';
  $('#setRepo').value = currentRepo() || '';
  $('#setClassId').value = classId || '';

  const ready = hasToken() && Boolean(classId) && Boolean(currentRepo());
  $('#btnPublish').disabled = !ready;
  $('#btnCopyLink').disabled = !classId;
  $('#btnShowCalendar').disabled = !classId;
  $('#btnForgetToken').hidden = !hasToken();

  const status = [];
  if (!hasToken()) status.push('Falta el testimoni de GitHub.');
  else if (!classId) status.push("Falta l'identificador de la classe.");
  if (lastPublishedAt) {
    status.push(`Darrera publicació: ${formatDateTime(lastPublishedAt)}.`);
    status.push(hasUnpublishedChanges()
      ? 'Hi ha canvis sense publicar.'
      : "Tot el que hi ha a l'agenda ja està publicat.");
    status.push(`Enllaç dels alumnes: ${studentUrl()}`);
  } else if (ready) {
    status.push("Encara no s'ha publicat res.");
  }
  $('#publishStatus').textContent = status.join(' ');
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    window.prompt('Copia aquesta adreça:', text);
  }
}

function initPublishSection() {
  $('#setToken').addEventListener('change', (event) => {
    const value = event.target.value.trim();
    if (!value || value.startsWith('\u2022')) return;
    setToken(value);
    if (!data.settings.publish.classId) {
      updatePublishSettings({ classId: suggestClassId(data.settings.className) });
    }
    renderPublishFields();
    toast('Testimoni desat en aquest navegador.');
  });

  $('#setRepo').addEventListener('change', (event) => {
    const value = event.target.value.trim();
    if (value && !isRepoName(value)) {
      toast("El repositori s'escriu «usuari/repositori».");
      renderPublishFields();
      return;
    }
    updatePublishSettings({ repo: value || null });
    renderPublishFields();
  });

  $('#setClassId').addEventListener('change', (event) => {
    const value = event.target.value.trim().toLowerCase();
    if (value && !isClassId(value)) {
      toast("L'identificador només admet lletres minúscules, xifres i guions.");
      renderPublishFields();
      return;
    }
    updatePublishSettings({ classId: value || null });
    renderPublishFields();
  });

  $('#btnGenerateClassId').addEventListener('click', () => {
    const { classId, lastPublishedAt } = data.settings.publish;
    // Canviar d'identificador deixa orfe l'enllaç que ja tinguin els alumnes.
    if (classId && lastPublishedAt) {
      const ok = window.confirm(
        'Ja hi ha una classe publicada amb l\'identificador actual. Si en generes un de nou, '
        + 'l\'enllaç que tenen els alumnes deixarà d\'actualitzar-se i n\'hauràs de repartir un altre. Vols continuar?',
      );
      if (!ok) return;
    }
    updatePublishSettings({
      classId: suggestClassId(data.settings.className),
      lastPublishedAt: null,
      lastSignature: null,
    });
    renderPublishFields();
    toast('Identificador nou. Publica-ho i reparteix l\'enllaç nou.');
  });

  $('#btnPublish').addEventListener('click', async () => {
    const button = $('#btnPublish');
    button.disabled = true;
    button.textContent = 'Publicant…';
    try {
      await publishNow();
    } finally {
      button.textContent = 'Publicar ara';
      renderPublishFields();
    }
  });

  $('#btnCopyLink').addEventListener('click', () => {
    copyText(studentUrl(), "Enllaç copiat. Ja el pots passar als alumnes.");
  });

  $('#btnShowCalendar').addEventListener('click', () => {
    openCalendarDialog(data.settings.publish.classId);
  });

  $('#btnForgetToken').addEventListener('click', () => {
    if (!window.confirm("Vols treure el testimoni d'aquest navegador? Hauràs de tornar-lo a escriure per publicar.")) return;
    setToken('');
    renderPublishFields();
    toast('Testimoni esborrat.');
  });

  $('#btnLeaveClass').addEventListener('click', () => hooks.leaveClass?.());
}

/* --------------------------- Diàleg del calendari ------------------------- */

export function openCalendarDialog(classId) {
  if (!classId) return;
  $('#calendarUrlField').value = calendarUrl(classId);
  $('#calendarGoogle').href = googleCalendarUrl(classId);
  $('#calendarApple').href = webcalUrl(classId);
  $('#calendarDialog').showModal();
}

function initCalendarDialog() {
  const dialog = $('#calendarDialog');
  $('#btnCloseCalendar').addEventListener('click', () => dialog.close());
  $('#calendarCopy').addEventListener('click', () => {
    copyText($('#calendarUrlField').value, 'Adreça del calendari copiada.');
  });
  $('#calendarUrlField').addEventListener('focus', (event) => event.target.select());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

/* ------------------------- Diàleg d'importació ---------------------------- */

let pendingImport = null;

function summarizeImport(summary) {
  const parts = [`${summary.entries} ${summary.entries === 1 ? 'entrada' : 'entrades'}`];
  if (summary.subjects) {
    parts.push(`${summary.subjects} ${summary.subjects === 1 ? 'matèria' : 'matèries'}`);
  }
  if (summary.className) parts.push(`classe «${summary.className}»`);
  if (summary.exportedAt) parts.push(`del ${summary.exportedAt}`);
  return `${summary.fileName} · ${parts.join(' · ')}`;
}

function initImportDialog() {
  const dialog = $('#importDialog');

  const apply = (mode) => {
    if (!pendingImport) return;
    const { payload } = pendingImport;
    pendingImport = null;
    dialog.close();
    try {
      const result = applyImport(payload, mode);
      applyTheme(data.settings);
      renderSettings();
      toast(result.mode === 'replace'
        ? `Agenda substituïda: ${result.entries} entrades.`
        : `Importat: ${result.added} entrades noves, ${result.updated} actualitzades.`);
    } catch (err) {
      console.error('Error important:', err);
      toast('No s\'ha pogut importar el fitxer.');
    }
  };

  $('#btnImportMerge').addEventListener('click', () => apply('merge'));
  $('#btnImportReplace').addEventListener('click', () => apply('replace'));
  $('#btnCancelImport').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    pendingImport = null;
  });
}

function initSettingsDialog() {
  const dialog = $('#settingsDialog');

  $('#btnCloseSettings').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    unsubscribeSettings?.();
    unsubscribeSettings = null;
  });

  $('#setClassName').addEventListener('change', (event) => {
    const name = event.target.value.trim();
    if (!name) {
      event.target.value = data.settings.className;
      return;
    }
    updateSettings({ className: name.slice(0, 80) });
  });

  $('#setDefaultView').addEventListener('change', (event) => {
    updateSettings({ defaultView: event.target.value });
  });

  $('#themeChips').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    updateSettings({ themeMode: chip.dataset.mode });
    applyTheme(data.settings);
    renderThemeChips();
  });

  $('#btnAddSubject').addEventListener('click', () => {
    const subject = addSubject();
    renderSubjectRows();
    const input = $('#subjectRows .subject-row:last-child input[type=text]');
    if (input) {
      input.focus();
      input.select();
    }
    toast(`Matèria "${subject.name}" afegida.`);
  });

  $('#backupMode').addEventListener('change', (event) => {
    updateBackupSettings({ mode: event.target.value });
    renderBackupFields();
  });
  $('#setEveryChanges').addEventListener('change', (event) => {
    updateBackupSettings({ everyChanges: Math.max(1, Number(event.target.value) || 25) });
    renderBackupFields();
  });
  $('#setEvery').addEventListener('change', (event) => {
    const max = backupUnit(data.settings.backup.unit).max;
    const value = Math.min(max, Math.max(1, Number(event.target.value) || 1));
    updateBackupSettings({ every: value });
    renderBackupFields();
  });
  $('#setUnit').addEventListener('change', (event) => {
    const unit = event.target.value;
    updateBackupSettings({
      unit,
      every: Math.min(data.settings.backup.every, backupUnit(unit).max),
    });
    renderBackupFields();
  });

  $('#btnExport').addEventListener('click', () => {
    exportNow();
    renderBackupFields();
  });

  $('#btnImport').addEventListener('click', () => {
    const input = $('#importFile');
    input.value = '';
    input.click();
  });

  // En triar el fitxer només el llegim: la decisió es pren al diàleg.
  $('#importFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      pendingImport = await readBackupFile(file);
      $('#importSummary').textContent = summarizeImport(pendingImport.summary);
      $('#importDialog').showModal();
    } catch (err) {
      toast(err.message || 'No s\'ha pogut llegir el fitxer.');
    }
  });

  $('#btnClearEntries').addEventListener('click', () => {
    if (!window.confirm('Vols esborrar totes les entrades? Les matèries i les preferències es mantindran.')) return;
    clearEntries();
    toast('Totes les entrades s\'han esborrat.');
  });

  $('#btnInstall').addEventListener('click', () => hooks.install?.());
}

export function openSettings() {
  renderSettings();
  unsubscribeSettings = subscribe((detail) => {
    if (detail.reason === 'subjects') renderSubjectRows();
    if (detail.reason === 'backup' || detail.reason === 'settings') renderBackupFields();
  });
  $('#settingsDialog').showModal();
}

export function fillStaticSelects() {
  const viewSelect = clear($('#setDefaultView'));
  VIEWS.forEach((view) => viewSelect.append(el('option', { value: view, text: VIEW_LABELS[view] })));

  const unitSelect = clear($('#setUnit'));
  BACKUP_UNITS.forEach((unit) => unitSelect.append(el('option', { value: unit.id, text: unit.label })));

  const typeChips = clear($('#typeChips'));
  TYPES.forEach((type) => {
    typeChips.append(el('button', {
      class: `chip ${type.id}`,
      type: 'button',
      text: type.label,
      'aria-pressed': 'false',
      dataset: { type: type.id },
    }));
  });

  // Colors suggerits per als selectors de color de les matèries.
  const list = $('#paletteList');
  if (list) PALETTE.forEach((color) => list.append(el('option', { value: color })));
}
