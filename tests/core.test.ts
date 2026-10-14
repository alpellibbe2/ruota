import { describe, expect, it } from 'vitest';
import { checkSolution, countLetter, layoutBoard, normalizeText } from '../src/core/phrase';
import { segmentAt, DEFAULT_WHEEL, SEGMENT_COUNT } from '../src/core/wheel';
import { newGame, reduce, GameState, DEFAULT_CONFIG, canBuyVowel, ranking } from '../src/core/game';

describe('phrase', () => {
  it('normalizes accents, punctuation, spaces', () => {
    expect(normalizeText("  Perché, l'amore!  è   bello ")).toBe('PERCHE L AMORE E BELLO');
  });
  it('accented letters count with base letter', () => {
    expect(countLetter('CITTÀ è', 'A')).toBe(1);
    expect(countLetter('è', 'E')).toBe(1);
  });
  it('checks solutions with one typo on long phrases only', () => {
    expect(checkSolution('chi va piano va sano', 'Chi va piano, va sano!')).toBe(true);
    expect(checkSolution('chi va piano va sanu', 'Chi va piano va sano')).toBe(true);
    expect(checkSolution('gatto', 'gatta')).toBe(false);
    expect(checkSolution('chi va pianu va sanu', 'Chi va piano va sano')).toBe(false);
    expect(checkSolution('', 'x')).toBe(false);
  });
  it('lays out on whole words and rejects overflow', () => {
    const rows = layoutBoard('CHI VA PIANO VA SANO E VA LONTANO')!;
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.length === 14)).toBe(true);
    expect(rows.map((r) => r.trim()).filter(Boolean)).toEqual(['CHI VA PIANO', 'VA SANO E VA', 'LONTANO']);
    expect(layoutBoard('PAROLALUNGHISSIMAXX')).toBeNull();
    expect(layoutBoard('A B C D E F G H I J K L M N O P Q R S T U V W X Y Z A B C D E F G H I J K')).toBeNull();
  });
});

describe('wheel', () => {
  it('has 24 segments and maps angles to the pointer', () => {
    expect(DEFAULT_WHEEL).toHaveLength(SEGMENT_COUNT);
    expect(segmentAt(0)).toBe(0);
    expect(segmentAt(-1)).toBe(0);
    expect(segmentAt(15)).toBe(23); // rotating clockwise brings the previous segment up
    expect(segmentAt(360 * 5 + 7)).toBe(23);
  });
});

const phrases = [
  { text: 'CASA DOLCE CASA', tema: 'Modo di dire' },
  { text: 'PIZZA', tema: 'Cibo' },
];
const valueAngle = (s: GameState, kind: string) => {
  const idx = s.wheel.findIndex((x) => x.kind === kind);
  return -(idx * 15 + 7);
};
const spinTo = (s: GameState, idx: number) => {
  const s2 = reduce(s, { type: 'SPIN', angle: -(idx * 15 + 7) - 360 * 4 });
  return reduce(s2, { type: 'SPIN_DONE' });
};

describe('game', () => {
  const start = () => newGame(['A', 'B', 'C'], phrases, { ...DEFAULT_CONFIG });

  it('validates player count', () => {
    expect(() => newGame(['A'], phrases)).toThrow();
    expect(() => newGame(Array(7).fill('x'), phrases)).toThrow();
  });

  it('scores a correct consonant as value x occurrences', () => {
    let s = spinTo(start(), 0); // 300
    expect(s.phase).toBe('consonant');
    s = reduce(s, { type: 'CALL', letter: 'C' });
    expect(s.players[0].round).toBe(900);
    expect(s.phase).toBe('turn');
    expect(s.current).toBe(0);
  });

  it('passes the turn on a missing or repeated consonant', () => {
    let s = spinTo(start(), 0);
    s = reduce(s, { type: 'CALL', letter: 'Z' });
    expect(s.current).toBe(1);
    s = spinTo(s, 0);
    const again = reduce(s, { type: 'CALL', letter: 'Z' }); // already called: ignored
    expect(again).toBe(s);
  });

  it('handles pass and bankruptcy', () => {
    let s = start();
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, round: 900, total: 2000 } : p)) };
    const bk = spinTo(s, 2);
    expect(bk.players[0]).toMatchObject({ round: 0, total: 0 });
    expect(bk.current).toBe(1);
    const soft = spinTo({ ...s, config: { ...s.config, bankruptAll: false } }, 2);
    expect(soft.players[0]).toMatchObject({ round: 0, total: 2000 });
    expect(spinTo(s, 6).current).toBe(1);
  });

  it('buys vowels only with enough money', () => {
    let s = start();
    expect(canBuyVowel(s)).toBe(false);
    expect(reduce(s, { type: 'BUY_VOWEL', letter: 'A' })).toBe(s);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, round: 700 } : p)) };
    s = reduce(s, { type: 'BUY_VOWEL', letter: 'A' });
    expect(s.players[0].round).toBe(200);
    expect(s.current).toBe(0);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, round: 700 } : p)) };
    s = reduce(s, { type: 'BUY_VOWEL', letter: 'U' });
    expect(s.players[0].round).toBe(200);
    expect(s.current).toBe(1);
  });

  it('solving: wrong passes turn, right banks the round and moves on', () => {
    let s = start();
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, round: 800 } : p)) };
    s = reduce(s, { type: 'SOLVE', text: 'boh' });
    expect(s.current).toBe(1);
    s = { ...s, current: 0 };
    s = reduce(s, { type: 'SOLVE', text: 'casa dolce casa' });
    expect(s.phase).toBe('roundEnd');
    expect(s.players[0]).toMatchObject({ total: 800, round: 0 });
    s = reduce(s, { type: 'NEXT_ROUND' });
    expect(s.round).toBe(1);
    expect(s.current).toBe(1);
    expect(s.called).toEqual([]);
  });

  it('ends the game after the last phrase and ranks players', () => {
    let s = start();
    s = reduce(s, { type: 'NEXT_ROUND' }); // ignored outside roundEnd
    expect(s.round).toBe(0);
    s = { ...s, round: 1, board: 1, players: s.players.map((p, i) => (i === 2 ? { ...p, total: 50 } : p)) };
    s = reduce(s, { type: 'SOLVE', text: 'pizza' });
    expect(s.phase).toBe('gameEnd');
    expect(ranking(s)[0].name).toBe('C');
  });

  it('auto-wins when the last hidden letter is revealed', () => {
    let s = newGame(['A', 'B'], [{ text: 'OK', tema: 't' }, ...phrases]);
    s = { ...s, called: ['K'], players: s.players.map((p, i) => (i === 0 ? { ...p, round: 600 } : p)) };
    s = reduce(s, { type: 'BUY_VOWEL', letter: 'O' });
    expect(s.phase).toBe('roundEnd');
  });

  it('timeout passes the turn', () => {
    expect(reduce(start(), { type: 'TIMEOUT' }).current).toBe(1);
  });
});

import { loadBank } from '../src/core/frasi';
describe('phrase bank', () => {
  it('decodes and every phrase fits the board', () => {
    const bank = loadBank();
    expect(bank.length).toBeGreaterThan(20);
    for (const p of bank) {
      expect(p.text).toBe(p.text.toUpperCase());
      expect(layoutBoard(p.text), p.text).not.toBeNull();
    }
  });
});

describe('conductor interventions', () => {
  const start = () => newGame(['A', 'B', 'C'], phrases, { ...DEFAULT_CONFIG });
  it('force solve accepts a spoken answer', () => {
    let s = start();
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, round: 400 } : p)) };
    s = reduce(s, { type: 'FORCE_SOLVE' });
    expect(s.phase).toBe('roundEnd');
    expect(s.players[0].total).toBe(400);
  });
  it('force pass, adjust and skip', () => {
    let s = start();
    s = reduce(s, { type: 'FORCE_PASS' });
    expect(s.current).toBe(1);
    s = reduce(s, { type: 'ADJUST', player: 2, delta: 300 });
    expect(s.players[2].round).toBe(300);
    s = reduce(s, { type: 'ADJUST', player: 2, delta: -1000 });
    expect(s.players[2].round).toBe(0);
    s = { ...s, called: ['C'] };
    s = reduce(s, { type: 'SKIP', phrase: { text: 'NUOVA FRASE', tema: 'x' } });
    expect(s.called).toEqual([]);
    expect(s.phrases[0].text).toBe('NUOVA FRASE');
    expect(s.phrases[1].text).toBe('PIZZA');
  });
});

import adultiRaw from '../src/data/frasi/adulti.json';
import bambiniRaw from '../src/data/frasi/bambini.json';
import { decodePhrase as dec } from '../src/core/frasi';
describe('full phrase banks', () => {
  it('has about 300 adult and 100 kids phrases that all fit the board, with unique ids', () => {
    expect(adultiRaw.length).toBeGreaterThanOrEqual(300);
    expect(bambiniRaw.length).toBeGreaterThanOrEqual(100);
    const ids = new Set<string>();
    for (const r of [...adultiRaw, ...bambiniRaw]) {
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
      const t = dec(r.t);
      expect(layoutBoard(t), t).not.toBeNull();
    }
    expect(bambiniRaw.every((r) => r.bambini)).toBe(true);
    const texts = adultiRaw.map((r) => dec(r.t));
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('kids tolerance', () => {
  it('accepts two typos on longer phrases in kids mode only', () => {
    expect(checkSolution('il gatto sul divanu', 'IL GATTO SUL DIVANO', 2)).toBe(true);
    expect(checkSolution('il gattu sul divanu', 'IL GATTO SUL DIVANO', 2)).toBe(true);
    expect(checkSolution('il gattu sul divanu', 'IL GATTO SUL DIVANO', true)).toBe(false);
    expect(checkSolution('il gattu sul divanu', 'IL GATTO SUL DIVANO', false)).toBe(false);
    expect(checkSolution('gatti', 'GATTO', 2)).toBe(true);
  });
});
