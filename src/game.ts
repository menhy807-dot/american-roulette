import { renderNotice, type GameNotice } from './i18n.ts';
export type { GameNotice };
import {
  formatChips,
  isChip,
  isSpotId,
  pocketFromUnit,
  settlePlacements,
  totalStake,
  type Chip,
  type Placement,
  type Pocket,
} from './rules.ts';
import { parsePersisted, STARTING_BALANCE, type Persisted, type Store } from './storage.ts';

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
  flash(notice: GameNotice): void;
  persist(): void;
  /** Settled snapshot. Chips still on the felt are counted back into the balance. */
  toPersisted(): Persisted;
  /** Replace the settled snapshot. Refuses while a round is spinning or settling. */
  replacePersisted(data: Persisted): boolean;
}

export interface GameOptions {
  store?: Store;
  random?: () => number;
  reduceMotionDefault?: boolean;
}

const IDLE_NOTICE: GameNotice = { k: 'idle' };

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
  let notice: GameNotice = IDLE_NOTICE;
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
      statusText: renderNotice(notice),
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

  function setStatus(next: GameNotice): void {
    notice = next;
    statusAlert = false;
    emit();
  }

  function flash(next: GameNotice): void {
    notice = next;
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
    notice = {
      k: 'outcome',
      pocket,
      net,
      amount: formatChips(Math.abs(net)),
    };
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
        flash({ k: 'insufficient' });
        return;
      }
      balance -= selectedChip;
      placements = [...placements, { id: nextId, spot, amount: selectedChip }];
      nextId += 1;
      setStatus({
        k: 'placed',
        spot,
        amount: formatChips(selectedChip),
        total: formatChips(totalStake(placements)),
      });
    },
    undo() {
      if (phase !== 'betting') return;
      const last = placements[placements.length - 1];
      if (!last) {
        flash({ k: 'nothingUndo' });
        return;
      }
      placements = placements.slice(0, -1);
      balance += last.amount;
      setStatus(
        placements.length === 0
          ? { k: 'undone' }
          : { k: 'undoneMore', total: formatChips(totalStake(placements)) },
      );
    },
    clearBets() {
      if (phase !== 'betting') return;
      if (placements.length === 0) {
        flash({ k: 'emptyTable' });
        return;
      }
      balance += totalStake(placements);
      placements = [];
      setStatus({ k: 'cleared' });
    },
    spin() {
      if (phase !== 'betting') return;
      if (placements.length === 0) {
        flash({ k: 'needBet' });
        return;
      }
      pending = pocketFromUnit(random());
      roundCommitted = false;
      roundNet = null;
      roundReturn = 0;
      phase = 'spinning';
      notice = { k: 'spinning' };
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
        flash({ k: 'wait' });
        return;
      }
      balance = STARTING_BALANCE;
      lastSettledBalance = STARTING_BALANCE;
      placements = [];
      roundNet = null;
      roundReturn = 0;
      setStatus({ k: 'reset' });
      save();
    },
    flash,
    persist: save,
    toPersisted: projected,
    replacePersisted(data) {
      if (phase !== 'betting') {
        flash({ k: 'wait' });
        return false;
      }
      const parsed = parsePersisted(data, data.reduceMotion);
      if (!parsed) return false;
      balance = parsed.balance;
      lastSettledBalance = parsed.balance;
      placements = [];
      history = parsed.history.slice(0, 10);
      result = history[0] ?? null;
      sfx = parsed.sfx;
      reduceMotion = parsed.reduceMotion;
      pending = null;
      roundCommitted = true;
      roundNet = null;
      roundReturn = 0;
      save();
      setStatus({ k: 'imported' });
      return true;
    },
  };
}
