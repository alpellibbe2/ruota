import { Segment, segmentAt, segmentLabel, SEGMENT_ANGLE } from '../core/wheel';
import { sfx } from './audio';

// studio palette: purple, navy, royal blue, light blue; values in yellow
const COLORS = ['#8e2bd0', '#262a6b', '#1f47c9', '#4f86e8'];
const LIGHT = ['#f4f4fb', '#00e676', '#ffab00'];
const SIZE = 800;

function segBg(seg: Segment, i: number): string {
  if (seg.kind === 'bankrupt') return '#111';
  if (seg.kind === 'pass') return '#f4f4fb';
  if (seg.kind === 'express') return '#ff2bd6';
  if (seg.token === 'jolly') return '#00e676';
  if (seg.token === 'premio') return '#ffab00';
  if (seg.token === 'jackpot') return '#b71c1c';
  return COLORS[i % COLORS.length];
}

export class WheelView {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private pointer: HTMLElement;
  private angle = 0;
  private raf = 0;

  constructor(wheel: Segment[]) {
    this.el = document.createElement('div');
    this.el.className = 'wheel';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.el.append(this.canvas);
    this.pointer = document.createElement('div');
    this.pointer.className = 'pointer';
    this.el.append(this.pointer);
    this.draw(wheel);
    // the canvas does not repaint by itself when the web fonts arrive
    document.fonts?.ready.then(() => this.draw(this.wheel));
  }

  setWheel(wheel: Segment[]) { this.draw(wheel); }

  private wheel: Segment[] = [];

  private draw(wheel: Segment[]) {
    this.wheel = wheel;
    const g = this.canvas.getContext('2d')!;
    const c = SIZE / 2;
    const R = c - 14;
    g.clearRect(0, 0, SIZE, SIZE);
    g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fillStyle = '#10123a'; g.fill();
    wheel.forEach((seg, i) => {
      // segment 0 starts at the top (pointer) and goes clockwise
      const a0 = (i * SEGMENT_ANGLE - 90) * Math.PI / 180;
      const a1 = ((i + 1) * SEGMENT_ANGLE - 90) * Math.PI / 180;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a1); g.closePath();
      const bg = segBg(seg, i);
      g.fillStyle = bg;
      g.fill();
      g.strokeStyle = '#0a0b2e'; g.lineWidth = 3; g.stroke();
      g.save();
      g.translate(c, c);
      g.rotate((a0 + a1) / 2);
      g.textAlign = 'right'; g.textBaseline = 'middle';
      const label = segmentLabel(seg);
      const isValue = seg.kind === 'value' && !seg.token;
      g.fillStyle = LIGHT.includes(bg) ? '#16124d' : isValue || bg === '#b71c1c' ? '#ffd91a' : '#fff';
      g.font = isValue ? '900 50px "Nunito", sans-serif' : '800 26px "Montserrat", sans-serif';
      g.shadowColor = LIGHT.includes(bg) ? 'transparent' : '#000a'; g.shadowOffsetY = 3; g.shadowBlur = 4;
      g.fillText(label, R - 26, 0);
      g.restore();
    });
    for (let i = 0; i < wheel.length; i++) {
      const a = (i * SEGMENT_ANGLE - 90) * Math.PI / 180;
      g.beginPath(); g.arc(c + Math.cos(a) * (R - 6), c + Math.sin(a) * (R - 6), 7, 0, Math.PI * 2);
      g.fillStyle = '#d8dcec'; g.fill();
    }
    g.beginPath(); g.arc(c, c, 70, 0, Math.PI * 2); g.fillStyle = '#16124d'; g.fill();
    g.lineWidth = 8; g.strokeStyle = '#ff2bd6'; g.stroke();
  }

  setAngle(a: number) {
    this.angle = a;
    this.canvas.style.transform = `rotate(${a}deg)`;
  }

  /** Animate from the current angle to `target` (clockwise, bigger). Resolves when it stops. */
  spinTo(target: number, durationMs: number): Promise<void> {
    cancelAnimationFrame(this.raf);
    const from = this.angle;
    const start = performance.now();
    let lastSeg = segmentAt(from);
    return new Promise((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const e = 1 - Math.pow(1 - t, 3.2);
        const a = from + (target - from) * e;
        this.setAngle(a);
        const seg = segmentAt(a);
        if (seg !== lastSeg) {
          lastSeg = seg;
          sfx.tick();
          // the pointer flicks as each peg passes
          this.pointer.animate([{ transform: 'rotate(-14deg)' }, { transform: 'rotate(0deg)' }], { duration: 90 });
        }
        if (t < 1) this.raf = requestAnimationFrame(step);
        else resolve();
      };
      this.raf = requestAnimationFrame(step);
    });
  }

  highlightLanded(on: boolean) { this.el.classList.toggle('landed', on); }
}
