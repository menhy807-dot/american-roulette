import '@fontsource/noto-serif-sc/latin-600.css';
import '@fontsource/noto-serif-sc/chinese-simplified-600.css';
import '@fontsource/noto-sans-sc/latin-400.css';
import '@fontsource/noto-sans-sc/latin-700.css';
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import './styles.css';

import { GAMES, type CatalogGame } from './games.ts';
import { mountAgeNotice } from './notice.ts';
import { SITE_NAME, SITE_TAGLINE } from './site.ts';

const nameEl = document.querySelector<HTMLElement>('#site-name');
const taglineEl = document.querySelector<HTMLElement>('#site-tagline');
const listEl = document.querySelector<HTMLElement>('#game-list');

if (!nameEl || !taglineEl || !listEl) {
  throw new Error('Lobby markup is incomplete');
}

nameEl.textContent = SITE_NAME;
taglineEl.textContent = SITE_TAGLINE;

function soonCover(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 120');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('soon-art');
  const felt = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  felt.setAttribute('width', '320');
  felt.setAttribute('height', '120');
  felt.setAttribute('fill', '#0e4a36');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', '160');
  ring.setAttribute('cy', '60');
  ring.setAttribute('r', '36');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#d4b36a');
  ring.setAttribute('stroke-width', '3');
  const hub = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  hub.setAttribute('cx', '160');
  hub.setAttribute('cy', '60');
  hub.setAttribute('r', '10');
  hub.setAttribute('fill', '#3a2618');
  hub.setAttribute('stroke', '#f0d7a2');
  svg.append(felt, ring, hub);
  return svg;
}

function cardBody(game: CatalogGame): HTMLElement {
  const body = document.createElement('div');
  body.className = 'game-body';
  const title = document.createElement('h2');
  title.append(document.createTextNode(game.title));
  const zh = document.createElement('span');
  zh.lang = 'zh-CN';
  zh.textContent = game.titleZh;
  title.append(zh);
  const copy = document.createElement('p');
  copy.append(document.createTextNode(game.description));
  const zhCopy = document.createElement('span');
  zhCopy.lang = 'zh-CN';
  zhCopy.textContent = game.descriptionZh;
  copy.append(zhCopy);
  body.append(title, copy);
  return body;
}

function renderGame(game: CatalogGame): HTMLElement {
  const card = document.createElement('article');
  card.className = `game-card game-card-${game.status}`;
  card.dataset.game = game.id;

  const cover = document.createElement('div');
  cover.className = 'game-cover';
  if (game.cover) {
    const img = document.createElement('img');
    img.src = game.cover;
    img.alt = '';
    cover.appendChild(img);
  } else {
    cover.appendChild(soonCover());
  }

  if (game.status === 'soon') {
    const badge = document.createElement('span');
    badge.className = 'soon-badge';
    badge.textContent = 'Coming soon · 即将推出';
    cover.appendChild(badge);
  }

  const body = cardBody(game);

  if (game.status === 'play' && game.href) {
    const link = document.createElement('a');
    link.className = 'game-link';
    link.href = game.href;
    const action = document.createElement('span');
    action.className = 'btn-play';
    action.textContent = 'Play · 开始';
    body.appendChild(action);
    link.append(cover, body);
    card.appendChild(link);
    return card;
  }

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'btn-play';
  action.disabled = true;
  action.textContent = 'Coming soon · 即将推出';
  body.appendChild(action);
  card.append(cover, body);
  return card;
}

listEl.replaceChildren(...GAMES.map(renderGame));
mountAgeNotice();
