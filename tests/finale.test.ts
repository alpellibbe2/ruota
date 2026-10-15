import { describe, expect, it } from 'vitest';
import { ENVELOPE_VALUES, FINALE_TIME_MS, FinaleState, finaleReduce, headTailCells, newFinale, PENALTY_MS } from '../src/core/finale';

const phrases = [{ text: 'CASA DOLCE CASA', tema: 'a' }, { text: 'CHI VA PIANO', tema: 'b' }, { text: 'UN GATTO', tema: 'c' }];
const setup = { phrases, values: [...ENVELOPE_VALUES] };
const angleFor = (i: number) => -(i * 15 + 7) - 1440;

/** Board 1 with letters chosen and the clock running. */
const go = (f: FinaleState, letters: string): FinaleState => {
  if (f.stage === 'board') return f; // Testacoda: no letters, already running
  for (const l of letters) f = finaleReduce(f, { type: 'F_CALL', letter: l });
  return finaleReduce(f, { type: 'F_GO' });
};
const LETTERS = ['BCDA', '', ''];
const toLetters = (): FinaleState => {
  let f = newFinale(0, setup);
  f = finaleReduce(f, { type: 'F_SPIN', angle: angleFor(5), picks: [10, 23] });
  f = finaleReduce(f, { type: 'F_SPIN_DONE' });
  return finaleReduce(f, { type: 'F_START' });
};
const toBoard = (): FinaleState => go(toLetters(), LETTERS[0]);
/** «RISPONDI» then the answer. */
const answer = (f: FinaleState, text: string): FinaleState => finaleReduce(finaleReduce(f, { type: 'F_ANSWER' }), { type: 'F_SOLVE', text });
/** Finish the current board (solved), then get ready for and start the next. */
const nextBoard = (f: FinaleState): FinaleState => {
  f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
  return go(finaleReduce(f, { type: 'F_START' }), LETTERS[f.boardIdx + 1]);
};

describe('finale', () => {
  it('draws three distinct envelopes: the one the wheel stops on plus two more', () => {
    let f = newFinale(0, setup);
    expect(finaleReduce(f, { type: 'F_SPIN', angle: angleFor(5), picks: [5, 6] })).toBe(f); // duplicate rejected
    f = finaleReduce(f, { type: 'F_SPIN', angle: angleFor(5), picks: [10, 23] });
    expect(f.envelopes).toEqual([5, 10, 23]);
    f = finaleReduce(f, { type: 'F_SPIN_DONE' });
    expect(f.stage).toBe('drawn');
    expect(finaleReduce(f, { type: 'F_START' }).stage).toBe('letters');
  });

  it('letters are chosen with the clock stopped and revealed only at VIA', () => {
    let f = toLetters();
    expect(f.called).toEqual([...'RSTLNE']);
    expect(finaleReduce(f, { type: 'F_TICK', ms: 5000 })).toBe(f); // no clock while choosing
    for (const l of 'BCD') f = finaleReduce(f, { type: 'F_CALL', letter: l });
    expect(finaleReduce(f, { type: 'F_CALL', letter: 'F' })).toBe(f); // 3 consonants only
    expect(finaleReduce(f, { type: 'F_GO' })).toBe(f); // the vowel is missing
    f = finaleReduce(f, { type: 'F_CALL', letter: 'A' });
    expect(finaleReduce(f, { type: 'F_CALL', letter: 'O' })).toBe(f);
    expect(f.picked).toEqual([...'BCDA']);
    expect(f.called).not.toContain('C');
    f = finaleReduce(f, { type: 'F_GO' });
    expect(f.stage).toBe('board');
    expect(f.called).toContain('C');
    expect(f.timeLeft).toBe(FINALE_TIME_MS);
    f = finaleReduce(f, { type: 'F_TICK', ms: 5000 });
    expect(f.timeLeft).toBe(FINALE_TIME_MS - 5000);
  });

  it('RISPONDI stops the clock; a right answer pauses before Testacoda, which starts at once', () => {
    let f = toBoard();
    expect(finaleReduce(f, { type: 'F_SOLVE', text: 'casa dolce casa' })).toBe(f); // RISPONDI first
    f = finaleReduce(f, { type: 'F_TICK', ms: 10000 });
    f = finaleReduce(f, { type: 'F_ANSWER' });
    expect(f.stage).toBe('answer');
    expect(finaleReduce(f, { type: 'F_TICK', ms: 5000 })).toBe(f); // clock stopped while answering
    f = finaleReduce(f, { type: 'F_SOLVE', text: 'casa dolce casa' });
    expect(f.won).toEqual([true, false, false]);
    expect(f.stage).toBe('pause');
    expect(finaleReduce(f, { type: 'F_TICK', ms: 5000 })).toBe(f); // waiting for «PRONTO»
    f = finaleReduce(f, { type: 'F_START' });
    // Testacoda: no letters to choose, the clock runs as soon as the champion is ready
    expect(f.stage).toBe('board');
    expect(f.boardIdx).toBe(1);
    expect(f.kinds[1]).toBe('testacoda');
    expect(f.called).toEqual([]);
    expect(f.forced.length).toBeGreaterThan(0);
    expect(finaleReduce(f, { type: 'F_CALL', letter: 'B' })).toBe(f);
    expect(f.timeLeft).toBe(FINALE_TIME_MS - 10000); // the clock is shared
    expect(finaleReduce(f, { type: 'F_TICK', ms: 1000 }).timeLeft).toBe(FINALE_TIME_MS - 11000);
    expect(headTailCells({ text: 'CHI VA', tema: '' }).length).toBe(4);
  });

  it('a wrong answer loses the board: solution shown, time left kept', () => {
    let f = finaleReduce(toBoard(), { type: 'F_TICK', ms: 7000 });
    f = answer(f, 'boh');
    expect(f.stage).toBe('pause');
    expect(f.won).toEqual([false, false, false]);
    expect(f.called).toEqual(expect.arrayContaining([...'CASDOLE']));
    expect(f.timeLeft).toBe(FINALE_TIME_MS - 7000);
  });

  it('STOP: the board is not won, the solution is shown and the time left is kept', () => {
    let f = toBoard();
    f = finaleReduce(f, { type: 'F_TICK', ms: 12000 });
    f = finaleReduce(f, { type: 'F_STOP' });
    expect(f.stage).toBe('pause');
    expect(f.won).toEqual([false, false, false]);
    expect(f.called).toEqual(expect.arrayContaining([...'CASDOLE']));
    expect(f.timeLeft).toBe(FINALE_TIME_MS - 12000);
    f = finaleReduce(f, { type: 'F_START' });
    expect(f.boardIdx).toBe(1);
    expect(f.stage).toBe('board');
    // stopping the last board goes to the envelopes (here: none won)
    f = go(f, LETTERS[1]);
    f = finaleReduce(f, { type: 'F_STOP' });
    f = go(finaleReduce(f, { type: 'F_START' }), LETTERS[2]);
    f = finaleReduce(f, { type: 'F_STOP' });
    expect(f.stage).toBe('reveal');
    expect(f.prize).toBe(0);
  });

  it('Rubasecondi: clock from «PRONTO», letters show at once, a missing consonant costs 3 seconds, one vowel', () => {
    let f = nextBoard(toBoard());
    f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    f = finaleReduce(f, { type: 'F_START' });
    expect(f.boardIdx).toBe(2);
    expect(f.kinds[2]).toBe('rubasecondi');
    expect(f.stage).toBe('board');
    const t0 = f.timeLeft;
    f = finaleReduce(f, { type: 'F_CALL', letter: 'G' }); // present
    expect(f.called).toContain('G');
    expect(f.timeLeft).toBe(t0);
    f = finaleReduce(f, { type: 'F_CALL', letter: 'Z' }); // not in 'UN GATTO'
    expect(f.timeLeft).toBe(t0 - PENALTY_MS);
    for (const l of 'BCDF') f = finaleReduce(f, { type: 'F_CALL', letter: l });
    expect(f.timeLeft).toBe(t0 - 5 * PENALTY_MS);
    f = finaleReduce(f, { type: 'F_CALL', letter: 'A' });
    expect(f.vowelsLeft).toBe(0);
    expect(finaleReduce(f, { type: 'F_CALL', letter: 'U' })).toBe(f); // one vowel only
    f = answer(f, 'un gatto');
    expect(f.stage).toBe('choose');
  });

  it('time runs out: choose among won envelopes, or nothing', () => {
    let f = nextBoard(toBoard());
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
    let f = nextBoard(nextBoard(toBoard()));
    f = finaleReduce(f, { type: 'F_FORCE_SOLVE' });
    expect(f.stage).toBe('choose');
    expect(f.won).toEqual([true, true, true]);
  });

  it('kids finale: a single board and more time', () => {
    const f = newFinale(0, setup, true);
    expect(f.kinds).toEqual(['classico']);
    expect(f.timeLeft).toBe(FINALE_TIME_MS * 2);
  });
});
