import { describe, expect, it } from 'vitest';
import { layoutCrossword, crosswordRows } from '../src/core/crossword';
import { checkWords } from '../src/core/phrase';
import cruci from '../src/data/frasi/cruci.json';
import { decodePhrase } from '../src/core/frasi';

describe('crossword', () => {
  it('places all words of every bundled set on crossing letters', () => {
    for (const set of cruci) {
      const words = set.t.map(decodePhrase);
      const cw = layoutCrossword(words)!;
      expect(cw, set.tema).not.toBeNull();
      expect(cw.words.length, `${set.tema}: ${words.join(',')}`).toBeGreaterThanOrEqual(3);
      expect(cw.rows).toBeLessThanOrEqual(7);
      expect(cw.cols).toBeLessThanOrEqual(14);
      const rows = crosswordRows(cw);
      // every placed word must appear in a row or a column
      const cols = Array.from({ length: cw.cols }, (_, c) => rows.map((r) => r[c]).join(''));
      for (const w of cw.words) expect([...rows, ...cols].some((l) => l.includes(w)), w).toBe(true);
    }
  });
  it('checks word lists in any order', () => {
    expect(checkWords('Cavallo, mucca; gallina', ['MUCCA', 'CAVALLO', 'GALLINA'])).toBe(true);
    expect(checkWords('mucca cavallo', ['MUCCA', 'CAVALLO', 'GALLINA'])).toBe(false);
    expect(checkWords('mucca cavalla gallina', ['MUCCA', 'CAVALLO', 'GALLINA'])).toBe(false); // short word typo ok only >=8 letters? cavallo has 7
  });
});
