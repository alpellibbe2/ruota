// Keep the device awake while playing: a phone that locks its screen suspends the page and drops the link.

type Sentinel = { released: boolean; release(): Promise<void> };
let lock: Sentinel | null = null;

async function request() {
  const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<Sentinel> } }).wakeLock;
  if (!wl || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
  try { lock = await wl.request('screen'); } catch { /* not allowed (no gesture yet, low battery…) */ }
}

export function keepAwake() {
  void request();
  // the lock is released whenever the page is hidden, and some browsers want a user gesture
  document.addEventListener('visibilitychange', () => void request());
  document.addEventListener('pointerdown', () => void request());
}
