/**
 * Còpies de seguretat: exportació i importació en JSON, més les còpies
 * automàtiques programades (cada X canvis o cada X dies).
 */

import { APP_NAME, DATA_VERSION, data, markBackupDone, mergeAll, replaceAll } from './store.js';
import { formatDateTime, toKey, today } from './dates.js';
import { toast } from './toast.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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
  return `agenda-${slug(data.settings.className)}-${toKey(today())}${auto ? '-auto' : ''}.json`;
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

/**
 * Llegeix un fitxer JSON i el combina o el substitueix.
 * @param {File} file
 * @param {'merge'|'replace'} mode
 */
export async function importFromFile(file, mode = 'merge') {
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
  return mode === 'replace' ? { mode, ...replaceAll(parsed) } : { mode, ...mergeAll(parsed) };
}

/* ------------------------- Còpies programades ---------------------------- */

export function isBackupDue() {
  const { mode, everyChanges, everyDays, changesSince, lastExportAt } = data.settings.backup;
  if (mode === 'changes') return changesSince >= everyChanges;
  if (mode === 'time') {
    if (!lastExportAt) return true;
    return Date.now() - lastExportAt >= everyDays * DAY_MS;
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

export function backupStatusText() {
  const { mode, everyChanges, everyDays, changesSince, lastExportAt } = data.settings.backup;
  const last = lastExportAt ? `Darrera còpia: ${formatDateTime(lastExportAt)}.` : 'Encara no s\'ha fet cap còpia.';
  if (mode === 'changes') return `${last} Se\'n farà una altra al cap de ${everyChanges} canvis (${changesSince} fets).`;
  if (mode === 'time') return `${last} Se\'n farà una altra cada ${everyDays} dies.`;
  return `${last} Les còpies automàtiques estan desactivades.`;
}
