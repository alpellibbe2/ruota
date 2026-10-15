import QRCode from 'qrcode';
import { Host } from '../net/host';

interface Settings { names: string[]; rounds: number; config: import('../core/game').Config }

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function joinUrl(code: string): string {
  const u = new URL(location.href);
  const keep = ['peer', 'test', 't'].map((k) => [k, u.searchParams.get(k)] as const).filter(([, v]) => v !== null);
  u.search = '';
  u.hash = '';
  u.searchParams.set('r', code);
  for (const [k, v] of keep) u.searchParams.set(k, v as string);
  return u.toString();
}

const MAX_PLAYERS = 6;

export async function showLobby(stage: HTMLElement, st: Settings, onStart: (s: Settings, host: Host) => void, onBack: () => void) {
  stage.textContent = '';
  const box = h('div', 'lobby');
  let host: Host | null = null;
  let left = false;
  const back = h('button', 'back', '← Indietro');
  back.dataset.testid = 'lobby-back';
  back.onclick = () => {
    left = true;
    host?.closeRoom('Lo schermo ha chiuso la stanza. Inquadra il nuovo QR per rientrare.');
    onBack();
  };
  box.append(back, h('h1', 'logo small', 'LA RUOTA'), h('p', 'sub lobby-wait', 'Apertura della stanza…'));
  stage.append(box);

  host = new Host();
  let code: string;
  try {
    code = await host.open();
  } catch {
    if (left) return;
    box.textContent = '';
    const retry = h('button', 'big', 'RIPROVA');
    retry.onclick = () => void showLobby(stage, st, onStart, onBack);
    box.append(back, h('h1', 'logo small', 'LA RUOTA'), h('p', 'sub lobby-wait', 'Impossibile contattare il server di collegamento. Controlla la rete.'), retry);
    retry.classList.add('lobby-retry');
    return;
  }
  // «Indietro» pressed while the room was opening
  if (left) { host.close(); return; }
  const url = joinUrl(code);
  const qr = h('img', 'qr');
  qr.src = await QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#1a237e', light: '#ffffff' } });
  qr.alt = 'QR code per entrare';
  if (left) { host.close(); return; }

  box.textContent = '';
  const join = h('div', 'lobby-card lobby-join');
  const codeBox = h('div', 'code-box');
  codeBox.append(h('div', 'code-label', 'Codice stanza'), h('div', 'code', code));
  const u = new URL(url);
  join.append(
    h('div', 'step', 'Inquadra il QR con il telefono'),
    qr,
    codeBox,
    h('div', 'url', `oppure apri ${u.host}${u.pathname}?r=${code}`),
  );
  const players = h('div', 'lobby-card lobby-players');
  const head = h('div', 'lobby-head');
  const title = h('h2', '', 'Giocatori');
  const count = h('span', 'pcount');
  head.append(title, count);
  const list = h('div', 'plist');
  const cond = h('div', 'lp cond');
  cond.dataset.testid = 'lobby-cond';
  const condHint = h('div', 'cond-hint');
  const start = h('button', 'big', 'INIZIA');
  start.dataset.testid = 'lobby-start';
  start.disabled = true;
  const why = h('p', 'sub why'); why.dataset.testid = 'lobby-why';
  players.append(head, list, cond, condHint, start, why);
  box.append(back, h('h1', 'logo small', 'LA RUOTA'), join, players);
  box.dataset.code = code;

  const refresh = () => {
    if (!host) return;
    list.textContent = '';
    const lp = host.lobbyPlayers();
    lp.forEach((p) => {
      const r = h('div', 'lp' + (p.connected ? '' : ' off'));
      r.style.setProperty('--c', p.color);
      r.append(h('span', 'lp-name', p.name), h('span', 'lp-state', p.connected ? 'pronto' : 'disconnesso'));
      list.append(r);
    });
    for (let i = lp.length; i < MAX_PLAYERS; i++) list.append(h('div', 'lp empty', i === lp.length ? 'In attesa di un giocatore…' : ''));
    const on = host.seats.filter((s) => s.conn).length;
    count.textContent = `${on}/${MAX_PLAYERS}`;
    const hasCond = host.hasConductor();
    cond.textContent = hasCond ? 'Conduttore collegato' : 'Conduttore: automatico (nessun telefono)';
    cond.classList.toggle('off', !hasCond);
    condHint.textContent = hasCond ? '' : 'Per condurre da telefono: inquadra il QR e premi «Sono il conduttore»';
    start.disabled = on < 2;
    start.textContent = on < 2 ? 'INIZIA' : `INIZIA CON ${on} GIOCATORI`;
    why.textContent = on < 2 ? `Per iniziare servono almeno 2 giocatori collegati (ora ${on}).` : '';
    host.broadcastLobby();
  };
  host.onLobby = refresh;
  refresh();
  start.onclick = () => {
    if (!host) return;
    onStart({ ...st, names: host.seats.map((s) => s.name) }, host);
  };
}
