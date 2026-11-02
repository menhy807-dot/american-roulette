import { isPocket, type Pocket } from './rules.ts';

export const STORAGE_KEY = 'american-roulette-v1';
export const STARTING_BALANCE = 1000;
const MAX_BALANCE = 1_000_000_000;

export interface Persisted {
  v: 1;
  balance: number;
  history: Pocket[];
  sfx: boolean;
  reduceMotion: boolean;
}

export interface Store {
  load(): Persisted | null;
  save(data: Persisted): void;
}

export function parsePersisted(raw: unknown, reduceDefault: boolean): Persisted | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const balance = record.balance;
  if (typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) return null;
  const history = Array.isArray(record.history)
    ? record.history.filter((entry): entry is Pocket => typeof entry === 'string' && isPocket(entry)).slice(0, 10)
    : [];
  return {
    v: 1,
    balance: Math.min(MAX_BALANCE, Math.round(balance)),
    history,
    sfx: record.sfx === true,
    reduceMotion: typeof record.reduceMotion === 'boolean' ? record.reduceMotion : reduceDefault,
  };
}

export function browserStore(reduceDefault: boolean): Store {
  return {
    load() {
      try {
        const text = localStorage.getItem(STORAGE_KEY);
        if (!text) return null;
        return parsePersisted(JSON.parse(text) as unknown, reduceDefault);
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Private mode or a full disk: keep playing this session.
      }
    },
  };
}
