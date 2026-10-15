// Phone controller view (portrait). Receives a filtered PlayerView; never sees the solution.

import { PLAYER_COLORS } from '../core/game';
import { CONSONANTS, VOWELS } from '../core/phrase';
import { ROUND_NAMES, RoundType } from '../core/rounds';
import { Client } from '../net/client';
import { ConductorView, PlayerView, ToClient } from '../net/protocol';
import { keepAwake } from './wakelock';

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
    const cond = h('button', 'plink', 'Sono il conduttore'); cond.dataset.testid = 'join-cond';
    cond.onclick = () => { asConductor = true; localStorage.setItem(tokenKey + '.c', '1'); connect(); };
    root.append(inp, colors, go, cond);
  };
  let asConductor = localStorage.getItem(tokenKey + '.c') === '1';
  let cview: ConductorView | null = null;
  let note = '';

  let client: Client | null = null;
  let view: PlayerView | null = null;
  let status = 'connecting';
  let mode: 'menu' | 'vowel' | 'solve' | 'cons' = 'menu';
  let lastCurrent = -1;
  let lastEvent = 0;
  let tick = 0;
  let fmode: 'cons' | 'vowel' | 'solve' = 'cons';
  let draft = '';

  function connect() {
    keepAwake();
    root.textContent = '';
    root.append(h('p', 'pstatus', 'Collegamento…'));
    client = new Client(code, { t: 'join', name: profile.name, color: profile.color, token: profile.token, ...(asConductor ? { role: 'conductor' as const } : {}) });
    client.onStatus = (s) => { status = s; if (cview) renderConductor(); else if (view) render(); else if (s === 'lost') root.textContent = 'Connessione persa, riprovo…'; };
    client.onMessage = (m: ToClient) => {
      if (m.t === 'rejected') {
        client?.stop();
        root.textContent = '';
        root.append(h('h1', 'plogo', 'LA RUOTA'), h('p', 'psub', m.reason));
      } else if (m.t === 'cwelcome') {
        root.textContent = '';
        root.append(h('h1', 'plogo', 'CONDUTTORE'), h('p', 'psub', 'Collegato. Aspetta che inizi la partita…'));
      } else if (m.t === 'cview') {
        cview = m.v;
        renderConductor();
      } else if (m.t === 'lobby') {
        view = null;
        root.textContent = '';
        root.append(h('h1', 'plogo', 'LA RUOTA'), h('p', 'psub', 'Sei dentro! Aspetta che si inizi…'));
        const me = m.players[m.you];
        const chip = h('div', 'pchip', me?.name ?? '');
        chip.style.background = me?.color ?? '#999';
        chip.dataset.testid = 'lobby-me';
        const on = m.players.filter((p) => p.connected).length;
        root.append(chip, h('p', 'psub', on < 2 ? `${on} giocatore collegato: per iniziare ne servono almeno 2` : `${on} giocatori collegati`));
      } else if (m.t === 'view') {
        if (m.v.current !== lastCurrent || m.v.phase !== 'turn') mode = 'menu';
        if (m.v.current !== lastCurrent || m.v.round !== view?.round || m.v.boardNo !== view?.boardNo) draft = '';
        if (m.v.current === m.v.you && lastCurrent !== m.v.you) navigator.vibrate?.(200);
        if (m.v.eventId !== lastEvent && m.v.message.includes('Bancarotta')) navigator.vibrate?.([100, 60, 300]);
        if (m.v.finale?.stage === 'board') m.v.deadline = Date.now() + m.v.finale.timeLeft;
        lastCurrent = m.v.current;
        lastEvent = m.v.eventId;
        view = m.v;
        render();
      }
    };
    client.start();
  }

  function renderConductor() {
    const v = cview!;
    root.textContent = '';
    root.append(h('div', 'ctop', 'CONDUTTORE · ' + v.tema));
    if (status === 'lost') root.append(h('div', 'pwarn', 'Connessione persa… riconnessione'));
    const sol = h('div', 'csol', v.solution); sol.dataset.testid = 'csolution';
    root.append(sol);
    const cur = v.players[v.current];
    root.append(h('div', 'pmsg', v.phase === 'roundEnd' ? 'Frase risolta' : v.phase === 'gameEnd' ? 'Partita finita' : `Turno: ${cur.name} ${v.message ? '· ' + v.message : ''}`));
    const send = (i: import('../net/protocol').ConductorIntent) => client?.send2(i);
    if (v.review) {
      const box = h('div', 'creview');
      box.dataset.testid = 'creview';
      box.append(h('div', '', `${v.players[v.review.player].name} ha scritto:`), h('b', '', `«${v.review.text}»`));
      const row = h('div', 'prowbtn');
      const ok = h('button', 'pbtn', 'ACCETTA'); ok.dataset.testid = 'c-accept'; ok.onclick = () => send({ k: 'accept' });
      const no = h('button', 'pbtn', 'RIFIUTA'); no.dataset.testid = 'c-reject'; no.onclick = () => send({ k: 'reject' });
      row.append(ok, no);
      box.append(row);
      root.append(box);
    }
    const acts = h('div', 'prowbtn wrap');
    const mk = (label: string, tid: string, i: import('../net/protocol').ConductorIntent, dis = false) => {
      const b = h('button', 'pbtn small', label); b.dataset.testid = tid; b.disabled = dis; b.onclick = () => send(i); acts.append(b);
    };
    const live = v.phase === 'turn' || v.phase === 'consonant' || v.phase === 'booked' || (v.phase === 'finale' && v.finale?.stage === 'board');
    const passable = live || v.phase === 'expressOffer' || v.phase === 'jolly';
    mk('Accetta risposta a voce', 'c-voice', { k: 'accept' }, !live);
    mk('Passa turno', 'c-pass', { k: 'pass' }, !passable || v.phase === 'finale');
    mk('Salta frase', 'c-skip', { k: 'skip' }, !passable);
    root.append(acts);
    if (passable && v.phase !== 'finale') root.append(h('div', 'phint', 'Il tempo lo decidi tu: quando è scaduto premi «Passa turno»'));
    const nextRow = h('div', 'prowbtn');
    const sel = h('select', 'psel'); sel.dataset.testid = 'c-next-type';
    const auto = h('option', '', 'Manche: automatica'); auto.value = ''; sel.append(auto);
    for (const [k, n] of Object.entries(ROUND_NAMES)) { const o = h('option', '', n); o.value = k; sel.append(o); }
    const nb = h('button', 'pbtn small', 'Prossima manche'); nb.dataset.testid = 'c-next'; nb.disabled = v.phase !== 'roundEnd';
    nb.onclick = () => send(sel.value ? { k: 'next', type: sel.value as RoundType } : { k: 'next' });
    nextRow.append(sel, nb);
    root.append(nextRow);
    if (v.phase !== 'roundEnd') root.append(h('div', 'phint', '«Prossima manche» si attiva quando la frase è risolta'));
    const sc = h('div', 'cscores');
    v.players.forEach((p, i) => {
      const r = h('div', 'crow');
      r.style.borderLeftColor = p.color;
      r.append(h('span', 'cn', `${p.name}${i === v.current ? ' ▶' : ''}`), h('b', '', `${p.round} (tot. ${p.total})`));
      const minus = h('button', 'pbtn small', '−100'); minus.onclick = () => send({ k: 'adjust', player: i, delta: -100 });
      const plus = h('button', 'pbtn small', '+100'); plus.onclick = () => send({ k: 'adjust', player: i, delta: 100 });
      r.append(minus, plus);
      sc.append(r);
    });
    root.append(sc);
    const add = h('div', 'cadd');
    const t = h('input', 'psolve-in'); t.placeholder = 'Nuova frase per le prossime partite'; t.dataset.testid = 'c-phrase';
    const tm = h('input', 'psolve-in'); tm.placeholder = 'Tema'; tm.dataset.testid = 'c-tema';
    const b = h('button', 'pbtn small', 'Salva frase'); b.dataset.testid = 'c-save';
    b.onclick = () => { note = ''; send({ k: 'addPhrase', text: t.value, tema: tm.value }); };
    add.append(t, tm, b, h('div', 'pmsg', v.note));
    root.append(add);
  }

  function render() {
    const v = view!;
    root.textContent = '';
    root.classList.toggle('kids', v.kids);
    const me = v.players[v.you];
    const mine = v.current === v.you;
    const top = h('div', 'ptop');
    top.style.background = me.color;
    const tok = (me.jolly ? '🃏' : '') + (me.premio ? '🎁' : '') + (me.jackpot ? '💰' : '') + (v.express && mine ? '⚡' : '');
    top.append(h('b', '', me.name + (tok ? ' ' + tok : '')), h('span', 'pmoney', `${me.round}`), h('small', '', `tot. ${me.total}`));
    root.append(top);
    if (status === 'lost') root.append(h('div', 'pwarn', 'Connessione persa… riconnessione'));

    const board = h('div', 'pboard');
    board.dataset.testid = 'pboard';
    board.append(h('div', 'ptema', `${v.tema}${v.boards > 1 ? ` · ${v.boardNo + 1}/${v.boards}` : ''}`));
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
      timer.textContent = v.deadline && (mine || v.phase === 'finale') ? `⏱ ${left}s` : '';
    };
    upd();
    tick = window.setInterval(upd, 500);

    const ctrl = h('div', 'pctrl');
    root.append(ctrl);
    const called = new Set(v.called);
    // called consonants are not shown (calling one again is a mistake); vowels already bought are
    const kb = (letters: string, f: (l: string) => void, hide = called) => {
      const k = h('div', 'pkb');
      for (const l of letters) {
        const b = h('button', 'pkey', l); b.disabled = hide.has(l); b.dataset.testid = `pkey-${l}`;
        b.onclick = () => f(l);
        k.append(b);
      }
      return k;
    };

    const solveForm = () => {
      const inp = h('input', 'psolve-in'); inp.placeholder = v.roundType === 'cruciruota' ? 'Scrivi tutte le parole' : 'Scrivi la frase'; inp.dataset.testid = 'psolve-input';
      inp.autocapitalize = 'characters';
      // the view is rebuilt on every update (someone reconnecting, a letter…): keep what was typed
      inp.value = draft;
      inp.oninput = () => { draft = inp.value; };
      const ok = h('button', 'pbtn', 'CONFERMA'); ok.dataset.testid = 'psolve-ok';
      ok.onclick = () => { client?.send({ k: 'solve', text: inp.value }); draft = ''; };
      inp.onkeydown = (e) => { if (e.key === 'Enter') ok.click(); };
      ctrl.append(inp, ok);
      setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
    };
    const back = () => { const b = h('button', 'pbtn small', 'Indietro'); b.onclick = () => { mode = 'menu'; render(); }; return b; };

    if (v.phase === 'finale' && v.finale) {
      const f = v.finale;
      const champ = v.players[f.champion];
      if (v.you !== f.champion) {
        ctrl.append(h('div', 'pbigmsg', f.stage === 'reveal' ? 'Guarda lo schermo!' : `Tifa per ${champ.name}!`));
      } else if (f.stage === 'wheel') {
        const pad = h('div', 'pswipe', 'SWIPE: RUOTA DELLE MERAVIGLIE'); pad.dataset.testid = 'swipe';
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
        ctrl.append(h('div', 'phint', 'Sei il campione! Estrai le tue buste'), pad, tap);
      } else if (f.stage === 'spinning') {
        ctrl.append(h('div', 'pbigmsg', 'La ruota gira…'));
      } else if (f.stage === 'drawn' || f.stage === 'pause') {
        const secs = Math.ceil(f.timeLeft / 1000);
        const go = h('button', 'pbook', 'PRONTO'); go.dataset.testid = 'pfstart';
        go.onclick = () => client?.send({ k: 'fstart' });
        ctrl.append(h('div', 'phint', f.stage === 'drawn' ? `Buste ${f.envelopes.join(', ')} · ${secs} secondi in tutto` : `Restano ${secs} secondi per il prossimo tabellone`),
          h('div', 'phint', 'Il tempo parte solo al VIA, dopo la scelta delle lettere'), go);
      } else if (f.stage === 'letters') {
        ctrl.append(h('div', 'phint', `Tempo fermo: ${Math.ceil(f.timeLeft / 1000)} secondi`));
        const tabs = h('div', 'prowbtn');
        (['cons', 'vowel'] as const).forEach((m) => {
          const b = h('button', 'pbtn small' + (fmode === m ? ' on' : ''), m === 'cons' ? `Consonanti ${f.consonantsLeft > 50 ? '∞' : f.consonantsLeft}` : `Vocali ${f.vowelsLeft}`);
          b.dataset.testid = `pftab-${m}`;
          b.onclick = () => { fmode = m; render(); };
          tabs.append(b);
        });
        ctrl.append(tabs);
        const taken = new Set([...v.called, ...f.picked]);
        if (fmode !== 'vowel') ctrl.append(kb(CONSONANTS, (l) => client?.send({ k: 'call', l }), new Set([...taken, ...(f.consonantsLeft <= 0 ? CONSONANTS : '')])));
        else ctrl.append(kb(VOWELS, (l) => client?.send({ k: 'vowel', l }), new Set([...taken, ...(f.vowelsLeft <= 0 ? VOWELS : '')])));
        const go = h('button', 'pbook go', 'VIA!'); go.dataset.testid = 'pfgo';
        go.disabled = !f.canGo;
        go.onclick = () => client?.send({ k: 'fgo' });
        ctrl.append(go);
      } else if (f.stage === 'board') {
        solveForm();
        const stop = h('button', 'pbtn', 'STOP · vedi la soluzione'); stop.dataset.testid = 'pfstop';
        stop.onclick = () => client?.send({ k: 'fstop' });
        ctrl.append(stop, h('div', 'phint', 'Fermarti non vince il tabellone, ma salvi i secondi per i prossimi'));
      } else if (f.stage === 'choose') {
        ctrl.append(h('div', 'phint', 'Scegli la tua busta!'));
        f.won.forEach((w, i) => {
          const b = h('button', 'pbtn', `BUSTA ${f.envelopes[i]}`); b.disabled = !w; b.dataset.testid = `pchoose-${i}`;
          b.onclick = () => client?.send({ k: 'fchoose', i });
          ctrl.append(b);
        });
      } else {
        ctrl.append(h('div', 'pbigmsg', f.prize ? `Hai vinto ${f.prize} punti!` : 'Guarda lo schermo'));
      }
    } else if (v.phase === 'gameEnd') {
      ctrl.append(h('div', 'pbigmsg', 'Partita finita!'));
    } else if (v.phase === 'roundEnd') {
      ctrl.append(h('div', 'pbigmsg', 'Manche finita! Guarda lo schermo'));
    } else if (v.phase === 'ultimo') {
      if (v.excluded.includes(v.you)) ctrl.append(h('div', 'pbigmsg', 'Hai sbagliato: aspetta la prossima frase'));
      else {
        const book = h('button', 'pbook', 'PRENOTA!'); book.dataset.testid = 'pbook';
        book.onclick = () => client?.send({ k: 'book' });
        ctrl.append(h('div', 'phint', 'Le lettere si scoprono da sole'), book);
      }
    } else if (v.phase === 'booked') {
      if (v.booked === v.you) { ctrl.append(h('div', 'phint', 'Rispondi!')); solveForm(); }
      else ctrl.append(h('div', 'pbigmsg', `${v.players[v.booked ?? 0].name} risponde…`));
    } else if (!mine) {
      ctrl.append(h('div', 'pbigmsg', v.phase === 'spinning' ? 'La ruota gira…' : `Tocca a ${turnName}`));
    } else if (v.phase === 'spinning') {
      ctrl.append(h('div', 'pbigmsg', 'La ruota gira…'));
    } else if (v.phase === 'jolly') {
      const use = h('button', 'pbtn', 'USA IL JOLLY'); use.dataset.testid = 'pjolly-use';
      use.onclick = () => client?.send({ k: 'jolly', use: true });
      const keep = h('button', 'pbtn', 'NO, LO TENGO'); keep.dataset.testid = 'pjolly-keep';
      keep.onclick = () => client?.send({ k: 'jolly', use: false });
      ctrl.append(h('div', 'phint', 'Con il Jolly non perdi nulla e continui a giocare. Se lo tieni, lo puoi usare più avanti.'), use, keep);
    } else if (v.phase === 'expressOffer') {
      const go = h('button', 'pbtn', 'ENTRA IN EXPRESS'); go.dataset.testid = 'pexpress-go';
      go.onclick = () => client?.send({ k: 'express', go: true });
      const no = h('button', 'pbtn', 'MI FERMO'); no.dataset.testid = 'pexpress-no';
      no.onclick = () => client?.send({ k: 'express', go: false });
      ctrl.append(h('div', 'phint', 'Express: ogni consonante vale 1000, ma un errore azzera tutto!'), go, no);
    } else if (v.phase === 'consonant' || (v.express && mode === 'cons')) {
      ctrl.append(h('div', 'phint', `Scegli una consonante (${v.pending})`), kb(CONSONANTS, (l) => client?.send({ k: 'call', l }), new Set()));
      if (v.phase !== 'consonant') ctrl.append(back());
    } else if (mode === 'menu') {
      const row = h('div', 'prowbtn');
      const vow = h('button', 'pbtn', v.vowelCost ? `VOCALE (${v.vowelCost})` : 'VOCALE (gratis)'); vow.disabled = !v.canVowel; vow.dataset.testid = 'pvowel';
      vow.onclick = () => { mode = 'vowel'; render(); };
      const sol = h('button', 'pbtn', 'RISOLVI'); sol.dataset.testid = 'psolve';
      sol.onclick = () => { mode = 'solve'; render(); };
      row.append(vow, sol);
      if (v.express) {
        const cons = h('button', 'pbtn', `CONSONANTE (${v.pending})`); cons.dataset.testid = 'pcons';
        cons.onclick = () => { mode = 'cons'; render(); };
        ctrl.append(h('div', 'phint', 'Sei in EXPRESS!'), cons, row);
      } else {
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
        ctrl.append(pad, tap, row);
      }
      if (!v.canVowel && v.vowelCost) ctrl.append(h('div', 'phint', me.round < v.vowelCost ? `Vocale: servono almeno ${v.vowelCost} punti nella manche` : 'Vocali: sono già uscite tutte'));
    } else if (mode === 'vowel') {
      ctrl.append(h('div', 'phint', 'Scegli una vocale'), kb(VOWELS, (l) => client?.send({ k: 'vowel', l })), back());
    } else {
      solveForm();
      ctrl.append(back());
    }
  }

  joinForm();
  // Returning player: rejoin automatically with the saved name.
  if (roomToken && profile.name) connect();
  void note;
}
