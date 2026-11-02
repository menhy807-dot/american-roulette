import {
  describeSpot,
  formatChips,
  formatOutcome,
  isChip,
  isSpotId,
  pocketFromUnit,
  settlePlacements,
  totalStake,
  type Chip,
  type Placement,
  type Pocket,
} from './rules.ts';
import { STARTING_BALANCE, type Persisted, type Store } from './storage.ts';

export type Phase = 'betting' | 'spinning' | 'settling';

export interface GameState {
  balance: number;
  placements: Placement[];
  phase: Phase;
  selectedChip: Chip;
  /** Last revealed pocket. Stays up between rounds. */
  result: Pocket | null;
  /** Pocket chosen for the spin in progress. Not shown until it settles. */
  pending: Pocket | null;
  history: Pocket[];
  sfx: boolean;
  reduceMotion: boolean;
  statusText: string;
  statusAlert: boolean;
  statusNonce: number;
  roundNet: number | null;
  roundReturn: number;
}

export interface Game {
  getState(): GameState;
  subscribe(listener: () => void): () => void;
  selectChip(amount: number): void;
  place(spot: string): void;
  undo(): void;
  clearBets(): void;
  spin(): void;
  finishSpin(): void;
  completeRound(): void;
  setSfx(on: boolean): void;
  setReduceMotion(on: boolean): void;
  resetBalance(): void;
  flash(text: string): void;
  persist(): void;
}

export interface GameOptions {
  store?: Store;
  random?: () => number;
  reduceMotionDefault?: boolean;
}

const IDLE_STATUS = '选择筹码，再点击注区下注';

function cryptoUnit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 4294967296;
}

export function createGame(options: GameOptions = {}): Game {
  const reduceDefault = options.reduceMotionDefault ?? false;
  const store = options.store;
  const random = options.random ?? cryptoUnit;
  const loaded = store?.load() ?? null;
  const saved: Persisted = loaded ?? {
    v: 1,
    balance: STARTING_BALANCE,
    history: [],
    sfx: false,
    reduceMotion: reduceDefault,
  };

  let balance = saved.balance;
  let lastSettledBalance = saved.balance;
  let placements: Placement[] = [];
  let phase: Phase = 'betting';
  let selectedChip: Chip = 5;
  let result: Pocket | null = saved.history[0] ?? null;
  let pending: Pocket | null = null;
  let history = saved.history.slice(0, 10);
  let sfx = saved.sfx;
  let reduceMotion = saved.reduceMotion;
  let statusText = IDLE_STATUS;
  let statusAlert = false;
  let statusNonce = 0;
  let roundNet: number | null = null;
  let roundReturn = 0;
  let nextId = 1;
  /** False only while a clicked spin has not been paid yet. */
  let roundCommitted = true;

  const listeners = new Set<() => void>();

  function snapshot(): GameState {
    return {
      balance,
      placements: placements.slice(),
      phase,
      selectedChip,
      result,
      pending,
      history: history.slice(),
      sfx,
      reduceMotion,
      statusText,
      statusAlert,
      statusNonce,
      roundNet,
      roundReturn,
    };
  }

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function projected(): Persisted {
    if (!roundCommitted && pending) {
      const { returned } = settlePlacements(placements, pending);
      return {
        v: 1,
        balance: balance + returned,
        history: [pending, ...history].slice(0, 10),
        sfx,
        reduceMotion,
      };
    }
    return {
      v: 1,
      balance: lastSettledBalance,
      history: history.slice(0, 10),
      sfx,
      reduceMotion,
    };
  }

  function save(): void {
    store?.save(projected());
  }

  function setStatus(text: string): void {
    statusText = text;
    statusAlert = false;
    emit();
  }

  function flash(text: string): void {
    statusText = text;
    statusAlert = true;
    statusNonce += 1;
    emit();
  }

  function commitSettlement(): void {
    if (roundCommitted || !pending) return;
    const pocket = pending;
    const { returned, net } = settlePlacements(placements, pocket);
    balance += returned;
    result = pocket;
    history = [pocket, ...history].slice(0, 10);
    roundNet = net;
    roundReturn = returned;
    lastSettledBalance = balance;
    pending = null;
    roundCommitted = true;
    phase = 'settling';
    statusText = formatOutcome(pocket, net);
    statusAlert = false;
    save();
  }

  return {
    getState: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    selectChip(amount) {
      if (!isChip(amount)) return;
      selectedChip = amount;
      emit();
    },
    place(spot) {
      if (phase !== 'betting' || !isSpotId(spot)) return;
      if (selectedChip > balance) {
        flash('余额不足');
        return;
      }
      balance -= selectedChip;
      placements = [...placements, { id: nextId, spot, amount: selectedChip }];
      nextId += 1;
      const copy = describeSpot(spot);
      setStatus(`${copy.title} 已加 ${formatChips(selectedChip)} · 本局 ${formatChips(totalStake(placements))}`);
    },
    undo() {
      if (phase !== 'betting') return;
      const last = placements[placements.length - 1];
      if (!last) {
        flash('没有可撤销的下注');
        return;
      }
      placements = placements.slice(0, -1);
      balance += last.amount;
      setStatus(
        placements.length === 0
          ? '已撤销上一注'
          : `已撤销上一注 · 本局 ${formatChips(totalStake(placements))}`,
      );
    },
    clearBets() {
      if (phase !== 'betting') return;
      if (placements.length === 0) {
        flash('桌面上没有筹码');
        return;
      }
      balance += totalStake(placements);
      placements = [];
      setStatus('已清空本局下注');
    },
    spin() {
      if (phase !== 'betting') return;
      if (placements.length === 0) {
        flash('请先至少下一注');
        return;
      }
      pending = pocketFromUnit(random());
      roundCommitted = false;
      roundNet = null;
      roundReturn = 0;
      phase = 'spinning';
      statusText = '轮盘转动中…';
      statusAlert = false;
      // The pocket is already chosen. Persist the settled outcome so a reload cannot void it.
      save();
      emit();
    },
    finishSpin() {
      if (phase !== 'spinning') return;
      commitSettlement();
      emit();
    },
    completeRound() {
      if (phase !== 'settling') return;
      placements = [];
      phase = 'betting';
      roundReturn = 0;
      emit();
    },
    setSfx(on) {
      sfx = on;
      save();
      emit();
    },
    setReduceMotion(on) {
      reduceMotion = on;
      save();
      emit();
    },
    resetBalance() {
      if (phase !== 'betting') {
        flash('请等待本局结束');
        return;
      }
      balance = STARTING_BALANCE;
      lastSettledBalance = STARTING_BALANCE;
      placements = [];
      roundNet = null;
      roundReturn = 0;
      setStatus('余额已重置为 1,000');
      save();
    },
    flash,
    persist: save,
  };
}
