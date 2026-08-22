import { describe, expect, it } from 'vitest';
import { fitsLineBudget, LINE_BUDGET, phrases, type PhraseSet } from './phrases';

describe('fitsLineBudget', () => {
  it('accepts a line exactly at the 14-char budget', () => {
    expect(fitsLineBudget('A'.repeat(14))).toBe(true);
  });

  it('rejects a line one character over the 14-char budget', () => {
    expect(fitsLineBudget('A'.repeat(15))).toBe(false);
  });

  it('accepts an empty line', () => {
    expect(fitsLineBudget('')).toBe(true);
  });

  it('respects a custom max instead of the default LINE_BUDGET', () => {
    expect(fitsLineBudget('A'.repeat(5), 4)).toBe(false);
    expect(fitsLineBudget('A'.repeat(4), 4)).toBe(true);
  });

  it('defaults to LINE_BUDGET (14) when max is omitted', () => {
    expect(LINE_BUDGET).toBe(14);
    expect(fitsLineBudget('A'.repeat(14))).toBe(true);
    expect(fitsLineBudget('A'.repeat(15))).toBe(false);
  });
});

describe('phrases', () => {
  const setNames: Array<keyof PhraseSet> = ['identity', 'punchy', 'footer'];

  it.each(setNames)('every line in phrases.%s fits the hero line budget', (setName) => {
    for (const [line1, line2] of phrases[setName]) {
      expect(fitsLineBudget(line1)).toBe(true);
      expect(fitsLineBudget(line2)).toBe(true);
    }
  });

  it.each(setNames)('every phrase in phrases.%s is exactly 2 non-empty string lines', (setName) => {
    for (const phrase of phrases[setName]) {
      expect(phrase.length).toBe(2);
      for (const line of phrase) {
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it('phrases.identity deep-equals the verbatim SPEC §10 identity set', () => {
    expect(phrases.identity).toEqual([
      ['FULL-STACK', '+AI'],
      ['I SHIP', 'PRODUCTS'],
      ['IDEAS →', 'SHIPPED'],
      ['FEED', 'BYTE'],
      ['LAWRENCE', 'CRASTO'],
    ]);
  });

  it('phrases.punchy deep-equals the verbatim SPEC §10 punchy set', () => {
    expect(phrases.punchy).toEqual([
      ['MAKE IT', 'MOVE'],
      ['MAKE IT', 'REAL'],
      ['MAKE IT', 'SHIP'],
      ['BUILT BY', 'LAWRENCE'],
    ]);
  });

  it('phrases.footer deep-equals the verbatim SPEC §10 footer set', () => {
    expect(phrases.footer).toEqual([
      ["LET'S", 'BUILD'],
      ['SAY', 'HELLO'],
      ['WORK', 'TOGETHER'],
    ]);
  });
});
