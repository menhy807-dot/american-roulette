import './styles.css';

import { GAMES, type CatalogGame } from './games.ts';
import { applyDom, mountLanguageMenu, onLocale, t } from './i18n.ts';
import { mountAgeNotice } from './notice.ts';
import { SITE_NAME } from './site.ts';

const nameEl = document.querySelector<HTMLElement>('#site-name');
const taglineEl = document.querySelector<HTMLElement>('#site-tagline');
const listEl = document.querySelector<HTMLElement>('#game-list');

if (!nameEl || !taglineEl || !listEl) {
  throw new Error('Lobby markup is incomplete');
}
const siteNameEl: HTMLElement = nameEl;
const siteTagEl: HTMLElement = taglineEl;
const gameListEl: HTMLElement = listEl;

const langMenu = document.querySelector<HTMLElement>('.lang-menu');
if (langMenu) mountLanguageMenu(langMenu);

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
  const mainName = document.createElement('span');
  const localName = document.createElement('span');
  const copy = document.createElement('p');
  mainName.dataset.card = game.id;
  localName.dataset.cardLocal = game.id;
  copy.dataset.cardDesc = game.id;
  title.append(mainName, localName);
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
    badge.dataset.i18n = 'comingSoon';
    cover.appendChild(badge);
  }

  const body = cardBody(game);

  if (game.status === 'play' && game.href) {
    const link = document.createElement('a');
    link.className = 'game-link';
    link.href = game.href;
    const action = document.createElement('span');
    action.className = 'btn-play';
    action.dataset.i18n = 'play';
    body.appendChild(action);
    link.append(cover, body);
    card.appendChild(link);
    return card;
  }

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'btn-play';
  action.disabled = true;
  action.dataset.i18n = 'comingSoon';
  body.appendChild(action);
  card.append(cover, body);
  return card;
}

function paintCards(): void {
  const names: Record<string, 'cardRoulette' | 'cardBlackjack' | 'cardSlots'> = {
    'american-roulette': 'cardRoulette',
    blackjack: 'cardBlackjack',
    slots: 'cardSlots',
  };
  const locals: Record<string, 'cardRouletteLocal' | 'cardBlackjackLocal' | 'cardSlotsLocal'> = {
    'american-roulette': 'cardRouletteLocal',
    blackjack: 'cardBlackjackLocal',
    slots: 'cardSlotsLocal',
  };
  const descs: Record<string, 'cardRouletteDesc' | 'cardBlackjackDesc' | 'cardSlotsDesc'> = {
    'american-roulette': 'cardRouletteDesc',
    blackjack: 'cardBlackjackDesc',
    slots: 'cardSlotsDesc',
  };
  for (const card of gameListEl.querySelectorAll<HTMLElement>('[data-card]')) {
    const id = card.dataset.card ?? '';
    const key = names[id];
    if (key) card.textContent = t(key);
  }
  for (const card of gameListEl.querySelectorAll<HTMLElement>('[data-card-local]')) {
    const key = locals[card.dataset.cardLocal ?? ''];
    if (key) card.textContent = t(key);
  }
  for (const card of gameListEl.querySelectorAll<HTMLElement>('[data-card-desc]')) {
    const key = descs[card.dataset.cardDesc ?? ''];
    if (key) card.textContent = t(key);
  }
}

function paintLobby(): void {
  siteNameEl.textContent = SITE_NAME;
  siteTagEl.textContent = t('tagline');
  document.title = t('docTitle');
  applyDom(document);
  paintCards();
}

gameListEl.replaceChildren(...GAMES.map(renderGame));
paintLobby();
onLocale(paintLobby);
mountAgeNotice();
