/**
 * Dibuix de les cinc vistes (dia, setmana, mes, any i agenda).
 * Cap funció d'aquest mòdul modifica dades: només llegeix l'estat i crida
 * les accions que rep de l'aplicació.
 */

import { $, clear, el } from './dom.js';
import {
  MONTHS, WEEKDAYS_LONG, WEEKDAYS_SHORT, addDays, capitalize, formatShort,
  fromKey, isSameDay, mondayOf, toKey, today,
} from './dates.js';
import {
  TYPE_LABELS, TYPES, compareEntries, data, entriesOn, entryColor, getSubject,
} from './store.js';

const MAX_PILLS = 3;
const checkableTypes = new Set(TYPES.filter((t) => t.checkable).map((t) => t.id));

let actions = {};

export function setActions(next) {
  actions = next;
}

/* --------------------------------- Peces --------------------------------- */

function subjectChip(entry) {
  const subject = entry.subjectId ? getSubject(entry.subjectId) : null;
  if (!subject) return null;
  return el('span', {
    class: 'subject-chip',
    style: `--c:${subject.color}`,
    text: subject.name,
  });
}

function editIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 20h4l10-10-4-4L4 16v4zM14.5 5.5l4 4');
  svg.append(path);
  return svg;
}

export function entryCard(entry) {
  const color = entryColor(entry);
  const card = el('article', {
    class: `entry-card${entry.done ? ' done' : ''}`,
    style: `--c:${color}`,
  });

  if (checkableTypes.has(entry.type)) {
    card.append(el('button', {
      class: 'check',
      type: 'button',
      'aria-pressed': String(Boolean(entry.done)),
      'aria-label': entry.done ? `Desmarcar "${entry.title}"` : `Marcar "${entry.title}" com a feta`,
      onClick: () => actions.toggleDone(entry.id),
    }));
  }

  const top = el('div', { class: 'entry-top-row' }, [
    el('span', { class: `badge ${entry.type}`, text: TYPE_LABELS[entry.type] }),
    subjectChip(entry),
    el('span', { class: 'entry-title', text: entry.title }),
  ]);

  const main = el('div', { class: 'entry-main' }, [top]);
  if (entry.notes) main.append(el('p', { class: 'entry-notes', text: entry.notes }));
  card.append(main);

  card.append(el('div', { class: 'entry-actions' }, [
    el('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': `Editar "${entry.title}"`,
      onClick: () => actions.openEntry(entry.id),
    }, [editIcon(), el('span', { text: 'Editar' })]),
  ]));

  return card;
}

function emptyMessage(text) {
  return el('p', { class: 'empty-msg', text });
}

/* --------------------------------- Vistes -------------------------------- */

function renderDay(refDate) {
  $('#dayNum').textContent = String(refDate.getDate());
  $('#dayTxt').textContent = `${capitalize(WEEKDAYS_LONG[refDate.getDay()])} · ${MONTHS[refDate.getMonth()]} ${refDate.getFullYear()}`;

  const list = clear($('#dayList'));
  const entries = entriesOn(toKey(refDate));
  if (entries.length === 0) {
    list.append(emptyMessage('No hi ha cap entrada per a aquest dia.'));
    return;
  }
  entries.forEach((entry) => list.append(entryCard(entry)));
}

function renderWeek(refDate) {
  const grid = clear($('#weekGrid'));
  const monday = mondayOf(refDate);
  const now = today();

  for (let i = 0; i < 7; i += 1) {
    const day = addDays(monday, i);
    const isToday = isSameDay(day, now);
    const col = el('div', { class: `week-col${isToday ? ' today' : ''}` });

    col.append(el('button', {
      class: 'week-col-head',
      type: 'button',
      'aria-label': `Veure el dia ${formatShort(day)}`,
      onClick: () => actions.goToDay(day),
    }, [
      el('div', { class: 'wd', text: WEEKDAYS_SHORT[day.getDay()] }),
      el('div', { class: 'dn', text: String(day.getDate()) }),
    ]));

    const body = el('div', { class: 'week-col-body' });
    entriesOn(toKey(day)).forEach((entry) => {
      body.append(el('button', {
        class: `mini-entry${entry.done ? ' done' : ''}`,
        type: 'button',
        style: `--c:${entryColor(entry)}`,
        text: entry.title,
        onClick: () => actions.openEntry(entry.id),
      }));
    });
    body.append(el('button', {
      class: 'add-in-cell',
      type: 'button',
      text: '+ afegir',
      'aria-label': `Afegir una entrada el ${formatShort(day)}`,
      onClick: () => actions.newEntry(toKey(day)),
    }));

    col.append(body);
    grid.append(col);
  }
}

function renderMonth(refDate) {
  const grid = clear($('#monthGrid'));
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const gridStart = mondayOf(new Date(year, month, 1));
  const now = today();

  for (let i = 0; i < 42; i += 1) {
    const day = addDays(gridStart, i);
    const outside = day.getMonth() !== month;

    // No dibuixem setmanes senceres del mes següent.
    if (outside && i >= 28 && day > new Date(year, month + 1, 0) && day.getDay() === 1) break;

    const entries = entriesOn(toKey(day));
    const cell = el('button', {
      class: `month-cell${outside ? ' outside' : ''}${isSameDay(day, now) ? ' today' : ''}`,
      type: 'button',
      'aria-label': `${formatShort(day)}, ${entries.length} ${entries.length === 1 ? 'entrada' : 'entrades'}`,
      onClick: () => actions.goToDay(day),
    }, [el('span', { class: 'cell-num', text: String(day.getDate()) })]);

    const pills = el('div', { class: 'cell-entries' });
    entries.slice(0, MAX_PILLS).forEach((entry) => {
      pills.append(el('span', {
        class: `pill${entry.done ? ' done' : ''}`,
        style: `--c:${entryColor(entry)}`,
        text: entry.title,
      }));
    });
    if (entries.length > MAX_PILLS) {
      pills.append(el('span', { class: 'more-link', text: `+${entries.length - MAX_PILLS} més` }));
    }
    cell.append(pills);

    const dots = el('div', { class: 'cell-dots', 'aria-hidden': 'true' });
    entries.slice(0, 4).forEach((entry) => {
      dots.append(el('i', { style: `--c:${entryColor(entry)}` }));
    });
    cell.append(dots);

    grid.append(cell);
  }
}

function renderYear(refDate) {
  const grid = clear($('#yearGrid'));
  const year = refDate.getFullYear();
  const now = today();

  for (let month = 0; month < 12; month += 1) {
    const box = el('div', { class: 'mini-month' }, [
      el('h3', {}, [
        el('button', {
          class: 'link-month',
          type: 'button',
          text: capitalize(MONTHS[month]),
          onClick: () => actions.goToMonth(new Date(year, month, 1)),
        }),
      ]),
    ]);

    const mg = el('div', { class: 'mini-month-grid' });
    ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'].forEach((wd) => {
      mg.append(el('span', { class: 'mwd', text: wd }));
    });

    const gridStart = mondayOf(new Date(year, month, 1));
    for (let i = 0; i < 42; i += 1) {
      const day = addDays(gridStart, i);
      const outside = day.getMonth() !== month;
      if (outside && i >= 28 && day > new Date(year, month + 1, 0) && day.getDay() === 1) break;

      if (outside) {
        mg.append(el('span', { class: 'mini-day outside', text: '·' }));
        continue;
      }
      const entries = entriesOn(toKey(day));
      const cell = el('button', {
        class: `mini-day${isSameDay(day, now) ? ' today' : ''}`,
        type: 'button',
        text: String(day.getDate()),
        'aria-label': `${formatShort(day)}${entries.length ? `, ${entries.length} entrades` : ''}`,
        onClick: () => actions.goToDay(day),
      });
      if (entries.length > 0) {
        cell.append(el('i', { class: 'mdot', style: `--c:${entryColor(entries[0])}` }));
      }
      mg.append(cell);
    }

    box.append(mg);
    grid.append(box);
  }
}

function renderAgenda() {
  const wrap = clear($('#agendaList'));
  if (data.entries.length === 0) {
    wrap.append(emptyMessage('Encara no hi ha cap entrada a l\'agenda.'));
    return;
  }

  const now = today();
  const nowKey = toKey(now);
  const byDate = new Map();
  data.entries
    .slice()
    .sort((a, b) => (a.date === b.date ? compareEntries(a, b) : (a.date < b.date ? -1 : 1)))
    .forEach((entry) => {
      if (!byDate.has(entry.date)) byDate.set(entry.date, []);
      byDate.get(entry.date).push(entry);
    });

  byDate.forEach((entries, key) => {
    const date = fromKey(key);
    const isToday = key === nowKey;
    const group = el('section', { class: 'agenda-group' }, [
      el('header', {
        class: `agenda-date-head${isToday ? ' is-today' : ''}${key < nowKey ? ' is-past' : ''}`,
      }, [
        el('span', {
          class: 'd1',
          text: `${capitalize(WEEKDAYS_LONG[date.getDay()])} ${date.getDate()} ${MONTHS[date.getMonth()]}`,
        }),
        el('span', { class: 'd2', text: `${date.getFullYear()}${isToday ? ' · avui' : ''}` }),
      ]),
    ]);
    const list = el('div', { class: 'entry-list' });
    entries.forEach((entry) => list.append(entryCard(entry)));
    group.append(list);
    wrap.append(group);
  });
}

/* ------------------------------- Orquestració ---------------------------- */

function periodLabel(view, refDate) {
  if (view === 'day') {
    return `${capitalize(WEEKDAYS_LONG[refDate.getDay()])}, ${refDate.getDate()} ${MONTHS[refDate.getMonth()]} ${refDate.getFullYear()}`;
  }
  if (view === 'week') {
    const monday = mondayOf(refDate);
    const sunday = addDays(monday, 6);
    return monday.getMonth() === sunday.getMonth()
      ? `${monday.getDate()}–${sunday.getDate()} ${MONTHS[monday.getMonth()]} ${monday.getFullYear()}`
      : `${monday.getDate()} ${MONTHS[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()]} ${sunday.getFullYear()}`;
  }
  if (view === 'month') return `${capitalize(MONTHS[refDate.getMonth()])} ${refDate.getFullYear()}`;
  if (view === 'year') return String(refDate.getFullYear());
  return 'Totes les entrades';
}

const renderers = {
  day: renderDay,
  week: renderWeek,
  month: renderMonth,
  year: renderYear,
  agenda: renderAgenda,
};

export function render({ view, refDate }) {
  document.querySelectorAll('#viewSwitch button').forEach((button) => {
    button.setAttribute('aria-current', String(button.dataset.view === view));
  });
  document.querySelectorAll('.view').forEach((section) => {
    const active = section.id === `view-${view}`;
    section.classList.toggle('active', active);
    section.hidden = !active;
  });

  $('#periodLabel').textContent = periodLabel(view, refDate);
  const navDisabled = view === 'agenda';
  $('#prevBtn').disabled = navDisabled;
  $('#nextBtn').disabled = navDisabled;

  renderers[view](refDate);
}
