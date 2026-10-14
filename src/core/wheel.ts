// Wheel definition (24 segments) and geometry.

export type Segment =
  | { kind: 'value'; value: number }
  | { kind: 'pass' }
  | { kind: 'bankrupt' };

export const SEGMENT_COUNT = 24;
export const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

const v = (value: number): Segment => ({ kind: 'value', value });

/** Default layout; clockwise from the pointer at angle 0. */
export const DEFAULT_WHEEL: Segment[] = [
  v(300), v(500), { kind: 'bankrupt' }, v(400), v(250), v(800),
  { kind: 'pass' }, v(350), v(600), v(200), v(1000), { kind: 'bankrupt' },
  v(450), v(300), v(700), { kind: 'pass' }, v(500), v(250),
  v(900), v(400), { kind: 'bankrupt' }, v(350), v(600), v(1500),
];

/** Segment index under the pointer (top) for a wheel rotated clockwise by `angle` degrees. */
export function segmentAt(angle: number): number {
  const phi = (((-angle) % 360) + 360) % 360;
  return Math.floor(phi / SEGMENT_ANGLE) % SEGMENT_COUNT;
}

/** Random final angle (total rotation in degrees) for a spin of the given power in [0,1]. */
export function spinAngle(current: number, power: number, rnd: number): number {
  const turns = 3 + Math.round(power * 4);
  return current + turns * 360 + rnd * 360;
}

export function segmentLabel(s: Segment): string {
  return s.kind === 'value' ? String(s.value) : s.kind === 'pass' ? 'PASSA' : 'BANCAROTTA';
}
