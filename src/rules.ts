/** Clockwise American double-zero wheel, starting at 0. */
export const WHEEL_ORDER = [
  '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22',
  '34', '15', '3', '24', '36', '13', '1', '00', '27', '10', '25', '29',
  '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35',
  '14', '2',
] as const;

export type Pocket = (typeof WHEEL_ORDER)[number];

export const CHIP_VALUES = [1, 5, 25, 100, 500] as const;
export type Chip = (typeof CHIP_VALUES)[number];

export type OutsideSpot =
  | 'red'
  | 'black'
  | 'odd'
  | 'even'
  | 'low'
  | 'high'
  | 'd1'
  | 'd2'
  | 'd3'
  | 'c1'
  | 'c2'
  | 'c3';

export type SpotId = `n:${Pocket}` | OutsideSpot;

export interface Placement {
  id: number;
  spot: SpotId;
  amount: Chip;
}

const POCKET_SET = new Set<string>(WHEEL_ORDER);

/** Standard roulette reds. The other 18 numbers are black. 0 and 00 are green. */
const REDS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const OUTSIDE = new Set<string>([
  'red', 'black', 'odd', 'even', 'low', 'high', 'd1', 'd2', 'd3', 'c1', 'c2', 'c3',
]);

export function isPocket(value: string): value is Pocket {
  return POCKET_SET.has(value);
}

export function isChip(value: number): value is Chip {
  return (CHIP_VALUES as readonly number[]).includes(value);
}

export function isSpotId(value: string): value is SpotId {
  if (OUTSIDE.has(value)) return true;
  if (!value.startsWith('n:')) return false;
  return isPocket(value.slice(2));
}

export function colorOf(pocket: Pocket): 'red' | 'black' | 'green' {
  if (pocket === '0' || pocket === '00') return 'green';
  return REDS.has(Number(pocket)) ? 'red' : 'black';
}

export function colorName(pocket: Pocket): '红' | '黑' | '绿' {
  const color = colorOf(pocket);
  if (color === 'red') return '红';
  if (color === 'black') return '黑';
  return '绿';
}

/** Map a uniform [0, 1) unit onto one of the 38 pockets. */
export function pocketFromUnit(unit: number): Pocket {
  const scaled = Number.isFinite(unit) ? unit : 0;
  const index = Math.min(
    WHEEL_ORDER.length - 1,
    Math.max(0, Math.floor(scaled * WHEEL_ORDER.length)),
  );
  return WHEEL_ORDER[index] ?? '0';
}

/**
 * Clockwise degrees to add so `pocket` lands under the top pointer.
 * `current` is the wheel's existing CSS rotation.
 */
export function rotationToTop(current: number, pocket: Pocket, extraTurns: number): number {
  const slice = 360 / WHEEL_ORDER.length;
  const center = WHEEL_ORDER.indexOf(pocket) * slice;
  const target = (360 - center) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  let delta = target - currentMod;
  if (delta < 0) delta += 360;
  const turns = Math.max(0, extraTurns);
  return current + delta + turns * 360;
}

/** Profit multiple. 35:1 pays 35 profit plus the stake back. */
export function profitOdds(spot: SpotId): number {
  if (spot.startsWith('n:')) return 35;
  if (spot === 'd1' || spot === 'd2' || spot === 'd3' || spot === 'c1' || spot === 'c2' || spot === 'c3') {
    return 2;
  }
  return 1;
}

export function isWinningSpot(spot: SpotId, result: Pocket): boolean {
  if (spot.startsWith('n:')) return spot.slice(2) === result;
  if (result === '0' || result === '00') return false;
  const n = Number(result);
  switch (spot) {
    case 'red':
      return colorOf(result) === 'red';
    case 'black':
      return colorOf(result) === 'black';
    case 'odd':
      return n % 2 === 1;
    case 'even':
      return n % 2 === 0;
    case 'low':
      return n >= 1 && n <= 18;
    case 'high':
      return n >= 19 && n <= 36;
    case 'd1':
      return n >= 1 && n <= 12;
    case 'd2':
      return n >= 13 && n <= 24;
    case 'd3':
      return n >= 25 && n <= 36;
    case 'c1':
      return n % 3 === 1;
    case 'c2':
      return n % 3 === 2;
    case 'c3':
      return n % 3 === 0;
    default:
      return false;
  }
}

/** Spots that pay on this pocket, including the straight-up number. */
export function winningSpots(result: Pocket): SpotId[] {
  const spots: SpotId[] = [`n:${result}`];
  if (result === '0' || result === '00') return spots;
  const n = Number(result);
  spots.push(colorOf(result) === 'red' ? 'red' : 'black');
  spots.push(n % 2 === 0 ? 'even' : 'odd');
  spots.push(n <= 18 ? 'low' : 'high');
  spots.push(n <= 12 ? 'd1' : n <= 24 ? 'd2' : 'd3');
  spots.push(n % 3 === 1 ? 'c1' : n % 3 === 2 ? 'c2' : 'c3');
  return spots;
}

export interface SpotCopy {
  title: string;
  detail: string;
  odds: number;
}

const OUTSIDE_COPY: Record<OutsideSpot, SpotCopy> = {
  red: { title: '红色', detail: '红号', odds: 1 },
  black: { title: '黑色', detail: '黑号', odds: 1 },
  odd: { title: '单', detail: '奇数', odds: 1 },
  even: { title: '双', detail: '偶数', odds: 1 },
  low: { title: '小', detail: '1–18', odds: 1 },
  high: { title: '大', detail: '19–36', odds: 1 },
  d1: { title: '第一打', detail: '1–12', odds: 2 },
  d2: { title: '第二打', detail: '13–24', odds: 2 },
  d3: { title: '第三打', detail: '25–36', odds: 2 },
  c1: { title: '第一列', detail: '1、4、7 … 34', odds: 2 },
  c2: { title: '第二列', detail: '2、5、8 … 35', odds: 2 },
  c3: { title: '第三列', detail: '3、6、9 … 36', odds: 2 },
};

export function describeSpot(spot: SpotId): SpotCopy {
  if (spot.startsWith('n:')) {
    const pocket = spot.slice(2) as Pocket;
    return { title: `直注 ${pocket}`, detail: colorName(pocket), odds: 35 };
  }
  return OUTSIDE_COPY[spot as OutsideSpot];
}

export function totalStake(placements: readonly Placement[]): number {
  let sum = 0;
  for (const placement of placements) sum += placement.amount;
  return sum;
}

export function stakeOn(placements: readonly Placement[], spot: SpotId): number {
  let sum = 0;
  for (const placement of placements) {
    if (placement.spot === spot) sum += placement.amount;
  }
  return sum;
}

export interface Settlement {
  returned: number;
  net: number;
}

/** `returned` is stake + profit credited back. `net` is profit minus losing stakes. */
export function settlePlacements(placements: readonly Placement[], result: Pocket): Settlement {
  let returned = 0;
  let staked = 0;
  for (const placement of placements) {
    staked += placement.amount;
    if (isWinningSpot(placement.spot, result)) {
      returned += placement.amount * (profitOdds(placement.spot) + 1);
    }
  }
  return { returned, net: returned - staked };
}

export function formatChips(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}

export function formatOutcome(pocket: Pocket, net: number): string {
  const head = `开出 ${pocket} ${colorName(pocket)}`;
  if (net > 0) return `${head} · 净赢 ${formatChips(net)}`;
  if (net < 0) return `${head} · 净输 ${formatChips(-net)}`;
  return `${head} · 打平`;
}
