import '@fontsource/noto-serif-sc/latin-600.css';
import '@fontsource/noto-serif-sc/chinese-simplified-600.css';
import '@fontsource/noto-sans-sc/latin-400.css';
import '@fontsource/noto-sans-sc/latin-700.css';
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-700.css';
import './styles.css';

import { playChip, playLose, playSpin, playWin } from './audio.ts';
import { paintChip } from './chips.ts';
import { createGame, type Phase } from './game.ts';
import { CHIP_VALUES, colorOf, formatChips, totalStake, type Chip, type Pocket } from './rules.ts';
import { browserStore } from './storage.ts';
import { mountTable } from './table.ts';
import { CHIP_FLY_MS, settleHoldMs, spinDurationMs } from './timing.ts';
import { mountWheel, renderHub } from './wheel.ts';

const reduceDefault = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const game = createGame({
  store: browserStore(reduceDefault),
  reduceMotionDefault: reduceDefault,
});

const balanceEl = document.querySelector<HTMLElement>('#balance');
const wagerEl = document.querySelector<HTMLElement>('#wager');
const statusEl = document.querySelector<HTMLElement>('#status');
const historyEl = document.querySelector<HTMLElement>('#history');
const spinBtn = document.querySelector<HTMLButtonElement>('#spin');
const undoBtn = document.querySelector<HTMLButtonElement>('#undo');
const clearBtn = document.querySelector<HTMLButtonElement>('#clear');
const chipRow = document.querySelector<HTMLElement>('#chip-row');
const wheelRoot = document.querySelector<HTMLElement>('#wheel-root');
const tableRoot = document.querySelector<HTMLElement>('#table-root');
const sfxToggle = document.querySelector<HTMLInputElement>('#sfx-toggle');
const motionToggle = document.querySelector<HTMLInputElement>('#motion-toggle');
const settingsDialog = document.querySelector<HTMLDialogElement>('#settings-dialog');
const rulesDialog = document.querySelector<HTMLDialogElement>('#rules-dialog');
const resetDialog = document.querySelector<HTMLDialogElement>('#reset-dialog');

if (
  !balanceEl || !wagerEl || !statusEl || !historyEl || !spinBtn || !undoBtn || !clearBtn ||
  !chipRow || !wheelRoot || !tableRoot || !sfxToggle || !motionToggle ||
  !settingsDialog || !rulesDialog || !resetDialog
) {
  throw new Error('页面结构不完整');
}

const balanceNode = balanceEl;
const wagerNode = wagerEl;
const statusNode = statusEl;
const historyNode = historyEl;
const spinButton = spinBtn;
const undoButton = undoBtn;
const clearButton = clearBtn;
const chipTray = chipRow;
const sfxInput = sfxToggle;
const motionInput = motionToggle;

const wheel = mountWheel(wheelRoot);
const table = mountTable(tableRoot, (spot, cell) => {
  const before = game.getState().placements.length;
  const chip = game.getState().selectedChip;
  game.place(spot);
  const state = game.getState();
  if (state.placements.length === before) return;
  if (state.sfx) playChip();
  if (!state.reduceMotion) {
    const from = chipRow.querySelector<HTMLElement>(`[data-chip="${chip}"]`)?.getBoundingClientRect();
    if (from) flyChip(chip, from, cell.getBoundingClientRect());
  }
});

for (const amount of CHIP_VALUES) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip-face tray-chip';
  btn.dataset.chip = String(amount);
  btn.setAttribute('aria-label', `面额 ${amount}`);
  paintChip(btn, amount);
  btn.addEventListener('click', () => game.selectChip(amount));
  chipRow.appendChild(btn);
}

let displayedBalance = game.getState().balance;
let balanceFrame = 0;
let seenNonce = -1;
let prevPhase: Phase = game.getState().phase;
let settleTimer = 0;

function setBalance(next: number, animate: boolean): void {
  window.cancelAnimationFrame(balanceFrame);
  if (!animate || next === displayedBalance) {
    balanceNode.textContent = formatChips(next);
    displayedBalance = next;
    balanceNode.classList.remove('bump');
    return;
  }
  const from = displayedBalance;
  displayedBalance = next;
  const started = performance.now();
  balanceNode.classList.add('bump');
  const tick = (now: number) => {
    const progress = Math.min(1, (now - started) / 700);
    const eased = 1 - (1 - progress) ** 3;
    balanceNode.textContent = formatChips(from + (next - from) * eased);
    if (progress < 1) balanceFrame = window.requestAnimationFrame(tick);
    else balanceNode.classList.remove('bump');
  };
  balanceFrame = window.requestAnimationFrame(tick);
}

function renderHistory(history: readonly Pocket[]): void {
  historyNode.replaceChildren();
  if (history.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = '还没有开奖';
    historyNode.appendChild(empty);
    return;
  }
  history.forEach((pocket, index) => {
    const pill = document.createElement('span');
    pill.className = `pill ${colorOf(pocket)}${index === 0 ? ' latest' : ''}`;
    pill.textContent = pocket;
    historyNode.appendChild(pill);
  });
}

function flyChip(amount: Chip, from: DOMRect, to: DOMRect): void {
  const el = document.createElement('span');
  el.className = 'chip-face flying';
  paintChip(el, amount);
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;
  el.style.transform = `translate(${startX}px, ${startY}px) translate(-50%, -50%)`;
  document.body.appendChild(el);
  void el.offsetWidth;
  el.style.transition = `transform ${CHIP_FLY_MS}ms cubic-bezier(0.18, 0.7, 0.2, 1)`;
  el.style.transform = `translate(${endX}px, ${endY}px) translate(-50%, -50%) scale(0.62)`;
  window.setTimeout(() => el.remove(), CHIP_FLY_MS + 40);
}

function sync(): void {
  const state = game.getState();
  const enteredSpin = state.phase === 'spinning' && prevPhase !== 'spinning';
  const enteredSettle = state.phase === 'settling' && prevPhase !== 'settling';
  document.documentElement.classList.toggle('reduce-motion', state.reduceMotion);

  setBalance(state.balance, enteredSettle && !state.reduceMotion);
  wagerNode.textContent = formatChips(totalStake(state.placements));
  statusNode.textContent = state.statusText;
  statusNode.classList.toggle('alert', state.statusAlert);
  if (state.statusNonce !== seenNonce) {
    seenNonce = state.statusNonce;
    statusNode.classList.remove('flash');
    if (state.statusAlert) {
      void statusNode.offsetWidth;
      statusNode.classList.add('flash');
    }
  }

  for (const btn of chipTray.querySelectorAll<HTMLButtonElement>('.tray-chip')) {
    const amount = Number(btn.dataset.chip);
    const selected = amount === state.selectedChip;
    btn.classList.toggle('selected', selected);
    btn.classList.toggle('unaffordable', amount > state.balance);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }

  const editing = state.phase === 'betting';
  undoButton.disabled = !editing || state.placements.length === 0;
  clearButton.disabled = !editing || state.placements.length === 0;
  spinButton.disabled = !editing;
  spinButton.textContent = state.phase === 'spinning' ? '转动中' : state.phase === 'settling' ? '结算中' : '开转';

  table.render(state);
  renderHistory(state.history);
  renderHub(state.phase, state.result, state.reduceMotion);
  sfxInput.checked = state.sfx;
  motionInput.checked = state.reduceMotion;

  if (enteredSpin) wheel.highlight(null);
  if (enteredSpin && state.pending) {
    if (state.sfx) playSpin();
    const duration = spinDurationMs(state.reduceMotion, Math.random());
    wheel.spinTo(state.pending, duration, () => game.finishSpin());
  }
  if (enteredSettle) {
    if (state.result) wheel.highlight(state.result);
    if (state.sfx) {
      if ((state.roundNet ?? 0) > 0) playWin();
      else playLose();
    }
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => game.completeRound(), settleHoldMs(state.reduceMotion));
  }

  prevPhase = state.phase;
}

undoBtn.addEventListener('click', () => {
  const before = game.getState().placements.length;
  game.undo();
  if (game.getState().sfx && game.getState().placements.length < before) playChip();
});

clearBtn.addEventListener('click', () => {
  const before = game.getState().placements.length;
  game.clearBets();
  if (game.getState().sfx && before > 0 && game.getState().placements.length === 0) playChip();
});

spinBtn.addEventListener('click', () => game.spin());

document.querySelector<HTMLButtonElement>('#open-settings')?.addEventListener('click', () => {
  settingsDialog.showModal();
});

sfxToggle.addEventListener('change', () => game.setSfx(sfxToggle.checked));
motionToggle.addEventListener('change', () => game.setReduceMotion(motionToggle.checked));

document.querySelector<HTMLButtonElement>('#open-rules')?.addEventListener('click', () => {
  settingsDialog.close();
  rulesDialog.showModal();
});

document.querySelector<HTMLButtonElement>('#open-reset')?.addEventListener('click', () => {
  if (game.getState().phase !== 'betting') {
    settingsDialog.close();
    game.flash('请等待本局结束');
    return;
  }
  settingsDialog.close();
  resetDialog.showModal();
});

document.querySelector<HTMLButtonElement>('#reset-cancel')?.addEventListener('click', () => {
  resetDialog.close();
});

document.querySelector<HTMLButtonElement>('#reset-confirm')?.addEventListener('click', () => {
  resetDialog.close();
  game.resetBalance();
});

for (const dialog of [settingsDialog, rulesDialog, resetDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => dialog.close());
  });
}

window.addEventListener('pagehide', () => game.persist());
window.addEventListener('beforeunload', () => game.persist());

const initial = game.getState();
if (initial.result) wheel.jumpTo(initial.result);
sync();
game.subscribe(sync);
