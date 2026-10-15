import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, GameState, newGame, reduce } from '../src/core/game';
import { PhraseItem, RoundSpec, wheelFor } from '../src/core/rounds';
import { layoutCrossword } from '../src/core/crossword';

const P = (text: string, tema = 't'): PhraseItem => ({ text, tema });
const spinTo = (s: GameState, idx: number) =>
  reduce(reduce(s, { type: 'SPIN', angle: -(idx * 15 + 7) - 1440 }), { type: 'SPIN_DONE' });
const idxOf = (s: GameState, f: (x: GameState['wheel'][number]) => boolean) => s.wheel.findIndex(f);
const give = (s: GameState, i: number, patch: object): GameState => ({ ...s, players: s.players.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
const game = (types: RoundSpec['type'][], phrases: PhraseItem[], counts: number[] = []) => {
  let first = 0;
  const rounds = types.map((type, i): RoundSpec => { const count = counts[i] ?? 1; const r = { type, first, count }; first += count; return r; });
  return newGame(['A', 'B', 'C'], phrases, { ...DEFAULT_CONFIG }, rounds);
};

describe('wheel layouts', () => {
  it('express has 3 express segments, jackpot one jackpot, all have jolly and premio', () => {
    expect(wheelFor('express').filter((s) => s.kind === 'express')).toHaveLength(3);
    expect(wheelFor('classica').filter((s) => s.kind === 'express')).toHaveLength(0);
    expect(wheelFor('jackpot').filter((s) => s.kind === 'value' && s.token === 'jackpot')).toHaveLength(1);
    for (const t of ['classica', 'express'] as const) {
      expect(wheelFor(t)).toHaveLength(24);
      expect(wheelFor(t).some((s) => s.kind === 'value' && s.token === 'jolly')).toBe(true);
      expect(wheelFor(t).some((s) => s.kind === 'value' && s.token === 'premio')).toBe(true);
    }
  });
});

describe('jolly and premio', () => {
  it('conquering a jolly: on bankruptcy the player chooses to use it', () => {
    let s = game(['classica'], [P('CASA DOLCE CASA')]);
    s = spinTo(s, idxOf(s, (x) => x.kind === 'value' && x.token === 'jolly'));
    s = reduce(s, { type: 'CALL', letter: 'C' });
    expect(s.players[0].jolly).toBe(true);
    s = give(s, 0, { round: 900, total: 1000 });
    s = spinTo(s, idxOf(s, (x) => x.kind === 'bankrupt'));
    expect(s.phase).toBe('jolly');
    expect(reduce(s, { type: 'SPIN', angle: 0 })).toBe(s);
    s = reduce(s, { type: 'JOLLY', use: true });
    expect(s.players[0]).toMatchObject({ jolly: false, round: 900, total: 1000 });
    expect(s.current).toBe(0);
    expect(s.phase).toBe('turn');
    s = spinTo(s, idxOf(s, (x) => x.kind === 'bankrupt'));
    expect(s.players[0]).toMatchObject({ round: 0, total: 0 });
    expect(s.current).toBe(1);
  });
  it('declining the jolly on bankruptcy keeps it but applies the bankruptcy', () => {
    let s = give(game(['classica'], [P('CASA')]), 0, { jolly: true, round: 900, total: 1000 });
    s = reduce(spinTo(s, idxOf(s, (x) => x.kind === 'bankrupt')), { type: 'JOLLY', use: false });
    expect(s.players[0]).toMatchObject({ jolly: true, round: 0, total: 0 });
    expect(s.current).toBe(1);
  });
  it('jolly is offered on a wrong or repeated letter, not on Passa, wrong solution, timeout or after round 3', () => {
    let s = give(game(['classica'], [P('CASA')]), 0, { jolly: true });
    s = reduce(spinTo(s, 0), { type: 'CALL', letter: 'Z' });
    expect(s.phase).toBe('jolly');
    s = reduce(s, { type: 'JOLLY', use: true });
    expect(s.current).toBe(0);
    expect(s.players[0].jolly).toBe(false);
    s = give(s, 0, { jolly: true });
    s = reduce(spinTo(s, 0), { type: 'CALL', letter: 'Z' }); // repeated
    expect(s.phase).toBe('jolly');
    s = reduce(s, { type: 'TIMEOUT' }); // no answer: keeps the jolly, loses the turn
    expect(s.current).toBe(1);
    expect(s.players[0].jolly).toBe(true);
    const j = give(game(['classica'], [P('CASA')]), 0, { jolly: true });
    expect(reduce(j, { type: 'SOLVE', text: 'sbagliato' }).current).toBe(1);
    expect(reduce(j, { type: 'TIMEOUT' }).current).toBe(1);
    expect(spinTo(j, idxOf(j, (x) => x.kind === 'pass')).current).toBe(1);
    const late = give({ ...game(['classica', 'classica', 'classica', 'classica'], [P('A'), P('B'), P('C'), P('CASA')]), round: 3, board: 3 }, 0, { jolly: true });
    expect(reduce(spinTo(late, 0), { type: 'CALL', letter: 'Z' }).current).toBe(1);
  });
  it('premio gives a bonus only to the round winner and is lost on bankruptcy', () => {
    let s = game(['classica'], [P('CASA')]);
    s = spinTo(s, idxOf(s, (x) => x.kind === 'value' && x.token === 'premio'));
    s = reduce(s, { type: 'CALL', letter: 'C' });
    expect(s.players[0].premio).toBe(true);
    const won = reduce(s, { type: 'SOLVE', text: 'casa' });
    expect(won.players[0].total).toBe(300 + 2000);
    const lost = spinTo(s, idxOf(s, (x) => x.kind === 'bankrupt'));
    expect(lost.players[0].premio).toBe(false);
  });
});

describe('express', () => {
  const toOffer = () => {
    let s = game(['express', 'classica'], [P('CASA DOLCE CASA'), P('X')]);
    s = spinTo(s, idxOf(s, (x) => x.kind === 'express'));
    return reduce(s, { type: 'CALL', letter: 'C' });
  };
  it('offers Express after a correct consonant on a fuchsia segment', () => {
    const s = toOffer();
    expect(s.phase).toBe('expressOffer');
    expect(s.players[0].round).toBe(3 * 500);
  });
  it('declining keeps the normal game', () => {
    const s = reduce(toOffer(), { type: 'EXPRESS', go: false });
    expect(s.phase).toBe('turn');
    expect(s.express).toBe(false);
  });
  it('in Express each consonant is worth 1000 without spinning; vowels are bought; an error loses the round money', () => {
    let s = reduce(toOffer(), { type: 'EXPRESS', go: true });
    expect(s.express).toBe(true);
    expect(reduce(s, { type: 'SPIN', angle: 100 })).toBe(s);
    s = reduce(s, { type: 'CALL', letter: 'D' });
    expect(s.players[0].round).toBe(1500 + 1000);
    expect(s.phase).toBe('turn');
    s = reduce(s, { type: 'BUY_VOWEL', letter: 'A' });
    expect(s.players[0].round).toBe(2500 - 500 );
    s = reduce(s, { type: 'CALL', letter: 'Z' });
    expect(s.players[0].round).toBe(0);
    expect(s.current).toBe(1);
    expect(s.express).toBe(false);
  });
  it('solving in Express banks the money', () => {
    let s = reduce(toOffer(), { type: 'EXPRESS', go: true });
    s = reduce(s, { type: 'SOLVE', text: 'casa dolce casa' });
    expect(s.players[0].total).toBe(1500);
    expect(s.phase).toBe('roundEnd');
  });
});

describe('triplete', () => {
  it('plays three boards in a round, each solver banks their money', () => {
    let s = game(['triplete', 'classica'], [P('UNO'), P('DUE'), P('TRE'), P('FINE')], [3, 1]);
    s = give(s, 0, { round: 400 });
    s = give(s, 1, { round: 700 });
    s = reduce(s, { type: 'SOLVE', text: 'uno' });
    expect(s.phase).toBe('turn');
    expect(s.board).toBe(1);
    expect(s.called).toEqual([]);
    expect(s.players[0]).toMatchObject({ total: 400, round: 0 });
    expect(s.players[1].round).toBe(700); // kept for the next boards
    expect(s.current).toBe(1);
    s = reduce(s, { type: 'SOLVE', text: 'due' });
    expect(s.players[1].total).toBe(700);
    s = reduce(s, { type: 'SOLVE', text: 'xxx' }); // C is next, wrong
    expect(s.board).toBe(2);
    s = reduce(s, { type: 'SOLVE', text: 'tre' });
    expect(s.phase).toBe('roundEnd');
    s = reduce(s, { type: 'NEXT_ROUND' });
    expect(s.board).toBe(3);
    expect(s.players.every((p) => p.round === 0)).toBe(true);
  });
});

describe('jackpot', () => {
  it('pot collects earnings; the holder who solves takes it', () => {
    let s = game(['jackpot'], [P('CASA DOLCE CASA')]);
    s = spinTo(s, 0); // 300
    s = reduce(s, { type: 'CALL', letter: 'D' });
    expect(s.jackpotPot).toBe(300);
    s = reduce({ ...s, current: 1 }, { type: 'SPIN', angle: -(idxOf(s, (x) => x.kind === 'value' && x.token === 'jackpot') * 15 + 7) - 1440 });
    s = reduce(s, { type: 'SPIN_DONE' });
    s = reduce(s, { type: 'CALL', letter: 'C' });
    expect(s.players[1].jackpot).toBe(true);
    expect(s.jackpotPot).toBe(300 + 3 * 500);
    const pot = s.jackpotPot;
    const won = reduce(s, { type: 'SOLVE', text: 'casa dolce casa' });
    expect(won.players[1].total).toBe(1500 + pot);
  });
  it('another player solving does not get the jackpot', () => {
    let s = game(['jackpot'], [P('CASA')]);
    s = { ...s, jackpotPot: 5000, current: 0 };
    s = give(s, 1, { jackpot: true });
    const won = reduce(s, { type: 'SOLVE', text: 'casa' });
    expect(won.players[0].total).toBe(0);
    expect(won.players[1].total).toBe(0);
  });
});

describe('cruciruota', () => {
  it('counts crossing cells once and wants all the words', () => {
    const cw = layoutCrossword(['MUCCA', 'CAVALLO', 'GALLINA'])!;
    const item: PhraseItem = { text: cw.words.join(' '), tema: 'x', grid: cw, words: cw.words };
    let s = game(['cruciruota'], [item]);
    s = spinTo(s, 0);
    const letters = cw.cells.filter((c) => c.ch === 'C').length;
    s = reduce(s, { type: 'CALL', letter: 'C' });
    expect(s.players[0].round).toBe(300 * letters);
    expect(reduce(s, { type: 'SOLVE', text: cw.words.slice(1).join(' ') }).phase).toBe('turn');
    expect(reduce(s, { type: 'SOLVE', text: [...cw.words].reverse().join(', ') }).phase).toBe('gameEnd');
  });
});

describe('ultimo round', () => {
  const g = () => game(['ultimo'], [P('PIZZA'), P('PASTA')], [2]);
  it('starts in ultimo phase with no wheel and reveals letters', () => {
    let s = g();
    expect(s.phase).toBe('ultimo');
    expect(reduce(s, { type: 'SPIN', angle: 50 })).toBe(s);
    s = reduce(s, { type: 'REVEAL', letter: 'Z' });
    expect(s.called).toEqual(['Z']);
    expect(reduce(s, { type: 'REVEAL', letter: 'Q' })).toBe(s); // not in the phrase
  });
  it('anyone can book; wrong answers exclude, right answers give 1000 and advance', () => {
    let s = g();
    s = reduce(s, { type: 'BOOK', player: 2 });
    expect(s.phase).toBe('booked');
    s = reduce(s, { type: 'SOLVE', text: 'pasta' });
    expect(s.phase).toBe('ultimo');
    expect(s.excluded).toEqual([2]);
    expect(reduce(s, { type: 'BOOK', player: 2 })).toBe(s);
    s = reduce(s, { type: 'BOOK', player: 0 });
    s = reduce(s, { type: 'SOLVE', text: 'pizza' });
    expect(s.players[0].total).toBe(1000);
    expect(s.board).toBe(1);
    expect(s.phase).toBe('ultimo');
    expect(s.excluded).toEqual([]);
    s = reduce(s, { type: 'BOOK', player: 1 });
    s = reduce(s, { type: 'TIMEOUT' });
    expect(s.excluded).toEqual([1]);
    s = reduce(s, { type: 'BOOK', player: 1 === 1 ? 0 : 1 });
    s = reduce(s, { type: 'SOLVE', text: 'pasta' });
    expect(s.phase).toBe('gameEnd');
    expect(s.players[0].total).toBe(2000);
  });
  it('a fully revealed board with no solver ends the board', () => {
    let s = g();
    for (const l of 'PIZA') s = reduce(s, { type: 'REVEAL', letter: l });
    expect(s.board).toBe(1);
    expect(s.players.every((p) => p.total === 0)).toBe(true);
  });
});

describe('next round override', () => {
  it('the conductor can pick the next round type', () => {
    let s = game(['classica', 'classica'], [P('CASA'), P('PIZZA')]);
    s = reduce(s, { type: 'SOLVE', text: 'casa' });
    s = reduce(s, { type: 'NEXT_ROUND', round: { type: 'express', phrases: [P('NUOVA FRASE')] } });
    expect(s.rounds[1].type).toBe('express');
    expect(s.phrases[s.board].text).toBe('NUOVA FRASE');
    expect(s.wheel.filter((x) => x.kind === 'express')).toHaveLength(3);
  });
});

import { ENVELOPE_VALUES } from '../src/core/finale';
import { leaders } from '../src/core/game';

describe('finale integration', () => {
  const setup = { phrases: [P('CASA DOLCE CASA'), P('CHI VA PIANO'), P('UN GATTO')], values: [...ENVELOPE_VALUES] };
  const g = () => newGame(['A', 'B', 'C'], [P('CASA')], { ...DEFAULT_CONFIG, finale: true }, undefined, setup);

  it('after the last round the highest total plays the final game', () => {
    let s = give(g(), 1, { total: 3000 });
    s = reduce(s, { type: 'SOLVE', text: 'casa' }); // A wins the round with 0 points
    expect(s.phase).toBe('roundEnd');
    expect(s.toFinale).toBe(true);
    s = reduce(s, { type: 'NEXT_ROUND', round: { type: 'ultimo', phrases: [P('TIE')] } });
    expect(s.phase).toBe('finale');
    expect(s.finale!.champion).toBe(1);
    expect(s.wheel).toHaveLength(24);
  });

  it('a tie at the top is settled with a lightning phrase among the tied players', () => {
    let s = give(give(g(), 0, { total: 500 }), 1, { total: 500 });
    s = reduce(give(s, 0, { round: 0 }), { type: 'SOLVE', text: 'casa' });
    s = reduce(s, { type: 'NEXT_ROUND', round: { type: 'ultimo', phrases: [P('LAMPO')] } });
    expect(s.phase).toBe('ultimo');
    expect(s.excluded).toEqual([2]);
    expect(reduce(s, { type: 'BOOK', player: 2 })).toBe(s);
    s = reduce(s, { type: 'BOOK', player: 1 });
    s = reduce(s, { type: 'SOLVE', text: 'lampo' });
    expect(s.toFinale).toBe(true);
    expect(leaders(s)).toEqual([1]);
    s = reduce(s, { type: 'NEXT_ROUND', round: { type: 'ultimo', phrases: [P('X')] } });
    expect(s.phase).toBe('finale');
    expect(s.finale!.champion).toBe(1);
  });

  it('full finale: solve a board, choose the envelope, prize goes to the champion', () => {
    let s = reduce(give(g(), 0, { total: 100 }), { type: 'SOLVE', text: 'casa' });
    s = reduce(s, { type: 'NEXT_ROUND' });
    expect(s.finale!.champion).toBe(0);
    s = reduce(s, { type: 'F_SPIN', angle: -(3 * 15 + 7) - 1440, picks: [7, 9] });
    s = reduce(s, { type: 'F_SPIN_DONE' });
    s = reduce(s, { type: 'F_START' });
    s = reduce(s, { type: 'FORCE_SOLVE' });
    s = reduce(s, { type: 'F_TICK', ms: 60000 });
    expect(s.finale!.stage).toBe('choose');
    s = reduce(s, { type: 'F_CHOOSE', i: 0 });
    const prize = s.finale!.prize;
    expect(prize).toBe(setup.values[3]);
    s = reduce(s, { type: 'F_END' });
    expect(s.phase).toBe('gameEnd');
    expect(s.players[0].total).toBe(100 + prize);
  });

  it('finale can be disabled', () => {
    const s = reduce(newGame(['A', 'B'], [P('CASA')], { ...DEFAULT_CONFIG, finale: false }, undefined, setup), { type: 'SOLVE', text: 'casa' });
    expect(s.phase).toBe('gameEnd');
  });
});
