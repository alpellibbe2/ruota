// Messages between the screen (host) and the phones, plus the filtered view sent to phones.

import type { GameState, Phase } from '../core/game';
import { canBuyVowel, currentPhrase } from '../core/game';
import { baseLetter, isLetter, layoutBoard } from '../core/phrase';

export type Intent =
  | { k: 'spin'; power: number }
  | { k: 'call'; l: string }
  | { k: 'vowel'; l: string }
  | { k: 'solve'; text: string };

export type ToHost =
  | { t: 'join'; name: string; color: string; token: string }
  | { t: 'intent'; i: Intent };

export interface LobbyPlayer { name: string; color: string; connected: boolean }

export interface PlayerView {
  you: number;
  phase: Phase | 'lobby';
  current: number;
  players: { name: string; color: string; round: number; total: number; connected: boolean }[];
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
}

export type ToClient =
  | { t: 'welcome'; you: number }
  | { t: 'lobby'; players: LobbyPlayer[]; you: number }
  | { t: 'view'; v: PlayerView }
  | { t: 'rejected'; reason: string };

/** Mask the board: hidden letters become '_' (blank cells stay spaces). */
export function maskedRows(text: string, called: Set<string>): string[] {
  const rows = layoutBoard(text) ?? [];
  return rows.map((r) => [...r].map((ch) => (isLetter(ch) && !called.has(baseLetter(ch)) ? '_' : ch)).join(''));
}

export function buildView(s: GameState, you: number, connected: boolean[], deadline = 0): PlayerView {
  const ph = currentPhrase(s);
  return {
    you,
    phase: s.phase,
    current: s.current,
    players: s.players.map((p, i) => ({ ...p, connected: connected[i] ?? true })),
    rows: maskedRows(ph.text, new Set(s.called)),
    tema: ph.tema,
    round: s.round,
    rounds: s.phrases.length,
    called: s.called,
    pending: s.pending,
    message: s.message,
    canVowel: canBuyVowel(s),
    vowelCost: s.config.vowelCost,
    deadline,
    eventId: s.event.id,
  };
}

export const ROOM_PREFIX = 'ruota-';
export const roomCode = (rnd: () => number = Math.random) =>
  Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(rnd() * 24)]).join('');

/** Peer options: `?peer=host:port` selects a custom signalling server (used by tests). */
export function peerOptions(): Record<string, unknown> {
  const p = new URLSearchParams(location.search).get('peer');
  if (!p) return {};
  const [host, port] = p.split(':');
  return { host, port: Number(port), path: '/', secure: false };
}
