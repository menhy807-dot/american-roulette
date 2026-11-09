import { describe, expect, it } from 'vitest';
import freezerHtml from '../freezer/index.html?raw';
import lobbyHtml from '../index.html?raw';
import rouletteHtml from '../roulette/index.html?raw';
import { GAMES } from './games.ts';
import { NOTICE_KEY } from './notice.ts';
import { SITE_NAME } from './site.ts';
import { tablePlacement } from './table.ts';

describe('game lobby catalog', () => {
  it('lists roulette and freezer night shift as playable and keeps placeholders marked soon', () => {
    const playable = GAMES.filter((game) => game.status === 'play');
    expect(playable.map((game) => game.id)).toEqual(['american-roulette', 'freezer-night-shift']);
    expect(playable[0]?.href).toBe('/roulette/');
    expect(playable[1]?.href).toBe('/freezer/');
    expect(playable[1]?.cover).toBe('/freezer-cover.png');
    expect(playable[1]?.titleZh).toBe('冷柜夜班');
    const soon = GAMES.filter((game) => game.status === 'soon');
    expect(soon.length).toBeGreaterThanOrEqual(1);
    expect(soon.every((game) => game.href === null)).toBe(true);
    expect(new Set(GAMES.map((game) => game.id)).size).toBe(GAMES.length);
  });

  it('uses the site name on the lobby and keeps roulette on its own share url', () => {
    const lobby = lobbyHtml;
    const roulette = rouletteHtml;
    expect(SITE_NAME).toBe('Harry Story Games');
    expect(lobby).toContain(SITE_NAME);
    expect(lobby).toContain('https://harrystory.com/');
    expect(lobby).toContain('https://harrystory.com/og-lobby.png');
    expect(lobby).toContain('rel="canonical" href="https://harrystory.com/"');
    expect(roulette).toContain('https://harrystory.com/roulette/');
    expect(roulette).toContain('https://harrystory.com/og-image.png');
    expect(roulette).toContain('rel="canonical" href="https://harrystory.com/roulette/"');
    expect(roulette).toContain('href="/"');
    expect(freezerHtml).toContain('https://harrystory.com/freezer/');
    expect(freezerHtml).toContain('https://harrystory.com/og-freezer.png');
    expect(freezerHtml).toContain('rel="canonical" href="https://harrystory.com/freezer/"');
    expect(freezerHtml).toContain('href="/"');
    expect(freezerHtml).toContain('/src/freezer/main.ts');
  });

  it('keeps the age notice key stable so it is asked once site-wide', () => {
    expect(NOTICE_KEY).toBe('american-roulette-notice-v1');
  });
});

describe('portrait table placement', () => {
  it('packs six numbers on a row and keeps the desktop grid', () => {
    expect(tablePlacement('n:1', true)).toEqual({ column: '1', row: '2' });
    expect(tablePlacement('n:6', true)).toEqual({ column: '6', row: '2' });
    expect(tablePlacement('n:7', true)).toEqual({ column: '1', row: '3' });
    expect(tablePlacement('n:36', true)).toEqual({ column: '6', row: '7' });
    expect(tablePlacement('n:0', true).row).toBe('1');
    expect(tablePlacement('n:00', true).column).toBe('4 / 7');
    expect(tablePlacement('c1', true).row).toBe('8');
    expect(tablePlacement('high', true)).toEqual({ column: '6', row: '1' });
    expect(tablePlacement('low', true).column).toBe('1');

    expect(tablePlacement('n:1', false)).toEqual({ column: '2', row: '5 / 7' });
    expect(tablePlacement('n:3', false)).toEqual({ column: '2', row: '1 / 3' });
    expect(tablePlacement('n:36', false)).toEqual({ column: '13', row: '1 / 3' });
    expect(tablePlacement('c1', false)).toEqual({ column: '14', row: '5 / 7' });
    expect(tablePlacement('d2', false)).toEqual({ column: '6 / 10', row: '1' });
  });
});
