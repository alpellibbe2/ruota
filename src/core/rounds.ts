// Round catalogue: types, rules text, wheel layouts and presets.

import type { Crossword } from './crossword';
import { DEFAULT_WHEEL, Segment } from './wheel';

export type RoundType = 'classica' | 'tema' | 'express' | 'cruciruota' | 'triplete' | 'jackpot' | 'ultimo';

export const ROUND_TYPES: RoundType[] = ['classica', 'tema', 'express', 'cruciruota', 'triplete', 'jackpot', 'ultimo'];

export const ROUND_NAMES: Record<RoundType, string> = {
  classica: 'Classica',
  tema: 'A tema',
  express: 'Express',
  cruciruota: 'Cruciruota',
  triplete: 'Triplete',
  jackpot: 'Round Jackpot',
  ultimo: 'Ultimo Round',
};

export const ROUND_RULES: Record<RoundType, string> = {
  classica: 'Gira la ruota, chiama le consonanti, risolvi la frase.',
  tema: 'Regole classiche, con una frase a tema.',
  express: 'Fermati su Express: entra da solo, ogni consonante vale 1000. Un errore e perdi tutto!',
  cruciruota: 'Cruciverba: scopri le lettere e scrivi tutte le parole.',
  triplete: 'Tre frasi dello stesso tema, una dopo l’altra.',
  jackpot: 'Il Jackpot cresce a ogni giro: chi lo conquista e risolve lo vince.',
  ultimo: 'Le lettere si scoprono da sole: prenotati e rispondi per primo!',
};

export interface PhraseItem { text: string; tema: string; grid?: Crossword; words?: string[] }

/** A round covers `count` consecutive phrases starting at index `first` of the flat phrase list. */
export interface RoundSpec { type: RoundType; first: number; count: number }

/** 'ultimo': quick game made only of Ultimo Round (players book to answer), no final game. */
export type Preset = 'veloce' | 'completa' | 'ultimo' | 'libera';

export const PRESET_ROUNDS: Record<Exclude<Preset, 'libera'>, RoundType[]> = {
  veloce: ['classica', 'express', 'ultimo'],
  completa: ['classica', 'tema', 'express', 'cruciruota', 'ultimo'],
  ultimo: ['ultimo', 'ultimo', 'ultimo'],
};

/** Kids mode has no Express. */
export const PRESET_ROUNDS_KIDS: Record<Exclude<Preset, 'libera'>, RoundType[]> = {
  veloce: ['classica', 'tema', 'ultimo'],
  completa: ['classica', 'tema', 'cruciruota', 'tema', 'ultimo'],
  ultimo: ['ultimo', 'ultimo', 'ultimo'],
};

/** Boards in a round of this type. */
export const boardsIn = (t: RoundType) => (t === 'triplete' ? 3 : t === 'ultimo' ? 2 : 1);

/** Wheel for a round type: base layout plus special segments. */
export function wheelFor(type: RoundType): Segment[] {
  const w = DEFAULT_WHEEL.map((s) => ({ ...s })) as Segment[];
  w[9] = { kind: 'value', value: 300, token: 'jolly' };
  w[17] = { kind: 'value', value: 300, token: 'premio' };
  if (type === 'express') for (const i of [1, 8, 19]) w[i] = { kind: 'express' };
  if (type === 'jackpot') w[14] = { kind: 'value', value: 500, token: 'jackpot' };
  return w;
}

export const EXPRESS_VALUE = 1000;
export const EXPRESS_SEGMENT_VALUE = 500;
export const PREMIO_BONUS = 2000;
export const ULTIMO_VALUE = 1000;
export const JOLLY_ROUNDS = 3;
