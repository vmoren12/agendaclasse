/**
 * Utilitats de dates. Tot es treballa en hora local i les claus de dia
 * sempre tenen el format ISO curt "AAAA-MM-DD".
 */

export const WEEKDAYS_SHORT = ['dg', 'dl', 'dt', 'dc', 'dj', 'dv', 'ds']; // getDay(): 0 = diumenge
export const WEEKDAYS_LONG = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
export const WEEKDAYS_FROM_MONDAY = ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'];
export const MONTHS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function today() {
  return startOfDay(new Date());
}

/** Data -> "AAAA-MM-DD" */
export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "AAAA-MM-DD" -> Data local a les 00:00 */
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function addYears(date, n) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + n);
  return d;
}

/** Dilluns de la setmana a la qual pertany la data. */
export function mondayOf(date) {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Dilluns, 3 de març de 2026" */
export function formatLong(date) {
  return `${capitalize(WEEKDAYS_LONG[date.getDay()])}, ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

/** "3 març 2026" */
export function formatShort(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(timestamp) {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
