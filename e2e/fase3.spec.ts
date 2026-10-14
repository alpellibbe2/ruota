import { expect, test, Page, Browser } from '@playwright/test';

const SHOTS = 'docs/screenshot/fase3';
const PEER = 'peer=localhost:9000';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

async function player(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`/?r=${code}&test&${PEER}`);
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-go').click();
  await expect(page.getByTestId('lobby-me')).toHaveText(name, { timeout: 20000 });
  return page;
}

test('conduttore umano: verifica, accetta/rifiuta, correzioni, salta frase', async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto(`/?test&${PEER}&t=60000`);
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('preset-libera').click();
  await host.getByTestId('rounds-2').click();
  await host.getByTestId('phones').click();
  const code = (await host.locator('.lobby').getAttribute('data-code')) ?? (await host.waitForSelector('.lobby[data-code]').then((e) => e.getAttribute('data-code')))!;
  const p0 = await player(browser, code!, 'Anna');
  const p1 = await player(browser, code!, 'Bruno');

  const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const cond = await cctx.newPage();
  await cond.goto(`/?r=${code}&test&${PEER}`);
  await cond.getByTestId('join-name').fill('Regia');
  await cond.getByTestId('join-cond').click();
  await expect(cond.getByText('Collegato')).toBeVisible({ timeout: 20000 });
  await expect(host.getByTestId('lobby-cond')).toHaveText('Conduttore collegato');
  await host.screenshot({ path: `${SHOTS}/schermo-lobby-conduttore.png` });
  await host.getByTestId('lobby-start').click();

  await expect(cond.getByTestId('csolution')).toBeVisible({ timeout: 10000 });
  let s = await st(host);
  expect((await cond.getByTestId('csolution').textContent())!.toUpperCase()).toBe(s.phrases[0].text);
  // players never get the solution
  const html = await p0.content();
  for (const w of s.phrases[0].text.split(' ').filter((w: string) => w.length > 4)) expect(html).not.toContain(w);
  await cond.screenshot({ path: `${SHOTS}/telefono-conduttore.png` });

  // wrong answer -> review; conductor rejects -> turn passes
  const turnPhone = () => (s.current === 0 ? p0 : p1);
  const answer = async (txt: string) => {
    s = await st(host);
    const p = turnPhone();
    await p.getByTestId('psolve').click();
    await p.getByTestId('psolve-input').fill(txt);
    await p.getByTestId('psolve-ok').click();
  };
  const first = s.current;
  await answer('qualcosa di sbagliato');
  await expect(cond.getByTestId('creview')).toBeVisible({ timeout: 10000 });
  await expect(host.getByTestId('review-ok')).toBeVisible();
  await host.screenshot({ path: `${SHOTS}/schermo-verifica.png` });
  await cond.screenshot({ path: `${SHOTS}/telefono-conduttore-verifica.png` });
  await cond.getByTestId('c-reject').click();
  await expect.poll(async () => (await st(host)).current).toBe((first + 1) % 2);

  // conductor adjusts a score, then accepts a wrong-looking answer
  await cond.getByText('+100').first().click();
  await expect.poll(async () => (await st(host)).players[0].round).toBe(100);
  s = await st(host);
  const winner = s.current;
  await answer('risposta approssimativa');
  await expect(cond.getByTestId('c-accept')).toBeVisible({ timeout: 10000 });
  await cond.getByTestId('c-accept').click();
  await expect.poll(async () => (await st(host)).phase).toBe('roundEnd');
  s = await st(host);
  expect(s.roundWinner).toBe(winner);
  await cond.getByTestId('c-next').click();
  await expect.poll(async () => (await st(host)).round).toBe(1);

  // skip the phrase, then accept a spoken answer
  const before = (await st(host)).phrases[1].text;
  await cond.getByTestId('c-skip').click();
  await expect.poll(async () => (await st(host)).phrases[1].text).not.toBe(before);
  await cond.getByTestId('c-phrase').fill('LA MIA FRASE SEGRETA');
  await cond.getByTestId('c-save').click();
  await expect(cond.getByText('Frase aggiunta')).toBeVisible();
  await cond.getByTestId('c-voice').click();
  await expect.poll(async () => (await st(host)).phase).toBe('gameEnd');
  await host.screenshot({ path: `${SHOTS}/schermo-classifica.png` });
});

test('editor frasi personalizzate: aggiungi, usa solo mie, esporta e importa', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('editor').click();
  await page.getByTestId('ed-text').fill('IL GATTO DI MARCO');
  await page.getByTestId('ed-tema').fill('Amici');
  await page.getByTestId('ed-add').click();
  await page.getByTestId('ed-text').fill('PAROLALUNGHISSIMAXXXXX');
  await page.getByTestId('ed-add').click();
  await expect(page.locator('.ed-msg')).toContainText('Non entra');
  await page.screenshot({ path: `${SHOTS}/editor.png` });
  await page.getByTestId('ed-export').click();
  const json = await page.getByTestId('ed-io').inputValue();
  expect(JSON.parse(json).frasi).toEqual([{ text: 'IL GATTO DI MARCO', tema: 'Amici' }]);
  await page.locator('.ed-item button').click();
  await expect(page.locator('.ed-item')).toHaveCount(0);
  await page.getByTestId('ed-io').fill(json);
  await page.getByTestId('ed-import').click();
  await expect(page.locator('.ed-item')).toHaveCount(1);
  await page.getByTestId('ed-back').click();

  await page.getByTestId('fonte-mie').click();
  await page.getByTestId('preset-libera').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('start').click();
  const s = await st(page);
  expect(s.phrases[0].text).toBe('IL GATTO DI MARCO');
  expect(s.phrases[0].tema).toBe('Amici');
  await page.screenshot({ path: `${SHOTS}/partita-frase-mia.png` });
});
