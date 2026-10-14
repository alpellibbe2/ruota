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

export async function showLobby(stage: HTMLElement, st: Settings, onStart: (s: Settings, host: Host) => void) {
  stage.textContent = '';
  const box = h('div', 'lobby');
  box.append(h('h1', 'logo small', 'LA RUOTA'), h('p', 'sub', 'Collegamento in corso…'));
  stage.append(box);

  const host = new Host();
  let code: string;
  try {
    code = await host.open();
  } catch {
    box.textContent = '';
    box.append(h('h1', 'logo small', 'LA RUOTA'), h('p', 'sub', 'Impossibile contattare il server di collegamento. Controlla la rete.'));
    const back = h('button', 'big', 'INDIETRO');
    back.onclick = () => location.reload();
    box.append(back);
    return;
  }
  const url = joinUrl(code);
  const qr = h('img', 'qr');
  qr.src = await QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: '#1a237e', light: '#ffffff' } });
  qr.alt = 'QR code per entrare';

  box.textContent = '';
  const left = h('div', 'lobby-left');
  left.append(h('p', 'sub', 'Inquadra il QR con il telefono (conduttore: premi «Sono il conduttore»)'), qr, h('div', 'code', code), h('div', 'url', url.replace(/^https?:\/\//, '')));
  const right = h('div', 'lobby-right');
  const list = h('div', 'plist');
  const start = h('button', 'big', 'INIZIA');
  start.dataset.testid = 'lobby-start';
  start.disabled = true;
  right.append(h('h2', '', 'Giocatori'), list, start);
  box.append(h('h1', 'logo small', 'LA RUOTA'), left, right);
  box.dataset.code = code;

  const refresh = () => {
    list.textContent = '';
    host.lobbyPlayers().forEach((p) => {
      const r = h('div', 'lp' + (p.connected ? '' : ' off'));
      r.style.setProperty('--c', p.color);
      r.append(h('span', '', p.name));
      list.append(r);
    });
    const cond = h('div', 'lp cond' + (host.hasConductor() ? '' : ' off'), host.hasConductor() ? 'Conduttore collegato' : 'Conduttore: automatico (nessun telefono)');
    cond.dataset.testid = 'lobby-cond';
    list.append(cond);
    if (!host.seats.length) list.append(h('div', 'empty', 'In attesa dei giocatori…'));
    start.disabled = host.seats.filter((s) => s.conn).length < 2;
    host.broadcastLobby();
  };
  host.onLobby = refresh;
  refresh();
  start.onclick = () => {
    onStart({ ...st, names: host.seats.map((s) => s.name) }, host);
  };
}
