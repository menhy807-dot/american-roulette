import { isPocket, WHEEL_ORDER, type Pocket } from './rules.ts';

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

/**
 * Compact save code, version 1.
 *
 * `AR1.<base64url>.<fnv1a32>`
 * Body bytes: version, uint32 balance, flags, history count, pocket indexes.
 * Flag bit 0 is sound, bit 1 is reduced motion. History is newest first, max 10.
 */
export type SaveCodeError = 'empty' | 'version' | 'checksum' | 'malformed' | 'invalid';

export type SaveCodeResult =
  | { ok: true; data: Persisted }
  | { ok: false; error: SaveCodeError };

const SAVE_VERSION = 1;
const FLAG_SFX = 1;
const FLAG_MOTION = 2;

function fnv1a32(bytes: Uint8Array): number {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(text: string): Uint8Array | null {
  if (text.length === 0 || text.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const padded = text + '='.repeat((4 - (text.length % 4)) % 4);
  try {
    const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  const v = value >>> 0;
  bytes[offset] = (v >>> 24) & 0xff;
  bytes[offset + 1] = (v >>> 16) & 0xff;
  bytes[offset + 2] = (v >>> 8) & 0xff;
  bytes[offset + 3] = v & 0xff;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

/** Checksum an arbitrary body. Tests use this to build corrupt codes. */
export function sealSaveCode(body: Uint8Array): string {
  const version = body[0] ?? 0;
  const sum = fnv1a32(body).toString(16).padStart(8, '0');
  return `AR${version}.${bytesToBase64Url(body)}.${sum}`;
}

export function encodeSaveCode(data: Persisted): string {
  const history = data.history.slice(0, 10);
  const body = new Uint8Array(7 + history.length);
  body[0] = SAVE_VERSION;
  writeUint32(body, 1, Math.min(MAX_BALANCE, Math.max(0, Math.round(data.balance))));
  body[5] = (data.sfx ? FLAG_SFX : 0) | (data.reduceMotion ? FLAG_MOTION : 0);
  body[6] = history.length;
  history.forEach((pocket, index) => {
    const pocketIndex = WHEEL_ORDER.indexOf(pocket);
    body[7 + index] = pocketIndex < 0 ? 0xff : pocketIndex;
  });
  return sealSaveCode(body);
}

export function decodeSaveCode(input: string): SaveCodeResult {
  if (typeof input !== 'string') return { ok: false, error: 'malformed' };
  const cleaned = input.replace(/\s+/g, '');
  if (!cleaned) return { ok: false, error: 'empty' };

  const match = /^AR(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-fA-F]{8})$/i.exec(cleaned);
  if (!match) return { ok: false, error: 'malformed' };
  const versionText = match[1] ?? '';
  const payload = match[2] ?? '';
  const checksum = (match[3] ?? '').toLowerCase();
  if (versionText !== String(SAVE_VERSION)) return { ok: false, error: 'version' };

  const body = base64UrlToBytes(payload);
  if (!body || body.length < 7 || body[0] !== SAVE_VERSION) return { ok: false, error: 'malformed' };
  if (fnv1a32(body).toString(16).padStart(8, '0') !== checksum) return { ok: false, error: 'checksum' };

  const flags = body[5] ?? 0;
  const count = body[6] ?? 0;
  if ((flags & ~(FLAG_SFX | FLAG_MOTION)) !== 0 || count > 10 || body.length !== 7 + count) {
    return { ok: false, error: 'invalid' };
  }

  const history: Pocket[] = [];
  for (let i = 0; i < count; i += 1) {
    const pocket = WHEEL_ORDER[body[7 + i] ?? -1];
    if (!pocket) return { ok: false, error: 'invalid' };
    history.push(pocket);
  }

  const parsed = parsePersisted(
    {
      v: 1,
      balance: readUint32(body, 1),
      history,
      sfx: (flags & FLAG_SFX) === FLAG_SFX,
      reduceMotion: (flags & FLAG_MOTION) === FLAG_MOTION,
    },
    false,
  );
  if (!parsed || parsed.history.length !== history.length) return { ok: false, error: 'invalid' };
  return { ok: true, data: parsed };
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
