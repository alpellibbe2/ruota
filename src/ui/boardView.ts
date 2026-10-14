import { BOARD_COLS, BOARD_ROWS, baseLetter, isLetter, layoutBoard } from '../core/phrase';

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
    this.grid.style.gridTemplateColumns = `repeat(${BOARD_COLS}, minmax(0, 1fr))`;
    this.el.append(this.title, this.grid);
  }

  setPhrase(text: string, tema: string) {
    this.title.textContent = tema;
    this.grid.textContent = '';
    this.tiles = [];
    const rows = layoutBoard(text) ?? Array(BOARD_ROWS).fill(' '.repeat(BOARD_COLS));
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
  update(called: Set<string>): number {
    let fresh = 0;
    for (const t of this.tiles) {
      if (!t.letter) continue;
      if (called.has(baseLetter(t.ch)) && t.el.classList.contains('covered')) {
        t.el.classList.replace('covered', 'revealed');
        t.el.textContent = t.ch;
        fresh++;
      }
    }
    return fresh;
  }
}
