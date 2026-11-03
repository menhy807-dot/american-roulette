export type GameStatus = 'play' | 'soon';

export interface CatalogGame {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  /** Playable games link somewhere. Coming soon games do not. */
  href: string | null;
  cover: string | null;
  status: GameStatus;
}

/**
 * Add a game by appending an entry. `status: 'play'` needs an `href`.
 * `status: 'soon'` stays on the lobby as a placeholder.
 */
export const GAMES: readonly CatalogGame[] = [
  {
    id: 'american-roulette',
    title: 'American Roulette',
    titleZh: '美式轮盘',
    description: '0, 00, and 1–36. Chips stay in this browser.',
    descriptionZh: '三十八格。筹码只存在这台浏览器里。',
    href: '/roulette/',
    cover: '/og-image.png',
    status: 'play',
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    titleZh: '二十一点',
    description: 'A table for one is on the way.',
    descriptionZh: '单人牌桌还在准备。',
    href: null,
    cover: null,
    status: 'soon',
  },
  {
    id: 'slots',
    title: 'Slots',
    titleZh: '老虎机',
    description: 'Reels are still being built.',
    descriptionZh: '转轮还在制作。',
    href: null,
    cover: null,
    status: 'soon',
  },
];
