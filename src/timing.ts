/** Wheel spin length. Full motion is 3.5–5s; reduced motion skips it. */
export function spinDurationMs(reduceMotion: boolean, unit: number): number {
  if (reduceMotion) return 0;
  const t = Math.min(1, Math.max(0, unit));
  return 3500 + Math.min(1500, Math.floor(t * 1501));
}

/** How long the winning pockets stay up before the next round. */
export function settleHoldMs(reduceMotion: boolean): number {
  return reduceMotion ? 900 : 1800;
}

export const CHIP_FLY_MS = 220;
