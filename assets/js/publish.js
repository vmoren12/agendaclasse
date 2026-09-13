/**
 * Publicació de la classe perquè els alumnes la puguin consultar des de casa.
 *
 * L'agenda es desa com un parell de fitxers (`classes/<id>.json` i
 * `classes/<id>.ics`) al mateix repositori que allotja l'app, fent servir
 * l'API de continguts de GitHub. No hi ha cap servidor propi: qui publica és
 * el navegador del docent, amb un testimoni d'accés que només viu aquí.
 */

import { APP_NAME, DATA_VERSION, data, markPublished } from './store.js';
import { buildCalendar } from './ics.js';

const API = 'https://api.github.com';
const TOKEN_KEY = 'agendari.github.token';

/* -------------------------------- Testimoni ------------------------------- */

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasToken() {
  return Boolean(getToken());
}

/* ------------------------------ Repositori i URL -------------------------- */

/** Dedueix "usuari/repositori" de l'adreça actual quan s'executa a GitHub Pages. */
export function detectRepo() {
  const { hostname, pathname } = window.location;
  if (!hostname.endsWith('.github.io')) return null;
  const owner = hostname.split('.')[0];
  const segment = pathname.split('/').filter(Boolean)[0];
  const repo = segment && !segment.includes('.') ? segment : `${owner}.github.io`;
  return `${owner}/${repo}`;
}

export function currentRepo() {
  return data.settings.publish.repo || detectRepo();
}

/** Adreça pública del lloc, encara que estiguis publicant des de localhost. */
export function publicBase(repo = currentRepo()) {
  if (!repo) return new URL('./', window.location.href).href;
  const [owner, name] = repo.split('/');
  return name.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner}.github.io/`
    : `https://${owner}.github.io/${name}/`;
}

export function studentUrl(classId = data.settings.publish.classId, repo = currentRepo()) {
  return `${publicBase(repo)}?c=${classId}`;
}

export function calendarUrl(classId = data.settings.publish.classId, repo = currentRepo()) {
  return `${publicBase(repo)}classes/${classId}.ics`;
}

export function webcalUrl(classId, repo) {
  return calendarUrl(classId, repo).replace(/^https:/, 'webcal:');
}

/** Enllaç que obre Google Calendar preparat per subscriure's al calendari. */
export function googleCalendarUrl(classId, repo) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarUrl(classId, repo))}`;
}

/** Identificador de classe llegible però no endevinable. */
export function suggestClassId(className) {
  const base = className
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'classe';
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((n) => n.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 6);
  return `${base}-${random}`;
}

/* --------------------------------- Contingut ------------------------------ */

/** El que veuran els alumnes: sense preferències ni dades privades del docent. */
export function buildPayload() {
  return {
    app: APP_NAME,
    version: DATA_VERSION,
    className: data.settings.className,
    publishedAt: new Date().toISOString(),
    subjects: data.subjects,
    entries: data.entries,
  };
}

/** Empremta del contingut (sense la data de publicació) per detectar canvis. */
export function signature() {
  const { publishedAt, ...rest } = buildPayload();
  const text = JSON.stringify(rest);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function hasUnpublishedChanges() {
  const { lastPublishedAt, lastSignature } = data.settings.publish;
  if (!lastPublishedAt) return true;
  return signature() !== lastSignature;
}

/* ----------------------------- API de GitHub ------------------------------ */

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function describeError(response) {
  if (response.status === 401) return 'El testimoni no és vàlid o ha caducat.';
  if (response.status === 403) return 'El testimoni no té permís d\'escriptura en aquest repositori.';
  if (response.status === 404) return 'No s\'ha trobat el repositori, o el testimoni no hi té accés.';
  if (response.status === 409 || response.status === 422) return 'El fitxer ha canviat al repositori. Torna-ho a provar.';
  return `GitHub ha respost ${response.status}.`;
}

/** SHA del fitxer si ja existeix (cal per actualitzar-lo), o null si és nou. */
async function fileSha(repo, path, token) {
  const response = await fetch(`${API}/repos/${repo}/contents/${path}`, { headers: headers(token) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(describeError(response));
  const json = await response.json();
  return json.sha || null;
}

async function putFile(repo, path, content, token, message) {
  const sha = await fileSha(repo, path, token);
  const response = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64(content),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!response.ok) throw new Error(describeError(response));
  return response.json();
}

/**
 * Publica l'agenda i el calendari.
 * @returns {Promise<{classId: string, url: string, calendar: string, entries: number}>}
 */
export async function publishClass() {
  const token = getToken();
  if (!token) throw new Error('Encara no has desat cap testimoni de GitHub.');

  const repo = currentRepo();
  if (!repo) throw new Error('Indica a quin repositori s\'ha de publicar (usuari/repositori).');

  const classId = data.settings.publish.classId;
  if (!classId) throw new Error('Falta l\'identificador de la classe.');

  const payload = buildPayload();
  const calendar = buildCalendar({
    className: payload.className,
    classId,
    subjects: payload.subjects,
    entries: payload.entries,
  });

  const stamp = new Date().toLocaleString('ca-ES');
  await putFile(repo, `classes/${classId}.json`, JSON.stringify(payload, null, 2), token,
    `Agendari: publica ${classId} (${stamp})`);
  await putFile(repo, `classes/${classId}.ics`, calendar, token,
    `Agendari: calendari de ${classId} (${stamp})`);

  markPublished(signature());

  return {
    classId,
    url: studentUrl(classId, repo),
    calendar: calendarUrl(classId, repo),
    entries: payload.entries.length,
  };
}
