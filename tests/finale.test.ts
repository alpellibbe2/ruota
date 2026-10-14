import { describe, expect, it } from 'vitest';
import { ENVELOPE_VALUES, FINALE_TIME_MS, FinaleState, finaleReduce, headTailCells, newFinale, PENALTY_MS } from '../src/core/finale';

const phrases = [{ text: 'CASA DOLCE CASA', tema: 'a' }, { text: 'CHI VA PIANO', tema: 'b' }, { text: 'UN GATTO', tema: 'c' }];
const setup = { phrases, values: [...ENVELOPE_VALUES] };
const angleFor = (i: number) => -(i * 15 + 7) - 1440;

const toBoard = (): FinaleState => {
  let f = newFinale(0, setup);
  f = finaleReduce(f, { type: 'F_SPIN', angle: angleFor(5), picks: [10, 23] });
  f = finaleReduce(f, { type: 'F_SPIN_DONE' });
  return finaleReduce(f, { type: 'F_START' });
};

describe('finale', () => {
  it('draws three distinct envelopes: the one the wheel stops on plus two more', () => {
    let f = newFinale(0, setup);
    expect(finaleReduce(f, { type: 'F_SPIN', angle: angleFor(5), picks: [5, 6] })).toBe(f); // duplicate rejected
    f = finaleReduce(f, { type: 'F_SPIN', angle: angleFor(5), picks: [10, 23] });
    expect(f.envelopes).toEqual([5, 10, 23]);
    f = finaleReduce(f, { type: 'F_SPIN_DONE' });
    expect(f.stage).toBe('drawn');
    expect(finaleReduce(f, { type: 'F_START' }).stage).toBe('board');
  });

  it('board 1 pre-reveals RSTLNE and limits calls to 3 consonants and 1 vowel', () => {
    let f = toBoard();
    expect(f.called).toEqual([...'RSTLNE']);
    expect(f.timeLeft).toBe(FINALE_TIME_MS);
    for (const l of 'BCD') f = finaleReduce(f, { type: 'F_CALL', letter: l });
    const blocked = finaleReduce(f, { type: 'F_CALL', letter: 'F' });
    expect(blocked).toBe(f);
    f = finaleReduce(f, { type: 'F_CALL', letter: 'A' });
    expect(finaleReduce(f, { type: 'F_CALL', letter: 'O' })).toBe(f);
  });

  it('a wrong solution costs nothing; a right one moves to Testacoda, which shows head and tail letters', () => {
    let f = toBoard();
    f = finaleReduce(f, { type: 'F_SOLVE', text: 'boh' });
    expect(f.stage).toBe('board');
    expect(f.won).toEqual([false, false, false]);
    f = finaleReduce(f, { type: 'F_SOLVE', text: 'casa dolce casa' });
    expect(f.won).toEqual([true, false, false]);
    expect(f.boardIdx).toBe(1);
    expect(f.kinds[1]).toBe('testacoda');
    expect(f.called).toEqual([]);
    expect(f.consonantsLeft).toBe(5);
    expect(f.timeLeft).toBe(FINALE_TIME_MS); // the clock is shared and keeps its value
    expect(headTailCells({ text: 'CHI VA', tema: '' }).length).toBe(4);
  });

  it('Rubasecondi: one vowel, any consonants, 3 seconds off per missing letter', () => {
    let f = toBoard();
    f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    expect(f.boardIdx).toBe(2);
    expect(f.kinds[2]).toBe('rubasecondi');
    f = finaleReduce(f, { type: 'F_CALL', letter: 'Z' }); // not in 'UN GATTO'
    expect(f.timeLeft).toBe(FINALE_TIME_MS - PENALTY_MS);
    f = finaleReduce(f, { type: 'F_CALL', letter: 'G' }); // present
    expect(f.timeLeft).toBe(FINALE_TIME_MS - PENALTY_MS);
    for (const l of 'BCDFHLMPQRSV') f = finaleReduce(f, { type: 'F_CALL', letter: l });
    expect(f.timeLeft).toBeLessThan(FINALE_TIME_MS - PENALTY_MS);
    f = toBoard();
    f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    f = finaleReduce(f, { type: 'F_CALL', letter: 'E' }); // vowel absent
    expect(f.vowelsLeft).toBe(0);
    expect(finaleReduce(f, { type: 'F_CALL', letter: 'I' })).toBe(f);
  });

  it('time runs out: choose among won envelopes, or nothing', () => {
    let f = toBoard();
    f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    f = finaleReduce(f, { type: 'F_TICK', ms: FINALE_TIME_MS });
    expect(f.stage).toBe('choose');
    expect(finaleReduce(f, { type: 'F_CHOOSE', i: 1 })).toBe(f); // not won
    const r = finaleReduce(f, { type: 'F_CHOOSE', i: 0 });
    expect(r.stage).toBe('reveal');
    expect(r.prize).toBe(f.values[f.envelopes[0]]);

    const lost = finaleReduce(toBoard(), { type: 'F_TICK', ms: FINALE_TIME_MS + 1 });
    expect(lost.stage).toBe('reveal');
    expect(lost.prize).toBe(0);
  });

  it('solving all three boards offers three envelopes', () => {
    let f = toBoard();
    for (let i = 0; i < 3; i++) f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    expect(f.stage).toBe('choose');
    expect(f.won).toEqual([true, true, true]);
  });

  it('kids finale: a single board and more time', () => {
    const f = newFinale(0, setup, true);
    expect(f.kinds).toEqual(['classico']);
    expect(f.timeLeft).toBe(FINALE_TIME_MS * 2);
  });
});
