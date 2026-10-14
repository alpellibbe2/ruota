// The screen is the host: it owns the authoritative state and talks to phones over PeerJS.

import { PLAYER_COLORS } from '../core/game';
import Peer, { DataConnection } from 'peerjs';
import { LobbyPlayer, Intent, PlayerView, ROOM_PREFIX, ToClient, ToHost, peerOptions, roomCode } from './protocol';

interface Seat { token: string; name: string; color: string; conn: DataConnection | null }

export class Host {
  code = '';
  seats: Seat[] = [];
  /** Called when a seated player sends an intent. */
  onIntent: (seat: number, i: Intent) => void = () => {};
  onLobby: () => void = () => {};
  started = false;
  private peer: Peer | null = null;

  open(preferred?: string): Promise<string> {
    const tryOpen = (code: string, attempt: number): Promise<string> =>
      new Promise((resolve, reject) => {
        const peer = new Peer(ROOM_PREFIX + code, peerOptions());
        peer.on('open', () => {
          this.peer = peer;
          this.code = code;
          peer.on('connection', (c) => this.accept(c));
          resolve(code);
        });
        peer.on('error', (err: { type?: string }) => {
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

  private accept(conn: DataConnection) {
    conn.on('data', (raw) => {
      const m = raw as ToHost;
      if (m.t === 'join') this.join(conn, m);
      else if (m.t === 'intent') {
        const seat = this.seats.findIndex((s) => s.conn === conn);
        if (seat >= 0) this.onIntent(seat, m.i);
      }
    });
    conn.on('close', () => {
      const seat = this.seats.find((s) => s.conn === conn);
      if (seat) { seat.conn = null; this.onLobby(); }
    });
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
    if (conn.open) conn.send(m);
  }

  /** Restore seats from a saved session (phones will rejoin with their tokens). */
  restoreSeats(seats: { token: string; name: string; color: string }[]) {
    this.seats = seats.map((s) => ({ ...s, conn: null }));
  }

  close() {
    this.peer?.destroy();
  }
}
