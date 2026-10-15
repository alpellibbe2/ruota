// Messages between the screen (host) and the phones, plus the filtered view sent to phones.

import { maskRows } from '../core/board';
import type { GameState, Phase } from '../core/game';
import { canBuyVowel, currentPhrase, roundType } from '../core/game';
import { BoardKind } from '../core/finale';
import type { RoundType } from '../core/rounds';

export type Intent =
  | { k: 'spin'; power: number }
  | { k: 'call'; l: string }
  | { k: 'vowel'; l: string }
  | { k: 'solve'; text: string }
  | { k: 'express'; go: boolean }
  | { k: 'jolly'; use: boolean }
  | { k: 'book' }
  | { k: 'fstart' }
  | { k: 'fchoose'; i: number };

export type ConductorIntent =
  | { k: 'accept' }
  | { k: 'reject' }
  | { k: 'pass' }
  | { k: 'adjust'; player: number; delta: number }
  | { k: 'skip' }
  | { k: 'next'; type?: RoundType }
  | { k: 'addPhrase'; text: string; tema: string };

export type ToHost =
  | { t: 'join'; name: string; color: string; token: string; role?: 'conductor' }
  | { t: 'intent'; i: Intent }
  | { t: 'cintent'; i: ConductorIntent }
  | { t: 'ping' };

export interface LobbyPlayer { name: string; color: string; connected: boolean }

export interface PlayerView {
  you: number;
  phase: Phase | 'lobby';
  current: number;
  players: { name: string; color: string; round: number; total: number; connected: boolean; jolly: boolean; premio: boolean; jackpot: boolean }[];
  /** Board rows with hidden letters replaced by '_' — never contains the solution. */
  rows: string[];
  tema: string;
  round: number;
  rounds: number;
  called: string[];
  pending: number;
  message: string;
  canVowel: boolean;
  vowelCost: number;
  /** ms epoch when the current answer time runs out, or 0. */
  deadline: number;
  eventId: number;
  roundType: RoundType;
  express: boolean;
  jackpotPot: number;
  booked: number | null;
  excluded: number[];
  /** Board number inside the round (Triplete / Ultimo Round) and how many there are. */
  boardNo: number;
  boards: number;
  finale?: FinaleView;
  kids: boolean;
}

export interface FinaleView {
  stage: 'wheel' | 'spinning' | 'drawn' | 'board' | 'choose' | 'reveal';
  champion: number;
  kind: BoardKind;
  timeLeft: number;
  won: boolean[];
  /** Envelope numbers (1-24) drawn for each board; empty until the wheel has stopped. */
  envelopes: number[];
  consonantsLeft: number;
  vowelsLeft: number;
  boardIdx: number;
  boards: number;
  prize: number;
  chosen: number | null;
}

/** What the conductor sees: the player view plus the solution and any pending review. */
export interface ConductorView extends PlayerView {
  solution: string;
  review: { player: number; text: string } | null;
  /** Result of the last addPhrase, to show feedback. */
  note: string;
}

export type ToClient =
  | { t: 'welcome'; you: number }
  | { t: 'cwelcome' }
  | { t: 'cview'; v: ConductorView }
  | { t: 'lobby'; players: LobbyPlayer[]; you: number }
  | { t: 'view'; v: PlayerView }
  | { t: 'rejected'; reason: string }
  | { t: 'ping' };

/** Both sides send a ping this often; a link silent for STALE_MS is considered dead. */
export const PING_MS = 4000;
export const STALE_MS = 15000;

export function buildView(s: GameState, you: number, connected: boolean[], deadline = 0): PlayerView {
  const ph = currentPhrase(s);
  return {
    you,
    phase: s.phase,
    current: s.current,
    players: s.players.map((p, i) => ({ ...p, connected: connected[i] ?? true })),
    rows: maskRows(ph, new Set(s.finale ? s.finale.called : s.called), new Set(s.finale?.forced ?? [])),
    tema: ph.tema,
    round: s.round,
    rounds: s.rounds.length,
    called: s.finale ? s.finale.called : s.called,
    pending: s.pending,
    message: s.message,
    canVowel: canBuyVowel(s),
    vowelCost: s.config.vowelCost,
    deadline,
    eventId: s.event.id,
    roundType: roundType(s),
    express: s.express,
    jackpotPot: s.jackpotPot,
    booked: s.booked,
    excluded: s.excluded,
    boardNo: s.board - s.rounds[s.round].first,
    boards: s.rounds[s.round].count,
    kids: !!s.config.kids,
    finale: s.finale && {
      stage: s.finale.stage, champion: s.finale.champion, kind: s.finale.kinds[s.finale.boardIdx], timeLeft: s.finale.timeLeft,
      won: s.finale.won, envelopes: s.finale.stage === 'wheel' ? [] : s.finale.envelopes.map((e) => e + 1),
      consonantsLeft: s.finale.consonantsLeft, vowelsLeft: s.finale.vowelsLeft, boardIdx: s.finale.boardIdx, boards: s.finale.kinds.length,
      prize: s.finale.stage === 'reveal' ? s.finale.prize : 0, chosen: s.finale.chosen,
    },
  };
}

export function buildConductorView(
  s: GameState, connected: boolean[], deadline: number, review: ConductorView['review'], note = '',
): ConductorView {
  return { ...buildView(s, -1, connected, deadline), solution: currentPhrase(s).text, review, note };
}

export const ROOM_PREFIX = 'ruota-';
export const roomCode = (rnd: () => number = Math.random) =>
  Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(rnd() * 24)]).join('');

/**
 * Self-hosted network config, served as `rete.json` next to the page (written by deploy/installa.sh).
 * With it, signalling goes to the PeerJS server behind the same origin and the TURN server
 * on the same host relays traffic when phones cannot reach the screen directly.
 */
interface Rete { turn?: { username: string; credential: string; port?: number }; relay?: boolean }
let rete: Rete | null = null;

export async function loadRete(): Promise<void> {
  try {
    const r = await fetch(new URL('rete.json', location.href), { cache: 'no-store' });
    if (r.ok) rete = (await r.json()) as Rete;
  } catch { /* no config: public PeerJS server */ }
}

function iceConfig(host: string): Record<string, unknown> | undefined {
  if (!rete?.turn) return undefined;
  const { username, credential, port = 3478 } = rete.turn;
  return {
    iceServers: [
      { urls: `stun:${host}:${port}` },
      { urls: [`turn:${host}:${port}?transport=udp`, `turn:${host}:${port}?transport=tcp`], username, credential },
    ],
    // `relay: true` forces every connection through TURN (to check that the relay works)
    ...(rete.relay ? { iceTransportPolicy: 'relay' } : {}),
  };
}

/** Peer options: `?peer=host:port` selects a custom signalling server (used by tests); `rete.json` the home server. */
export function peerOptions(): Record<string, unknown> {
  const p = new URLSearchParams(location.search).get('peer');
  if (p) {
    const [host, port] = p.split(':');
    return { host, port: Number(port), path: '/', secure: false };
  }
  if (!rete) return {};
  const secure = location.protocol === 'https:';
  const config = iceConfig(location.hostname);
  return {
    host: location.hostname,
    port: Number(location.port) || (secure ? 443 : 80),
    path: '/',
    secure,
    ...(config ? { config } : {}),
  };
}
