# PROGRESS

## Stato
- **Fase 1 – COMPLETATA**, **Fase 2 – COMPLETATA** (https://alpellibbe2.github.io/ruota/, verificato anche con PeerJS cloud: `PUBLIC=1 npx playwright test e2e/pubblico.spec.ts`).
- **Fase 3 – Conduttore umano + editor frasi**: codice e test e2e verdi. Resta deploy/verifica HTTP 200.
- Prossimo passo: Fase 4 (manche speciali: Express, Jolly, Premio, Cruciruota, Triplete, Jackpot, Ultimo Round). Richiede di generalizzare `GameState` con un tipo di manche (`RoundType`) e un catalogo/preset (Completa/Veloce).

## Struttura
- `src/core/` logica pura (phrase, wheel, game reducer, frasi). Test in `tests/`.
- `src/ui/` rendering (ruota canvas, tabellone DOM, audio WebAudio, css). `src/main.ts` controller.
- `e2e/` test Playwright; screenshot in `docs/screenshot/<fase>/`. `?test` nell'URL espone `window.__ruota.state()` e accelera la ruota.
- Frasi offuscate (rot13+base64) in `src/data/frasi/adulti.json` (campo `t`); il generatore NON è nel repo.
- `src/net/` protocollo (PlayerView filtrata, mai la soluzione), `host.ts` (schermo), `client.ts` (telefono con auto-riconnessione). `src/ui/lobby.ts` (QR+lista), `src/ui/phone.ts` (vista telefono, URL `?r=CODICE`).
- Test e2e usano un server PeerJS locale (`npx peerjs --port 9000`, avviato da playwright.config) con `?peer=localhost:9000`; `?t=ms` cambia il timer di risposta (default 15 s).
- Sessione dello schermo salvata in localStorage (`ruota.sessione`): bottone RIPRENDI PARTITA.
- Conduttore: telefono che apre `?r=CODICE` e preme «Sono il conduttore». Se presente, risposte sbagliate vanno in verifica (`review` in main.ts) con ACCETTA/RIFIUTA anche sullo schermo. Intent in `ConductorIntent` (protocol.ts); azioni reducer FORCE_SOLVE/FORCE_PASS/ADJUST/SKIP.
- Frasi personali: `src/core/frasi.ts` (localStorage `ruota.frasiPersonali`), editor `src/ui/editor.ts`, fonte banca/mie/mix nelle impostazioni.
