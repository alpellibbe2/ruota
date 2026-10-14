// Crossword layout for the Cruciruota round: words cross on shared letters.

import { baseLetter } from './phrase';

export interface Cell { r: number; c: number; ch: string }
export interface Crossword { cells: Cell[]; rows: number; cols: number; words: string[] }

interface Placed { word: string; r: number; c: number; horiz: boolean }

const MAX_COLS = 14;
const MAX_ROWS = 7;

/** Try to place `words` (first one horizontal, then crossing). Deterministic; returns null if fewer than 2 fit. */
export function layoutCrossword(input: string[]): Crossword | null {
  const words = input.map((w) => w.toUpperCase());
  let best: Crossword | null = null;
  // try every word as the first one so that more orders can succeed
  for (let start = 0; start < words.length; start++) {
    const order = [words[start], ...words.filter((_, i) => i !== start)];
    const res = tryLayout(order);
    if (res && (!best || res.words.length > best.words.length)) best = res;
    if (best && best.words.length === words.length) break;
  }
  return best;
}

function tryLayout(order: string[]): Crossword | null {
  const grid = new Map<string, string>();
  const placed: Placed[] = [];
  const key = (r: number, c: number) => `${r},${c}`;

  const canPlace = (w: string, r: number, c: number, horiz: boolean): number => {
    // returns number of crossings, or -1 when invalid
    let crossings = 0;
    const dr = horiz ? 0 : 1;
    const dc = horiz ? 1 : 0;
    if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.length, c + dc * w.length))) return -1;
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const ex = grid.get(key(rr, cc));
      if (ex !== undefined) {
        if (ex !== w[i]) return -1;
        crossings++;
      } else {
        // a new cell must not touch parallel neighbours
        if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) return -1;
      }
    }
    return crossings;
  };

  const put = (w: string, r: number, c: number, horiz: boolean) => {
    for (let i = 0; i < w.length; i++) grid.set(key(r + (horiz ? 0 : i), c + (horiz ? i : 0)), w[i]);
    placed.push({ word: w, r, c, horiz });
  };

  put(order[0], 0, 0, true);
  for (const w of order.slice(1)) {
    let bestPos: Placed | null = null;
    for (const p of placed) {
      for (let i = 0; i < p.word.length; i++) {
        for (let j = 0; j < w.length; j++) {
          if (baseLetter(p.word[i]) !== baseLetter(w[j])) continue;
          const horiz = !p.horiz;
          // new word crosses p at p's letter i / the new word's letter j
          const pr = p.horiz ? p.r - j : p.r + i;
          const pc = p.horiz ? p.c + i : p.c - j;
          if (canPlace(w, pr, pc, horiz) === 1) {
            const cand = { word: w, r: pr, c: pc, horiz };
            if (fits(placed, cand)) { bestPos = cand; break; }
          }
        }
        if (bestPos) break;
      }
      if (bestPos) break;
    }
    if (bestPos) put(w, bestPos.r, bestPos.c, bestPos.horiz);
  }
  if (placed.length < 2) return null;

  const minR = Math.min(...[...grid.keys()].map((k) => +k.split(',')[0]));
  const minC = Math.min(...[...grid.keys()].map((k) => +k.split(',')[1]));
  const cells: Cell[] = [...grid.entries()].map(([k, ch]) => {
    const [r, c] = k.split(',').map(Number);
    return { r: r - minR, c: c - minC, ch };
  });
  const rows = Math.max(...cells.map((x) => x.r)) + 1;
  const cols = Math.max(...cells.map((x) => x.c)) + 1;
  if (rows > MAX_ROWS || cols > MAX_COLS) return null;
  return { cells, rows, cols, words: placed.map((p) => p.word) };
}

/** The candidate must keep the whole grid within the board size. */
function fits(placed: Placed[], cand: Placed): boolean {
  const all = [...placed, cand];
  const rs: number[] = [];
  const cs: number[] = [];
  for (const p of all) {
    rs.push(p.r, p.horiz ? p.r : p.r + p.word.length - 1);
    cs.push(p.c, p.horiz ? p.c + p.word.length - 1 : p.c);
  }
  return Math.max(...rs) - Math.min(...rs) + 1 <= MAX_ROWS && Math.max(...cs) - Math.min(...cs) + 1 <= MAX_COLS;
}

/** Render the grid to text rows; blank cells are spaces. */
export function crosswordRows(cw: Crossword): string[] {
  const rows = Array.from({ length: cw.rows }, () => Array<string>(cw.cols).fill(' '));
  for (const c of cw.cells) rows[c.r][c.c] = c.ch;
  return rows.map((r) => r.join(''));
}
