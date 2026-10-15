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

/** 'letters': the champion picks letters with the clock stopped; 'board': the clock runs; 'answer': «RISPONDI»
 * pressed, the clock stops while the answer is given; 'pause': a board is over (solved or stopped, solution on show)
 * and the clock waits until the champion is ready for the next one. */
export type FinaleStage = 'wheel' | 'spinning' | 'drawn' | 'letters' | 'board' | 'answer' | 'pause' | 'choose' | 'reveal';
export type BoardKind = 'classico' | 'testacoda' | 'rubasecondi';
export const BOARD_KINDS: BoardKind[] = ['classico', 'testacoda', 'rubasecondi'];
export const BOARD_TITLES: Record<BoardKind, string> = { classico: 'Tabellone 1', testacoda: 'Testacoda', rubasecondi: 'Rubasecondi' };
export const BOARD_RULES: Record<BoardKind, string> = {
  classico: 'Lettere già scoperte: scegli 3 consonanti e 1 vocale, poi VIA!',
  testacoda: 'Solo prima e ultima lettera di ogni parola, niente lettere da scegliere: il tempo scorre!',
  rubasecondi: 'Il tempo scorre! Chiama quante consonanti vuoi (ognuna che non c\'è toglie 3 secondi) e una sola vocale.',
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
  /** Letters chosen for the current board, revealed only at «VIA». */
  picked: string[];
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
  | { type: 'F_GO' }
  | { type: 'F_ANSWER' }
  | { type: 'F_STOP' }
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
    wheelAngle: 0, landed: null, boardIdx: 0, kinds, called: [], picked: [], forced: [], consonantsLeft: 0, vowelsLeft: 0,
    timeLeft: kids ? FINALE_TIME_MS * 2 : FINALE_TIME_MS, won: kinds.map(() => false), chosen: null, prize: 0, message: '', kids,
  };
  return f;
}

export const finalePhrase = (f: FinaleState): PhraseItem => f.phrases[f.boardIdx];
export const finaleKind = (f: FinaleState): BoardKind => f.kinds[f.boardIdx];

function startBoard(f: FinaleState, idx: number): FinaleState {
  const kind = f.kinds[idx];
  const p = f.phrases[idx];
  // Only Tabellone 1 has letters chosen with the clock stopped. Testacoda (no letters) and Rubasecondi (letters
  // called while the clock runs) start the clock as soon as the champion is ready.
  return {
    ...f, stage: kind === 'classico' ? 'letters' : 'board', boardIdx: idx, picked: [],
    called: kind === 'classico' ? [...PRE_REVEALED] : [],
    forced: kind === 'testacoda' ? headTailCells(p) : [],
    consonantsLeft: kind === 'classico' ? 3 : kind === 'testacoda' ? 0 : 99,
    vowelsLeft: kind === 'testacoda' ? 0 : 1,
    message: BOARD_RULES[kind],
  };
}

/** Every letter of the current board, to show its solution. */
const allCalled = (f: FinaleState): string[] => [...new Set(finalePhrase(f).text.split('').filter(isLetter).map(baseLetter))];

/** «VIA» is allowed once the letters are chosen. */
export function canGo(f: FinaleState): boolean {
  return f.stage === 'letters' && f.consonantsLeft === 0 && f.vowelsLeft === 0;
}

/** Rubasecondi: letters are called while the clock runs. */
export const callsLive = (f: FinaleState): boolean => f.stage === 'board' && finaleKind(f) === 'rubasecondi';

/** A board is over (solved or stopped): next board after a pause, or the envelopes. */
function boardOver(f: FinaleState, message: string): FinaleState {
  const shown = { ...f, called: allCalled(f), picked: [] };
  if (f.boardIdx + 1 < f.kinds.length) return { ...shown, stage: 'pause', message: `${message} Premi PRONTO per il prossimo tabellone.` };
  return endBoards(shown, message);
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
      if (f.stage === 'drawn') return startBoard(f, 0);
      if (f.stage === 'pause') return startBoard(f, f.boardIdx + 1);
      return f;
    case 'F_CALL': {
      if (f.stage !== 'letters' && !callsLive(f)) return f;
      const L = baseLetter(a.letter);
      if (!/^[A-Z]$/.test(L) || f.called.includes(L) || f.picked.includes(L)) return f;
      const vowel = isVowel(L);
      if ((vowel ? f.vowelsLeft : f.consonantsLeft) <= 0) return f;
      if (callsLive(f)) {
        // the letter appears at once; a missing consonant costs 3 seconds
        const present = finalePhrase(f).text.split('').some((ch) => baseLetter(ch) === L);
        const next: FinaleState = {
          ...f, called: [...f.called, L],
          consonantsLeft: vowel ? f.consonantsLeft : f.consonantsLeft - 1,
          vowelsLeft: vowel ? f.vowelsLeft - 1 : f.vowelsLeft,
          message: present ? `C'è la ${L}!` : `Nessuna ${L}`,
        };
        if (present || vowel) return next;
        const timeLeft = Math.max(0, f.timeLeft - PENALTY_MS);
        return timeLeft === 0 ? endBoards({ ...next, timeLeft, called: allCalled(f) }, 'Tempo scaduto!') : { ...next, timeLeft, message: `Nessuna ${L}: −3 secondi!` };
      }
      const picked = [...f.picked, L];
      const next: FinaleState = {
        ...f, picked,
        consonantsLeft: vowel ? f.consonantsLeft : f.consonantsLeft - 1,
        vowelsLeft: vowel ? f.vowelsLeft - 1 : f.vowelsLeft,
      };
      return { ...next, message: canGo(next) ? `Hai scelto ${picked.join(', ')}. Quando sei pronto: VIA!` : `Hai scelto ${picked.join(', ')}` };
    }
    case 'F_GO':
      if (!canGo(f)) return f;
      return { ...f, stage: 'board', called: [...f.called, ...f.picked], picked: [], message: 'Il tempo scorre!' };
    case 'F_ANSWER':
      return f.stage === 'board' ? { ...f, stage: 'answer', message: 'Tempo fermo: rispondi!' } : f;
    case 'F_STOP':
      if (f.stage !== 'board' && f.stage !== 'answer') return f;
      return boardOver(f, 'Stop: tabellone non vinto.');
    case 'F_SOLVE':
    case 'F_FORCE_SOLVE': {
      // an answer is given after «RISPONDI»; the conductor can confirm it any time the board is on
      if (a.type === 'F_SOLVE' ? f.stage !== 'answer' : f.stage !== 'board' && f.stage !== 'answer') return f;
      const p = finalePhrase(f);
      // after «RISPONDI» there is one answer: a wrong one loses the board (the time left stays for the next ones)
      if (a.type === 'F_SOLVE' && !checkSolution(a.text, p.text, f.kids ? 2 : 1)) return boardOver(f, 'Risposta sbagliata: tabellone perso.');
      const won = f.won.map((w, i) => (i === f.boardIdx ? true : w));
      return boardOver({ ...f, won }, 'Esatto!');
    }
    case 'F_TICK': {
      if (f.stage !== 'board') return f;
      const timeLeft = Math.max(0, f.timeLeft - a.ms);
      return timeLeft === 0 ? endBoards({ ...f, timeLeft, called: allCalled(f) }, 'Tempo scaduto!') : { ...f, timeLeft };
    }
    case 'F_CHOOSE': {
      if (f.stage !== 'choose' || !f.won[a.i]) return f;
      return { ...f, stage: 'reveal', chosen: a.i, prize: f.values[f.envelopes[a.i]], message: '' };
    }
  }
}
