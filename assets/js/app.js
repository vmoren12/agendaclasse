/**
 * Pissarra — agenda de classe.
 * Punt d'entrada: connecta estat, vistes i diàlegs, i engega la PWA.
 */

import { $ } from './dom.js';
import { addDays, addMonths, addYears, fromKey, startOfDay, toKey, today } from './dates.js';
import { APP_NAME, VIEWS, data, subscribe, toggleDone } from './store.js';
import { applyTheme } from './theme.js';
import { render, setActions } from './views.js';
import { fillStaticSelects, initDialogs, openEntryDialog, openSettings } from './dialogs.js';
import { checkScheduledBackup } from './backup.js';
import { toast } from './toast.js';

const ui = {
  view: data.settings.defaultView,
  refDate: today(),
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
  $('#className').textContent = data.settings.className;
  document.title = `${APP_NAME} · ${data.settings.className}`;
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
    openSettings();
    setTimeout(() => {
      const input = $('#setClassName');
      input.focus();
      input.select();
    }, 60);
  });
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
  if (params.get('action') === 'new') {
    setTimeout(() => newEntryHere(), 120);
  }
  if (params.toString()) {
    window.history.replaceState({}, '', window.location.pathname);
  }
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
    toast('Pissarra instal·lada. Ja la pots obrir com una app.');
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
    onEntrySaved: (dateKey) => {
      if (ui.view === 'day' || ui.view === 'week') ui.refDate = fromKey(dateKey);
    },
  });
  wireControls();
  wireKeyboard();
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
  setTimeout(() => checkScheduledBackup(), 1500);
}

init();
