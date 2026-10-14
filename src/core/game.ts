// Game state machine: a pure reducer, no UI, no randomness (randomness is passed in actions).

import { baseLetter, checkSolution, countLetter, hiddenLetters, isFullyRevealed, isLetter, isVowel } from './phrase';
import { DEFAULT_WHEEL, Segment, segmentAt } from './wheel';

export interface Player { name: string; color: string; round: number; total: number }
export interface PhraseItem { text: string; tema: string }
export interface Config { vowelCost: number; bankruptAll: boolean; typoTolerance: boolean }

export type Phase = 'turn' | 'spinning' | 'consonant' | 'roundEnd' | 'gameEnd';

export type GameEvent =
  | 'start' | 'spin' | 'value' | 'pass' | 'bankrupt' | 'hit' | 'miss'
  | 'vowel' | 'solved' | 'wrong' | 'roundEnd' | 'gameEnd';

export interface GameState {
  config: Config;
  players: Player[];
  wheel: Segment[];
  phrases: PhraseItem[];
  round: number;
  starter: number;
  current: number;
  phase: Phase;
  called: string[];
  wheelAngle: number;
  landed: number | null;
  /** Value of the segment the current player is playing for. */
  pending: number;
  message: string;
  /** Incremented at every change worth a sound/animation. */
  event: { id: number; type: GameEvent; count?: number; letter?: string };
  /** Winner index of the last round. */
  roundWinner: number | null;
}

export type Action =
  | { type: 'SPIN'; angle: number }
  | { type: 'SPIN_DONE' }
  | { type: 'CALL'; letter: string }
  | { type: 'BUY_VOWEL'; letter: string }
  | { type: 'SOLVE'; text: string }
  | { type: 'TIMEOUT' }
  | { type: 'NEXT_ROUND' }
  // Host/conductor interventions
  | { type: 'FORCE_SOLVE' }
  | { type: 'FORCE_PASS' }
  | { type: 'ADJUST'; player: number; delta: number }
  | { type: 'SKIP'; phrase: PhraseItem };

export const DEFAULT_CONFIG: Config = { vowelCost: 500, bankruptAll: true, typoTolerance: true };
export const PLAYER_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00'];

export function newGame(
  names: string[],
  phrases: PhraseItem[],
  config: Config = DEFAULT_CONFIG,
  wheel: Segment[] = DEFAULT_WHEEL,
): GameState {
  if (names.length < 2 || names.length > 6) throw new Error('2-6 players required');
  if (phrases.length < 1) throw new Error('at least one phrase required');
  return {
    config,
    players: names.map((name, i) => ({ name, color: PLAYER_COLORS[i], round: 0, total: 0 })),
    wheel,
    phrases,
    round: 0,
    starter: 0,
    current: 0,
    phase: 'turn',
    called: [],
    wheelAngle: 0,
    landed: null,
    pending: 0,
    message: '',
    event: { id: 1, type: 'start' },
    roundWinner: null,
  };
}

export const currentPhrase = (s: GameState): PhraseItem => s.phrases[s.round];

/** Rounded-down check used by the UI to enable the "buy vowel" button. */
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

function passTurn(s: GameState, message: string, type: GameEvent): GameState {
  const current = (s.current + 1) % s.players.length;
  return { ...s, current, phase: 'turn', landed: null, pending: 0, message, event: emit(s, type) };
}

function withPlayer(s: GameState, patch: Partial<Player>): Player[] {
  return s.players.map((p, i) => (i === s.current ? { ...p, ...patch } : p));
}

function winRound(s: GameState, message: string): GameState {
  const winner = s.players[s.current];
  const players = s.players.map((p, i) => ({
    ...p,
    total: i === s.current ? p.total + winner.round : p.total,
    round: 0,
  }));
  const last = s.round >= s.phrases.length - 1;
  return {
    ...s,
    players,
    phase: last ? 'gameEnd' : 'roundEnd',
    roundWinner: s.current,
    landed: null,
    pending: 0,
    message,
    event: emit(s, last ? 'gameEnd' : 'roundEnd'),
  };
}

function allLetters(text: string): string[] {
  const all = new Set<string>();
  for (const ch of text) if (isLetter(ch)) all.add(baseLetter(ch));
  return [...all];
}

export function reduce(s: GameState, a: Action): GameState {
  const phrase = currentPhrase(s);
  const called = new Set(s.called);
  const me = s.players[s.current];

  switch (a.type) {
    case 'SPIN': {
      if (s.phase !== 'turn') return s;
      const landed = segmentAt(a.angle);
      return { ...s, phase: 'spinning', wheelAngle: a.angle, landed, message: '', event: emit(s, 'spin') };
    }
    case 'SPIN_DONE': {
      if (s.phase !== 'spinning' || s.landed === null) return s;
      const seg = s.wheel[s.landed];
      if (seg.kind === 'pass') return passTurn(s, `${me.name}: Passa!`, 'pass');
      if (seg.kind === 'bankrupt') {
        const players = withPlayer(s, { round: 0, total: s.config.bankruptAll ? 0 : me.total });
        return passTurn({ ...s, players }, `${me.name}: Bancarotta!`, 'bankrupt');
      }
      return {
        ...s,
        phase: 'consonant',
        pending: seg.value,
        message: `${me.name}: scegli una consonante (${seg.value})`,
        event: emit(s, 'value'),
      };
    }
    case 'CALL': {
      if (s.phase !== 'consonant') return s;
      const L = baseLetter(a.letter);
      if (!/^[A-Z]$/.test(L) || isVowel(L) || called.has(L)) return s;
      called.add(L);
      const n = countLetter(phrase.text, L);
      const base = { ...s, called: [...called] };
      if (n === 0) return passTurn(base, `Nessuna ${L}`, 'miss');
      const players = withPlayer(base, { round: me.round + n * s.pending });
      const next: GameState = {
        ...base,
        players,
        phase: 'turn',
        landed: null,
        pending: 0,
        message: `${n} × ${L}: +${n * s.pending}`,
        event: emit(s, 'hit', { count: n, letter: L }),
      };
      return isFullyRevealed(phrase.text, called) ? winRound(next, `${me.name} completa la frase!`) : next;
    }
    case 'BUY_VOWEL': {
      if (!canBuyVowel(s)) return s;
      const L = baseLetter(a.letter);
      if (!isVowel(L) || called.has(L)) return s;
      called.add(L);
      const n = countLetter(phrase.text, L);
      const base = { ...s, called: [...called], players: withPlayer(s, { round: me.round - s.config.vowelCost }) };
      if (n === 0) return passTurn(base, `Nessuna ${L}`, 'miss');
      const next: GameState = {
        ...base,
        message: `${n} × ${L}`,
        event: emit(s, 'vowel', { count: n, letter: L }),
      };
      return isFullyRevealed(phrase.text, called) ? winRound(next, `${me.name} completa la frase!`) : next;
    }
    case 'SOLVE': {
      if (s.phase !== 'turn') return s;
      if (checkSolution(a.text, phrase.text, s.config.typoTolerance)) {
        return winRound({ ...s, called: allLetters(phrase.text) }, `${me.name} risolve!`);
      }
      return passTurn(s, 'Soluzione sbagliata', 'wrong');
    }
    case 'TIMEOUT': {
      if (s.phase !== 'turn' && s.phase !== 'consonant') return s;
      return passTurn(s, 'Tempo scaduto', 'miss');
    }
    case 'FORCE_SOLVE': {
      if (s.phase !== 'turn' && s.phase !== 'consonant') return s;
      return winRound({ ...s, called: allLetters(phrase.text) }, `${me.name} risolve!`);
    }
    case 'FORCE_PASS': {
      if (s.phase !== 'turn' && s.phase !== 'consonant') return s;
      return passTurn(s, 'Turno passato dal conduttore', 'pass');
    }
    case 'ADJUST': {
      const p = s.players[a.player];
      if (!p || !Number.isFinite(a.delta)) return s;
      const players = s.players.map((x, i) => (i === a.player ? { ...x, round: Math.max(0, x.round + a.delta) } : x));
      return { ...s, players, message: `${p.name}: ${a.delta >= 0 ? '+' : ''}${a.delta}` };
    }
    case 'SKIP': {
      if (s.phase !== 'turn' && s.phase !== 'consonant') return s;
      const phrases = s.phrases.map((x, i) => (i === s.round ? a.phrase : x));
      return { ...s, phrases, called: [], phase: 'turn', landed: null, pending: 0, message: 'Nuova frase', event: emit(s, 'start') };
    }
    case 'NEXT_ROUND': {
      if (s.phase !== 'roundEnd') return s;
      const starter = (s.starter + 1) % s.players.length;
      return {
        ...s,
        round: s.round + 1,
        starter,
        current: starter,
        phase: 'turn',
        called: [],
        message: '',
        roundWinner: null,
        event: emit(s, 'start'),
      };
    }
  }
}

/** Players sorted by total, descending (stable). */
export function ranking(s: GameState): Player[] {
  return [...s.players].sort((x, y) => y.total - x.total);
}
