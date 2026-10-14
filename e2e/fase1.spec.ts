import { expect, test, Page } from '@playwright/test';

const SHOTS = 'docs/screenshot/fase1';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

test('partita completa su un dispositivo', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: `${SHOTS}/setup.png` });

  await page.getByTestId('preset-libera').click();
  await page.getByTestId('players-4').click();
  await page.getByTestId('name-0').fill('Anna');
  await page.getByTestId('rounds-2').click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('spin')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/inizio-turno.png` });

  // Spin until a value segment is hit, then call a consonant.
  let shot = false;
  for (let i = 0; i < 30; i++) {
    await page.getByTestId('spin').click();
    await page.waitForFunction(() => !['spinning'].includes((window as any).__ruota.state().phase), null, { timeout: 15000 });
    const s = await st(page);
    if (s.phase === 'consonant') {
      if (!shot) { await page.screenshot({ path: `${SHOTS}/scelta-consonante.png` }); shot = true; }
      const keys = page.locator('.kb .key:not([disabled])');
      await keys.first().click();
    }
    const after = await st(page);
    if (after.phase === 'turn' && after.players[after.current].round >= 500) break;
    if (after.phase === 'turn' && after.called.length > 0 && i > 8) break;
  }
  expect((await st(page)).called.length).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOTS}/lettere-scoperte.png` });

  // A wrong solution passes the turn.
  const before = await st(page);
  await page.getByTestId('solve').click();
  await page.getByTestId('solve-input').fill('zzz xxx');
  await page.getByTestId('solve-ok').click();
  expect((await st(page)).current).toBe((before.current + 1) % 4);

  // Solve both rounds with the real solution.
  for (let r = 0; r < 2; r++) {
    const s = await st(page);
    await page.getByTestId('solve').click();
    await page.getByTestId('solve-input').fill(s.phrases[s.round].text.toLowerCase());
    await page.getByTestId('solve-ok').click();
    if (r === 0) {
      await expect(page.getByTestId('next')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/fine-manche.png` });
      await page.getByTestId('next').click();
    }
  }
  await expect(page.getByTestId('again')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/classifica.png` });
  const end = await st(page);
  expect(end.phase).toBe('gameEnd');
  expect(end.players.reduce((a: number, p: any) => a + p.total, 0)).toBeGreaterThanOrEqual(0);
});

test('vista telefono 390x844 resta utilizzabile (scala)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/?test');
  await page.screenshot({ path: `${SHOTS}/telefono-setup.png` });
  await expect(page.getByTestId('start')).toBeVisible();
  await ctx.close();
});
