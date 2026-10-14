// Phone controller view (portrait). Receives a filtered PlayerView; never sees the solution.

import { PLAYER_COLORS } from '../core/game';
import { CONSONANTS, VOWELS } from '../core/phrase';
import { Client } from '../net/client';
import { PlayerView, ToClient } from '../net/protocol';

const PROFILE_KEY = 'ruota.profilo';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

interface Profile { name: string; color: string; token: string }

function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (p?.token) return p;
  } catch { /* ignore */ }
  return { name: '', color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)], token: Math.random().toString(36).slice(2) + Date.now().toString(36) };
}

export function startPhone(body: HTMLElement, code: string) {
  document.getElementById('stage')?.remove();
  document.body.classList.add('phone-body');
  const root = h('div', 'phone');
  root.id = 'phone';
  body.append(root);
  const profile = loadProfile();
  const saved = localStorage.getItem(PROFILE_KEY);
  const tokenKey = `${PROFILE_KEY}.${code}`;
  // the token identifies the seat in this room; reuse it after a reload
  const roomToken = localStorage.getItem(tokenKey);
  if (roomToken) profile.token = roomToken;
  void saved;

  const joinForm = () => {
    root.textContent = '';
    root.append(h('h1', 'plogo', 'LA RUOTA'), h('p', 'psub', `Stanza ${code}`));
    const inp = h('input', 'pname-in'); inp.placeholder = 'Il tuo nome'; inp.maxLength = 14; inp.value = profile.name; inp.dataset.testid = 'join-name';
    const colors = h('div', 'pcolors');
    PLAYER_COLORS.forEach((c) => {
      const b = h('button', 'pcolor' + (c === profile.color ? ' on' : ''));
      b.style.background = c;
      b.onclick = () => { profile.color = c; colors.querySelectorAll('.pcolor').forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
      colors.append(b);
    });
    const go = h('button', 'pbig', 'ENTRA'); go.dataset.testid = 'join-go';
    go.onclick = () => {
      profile.name = inp.value.trim() || 'Giocatore';
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(tokenKey, profile.token);
      connect();
    };
    root.append(inp, colors, go);
  };

  let client: Client | null = null;
  let view: PlayerView | null = null;
  let status = 'connecting';
  let mode: 'menu' | 'vowel' | 'solve' = 'menu';
  let lastCurrent = -1;
  let lastEvent = 0;
  let tick = 0;

  function connect() {
    root.textContent = '';
    root.append(h('p', 'pstatus', 'Collegamento…'));
    client = new Client(code, { t: 'join', name: profile.name, color: profile.color, token: profile.token });
    client.onStatus = (s) => { status = s; if (view) render(); else if (s === 'lost') root.textContent = 'Connessione persa, riprovo…'; };
    client.onMessage = (m: ToClient) => {
      if (m.t === 'rejected') {
        client?.stop();
        root.textContent = '';
        root.append(h('h1', 'plogo', 'LA RUOTA'), h('p', 'psub', m.reason));
      } else if (m.t === 'lobby') {
        view = null;
        root.textContent = '';
        root.append(h('h1', 'plogo', 'LA RUOTA'), h('p', 'psub', 'Sei dentro! Aspetta che si inizi…'));
        const me = m.players[m.you];
        const chip = h('div', 'pchip', me?.name ?? '');
        chip.style.background = me?.color ?? '#999';
        chip.dataset.testid = 'lobby-me';
        root.append(chip, h('p', 'psub', `${m.players.length} giocatori collegati`));
      } else if (m.t === 'view') {
        if (m.v.current !== lastCurrent || m.v.phase !== 'turn') mode = 'menu';
        if (m.v.current === m.v.you && lastCurrent !== m.v.you) navigator.vibrate?.(200);
        if (m.v.eventId !== lastEvent && m.v.message.includes('Bancarotta')) navigator.vibrate?.([100, 60, 300]);
        lastCurrent = m.v.current;
        lastEvent = m.v.eventId;
        view = m.v;
        render();
      }
    };
    client.start();
  }

  function render() {
    const v = view!;
    root.textContent = '';
    const me = v.players[v.you];
    const mine = v.current === v.you;
    const top = h('div', 'ptop');
    top.style.background = me.color;
    top.append(h('b', '', me.name), h('span', 'pmoney', `${me.round}`), h('small', '', `tot. ${me.total}`));
    root.append(top);
    if (status === 'lost') root.append(h('div', 'pwarn', 'Connessione persa… riconnessione'));

    const board = h('div', 'pboard');
    board.dataset.testid = 'pboard';
    board.append(h('div', 'ptema', v.tema));
    for (const row of v.rows) {
      if (!row.trim()) continue;
      const r = h('div', 'prow');
      for (const ch of row) r.append(h('span', 'ptile' + (ch === ' ' ? ' blank' : ch === '_' ? ' cov' : ''), ch === '_' || ch === ' ' ? '' : ch));
      board.append(r);
    }
    root.append(board);

    const turnName = v.players[v.current].name;
    root.append(h('div', 'pmsg', v.message || (mine ? 'Tocca a te!' : `Tocca a ${turnName}`)));
    const timer = h('div', 'ptimer');
    timer.dataset.testid = 'ptimer';
    root.append(timer);
    clearInterval(tick);
    const upd = () => {
      const left = v.deadline ? Math.max(0, Math.ceil((v.deadline - Date.now()) / 1000)) : 0;
      timer.textContent = mine && v.deadline ? `⏱ ${left}s` : '';
    };
    upd();
    tick = window.setInterval(upd, 500);

    const ctrl = h('div', 'pctrl');
    root.append(ctrl);
    const called = new Set(v.called);
    const kb = (letters: string, f: (l: string) => void) => {
      const k = h('div', 'pkb');
      for (const l of letters) {
        const b = h('button', 'pkey', l); b.disabled = called.has(l); b.dataset.testid = `pkey-${l}`;
        b.onclick = () => f(l);
        k.append(b);
      }
      return k;
    };

    if (v.phase === 'gameEnd') {
      ctrl.append(h('div', 'pbigmsg', 'Partita finita!'));
    } else if (v.phase === 'roundEnd') {
      ctrl.append(h('div', 'pbigmsg', 'Frase risolta! Guarda lo schermo'));
    } else if (!mine) {
      ctrl.append(h('div', 'pbigmsg', v.phase === 'spinning' ? 'La ruota gira…' : `Tocca a ${turnName}`));
    } else if (v.phase === 'spinning') {
      ctrl.append(h('div', 'pbigmsg', 'La ruota gira…'));
    } else if (v.phase === 'consonant') {
      ctrl.append(h('div', 'phint', `Scegli una consonante (${v.pending})`), kb(CONSONANTS, (l) => client?.send({ k: 'call', l })));
    } else if (mode === 'menu') {
      const pad = h('div', 'pswipe', 'SWIPE PER GIRARE');
      pad.dataset.testid = 'swipe';
      let start: { y: number; t: number } | null = null;
      pad.onpointerdown = (e) => { start = { y: e.clientY, t: performance.now() }; pad.setPointerCapture(e.pointerId); };
      pad.onpointerup = (e) => {
        if (!start) return;
        const dist = Math.abs(e.clientY - start.y);
        const speed = dist / Math.max(60, performance.now() - start.t);
        start = null;
        if (dist > 20) client?.send({ k: 'spin', power: Math.min(1, speed / 2) });
      };
      const tap = h('button', 'pbtn', 'GIRA'); tap.dataset.testid = 'pspin';
      tap.onclick = () => client?.send({ k: 'spin', power: 0.3 + Math.random() * 0.7 });
      const vow = h('button', 'pbtn', `VOCALE (${v.vowelCost})`); vow.disabled = !v.canVowel; vow.dataset.testid = 'pvowel';
      vow.onclick = () => { mode = 'vowel'; render(); };
      const sol = h('button', 'pbtn', 'RISOLVI'); sol.dataset.testid = 'psolve';
      sol.onclick = () => { mode = 'solve'; render(); };
      const row = h('div', 'prowbtn'); row.append(vow, sol);
      ctrl.append(pad, tap, row);
    } else if (mode === 'vowel') {
      const back = h('button', 'pbtn small', 'Indietro'); back.onclick = () => { mode = 'menu'; render(); };
      ctrl.append(h('div', 'phint', 'Scegli una vocale'), kb(VOWELS, (l) => client?.send({ k: 'vowel', l })), back);
    } else {
      const inp = h('input', 'psolve-in'); inp.placeholder = 'Scrivi la frase'; inp.dataset.testid = 'psolve-input';
      inp.autocapitalize = 'characters';
      const ok = h('button', 'pbtn', 'CONFERMA'); ok.dataset.testid = 'psolve-ok';
      ok.onclick = () => client?.send({ k: 'solve', text: inp.value });
      inp.onkeydown = (e) => { if (e.key === 'Enter') ok.click(); };
      const back = h('button', 'pbtn small', 'Annulla'); back.onclick = () => { mode = 'menu'; render(); };
      ctrl.append(inp, ok, back);
      setTimeout(() => inp.focus(), 0);
    }
  }

  joinForm();
  // Returning player: rejoin automatically with the saved name.
  if (roomToken && profile.name) connect();
}
