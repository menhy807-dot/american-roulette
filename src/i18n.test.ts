import { describe, expect, it } from 'vitest';
import { dictionaries, LOCALES, matchLocale, type MessageKey } from './i18n.ts';
import { isBigWin } from './celebrate.ts';

const keys = Object.keys(dictionaries.en) as MessageKey[];

describe('translations', () => {
  it('gives every language the same keys and non-empty text', () => {
    for (const locale of LOCALES) {
      const pack = dictionaries[locale];
      expect(Object.keys(pack).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(pack[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('maps browser languages and falls back to English', () => {
    expect(matchLocale('en-US')).toBe('en');
    expect(matchLocale('zh-CN')).toBe('zh-CN');
    expect(matchLocale('zh-Hans')).toBe('zh-CN');
    expect(matchLocale('ja-JP')).toBe('ja');
    expect(matchLocale('ko-KR')).toBe('ko');
    expect(matchLocale('de-AT')).toBe('de');
    expect(matchLocale('es-MX')).toBe('es');
    expect(matchLocale('pt-BR')).toBe('pt');
    expect(matchLocale('it-IT')).toBe('it');
    expect(matchLocale('fr-FR')).toBe('en');
    expect(matchLocale('')).toBe('en');
  });
});

describe('big wins', () => {
  it('celebrates a 10x net or any straight-up hit', () => {
    expect(isBigWin(35, 1, false)).toBe(true);
    expect(isBigWin(9, 1, false)).toBe(false);
    expect(isBigWin(5, 10, true)).toBe(true);
    expect(isBigWin(0, 10, true)).toBe(false);
    expect(isBigWin(-5, 10, false)).toBe(false);
  });
});
