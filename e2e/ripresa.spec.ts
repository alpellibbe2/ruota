import { expect, test, Page, Browser } from '@playwright/test';

const PEER = 'peer=localhost:9000';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

async function phone(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`/?r=${code}&test&${PEER}`);
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-go').click();
  await expect(page.getByTestId('lobby-me')).toHaveText(name, { timeout: 20000 });
  return page;
}

test('lo schermo si ricarica a metà partita: la partita riprende e i telefoni rientrano', async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto(`/?test&${PEER}&t=60000`);
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('preset-libera').click();
  await host.getByTestId('finale-toggle').uncheck();
  await host.getByTestId('rounds-2').click();
  await host.getByTestId('phones').click();
  await host.waitForSelector('.lobby[data-code]');
  const code = (await host.locator('.lobby').getAttribute('data-code'))!;
  const p0 = await phone(browser, code, 'Anna');
  const p1 = await phone(browser, code, 'Bruno');
  await host.getByTestId('lobby-start').click();
  await expect(p0.getByTestId('pspin')).toBeVisible({ timeout: 10000 });
  await host.evaluate(() => (window as any).__ruota.dispatch({ type: 'ADJUST', player: 0, delta: 700 }));
  const before = await st(host);

  await host.reload();
  await expect(host.getByTestId('resume')).toBeVisible();
  await host.getByTestId('resume').click();
  // the game object exists only once the room is open again
  await expect.poll(() => host.evaluate(() => (window as any).__ruota?.state().players[0].round), { timeout: 20000 }).toBe(700);
  const after = await st(host);
  expect(after.phrases[after.board].text).toBe(before.phrases[before.board].text);
  expect(after.current).toBe(before.current);
  // phones come back on their own with the same seats
  await expect(host.locator('.score.off')).toHaveCount(0, { timeout: 30000 });
  await expect(p0.getByTestId('pspin')).toBeVisible({ timeout: 30000 });
  await expect(p1.getByTestId('pboard')).toBeVisible();
  await p0.getByTestId('psolve').click();
  await p0.getByTestId('psolve-input').fill(after.phrases[after.board].text);
  await p0.getByTestId('psolve-ok').click();
  await expect.poll(async () => (await st(host)).phase).toBe('roundEnd');
});
