/** Pure night-shift rules for the fictional freezer aisle. Temps are tenths of a degree. */

export const UNIT_COUNT = 5;
export const SHIFT_SECONDS = 60;
export const START_POWER = 360;
export const PROBE_COUNT = 3;
export const SAFE_TEMP = -180;
export const SPOIL_TEMP = -20;
export const HEAT_STEP = 8;
export const STRESS_STEP = 3;
export const COOL_STEP = 4;
export const LEAK_STEP = 20;
export const GHOST_CAP = -40;
export const TRUE_CAP = 40;
export const BASE_DRAIN = 1;
export const FAULT_DRAIN = 3;
export const CUT_DRAIN = 2;
export const LOW_POWER = 80;
export const SWIFT_SECONDS = 15;

export type Hum = 'steady' | 'warble' | 'rattle' | 'hush';
export type Trend = 'rising' | 'holding' | 'cooling';
export type Phase = 'play' | 'won' | 'lost';
export type EndReason = 'spoil' | 'power' | 'shift' | 'clock' | null;
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface Unit {
  id: number;
  faulty: boolean;
  /** Gauge does not match the food. Faulty liars stay cold; healthy liars drift warm. */
  lying: boolean;
  cut: boolean;
  probed: boolean;
  spoiled: boolean;
  trueTemp: number;
  gaugeTemp: number;
  trend: Trend;
}

export interface ShiftState {
  seed: number;
  tick: number;
  power: number;
  probesLeft: number;
  focus: number;
  units: readonly Unit[];
  phase: Phase;
  reason: EndReason;
}

export function formatTemp(tenths: number): string {
  const negative = tenths < 0;
  const abs = Math.abs(tenths);
  const whole = Math.floor(abs / 10);
  const frac = abs % 10;
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

export function unitHum(unit: Unit): Hum {
  if (unit.cut) return 'hush';
  if (unit.faulty && unit.lying) return 'rattle';
  if (unit.lying || unit.faulty) return 'warble';
  return 'steady';
}

export function spoiledVisible(unit: Unit): boolean {
  return unit.spoiled && (unit.probed || !unit.lying || unit.gaugeTemp >= SPOIL_TEMP);
}

export function unitsSaved(state: ShiftState): number {
  return state.units.filter((unit) => !unit.spoiled).length;
}

export function timeLeft(state: ShiftState): number {
  return Math.max(0, SHIFT_SECONDS - state.tick);
}

export function drainOf(state: ShiftState): number {
  let drain = BASE_DRAIN;
  for (const unit of state.units) {
    if (unit.faulty && !unit.cut) drain += FAULT_DRAIN;
    if (unit.cut) drain += CUT_DRAIN;
  }
  return drain;
}

export function isStable(state: ShiftState): boolean {
  if (state.phase !== 'play' || state.power <= 0) return false;
  return state.units.every((unit) => !unit.faulty || unit.cut);
}

export function gradeOf(state: ShiftState): Grade {
  if (state.phase !== 'won') return 'F';
  const saved = unitsSaved(state);
  if (saved === UNIT_COUNT && timeLeft(state) >= SWIFT_SECONDS) return 'S';
  if (saved === UNIT_COUNT) return 'A';
  if (saved === UNIT_COUNT - 1) return 'B';
  if (saved === UNIT_COUNT - 2) return 'C';
  if (saved >= 1) return 'D';
  return 'F';
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIds(seed: number): number[] {
  const rng = mulberry32(seed);
  const ids = Array.from({ length: UNIT_COUNT }, (_, index) => index);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = ids[i] ?? i;
    ids[i] = ids[j] ?? j;
    ids[j] = swap;
  }
  return ids;
}

function freshUnit(id: number, faulty: boolean, lying: boolean): Unit {
  return {
    id,
    faulty,
    lying,
    cut: false,
    probed: false,
    spoiled: false,
    trueTemp: SAFE_TEMP,
    gaugeTemp: SAFE_TEMP,
    trend: 'holding',
  };
}

export function createShift(seed: number): ShiftState {
  const normalized = seed >>> 0;
  const order = shuffledIds(normalized);
  const faultyCount = 2 + (normalized % 2);
  const faultyIds = order.slice(0, faultyCount);
  const lyingFaulty = new Set(faultyIds.filter((_, index) => index % 2 === 0));
  const lyingHealthy = order.find((id) => !faultyIds.includes(id)) ?? 0;
  const faultySet = new Set(faultyIds);
  const units = Array.from({ length: UNIT_COUNT }, (_, id) => {
    const faulty = faultySet.has(id);
    const lying = faulty ? lyingFaulty.has(id) : id === lyingHealthy;
    return freshUnit(id, faulty, lying);
  });
  return {
    seed: normalized,
    tick: 0,
    power: START_POWER,
    probesLeft: PROBE_COUNT,
    focus: 0,
    units,
    phase: 'play',
    reason: null,
  };
}

function clampFocus(index: number): number {
  return Math.max(0, Math.min(UNIT_COUNT - 1, Math.trunc(index)));
}

export function focusUnit(state: ShiftState, index: number): ShiftState {
  if (state.phase !== 'play') return state;
  const focus = clampFocus(index);
  if (focus === state.focus) return state;
  return { ...state, focus };
}

export function pan(state: ShiftState, delta: number): ShiftState {
  if (delta === 0) return state;
  return focusUnit(state, state.focus + Math.sign(delta));
}

export function toggleCut(state: ShiftState): ShiftState {
  if (state.phase !== 'play') return state;
  const units = state.units.map((unit, index) => (
    index === state.focus ? { ...unit, cut: !unit.cut } : unit
  ));
  return { ...state, units };
}

export function probe(state: ShiftState): ShiftState {
  if (state.phase !== 'play' || state.probesLeft <= 0) return state;
  const current = state.units[state.focus];
  if (!current || current.probed) return state;
  const units = state.units.map((unit, index) => (
    index === state.focus ? { ...unit, probed: true, gaugeTemp: unit.trueTemp } : unit
  ));
  return { ...state, probesLeft: state.probesLeft - 1, units };
}

function gaugeFor(unit: Unit, trueTemp: number): number {
  if (unit.probed) return trueTemp;
  if (unit.lying && unit.faulty) return SAFE_TEMP;
  if (unit.lying && !unit.faulty) {
    if (unit.cut) return unit.gaugeTemp;
    return Math.min(GHOST_CAP, unit.gaugeTemp + HEAT_STEP);
  }
  return trueTemp;
}

function stepUnit(unit: Unit, leak: number): Unit {
  if (unit.spoiled) {
    return { ...unit, gaugeTemp: gaugeFor(unit, unit.trueTemp), trend: 'holding' };
  }
  let delta = leak;
  if (!unit.cut && unit.faulty) delta += HEAT_STEP;
  else if (unit.cut && !unit.faulty) delta += STRESS_STEP;
  else if (unit.trueTemp > SAFE_TEMP) delta -= COOL_STEP;
  let trueTemp = unit.trueTemp + delta;
  if (delta < 0) trueTemp = Math.max(SAFE_TEMP, trueTemp);
  else trueTemp = Math.min(TRUE_CAP, trueTemp);
  const trend: Trend = trueTemp > unit.trueTemp ? 'rising' : trueTemp < unit.trueTemp ? 'cooling' : 'holding';
  return {
    ...unit,
    trueTemp,
    gaugeTemp: gaugeFor(unit, trueTemp),
    trend,
    spoiled: trueTemp >= SPOIL_TEMP,
  };
}

export function tick(state: ShiftState): ShiftState {
  if (state.phase !== 'play') return state;
  const leaking = state.units.map((unit) => unit.spoiled && !unit.cut);
  const units = state.units.map((unit, index) => {
    const leak = (index > 0 && leaking[index - 1] ? LEAK_STEP : 0)
      + (index < UNIT_COUNT - 1 && leaking[index + 1] ? LEAK_STEP : 0);
    return stepUnit(unit, leak);
  });
  const power = Math.max(0, state.power - drainOf(state));
  const nextTick = state.tick + 1;
  const saved = units.filter((unit) => !unit.spoiled).length;
  let phase: Phase = 'play';
  let reason: EndReason = null;
  if (saved === 0) {
    phase = 'lost';
    reason = 'spoil';
  } else if (power === 0) {
    phase = 'lost';
    reason = 'power';
  } else if (nextTick >= SHIFT_SECONDS) {
    phase = 'won';
    reason = 'shift';
  }
  return { ...state, units, power, tick: nextTick, phase, reason };
}

export function clockOut(state: ShiftState): ShiftState {
  if (!isStable(state)) return state;
  return { ...state, phase: 'won', reason: 'clock' };
}
