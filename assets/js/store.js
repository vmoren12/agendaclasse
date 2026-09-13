/**
 * Estat de l'aplicació i persistència a localStorage.
 *
 * Tota modificació passa per aquest mòdul: desa a disc, actualitza el comptador
 * de canvis de les còpies automàtiques i avisa els subscriptors.
 */

import { isDateKey } from './dates.js';

const STORAGE_KEY = 'agendari.data.v2';
// Claus d'anteriors versions de l'app, per no perdre res en actualitzar.
const LEGACY_KEYS = ['pissarra.data.v2'];
const LEGACY_ENTRIES_KEY = 'classAgenda_entries_v1';

export const APP_NAME = 'Agendari';
export const DATA_VERSION = 2;

/** Unitats disponibles per a les copies automatiques per temps. */
export const BACKUP_UNITS = [
  { id: 'minutes', label: 'minuts', one: 'minut', ms: 60 * 1000, max: 1440 },
  { id: 'hours', label: 'hores', one: 'hora', ms: 60 * 60 * 1000, max: 240 },
  { id: 'days', label: 'dies', one: 'dia', ms: 24 * 60 * 60 * 1000, max: 365 },
  { id: 'weeks', label: 'setmanes', one: 'setmana', ms: 7 * 24 * 60 * 60 * 1000, max: 52 },
];

export function backupUnit(id) {
  return BACKUP_UNITS.find((u) => u.id === id) || BACKUP_UNITS[2];
}

export const TYPES = [
  { id: 'tasca', label: 'Tasca', checkable: true },
  { id: 'deures', label: 'Deures', checkable: true },
  { id: 'data', label: 'Data rellevant', checkable: false },
  { id: 'altres', label: 'Altres', checkable: false },
];

export const TYPE_LABELS = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));
const TYPE_IDS = TYPES.map((t) => t.id);

/** Paleta pensada per llegir-se bé en tema clar i fosc. */
export const PALETTE = [
  '#2F5D50', '#3B7D6E', '#2A6199', '#4E8FD6',
  '#5B4B9B', '#8E6BC4', '#9B3A57', '#C96A8A',
  '#A5432F', '#D1793F', '#A9791F', '#6F6C60',
];

export const ACCENTS = [
  { id: 'verd', label: 'Verd', color: '#2F5D50' },
  { id: 'blau', label: 'Blau', color: '#2A6199' },
  { id: 'magrana', label: 'Magrana', color: '#9B3A57' },
  { id: 'lila', label: 'Lila', color: '#5B4B9B' },
  { id: 'grafit', label: 'Grafit', color: '#3A3A38' },
];

export const VIEWS = ['day', 'week', 'month', 'year', 'agenda'];

const DEFAULT_SUBJECTS = [
  { name: 'Català', color: '#2F5D50' },
  { name: 'Castellà', color: '#A5432F' },
  { name: 'Anglès', color: '#2A6199' },
  { name: 'Matemàtiques', color: '#5B4B9B' },
  { name: 'Medi', color: '#3B7D6E' },
  { name: 'Educació física', color: '#D1793F' },
];

function defaultSettings() {
  return {
    className: 'La meva classe',
    themeMode: 'auto', // auto | light | dark
    accent: 'verd',
    defaultView: 'month',
    backup: {
      mode: 'off', // off | changes | time
      everyChanges: 25,
      every: 7, // quantitat d'unitats entre copies
      unit: 'days', // minutes | hours | days | weeks
      changesSince: 0,
      lastExportAt: null,
    },
  };
}

function defaultData() {
  return {
    version: DATA_VERSION,
    settings: defaultSettings(),
    subjects: DEFAULT_SUBJECTS.map((s) => ({ id: newId('s'), name: s.name, color: s.color })),
    entries: [],
  };
}

export function newId(prefix = 'e') {
  const rand = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/-/g, '');
  return `${prefix}${Date.now().toString(36)}${rand.slice(0, 6)}`;
}

/* ------------------------------ Sanejament ------------------------------- */

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function sanitizeSubject(raw, usedIds) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : '';
  if (!name) return null;
  let id = typeof raw.id === 'string' && raw.id ? raw.id : newId('s');
  while (usedIds.has(id)) id = newId('s');
  usedIds.add(id);
  return { id, name, color: isHexColor(raw.color) ? raw.color : PALETTE[0] };
}

function sanitizeEntry(raw, subjectIds, usedIds) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isDateKey(raw.date)) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : '';
  if (!title) return null;
  let id = typeof raw.id === 'string' && raw.id ? raw.id : newId('e');
  while (usedIds.has(id)) id = newId('e');
  usedIds.add(id);
  return {
    id,
    date: raw.date,
    title,
    type: TYPE_IDS.includes(raw.type) ? raw.type : 'altres',
    subjectId: subjectIds.has(raw.subjectId) ? raw.subjectId : null,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '',
    done: Boolean(raw.done),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
  };
}

/** Converteix qualsevol objecte extern en dades vàlides de l'aplicació. */
export function sanitizeData(raw) {
  const base = defaultData();
  if (!raw || typeof raw !== 'object') return base;

  const settings = { ...base.settings, ...(raw.settings || {}) };
  settings.backup = { ...base.settings.backup, ...((raw.settings || {}).backup || {}) };
  if (typeof settings.className !== 'string' || !settings.className.trim()) {
    settings.className = base.settings.className;
  }
  settings.className = settings.className.trim().slice(0, 80);
  if (!['auto', 'light', 'dark'].includes(settings.themeMode)) settings.themeMode = 'auto';
  if (!ACCENTS.some((a) => a.id === settings.accent)) settings.accent = 'verd';
  if (!VIEWS.includes(settings.defaultView)) settings.defaultView = 'month';
  if (!['off', 'changes', 'time'].includes(settings.backup.mode)) settings.backup.mode = 'off';
  settings.backup.everyChanges = clampInt(settings.backup.everyChanges, 1, 999, 25);
  // Versions anteriors nomes comptaven dies.
  if (settings.backup.everyDays !== undefined && raw.settings?.backup?.every === undefined) {
    settings.backup.every = settings.backup.everyDays;
    settings.backup.unit = 'days';
  }
  delete settings.backup.everyDays;
  if (!BACKUP_UNITS.some((u) => u.id === settings.backup.unit)) settings.backup.unit = 'days';
  settings.backup.every = clampInt(settings.backup.every, 1, backupUnit(settings.backup.unit).max, 7);
  settings.backup.changesSince = clampInt(settings.backup.changesSince, 0, 99999, 0);
  if (!Number.isFinite(settings.backup.lastExportAt)) settings.backup.lastExportAt = null;

  const subjectIds = new Set();
  const subjects = Array.isArray(raw.subjects)
    ? raw.subjects.map((s) => sanitizeSubject(s, subjectIds)).filter(Boolean)
    : base.subjects;

  const validSubjectIds = new Set(subjects.map((s) => s.id));
  const entryIds = new Set();
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map((e) => sanitizeEntry(e, validSubjectIds, entryIds)).filter(Boolean)
    : [];

  return { version: DATA_VERSION, settings, subjects, entries };
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------ Persistència ----------------------------- */

function readStorage() {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return sanitizeData(JSON.parse(raw));
    } catch (err) {
      console.warn(`No s'han pogut llegir les dades de ${key}:`, err);
    }
  }
  return migrateLegacy();
}

/** Recupera les entrades de la primera versió de l'agenda, si n'hi ha. */
function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_ENTRIES_KEY);
    if (!raw) return defaultData();
    const legacy = JSON.parse(raw);
    if (!Array.isArray(legacy) || legacy.length === 0) return defaultData();
    const data = defaultData();
    data.entries = sanitizeData({ ...data, entries: legacy }).entries;
    return data;
  } catch (err) {
    console.warn('No s\'han pogut migrar les dades antigues:', err);
    return defaultData();
  }
}

export const data = readStorage();

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(detail = {}) {
  listeners.forEach((listener) => listener(detail));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('No s\'ha pogut desar:', err);
    return false;
  }
}

/**
 * Desa i avisa. `countsAsChange` distingeix els canvis de contingut (compten
 * per a les còpies automàtiques) dels canvis de preferències.
 */
function commit({ countsAsChange = true, reason = 'data' } = {}) {
  if (countsAsChange) data.settings.backup.changesSince += 1;
  const ok = persist();
  notify({ reason, saved: ok });
  return ok;
}

/* --------------------------------- Entrades ------------------------------ */

export function getEntry(id) {
  return data.entries.find((e) => e.id === id) || null;
}

export function entriesOn(dateKey) {
  return data.entries
    .filter((e) => e.date === dateKey)
    .sort(compareEntries);
}

export function entriesBetween(startKey, endKey) {
  return data.entries.filter((e) => e.date >= startKey && e.date <= endKey);
}

export function compareEntries(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.title.localeCompare(b.title, 'ca');
}

export function addEntry(values) {
  const entry = {
    id: newId('e'),
    date: values.date,
    title: values.title,
    type: TYPE_IDS.includes(values.type) ? values.type : 'altres',
    subjectId: values.subjectId || null,
    notes: values.notes || '',
    done: Boolean(values.done),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  data.entries.push(entry);
  commit();
  return entry;
}

export function updateEntry(id, values) {
  const entry = getEntry(id);
  if (!entry) return null;
  Object.assign(entry, values, { updatedAt: Date.now() });
  commit();
  return entry;
}

export function deleteEntry(id) {
  const before = data.entries.length;
  data.entries = data.entries.filter((e) => e.id !== id);
  if (data.entries.length !== before) commit();
}

export function toggleDone(id) {
  const entry = getEntry(id);
  if (!entry) return;
  entry.done = !entry.done;
  entry.updatedAt = Date.now();
  commit();
}

/* -------------------------------- Matèries ------------------------------- */

export function getSubject(id) {
  return data.subjects.find((s) => s.id === id) || null;
}

/** Color amb què es pinta una entrada: el de la matèria o, si no en té, el del tipus. */
export function entryColor(entry) {
  const subject = entry.subjectId ? getSubject(entry.subjectId) : null;
  return subject ? subject.color : `var(--t-${entry.type})`;
}

export function countEntriesBySubject(subjectId) {
  return data.entries.filter((e) => e.subjectId === subjectId).length;
}

export function addSubject(name = 'Matèria nova', color) {
  const used = new Set(data.subjects.map((s) => s.color));
  const nextColor = color || PALETTE.find((c) => !used.has(c)) || PALETTE[0];
  const subject = { id: newId('s'), name, color: nextColor };
  data.subjects.push(subject);
  commit({ countsAsChange: false, reason: 'subjects' });
  return subject;
}

export function updateSubject(id, values) {
  const subject = getSubject(id);
  if (!subject) return;
  Object.assign(subject, values);
  commit({ countsAsChange: false, reason: 'subjects' });
}

export function deleteSubject(id) {
  data.subjects = data.subjects.filter((s) => s.id !== id);
  data.entries.forEach((e) => {
    if (e.subjectId === id) e.subjectId = null;
  });
  commit({ countsAsChange: false, reason: 'subjects' });
}

/* ------------------------------ Preferències ----------------------------- */

export function updateSettings(patch) {
  Object.assign(data.settings, patch);
  commit({ countsAsChange: false, reason: 'settings' });
}

export function updateBackupSettings(patch) {
  Object.assign(data.settings.backup, patch);
  commit({ countsAsChange: false, reason: 'settings' });
}

/** Marca que s'acaba de fer una còpia: reinicia comptadors. */
export function markBackupDone(timestamp = Date.now()) {
  data.settings.backup.lastExportAt = timestamp;
  data.settings.backup.changesSince = 0;
  commit({ countsAsChange: false, reason: 'backup' });
}

/* --------------------------- Importació / esborrat ----------------------- */

export function replaceAll(incoming) {
  const clean = sanitizeData(incoming);
  data.settings = clean.settings;
  data.subjects = clean.subjects;
  data.entries = clean.entries;
  commit({ countsAsChange: false, reason: 'import' });
  return { entries: clean.entries.length, subjects: clean.subjects.length };
}

/**
 * Combina les dades rebudes amb les actuals: les matèries es reaprofiten pel
 * nom i les entrades repetides es queden amb la versió modificada més tard.
 */
export function mergeAll(incoming) {
  const clean = sanitizeData(incoming);

  const byName = new Map(data.subjects.map((s) => [s.name.toLowerCase(), s]));
  const subjectMap = new Map(); // id extern -> id local
  let addedSubjects = 0;
  clean.subjects.forEach((s) => {
    const existing = byName.get(s.name.toLowerCase()) || data.subjects.find((x) => x.id === s.id);
    if (existing) {
      subjectMap.set(s.id, existing.id);
    } else {
      const copy = { id: newId('s'), name: s.name, color: s.color };
      data.subjects.push(copy);
      byName.set(copy.name.toLowerCase(), copy);
      subjectMap.set(s.id, copy.id);
      addedSubjects += 1;
    }
  });

  let added = 0;
  let updated = 0;
  clean.entries.forEach((incomingEntry) => {
    const entry = { ...incomingEntry, subjectId: subjectMap.get(incomingEntry.subjectId) || null };
    const existing = getEntry(entry.id);
    if (!existing) {
      data.entries.push(entry);
      added += 1;
    } else if (entry.updatedAt > existing.updatedAt) {
      Object.assign(existing, entry);
      updated += 1;
    }
  });

  commit({ countsAsChange: false, reason: 'import' });
  return { added, updated, addedSubjects };
}

export function clearEntries() {
  data.entries = [];
  commit({ countsAsChange: false, reason: 'clear' });
}
