import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from './game.ts';
import { setLocale } from './i18n.ts';
import { WHEEL_ORDER, type Pocket } from './rules.ts';
import { decodeSaveCode, encodeSaveCode, parsePersisted, STARTING_BALANCE, type Persisted, type Store } from './storage.ts';

beforeEach(() => setLocale('zh-CN'));

function unitFor(pocket: Pocket): number {
  return (WHEEL_ORDER.indexOf(pocket) + 0.01) / 38;
}

function memoryStore(initial: Persisted | null = null): Store & { read(): Persisted | null } {
  let data = initial;
  return {
    load: () => data,
    save(next) {
      data = JSON.parse(JSON.stringify(next)) as Persisted;
    },
    read: () => data,
  };
}

describe('round loop', () => {
  it('pays a mixed book on 17 and then clears the table', () => {
    const game = createGame({ store: memoryStore(), random: () => unitFor('17') });
    game.selectChip(25);
    game.place('n:17');
    game.selectChip(5);
    for (const spot of ['black', 'red', 'odd', 'even', 'low', 'high', 'd2', 'd1', 'c2', 'c3']) {
      game.place(spot);
    }
    expect(game.getState().balance).toBe(925);
    expect(game.getState().phase).toBe('betting');
    game.spin();
    expect(game.getState().phase).toBe('spinning');
    expect(game.getState().pending).toBe('17');
    expect(game.getState().result).toBeNull();
    game.finishSpin();
    const settled = game.getState();
    expect(settled.phase).toBe('settling');
    expect(settled.result).toBe('17');
    expect(settled.balance).toBe(1885);
    expect(settled.roundNet).toBe(885);
    expect(settled.history[0]).toBe('17');
    expect(settled.statusText).toContain('净赢');
    game.completeRound();
    expect(game.getState().phase).toBe('betting');
    expect(game.getState().placements).toHaveLength(0);
    expect(game.getState().balance).toBe(1885);
  });

  it('lets 0 and 00 beat outside bets but not each other', () => {
    const lose = createGame({ store: memoryStore(), random: () => unitFor('0') });
    lose.selectChip(25);
    lose.place('red');
    lose.place('n:00');
    lose.spin();
    lose.finishSpin();
    expect(lose.getState().balance).toBe(950);

    const hit = createGame({ store: memoryStore(), random: () => unitFor('00') });
    hit.selectChip(5);
    hit.place('n:00');
    hit.place('even');
    hit.spin();
    hit.finishSpin();
    expect(hit.getState().balance).toBe(1000 - 10 + 5 * 36);
  });

  it('undoes and clears only the open bets', () => {
    const game = createGame({ store: memoryStore(), random: () => unitFor('2') });
    game.selectChip(5);
    game.place('red');
    game.selectChip(25);
    game.place('red');
    game.undo();
    expect(game.getState().balance).toBe(995);
    expect(game.getState().placements).toHaveLength(1);
    game.clearBets();
    expect(game.getState().balance).toBe(STARTING_BALANCE);
    expect(game.getState().placements).toHaveLength(0);
    game.undo();
    expect(game.getState().statusText).toBe('没有可撤销的下注');
  });

  it('refuses a spin with an empty table and a bet the bankroll cannot cover', () => {
    const game = createGame({ store: memoryStore(), random: () => 0 });
    game.spin();
    expect(game.getState().phase).toBe('betting');
    expect(game.getState().statusText).toBe('请先至少下一注');
    game.selectChip(500);
    for (let i = 0; i < 2; i += 1) game.place('black');
    expect(game.getState().balance).toBe(0);
    game.place('black');
    expect(game.getState().statusAlert).toBe(true);
    expect(game.getState().statusText).toBe('余额不足');
    expect(game.getState().placements).toHaveLength(2);
  });

  it('locks the table during a spin and does not pay twice', () => {
    const game = createGame({ store: memoryStore(), random: () => unitFor('1') });
    game.selectChip(25);
    game.place('red');
    game.spin();
    const mid = game.getState().balance;
    game.place('black');
    game.undo();
    game.resetBalance();
    expect(game.getState().balance).toBe(mid);
    expect(game.getState().placements).toHaveLength(1);
    expect(game.getState().statusText).toBe('请等待本局结束');
    game.finishSpin();
    expect(game.getState().balance).toBe(1025);
    game.finishSpin();
    expect(game.getState().balance).toBe(1025);
    game.completeRound();
    game.spin();
    expect(game.getState().phase).toBe('betting');
  });

  it('keeps the last ten results, newest first', () => {
    const spun: Pocket[] = [];
    const game = createGame({
      store: memoryStore(),
      random: () => {
        const pocket = WHEEL_ORDER[spun.length] ?? '0';
        spun.push(pocket);
        return unitFor(pocket);
      },
    });
    for (let i = 0; i < 11; i += 1) {
      game.selectChip(1);
      game.place('n:36');
      game.spin();
      game.finishSpin();
      game.completeRound();
    }
    expect(game.getState().history).toEqual([...spun].slice(-10).reverse());
    expect(game.getState().phase).toBe('betting');
  });
});

describe('persistence', () => {
  it('refunds an unspun table and commits a spin that has not animated', () => {
    const store = memoryStore();
    const game = createGame({ store, random: () => unitFor('17') });
    game.selectChip(100);
    game.place('red');
    game.persist();
    expect(store.read()?.balance).toBe(1000);
    game.spin();
    expect(store.read()?.balance).toBe(900);
    expect(store.read()?.history[0]).toBe('17');
    expect(game.getState().phase).toBe('spinning');
    game.finishSpin();
    expect(game.getState().balance).toBe(900);
    expect(store.read()?.balance).toBe(900);
  });

  it('restores balance, history, and preferences but not the felt', () => {
    const saved: Persisted = {
      v: 1,
      balance: 640,
      history: ['00', '8', '19'],
      sfx: true,
      reduceMotion: true,
    };
    const game = createGame({ store: memoryStore(saved), random: () => 0 });
    const state = game.getState();
    expect(state.balance).toBe(640);
    expect(state.history).toEqual(['00', '8', '19']);
    expect(state.result).toBe('00');
    expect(state.placements).toHaveLength(0);
    expect(state.sfx).toBe(true);
    expect(state.reduceMotion).toBe(true);
  });

  it('resets the bankroll without erasing history', () => {
    const store = memoryStore();
    const game = createGame({ store, random: () => unitFor('8') });
    game.selectChip(25);
    game.place('black');
    game.spin();
    game.finishSpin();
    game.completeRound();
    game.selectChip(5);
    game.place('red');
    game.resetBalance();
    expect(game.getState().balance).toBe(1000);
    expect(game.getState().placements).toHaveLength(0);
    expect(game.getState().history[0]).toBe('8');
    expect(store.read()?.balance).toBe(1000);
  });

  it('exports the settled bankroll and restores a save code', () => {
    const store = memoryStore();
    const game = createGame({ store, random: () => unitFor('8') });
    game.selectChip(100);
    game.place('red');
    expect(game.getState().balance).toBe(900);
    expect(game.toPersisted().balance).toBe(1000);
    expect(game.toPersisted().history).toEqual([]);

    const incoming = decodeSaveCode(encodeSaveCode({
      v: 1,
      balance: 640,
      history: ['00', '8', '19'],
      sfx: true,
      reduceMotion: true,
    }));
    expect(incoming.ok).toBe(true);
    if (!incoming.ok) return;
    expect(game.replacePersisted(incoming.data)).toBe(true);
    expect(game.getState().balance).toBe(640);
    expect(game.getState().placements).toHaveLength(0);
    expect(game.getState().history).toEqual(['00', '8', '19']);
    expect(game.getState().result).toBe('00');
    expect(game.getState().sfx).toBe(true);
    expect(game.getState().reduceMotion).toBe(true);
    expect(game.getState().statusText).toBe('已从存档码恢复');
    expect(store.read()).toEqual(incoming.data);

    game.selectChip(25);
    game.place('black');
    game.spin();
    expect(game.replacePersisted(incoming.data)).toBe(false);
    expect(game.getState().phase).toBe('spinning');
    expect(game.getState().statusText).toBe('请等待本局结束');
    expect(store.read()?.history[0]).toBe('8');
  });

  it('rejects a corrupt save', () => {
    expect(parsePersisted(null, false)).toBeNull();
    expect(parsePersisted({ balance: -5 }, false)).toBeNull();
    expect(parsePersisted({ balance: '1000' }, true)).toBeNull();
    const parsed = parsePersisted(
      { balance: 40.2, history: ['17', 'nope', '00', '1'], sfx: true },
      true,
    );
    expect(parsed).toEqual({
      v: 1,
      balance: 40,
      history: ['17', '00', '1'],
      sfx: true,
      reduceMotion: true,
    });
  });
});
