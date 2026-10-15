// Phrase bank loading. Phrases are stored rot13 + base64 so they are not readable in the public repo.

import adulti from '../data/frasi/adulti.json';
import bambini from '../data/frasi/bambini.json';
import type { PhraseItem } from './rounds';
import { BOARD_COLS, BOARD_ROWS, layoutBoard } from './phrase';

interface RawPhrase { id: string; t: string; categoria: string; tema: string; difficolta: number; bambini: boolean }

const rot13 = (s: string) =>
  s.replace(/[A-Za-z]/g, (c) => {
    const b = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b);
  });

export function decodePhrase(t: string): string {
  const bytes = Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  return rot13(new TextDecoder().decode(bytes));
}

export interface BankPhrase extends PhraseItem { id: string; categoria: string; bambini: boolean }

let kidsMode = false;
/** Kids mode switches the default bank to the children's phrases. */
export const setKidsMode = (on: boolean) => { kidsMode = on; };

export function loadBank(raw: RawPhrase[] = (kidsMode ? bambini : adulti) as RawPhrase[]): BankPhrase[] {
  return raw.map((r) => ({ id: r.id, text: decodePhrase(r.t), tema: r.tema, categoria: r.categoria, bambini: r.bambini }));
}

const CUSTOM_KEY = 'ruota.frasiPersonali';
export type Source = 'banca' | 'mie' | 'mix';
export interface CustomPhrase { id: string; text: string; tema: string }

export function loadCustom(): CustomPhrase[] {
  try {
    const x = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]');
    return Array.isArray(x) ? x.filter((p) => p && typeof p.text === 'string') : [];
  } catch { return []; }
}

export function saveCustom(list: CustomPhrase[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

/** Validate user input; returns an error message in Italian or null. */
export function validateCustom(text: string): string | null {
  const t = text.trim();
  if (t.length < 3) return 'Frase troppo corta';
  if (layoutBoard(t.toUpperCase()) === null) return `Non entra nel tabellone (max ${BOARD_ROWS} righe da ${BOARD_COLS} lettere, parole intere)`;
  return null;
}

export function addCustom(text: string, tema: string): string | null {
  const err = validateCustom(text);
  if (err) return err;
  const list = loadCustom();
  list.push({ id: 'c' + Date.now().toString(36) + list.length, text: text.trim().toUpperCase(), tema: tema.trim() || 'Frase nostra' });
  saveCustom(list);
  return null;
}

export function exportCustom(): string {
  return JSON.stringify({ versione: 1, frasi: loadCustom().map(({ text, tema }) => ({ text, tema })) }, null, 1);
}

/** Import from exported JSON; returns the number of phrases added (invalid ones are skipped). */
export function importCustom(json: string): number {
  const data = JSON.parse(json);
  const arr: { text?: unknown; tema?: unknown }[] = Array.isArray(data) ? data : data.frasi;
  let n = 0;
  for (const p of arr) if (typeof p.text === 'string' && addCustom(p.text, typeof p.tema === 'string' ? p.tema : '') === null) n++;
  return n;
}

const HISTORY_KEY = 'ruota.storico';

function readHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}

/** Pick `n` phrases, avoiding recently used ones until the bank is exhausted. */
export function pickPhrases(n: number, bank: BankPhrase[] = loadBank(), rnd: () => number = Math.random, source: Source = 'banca'): BankPhrase[] {
  const mine: BankPhrase[] = loadCustom().map((c) => ({ id: c.id, text: c.text, tema: c.tema, categoria: 'Personale', bambini: false }));
  if (source === 'mie' && mine.length) bank = mine;
  else if (source === 'mix') bank = [...bank, ...mine];
  let used = new Set(readHistory());
  let pool = bank.filter((p) => !used.has(p.id));
  if (pool.length < n) { used = new Set(); pool = [...bank]; }
  const picked: BankPhrase[] = [];
  while (picked.length < n && pool.length) {
    picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  // fewer phrases than rounds (e.g. only a few custom ones): repeat from the bank
  while (picked.length < n) picked.push(bank[Math.floor(rnd() * bank.length)]);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([...used, ...picked.map((p) => p.id)])); } catch { /* ignore */ }
  return picked;
}

// ───────────── rounds ─────────────
import triplete from '../data/frasi/triplete.json';
import cruci from '../data/frasi/cruci.json';
import { layoutCrossword } from './crossword';
import { ENVELOPE_VALUES, FinaleSetup } from './finale';
import { ROUND_NAMES, PRESET_ROUNDS, PRESET_ROUNDS_KIDS, Preset, RoundSpec, RoundType, boardsIn } from './rounds';

interface RawSet { id: string; tema: string; t: string[] }

const pickOne = <T>(a: T[], rnd: () => number) => a[Math.floor(rnd() * a.length)];

/** Phrases for one round of the given type. */
export function buildRound(type: RoundType, source: Source = 'banca', rnd: () => number = Math.random): PhraseItem[] {
  const item = (b: BankPhrase): PhraseItem => ({ text: b.text, tema: b.tema });
  switch (type) {
    case 'triplete': {
      const set = pickOne(triplete as RawSet[], rnd);
      return set.t.map((t) => ({ text: decodePhrase(t), tema: set.tema }));
    }
    case 'cruciruota': {
      for (let attempt = 0; attempt < 5; attempt++) {
        const set = pickOne(cruci as RawSet[], rnd);
        const cw = layoutCrossword(set.t.map(decodePhrase));
        if (cw) return [{ text: cw.words.join(' '), tema: set.tema, grid: cw, words: cw.words }];
      }
      return pickPhrases(1, undefined, rnd, source).map(item);
    }
    case 'tema': {
      const themed = loadBank().filter((b) => b.categoria !== 'Modo di dire');
      return [item(pickOne(themed, rnd))];
    }
    case 'ultimo': {
      const short = loadBank().filter((b) => b.text.replace(/[^A-ZÀ-Ù]/g, '').length <= 14);
      const out: PhraseItem[] = [];
      while (out.length < boardsIn('ultimo')) {
        const p = item(pickOne(short, rnd));
        if (!out.some((o) => o.text === p.text)) out.push(p);
      }
      return out;
    }
    default:
      return pickPhrases(1, undefined, rnd, source).map(item);
  }
}

/** Round types for a preset (the last one of "completa" alternates Cruciruota/Triplete). */
export function presetTypes(preset: Preset, custom: RoundType[], rnd: () => number = Math.random, kids = false): RoundType[] {
  if (preset === 'libera') return kids ? custom.map((t) => (t === 'express' ? 'classica' : t)) : custom;
  const t = [...(kids ? PRESET_ROUNDS_KIDS : PRESET_ROUNDS)[preset]];
  if (preset === 'completa' && rnd() < 0.5) t[3] = 'triplete';
  return t;
}

export function buildGame(types: RoundType[], source: Source = 'banca', rnd: () => number = Math.random): { phrases: PhraseItem[]; rounds: RoundSpec[] } {
  const phrases: PhraseItem[] = [];
  const rounds: RoundSpec[] = types.map((type) => {
    // never the same phrase twice in a game (e.g. two Triplete drawing the same set)
    let ph = buildRound(type, source, rnd);
    for (let i = 0; i < 8 && ph.some((p) => phrases.some((q) => q.text === p.text)); i++) ph = buildRound(type, source, rnd);
    const first = phrases.length;
    phrases.push(...ph);
    return { type, first, count: ph.length };
  });
  return { phrases, rounds };
}

export { ROUND_NAMES };

/** Phrases and shuffled prize values for the final game. */
export function buildFinale(rnd: () => number = Math.random): FinaleSetup {
  const phrases = pickPhrases(3, undefined, rnd).map((b): PhraseItem => ({ text: b.text, tema: b.tema }));
  const values = [...ENVELOPE_VALUES];
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return { phrases, values };
}
