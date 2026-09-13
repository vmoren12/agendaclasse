/**
 * Generació del calendari subscribible (iCalendar, RFC 5545).
 *
 * Cada entrada de l'agenda es converteix en un esdeveniment de dia sencer, de
 * manera que els alumnes el poden subscriure al calendari del mòbil i veure les
 * tasques entre els seus propis avisos.
 */

import { TYPE_LABELS } from './store.js';

/** Escapa el text segons la norma: barra, punt i coma, coma i salts de línia. */
function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Plega les línies a 75 octets, comptant bytes UTF-8 i no caràcters, perquè
 * els accents no trenquin el format.
 */
function foldLine(line) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts = [];
  let current = '';
  let bytes = 0;
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = ` ${char}`; // les continuacions comencen amb un espai
      bytes = 1 + size;
      limit = 74;
    } else {
      current += char;
      bytes += size;
    }
  }
  parts.push(current);
  return parts.join('\r\n');
}

function stamp(date = new Date()) {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/** "2026-09-15" -> "20260915" */
function dateValue(key) {
  return key.replace(/-/g, '');
}

/** El dia següent, que és el final (exclusiu) d'un esdeveniment de dia sencer. */
function nextDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + 1);
  return dateValue(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
}

/**
 * @param {{className: string, classId: string, subjects: Array, entries: Array}} source
 * @returns {string} el contingut del fitxer .ics
 */
export function buildCalendar({ className, classId, subjects = [], entries = [] }) {
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const now = stamp();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agendari//Agenda de classe//CA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(className)}`,
    `X-WR-CALDESC:${escapeText(`Agenda de classe de ${className}`)}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    // Indica als calendaris cada quant val la pena tornar a mirar el fitxer.
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
    'X-PUBLISHED-TTL:PT4H',
  ];

  entries.forEach((entry) => {
    const subject = entry.subjectId ? subjectById.get(entry.subjectId) : null;
    const title = [
      entry.done ? '✓' : null,
      subject ? `${subject.name}:` : null,
      entry.title,
    ].filter(Boolean).join(' ');

    const description = [
      TYPE_LABELS[entry.type] || '',
      entry.notes || '',
    ].filter(Boolean).join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${entry.id}@${classId}.agendari`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateValue(entry.date)}`,
      `DTEND;VALUE=DATE:${nextDay(entry.date)}`,
      `SUMMARY:${escapeText(title)}`,
      description ? `DESCRIPTION:${escapeText(description)}` : null,
      `CATEGORIES:${escapeText(TYPE_LABELS[entry.type] || 'Altres')}`,
      // L'hora de modificació serveix de número de seqüència per als calendaris.
      `LAST-MODIFIED:${stamp(new Date(entry.updatedAt || Date.now()))}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');

  return `${lines.filter(Boolean).map(foldLine).join('\r\n')}\r\n`;
}
