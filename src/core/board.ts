// What the board shows for a phrase (text board or crossword grid), and letter occurrences.

import { crosswordRows } from './crossword';
import { baseLetter, countLetter, isLetter, layoutBoard } from './phrase';
import type { PhraseItem } from './rounds';

/** Unmasked rows of the board; spaces are empty cells. */
export function boardRows(p: PhraseItem): string[] {
  if (p.grid) return crosswordRows(p.grid);
  return layoutBoard(p.text) ?? [];
}

/** Occurrences of a letter on the board (crossing cells in a crossword count once). */
export function occurrences(p: PhraseItem, letter: string): number {
  if (!p.grid) return countLetter(p.text, letter);
  const L = baseLetter(letter);
  return p.grid.cells.filter((c) => baseLetter(c.ch) === L).length;
}

/** Rows with hidden letters as '_'. `forced` = flat tile indexes shown regardless (Testacoda). */
export function maskRows(p: PhraseItem, called: Set<string>, forced: Set<number> = new Set()): string[] {
  let idx = 0;
  return boardRows(p).map((r) => [...r].map((ch) => {
    const i = idx++;
    return isLetter(ch) && !called.has(baseLetter(ch)) && !forced.has(i) ? '_' : ch;
  }).join(''));
}
