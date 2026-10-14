// All sounds are synthesized with the Web Audio API (no samples).

let ctx: AudioContext | null = null;
let muted = false;
let volume = 0.6;

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

export const setMuted = (m: boolean) => { muted = m; };
export const isMuted = () => muted;
export const setVolume = (v: number) => { volume = v; };

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, endFreq?: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(gain * volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.2, freq = 2000) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain * volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export const sfx = {
  tick: () => tone(1400, 0, 0.03, 'square', 0.08),
  ding: (i = 0) => { tone(880 + i * 40, i * 0.28, 0.5, 'sine', 0.35); tone(1760 + i * 80, i * 0.28, 0.3, 'sine', 0.12); },
  buzzer: () => { tone(150, 0, 0.6, 'sawtooth', 0.3); tone(158, 0, 0.6, 'sawtooth', 0.3); },
  pass: () => { tone(440, 0, 0.2, 'triangle', 0.3); tone(330, 0.2, 0.3, 'triangle', 0.3); },
  bankrupt: () => { [600, 500, 400, 300, 200, 120].forEach((f, i) => tone(f, i * 0.15, 0.3, 'sawtooth', 0.28)); },
  vowel: () => { tone(660, 0, 0.25, 'triangle', 0.3); },
  fanfare: () => { [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.25, 'square', 0.15)); },
  book: () => { tone(988, 0, 0.12, 'square', 0.2); tone(1319, 0.1, 0.2, 'square', 0.2); },
  spin: () => noise(0, 0.4, 0.15, 800),
  applause: () => { for (let i = 0; i < 40; i++) noise(i * 0.05, 0.08, 0.12, 1500 + Math.random() * 3000); },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.16, 0.4, 'triangle', 0.3));
    tone(1046, 0.7, 0.8, 'triangle', 0.3);
    sfx.applause();
  },
};
