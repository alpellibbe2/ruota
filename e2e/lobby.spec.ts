import { expect, test, Browser } from '@playwright/test';

const SHOTS = 'docs/screenshot/lobby';
const PEER = 'peer=localhost:9000';

async function player(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`/?r=${code}&test&${PEER}`);
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-go').click();
  await expect(page.getByTestId('lobby-me')).toHaveText(name, { timeout: 20000 });
  return page;
}

test('lobby: «Indietro» torna alle impostazioni e chiude la stanza sui telefoni', async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto(`/?test&${PEER}`);
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('phones').click();
  await host.waitForSelector('.lobby[data-code]');
  const code = (await host.locator('.lobby').getAttribute('data-code'))!;
  await host.screenshot({ path: `${SHOTS}/schermo-lobby-vuota.png` });

  const p0 = await player(browser, code, 'Anna');
  await player(browser, code, 'Bruno');
  await expect(host.getByTestId('lobby-start')).toBeEnabled();
  await expect(host.getByTestId('lobby-start')).toHaveText('INIZIA CON 2 GIOCATORI');
  await host.screenshot({ path: `${SHOTS}/schermo-lobby.png` });

  await host.getByTestId('lobby-back').click();
  await expect(host.getByTestId('phones')).toBeVisible();
  await expect(p0.getByText('Lo schermo ha chiuso la stanza')).toBeVisible({ timeout: 10000 });

  // a new room opens fine after going back
  await host.getByTestId('phones').click();
  await host.waitForSelector('.lobby[data-code]');
  expect(await host.locator('.lobby').getAttribute('data-code')).not.toBe(code);
});

test('lobby: «Indietro» mentre la stanza si sta aprendo', async ({ page }) => {
  await page.goto(`/?test&${PEER}`);
  await page.getByTestId('phones').click();
  await page.getByTestId('lobby-back').click();
  await expect(page.getByTestId('phones')).toBeVisible();
  await page.waitForTimeout(1500);
  // the room finished opening in the background: it must not take over the screen
  await expect(page.getByTestId('phones')).toBeVisible();
  await expect(page.locator('.lobby')).toHaveCount(0);
});
