import { isWinningSpot, type OutsideSpot, type Pocket } from './rules.ts';

/** Binary bets, plus dozen and column. 0 and 00 match none of these. */
export const STREAK_KINDS = [
  'red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3', 'c1', 'c2', 'c3',
] as const satisfies readonly OutsideSpot[];

export type StreakKind = (typeof STREAK_KINDS)[number];

export interface Streak {
  kind: StreakKind;
  length: number;
}

/**
 * Consecutive run of each category, counting back from the newest result.
 * History is newest first. A 0 or 00 stops every run.
 */
export function currentStreaks(history: readonly Pocket[], minLength = 3): Streak[] {
  const found: Streak[] = [];
  for (const kind of STREAK_KINDS) {
    let length = 0;
    for (const pocket of history) {
      if (!isWinningSpot(kind, pocket)) break;
      length += 1;
    }
    if (length >= minLength) found.push({ kind, length });
  }
  found.sort((a, b) => b.length - a.length || STREAK_KINDS.indexOf(a.kind) - STREAK_KINDS.indexOf(b.kind));
  return found;
}
