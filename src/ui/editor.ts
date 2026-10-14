import { addCustom, exportCustom, importCustom, loadCustom, saveCustom } from '../core/frasi';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** On-screen editor for custom phrases (stored in localStorage, export/import as JSON). */
export function showEditor(stage: HTMLElement, back: () => void) {
  stage.textContent = '';
  const box = h('div', 'editor');
  box.append(h('h2', '', 'Frasi personalizzate'));

  const form = h('div', 'row');
  const text = h('input'); text.placeholder = 'Frase (es. IL GATTO DI MARCO)'; text.dataset.testid = 'ed-text'; text.style.width = '760px';
  const tema = h('input'); tema.placeholder = 'Tema (facoltativo)'; tema.dataset.testid = 'ed-tema'; tema.style.width = '340px';
  const add = h('button', 'chip wide', 'Aggiungi'); add.dataset.testid = 'ed-add';
  const msg = h('div', 'ed-msg');
  form.append(text, tema, add);

  const list = h('div', 'ed-list');
  const render = () => {
    list.textContent = '';
    const items = loadCustom();
    if (!items.length) list.append(h('div', 'empty', 'Nessuna frase personalizzata'));
    items.forEach((p) => {
      const r = h('div', 'ed-item');
      r.append(h('span', '', `${p.text}  —  ${p.tema}`));
      const del = h('button', 'chip wide', 'Elimina');
      del.onclick = () => { saveCustom(loadCustom().filter((x) => x.id !== p.id)); render(); };
      r.append(del);
      list.append(r);
    });
  };
  add.onclick = () => {
    const err = addCustom(text.value, tema.value);
    msg.textContent = err ?? 'Aggiunta ✓';
    if (!err) text.value = '';
    render();
  };

  const io = h('textarea', 'ed-io'); io.placeholder = 'Qui compare l’export; incolla qui un JSON per importare'; io.dataset.testid = 'ed-io';
  const exp = h('button', 'chip wide', 'Esporta'); exp.dataset.testid = 'ed-export';
  exp.onclick = () => {
    io.value = exportCustom();
    const a = h('a');
    a.href = URL.createObjectURL(new Blob([io.value], { type: 'application/json' }));
    a.download = 'frasi-ruota.json';
    a.click();
  };
  const imp = h('button', 'chip wide', 'Importa'); imp.dataset.testid = 'ed-import';
  imp.onclick = () => {
    try { msg.textContent = `Importate ${importCustom(io.value)} frasi`; } catch { msg.textContent = 'JSON non valido'; }
    render();
  };
  const file = h('input'); file.type = 'file'; file.accept = '.json,application/json';
  file.onchange = async () => { io.value = (await file.files?.[0]?.text()) ?? ''; };
  const ioRow = h('div', 'row');
  ioRow.append(exp, imp, file);

  const ok = h('button', 'big', 'FATTO'); ok.dataset.testid = 'ed-back'; ok.onclick = back;
  box.append(form, msg, list, io, ioRow, ok);
  stage.append(box);
  render();
}
