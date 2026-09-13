/** Aplica el tema (clar / fosc / automàtic) i el color d'accent. */

import { ACCENTS } from './store.js';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let current = { themeMode: 'auto', accent: 'verd' };

function resolveMode(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return darkQuery.matches ? 'dark' : 'light';
}

export function applyTheme(settings) {
  current = { themeMode: settings.themeMode, accent: settings.accent };
  const mode = resolveMode(settings.themeMode);
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.accent = settings.accent;

  const accent = ACCENTS.find((a) => a.id === settings.accent) || ACCENTS[0];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#15171A' : accent.color);
}

darkQuery.addEventListener('change', () => {
  if (current.themeMode === 'auto') applyTheme(current);
});
