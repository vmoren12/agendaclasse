/**
 * Agendari — agenda de classe.
 * Punt d'entrada: connecta estat, vistes i diàlegs, i engega la PWA.
 *
 * L'app té dos modes. En mode docent s'edita l'agenda d'aquest navegador i es
 * pot publicar. En mode alumne (`?c=<classe>`) es mostra, només per llegir, la
 * còpia publicada d'una classe, sense tocar mai les dades locals.
 */

import { $ } from './dom.js';
import {
  addDays, addMonths, addYears, fromKey, startOfDay, timeAgo, toKey, today,
} from './dates.js';
import { APP_NAME, VIEWS, data, isReadOnly, subscribe, toggleDone, usePublishedDataset } from './store.js';
import { applyTheme } from './theme.js';
import { render, setActions } from './views.js';
import {
  fillStaticSelects, initDialogs, openCalendarDialog, openEntryDialog, openSettings,
} from './dialogs.js';
import { checkScheduledBackup } from './backup.js';
import { hasToken } from './publish.js';
import {
  classIdFromUrl, fetchClass, forgetClass, readCache, rememberClass, rememberedClassId,
} from './classfeed.js';
import { toast } from './toast.js';

const ui = {
  view: data.settings.defaultView,
  refDate: today(),
  classId: null, // només en mode alumne
  className: null, // nom publicat de la classe
  fetchedAt: null,
};

/* --------------------------------- Accions ------------------------------- */

const actions = {
  openEntry: (id) => openEntryDialog({ id }),
  newEntry: (dateKey) => openEntryDialog({ dateKey }),
  toggleDone: (id) => toggleDone(id),
  goToDay: (date) => {
    ui.refDate = startOfDay(date);
    ui.view = 'day';
    draw();
  },
  goToMonth: (date) => {
    ui.refDate = startOfDay(date);
    ui.view = 'month';
    draw();
  },
};

function draw() {
  render(ui);
  const name = ui.className || data.settings.className;
  $('#className').textContent = name;
  document.title = `${APP_NAME} · ${name}`;
  if (ui.classId) {
    $('#classBannerTime').textContent = ui.fetchedAt
      ? `Actualitzat ${timeAgo(ui.fetchedAt)}`
      : 'Sense connexió amb la classe';
  }
}

function shiftPeriod(direction) {
  if (ui.view === 'day') ui.refDate = addDays(ui.refDate, direction);
  else if (ui.view === 'week') ui.refDate = addDays(ui.refDate, direction * 7);
  else if (ui.view === 'month') ui.refDate = addMonths(ui.refDate, direction);
  else if (ui.view === 'year') ui.refDate = addYears(ui.refDate, direction);
  else return;
  draw();
}

function newEntryHere() {
  if (isReadOnly()) return;
  const useRef = ui.view === 'day' || ui.view === 'week';
  openEntryDialog({ dateKey: toKey(useRef ? ui.refDate : today()) });
}

/* -------------------------------- Connexions ----------------------------- */

function wireControls() {
  $('#viewSwitch').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (!button) return;
    ui.view = button.dataset.view;
    draw();
  });

  $('#prevBtn').addEventListener('click', () => shiftPeriod(-1));
  $('#nextBtn').addEventListener('click', () => shiftPeriod(1));
  $('#todayBtn').addEventListener('click', () => {
    ui.refDate = today();
    draw();
  });

  $('#btnNew').addEventListener('click', newEntryHere);
  $('#btnNewFab').addEventListener('click', newEntryHere);
  $('#btnSettings').addEventListener('click', openSettings);
  $('#className').addEventListener('click', () => {
    if (isReadOnly()) return;
    openSettings();
    setTimeout(() => {
      const input = $('#setClassName');
      input.focus();
      input.select();
    }, 60);
  });

  $('#btnRefreshClass').addEventListener('click', () => refreshClass({ manual: true }));
  $('#btnCalendar').addEventListener('click', () => openCalendarDialog(ui.classId));
}

function wireKeyboard() {
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target instanceof Element
      && target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.querySelector('dialog[open]')) return;

    if (event.key === 'ArrowLeft') shiftPeriod(-1);
    else if (event.key === 'ArrowRight') shiftPeriod(1);
    else if (event.key === 'n') {
      event.preventDefault();
      newEntryHere();
    } else if (event.key === 't') {
      ui.refDate = today();
      draw();
    } else if (/^[1-5]$/.test(event.key)) {
      ui.view = VIEWS[Number(event.key) - 1];
      draw();
    }
  });
}

/** Paràmetres d'arrencada (dreceres de la PWA): ?view=day, ?action=new */
function applyLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (VIEWS.includes(view)) ui.view = view;
  const date = params.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ui.refDate = fromKey(date);
  if (params.get('action') === 'new') setTimeout(() => newEntryHere(), 120);

  // Netegem els paràmetres d'un sol ús, però mantenim el de la classe:
  // és el que fa que l'enllaç dels alumnes es pugui desar als preferits.
  ['view', 'date', 'action', 'mode'].forEach((key) => params.delete(key));
  const query = params.toString();
  window.history.replaceState({}, '', query ? `?${query}` : window.location.pathname);
}

/* ------------------------------- Mode alumne ------------------------------ */

/**
 * Decideix quina classe s'ha de mostrar:
 * l'enllaç mana sobre tot; si no n'hi ha, es recorda l'última consultada,
 * tret que aquest navegador sigui el de qui publica (té testimoni desat).
 */
function resolveClassId() {
  const fromUrl = classIdFromUrl();
  if (fromUrl) {
    rememberClass(fromUrl);
    return fromUrl;
  }
  if (new URLSearchParams(window.location.search).get('mode') === 'teacher') {
    forgetClass();
    return null;
  }
  return hasToken() ? null : rememberedClassId();
}

function startStudentMode(classId) {
  ui.classId = classId;
  $('#classBanner').hidden = false;
  $('#btnNew').hidden = true;
  $('#btnNewFab').hidden = true;
  $('#className').disabled = true;
  document.body.dataset.mode = 'student';

  const cached = readCache(classId);
  if (cached) {
    usePublishedDataset(cached.payload);
    ui.className = cached.payload.className || null;
    ui.fetchedAt = cached.fetchedAt || null;
  } else {
    // Encara no hi ha res desat: buidem l'agenda local de la vista.
    usePublishedDataset({ subjects: [], entries: [] });
  }
}

let lastRefresh = 0;

async function refreshClass({ manual = false } = {}) {
  if (!ui.classId) return;
  if (!manual && Date.now() - lastRefresh < 60 * 1000) return;
  lastRefresh = Date.now();

  const button = $('#btnRefreshClass');
  button.disabled = true;
  try {
    const { payload, fetchedAt } = await fetchClass(ui.classId);
    usePublishedDataset(payload);
    ui.className = payload.className || null;
    ui.fetchedAt = fetchedAt;
    draw();
    if (manual) toast('Agenda actualitzada.');
  } catch (err) {
    if (manual) toast(err.message || 'No s\'ha pogut actualitzar.');
    else console.warn('No s\'ha pogut actualitzar la classe:', err);
  } finally {
    button.disabled = false;
  }
}

function leaveClass() {
  forgetClass();
  window.location.href = window.location.pathname;
}

/* ----------------------------------- PWA --------------------------------- */

let installPrompt = null;

function initPwa() {
  if (window.location.protocol === 'file:') {
    $('#fileWarning').style.display = 'block';
    return;
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('No s\'ha pogut registrar el service worker:', err);
      });
    });
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    const button = $('#btnInstall');
    if (button) button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    toast('Agendari instal·lat. Ja el pots obrir com una app.');
  });
}

async function install() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#btnInstall').hidden = true;
}

/* ----------------------------------- Inici -------------------------------- */

function init() {
  applyTheme(data.settings);
  fillStaticSelects();
  setActions(actions);
  initDialogs({
    canInstall: () => Boolean(installPrompt),
    install,
    leaveClass,
    onEntrySaved: (dateKey) => {
      if (ui.view === 'day' || ui.view === 'week') ui.refDate = fromKey(dateKey);
    },
  });
  wireControls();
  wireKeyboard();

  const classId = resolveClassId();
  if (classId) startStudentMode(classId);

  applyLaunchParams();
  draw();

  subscribe((detail) => {
    draw();
    if (detail.saved === false) {
      toast('No s\'ha pogut desar al navegador. Fes una còpia de seguretat.');
    } else if (detail.reason === 'data') {
      checkScheduledBackup({ fromUserAction: true });
    }
  });

  initPwa();

  if (ui.classId) {
    refreshClass();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshClass();
    });
    return;
  }

  setTimeout(() => checkScheduledBackup(), 1500);
  // Les còpies programades per temps poden vèncer amb l'app oberta.
  setInterval(() => checkScheduledBackup(), 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkScheduledBackup();
  });
}

init();
