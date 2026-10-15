// Phone side: connects to the screen's room and keeps reconnecting.

import Peer, { DataConnection } from 'peerjs';
import { ConductorIntent, Intent, PING_MS, ROOM_PREFIX, STALE_MS, ToClient, ToHost, peerOptions } from './protocol';

/** Give up on a connection attempt that has not opened by then, and try again. */
const CONNECT_MS = 12000;

export class Client {
  onMessage: (m: ToClient) => void = () => {};
  onStatus: (s: 'connecting' | 'connected' | 'lost') => void = () => {};
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private retry = 0;
  private attempts = 0;
  private watch = 0;
  private lastSeen = 0;
  private closed = false;
  /** Waiting for the next attempt after a loss. */
  private waiting = false;

  constructor(private code: string, private join: Extract<ToHost, { t: 'join' }>) {}

  start() {
    this.closed = false;
    this.connect();
    clearInterval(this.watch);
    this.watch = window.setInterval(() => this.check(), PING_MS);
    // Phones suspend background tabs: when the page comes back, reconnect at once if the link died.
    document.addEventListener('visibilitychange', this.onVisible);
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible' && !this.closed) this.check(STALE_MS / 2);
  };

  /** Ping the screen; reconnect when the link is closed, never opened, or silent for too long. */
  private check(stale = STALE_MS) {
    if (this.closed || this.waiting) return;
    const silent = Date.now() - this.lastSeen;
    if (this.conn?.open) {
      if (silent > stale) this.lost();
      else this.trySend({ t: 'ping' });
    } else if (silent > CONNECT_MS) this.lost();
  }

  private connect() {
    this.waiting = false;
    if (this.closed) return;
    this.onStatus('connecting');
    this.peer?.destroy();
    this.conn = null;
    this.lastSeen = Date.now();
    const peer = new Peer(peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      if (this.peer !== peer || this.conn) return; // reconnected to the signalling server only
      const conn = peer.connect(ROOM_PREFIX + this.code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => {
        if (this.conn !== conn) return;
        this.attempts = 0;
        this.lastSeen = Date.now();
        this.onStatus('connected');
        conn.send(this.join);
      });
      conn.on('data', (d) => {
        if (this.conn !== conn) return;
        this.lastSeen = Date.now();
        const m = d as ToClient;
        if (m.t !== 'ping') this.onMessage(m);
      });
      conn.on('close', () => { if (this.conn === conn) this.lost(); });
      conn.on('error', () => { if (this.conn === conn) this.lost(); });
    });
    // Signalling-server trouble does not touch an open link to the screen: only react when there is none.
    peer.on('error', () => { if (this.peer === peer && !this.conn?.open) this.lost(); });
    peer.on('disconnected', () => { if (this.peer === peer && !this.conn?.open) this.lost(); });
  }

  private lost() {
    if (this.closed) return;
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
    this.waiting = true;
    this.onStatus('lost');
    clearTimeout(this.retry);
    // 1 s, 2 s, 4 s… up to 8 s, so a screen that is gone does not flood the signalling server
    const delay = Math.min(8000, 1000 * 2 ** this.attempts++);
    this.retry = window.setTimeout(() => this.connect(), delay);
  }

  private trySend(m: ToHost) {
    try {
      if (this.conn?.open) this.conn.send(m);
    } catch { /* channel closing: the watchdog reconnects */ }
  }

  send(i: Intent) {
    this.trySend({ t: 'intent', i });
  }

  send2(i: ConductorIntent) {
    this.trySend({ t: 'cintent', i });
  }

  stop() {
    this.closed = true;
    clearTimeout(this.retry);
    clearInterval(this.watch);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.peer?.destroy();
  }
}
