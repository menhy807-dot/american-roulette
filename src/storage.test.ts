import { describe, expect, it } from 'vitest';
import { WHEEL_ORDER, type Pocket } from './rules.ts';
import {
  decodeSaveCode,
  encodeSaveCode,
  sealSaveCode,
  type Persisted,
} from './storage.ts';

const FULL: Persisted = {
  v: 1,
  balance: 640,
  history: ['00', '8', '19', '0', '36'],
  sfx: true,
  reduceMotion: false,
};

function bodyOf(code: string): Uint8Array {
  const payload = code.split('.')[1] ?? '';
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

describe('save code', () => {
  it('roundtrips the full settled state', () => {
    const code = encodeSaveCode(FULL);
    expect(code).toMatch(/^AR1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    expect(code.includes('+')).toBe(false);
    expect(code.includes('/')).toBe(false);
    expect(code.includes('=')).toBe(false);
    expect(decodeSaveCode(code)).toEqual({ ok: true, data: FULL });
    expect(encodeSaveCode(FULL)).toBe(code);
  });

  it('keeps history order, both greens, and every flag combination', () => {
    const history = WHEEL_ORDER.slice(0, 10);
    const flags: Array<[boolean, boolean]> = [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ];
    for (const [sfx, reduceMotion] of flags) {
      const data: Persisted = { v: 1, balance: 0, history, sfx, reduceMotion };
      expect(decodeSaveCode(encodeSaveCode(data))).toEqual({ ok: true, data });
    }
    const rich: Persisted = {
      v: 1,
      balance: 1_000_000_000,
      history: ['00', '0', ...WHEEL_ORDER.slice(0, 8)],
      sfx: false,
      reduceMotion: true,
    };
    expect(decodeSaveCode(encodeSaveCode(rich))).toEqual({ ok: true, data: rich });
    const decoded = decodeSaveCode(encodeSaveCode(rich));
    expect(decoded.ok && decoded.data.history[0]).toBe('00');
  });

  it('ignores whitespace and checksum letter case', () => {
    const code = encodeSaveCode(FULL);
    const wrapped = `${code.slice(0, 6)}\n${code.slice(6, 12)} ${code.slice(12)}`;
    const mixed = wrapped.replace(/[0-9a-f]{8}$/, (sum) => sum.toUpperCase());
    expect(decodeSaveCode(`  ${mixed}\n`).ok).toBe(true);
    expect(decodeSaveCode(mixed)).toEqual(decodeSaveCode(code));
  });

  it('rejects empty, unknown versions, bad checksums, and garbage', () => {
    expect(decodeSaveCode('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeSaveCode('   \n')).toEqual({ ok: false, error: 'empty' });
    expect(decodeSaveCode('not a code')).toEqual({ ok: false, error: 'malformed' });
    expect(decodeSaveCode('AR1')).toEqual({ ok: false, error: 'malformed' });
    expect(decodeSaveCode('AR1.abcd')).toEqual({ ok: false, error: 'malformed' });

    const future = sealSaveCode(Uint8Array.of(2, 0, 0, 0, 0, 0, 0));
    expect(future.startsWith('AR2.')).toBe(true);
    expect(decodeSaveCode(future)).toEqual({ ok: false, error: 'version' });

    const code = encodeSaveCode(FULL);
    const bumped = code.replace(/[0-9a-f]$/, (digit) => (digit === '0' ? '1' : '0'));
    expect(decodeSaveCode(bumped)).toEqual({ ok: false, error: 'checksum' });

    const [prefix, payload, sum] = code.split('.');
    expect(decodeSaveCode(`${prefix}.${payload?.slice(0, -1)}.${sum}`)).toEqual({
      ok: false,
      error: 'checksum',
    });
    expect(decodeSaveCode(`${prefix}.${(payload ?? '') + 'AA'}.${sum}`)).toEqual({
      ok: false,
      error: 'checksum',
    });
  });

  it('rejects a checksummed body with a bad pocket, length, or flag', () => {
    const pocket = bodyOf(encodeSaveCode(FULL));
    pocket[7] = 200;
    expect(decodeSaveCode(sealSaveCode(pocket))).toEqual({ ok: false, error: 'invalid' });

    const short = bodyOf(encodeSaveCode({ ...FULL, history: [] }));
    short[6] = 3;
    expect(decodeSaveCode(sealSaveCode(short))).toEqual({ ok: false, error: 'invalid' });

    const flags = bodyOf(encodeSaveCode({ ...FULL, history: [] as Pocket[] }));
    flags[5] = 4;
    expect(decodeSaveCode(sealSaveCode(flags))).toEqual({ ok: false, error: 'invalid' });

    const mismatched = bodyOf(encodeSaveCode({ ...FULL, history: [] }));
    mismatched[0] = 9;
    const sealed = sealSaveCode(mismatched).replace(/^AR9\./, 'AR1.');
    expect(decodeSaveCode(sealed).ok).toBe(false);
  });
});
