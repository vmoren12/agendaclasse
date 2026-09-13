/**
 * Còpies de seguretat: exportació i importació en JSON, més les còpies
 * automàtiques programades (cada X canvis o cada X minuts, hores, dies o
 * setmanes).
 */

import {
  APP_NAME, DATA_VERSION, backupUnit, data, markBackupDone, mergeAll, replaceAll,
} from './store.js';
import { formatDateTime, toKey, today } from './dates.js';
import { toast } from './toast.js';

function slug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'classe';
}

export function buildBackup() {
  return {
    app: APP_NAME,
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: data.settings,
    subjects: data.subjects,
    entries: data.entries,
  };
}

export function backupFilename(auto = false) {
  return `agendari-${slug(data.settings.className)}-${toKey(today())}${auto ? '-auto' : ''}.json`;
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Desa un fitxer amb tota l'agenda. */
export function exportNow({ auto = false } = {}) {
  try {
    download(backupFilename(auto), JSON.stringify(buildBackup(), null, 2));
    markBackupDone();
    toast(auto ? 'Còpia automàtica desada a Baixades.' : 'Còpia desada a Baixades.');
    return true;
  } catch (err) {
    console.error('Error exportant:', err);
    toast('No s\'ha pogut desar la còpia.');
    return false;
  }
}

/* -------------------------------- Importació ----------------------------- */

/**
 * Llegeix i valida un fitxer de còpia sense tocar encara les dades actuals.
 * @param {File} file
 * @returns {Promise<{payload: object, summary: object}>}
 */
export async function readBackupFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El fitxer no és un JSON vàlid.');
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    throw new Error('El fitxer no sembla una còpia de l\'agenda.');
  }
  return {
    payload: parsed,
    summary: {
      fileName: file.name,
      entries: parsed.entries.length,
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects.length : 0,
      className: parsed.settings?.className || null,
      exportedAt: parsed.exportedAt ? formatDateTime(Date.parse(parsed.exportedAt)) : null,
    },
  };
}

/**
 * Aplica una còpia ja llegida.
 * @param {object} payload
 * @param {'merge'|'replace'} mode
 */
export function applyImport(payload, mode) {
  return mode === 'replace'
    ? { mode, ...replaceAll(payload) }
    : { mode, ...mergeAll(payload) };
}

/* ------------------------- Còpies programades ---------------------------- */

export function backupIntervalMs() {
  const { every, unit } = data.settings.backup;
  return every * backupUnit(unit).ms;
}

export function isBackupDue() {
  const { mode, everyChanges, changesSince, lastExportAt } = data.settings.backup;
  if (mode === 'changes') return changesSince >= everyChanges;
  if (mode === 'time') {
    if (!lastExportAt) return true;
    return Date.now() - lastExportAt >= backupIntervalMs();
  }
  return false;
}

let checking = false;

/**
 * Comprova si toca fer una còpia.
 * Amb `fromUserAction` la baixada es dispara sola (el navegador ho permet
 * perquè venim d'un clic); si no, es proposa amb un avís.
 */
export function checkScheduledBackup({ fromUserAction = false } = {}) {
  if (checking || !isBackupDue()) return;
  checking = true;
  try {
    if (fromUserAction) {
      exportNow({ auto: true });
    } else {
      toast('Toca fer una còpia de seguretat de l\'agenda.', {
        action: { label: 'Desar ara', onClick: () => exportNow({ auto: true }) },
      });
    }
  } finally {
    checking = false;
  }
}

/** "cada 30 minuts", "cada hora", "cada 7 dies"… */
export function intervalText() {
  const { every, unit } = data.settings.backup;
  const info = backupUnit(unit);
  return every === 1 ? `cada ${info.one}` : `cada ${every} ${info.label}`;
}

export function backupStatusText() {
  const { mode, everyChanges, changesSince, lastExportAt } = data.settings.backup;
  const last = lastExportAt
    ? `Darrera còpia: ${formatDateTime(lastExportAt)}.`
    : 'Encara no s\'ha fet cap còpia.';
  if (mode === 'changes') {
    return `${last} Se'n proposarà una altra al cap de ${everyChanges} canvis (${changesSince} fets).`;
  }
  if (mode === 'time') return `${last} Se'n proposarà una altra ${intervalText()}.`;
  return `${last} Les còpies automàtiques estan desactivades.`;
}
