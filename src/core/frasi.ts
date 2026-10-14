// Phrase bank loading. Phrases are stored rot13 + base64 so they are not readable in the public repo.

import adulti from '../data/frasi/adulti.json';
import type { PhraseItem } from './game';

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

export function loadBank(raw: RawPhrase[] = adulti as RawPhrase[]): BankPhrase[] {
  return raw.map((r) => ({ id: r.id, text: decodePhrase(r.t), tema: r.tema, categoria: r.categoria, bambini: r.bambini }));
}

const HISTORY_KEY = 'ruota.storico';

function readHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}

/** Pick `n` phrases, avoiding recently used ones until the bank is exhausted. */
export function pickPhrases(n: number, bank: BankPhrase[] = loadBank(), rnd: () => number = Math.random): BankPhrase[] {
  let used = new Set(readHistory());
  let pool = bank.filter((p) => !used.has(p.id));
  if (pool.length < n) { used = new Set(); pool = [...bank]; }
  const picked: BankPhrase[] = [];
  while (picked.length < n && pool.length) {
    picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([...used, ...picked.map((p) => p.id)])); } catch { /* ignore */ }
  return picked;
}
