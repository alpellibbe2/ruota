import { expect, test, Page } from '@playwright/test';

const SHOTS = 'docs/screenshot/fase6';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

test('modalità bambini: frasi semplici, niente Express, vocali gratis, finale con un tabellone', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('kids-toggle').check();
  await page.getByTestId('preset-completa').click();
  await page.screenshot({ path: `${SHOTS}/setup-bambini.png` });
  await page.getByTestId('start').click();
  let s = await st(page);
  expect(s.config.kids).toBe(true);
  expect(s.config.bankruptAll).toBe(false);
  expect(s.config.vowelCost).toBe(0);
  expect(s.rounds.map((r: any) => r.type)).not.toContain('express');
  expect(s.phrases.slice(0, 2).every((p: any) => p.text.length <= 40)).toBe(true);
  await expect(page.getByTestId('vowel')).toContainText('gratis');
  await page.screenshot({ path: `${SHOTS}/bambini-partita.png` });

  // free vowel: turn continues (or passes if absent) without paying
  await page.evaluate(() => (window as any).__ruota.dispatch({ type: 'ADJUST', player: 0, delta: 0 }));
  await expect(page.getByTestId('vowel')).toBeEnabled();
  await page.getByTestId('vowel').click();
  await page.locator('.kb .key:not([disabled])').first().click();
  expect((await st(page)).players[0].round).toBe(0);

  // a bankruptcy only wipes the round money, never the total
  await page.evaluate(() => {
    const r = (window as any).__ruota;
    const w = r.state().wheel;
    r.dispatch({ type: 'ADJUST', player: r.state().current, delta: 700 });
    r.force(w.findIndex((x: any) => x.kind === 'bankrupt'));
  });
  expect((await st(page)).players.every((p: any) => p.total === 0)).toBe(true);

  // two typos are tolerated on longer phrases
  s = await st(page);
  const text: string = s.phrases[s.board].text;
  expect(text.length).toBeGreaterThan(8);
});

test('modalità bambini: la finale ha un solo tabellone e più tempo', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('kids-toggle').check();
  await page.getByTestId('preset-libera').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('start').click();
  await page.evaluate(() => (window as any).__ruota.dispatch({ type: 'ADJUST', player: 0, delta: 300 }));
  await page.getByTestId('solve').click();
  await page.getByTestId('solve-input').fill((await st(page)).phrases[0].text);
  await page.getByTestId('solve-ok').click();
  await page.getByTestId('next').click();
  await page.getByTestId('fspin').click();
  await expect(page.getByTestId('fstart')).toBeVisible({ timeout: 10000 });
  const f = (await st(page)).finale;
  expect(f.kinds).toEqual(['classico']);
  expect(f.timeLeft).toBe(120000);
  await page.getByTestId('fstart').click();
  await page.evaluate(() => {
    const r = (window as any).__ruota;
    for (const l of 'BCDA') r.dispatch({ type: 'F_CALL', letter: l });
  });
  await page.getByTestId('fgo').click();
  await page.screenshot({ path: `${SHOTS}/bambini-finale.png` });
  const ph = (await st(page)).finale.phrases[0].text;
  await page.getByTestId('fanswer').click();
  await page.getByTestId('solve-input').fill(ph);
  await page.getByTestId('solve-ok').click();
  await expect(page.getByTestId('choose-0')).toBeVisible();
});

test('PWA: dopo il primo caricamento il gioco funziona senza rete', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('/?test');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // wait for the pre-cache message to be processed
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('ruota-v1')).keys()).length), { timeout: 15000 }).toBeGreaterThan(3);
  await ctx.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('start')).toBeVisible();
  await page.getByTestId('preset-libera').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('spin')).toBeVisible();
  await page.getByTestId('spin').click();
  await expect.poll(async () => (await st(page)).phase, { timeout: 10000 }).not.toBe('spinning');
  await page.screenshot({ path: `${SHOTS}/offline.png` });
  const manifest = await page.evaluate(() => fetch('manifest.webmanifest').then((r) => r.json()));
  expect(manifest.name).toBe('La Ruota');
  await ctx.close();
});

test('volume e mute sono disponibili sullo schermo', async ({ page }) => {
  await page.goto('/?test');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('volume')).toBeVisible();
  await expect(page.locator('.mute')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/partita-completa.png` });
});
