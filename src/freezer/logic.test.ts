import { describe, expect, it } from 'vitest';
import {
  COOL_STEP,
  HEAT_STEP,
  LEAK_STEP,
  PROBE_COUNT,
  SAFE_TEMP,
  SHIFT_SECONDS,
  SPOIL_TEMP,
  START_POWER,
  STRESS_STEP,
  UNIT_COUNT,
  clockOut,
  createShift,
  drainOf,
  focusUnit,
  formatTemp,
  gradeOf,
  isStable,
  pan,
  probe,
  tick,
  timeLeft,
  toggleCut,
  unitHum,
  unitsSaved,
  type ShiftState,
  type Unit,
} from './logic.ts';

function isolateFaulty(state: ShiftState): ShiftState {
  let next = state;
  for (let index = 0; index < UNIT_COUNT; index += 1) {
    const unit = next.units[index];
    if (!unit?.faulty || unit.cut) continue;
    next = toggleCut(focusUnit(next, index));
  }
  return next;
}

function run(state: ShiftState, steps: number): ShiftState {
  let next = state;
  for (let n = 0; n < steps && next.phase === 'play'; n += 1) next = tick(next);
  return next;
}

function leakAt(units: readonly Unit[], index: number): number {
  const left = units[index - 1];
  const right = units[index + 1];
  return (left?.spoiled && !left.cut ? LEAK_STEP : 0) + (right?.spoiled && !right.cut ? LEAK_STEP : 0);
}

describe('freezer shift setup', () => {
  it('deals a reproducible aisle where hums do not tell the whole story', () => {
    expect(createShift(7)).toEqual(createShift(7));
    expect(createShift(2).units.filter((unit) => unit.faulty)).toHaveLength(2);
    expect(createShift(3).units.filter((unit) => unit.faulty)).toHaveLength(3);
    for (let seed = 0; seed < 12; seed += 1) {
      const state = createShift(seed);
      const rattles = state.units.filter((unit) => unitHum(unit) === 'rattle');
      const steadies = state.units.filter((unit) => unitHum(unit) === 'steady');
      const warbles = state.units.filter((unit) => unitHum(unit) === 'warble');
      expect(rattles.length).toBeGreaterThan(0);
      expect(steadies.length).toBeGreaterThan(0);
      expect(rattles.every((unit) => unit.faulty && unit.lying)).toBe(true);
      expect(steadies.every((unit) => !unit.faulty && !unit.lying)).toBe(true);
      expect(warbles.some((unit) => unit.faulty)).toBe(true);
      expect(warbles.some((unit) => !unit.faulty)).toBe(true);
      expect(state.probesLeft).toBe(PROBE_COUNT);
      expect(state.power).toBe(START_POWER);
      expect(state.units).toHaveLength(UNIT_COUNT);
    }
  });

  it('formats tenths of a degree', () => {
    expect(formatTemp(SAFE_TEMP)).toBe('-18.0');
    expect(formatTemp(SPOIL_TEMP)).toBe('-2.0');
    expect(formatTemp(0)).toBe('0.0');
    expect(formatTemp(40)).toBe('4.0');
  });
});

describe('freezer cues and checks', () => {
  it('lets a lying dial stay polite while the food warms', () => {
    const start = createShift(4);
    const liar = start.units.find((unit) => unit.faulty && unit.lying);
    const honest = start.units.find((unit) => unit.faulty && !unit.lying);
    const ghost = start.units.find((unit) => !unit.faulty && unit.lying);
    expect(liar && honest && ghost).toBeTruthy();
    const state = run(start, 10);
    const warmLiar = state.units[liar!.id]!;
    const warmHonest = state.units[honest!.id]!;
    const warmGhost = state.units[ghost!.id]!;
    expect(warmLiar.trueTemp).toBe(SAFE_TEMP + HEAT_STEP * 10);
    expect(warmLiar.gaugeTemp).toBe(SAFE_TEMP);
    expect(warmHonest.gaugeTemp).toBe(warmHonest.trueTemp);
    expect(warmGhost.trueTemp).toBe(SAFE_TEMP);
    expect(warmGhost.gaugeTemp).toBeGreaterThan(warmGhost.trueTemp);
    expect(warmGhost.gaugeTemp).toBeLessThan(0);
  });

  it('spends a manual check to reveal the real temperature and ignores extras', () => {
    let state = createShift(5);
    const warbles = state.units.filter((unit) => unitHum(unit) === 'warble');
    expect(warbles.length).toBeGreaterThanOrEqual(2);
    for (const unit of warbles.slice(0, 2)) {
      state = probe(focusUnit(state, unit.id));
    }
    state = probe(focusUnit(state, warbles[0]!.id));
    expect(state.probesLeft).toBe(PROBE_COUNT - 2);
    const third = state.units.find((unit) => unitHum(unit) === 'steady');
    state = probe(focusUnit(state, third!.id));
    expect(state.probesLeft).toBe(0);
    const untouched = state.units.find((unit) => !unit.probed)!;
    state = focusUnit(state, untouched.id);
    expect(probe(state)).toBe(state);
    const revealed = run(state, 6).units.find((unit) => unit.faulty && unit.probed)!;
    expect(revealed.gaugeTemp).toBe(revealed.trueTemp);
    expect(revealed.trueTemp).toBeGreaterThan(SAFE_TEMP);
  });

  it('slides the focus and stops at the ends of the aisle', () => {
    let state = createShift(1);
    expect(pan(state, -1)).toBe(state);
    state = pan(state, 1);
    expect(state.focus).toBe(1);
    state = focusUnit(state, 99);
    expect(state.focus).toBe(UNIT_COUNT - 1);
    expect(pan(state, 1)).toBe(state);
  });
});

describe('freezer outcomes', () => {
  it('stops a bad cabinet from heating once the line is cut', () => {
    let state = createShift(6);
    const faulty = state.units.find((unit) => unit.faulty)!;
    state = run(state, 8);
    const warmed = state.units[faulty.id]!.trueTemp;
    expect(warmed).toBe(SAFE_TEMP + HEAT_STEP * 8);
    state = toggleCut(focusUnit(state, faulty.id));
    state = run(state, 4);
    expect(state.units[faulty.id]!.trueTemp).toBe(warmed - COOL_STEP * 4);
    expect(state.units[faulty.id]!.spoiled).toBe(false);
    expect(unitHum(state.units[faulty.id]!)).toBe('hush');
  });

  it('warms a healthy cabinet on the backup coil and cools it when reconnected', () => {
    let state = createShift(8);
    const healthy = state.units.find((unit) => !unit.faulty && !unit.lying)!;
    const before = drainOf(state);
    state = toggleCut(focusUnit(state, healthy.id));
    expect(drainOf(state)).toBe(before + 2);
    state = tick(tick(state));
    expect(state.units[healthy.id]!.trueTemp).toBe(SAFE_TEMP + STRESS_STEP * 2);
    state = toggleCut(state);
    expect(drainOf(state)).toBe(before);
    state = tick(state);
    expect(state.units[healthy.id]!.trueTemp).toBe(SAFE_TEMP + STRESS_STEP * 2 - COOL_STEP);
  });

  it('leaks warmth into the neighbors of a spoiled cabinet that stays on the line', () => {
    let state = run(createShift(2), 20);
    expect(state.units.filter((unit) => unit.spoiled).every((unit) => unit.faulty)).toBe(true);
    const neighbor = state.units.findIndex((unit, index) => !unit.spoiled && leakAt(state.units, index) > 0);
    expect(neighbor).toBeGreaterThanOrEqual(0);
    const expected = state.units[neighbor]!.trueTemp + leakAt(state.units, neighbor);
    state = tick(state);
    expect(state.units[neighbor]!.trueTemp).toBe(expected);
    for (let index = 0; index < UNIT_COUNT; index += 1) {
      if (state.units[index]?.spoiled) state = toggleCut(focusUnit(state, index));
    }
    const held = state.units[neighbor]!.trueTemp;
    state = tick(state);
    expect(state.units[neighbor]!.trueTemp).toBe(Math.max(SAFE_TEMP, held - COOL_STEP));
  });

  it('wins early with a full aisle when the bad lines are cut', () => {
    for (const seed of [0, 1, 4, 9]) {
      let state = createShift(seed);
      for (let index = 0; index < UNIT_COUNT; index += 1) {
        state = focusUnit(state, index);
        const hum = unitHum(state.units[index]!);
        if (hum === 'rattle') state = toggleCut(state);
        if (hum === 'warble') state = probe(state);
      }
      state = run(state, 5);
      for (let index = 0; index < UNIT_COUNT; index += 1) {
        const unit = state.units[index]!;
        if (unit.probed && unit.trueTemp > SAFE_TEMP && !unit.cut) {
          state = toggleCut(focusUnit(state, index));
        }
      }
      expect(isStable(state)).toBe(true);
      const won = clockOut(state);
      expect(won.phase).toBe('won');
      expect(won.reason).toBe('clock');
      expect(unitsSaved(won)).toBe(UNIT_COUNT);
      expect(timeLeft(won)).toBe(SHIFT_SECONDS - 5);
      expect(gradeOf(won)).toBe('S');
    }
  });

  it('grades a full shift A and a late save below S', () => {
    let perfect = isolateFaulty(createShift(2));
    perfect = run(perfect, SHIFT_SECONDS);
    expect(perfect.phase).toBe('won');
    expect(perfect.reason).toBe('shift');
    expect(unitsSaved(perfect)).toBe(UNIT_COUNT);
    expect(timeLeft(perfect)).toBe(0);
    expect(gradeOf(perfect)).toBe('A');
    expect(perfect.power).toBeGreaterThan(0);

    let oneGone = createShift(2);
    const firstFault = oneGone.units.find((unit) => unit.faulty)!;
    oneGone = toggleCut(focusUnit(oneGone, firstFault.id));
    oneGone = run(oneGone, 20);
    expect(unitsSaved(oneGone)).toBe(4);
    expect(clockOut(oneGone)).toBe(oneGone);
    oneGone = clockOut(isolateFaulty(oneGone));
    expect(oneGone.reason).toBe('clock');
    expect(unitsSaved(oneGone)).toBe(4);
    expect(gradeOf(oneGone)).toBe('B');

    let partial = run(createShift(2), 20);
    expect(unitsSaved(partial)).toBe(3);
    expect(clockOut(partial)).toBe(partial);
    partial = clockOut(isolateFaulty(partial));
    expect(partial.reason).toBe('clock');
    expect(unitsSaved(partial)).toBe(3);
    expect(gradeOf(partial)).toBe('C');

    const thinner = clockOut(isolateFaulty(run(createShift(1), 20)));
    expect(unitsSaved(thinner)).toBe(2);
    expect(gradeOf(thinner)).toBe('D');
  });

  it('loses the aisle if every cabinet spoils or the backup coils drink the power', () => {
    let ignored = createShift(4);
    ignored = run(ignored, SHIFT_SECONDS);
    expect(ignored.phase).toBe('lost');
    expect(ignored.reason).toBe('spoil');
    expect(gradeOf(ignored)).toBe('F');

    let greedy = createShift(4);
    for (let index = 0; index < UNIT_COUNT; index += 1) greedy = toggleCut(focusUnit(greedy, index));
    greedy = run(greedy, SHIFT_SECONDS);
    expect(greedy.phase).toBe('lost');
    expect(greedy.reason).toBe('power');
    expect(unitsSaved(greedy)).toBe(UNIT_COUNT);
    expect(gradeOf(greedy)).toBe('F');
    expect(tick(greedy)).toBe(greedy);
    expect(toggleCut(greedy)).toBe(greedy);
  });

  it('cannot ride out three bad cabinets without clocking out', () => {
    const ended = run(isolateFaulty(createShift(1)), SHIFT_SECONDS);
    expect(ended.phase).toBe('lost');
    expect(ended.reason).toBe('power');
    expect(ended.tick).toBe(52);
    expect(unitsSaved(ended)).toBe(UNIT_COUNT);
  });
});
