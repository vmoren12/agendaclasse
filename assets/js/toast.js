/** Avisos breus a la part inferior de la pantalla. */

import { el } from './dom.js';

let area = null;

function ensureArea() {
  if (!area) {
    area = el('div', { class: 'toast-area', role: 'status', 'aria-live': 'polite' });
    document.body.append(area);
  }
  return area;
}

/**
 * @param {string} message
 * @param {{action?: {label: string, onClick: Function}, duration?: number}} options
 */
export function toast(message, options = {}) {
  const { action, duration = action ? 12000 : 3600 } = options;
  const node = el('div', { class: 'toast' }, [el('span', { text: message })]);

  if (action) {
    node.append(el('button', {
      type: 'button',
      text: action.label,
      onClick: () => {
        node.remove();
        action.onClick();
      },
    }));
  }

  ensureArea().append(node);
  const timer = setTimeout(() => node.remove(), duration);
  node.addEventListener('remove', () => clearTimeout(timer));
  return node;
}
