import { expect, test, Page, Browser } from '@playwright/test';

const SHOTS = 'docs/screenshot/fase2';
const PEER = 'peer=localhost:9000';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

async function phone(browser: Browser, code: string, name: string, n: number) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`/?r=${code}&test&${PEER}`);
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-go').click();
  await expect(page.getByTestId('lobby-me')).toHaveText(name, { timeout: 20000 });
  if (n === 0) await page.screenshot({ path: `${SHOTS}/telefono-lobby.png` });
  return page;
}

test('uno schermo e tre telefoni: lobby, giri, risoluzione, riconnessione, timeout', async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto(`/?test&${PEER}&t=3000`);
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('rounds-1').click();
  await host.getByTestId('phones').click();
  await expect(host.locator('.lobby[data-code]')).toBeVisible({ timeout: 20000 });
  const code = (await host.locator('.lobby').getAttribute('data-code'))!;
  expect(code).toMatch(/^[A-Z]{4}$/);
  await host.screenshot({ path: `${SHOTS}/schermo-lobby-vuota.png` });

  const names = ['Anna', 'Bruno', 'Carla'];
  const phones: Page[] = [];
  for (let i = 0; i < 3; i++) phones.push(await phone(browser, code, names[i], i));
  await expect(host.locator('.lp:not(.cond)')).toHaveCount(3);
  await host.screenshot({ path: `${SHOTS}/schermo-lobby.png` });
  await host.getByTestId('lobby-start').click();

  await expect(phones[0].getByTestId('pboard')).toBeVisible({ timeout: 10000 });
  let s = await st(host);
  expect(s.players.map((p: any) => p.name)).toEqual(names);
  // the phone board must never contain the solution
  const html = await phones[0].content();
  for (const w of s.phrases[0].text.split(' ').filter((w: string) => w.length > 4)) expect(html).not.toContain(w);
  await phones[0].screenshot({ path: `${SHOTS}/telefono-turno.png` });
  await phones[1].screenshot({ path: `${SHOTS}/telefono-attesa.png` });
  await host.screenshot({ path: `${SHOTS}/schermo-partita.png` });

  // Not my turn: spin from player 1 must be ignored (button not shown); timeout passes the turn.
  expect(s.current).toBe(0);
  await expect.poll(async () => (await st(host)).current, { timeout: 8000 }).toBe(1);

  // Player 1's phone spins; then answers the consonant prompt if any.
  let tookConsonant = false;
  for (let i = 0; i < 12 && !tookConsonant; i++) {
    s = await st(host);
    const p = phones[s.current];
    await expect(p.getByTestId('pspin')).toBeVisible({ timeout: 10000 });
    await p.getByTestId('pspin').click();
    await expect.poll(async () => (await st(host)).phase, { timeout: 20000 }).not.toBe('spinning');
    s = await st(host);
    if (s.phase === 'consonant') {
      const pk = phones[s.current];
      await pk.screenshot({ path: `${SHOTS}/telefono-consonante.png` });
      await pk.locator('.pkey:not([disabled])').first().click();
      tookConsonant = true;
    }
  }
  expect(tookConsonant).toBe(true);
  await host.screenshot({ path: `${SHOTS}/schermo-dopo-lettera.png` });

  // Reconnection: reload a phone in the middle of the game.
  await phones[2].reload();
  await expect(phones[2].getByTestId('pboard')).toBeVisible({ timeout: 25000 });
  s = await st(host);
  expect(await host.locator('.score.off').count()).toBe(0);

  // Solve through the phone of the current player.
  await expect.poll(async () => (await st(host)).phase, { timeout: 10000 }).toBe('turn');
  s = await st(host);
  const cur = phones[s.current];
  await cur.getByTestId('psolve').click();
  await cur.getByTestId('psolve-input').fill(s.phrases[0].text.toLowerCase());
  await cur.getByTestId('psolve-ok').click();
  await expect.poll(async () => (await st(host)).phase, { timeout: 10000 }).toBe('gameEnd');
  await host.screenshot({ path: `${SHOTS}/schermo-classifica.png` });
  await phones[0].screenshot({ path: `${SHOTS}/telefono-fine.png` });
});
