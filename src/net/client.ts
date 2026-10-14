// Phone side: connects to the screen's room and keeps reconnecting.

import Peer, { DataConnection } from 'peerjs';
import { Intent, ROOM_PREFIX, ToClient, ToHost, peerOptions } from './protocol';

export class Client {
  onMessage: (m: ToClient) => void = () => {};
  onStatus: (s: 'connecting' | 'connected' | 'lost') => void = () => {};
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private retry = 0;
  private closed = false;

  constructor(private code: string, private join: Extract<ToHost, { t: 'join' }>) {}

  start() {
    this.closed = false;
    this.connect();
  }

  private connect() {
    if (this.closed) return;
    this.onStatus('connecting');
    this.peer?.destroy();
    const peer = new Peer(peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(ROOM_PREFIX + this.code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => {
        this.onStatus('connected');
        conn.send(this.join);
      });
      conn.on('data', (d) => this.onMessage(d as ToClient));
      conn.on('close', () => this.lost());
      conn.on('error', () => this.lost());
    });
    peer.on('error', () => this.lost());
    peer.on('disconnected', () => { if (!this.conn?.open) this.lost(); });
  }

  private lost() {
    if (this.closed) return;
    this.onStatus('lost');
    clearTimeout(this.retry);
    this.retry = window.setTimeout(() => this.connect(), 2000);
  }

  send(i: Intent) {
    if (this.conn?.open) this.conn.send({ t: 'intent', i } satisfies ToHost);
  }

  /** Update the profile used on the next (re)join. */
  stop() {
    this.closed = true;
    clearTimeout(this.retry);
    this.peer?.destroy();
  }
}
