import { expect, test, Page, Browser } from '@playwright/test';

// Feedback del 2026-10-15: disconnessioni continue, Jolly a scelta, niente tempo con il conduttore.
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

async function lobby(host: Page) {
  await host.goto(`/?test&${PEER}`);
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('preset-libera').click();
  await host.getByTestId('finale-toggle').uncheck();
  await host.getByTestId('rounds-1').click();
  await host.getByTestId('phones').click();
  await expect(host.locator('.lobby[data-code]')).toBeVisible({ timeout: 20000 });
  return (await host.locator('.lobby').getAttribute('data-code'))!;
}

test('il server di collegamento cade: i telefoni restano collegati e la stanza si riapre', async ({ browser }) => {
  const host = await browser.newPage();
  const code = await lobby(host);
  await expect(host.getByTestId('lobby-why')).toContainText('almeno 2');
  const p0 = await phone(browser, code, 'Anna');
  await expect(host.getByTestId('lobby-why')).toContainText('ora 1');
  const p1 = await phone(browser, code, 'Bruno');
  await expect(host.getByTestId('lobby-why')).toHaveText('');
  await host.getByTestId('lobby-start').click();
  await expect(p0.getByTestId('pspin')).toBeVisible({ timeout: 10000 });
  await expect(host.getByTestId('clock')).toContainText(/⏱ (60|59|58)/);

  // what the PeerJS cloud does now and then: drops the websocket of the screen (and of a phone)
  await host.evaluate(() => {
    const peer = (window as any).__ruota.host.peer;
    peer.emit('error', { type: 'network' });
    peer.disconnect();
  });
  await p1.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p0.waitForTimeout(1500);
  await expect(host.locator('.score.off')).toHaveCount(0);
  await expect(p0.locator('.pwarn')).toHaveCount(0);
  await p0.getByTestId('pspin').click();
  await expect.poll(async () => (await st(host)).phase, { timeout: 15000 }).not.toBe('turn');
  // the room is registered again, so a phone that really drops can come back
  await expect.poll(() => host.evaluate(() => (window as any).__ruota.host.peer.disconnected), { timeout: 15000 }).toBe(false);
  await p1.reload();
  await expect(p1.getByTestId('pboard')).toBeVisible({ timeout: 20000 });
  await expect(host.locator('.score.off')).toHaveCount(0, { timeout: 10000 });
});

test('Jolly a scelta dal telefono, consonanti già uscite non segnate', async ({ browser }) => {
  const host = await browser.newPage();
  const code = await lobby(host);
  const p0 = await phone(browser, code, 'Anna');
  await phone(browser, code, 'Bruno');
  await host.getByTestId('lobby-start').click();
  await expect(p0.getByTestId('pspin')).toBeVisible({ timeout: 10000 });
  const s = await st(host);
  const text: string = s.phrases[s.board].text;
  const hit = [...'BCDFGHLMNPQRSTVZ'].find((c) => text.includes(c))!;
  await host.evaluate(() => (window as any).__ruota.force(0));
  await p0.getByTestId(`pkey-${hit}`).click();
  await host.evaluate(() => {
    const r = (window as any).__ruota;
    const w = r.state().wheel;
    r.force(w.findIndex((x: any) => x.kind === 'value' && !x.token));
  });
  // the letter already out is still clickable on the phone
  await expect(p0.getByTestId(`pkey-${hit}`)).toBeEnabled();
  // give Anna a Jolly, then call the same letter again: mistake → she decides
  await host.evaluate(() => {
    const r = (window as any).__ruota;
    r.state().players[0].jolly = true;
  });
  await p0.getByTestId(`pkey-${hit}`).click();
  await expect(p0.getByTestId('pjolly-use')).toBeVisible();
  await p0.getByTestId('pjolly-use').click();
  await expect.poll(async () => (await st(host)).phase).toBe('turn');
  expect((await st(host)).current).toBe(0);
});
