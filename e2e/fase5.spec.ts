import { expect, test, Page, Browser } from '@playwright/test';

const SHOTS = 'docs/screenshot/fase5';
const PEER = 'peer=localhost:9000';
const st = (p: Page) => p.evaluate(() => (window as any).__ruota.state());

test('finale su un dispositivo: ruota delle buste, tre tabelloni, scelta della busta', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('preset-libera').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('start').click();

  // The only round: player 0 solves it and has the highest total -> champion? give a head start to player 1.
  await page.evaluate(() => {
    const r = (window as any).__ruota;
    r.dispatch({ type: 'ADJUST', player: 0, delta: 500 });
  });
  let s = await st(page);
  await page.getByTestId('solve').click();
  await page.getByTestId('solve-input').fill(s.phrases[s.board].text);
  await page.getByTestId('solve-ok').click();
  await expect(page.getByTestId('next')).toHaveText('VAI ALLA FINALE');
  await page.getByTestId('next').click();

  await expect(page.getByTestId('fspin')).toBeVisible();
  await expect(page.locator('.roundtag')).toContainText('FINALE');
  await page.screenshot({ path: `${SHOTS}/finale-ruota.png` });
  await page.getByTestId('fspin').click();
  await expect(page.getByTestId('fstart')).toBeVisible({ timeout: 10000 });
  s = await st(page);
  expect(s.finale.envelopes).toHaveLength(3);
  expect(new Set(s.finale.envelopes).size).toBe(3);
  await page.screenshot({ path: `${SHOTS}/finale-buste.png` });

  // Board 1: classic, with RSTLNE shown. Letters are chosen with the clock stopped.
  await page.getByTestId('fstart').click();
  s = await st(page);
  expect(s.finale.stage).toBe('letters');
  expect(s.finale.called).toEqual([...'RSTLNE']);
  await page.getByTestId('ftab-cons').click();
  await page.locator('.kb .key:not([disabled])').first().click();
  expect((await st(page)).finale.consonantsLeft).toBe(2);
  await expect(page.getByTestId('fgo')).toBeDisabled();
  /** Pick the remaining letters (Rubasecondi: just the vowel), check the clock is still, then VIA. */
  const pickAndGo = async () => {
    let f = (await st(page)).finale;
    const t0 = f.timeLeft;
    if (f.kinds[f.boardIdx] !== 'rubasecondi') {
      await page.getByTestId('ftab-cons').click();
      while ((await st(page)).finale.consonantsLeft > 0) await page.locator('.kb .key:not([disabled])').first().click();
    }
    await page.getByTestId('ftab-vowel').click();
    while ((await st(page)).finale.vowelsLeft > 0) await page.locator('.kb .key:not([disabled])').first().click();
    await page.waitForTimeout(400);
    f = (await st(page)).finale;
    expect(f.timeLeft).toBe(t0); // no clock while choosing
    await page.getByTestId('fgo').click();
    expect((await st(page)).finale.stage).toBe('board');
  };
  const solve = async (txt?: string) => {
    const f = (await st(page)).finale;
    await page.getByTestId('solve-input').fill(txt ?? f.phrases[f.boardIdx].text);
    await page.getByTestId('solve-ok').click();
  };
  await pickAndGo();
  await page.screenshot({ path: `${SHOTS}/finale-tabellone1.png` });
  await solve('sbagliato');
  expect((await st(page)).finale.won[0]).toBe(false);
  await solve();
  s = await st(page);
  expect(s.finale.stage).toBe('pause');
  expect(s.finale.won[0]).toBe(true);
  const kept = s.finale.timeLeft;
  await page.waitForTimeout(600);
  expect((await st(page)).finale.timeLeft).toBe(kept); // waiting for «PRONTO»
  await page.screenshot({ path: `${SHOTS}/finale-pronto.png` });
  await page.getByTestId('fstart').click();

  // Board 2: Testacoda, no letters to choose: head and tail letters and the clock start at «PRONTO»;
  // the champion stops to save time
  s = await st(page);
  expect(s.finale.boardIdx).toBe(1);
  expect(s.finale.stage).toBe('board');
  expect(s.finale.forced.length).toBeGreaterThan(2);
  expect(s.finale.called).toEqual([]);
  await expect(page.getByTestId('fstop')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/finale-testacoda.png` });
  await page.getByTestId('fstop').click();
  s = await st(page);
  expect(s.finale.stage).toBe('pause');
  expect(s.finale.won[1]).toBe(false);
  // the solution is on the board
  await expect(page.locator('.tile.covered')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/finale-stop.png` });
  await page.getByTestId('fstart').click();

  // Board 3: Rubasecondi, an absent consonant costs 3 seconds at VIA
  s = await st(page);
  expect(s.finale.boardIdx).toBe(2);
  const before = s.finale.timeLeft;
  const absent = await page.evaluate(() => {
    const r = (window as any).__ruota.state().finale;
    const t = r.phrases[2].text;
    return [...'BCDFGHLMNPQRSTVZ'].find((c) => !t.includes(c));
  });
  await page.getByTestId('ftab-cons').click();
  await page.getByTestId(`key-${absent}`).click();
  await pickAndGo();
  const after = (await st(page)).finale.timeLeft;
  expect(before - after).toBeGreaterThanOrEqual(3000);
  await page.screenshot({ path: `${SHOTS}/finale-rubasecondi.png` });
  await solve();

  // Choose an envelope
  await expect(page.getByTestId('choose-1')).toBeDisabled(); // stopped: not won
  await page.screenshot({ path: `${SHOTS}/finale-scelta.png` });
  await page.getByTestId('choose-2').click();
  await expect(page.getByTestId('fend')).toBeVisible();
  s = await st(page);
  expect(s.finale.prize).toBe(s.finale.values[s.finale.envelopes[2]]);
  await page.screenshot({ path: `${SHOTS}/finale-rivelazione.png` });
  const champ = s.finale.champion;
  const total = s.players[champ].total;
  await page.getByTestId('fend').click();
  await expect(page.getByTestId('again')).toBeVisible();
  expect((await st(page)).players[champ].total).toBe(total + s.finale.prize);
  await page.screenshot({ path: `${SHOTS}/finale-classifica.png` });
});

test('finale: il tempo scade, la busta si sceglie tra quelle conquistate', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('preset-libera').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('start').click();
  await page.evaluate(() => (window as any).__ruota.dispatch({ type: 'ADJUST', player: 0, delta: 500 }));
  await page.getByTestId('solve').click();
  await page.getByTestId('solve-input').fill((await st(page)).phrases[0].text);
  await page.getByTestId('solve-ok').click();
  await page.getByTestId('next').click();
  await page.getByTestId('fspin').click();
  await expect(page.getByTestId('fstart')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('fstart').click();
  await page.evaluate(() => {
    const r = (window as any).__ruota;
    for (const l of 'BCDA') r.dispatch({ type: 'F_CALL', letter: l });
    r.dispatch({ type: 'F_GO' });
    r.dispatch({ type: 'F_TICK', ms: 60000 });
  });
  await expect(page.locator('.hint')).toContainText('Nessun premio');
  expect((await st(page)).finale.prize).toBe(0);
});

test('finale: spegnere il gioco finale chiude la partita dopo l’ultima manche', async ({ page }) => {
  await page.goto('/?test');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('preset-libera').click();
  await page.getByTestId('rounds-1').click();
  await page.getByTestId('finale-toggle').uncheck();
  await page.getByTestId('start').click();
  await page.evaluate(() => (window as any).__ruota.dispatch({ type: 'ADJUST', player: 0, delta: 500 }));
  await page.getByTestId('solve').click();
  await page.getByTestId('solve-input').fill((await st(page)).phrases[0].text);
  await page.getByTestId('solve-ok').click();
  await expect(page.getByTestId('again')).toBeVisible();
});

async function phone(browser: Browser, code: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`/?r=${code}&test&${PEER}`);
  await page.getByTestId('join-name').fill(name);
  await page.getByTestId('join-go').click();
  await expect(page.getByTestId('lobby-me')).toHaveText(name, { timeout: 20000 });
  return page;
}

test('finale con i telefoni: solo il campione comanda', async ({ browser }) => {
  const host = await browser.newPage();
  await host.goto(`/?test&${PEER}&t=60000`);
  await host.evaluate(() => localStorage.clear());
  await host.reload();
  await host.getByTestId('preset-libera').click();
  await host.getByTestId('rounds-1').click();
  await host.getByTestId('phones').click();
  await host.waitForSelector('.lobby[data-code]');
  const code = (await host.locator('.lobby').getAttribute('data-code'))!;
  const p0 = await phone(browser, code, 'Anna');
  const p1 = await phone(browser, code, 'Bruno');
  await host.getByTestId('lobby-start').click();
  await expect(p0.getByTestId('psolve')).toBeVisible({ timeout: 10000 });

  await host.evaluate(() => (window as any).__ruota.dispatch({ type: 'ADJUST', player: 0, delta: 500 }));
  // Anna solves the only round; she is the champion (highest total after the round)
  await p0.getByTestId('psolve').click();
  await p0.getByTestId('psolve-input').fill((await st(host)).phrases[0].text);
  await p0.getByTestId('psolve-ok').click();
  await expect(host.getByTestId('next')).toBeVisible();
  await host.getByTestId('next').click();

  await expect(p0.getByTestId('pspin')).toBeVisible({ timeout: 10000 });
  await expect(p1.getByText('Tifa per Anna')).toBeVisible();
  await p0.screenshot({ path: `${SHOTS}/telefono-campione-ruota.png` });
  await p1.screenshot({ path: `${SHOTS}/telefono-tifoso.png` });
  await p0.getByTestId('pspin').click();
  await expect(p0.getByTestId('pfstart')).toBeVisible({ timeout: 15000 });
  await p0.screenshot({ path: `${SHOTS}/telefono-campione-pronto.png` });
  await p0.getByTestId('pfstart').click();
  await expect(p0.getByTestId('pftab-cons')).toBeVisible();
  await p0.screenshot({ path: `${SHOTS}/telefono-campione-lettere.png` });
  // the solution is never sent to the phones
  const html = await p1.content();
  const words = (await st(host)).finale.phrases[0].text.split(' ').filter((w: string) => w.length > 4);
  for (const w of words) expect(html).not.toContain(w);
  for (let i = 0; i < 3; i++) {
    if (i > 0) await p0.getByTestId('pfstart').click();
    let f = (await st(host)).finale;
    await expect.poll(async () => (await st(host)).finale.stage).toBe(f.kinds[i] === 'testacoda' ? 'board' : 'letters');
    f = (await st(host)).finale;
    if (f.kinds[i] === 'testacoda') {
      // nothing to choose: straight to the solution
    } else if (f.kinds[i] !== 'rubasecondi') {
      await p0.getByTestId('pftab-cons').click();
      while ((await st(host)).finale.consonantsLeft > 0) {
        const left = (await st(host)).finale.consonantsLeft;
        await p0.locator('.pkb .pkey:not([disabled])').first().click();
        await expect.poll(async () => (await st(host)).finale.consonantsLeft).toBe(left - 1);
      }
    }
    if (f.kinds[i] !== 'testacoda') {
      await p0.getByTestId('pftab-vowel').click();
      while ((await st(host)).finale.vowelsLeft > 0) {
        const left = (await st(host)).finale.vowelsLeft;
        await p0.locator('.pkb .pkey:not([disabled])').first().click();
        await expect.poll(async () => (await st(host)).finale.vowelsLeft).toBe(left - 1);
      }
      await expect(p0.getByTestId('pfgo')).toBeEnabled();
      await p0.getByTestId('pfgo').click();
    }
    await expect(p0.getByTestId('pfstop')).toBeVisible();
    if (i === 0) {
      await expect(p0.getByTestId('ptimer')).toContainText('⏱');
      await p0.screenshot({ path: `${SHOTS}/telefono-campione-tabellone.png` });
    }
    f = (await st(host)).finale;
    await p0.getByTestId('psolve-input').fill(f.phrases[f.boardIdx].text);
    await p0.getByTestId('psolve-ok').click();
    await expect.poll(async () => (await st(host)).finale.won.filter(Boolean).length).toBe(i + 1);
  }
  await expect(p0.getByTestId('pchoose-2')).toBeVisible();
  await p0.getByTestId('pchoose-2').click();
  await expect(host.getByTestId('fend')).toBeVisible();
  await host.getByTestId('fend').click();
  await expect.poll(async () => (await st(host)).phase).toBe('gameEnd');
});
