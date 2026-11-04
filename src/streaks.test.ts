import { describe, expect, it } from 'vitest';
import { currentStreaks } from './streaks.ts';
import type { Pocket } from './rules.ts';

const pockets = (...values: string[]) => values as Pocket[];

describe('current streaks', () => {
  it('returns nothing until a run reaches three', () => {
    expect(currentStreaks([])).toEqual([]);
    expect(currentStreaks(pockets('2', '4'))).toEqual([]);
  });

  it('counts back from the newest result and sorts the longest run first', () => {
    const streaks = currentStreaks(pockets('8', '6', '4', '2', '1'));
    expect(streaks).toEqual([
      { kind: 'low', length: 5 },
      { kind: 'd1', length: 5 },
      { kind: 'black', length: 4 },
      { kind: 'even', length: 4 },
    ]);
  });

  it('lets 0 and 00 break every category', () => {
    expect(currentStreaks(pockets('0', '2', '4', '6', '8'))).toEqual([]);
    expect(currentStreaks(pockets('00', '1', '3', '5', '7'))).toEqual([]);
    expect(currentStreaks(pockets('10', '8', '0', '2', '4', '6'))).toEqual([
      { kind: 'black', length: 2 },
      { kind: 'even', length: 2 },
      { kind: 'low', length: 2 },
      { kind: 'd1', length: 2 },
    ].filter((streak) => streak.length >= 3));
  });

  it('keeps only the side that is still running', () => {
    const streaks = currentStreaks(pockets('36', '35', '34', '19'));
    expect(streaks.map((streak) => streak.kind)).toEqual(['high', 'd3']);
    expect(streaks.find((streak) => streak.kind === 'high')?.length).toBe(4);
    expect(streaks.find((streak) => streak.kind === 'd3')?.length).toBe(3);
    expect(streaks.some((streak) => streak.kind === 'red' || streak.kind === 'black')).toBe(false);
  });

  it('stops a run at the first miss', () => {
    expect(currentStreaks(pockets('2', '4', '6', '5', '8', '10'))).toEqual([
      { kind: 'low', length: 6 },
      { kind: 'd1', length: 6 },
      { kind: 'black', length: 3 },
      { kind: 'even', length: 3 },
    ]);
  });
});
