// La Ruota delle Meraviglie: the final game. Pure state machine embedded in GameState.finale.

import { boardRows } from './board';
import { baseLetter, checkSolution, isLetter, isVowel } from './phrase';
import type { PhraseItem } from './rounds';
import { Segment, segmentAt } from './wheel';

export const FINALE_TIME_MS = 60_000;
export const PENALTY_MS = 3_000;
export const PRE_REVEALED = 'RSTLNE';
export const ENVELOPE_COUNT = 24;
/** Prize values (points); shuffled before each game. */
export const ENVELOPE_VALUES = [
  100, 100, 100, 200, 200, 300, 300, 500, 500, 1000, 1000, 2000,
  2000, 3000, 5000, 5000, 10000, 10000, 20000, 30000, 50000, 75000, 100000, 200000,
];

export type FinaleStage = 'wheel' | 'spinning' | 'drawn' | 'board' | 'choose' | 'reveal';
export type BoardKind = 'classico' | 'testacoda' | 'rubasecondi';
export const BOARD_KINDS: BoardKind[] = ['classico', 'testacoda', 'rubasecondi'];
export const BOARD_TITLES: Record<BoardKind, string> = { classico: 'Tabellone 1', testacoda: 'Testacoda', rubasecondi: 'Rubasecondi' };
export const BOARD_RULES: Record<BoardKind, string> = {
  classico: 'Lettere già scoperte: scegli 3 consonanti e 1 vocale, poi risolvi!',
  testacoda: 'Solo prima e ultima lettera di ogni parola: 5 consonanti e 2 vocali.',
  rubasecondi: 'Chiama quante consonanti vuoi e una vocale: ogni lettera sbagliata toglie 3 secondi!',
};

export interface FinaleSetup { phrases: PhraseItem[]; values: number[] }

export interface FinaleState {
  champion: number;
  stage: FinaleStage;
  phrases: PhraseItem[];
  /** All 24 envelope values (hidden from players). */
  values: number[];
  /** Envelope numbers (0-23) drawn for the three boards. */
  envelopes: number[];
  wheelAngle: number;
  landed: number | null;
  boardIdx: number;
  kinds: BoardKind[];
  called: string[];
  /** Flat tile indexes shown from the start (Testacoda). */
  forced: number[];
  consonantsLeft: number;
  vowelsLeft: number;
  timeLeft: number;
  won: boolean[];
  chosen: number | null;
  prize: number;
  message: string;
  kids: boolean;
}

export type FinaleAction =
  | { type: 'F_SPIN'; angle: number; picks: [number, number] }
  | { type: 'F_SPIN_DONE' }
  | { type: 'F_START' }
  | { type: 'F_CALL'; letter: string }
  | { type: 'F_SOLVE'; text: string }
  | { type: 'F_TICK'; ms: number }
  | { type: 'F_CHOOSE'; i: number }
  | { type: 'F_FORCE_SOLVE' };

/** Wheel with the 24 numbered envelopes (the values are not shown). */
export function envelopeWheel(): Segment[] {
  return Array.from({ length: ENVELOPE_COUNT }, (_, i): Segment => ({ kind: 'value', value: i + 1 }));
}

/** Flat tile indexes of the first and last letter of every word. */
export function headTailCells(p: PhraseItem): number[] {
  const out: number[] = [];
  boardRows(p).forEach((row, r) => {
    const cols = row.length;
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const letter = c < cols && isLetter(row[c]);
      if (letter && start < 0) start = c;
      if (!letter && start >= 0) {
        out.push(r * cols + start, r * cols + c - 1);
        start = -1;
      }
    }
  });
  return [...new Set(out)];
}

export function newFinale(champion: number, setup: FinaleSetup, kids = false): FinaleState {
  const kinds: BoardKind[] = kids ? ['classico'] : BOARD_KINDS;
  const f: FinaleState = {
    champion, stage: 'wheel', phrases: setup.phrases.slice(0, kinds.length), values: setup.values, envelopes: [],
    wheelAngle: 0, landed: null, boardIdx: 0, kinds, called: [], forced: [], consonantsLeft: 0, vowelsLeft: 0,
    timeLeft: kids ? FINALE_TIME_MS * 2 : FINALE_TIME_MS, won: kinds.map(() => false), chosen: null, prize: 0, message: '', kids,
  };
  return f;
}

export const finalePhrase = (f: FinaleState): PhraseItem => f.phrases[f.boardIdx];
export const finaleKind = (f: FinaleState): BoardKind => f.kinds[f.boardIdx];

function startBoard(f: FinaleState, idx: number): FinaleState {
  const kind = f.kinds[idx];
  const p = f.phrases[idx];
  return {
    ...f, stage: 'board', boardIdx: idx,
    called: kind === 'classico' ? [...PRE_REVEALED] : [],
    forced: kind === 'testacoda' ? headTailCells(p) : [],
    consonantsLeft: kind === 'classico' ? 3 : kind === 'testacoda' ? 5 : 99,
    vowelsLeft: kind === 'testacoda' ? 2 : 1,
    message: BOARD_RULES[kind],
  };
}

function endBoards(f: FinaleState, message: string): FinaleState {
  if (f.won.some(Boolean)) return { ...f, stage: 'choose', message };
  return { ...f, stage: 'reveal', chosen: null, prize: 0, message: `${message} Nessuna busta conquistata.` };
}

export function finaleReduce(f: FinaleState, a: FinaleAction): FinaleState {
  switch (a.type) {
    case 'F_SPIN': {
      if (f.stage !== 'wheel') return f;
      const first = segmentAt(a.angle);
      const [b, c] = a.picks;
      if (new Set([first, b, c]).size !== 3 || [b, c].some((x) => x < 0 || x >= ENVELOPE_COUNT)) return f;
      return { ...f, stage: 'spinning', wheelAngle: a.angle, landed: first, envelopes: [first, b, c].slice(0, f.kinds.length), message: '' };
    }
    case 'F_SPIN_DONE':
      if (f.stage !== 'spinning') return f;
      return { ...f, stage: 'drawn', message: f.kinds.length === 1 ? `Busta n° ${f.envelopes[0] + 1}` : `Buste n° ${f.envelopes.map((e) => e + 1).join(', ')}` };
    case 'F_START':
      return f.stage === 'drawn' ? startBoard(f, 0) : f;
    case 'F_CALL': {
      if (f.stage !== 'board') return f;
      const L = baseLetter(a.letter);
      if (!/^[A-Z]$/.test(L) || f.called.includes(L)) return f;
      const vowel = isVowel(L);
      if ((vowel ? f.vowelsLeft : f.consonantsLeft) <= 0) return f;
      const present = finalePhrase(f).text.split('').some((ch) => baseLetter(ch) === L);
      const kind = finaleKind(f);
      const next: FinaleState = {
        ...f, called: [...f.called, L],
        consonantsLeft: vowel ? f.consonantsLeft : f.consonantsLeft - 1,
        vowelsLeft: vowel ? f.vowelsLeft - 1 : f.vowelsLeft,
        message: present ? `C'è la ${L}!` : `Nessuna ${L}`,
      };
      if (!present && kind === 'rubasecondi') {
        const timeLeft = Math.max(0, f.timeLeft - PENALTY_MS);
        return timeLeft === 0 ? endBoards({ ...next, timeLeft }, 'Tempo scaduto!') : { ...next, timeLeft, message: `Nessuna ${L}: −3 secondi!` };
      }
      return next;
    }
    case 'F_SOLVE':
    case 'F_FORCE_SOLVE': {
      if (f.stage !== 'board') return f;
      const p = finalePhrase(f);
      if (a.type === 'F_SOLVE' && !checkSolution(a.text, p.text, f.kids ? 2 : 1)) return { ...f, message: 'Non è questa!' };
      const won = f.won.map((w, i) => (i === f.boardIdx ? true : w));
      const all = new Set(p.text.split('').filter(isLetter).map(baseLetter));
      const done: FinaleState = { ...f, won, called: [...all], message: 'Esatto!' };
      return f.boardIdx + 1 < f.kinds.length ? startBoard({ ...done, message: 'Esatto! Si passa al prossimo tabellone' }, f.boardIdx + 1) : endBoards(done, 'Esatto!');
    }
    case 'F_TICK': {
      if (f.stage !== 'board') return f;
      const timeLeft = Math.max(0, f.timeLeft - a.ms);
      return timeLeft === 0 ? endBoards({ ...f, timeLeft }, 'Tempo scaduto!') : { ...f, timeLeft };
    }
    case 'F_CHOOSE': {
      if (f.stage !== 'choose' || !f.won[a.i]) return f;
      return { ...f, stage: 'reveal', chosen: a.i, prize: f.values[f.envelopes[a.i]], message: '' };
    }
  }
}
