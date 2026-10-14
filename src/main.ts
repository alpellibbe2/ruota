import './ui/style.css';
import { Action, Config, DEFAULT_CONFIG, GameState, PLAYER_COLORS, boardNo, canBuyVowel, currentPhrase, newGame, ranking, reduce, roundType } from './core/game';
import { addCustom, buildGame, buildRound, presetTypes, Source } from './core/frasi';
import { ROUND_NAMES, ROUND_RULES, ROUND_TYPES, Preset, RoundType } from './core/rounds';
import { baseLetter, checkSolution, checkWords, hiddenLetters } from './core/phrase';
import { showEditor } from './ui/editor';
import { CONSONANTS, VOWELS } from './core/phrase';
import { spinAngle } from './core/wheel';
import { BoardView } from './ui/boardView';
import { WheelView } from './ui/wheelView';
import { isMuted, setMuted, sfx } from './ui/audio';
import { Host } from './net/host';
import { buildConductorView, buildView, ConductorIntent } from './net/protocol';
import { showLobby } from './ui/lobby';
import { startPhone } from './ui/phone';

const SETTINGS_KEY = 'ruota.impostazioni';
const TEST = new URLSearchParams(location.search).has('test');
const SPEED = TEST ? 0.1 : 1;

interface Settings { names: string[]; rounds: number; config: Config; fonte?: Source; preset?: Preset; custom?: RoundType[] }

const stage = document.getElementById('stage')!;

function fit() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `translate(-50%, -50%) scale(${k})`;
}
addEventListener('resize', fit);
fit();

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function loadSettings(): Settings {
  const def: Settings = { names: ['Giocatore 1', 'Giocatore 2', 'Giocatore 3'], rounds: 3, config: DEFAULT_CONFIG };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return def; }
}

// ───────────────────────── setup screen ─────────────────────────
function showSetup() {
  const st = loadSettings();
  stage.textContent = '';
  const box = h('div', 'setup');
  box.append(h('h1', 'logo', 'LA RUOTA'), h('p', 'sub', 'Gioco da salotto – tutto su un dispositivo'));

  const namesBox = h('div', 'names');
  const renderNames = () => {
    namesBox.textContent = '';
    st.names.forEach((n, i) => {
      const row = h('div', 'name-row');
      const dot = h('span', 'dot'); dot.style.background = PLAYER_COLORS[i];
      const inp = h('input'); inp.value = n; inp.maxLength = 14; inp.dataset.testid = `name-${i}`;
      inp.oninput = () => { st.names[i] = inp.value; };
      row.append(dot, inp);
      namesBox.append(row);
    });
  };
  renderNames();

  const countRow = h('div', 'row');
  countRow.append(h('span', '', 'Giocatori'));
  for (let n = 2; n <= 6; n++) {
    const b = h('button', 'chip' + (st.names.length === n ? ' on' : ''), String(n));
    b.dataset.testid = `players-${n}`;
    b.onclick = () => {
      while (st.names.length < n) st.names.push(`Giocatore ${st.names.length + 1}`);
      st.names.length = n;
      showSetupWith(st);
    };
    countRow.append(b);
  }

  const preset = st.preset ?? 'completa';
  const presetRow = h('div', 'row');
  presetRow.append(h('span', '', 'Partita'));
  (['veloce', 'completa', 'libera'] as Preset[]).forEach((pr) => {
    const b = h('button', 'chip wide' + (preset === pr ? ' on' : ''), pr === 'veloce' ? 'Veloce (3)' : pr === 'completa' ? 'Completa (5)' : 'Libera');
    b.dataset.testid = `preset-${pr}`;
    b.onclick = () => { st.preset = pr; showSetupWith(st); };
    presetRow.append(b);
  });
  const roundsRow = h('div', 'row');
  if (preset === 'libera') {
    roundsRow.append(h('span', '', 'Manche'));
    for (let n = 1; n <= 5; n++) {
      const b = h('button', 'chip' + (st.rounds === n ? ' on' : ''), String(n));
      b.dataset.testid = `rounds-${n}`;
      b.onclick = () => { st.rounds = n; showSetupWith(st); };
      roundsRow.append(b);
    }
    const kinds = h('div', 'row');
    const custom = st.custom ?? [];
    for (let i = 0; i < st.rounds; i++) {
      const sel = h('select', 'rsel'); sel.dataset.testid = `round-type-${i}`;
      for (const t of ROUND_TYPES) { const o = h('option', '', ROUND_NAMES[t]); o.value = t; sel.append(o); }
      sel.value = custom[i] ?? 'classica';
      sel.onchange = () => { const c = [...(st.custom ?? [])]; while (c.length <= i) c.push('classica'); c[i] = sel.value as RoundType; st.custom = c; localStorage.setItem(SETTINGS_KEY, JSON.stringify(st)); };
      kinds.append(sel);
    }
    roundsRow.append(kinds);
  }

  const bankRow = h('label', 'row');
  const cb = h('input'); cb.type = 'checkbox'; cb.checked = st.config.bankruptAll;
  cb.onchange = () => { st.config = { ...st.config, bankruptAll: cb.checked }; };
  bankRow.append(cb, h('span', '', 'Bancarotta azzera anche il totale'));

  const srcRow = h('div', 'row');
  srcRow.append(h('span', '', 'Frasi'));
  (['banca', 'mie', 'mix'] as Source[]).forEach((f) => {
    const b = h('button', 'chip wide' + ((st.fonte ?? 'banca') === f ? ' on' : ''), f === 'banca' ? 'Banca' : f === 'mie' ? 'Solo mie' : 'Mescola');
    b.dataset.testid = `fonte-${f}`;
    b.onclick = () => { st.fonte = f; showSetupWith(st); };
    srcRow.append(b);
  });
  const edit = h('button', 'chip wide', 'Editor frasi'); edit.dataset.testid = 'editor';
  edit.onclick = () => showEditor(stage, showSetup);
  srcRow.append(edit);

  const start = h('button', 'big', 'INIZIA (UN DISPOSITIVO)');
  start.dataset.testid = 'start';
  start.onclick = () => {
    const names = st.names.map((n, i) => n.trim() || `Giocatore ${i + 1}`);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...st, names }));
    startGame({ ...st, names });
  };
  const phones = h('button', 'big alt', 'CON I TELEFONI');
  phones.dataset.testid = 'phones';
  phones.onclick = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(st));
    showLobby(stage, st, (settings, host) => startGame(settings, host));
  };
  const btns = h('div', 'row');
  btns.append(start, phones);
  const saved = loadSession();
  if (saved) {
    const resume = h('button', 'big alt', 'RIPRENDI PARTITA');
    resume.dataset.testid = 'resume';
    resume.onclick = async () => {
      const host = new Host();
      host.restoreSeats(saved.seats);
      host.started = true;
      await host.open(saved.code);
      startGame(saved.settings, host, saved.state);
    };
    btns.append(resume);
  }
  box.append(countRow, namesBox, presetRow, roundsRow, srcRow, bankRow, btns);
  stage.append(box);
}

const SESSION_KEY = 'ruota.sessione';
interface Session { code: string; seats: { token: string; name: string; color: string }[]; settings: Settings; state: GameState }
function loadSession(): Session | null {
  try {
    const x = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
    return x && x.state.phase !== 'gameEnd' ? x : null;
  } catch { return null; }
}

function showSetupWith(st: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(st));
  showSetup();
}

// ───────────────────────── game screen ─────────────────────────
const ANSWER_MS = Number(new URLSearchParams(location.search).get('t')) || 15000;

export function startGame(st: Settings, host?: Host, resume?: GameState) {
  let state: GameState;
  if (resume) state = resume;
  else {
    const custom = Array.from({ length: st.rounds }, (_, i) => st.custom?.[i] ?? 'classica');
    const { phrases, rounds } = buildGame(presetTypes(st.preset ?? 'completa', custom), st.fonte ?? 'banca');
    state = newGame(st.names, phrases, st.config, rounds);
    if (host) state = { ...state, players: state.players.map((p, i) => ({ ...p, color: host.seats[i]?.color ?? p.color })) };
  }
  if (host) host.started = true;
  let deadline = 0;
  let timer = 0;
  let review: { player: number; text: string } | null = null;
  let note = '';
  let mode: 'menu' | 'vowel' | 'solve' | 'cons' = 'menu';
  let revealTimer = 0;

  stage.textContent = '';
  const wheel = new WheelView(state.wheel);
  const board = new BoardView();
  const pendingEl = h('div', 'pending');
  const left = h('div', 'left'); left.append(wheel.el, pendingEl);
  const message = h('div', 'message');
  const panel = h('div', 'panel');
  const right = h('div', 'right'); right.append(board.el, message, panel);
  const scores = h('div', 'scores');
  const roundTag = h('div', 'roundtag');
  const mute = h('button', 'mute', isMuted() ? '🔇' : '🔊');
  mute.onclick = () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; };
  const overlay = h('div', 'overlay hidden');
  stage.append(left, right, scores, roundTag, mute, overlay);

  let swipeStart: { y: number; t: number } | null = null;
  wheel.el.onpointerdown = (e) => { swipeStart = { y: e.clientY, t: performance.now() }; };
  wheel.el.onpointerup = (e) => {
    if (!swipeStart) return;
    const dist = Math.abs(e.clientY - swipeStart.y);
    const speed = dist / Math.max(60, performance.now() - swipeStart.t);
    swipeStart = null;
    if (dist > 20 && !host) spin(Math.min(1, speed / 2));
  };

  const dispatch = (a: Action) => {
    const prev = state;
    state = reduce(state, a);
    if (state === prev) return;
    if (state.current !== prev.current || state.phase !== prev.phase) review = null;
    if (state.current !== prev.current || state.phase !== 'turn') mode = 'menu';
    render();
    if (state.event.id !== prev.event.id) playEvent();
    afterChange();
  };

  /** Remote play: answer timer, phone views and session persistence. */
  /** Ultimo Round: letters appear by themselves while nobody has booked. */
  function syncReveal() {
    if (state.phase === 'ultimo' && !revealTimer) {
      revealTimer = window.setInterval(() => {
        const hidden = [...hiddenLetters(currentPhrase(state).text, new Set(state.called), true), ...hiddenLetters(currentPhrase(state).text, new Set(state.called), false)];
        if (hidden.length) dispatch({ type: 'REVEAL', letter: hidden[Math.floor(Math.random() * hidden.length)] });
      }, 2500 * SPEED);
    } else if (state.phase !== 'ultimo' && revealTimer) {
      clearInterval(revealTimer);
      revealTimer = 0;
    }
  }

  function afterChange() {
    syncReveal();
    if (!host) return;
    clearTimeout(timer);
    deadline = 0;
    if (['turn', 'consonant', 'expressOffer', 'booked'].includes(state.phase)) {
      deadline = Date.now() + ANSWER_MS;
      timer = window.setTimeout(() => dispatch({ type: 'TIMEOUT' }), ANSWER_MS);
    }
    broadcast();
    try {
      const seats = host.seats.map(({ token, name, color }) => ({ token, name, color }));
      localStorage.setItem(SESSION_KEY, JSON.stringify({ code: host.code, seats, settings: st, state }));
    } catch { /* storage full or unavailable */ }
  }
  const broadcast = () => {
    if (!host) return;
    host.broadcastView((i) => buildView(state, i, host.connected(), deadline));
    host.sendConductor(buildConductorView(state, host.connected(), deadline, review, note));
  };
  if (host) {
    host.onLobby = () => { broadcast(); renderScores(); };
    host.onConductor = (i: ConductorIntent) => {
      note = '';
      if (i.k === 'accept') { review = null; dispatch({ type: 'FORCE_SOLVE' }); }
      else if (i.k === 'reject') { review = null; dispatch({ type: 'SOLVE', text: '' }); }
      else if (i.k === 'pass') { review = null; dispatch({ type: 'FORCE_PASS' }); }
      else if (i.k === 'adjust') dispatch({ type: 'ADJUST', player: Number(i.player), delta: Math.max(-5000, Math.min(5000, Number(i.delta))) });
      else if (i.k === 'skip') {
        review = null;
        dispatch({ type: 'SKIP', phrase: buildRound(roundType(state), st.fonte ?? 'banca')[0] });
      }
      else if (i.k === 'next') dispatch({ type: 'NEXT_ROUND', round: i.type ? { type: i.type, phrases: buildRound(i.type, st.fonte ?? 'banca') } : undefined });
      else if (i.k === 'addPhrase') {
        note = addCustom(String(i.text), String(i.tema)) ?? 'Frase aggiunta ✓';
        broadcast();
      }
    };
    host.onIntent = (seat, i) => {
      if (review) return;
      if (i.k === 'book') { dispatch({ type: 'BOOK', player: seat }); return; }
      if (seat !== state.current) return;
      if (i.k === 'express') dispatch({ type: 'EXPRESS', go: !!i.go });
      else if (i.k === 'spin') void spin(Math.min(1, Math.max(0.2, Number(i.power) || 0.5)));
      else if (i.k === 'call') dispatch({ type: 'CALL', letter: String(i.l) });
      else if (i.k === 'vowel') dispatch({ type: 'BUY_VOWEL', letter: String(i.l) });
      else if (i.k === 'solve') {
        const text = String(i.text).slice(0, 80);
        // With a human conductor, a wrong-looking answer waits for their verdict (typo, spoken variant…).
        if (host.hasConductor() && (state.phase === 'turn' || state.phase === 'booked') && !looksRight(text)) {
          review = { player: seat, text };
          clearTimeout(timer);
          deadline = 0;
          renderPanel();
          broadcast();
        } else dispatch({ type: 'SOLVE', text });
      }
    };
  }

  function looksRight(text: string): boolean {
    const ph = currentPhrase(state);
    return ph.words ? checkWords(text, ph.words, st.config.typoTolerance) : checkSolution(text, ph.text, st.config.typoTolerance);
  }

  function playEvent() {
    const e = state.event;
    switch (e.type) {
      case 'hit': case 'vowel':
        for (let i = 0; i < (e.count ?? 1); i++) sfx.ding(i);
        break;
      case 'miss': case 'wrong': sfx.buzzer(); break;
      case 'pass': sfx.pass(); break;
      case 'bankrupt': sfx.bankrupt(); break;
      case 'roundEnd': case 'gameEnd': sfx.win(); break;
      case 'value': sfx.vowel(); break;
      case 'jolly': case 'express': sfx.fanfare(); break;
      case 'book': sfx.book(); break;
      case 'reveal': sfx.ding(0); break;
    }
  }

  async function spin(power: number) {
    if (state.phase !== 'turn') return;
    const angle = spinAngle(state.wheelAngle, power, Math.random());
    dispatch({ type: 'SPIN', angle });
    sfx.spin();
    await wheel.spinTo(angle, (3500 + power * 2500) * SPEED);
    dispatch({ type: 'SPIN_DONE' });
  }

  function keyboard(letters: string, disabled: Set<string>, onPick: (l: string) => void) {
    const kb = h('div', 'kb');
    for (const l of letters) {
      const b = h('button', 'key', l);
      b.disabled = disabled.has(l);
      b.dataset.testid = `key-${l}`;
      b.onclick = () => onPick(l);
      kb.append(b);
    }
    return kb;
  }

  function solveForm(title: string, onSubmit: (text: string) => void, back?: () => void) {
    const inp = h('input', 'solve-input'); inp.placeholder = roundType(state) === 'cruciruota' ? 'Scrivi tutte le parole…' : 'Scrivi la frase…';
    inp.dataset.testid = 'solve-input';
    const ok = h('button', 'act', 'CONFERMA'); ok.dataset.testid = 'solve-ok';
    ok.onclick = () => onSubmit(inp.value);
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') ok.click(); };
    const row = h('div', 'actions'); row.append(inp, ok);
    if (back) { const b = h('button', 'act small', 'Annulla'); b.onclick = back; row.append(b); }
    panel.append(h('div', 'hint', title), row);
    setTimeout(() => inp.focus(), 0);
  }

  function renderPanel() {
    panel.textContent = '';
    const called = new Set(state.called);
    const me = state.players[state.current];
    const menuBack = () => { mode = 'menu'; renderPanel(); };
    if (host && review) {
      panel.append(h('div', 'hint big-hint', `${state.players[review.player].name} risponde:`));
      panel.append(h('div', 'hint quote', `«${review.text}»`));
      const row = h('div', 'actions');
      const ok = h('button', 'act spin', 'ACCETTA'); ok.dataset.testid = 'review-ok';
      ok.onclick = () => host.onConductor({ k: 'accept' });
      const no = h('button', 'act', 'RIFIUTA'); no.dataset.testid = 'review-no';
      no.onclick = () => host.onConductor({ k: 'reject' });
      row.append(ok, no);
      panel.append(row);
    } else if (host && state.phase !== 'roundEnd' && state.phase !== 'gameEnd') {
      const t = state.phase === 'spinning' ? 'La ruota gira…'
        : state.phase === 'ultimo' ? 'Prenotati sul telefono!'
        : state.phase === 'booked' ? `${me.name} risponde…`
        : state.phase === 'expressOffer' ? `${me.name}: Express?`
        : `Tocca a ${me.name}`;
      panel.append(h('div', 'hint big-hint', t));
      if (state.phase !== 'ultimo') panel.append(h('div', 'hint sm', 'Usa il tuo telefono per giocare'));
    } else if (state.phase === 'spinning') {
      panel.append(h('div', 'hint', 'La ruota gira…'));
    } else if (state.phase === 'ultimo') {
      panel.append(h('div', 'hint', 'Chi sa la frase si prenota!'));
      const row = h('div', 'actions');
      state.players.forEach((p, i) => {
        const b = h('button', 'act', p.name); b.dataset.testid = `book-${i}`;
        b.style.borderBottom = `10px solid ${p.color}`;
        b.disabled = state.excluded.includes(i);
        b.onclick = () => dispatch({ type: 'BOOK', player: i });
        row.append(b);
      });
      panel.append(row);
    } else if (state.phase === 'booked') {
      solveForm(`${me.name}, rispondi!`, (text) => dispatch({ type: 'SOLVE', text }));
    } else if (state.phase === 'expressOffer') {
      panel.append(h('div', 'hint', `${me.name}, vuoi andare in EXPRESS? Ogni consonante vale 1000, ma un errore azzera tutto!`));
      const row = h('div', 'actions');
      const go = h('button', 'act spin', 'ENTRA IN EXPRESS'); go.dataset.testid = 'express-go';
      go.onclick = () => dispatch({ type: 'EXPRESS', go: true });
      const no = h('button', 'act', 'MI FERMO'); no.dataset.testid = 'express-no';
      no.onclick = () => dispatch({ type: 'EXPRESS', go: false });
      row.append(go, no);
      panel.append(row);
    } else if (state.phase === 'consonant') {
      panel.append(h('div', 'hint', `Scegli una consonante – ${state.pending} a lettera`));
      panel.append(keyboard(CONSONANTS, called, (l) => dispatch({ type: 'CALL', letter: l })));
    } else if (state.phase === 'turn') {
      if (mode === 'menu') {
        const row = h('div', 'actions');
        if (state.express) {
          const cons = h('button', 'act spin', `CONSONANTE (${state.pending})`); cons.dataset.testid = 'express-cons';
          cons.onclick = () => { mode = 'cons'; renderPanel(); };
          row.append(cons);
        } else {
          const spinB = h('button', 'act spin', 'GIRA LA RUOTA'); spinB.dataset.testid = 'spin';
          spinB.onclick = () => spin(0.3 + Math.random() * 0.7);
          row.append(spinB);
        }
        const vow = h('button', 'act', `COMPRA VOCALE (${state.config.vowelCost})`); vow.dataset.testid = 'vowel';
        vow.disabled = !canBuyVowel(state);
        vow.onclick = () => { mode = 'vowel'; renderPanel(); };
        const sol = h('button', 'act', 'RISOLVI'); sol.dataset.testid = 'solve';
        sol.onclick = () => { mode = 'solve'; renderPanel(); };
        row.append(vow, sol);
        panel.append(h('div', 'hint', state.express ? `${me.name} è in EXPRESS!` : `Tocca a ${me.name}`), row);
      } else if (mode === 'cons') {
        panel.append(h('div', 'hint', `Consonante – ${state.pending} a lettera`));
        panel.append(keyboard(CONSONANTS, called, (l) => dispatch({ type: 'CALL', letter: l })));
        const back = h('button', 'act small', 'Indietro'); back.onclick = menuBack;
        panel.append(back);
      } else if (mode === 'vowel') {
        panel.append(h('div', 'hint', `Scegli una vocale (${state.config.vowelCost})`));
        panel.append(keyboard(VOWELS, called, (l) => dispatch({ type: 'BUY_VOWEL', letter: l })));
        const back = h('button', 'act small', 'Indietro'); back.onclick = menuBack;
        panel.append(back);
      } else {
        solveForm('Prova la soluzione', (text) => dispatch({ type: 'SOLVE', text }), menuBack);
      }
    } else if (state.phase === 'roundEnd') {
      const next = h('button', 'act spin', 'PROSSIMA MANCHE'); next.dataset.testid = 'next';
      next.onclick = () => dispatch({ type: 'NEXT_ROUND' });
      const w = state.roundWinner === null ? 'Fine manche' : `${state.players[state.roundWinner].name} vince la manche!`;
      panel.append(h('div', 'hint', w), next);
    }
  }

  function renderScores() {
    scores.textContent = '';
    state.players.forEach((p, i) => {
      const c = h('div', 'score' + (i === state.current && state.phase !== 'gameEnd' ? ' active' : ''));
      c.style.setProperty('--c', p.color);
      c.dataset.testid = `score-${i}`;
      if (host && !host.connected()[i]) c.classList.add('off');
      if (state.excluded.includes(i)) c.classList.add('off');
      const tokens = (p.jolly ? '🃏' : '') + (p.premio ? '🎁' : '') + (p.jackpot ? '💰' : '') + (i === state.current && state.express ? '⚡' : '');
      c.append(h('div', 'pname', p.name + (tokens ? ' ' + tokens : '')), h('div', 'pround', String(p.round)), h('div', 'ptotal', `Totale ${p.total}`));
      scores.append(c);
    });
  }

  let shownPhrase: unknown = null;
  let shownWheel: unknown = state.wheel;
  function render() {
    const ph = currentPhrase(state);
    const rt = roundType(state);
    if (shownPhrase !== ph) {
      board.setPhrase(ph, rt === 'tema' ? `A tema · ${ph.tema}` : ph.tema);
      shownPhrase = ph;
    }
    if (shownWheel !== state.wheel) { wheel.setWheel(state.wheel); shownWheel = state.wheel; }
    board.update(new Set(state.called));
    const count = state.rounds[state.round].count;
    roundTag.textContent = `Manche ${state.round + 1}/${state.rounds.length} · ${ROUND_NAMES[rt]}` + (count > 1 ? ` · ${boardNo(state) + 1}/${count}` : '');
    message.textContent = state.message || (state.called.length === 0 ? ROUND_RULES[rt] : '');
    left.classList.toggle('dim', rt === 'ultimo');
    pendingEl.textContent = state.pending ? String(state.pending) : rt === 'jackpot' ? `💰 ${state.jackpotPot}` : '';
    pendingEl.classList.toggle('pot', !state.pending && rt === 'jackpot');
    renderPanel();
    renderScores();
    if (state.phase === 'gameEnd') showFinal();
  }

  function showFinal() {
    overlay.classList.remove('hidden');
    overlay.textContent = '';
    const box = h('div', 'final');
    box.append(h('h2', '', 'Classifica finale'));
    ranking(state).forEach((p, i) => {
      const r = h('div', 'rank');
      r.style.setProperty('--c', p.color);
      r.append(h('span', '', `${i + 1}. ${p.name}`), h('b', '', String(p.total)));
      box.append(r);
    });
    const again = h('button', 'big', 'NUOVA PARTITA'); again.dataset.testid = 'again';
    again.onclick = () => { localStorage.removeItem(SESSION_KEY); host?.close(); location.reload(); };
    box.append(again);
    overlay.append(box);
  }

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey) return;
    const l = e.key.toUpperCase();
    if (!/^[A-Z]$/.test(l)) return;
    if (host) return;
    if (state.phase === 'consonant' || mode === 'cons') dispatch({ type: 'CALL', letter: l });
    else if (state.phase === 'turn' && mode === 'vowel') dispatch({ type: 'BUY_VOWEL', letter: l });
  });

  if (TEST) (window as unknown as Record<string, unknown>).__ruota = {
    state: () => state,
    dispatch,
    /** Land the wheel on segment `idx` without animation. */
    force: (idx: number) => {
      dispatch({ type: 'SPIN', angle: -(idx * 15 + 7) - 1440 });
      dispatch({ type: 'SPIN_DONE' });
    },
  };
  render();
  afterChange();
}

const room = new URLSearchParams(location.search).get('r');
if (room) startPhone(document.body, room.toUpperCase());
else showSetup();
