import { boardRows } from '../core/board';
import { BOARD_COLS, baseLetter, isLetter } from '../core/phrase';
import type { PhraseItem } from '../core/rounds';

interface Tile { el: HTMLElement; ch: string; letter: boolean }

export class BoardView {
  readonly el: HTMLElement;
  private title: HTMLElement;
  private grid: HTMLElement;
  private tiles: Tile[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.title = document.createElement('div');
    this.title.className = 'board-title';
    this.grid = document.createElement('div');
    this.grid.className = 'board-grid';
    this.el.append(this.title, this.grid);
  }

  setPhrase(p: PhraseItem, title = p.tema) {
    this.title.textContent = title;
    this.grid.textContent = '';
    this.tiles = [];
    const rows = boardRows(p);
    const cols = Math.max(...rows.map((r) => r.length), 1);
    // fixed tile size per board so that tall boards (crossword) still fit the same area
    const th = Math.min(74, Math.floor((400 - (rows.length - 1) * 6) / rows.length));
    const tw = Math.min(61, Math.floor(th * 0.82));
    this.grid.style.setProperty('--th', `${th}px`);
    this.grid.style.setProperty('--tw', `${tw}px`);
    this.grid.style.gridTemplateColumns = `repeat(${cols}, var(--tw))`;
    this.grid.style.width = '100%';
    this.grid.style.justifyContent = 'center';
    for (const row of rows) {
      for (const ch of row) {
        const el = document.createElement('div');
        const letter = isLetter(ch);
        el.className = 'tile ' + (ch === ' ' ? 'blank' : letter ? 'covered' : 'shown');
        if (ch !== ' ' && !letter) el.textContent = ch;
        this.grid.append(el);
        this.tiles.push({ el, ch, letter });
      }
    }
  }

  /** Reveal tiles whose base letter is in `called`; returns the tiles newly revealed. */
  update(called: Set<string>, forced: Set<number> = new Set()): number {
    let fresh = 0;
    for (const [i, t] of this.tiles.entries()) {
      if (!t.letter) continue;
      if ((called.has(baseLetter(t.ch)) || forced.has(i)) && t.el.classList.contains('covered')) {
        t.el.classList.replace('covered', 'revealed');
        t.el.textContent = t.ch;
        fresh++;
      }
    }
    return fresh;
  }
}
