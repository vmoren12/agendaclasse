/**
 * Vista d'alumne: llegeix una classe publicada i la manté al dia.
 *
 * La còpia baixada es desa en una clau pròpia del navegador, separada de
 * l'agenda local, perquè consultar una classe no toqui mai les dades de qui la
 * consulta (per exemple, si el docent obre el seu propi enllaç d'alumne).
 */

const CACHE_PREFIX = 'agendari.class.';
const REMEMBER_KEY = 'agendari.student.class';

export function classIdFromUrl() {
  const value = new URLSearchParams(window.location.search).get('c');
  return /^[a-z0-9][a-z0-9-]{2,59}$/.test(value || '') ? value : null;
}

export function rememberedClassId() {
  try {
    const value = localStorage.getItem(REMEMBER_KEY);
    return /^[a-z0-9][a-z0-9-]{2,59}$/.test(value || '') ? value : null;
  } catch {
    return null;
  }
}

export function rememberClass(classId) {
  try {
    localStorage.setItem(REMEMBER_KEY, classId);
  } catch { /* sense memòria: caldrà tornar a obrir l'enllaç */ }
}

export function forgetClass() {
  try {
    const classId = rememberedClassId();
    localStorage.removeItem(REMEMBER_KEY);
    if (classId) localStorage.removeItem(CACHE_PREFIX + classId);
  } catch { /* res a fer */ }
}

/** Última còpia baixada, per pintar l'agenda a l'instant i funcionar sense connexió. */
export function readCache(classId) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + classId);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached && cached.payload ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(classId, payload) {
  try {
    localStorage.setItem(CACHE_PREFIX + classId, JSON.stringify({ payload, fetchedAt: Date.now() }));
  } catch (err) {
    console.warn('No s\'ha pogut desar la còpia de la classe:', err);
  }
}

/**
 * Baixa la classe publicada. El paràmetre de temps evita que la memòria cau
 * del CDN de GitHub Pages serveixi una versió antiga.
 * @returns {Promise<{payload: object, fetchedAt: number}>}
 */
export async function fetchClass(classId) {
  const url = new URL(`./classes/${classId}.json?t=${Date.now()}`, window.location.href);
  const response = await fetch(url, { cache: 'no-store' });

  if (response.status === 404) {
    throw new Error('Aquesta classe encara no està publicada o l\'enllaç no és correcte.');
  }
  if (!response.ok) throw new Error(`No s'ha pogut llegir la classe (${response.status}).`);

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.entries)) {
    throw new Error('El contingut publicat no té el format esperat.');
  }

  writeCache(classId, payload);
  return { payload, fetchedAt: Date.now() };
}
