// Pure helpers for phrases: letters, board layout, solution checking.

export const BOARD_ROWS = 4;
export const BOARD_COLS = 14;
export const VOWELS = 'AEIOU';
export const CONSONANTS = 'BCDFGHLMNPQRSTVZ';

/** Strip accents and upper-case a single character (È -> E). */
export function baseLetter(ch: string): string {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

export function isLetter(ch: string): boolean {
  return /^[A-Z]$/.test(baseLetter(ch));
}

export function isVowel(ch: string): boolean {
  return VOWELS.includes(baseLetter(ch));
}

/** Lower-level normalization used for comparing solutions. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Accepts the exact solution, or one typo when the solution is long enough. */
export function checkSolution(answer: string, solution: string, typoTolerance: boolean | number = true): boolean {
  const a = normalizeText(answer);
  const s = normalizeText(solution);
  if (!a) return false;
  if (a === s) return true;
  const max = typoTolerance === true ? 1 : typoTolerance === false ? 0 : typoTolerance;
  if (max === 0 || s.length < (max >= 2 ? 5 : 8)) return false;
  // tolerance must not turn spaces into different word counts
  if (a.split(' ').length !== s.split(' ').length) return false;
  return levenshtein(a, s) <= max;
}

/**
 * Wrap the phrase on whole words into at most `rows` rows of `cols` columns.
 * Returns null when it does not fit. Rows are centered with spaces.
 */
export function layoutBoard(text: string, rows = BOARD_ROWS, cols = BOARD_COLS): string[] | null {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > cols) return null;
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= cols) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > rows) return null;
  // vertical centering: put single line on row 1 when possible, like the real board
  const padded = lines.map((l) => {
    const left = Math.floor((cols - l.length) / 2);
    return ' '.repeat(left) + l + ' '.repeat(cols - l.length - left);
  });
  const blank = ' '.repeat(cols);
  const top = Math.floor((rows - padded.length) / 2);
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    const idx = r - top;
    out.push(idx >= 0 && idx < padded.length ? padded[idx] : blank);
  }
  return out;
}

/** Count occurrences of a base letter in the phrase (accents folded). */
export function countLetter(text: string, letter: string): number {
  const L = baseLetter(letter);
  let n = 0;
  for (const ch of text) if (baseLetter(ch) === L) n++;
  return n;
}

/** True when every letter of the phrase is already called. */
export function isFullyRevealed(text: string, called: Set<string>): boolean {
  for (const ch of text) if (isLetter(ch) && !called.has(baseLetter(ch))) return false;
  return true;
}

/** Vowels / consonants still hidden in the phrase. */
export function hiddenLetters(text: string, called: Set<string>, vowel: boolean): string[] {
  const set = new Set<string>();
  for (const ch of text) {
    const b = baseLetter(ch);
    if (isLetter(ch) && !called.has(b) && isVowel(b) === vowel) set.add(b);
  }
  return [...set];
}

/** Check a Cruciruota answer: the list of all words, in any order (separators: spaces, commas, newlines). */
export function checkWords(answer: string, words: string[], typoTolerance: boolean | number = true): boolean {
  const given = normalizeText(answer).split(' ').filter(Boolean);
  if (given.length !== words.length) return false;
  const left = [...words];
  for (const g of given) {
    const i = left.findIndex((w) => checkSolution(g, w, typoTolerance));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return true;
}
