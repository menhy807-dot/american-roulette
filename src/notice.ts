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

function paragraph(lang: string, text: string): HTMLParagraphElement {
  const el = document.createElement('p');
  el.lang = lang;
  el.textContent = text;
  return el;
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
  kicker.lang = 'en';
  kicker.textContent = '18+ · Entertainment only';

  const title = document.createElement('h2');
  title.id = 'age-title';
  title.lang = 'en';
  title.textContent = 'Free to play. No real money.';

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'btn-age';
  accept.textContent = 'I am 18 or older · 我已年满 18 岁';

  dialog.append(
    kicker,
    title,
    paragraph(
      'en',
      'Harry Story Games are free browser games for adults. Nothing here is real money, and there are no real-world prizes. You must be 18 or older to play.',
    ),
    paragraph('zh-CN', '这里的游戏免费、只供成年人娱乐。不涉及真钱，也没有现实世界的奖励。未满 18 岁请勿游玩。'),
    accept,
  );
  document.body.appendChild(dialog);

  accept.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', remember);
  dialog.showModal();
}
