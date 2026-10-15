// The screen is the host: it owns the authoritative state and talks to phones over PeerJS.

import { PLAYER_COLORS } from '../core/game';
import Peer, { DataConnection } from 'peerjs';
import { ConductorIntent, ConductorView, LobbyPlayer, Intent, PING_MS, PlayerView, ROOM_PREFIX, STALE_MS, ToClient, ToHost, peerOptions, roomCode } from './protocol';

interface Seat { token: string; name: string; color: string; conn: DataConnection | null }

export class Host {
  code = '';
  seats: Seat[] = [];
  /** Called when a seated player sends an intent. */
  onIntent: (seat: number, i: Intent) => void = () => {};
  onLobby: () => void = () => {};
  onConductor: (i: ConductorIntent) => void = () => {};
  /** The optional human conductor (a phone that sees the solution). */
  conductor: { token: string; conn: DataConnection | null } | null = null;
  started = false;
  private peer: Peer | null = null;
  private watch = 0;
  /** Last message received on each open connection. */
  private seen = new Map<DataConnection, number>();

  open(preferred?: string): Promise<string> {
    const tryOpen = (code: string, attempt: number): Promise<string> =>
      new Promise((resolve, reject) => {
        const peer = new Peer(ROOM_PREFIX + code, peerOptions());
        peer.on('open', () => {
          if (this.peer === peer) return; // back on the signalling server after a drop
          this.peer = peer;
          this.code = code;
          peer.on('connection', (c) => this.accept(c));
          this.startWatch();
          resolve(code);
        });
        peer.on('error', (err: { type?: string }) => {
          // Once the room is open, errors are about the signalling server (the PeerJS cloud drops its
          // websocket now and then): the phones' direct links still work, so never destroy the peer —
          // destroying it closed every phone at once. The watchdog re-registers the room.
          if (this.peer === peer) return;
          peer.destroy();
          if (err.type === 'unavailable-id' && attempt < 8) {
            // taken (or our own previous session still lingering): retry with a fresh code unless restoring
            const next = preferred && attempt < 3 ? preferred : roomCode();
            setTimeout(() => tryOpen(next, attempt + 1).then(resolve, reject), preferred && attempt < 3 ? 1500 : 0);
          } else reject(err);
        });
      });
    return tryOpen(preferred ?? roomCode(), 0);
  }

  /** Keep the room registered on the signalling server, ping the phones and drop silent links. */
  private startWatch() {
    clearInterval(this.watch);
    this.watch = window.setInterval(() => {
      const peer = this.peer;
      if (peer && peer.disconnected && !peer.destroyed) {
        try { peer.reconnect(); } catch { /* retry on the next tick */ }
      }
      const now = Date.now();
      const links = [...this.seats.map((x) => x.conn), this.conductor?.conn ?? null];
      for (const c of links) {
        if (!c) continue;
        if (now - (this.seen.get(c) ?? now) > STALE_MS) this.drop(c);
        else this.send(c, { t: 'ping' });
      }
    }, PING_MS);
  }

  private drop(conn: DataConnection) {
    this.seen.delete(conn);
    try { conn.close(); } catch { /* already closed */ }
    if (this.conductor?.conn === conn) { this.conductor.conn = null; this.onLobby(); return; }
    const seat = this.seats.find((s) => s.conn === conn);
    if (seat) { seat.conn = null; this.onLobby(); }
  }

  private accept(conn: DataConnection) {
    this.seen.set(conn, Date.now());
    conn.on('data', (raw) => {
      this.seen.set(conn, Date.now());
      const m = raw as ToHost;
      if (m.t === 'ping') return;
      if (m.t === 'join' && m.role === 'conductor') this.joinConductor(conn, m.token);
      else if (m.t === 'join') this.join(conn, m);
      else if (m.t === 'cintent') { if (this.conductor?.conn === conn) this.onConductor(m.i); }
      else if (m.t === 'intent') {
        const seat = this.seats.findIndex((s) => s.conn === conn);
        if (seat >= 0) this.onIntent(seat, m.i);
      }
    });
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
  }

  private joinConductor(conn: DataConnection, token: string) {
    if (this.conductor && this.conductor.token !== token && this.conductor.conn?.open) {
      this.send(conn, { t: 'rejected', reason: 'C\'è già un conduttore' });
      return;
    }
    this.conductor?.conn?.close();
    this.conductor = { token, conn };
    this.send(conn, { t: 'cwelcome' });
    this.onLobby();
  }

  hasConductor(): boolean {
    return !!this.conductor?.conn;
  }

  sendConductor(v: ConductorView) {
    const c = this.conductor?.conn;
    if (c) this.send(c, { t: 'cview', v });
  }

  private join(conn: DataConnection, m: Extract<ToHost, { t: 'join' }>) {
    const existing = this.seats.find((s) => s.token === m.token);
    if (existing) {
      existing.conn?.close();
      existing.conn = conn;
      if (!this.started) { existing.name = m.name || existing.name; existing.color = m.color || existing.color; }
    } else if (this.started) {
      this.send(conn, { t: 'rejected', reason: 'La partita è già iniziata' });
      return;
    } else if (this.seats.length >= 6) {
      this.send(conn, { t: 'rejected', reason: 'Stanza piena (massimo 6)' });
      return;
    } else {
      const taken = new Set(this.seats.map((x) => x.color));
      const color = taken.has(m.color) ? (PLAYER_COLORS.find((c) => !taken.has(c)) ?? m.color) : m.color;
      this.seats.push({ token: m.token, name: (m.name || 'Giocatore').slice(0, 14), color, conn });
    }
    const you = this.seats.findIndex((s) => s.conn === conn);
    this.send(conn, { t: 'welcome', you });
    this.onLobby();
  }

  lobbyPlayers(): LobbyPlayer[] {
    return this.seats.map((s) => ({ name: s.name, color: s.color, connected: !!s.conn }));
  }

  connected(): boolean[] {
    return this.seats.map((s) => !!s.conn);
  }

  broadcastLobby() {
    this.seats.forEach((s, i) => s.conn && this.send(s.conn, { t: 'lobby', players: this.lobbyPlayers(), you: i }));
  }

  broadcastView(viewFor: (seat: number) => PlayerView) {
    this.seats.forEach((s, i) => s.conn && this.send(s.conn, { t: 'view', v: viewFor(i) }));
  }

  private send(conn: DataConnection, m: ToClient) {
    try {
      if (conn.open) conn.send(m);
    } catch { /* channel closing: the watchdog will drop it */ }
  }

  /** Restore seats from a saved session (phones will rejoin with their tokens). */
  restoreSeats(seats: { token: string; name: string; color: string }[]) {
    this.seats = seats.map((s) => ({ ...s, conn: null }));
  }

  close() {
    clearInterval(this.watch);
    this.peer?.destroy();
  }

  /** Tell every phone the room is gone (so they stop reconnecting), then close it. */
  closeRoom(reason: string) {
    for (const c of [...this.seats.map((s) => s.conn), this.conductor?.conn ?? null]) if (c) this.send(c, { t: 'rejected', reason });
    this.onLobby = () => {};
    // give the messages a moment to leave before the links go down
    setTimeout(() => this.close(), 300);
  }
}
