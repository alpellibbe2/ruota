import { expect, test, Page, Browser } from '@playwright/test';

// Smoke test against the home install (deploy/installa.sh). Run with CASA=http://<ip-del-ct>/
const CASA = process.env.CASA ?? '';
test.skip(!CASA, 'solo con CASA=http://<ip>/');
test.use({ baseURL: CASA });

const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

async function phone(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  // keep a handle on every WebRTC connection to check which path it uses
  await ctx.addInitScript(() => {
    const Orig = window.RTCPeerConnection;
    (window as any).__pcs = [];
    window.RTCPeerConnection = class extends Orig {
      constructor(c?: RTCConfiguration) { super(c); (window as any).__pcs.push(this); }
    } as typeof RTCPeerConnection;
  });
  const page = await ctx.newPage();
  await page.goto(`./?r=${code}&test`);
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-go').click();
  await expect(page.getByTestId('lobby-me')).toHaveText(name, { timeout: 30000 });
  return page;
}

test('server di casa: due telefoni si collegano e giocano', async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto('./?test');
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('preset-libera').click();
  await host.getByTestId('finale-toggle').uncheck();
  await host.getByTestId('rounds-1').click();
  await host.getByTestId('phones').click();
  await expect(host.locator('.lobby[data-code]')).toBeVisible({ timeout: 20000 });
  const code = (await host.locator('.lobby').getAttribute('data-code'))!;

  const phones = [await phone(browser, code, 'Anna'), await phone(browser, code, 'Bruno')];
  await expect(host.locator('.lp:not(.cond):not(.empty)')).toHaveCount(2);
  await host.getByTestId('lobby-start').click();
  await expect(phones[0].getByTestId('pboard')).toBeVisible({ timeout: 15000 });

  // the player on turn spins from the phone: the intent must reach the screen
  const s = await st(host);
  await phones[s.current].getByTestId('pspin').click();
  await expect.poll(async () => (await st(host)).phase, { timeout: 20000 }).not.toBe(s.phase);

  // candidate type of the active pair: 'relay' means the traffic goes through the TURN server
  const types = await phones[0].evaluate(async () => {
    const out: string[] = [];
    for (const pc of (window as any).__pcs as RTCPeerConnection[]) {
      const stats = await pc.getStats();
      stats.forEach((r: any) => {
        if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') out.push(stats.get(r.localCandidateId).candidateType);
      });
    }
    return out;
  });
  console.log('tipo di collegamento del telefono:', types.join(', '));
  expect(types.length).toBeGreaterThan(0);
  const rete = await (await fetch(new URL('rete.json', CASA))).json();
  if (rete.relay) expect(types.every((t) => t === 'relay')).toBe(true);
});
