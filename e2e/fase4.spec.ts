import { expect, test, Page, Browser } from '@playwright/test';

const SHOTS = 'docs/screenshot/fase4';
const PEER = 'peer=localhost:9000';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());
const force = (p: Page, kind: string) =>
  p.evaluate((k) => {
    const r = (window as any).__ruota;
    const w = r.state().wheel;
    r.force(w.findIndex((x: any) => (k === 'jolly' || k === 'premio' || k === 'jackpot' ? x.token === k : x.kind === k)));
  }, kind);

async function setup(page: Page, types: string[], names = 3) {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('preset-libera').click();
  await page.getByTestId(`players-${names}`).click();
  await page.getByTestId(`rounds-${types.length}`).click();
  for (let i = 0; i < types.length; i++) await page.getByTestId(`round-type-${i}`).selectOption(types[i]);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('solve')).toBeVisible();
}

async function presentLetter(page: Page, vowel = false) {
  return page.evaluate((v) => {
    const s = (window as any).__ruota.state();
    const text: string = s.phrases[s.board].text.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return [...text].find((c) => /[A-Z]/.test(c) && ('AEIOU'.includes(c) === v) && !s.called.includes(c));
  }, vowel);
}

test('Express: offerta, ingresso, errore e soluzione', async ({ page }) => {
  await setup(page, ['express']);
  await expect(page.locator('.roundtag')).toContainText('Express');
  await expect(page.locator('.message')).toContainText('Express');
  await page.screenshot({ path: `${SHOTS}/express-ruota.png` });
  await force(page, 'express');
  const l = await presentLetter(page);
  await page.getByTestId(`key-${l}`).click();
  await expect(page.getByTestId('express-go')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/express-offerta.png` });
  await page.getByTestId('express-go').click();
  await expect(page.getByTestId('express-cons')).toBeVisible();
  await expect(page.getByTestId('spin')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/express-dentro.png` });
  const before = (await st(page)).players[0].round;
  await page.getByTestId('express-cons').click();
  const l2 = await presentLetter(page);
  await page.getByTestId(`key-${l2}`).click();
  expect((await st(page)).players[0].round).toBeGreaterThan(before);
  // wrong consonant: everything is lost and the turn passes
  // the consonant keyboard stays open in Express
  const absent = await page.evaluate(() => {
    const r = (window as any).__ruota.state();
    const t = r.phrases[r.board].text;
    return [...'BCDFGHLMNPQRSTVZ'].find((c) => !t.includes(c) && !r.called.includes(c));
  });
  await page.getByTestId(`key-${absent}`).click();
  const s = await st(page);
  expect(s.players[0].round).toBe(0);
  expect(s.current).toBe(1);
});

test('giro completo: tema, cruciruota, triplete, jackpot, ultimo round', async ({ page }) => {
  await setup(page, ['tema', 'cruciruota', 'triplete', 'jackpot', 'ultimo']);
  const seen = new Set<string>();
  for (let guard = 0; guard < 60; guard++) {
    const s = await st(page);
    if (s.phase === 'gameEnd') break;
    const type = s.rounds[s.round].type;
    const key = `${s.round}-${s.board}`;
    if (!seen.has(key)) {
      seen.add(key);
      if (type === 'jackpot') {
        // conquer the jackpot token and fill the pot before solving
        await force(page, 'jackpot');
        const l = await presentLetter(page);
        await page.getByTestId(`key-${l}`).click();
        expect((await st(page)).players[s.current].jackpot).toBe(true);
      }
      if (type === 'cruciruota') {
        await force(page, 'value');
        const l = await presentLetter(page);
        await page.getByTestId(`key-${l}`).click();
      }
      await page.screenshot({ path: `${SHOTS}/${type}-${s.board}.png` });
    }
    const cur = await st(page);
    if (cur.phase === 'roundEnd') { await page.getByTestId('next').click(); continue; }
    if (cur.phase === 'ultimo') {
      // letters appear on their own
      const n = cur.called.length;
      await expect.poll(async () => (await st(page)).called.length, { timeout: 5000 }).toBeGreaterThan(n);
      await page.getByTestId('book-1').click();
      await expect(page.getByTestId('solve-input')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/ultimo-prenotato.png` });
      const ph = (await st(page)).phrases[(await st(page)).board];
      await page.getByTestId('solve-input').fill(ph.text);
      await page.getByTestId('solve-ok').click();
      continue;
    }
    const ph = cur.phrases[cur.board];
    await page.getByTestId('solve').click();
    await page.getByTestId('solve-input').fill(ph.words ? [...ph.words].reverse().join(', ') : ph.text);
    await page.getByTestId('solve-ok').click();
  }
  const end = await st(page);
  expect(end.phase).toBe('gameEnd');
  expect(end.rounds.map((r: any) => r.type)).toEqual(['tema', 'cruciruota', 'triplete', 'jackpot', 'ultimo']);
  // triplete = 3 boards, ultimo = 2 boards
  expect(end.rounds[2].count).toBe(3);
  expect(end.rounds[4].count).toBe(2);
  expect(end.players[1].total).toBeGreaterThanOrEqual(2000); // two Ultimo Round phrases at 1000 each
  await page.screenshot({ path: `${SHOTS}/classifica.png` });
});

test('preset Completa e Veloce hanno i round previsti', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('preset-veloce').click();
  await page.getByTestId('start').click();
  let s = await st(page);
  expect(s.rounds.map((r: any) => r.type)).toEqual(['classica', 'express', 'ultimo']);
  await page.reload();
  await page.getByTestId('preset-completa').click();
  await page.screenshot({ path: `${SHOTS}/setup.png` });
  await page.getByTestId('start').click();
  s = await st(page);
  expect(s.rounds.map((r: any) => r.type).slice(0, 3)).toEqual(['classica', 'tema', 'express']);
  expect(['cruciruota', 'triplete']).toContain(s.rounds[3].type);
  expect(s.rounds[4].type).toBe('ultimo');
});

async function phone(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`/?r=${code}&test&${PEER}`);
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-go').click();
  await expect(page.getByTestId('lobby-me')).toHaveText(name, { timeout: 20000 });
  return page;
}

test('telefoni: offerta Express e prenotazione nell’Ultimo Round', async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto(`/?test&${PEER}&t=60000`);
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('preset-libera').click();
  await host.getByTestId('rounds-2').click();
  await host.getByTestId('round-type-0').selectOption('express');
  await host.getByTestId('round-type-1').selectOption('ultimo');
  await host.getByTestId('phones').click();
  await host.waitForSelector('.lobby[data-code]');
  const code = (await host.locator('.lobby').getAttribute('data-code'))!;
  const p0 = await phone(browser, code, 'Anna');
  const p1 = await phone(browser, code, 'Bruno');
  await host.getByTestId('lobby-start').click();
  await expect(p0.getByTestId('swipe')).toBeVisible({ timeout: 10000 });

  await force(host, 'express');
  const l = await presentLetter(host);
  await expect(p0.getByTestId(`pkey-${l}`)).toBeVisible();
  await p0.getByTestId(`pkey-${l}`).click();
  await expect(p0.getByTestId('pexpress-go')).toBeVisible();
  await p0.screenshot({ path: `${SHOTS}/telefono-express-offerta.png` });
  await p0.getByTestId('pexpress-go').click();
  await expect(p0.getByTestId('pcons')).toBeVisible();
  await expect(p0.getByTestId('swipe')).toHaveCount(0);
  await p0.screenshot({ path: `${SHOTS}/telefono-express.png` });
  const text = (await st(host)).phrases[0].text;
  await p0.getByTestId('psolve').click();
  await p0.getByTestId('psolve-input').fill(text);
  await p0.getByTestId('psolve-ok').click();
  await expect.poll(async () => (await st(host)).phase).toBe('roundEnd');
  await host.getByTestId('next').click();

  await expect(p1.getByTestId('pbook')).toBeVisible({ timeout: 10000 });
  await p1.screenshot({ path: `${SHOTS}/telefono-ultimo.png` });
  await host.screenshot({ path: `${SHOTS}/schermo-ultimo.png` });
  await p1.getByTestId('pbook').click();
  await expect(p1.getByTestId('psolve-input')).toBeVisible();
  await expect(p0.getByText('Bruno risponde')).toBeVisible();
  await p1.getByTestId('psolve-input').fill('sbagliato');
  await p1.getByTestId('psolve-ok').click();
  await expect(p1.getByText('Hai sbagliato')).toBeVisible();
  await p0.getByTestId('pbook').click();
  const s = await st(host);
  await p0.getByTestId('psolve-input').fill(s.phrases[s.board].text);
  await p0.getByTestId('psolve-ok').click();
  await expect.poll(async () => (await st(host)).board).toBe(s.board + 1);
  expect((await st(host)).players[0].total).toBeGreaterThanOrEqual(1000);
});
