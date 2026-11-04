/** Shared with older visits so the disclaimer is shown once for the whole site. */
export const NOTICE_KEY = 'american-roulette-notice-v1';

function accepted(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    // The footer line still states the disclaimer.
  }
}

import { onLocale, t } from './i18n.ts';

function fill(dialog: HTMLElement): void {
  const kicker = dialog.querySelector('.age-kicker');
  const title = dialog.querySelector('#age-title');
  const body = dialog.querySelector('.age-body');
  const accept = dialog.querySelector('.btn-age');
  if (kicker) kicker.textContent = t('ageKicker');
  if (title) title.textContent = t('ageTitle');
  if (body) body.textContent = t('ageBody');
  if (accept) accept.textContent = t('ageAccept');
}

/** First visit on the lobby or a game, whichever opens first. */
export function mountAgeNotice(): void {
  if (accepted() || document.getElementById('age-dialog')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'age-dialog';
  dialog.className = 'age-dialog';
  dialog.setAttribute('aria-labelledby', 'age-title');

  const kicker = document.createElement('p');
  kicker.className = 'age-kicker';
  const title = document.createElement('h2');
  title.id = 'age-title';
  const body = document.createElement('p');
  body.className = 'age-body';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'btn-age';
  dialog.append(kicker, title, body, accept);
  fill(dialog);
  onLocale(() => fill(dialog));
  document.body.appendChild(dialog);

  accept.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', remember);
  dialog.showModal();
}
