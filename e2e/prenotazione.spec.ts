import { expect, test, Page } from '@playwright/test';

const SHOTS = 'docs/screenshot/prenotazione';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

test('partita veloce «Solo prenotazione»: tre manche di Ultimo Round e niente finale', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('preset-ultimo').click();
  await expect(page.getByTestId('preset-info')).toContainText('Ultimo Round');
  await expect(page.getByTestId('finale-toggle')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/setup.png` });
  await page.getByTestId('start').click();

  let s = await st(page);
  expect(s.rounds.map((r: { type: string }) => r.type)).toEqual(['ultimo', 'ultimo', 'ultimo']);
  expect(s.phrases).toHaveLength(6);
  expect(s.finaleSetup).toBeUndefined();
  await expect(page.getByTestId('book-0')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/manche.png` });

  // every phrase: a player books and solves; after each round, the next one
  for (let board = 0; board < 6; board++) {
    await expect(page.getByTestId('book-1')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('book-1').click();
    s = await st(page);
    await page.getByTestId('solve-input').fill(s.phrases[s.board].text);
    await page.getByTestId('solve-ok').click();
    if (board % 2 === 1 && board < 5) {
      await expect(page.getByTestId('next')).toHaveText('PROSSIMA MANCHE');
      await page.getByTestId('next').click();
    }
  }
  await expect(page.getByTestId('again')).toBeVisible({ timeout: 10000 });
  expect((await st(page)).phase).toBe('gameEnd');
});
