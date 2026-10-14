import { Segment, segmentAt, segmentLabel, SEGMENT_ANGLE } from '../core/wheel';
import { sfx } from './audio';

const COLORS = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60'];
const SIZE = 800;

export class WheelView {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private angle = 0;
  private raf = 0;

  constructor(wheel: Segment[]) {
    this.el = document.createElement('div');
    this.el.className = 'wheel';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.el.append(this.canvas);
    const pointer = document.createElement('div');
    pointer.className = 'pointer';
    this.el.append(pointer);
    this.draw(wheel);
  }

  private draw(wheel: Segment[]) {
    const g = this.canvas.getContext('2d')!;
    const c = SIZE / 2;
    const R = c - 14;
    g.clearRect(0, 0, SIZE, SIZE);
    g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fillStyle = '#f5c518'; g.fill();
    wheel.forEach((seg, i) => {
      // segment 0 starts at the top (pointer) and goes clockwise
      const a0 = (i * SEGMENT_ANGLE - 90) * Math.PI / 180;
      const a1 = ((i + 1) * SEGMENT_ANGLE - 90) * Math.PI / 180;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a1); g.closePath();
      g.fillStyle = seg.kind === 'bankrupt' ? '#111' : seg.kind === 'pass' ? '#f5f5f5' : COLORS[i % COLORS.length];
      g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      g.save();
      g.translate(c, c);
      g.rotate((a0 + a1) / 2);
      g.textAlign = 'right'; g.textBaseline = 'middle';
      const label = segmentLabel(seg);
      g.fillStyle = seg.kind === 'bankrupt' ? '#fff' : seg.kind === 'pass' ? '#222' : (i % COLORS.length === 1 ? '#222' : '#fff');
      g.font = seg.kind === 'value' ? '800 46px "Baloo 2", sans-serif' : '800 30px "Baloo 2", sans-serif';
      g.fillText(label, R - 26, 0);
      g.restore();
    });
    for (let i = 0; i < wheel.length; i++) {
      const a = (i * SEGMENT_ANGLE - 90) * Math.PI / 180;
      g.beginPath(); g.arc(c + Math.cos(a) * (R - 6), c + Math.sin(a) * (R - 6), 7, 0, Math.PI * 2);
      g.fillStyle = '#fff'; g.fill();
    }
    g.beginPath(); g.arc(c, c, 70, 0, Math.PI * 2); g.fillStyle = '#1a237e'; g.fill();
    g.lineWidth = 8; g.strokeStyle = '#f5c518'; g.stroke();
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
        if (seg !== lastSeg) { lastSeg = seg; sfx.tick(); }
        if (t < 1) this.raf = requestAnimationFrame(step);
        else resolve();
      };
      this.raf = requestAnimationFrame(step);
    });
  }

  highlightLanded(on: boolean) { this.el.classList.toggle('landed', on); }
}
