import '../styles.css';
import './freezer.css';

import { applyDom, mountLanguageMenu, onLocale, t, type MessageKey } from '../i18n.ts';
import { mountAgeNotice } from '../notice.ts';
import {
  LOW_POWER,
  PROBE_COUNT,
  START_POWER,
  UNIT_COUNT,
  clockOut,
  createShift,
  focusUnit,
  formatTemp,
  gradeOf,
  isStable,
  pan,
  probe,
  spoiledVisible,
  tick,
  timeLeft,
  toggleCut,
  unitHum,
  unitsSaved,
  type EndReason,
  type Hum,
  type ShiftState,
  type Trend,
  type Unit,
} from './logic.ts';

const track = document.querySelector<HTMLElement>('#track');
const minis = document.querySelector<HTMLElement>('#minis');
const pips = document.querySelector<HTMLElement>('#pips');
const powerFill = document.querySelector<HTMLElement>('#power-fill');
const powerNum = document.querySelector<HTMLElement>('#power-num');
const timeNum = document.querySelector<HTMLElement>('#time-num');
const statusNode = document.querySelector<HTMLElement>('#status');
const breaker = document.querySelector<HTMLButtonElement>('#breaker');
const breakerLabel = document.querySelector<HTMLElement>('#breaker-label');
const probeBtn = document.querySelector<HTMLButtonElement>('#probe');
const probeLeft = document.querySelector<HTMLElement>('#probe-left');
const clockBtn = document.querySelector<HTMLButtonElement>('#clock');
const prevBtn = document.querySelector<HTMLButtonElement>('#prev');
const nextBtn = document.querySelector<HTMLButtonElement>('#next');
const helpBtn = document.querySelector<HTMLButtonElement>('#help');
const startBtn = document.querySelector<HTMLButtonElement>('#start');
const againBtn = document.querySelector<HTMLButtonElement>('#again');
const intro = document.querySelector<HTMLElement>('#intro');
const endSheet = document.querySelector<HTMLElement>('#end');
const endCard = endSheet?.querySelector<HTMLElement>('.end-card') ?? null;
const gradeEl = document.querySelector<HTMLElement>('#grade');
const endTitle = document.querySelector<HTMLElement>('#end-title');
const endSaved = document.querySelector<HTMLElement>('#end-saved');
const endTime = document.querySelector<HTMLElement>('#end-time');
const endReason = document.querySelector<HTMLElement>('#end-reason');
const powerBar = document.querySelector<HTMLElement>('.power-bar');
const probeMeter = document.querySelector<HTMLElement>('#probe-meter');

if (
  !track || !minis || !pips || !powerFill || !powerNum || !timeNum || !statusNode ||
  !breaker || !breakerLabel || !probeBtn || !probeLeft || !clockBtn || !prevBtn || !nextBtn ||
  !helpBtn || !startBtn || !againBtn || !intro || !endSheet || !endCard || !gradeEl ||
  !endTitle || !endSaved || !endTime || !endReason || !powerBar || !probeMeter
) {
  throw new Error('Freezer markup is incomplete');
}

const aisle: HTMLElement = track;
const miniRow: HTMLElement = minis;
const pipRow: HTMLElement = pips;
const powerFillEl: HTMLElement = powerFill;
const powerNumEl: HTMLElement = powerNum;
const timeNumEl: HTMLElement = timeNum;
const statusEl: HTMLElement = statusNode;
const breakerBtn: HTMLButtonElement = breaker;
const breakerLabelEl: HTMLElement = breakerLabel;
const probeButton: HTMLButtonElement = probeBtn;
const probeLeftEl: HTMLElement = probeLeft;
const clockButton: HTMLButtonElement = clockBtn;
const prevButton: HTMLButtonElement = prevBtn;
const nextButton: HTMLButtonElement = nextBtn;
const helpButton: HTMLButtonElement = helpBtn;
const startButton: HTMLButtonElement = startBtn;
const againButton: HTMLButtonElement = againBtn;
const introEl: HTMLElement = intro;
const endEl: HTMLElement = endSheet;
const endCardEl: HTMLElement = endCard;
const gradeNode: HTMLElement = gradeEl;
const endTitleEl: HTMLElement = endTitle;
const endSavedEl: HTMLElement = endSaved;
const endTimeEl: HTMLElement = endTime;
const endReasonEl: HTMLElement = endReason;
const powerBarEl: HTMLElement = powerBar;
const probeMeterEl: HTMLElement = probeMeter;

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reduce-motion');
}

interface SlideBits {
  root: HTMLElement;
  door: HTMLElement;
  gauge: HTMLElement;
  needle: HTMLElement;
  temp: HTMLElement;
  cap: HTMLElement;
  hum: HTMLElement;
  bars: HTMLElement;
  stamp: HTMLElement;
}

type Note = 'look' | 'cut' | 'back' | 'probe' | 'noprobe';

function nextSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] || 1;
}

function clockLabel(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${mins}:${String(rest).padStart(2, '0')}`;
}

function humKey(hum: Hum): MessageKey {
  if (hum === 'rattle') return 'freezerHumRattle';
  if (hum === 'warble') return 'freezerHumWarble';
  if (hum === 'hush') return 'freezerHumHush';
  return 'freezerHumSteady';
}

function trendLabel(trend: Trend): string {
  if (trend === 'rising') return t('freezerTrendRising');
  if (trend === 'cooling') return t('freezerTrendCooling');
  return t('freezerTrendHolding');
}

function reasonLabel(reason: EndReason): string {
  if (reason === 'spoil') return t('freezerReasonSpoil');
  if (reason === 'power') return t('freezerReasonPower');
  if (reason === 'clock') return t('freezerReasonClock');
  return t('freezerReasonShift');
}

function needleAngle(tenths: number): number {
  const clamped = Math.max(-200, Math.min(20, tenths));
  const ratio = (clamped + 200) / 220;
  return -80 + ratio * 160;
}

function band(tenths: number): '' | 'warm' | 'hot' {
  if (tenths >= -50) return 'hot';
  if (tenths >= -100) return 'warm';
  return '';
}

const slides: SlideBits[] = [];
const miniButtons: HTMLButtonElement[] = [];

for (let index = 0; index < UNIT_COUNT; index += 1) {
  const slide = document.createElement('section');
  slide.className = 'slide';
  const door = document.createElement('div');
  door.className = 'door';
  const shelves = document.createElement('div');
  shelves.className = 'shelves';
  shelves.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
  const handle = document.createElement('div');
  handle.className = 'door-handle';
  const gauge = document.createElement('div');
  gauge.className = 'gauge';
  const needle = document.createElement('div');
  needle.className = 'needle';
  const hub = document.createElement('div');
  hub.className = 'gauge-hub';
  gauge.append(needle, hub);
  const temp = document.createElement('p');
  temp.className = 'temp-read';
  const cap = document.createElement('p');
  cap.className = 'temp-cap';
  const bars = document.createElement('div');
  bars.className = 'hum-bars';
  bars.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
  const hum = document.createElement('p');
  hum.className = 'hum-label';
  const stamp = document.createElement('div');
  stamp.className = 'spoil-stamp';
  stamp.hidden = true;
  door.append(shelves, handle, gauge, temp, cap, bars, hum, stamp);
  slide.append(door);
  aisle.append(slide);
  slides.push({ root: slide, door, gauge, needle, temp, cap, hum, bars, stamp });

  const mini = document.createElement('button');
  mini.type = 'button';
  mini.className = 'mini';
  mini.role = 'tab';
  mini.textContent = String(index + 1);
  mini.addEventListener('click', () => {
    if (!canPlay()) return;
    note = 'look';
    state = focusUnit(state, index);
    render();
  });
  miniRow.append(mini);
  miniButtons.push(mini);
}

for (let index = 0; index < PROBE_COUNT; index += 1) {
  pipRow.append(document.createElement('i'));
}

let state: ShiftState = createShift(nextSeed());
let started = false;
let note: Note = 'look';
let timer = 0;

function canPlay(): boolean {
  return started && state.phase === 'play' && introEl.hasAttribute('hidden');
}

function paintIntroButton(): void {
  const key: MessageKey = started ? 'close' : 'freezerStart';
  startButton.dataset.i18n = key;
  startButton.textContent = t(key);
}

function begin(): void {
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (!canPlay()) return;
    state = tick(state);
    render();
  }, 1000);
}

function statusCopy(): { text: string; alert: boolean } {
  const unit = state.units[state.focus];
  if (!unit || state.phase !== 'play') return { text: t('freezerStatusLook'), alert: false };
  if (spoiledVisible(unit)) return { text: t('freezerStatusSpoiled'), alert: true };
  if (isStable(state) && state.power <= LOW_POWER) return { text: t('freezerStatusLow'), alert: true };
  if (note === 'noprobe') return { text: t('freezerNoProbes'), alert: true };
  if (note === 'cut') return { text: t('freezerStatusCut'), alert: false };
  if (note === 'back') return { text: t('freezerStatusBack'), alert: false };
  if (unit.probed) {
    return {
      text: t('freezerStatusProbe', { temp: formatTemp(unit.gaugeTemp), trend: trendLabel(unit.trend) }),
      alert: false,
    };
  }
  if (isStable(state)) return { text: t('freezerStatusStable'), alert: false };
  return { text: t('freezerStatusLook'), alert: false };
}

function paintUnit(unit: Unit, bits: SlideBits): void {
  const shown = unit.gaugeTemp;
  const tone = band(shown);
  const hum = unitHum(unit);
  bits.door.classList.toggle('warm', tone === 'warm');
  bits.door.classList.toggle('hot', tone === 'hot');
  bits.door.classList.toggle('spoiled', spoiledVisible(unit));
  bits.gauge.classList.toggle('true', unit.probed);
  bits.needle.style.transform = `rotate(${needleAngle(shown)}deg)`;
  bits.temp.textContent = `${formatTemp(shown)}°`;
  bits.cap.textContent = unit.probed ? trendLabel(unit.trend) : t('freezerGauge');
  bits.hum.textContent = t(humKey(hum));
  bits.bars.className = `hum-bars hum-${hum}`;
  bits.stamp.hidden = !spoiledVisible(unit);
  bits.stamp.textContent = t('freezerSpoiled');
  const name = t('freezerUnit', { n: unit.id + 1 });
  bits.root.setAttribute('aria-label', `${name}. ${formatTemp(shown)}°. ${t(humKey(hum))}`);
}

function render(): void {
  applyDom(document);
  paintIntroButton();
  document.title = t('docTitleFreezer');
  aisle.style.transform = `translateX(-${state.focus * 20}%)`;
  state.units.forEach((unit, index) => {
    const bits = slides[index];
    const mini = miniButtons[index];
    if (!bits || !mini) return;
    paintUnit(unit, bits);
    const tone = band(unit.gaugeTemp);
    mini.classList.toggle('warm', tone === 'warm');
    mini.classList.toggle('hot', tone === 'hot');
    mini.classList.toggle('cut', unit.cut);
    mini.setAttribute('aria-selected', index === state.focus ? 'true' : 'false');
    mini.setAttribute('aria-label', t('freezerUnit', { n: index + 1 }));
    mini.tabIndex = index === state.focus ? 0 : -1;
  });

  const focused = state.units[state.focus];
  const cut = focused?.cut ?? false;
  breakerBtn.classList.toggle('is-cut', cut);
  breakerBtn.setAttribute('aria-pressed', cut ? 'true' : 'false');
  breakerLabelEl.textContent = cut ? t('freezerReconnect') : t('freezerCut');
  breakerBtn.disabled = state.phase !== 'play';

  const checks = focused?.probed ? 0 : state.probesLeft;
  probeLeftEl.textContent = state.probesLeft > 0 ? t('freezerProbeLeft', { n: state.probesLeft }) : t('freezerNoProbes');
  probeButton.disabled = state.phase !== 'play' || (state.probesLeft <= 0 && !focused?.probed);
  probeMeterEl.setAttribute('aria-label', `${t('freezerProbes')} ${checks}`);
  const dots = pipRow.querySelectorAll('i');
  dots.forEach((dot, index) => dot.classList.toggle('on', index < state.probesLeft));

  const stable = isStable(state);
  clockButton.disabled = !stable;
  const left = timeLeft(state);
  timeNumEl.textContent = clockLabel(left);
  powerNumEl.textContent = String(state.power);
  const ratio = Math.max(0, Math.min(1, state.power / START_POWER));
  powerFillEl.style.width = `${ratio * 100}%`;
  powerBarEl.classList.toggle('low', state.power <= LOW_POWER);

  const copy = statusCopy();
  statusEl.textContent = copy.text;
  statusEl.classList.toggle('alert', copy.alert);

  const over = state.phase !== 'play';
  endEl.hidden = !over;
  if (over) {
    window.clearInterval(timer);
    endCardEl.classList.toggle('lost', state.phase === 'lost');
    gradeNode.textContent = gradeOf(state);
    endTitleEl.textContent = state.phase === 'won' ? t('freezerEndWin') : t('freezerEndLose');
    endSavedEl.textContent = t('freezerSavedCount', { n: unitsSaved(state) });
    endTimeEl.textContent = t('freezerTimeLeft', { n: left });
    endReasonEl.textContent = reasonLabel(state.reason);
  }
}

function cutLine(): void {
  if (!canPlay()) return;
  const before = state.units[state.focus]?.cut ?? false;
  state = toggleCut(state);
  const after = state.units[state.focus]?.cut ?? before;
  if (after !== before) note = after ? 'cut' : 'back';
  render();
}

function checkCabinet(): void {
  if (!canPlay()) return;
  const unit = state.units[state.focus];
  if (!unit) return;
  if (unit.probed) {
    note = 'probe';
    render();
    return;
  }
  if (state.probesLeft <= 0) {
    note = 'noprobe';
    render();
    return;
  }
  state = probe(state);
  note = 'probe';
  render();
}

function move(delta: number): void {
  if (!canPlay()) return;
  note = 'look';
  state = pan(state, delta);
  render();
}

prevButton.addEventListener('click', () => move(-1));
nextButton.addEventListener('click', () => move(1));
probeButton.addEventListener('click', checkCabinet);

let suppressBreakerClick = false;
breakerBtn.addEventListener('click', () => {
  if (suppressBreakerClick) {
    suppressBreakerClick = false;
    return;
  }
  cutLine();
});
clockButton.addEventListener('click', () => {
  if (!canPlay()) return;
  state = clockOut(state);
  render();
});

let dragX = 0;
let dragId = -1;
aisle.addEventListener('pointerdown', (event) => {
  if (!canPlay()) return;
  dragId = event.pointerId;
  dragX = event.clientX;
  aisle.setPointerCapture(event.pointerId);
});
aisle.addEventListener('pointerup', (event) => {
  if (event.pointerId !== dragId) return;
  const dx = event.clientX - dragX;
  dragId = -1;
  if (dx <= -36) move(1);
  else if (dx >= 36) move(-1);
});

let breakX = 0;
let breakId = -1;
breakerBtn.addEventListener('pointerdown', (event) => {
  if (!canPlay()) return;
  breakId = event.pointerId;
  breakX = event.clientX;
});
breakerBtn.addEventListener('pointerup', (event) => {
  if (event.pointerId !== breakId) return;
  const dx = event.clientX - breakX;
  breakId = -1;
  if (Math.abs(dx) < 16) return;
  suppressBreakerClick = true;
  window.setTimeout(() => {
    suppressBreakerClick = false;
  }, 0);
  const cut = state.units[state.focus]?.cut ?? false;
  if ((dx > 0 && !cut) || (dx < 0 && cut)) cutLine();
});

helpButton.addEventListener('click', () => {
  if (state.phase !== 'play') return;
  introEl.hidden = false;
  paintIntroButton();
});

startButton.addEventListener('click', () => {
  introEl.hidden = true;
  if (!started) {
    started = true;
    begin();
  }
  render();
});

againButton.addEventListener('click', () => {
  window.clearInterval(timer);
  state = createShift(nextSeed());
  started = false;
  note = 'look';
  endEl.hidden = true;
  introEl.hidden = false;
  render();
});

window.addEventListener('keydown', (event) => {
  if (!canPlay()) return;
  if (event.key === 'ArrowLeft') move(-1);
  else if (event.key === 'ArrowRight') move(1);
  else return;
  event.preventDefault();
});

const langMenu = document.querySelector<HTMLElement>('.lang-menu');
if (langMenu) mountLanguageMenu(langMenu);
onLocale(render);
render();
mountAgeNotice();
