import './ui/style.css';
import { Action, Config, DEFAULT_CONFIG, GameState, PLAYER_COLORS, canBuyVowel, currentPhrase, newGame, ranking, reduce } from './core/game';
import { pickPhrases } from './core/frasi';
import { CONSONANTS, VOWELS } from './core/phrase';
import { DEFAULT_WHEEL, spinAngle } from './core/wheel';
import { BoardView } from './ui/boardView';
import { WheelView } from './ui/wheelView';
import { isMuted, setMuted, sfx } from './ui/audio';

const SETTINGS_KEY = 'ruota.impostazioni';
const TEST = new URLSearchParams(location.search).has('test');
const SPEED = TEST ? 0.1 : 1;

interface Settings { names: string[]; rounds: number; config: Config }

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

  const roundsRow = h('div', 'row');
  roundsRow.append(h('span', '', 'Frasi (manche)'));
  for (let n = 1; n <= 5; n++) {
    const b = h('button', 'chip' + (st.rounds === n ? ' on' : ''), String(n));
    b.dataset.testid = `rounds-${n}`;
    b.onclick = () => { st.rounds = n; showSetupWith(st); };
    roundsRow.append(b);
  }

  const bankRow = h('label', 'row');
  const cb = h('input'); cb.type = 'checkbox'; cb.checked = st.config.bankruptAll;
  cb.onchange = () => { st.config = { ...st.config, bankruptAll: cb.checked }; };
  bankRow.append(cb, h('span', '', 'Bancarotta azzera anche il totale'));

  const start = h('button', 'big', 'INIZIA');
  start.dataset.testid = 'start';
  start.onclick = () => {
    const names = st.names.map((n, i) => n.trim() || `Giocatore ${i + 1}`);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...st, names }));
    startGame({ ...st, names });
  };
  box.append(countRow, namesBox, roundsRow, bankRow, start);
  stage.append(box);
}

function showSetupWith(st: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(st));
  showSetup();
}

// ───────────────────────── game screen ─────────────────────────
function startGame(st: Settings) {
  const phrases = pickPhrases(st.rounds);
  let state = newGame(st.names, phrases, st.config);
  let mode: 'menu' | 'vowel' | 'solve' = 'menu';

  stage.textContent = '';
  const wheel = new WheelView(DEFAULT_WHEEL);
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
    if (dist > 20) spin(Math.min(1, speed / 2));
  };

  const dispatch = (a: Action) => {
    const prev = state;
    state = reduce(state, a);
    if (state === prev) return;
    if (state.current !== prev.current || state.phase !== 'turn') mode = 'menu';
    render(prev);
    if (state.event.id !== prev.event.id) playEvent();
  };

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

  function renderPanel() {
    panel.textContent = '';
    const called = new Set(state.called);
    const me = state.players[state.current];
    if (state.phase === 'spinning') {
      panel.append(h('div', 'hint', 'La ruota gira…'));
    } else if (state.phase === 'consonant') {
      panel.append(h('div', 'hint', `Scegli una consonante – ${state.pending} a lettera`));
      panel.append(keyboard(CONSONANTS, called, (l) => dispatch({ type: 'CALL', letter: l })));
    } else if (state.phase === 'turn') {
      if (mode === 'menu') {
        const row = h('div', 'actions');
        const spinB = h('button', 'act spin', 'GIRA LA RUOTA'); spinB.dataset.testid = 'spin';
        spinB.onclick = () => spin(0.3 + Math.random() * 0.7);
        const vow = h('button', 'act', `COMPRA VOCALE (${state.config.vowelCost})`); vow.dataset.testid = 'vowel';
        vow.disabled = !canBuyVowel(state);
        vow.onclick = () => { mode = 'vowel'; renderPanel(); };
        const sol = h('button', 'act', 'RISOLVI'); sol.dataset.testid = 'solve';
        sol.onclick = () => { mode = 'solve'; renderPanel(); };
        row.append(spinB, vow, sol);
        panel.append(h('div', 'hint', `Tocca a ${me.name}`), row);
      } else if (mode === 'vowel') {
        panel.append(h('div', 'hint', `Scegli una vocale (${state.config.vowelCost})`));
        panel.append(keyboard(VOWELS, called, (l) => dispatch({ type: 'BUY_VOWEL', letter: l })));
        const back = h('button', 'act small', 'Indietro'); back.onclick = () => { mode = 'menu'; renderPanel(); };
        panel.append(back);
      } else {
        const inp = h('input', 'solve-input'); inp.placeholder = 'Scrivi la frase…'; inp.dataset.testid = 'solve-input';
        const ok = h('button', 'act', 'CONFERMA'); ok.dataset.testid = 'solve-ok';
        ok.onclick = () => dispatch({ type: 'SOLVE', text: inp.value });
        inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') ok.click(); };
        const back = h('button', 'act small', 'Annulla'); back.onclick = () => { mode = 'menu'; renderPanel(); };
        const row = h('div', 'actions'); row.append(inp, ok, back);
        panel.append(h('div', 'hint', 'Prova la soluzione'), row);
        setTimeout(() => inp.focus(), 0);
      }
    } else if (state.phase === 'roundEnd') {
      const next = h('button', 'act spin', 'PROSSIMA FRASE'); next.dataset.testid = 'next';
      next.onclick = () => dispatch({ type: 'NEXT_ROUND' });
      panel.append(h('div', 'hint', `${state.players[state.roundWinner ?? 0].name} vince la manche!`), next);
    }
  }

  function renderScores() {
    scores.textContent = '';
    state.players.forEach((p, i) => {
      const c = h('div', 'score' + (i === state.current && state.phase !== 'gameEnd' ? ' active' : ''));
      c.style.setProperty('--c', p.color);
      c.dataset.testid = `score-${i}`;
      c.append(h('div', 'pname', p.name), h('div', 'pround', String(p.round)), h('div', 'ptotal', `Totale ${p.total}`));
      scores.append(c);
    });
  }

  let shownRound = -1;
  function render(prev?: GameState) {
    const ph = currentPhrase(state);
    if (shownRound !== state.round) {
      board.setPhrase(ph.text, ph.tema);
      shownRound = state.round;
    }
    board.update(new Set(state.called));
    roundTag.textContent = `Frase ${state.round + 1} di ${state.phrases.length}`;
    message.textContent = state.message;
    pendingEl.textContent = state.pending ? String(state.pending) : '';
    if (!prev || state.wheelAngle !== prev.wheelAngle) { /* animation drives the angle */ }
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
    again.onclick = () => showSetup();
    box.append(again);
    overlay.append(box);
  }

  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey) return;
    const l = e.key.toUpperCase();
    if (!/^[A-Z]$/.test(l)) return;
    if (state.phase === 'consonant') dispatch({ type: 'CALL', letter: l });
    else if (state.phase === 'turn' && mode === 'vowel') dispatch({ type: 'BUY_VOWEL', letter: l });
  });

  if (TEST) (window as unknown as Record<string, unknown>).__ruota = { state: () => state };
  render();
}

showSetup();
