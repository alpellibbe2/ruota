// Game state machine: a pure reducer, no UI, no randomness (randomness is passed in actions).

import { occurrences } from './board';
import { baseLetter, checkSolution, checkWords, hiddenLetters, isFullyRevealed, isLetter, isVowel } from './phrase';
import {
  EXPRESS_SEGMENT_VALUE, EXPRESS_VALUE, JOLLY_ROUNDS, PREMIO_BONUS, ULTIMO_VALUE,
  PhraseItem, RoundSpec, RoundType, wheelFor,
} from './rounds';
import { FinaleAction, FinaleSetup, FinaleState, envelopeWheel, finaleReduce, finalePhrase, newFinale } from './finale';
import { Segment, segmentAt, Token } from './wheel';

export type { PhraseItem } from './rounds';

export interface Player {
  name: string; color: string; round: number; total: number;
  jolly: boolean; premio: boolean; jackpot: boolean;
}
export interface Config { vowelCost: number; bankruptAll: boolean; typoTolerance: boolean; finale?: boolean; kids?: boolean }

export type Phase =
  | 'turn' | 'spinning' | 'consonant' | 'expressOffer' | 'jolly' | 'ultimo' | 'booked' | 'roundEnd' | 'finale' | 'gameEnd';

export type GameEvent =
  | 'start' | 'spin' | 'value' | 'pass' | 'bankrupt' | 'hit' | 'miss'
  | 'vowel' | 'solved' | 'wrong' | 'roundEnd' | 'gameEnd' | 'jolly' | 'token' | 'express' | 'book' | 'reveal';

export interface GameState {
  config: Config;
  players: Player[];
  wheel: Segment[];
  phrases: PhraseItem[];
  rounds: RoundSpec[];
  /** Index in `rounds`. */
  round: number;
  /** Index in `phrases` of the board being played. */
  board: number;
  starter: number;
  current: number;
  phase: Phase;
  called: string[];
  wheelAngle: number;
  landed: number | null;
  /** Value per letter for the consonant being called. */
  pending: number;
  pendingToken: Token | 'express' | null;
  /** The current player is playing Express alone. */
  express: boolean;
  jackpotPot: number;
  /** Ultimo Round: who booked, and who already failed on this board. */
  booked: number | null;
  excluded: number[];
  message: string;
  event: { id: number; type: GameEvent; count?: number; letter?: string };
  roundWinner: number | null;
  /** Phase 'jolly': what the Jolly would cancel if the player decides to use it. */
  jollyFor?: 'bankrupt' | 'pass' | 'miss' | null;
  /** The final game, set up at the start and played after the last round. */
  finaleSetup?: FinaleSetup;
  finale?: FinaleState;
  /** The last round is over: the next step is the final game (or a tie-break). */
  toFinale?: boolean;
  tieBreakDone?: boolean;
}

export type Action =
  | { type: 'SPIN'; angle: number }
  | { type: 'SPIN_DONE' }
  | { type: 'CALL'; letter: string }
  | { type: 'BUY_VOWEL'; letter: string }
  | { type: 'SOLVE'; text: string }
  | { type: 'TIMEOUT' }
  | { type: 'NEXT_ROUND'; round?: { type: RoundType; phrases: PhraseItem[] } }
  | { type: 'EXPRESS'; go: boolean }
  | { type: 'JOLLY'; use: boolean }
  | { type: 'REVEAL'; letter: string }
  | { type: 'BOOK'; player: number }
  // Host/conductor interventions
  | { type: 'FORCE_SOLVE' }
  | { type: 'FORCE_PASS' }
  | { type: 'ADJUST'; player: number; delta: number }
  | { type: 'SKIP'; phrase: PhraseItem }
  | FinaleAction
  | { type: 'F_END' };

export const DEFAULT_CONFIG: Config = { vowelCost: 500, bankruptAll: true, typoTolerance: true };
export const PLAYER_COLORS = ['#d4145a', '#f7931e', '#1e63e6', '#1fae6a', '#9b3fe0', '#12b8d8'];

export function newGame(
  names: string[],
  phrases: PhraseItem[],
  config: Config = DEFAULT_CONFIG,
  rounds?: RoundSpec[],
  finaleSetup?: FinaleSetup,
): GameState {
  if (names.length < 2 || names.length > 6) throw new Error('2-6 players required');
  if (phrases.length < 1) throw new Error('at least one phrase required');
  const specs = rounds ?? phrases.map((_, i): RoundSpec => ({ type: 'classica', first: i, count: 1 }));
  const s: GameState = {
    config,
    players: names.map((name, i) => ({ name, color: PLAYER_COLORS[i], round: 0, total: 0, jolly: false, premio: false, jackpot: false })),
    wheel: wheelFor(specs[0].type),
    phrases,
    rounds: specs,
    round: 0,
    board: specs[0].first,
    starter: 0,
    current: 0,
    phase: 'turn',
    called: [],
    wheelAngle: 0,
    landed: null,
    pending: 0,
    pendingToken: null,
    express: false,
    jackpotPot: 0,
    booked: null,
    excluded: [],
    message: '',
    event: { id: 1, type: 'start' },
    roundWinner: null,
    jollyFor: null,
    finaleSetup,
  };
  return { ...s, phase: startPhase(s) };
}

export const currentPhrase = (s: GameState): PhraseItem => (s.finale ? finalePhrase(s.finale) : s.phrases[s.board]);
export const finaleOn = (s: GameState): boolean => !!s.finaleSetup && s.config.finale !== false;
export const roundType = (s: GameState): RoundType => s.rounds[s.round].type;
export const boardNo = (s: GameState): number => s.board - s.rounds[s.round].first;
const startPhase = (s: GameState): Phase => (roundType(s) === 'ultimo' ? 'ultimo' : 'turn');
const jollyActive = (s: GameState, p: Player) => p.jolly && s.round < JOLLY_ROUNDS;



export function canBuyVowel(s: GameState): boolean {
  return (
    s.phase === 'turn' &&
    s.players[s.current].round >= s.config.vowelCost &&
    hiddenLetters(currentPhrase(s).text, new Set(s.called), true).length > 0
  );
}

function emit(s: GameState, type: GameEvent, extra: { count?: number; letter?: string } = {}): GameState['event'] {
  return { id: s.event.id + 1, type, ...extra };
}

const nextPlayer = (s: GameState, from = s.current) => (from + 1) % s.players.length;

function passTurn(s: GameState, message: string, type: GameEvent): GameState {
  return {
    ...s, current: nextPlayer(s), phase: 'turn', landed: null, pending: 0, pendingToken: null, express: false,
    message, event: emit(s, type),
  };
}

function patchCurrent(s: GameState, patch: Partial<Player>): Player[] {
  return s.players.map((p, i) => (i === s.current ? { ...p, ...patch } : p));
}

/** A mistake: Express loses everything; on a wrong letter the player may decide to use the Jolly. */
function mistake(s: GameState, message: string, type: GameEvent, letter = false): GameState {
  if (s.express) {
    return passTurn({ ...s, players: patchCurrent(s, { round: 0 }) }, `${message} – Express perso!`, type);
  }
  if (letter && jollyActive(s, s.players[s.current])) return offerJolly(s, 'miss', message, type);
  return passTurn(s, message, type);
}

/** Bancarotta, Passa or a wrong letter with a Jolly in hand: the player chooses whether to spend it. */
function offerJolly(s: GameState, reason: 'bankrupt' | 'pass' | 'miss', message: string, type: GameEvent): GameState {
  return {
    ...s, phase: 'jolly', jollyFor: reason, landed: null, pending: 0, pendingToken: null,
    message: `${message} – ${s.players[s.current].name}, usi il Jolly?`, event: emit(s, type),
  };
}

function bankrupt(s: GameState): GameState {
  const me = s.players[s.current];
  const players = patchCurrent(s, { round: 0, total: s.config.bankruptAll ? 0 : me.total, premio: false, jackpot: false });
  return passTurn({ ...s, players }, `${me.name}: Bancarotta!`, 'bankrupt');
}

function finaleEvent(s: GameState, f: FinaleState, a: FinaleAction): GameState['event'] {
  switch (a.type) {
    case 'F_SPIN': return emit(s, 'spin');
    case 'F_SPIN_DONE': return emit(s, 'value');
    case 'F_START': return emit(s, 'start');
    case 'F_CALL': {
      const L = baseLetter(a.letter);
      const n = finalePhrase(f).text.split('').filter((c) => baseLetter(c) === L).length;
      return n ? emit(s, 'hit', { count: n, letter: L }) : emit(s, 'miss');
    }
    case 'F_SOLVE': case 'F_FORCE_SOLVE':
      return f.won.filter(Boolean).length > (s.finale?.won.filter(Boolean).length ?? 0) ? emit(s, 'roundEnd') : emit(s, 'wrong');
    case 'F_CHOOSE': return emit(s, 'gameEnd');
    default: return s.event;
  }
}

function allLetters(text: string): string[] {
  const all = new Set<string>();
  for (const ch of text) if (isLetter(ch)) all.add(baseLetter(ch));
  return [...all];
}

/** Move on after a board is done: next board of the round, or end of round / game. */
function finishBoard(s: GameState, winner: number | null, message: string): GameState {
  const spec = s.rounds[s.round];
  if (s.board + 1 < spec.first + spec.count) {
    const first = spec.type === 'ultimo';
    return {
      ...s, board: s.board + 1, called: [], phase: first ? 'ultimo' : 'turn', landed: null, pending: 0,
      pendingToken: null, express: false, booked: null, excluded: [],
      current: winner !== null && !first ? nextPlayer(s, winner) : s.current,
      message, event: emit(s, 'solved'),
    };
  }
  const last = s.round >= s.rounds.length - 1;
  const toFinale = last && finaleOn(s);
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, round: 0, premio: false, jackpot: false })),
    phase: last && !toFinale ? 'gameEnd' : 'roundEnd',
    toFinale,
    roundWinner: winner, landed: null, pending: 0, pendingToken: null, express: false, booked: null,
    message, event: emit(s, last && !toFinale ? 'gameEnd' : 'roundEnd'),
  };
}

function winBoard(s: GameState, message: string): GameState {
  const me = s.players[s.current];
  let gain = me.round;
  if (me.premio) gain += PREMIO_BONUS;
  if (me.jackpot) gain += s.jackpotPot;
  const players = s.players.map((p, i) => (i === s.current ? { ...p, total: p.total + gain, round: 0 } : p));
  return finishBoard({ ...s, players, jackpotPot: me.jackpot ? 0 : s.jackpotPot }, s.current, message);
}

/** Typos accepted in a solution: one by default, two in kids mode, none when disabled. */
export const tolerance = (c: Config): number => (c.kids ? 2 : c.typoTolerance ? 1 : 0);

function checkAnswer(s: GameState, text: string): boolean {
  const ph = currentPhrase(s);
  const tol = tolerance(s.config);
  return ph.words ? checkWords(text, ph.words, tol) : checkSolution(text, ph.text, tol);
}

function grantToken(s: GameState, token: Token): Player[] {
  return s.players.map((p, i) => {
    if (token === 'jackpot') return { ...p, jackpot: i === s.current };
    return i === s.current ? { ...p, [token]: true } : p;
  });
}

export function reduce(s: GameState, a: Action): GameState {
  const phrase = currentPhrase(s);
  const called = new Set(s.called);
  const me = s.players[s.current];
  const rtype = roundType(s);

  switch (a.type) {
    case 'SPIN': {
      if (s.phase !== 'turn' || s.express || rtype === 'ultimo') return s;
      return { ...s, phase: 'spinning', wheelAngle: a.angle, landed: segmentAt(a.angle), message: '', event: emit(s, 'spin') };
    }
    case 'SPIN_DONE': {
      if (s.phase !== 'spinning' || s.landed === null) return s;
      const seg = s.wheel[s.landed];
      if (seg.kind === 'pass') return jollyActive(s, me) ? offerJolly(s, 'pass', `${me.name}: Passa!`, 'pass') : passTurn(s, `${me.name}: Passa!`, 'pass');
      if (seg.kind === 'bankrupt') return jollyActive(s, me) ? offerJolly(s, 'bankrupt', `${me.name}: Bancarotta!`, 'bankrupt') : bankrupt(s);
      const value = seg.kind === 'express' ? EXPRESS_SEGMENT_VALUE : seg.value;
      const token = seg.kind === 'express' ? 'express' : seg.token ?? null;
      return {
        ...s, phase: 'consonant', pending: value, pendingToken: token,
        message: `${me.name}: scegli una consonante (${value})`, event: emit(s, 'value'),
      };
    }
    case 'CALL': {
      if (!(s.phase === 'consonant' || (s.phase === 'turn' && s.express))) return s;
      const L = baseLetter(a.letter);
      if (!/^[A-Z]$/.test(L) || isVowel(L)) return s;
      // called letters are not shown to the players: calling one again is a mistake
      if (called.has(L)) return mistake(s, `La ${L} è già uscita`, 'miss', true);
      called.add(L);
      const n = occurrences(phrase, L);
      const base = { ...s, called: [...called] };
      if (n === 0) return mistake(base, `Nessuna ${L}`, 'miss', true);
      const gain = n * s.pending;
      let players = patchCurrent(base, { round: me.round + gain });
      let event = emit(s, 'hit', { count: n, letter: L });
      let phase: Phase = 'turn';
      const tok = s.pendingToken;
      if (tok === 'jolly' || tok === 'premio' || tok === 'jackpot') {
        players = grantToken({ ...base, players }, tok);
      } else if (tok === 'express' && !s.express) {
        phase = 'expressOffer';
      }
      const next: GameState = {
        ...base, players, phase, landed: null,
        pending: s.express ? s.pending : 0, pendingToken: null,
        jackpotPot: rtype === 'jackpot' ? s.jackpotPot + gain : s.jackpotPot,
        message: `${n} × ${L}: +${gain}` + (tok === 'jolly' || tok === 'premio' || tok === 'jackpot' ? ` — conquisti ${tok.toUpperCase()}!` : ''),
        event,
      };
      return isFullyRevealed(phrase.text, called) ? winBoard(next, `${me.name} completa il tabellone!`) : next;
    }
    case 'EXPRESS': {
      if (s.phase !== 'expressOffer') return s;
      if (!a.go) return { ...s, phase: 'turn', message: `${me.name} si ferma`, event: emit(s, 'value') };
      return { ...s, phase: 'turn', express: true, pending: EXPRESS_VALUE, message: `${me.name} va in EXPRESS!`, event: emit(s, 'express') };
    }
    case 'JOLLY': {
      if (s.phase !== 'jolly') return s;
      const base: GameState = { ...s, jollyFor: null };
      if (a.use) return { ...base, players: patchCurrent(s, { jolly: false }), phase: 'turn', message: `${me.name} usa il Jolly!`, event: emit(s, 'jolly') };
      return s.jollyFor === 'bankrupt' ? bankrupt(base) : passTurn(base, `${me.name} tiene il Jolly`, 'pass');
    }
    case 'BUY_VOWEL': {
      if (!canBuyVowel(s)) return s;
      const L = baseLetter(a.letter);
      if (!isVowel(L) || called.has(L)) return s;
      called.add(L);
      const n = occurrences(phrase, L);
      const base = { ...s, called: [...called], players: patchCurrent(s, { round: me.round - s.config.vowelCost }) };
      if (n === 0) return mistake(base, `Nessuna ${L}`, 'miss', true);
      const next: GameState = { ...base, message: `${n} × ${L}`, event: emit(s, 'vowel', { count: n, letter: L }) };
      return isFullyRevealed(phrase.text, called) ? winBoard(next, `${me.name} completa il tabellone!`) : next;
    }
    case 'SOLVE': {
      if (s.phase === 'booked' && s.booked !== null) {
        if (checkAnswer(s, a.text)) {
          const players = s.players.map((p, i) => (i === s.booked ? { ...p, total: p.total + ULTIMO_VALUE } : p));
          return finishBoard({ ...s, players, current: s.booked, called: allLetters(phrase.text) }, s.booked, `${s.players[s.booked].name} risolve! +${ULTIMO_VALUE}`);
        }
        return ultimoFail(s);
      }
      if (s.phase !== 'turn') return s;
      if (checkAnswer(s, a.text)) return winBoard({ ...s, called: allLetters(phrase.text) }, `${me.name} risolve!`);
      return mistake(s, 'Soluzione sbagliata', 'wrong');
    }
    case 'TIMEOUT': {
      if (s.phase === 'booked') return ultimoFail(s);
      if (s.phase === 'expressOffer') return reduce(s, { type: 'EXPRESS', go: false });
      if (s.phase === 'jolly') return reduce(s, { type: 'JOLLY', use: false });
      if (s.phase !== 'turn' && s.phase !== 'consonant') return s;
      return mistake({ ...s, players: s.players }, 'Tempo scaduto', 'miss');
    }
    case 'REVEAL': {
      if (s.phase !== 'ultimo') return s;
      const L = baseLetter(a.letter);
      if (!isLetter(L) || called.has(L) || !allLetters(phrase.text).includes(L)) return s;
      called.add(L);
      const next: GameState = { ...s, called: [...called], message: '', event: emit(s, 'reveal', { letter: L }) };
      return isFullyRevealed(phrase.text, called) ? finishBoard(next, null, 'Nessuno risolve!') : next;
    }
    case 'BOOK': {
      if (s.phase !== 'ultimo' || s.excluded.includes(a.player) || !s.players[a.player]) return s;
      return { ...s, phase: 'booked', booked: a.player, current: a.player, message: `${s.players[a.player].name} si prenota!`, event: emit(s, 'book') };
    }
    case 'F_SPIN': case 'F_SPIN_DONE': case 'F_START': case 'F_CALL': case 'F_SOLVE': case 'F_FORCE_SOLVE': case 'F_TICK': case 'F_CHOOSE': {
      if (s.phase !== 'finale' || !s.finale) return s;
      const f = finaleReduce(s.finale, a);
      if (f === s.finale) return s;
      return { ...s, finale: f, message: f.message, event: finaleEvent(s, f, a) };
    }
    case 'F_END': {
      if (s.phase !== 'finale' || !s.finale || s.finale.stage !== 'reveal') return s;
      const players = s.players.map((p, i) => (i === s.finale!.champion ? { ...p, total: p.total + s.finale!.prize } : p));
      return { ...s, players, phase: 'gameEnd', event: emit(s, 'gameEnd') };
    }
    case 'FORCE_SOLVE': {
      if (s.phase === 'finale' && s.finale) return reduce(s, { type: 'F_SOLVE', text: finalePhrase(s.finale).text });
      if (s.phase === 'booked' && s.booked !== null) return reduce(s, { type: 'SOLVE', text: phrase.words ? phrase.words.join(' ') : phrase.text });
      if (s.phase !== 'turn' && s.phase !== 'consonant') return s;
      return winBoard({ ...s, called: allLetters(phrase.text) }, `${me.name} risolve!`);
    }
    case 'FORCE_PASS': {
      if (s.phase === 'booked') return ultimoFail(s);
      if (s.phase === 'jolly') return reduce(s, { type: 'JOLLY', use: false });
      if (s.phase !== 'turn' && s.phase !== 'consonant' && s.phase !== 'expressOffer') return s;
      return passTurn(s, 'Turno passato dal conduttore', 'pass');
    }
    case 'ADJUST': {
      const p = s.players[a.player];
      if (!p || !Number.isFinite(a.delta)) return s;
      const players = s.players.map((x, i) => (i === a.player ? { ...x, round: Math.max(0, x.round + a.delta) } : x));
      return { ...s, players, message: `${p.name}: ${a.delta >= 0 ? '+' : ''}${a.delta}` };
    }
    case 'SKIP': {
      if (!['turn', 'consonant', 'ultimo', 'jolly', 'expressOffer'].includes(s.phase)) return s;
      const phrases = s.phrases.map((x, i) => (i === s.board ? a.phrase : x));
      return { ...s, phrases, jollyFor: null, called: [], phase: startPhase(s), landed: null, pending: 0, pendingToken: null, express: false, excluded: [], message: 'Nuova frase', event: emit(s, 'start') };
    }
    case 'NEXT_ROUND': {
      if (s.phase !== 'roundEnd') return s;
      if (s.toFinale) return enterFinale(s, a.round?.phrases[0]);
      let phrases = s.phrases;
      let rounds = s.rounds;
      const round = s.round + 1;
      if (a.round) {
        const first = phrases.length;
        phrases = [...phrases, ...a.round.phrases];
        rounds = rounds.map((r, i) => (i === round ? { type: a.round!.type, first, count: a.round!.phrases.length } : r));
      }
      const starter = nextPlayer(s, s.starter);
      const ns: GameState = {
        ...s, phrases, rounds, round, board: rounds[round].first, starter, current: starter, called: [], wheel: wheelFor(rounds[round].type),
        message: '', roundWinner: null, jackpotPot: 0, booked: null, excluded: [], express: false, event: emit(s, 'start'),
      };
      return { ...ns, phase: startPhase(ns) };
    }
  }
}

/** Indexes of the players with the highest total. */
export function leaders(s: GameState): number[] {
  const top = Math.max(...s.players.map((p) => p.total));
  return s.players.map((p, i) => (p.total === top ? i : -1)).filter((i) => i >= 0);
}

/** After the last round: a tie at the top is settled with a lightning phrase, then the final game starts. */
function enterFinale(s: GameState, tiePhrase?: PhraseItem): GameState {
  const tied = leaders(s);
  if (tied.length > 1 && !s.tieBreakDone && tiePhrase) {
    const first = s.phrases.length;
    const rounds = [...s.rounds, { type: 'ultimo' as RoundType, first, count: 1 }];
    return {
      ...s, phrases: [...s.phrases, tiePhrase], rounds, round: rounds.length - 1, board: first, called: [], toFinale: false,
      tieBreakDone: true, phase: 'ultimo', booked: null, wheel: wheelFor('ultimo'), roundWinner: null,
      excluded: s.players.map((_, i) => i).filter((i) => !tied.includes(i)),
      message: 'Spareggio! Frase lampo tra i primi', event: emit(s, 'start'),
    };
  }
  const champion = tied[0];
  return {
    ...s, phase: 'finale', toFinale: false, finale: newFinale(champion, s.finaleSetup!, s.config.kids), current: champion,
    wheel: envelopeWheel(), called: [], booked: null, excluded: [], roundWinner: champion,
    message: `${s.players[champion].name} è il campione!`, event: emit(s, 'start'),
  };
}

/** Ultimo Round: wrong or late answer — the player is out for this board. */
function ultimoFail(s: GameState): GameState {
  if (s.booked === null) return s;
  const excluded = [...s.excluded, s.booked];
  const name = s.players[s.booked].name;
  if (excluded.length >= s.players.length) return finishBoard({ ...s, excluded }, null, 'Nessuno risolve!');
  return { ...s, excluded, booked: null, phase: 'ultimo', message: `${name} sbaglia!`, event: emit(s, 'wrong') };
}

/** Players sorted by total, descending (stable). */
export function ranking(s: GameState): Player[] {
  return [...s.players].sort((x, y) => y.total - x.total);
}
