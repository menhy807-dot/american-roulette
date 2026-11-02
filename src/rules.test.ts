import { describe, expect, it } from 'vitest';
import {
  WHEEL_ORDER,
  colorOf,
  isWinningSpot,
  pocketFromUnit,
  profitOdds,
  rotationToTop,
  settlePlacements,
  winningSpots,
  type OutsideSpot,
  type Placement,
  type Pocket,
  type SpotId,
} from './rules.ts';
import { spinDurationMs } from './timing.ts';

const OUTSIDE: OutsideSpot[] = [
  'red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3', 'c1', 'c2', 'c3',
];

function winners(spot: SpotId): Pocket[] {
  return WHEEL_ORDER.filter((pocket) => isWinningSpot(spot, pocket)).sort(
    (a, b) => Number(a) - Number(b),
  );
}

describe('American wheel', () => {
  it('has 38 unique pockets including 0 and 00', () => {
    expect(new Set(WHEEL_ORDER).size).toBe(38);
    expect(WHEEL_ORDER).toContain('0');
    expect(WHEEL_ORDER).toContain('00');
    for (let n = 1; n <= 36; n += 1) expect(WHEEL_ORDER).toContain(String(n));
  });

  it('uses the statutory clockwise order', () => {
    expect(WHEEL_ORDER.slice(0, 6)).toEqual(['0', '28', '9', '26', '30', '11']);
    expect(WHEEL_ORDER.slice(-3)).toEqual(['35', '14', '2']);
    expect(WHEEL_ORDER[19]).toBe('00');
  });

  it('colors 18 red, 18 black, and two greens, alternating around the greens', () => {
    const colors = WHEEL_ORDER.map(colorOf);
    expect(colors.filter((color) => color === 'red')).toHaveLength(18);
    expect(colors.filter((color) => color === 'black')).toHaveLength(18);
    expect(colors.filter((color) => color === 'green')).toHaveLength(2);
    for (let i = 0; i < WHEEL_ORDER.length; i += 1) {
      const left = colorOf(WHEEL_ORDER[i] ?? '0');
      const right = colorOf(WHEEL_ORDER[(i + 1) % WHEEL_ORDER.length] ?? '0');
      if (left !== 'green' && right !== 'green') expect(left).not.toBe(right);
    }
    const zero = WHEEL_ORDER.indexOf('0');
    const double = WHEEL_ORDER.indexOf('00');
    expect(colorOf(WHEEL_ORDER[(zero + 1) % 38] ?? '0')).toBe('black');
    expect(colorOf(WHEEL_ORDER[(zero + 37) % 38] ?? '0')).toBe('black');
    expect(colorOf(WHEEL_ORDER[(double + 1) % 38] ?? '0')).toBe('red');
    expect(colorOf(WHEEL_ORDER[(double + 37) % 38] ?? '0')).toBe('red');
  });

  it('stops with the chosen pocket under the pointer', () => {
    const slice = 360 / WHEEL_ORDER.length;
    for (const pocket of WHEEL_ORDER) {
      for (const current of [0, 12.5, 350, -40, 4000]) {
        const rot = rotationToTop(current, pocket, 4);
        const center = WHEEL_ORDER.indexOf(pocket) * slice;
        const visual = (((center + rot) % 360) + 360) % 360;
        expect(visual < 0.001 || visual > 359.999).toBe(true);
      }
    }
  });
});

describe('payouts', () => {
  it('pays American odds and lets 0 and 00 sweep the outside', () => {
    expect(winners('red')).toHaveLength(18);
    expect(winners('black')).toHaveLength(18);
    expect(winners('odd')).toHaveLength(18);
    expect(winners('even')).toHaveLength(18);
    expect(winners('low')).toHaveLength(18);
    expect(winners('high')).toHaveLength(18);
    expect(winners('d1')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    expect(winners('d2')).toContain('13');
    expect(winners('d2')).toContain('24');
    expect(winners('d2')).not.toContain('12');
    expect(winners('d2')).not.toContain('25');
    expect(winners('d3')).toContain('25');
    expect(winners('d3')).toContain('36');
    expect(winners('c1')).toEqual(['1', '4', '7', '10', '13', '16', '19', '22', '25', '28', '31', '34']);
    expect(winners('c2')).toEqual(['2', '5', '8', '11', '14', '17', '20', '23', '26', '29', '32', '35']);
    expect(winners('c3')).toEqual(['3', '6', '9', '12', '15', '18', '21', '24', '27', '30', '33', '36']);
    expect(winners('n:17')).toEqual(['17']);
    expect(winners('n:0')).toEqual(['0']);
    expect(winners('n:00')).toEqual(['00']);
    for (const spot of OUTSIDE) {
      expect(isWinningSpot(spot, '0')).toBe(false);
      expect(isWinningSpot(spot, '00')).toBe(false);
    }
    expect(isWinningSpot('n:0', '00')).toBe(false);
    expect(isWinningSpot('n:00', '0')).toBe(false);
  });

  it('credits stake plus profit', () => {
    const bet = (spot: SpotId, amount: Placement['amount']): Placement => ({ id: 1, spot, amount });
    expect(profitOdds('n:8')).toBe(35);
    expect(profitOdds('red')).toBe(1);
    expect(profitOdds('d1')).toBe(2);
    expect(settlePlacements([bet('n:17', 25)], '17')).toEqual({ returned: 900, net: 875 });
    expect(settlePlacements([bet('red', 25)], '1')).toEqual({ returned: 50, net: 25 });
    expect(settlePlacements([bet('d3', 25)], '36')).toEqual({ returned: 75, net: 50 });
    expect(settlePlacements([bet('red', 25), bet('n:17', 5)], '0')).toEqual({ returned: 0, net: -30 });
    expect(winningSpots('17')).toEqual(['n:17', 'black', 'odd', 'low', 'd2', 'c2']);
    expect(winningSpots('0')).toEqual(['n:0']);
  });
});

describe('spin timing', () => {
  it('stays inside 3.5 to 5 seconds unless motion is skipped', () => {
    expect(spinDurationMs(true, 0.2)).toBe(0);
    expect(spinDurationMs(false, 0)).toBe(3500);
    expect(spinDurationMs(false, 1)).toBe(5000);
    expect(spinDurationMs(false, 0.5)).toBeGreaterThanOrEqual(3500);
    expect(spinDurationMs(false, 0.5)).toBeLessThanOrEqual(5000);
  });
});

describe('rng buckets', () => {
  it('maps each 1/38 slice to one pocket', () => {
    const seen = new Set<Pocket>();
    for (let i = 0; i < 38; i += 1) seen.add(pocketFromUnit((i + 0.1) / 38));
    expect(seen.size).toBe(38);
    expect(pocketFromUnit(0)).toBe('0');
    expect(pocketFromUnit(0.999999)).toBe('2');
    expect(pocketFromUnit(1)).toBe('2');
  });
});
