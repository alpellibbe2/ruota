import { expect, test } from '@playwright/test';

// Smoke test against the deployed site and the public PeerJS server. Run with PUBLIC=1.
test.skip(!process.env.PUBLIC, 'solo con PUBLIC=1');

test('sito pubblicato: schermo e telefono si collegano via PeerJS cloud', async ({ browser }) => {
  const url = 'https://alpellibbe2.github.io/ruota/';
  const host = await browser.newPage();
  await host.goto(url);
  await host.getByTestId('phones').click();
  await expect(host.locator('.lobby[data-code]')).toBeVisible({ timeout: 30000 });
  const code = (await host.locator('.lobby').getAttribute('data-code'))!;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ph = await ctx.newPage();
  await ph.goto(`${url}?r=${code}`);
  await ph.getByTestId('join-name').fill('Test');
  await ph.getByTestId('join-go').click();
  await expect(ph.getByTestId('lobby-me')).toHaveText('Test', { timeout: 30000 });
  await expect(host.locator('.lp')).toHaveCount(1);
});
