# PROGRESS

## Stato
- **Fase 1 – COMPLETATA** (https://alpellibbe2.github.io/ruota/).
- **Fase 2 – Telefoni**: codice completo e test e2e verdi (1 schermo + 3 telefoni via PeerJS con server locale). Resta il deploy/verifica HTTP 200.
- Prossimo passo: Fase 3 (conduttore umano + editor frasi personalizzate).

## Struttura
- `src/core/` logica pura (phrase, wheel, game reducer, frasi). Test in `tests/`.
- `src/ui/` rendering (ruota canvas, tabellone DOM, audio WebAudio, css). `src/main.ts` controller.
- `e2e/` test Playwright; screenshot in `docs/screenshot/<fase>/`. `?test` nell'URL espone `window.__ruota.state()` e accelera la ruota.
- Frasi offuscate (rot13+base64) in `src/data/frasi/adulti.json` (campo `t`); il generatore NON è nel repo.
- `src/net/` protocollo (PlayerView filtrata, mai la soluzione), `host.ts` (schermo), `client.ts` (telefono con auto-riconnessione). `src/ui/lobby.ts` (QR+lista), `src/ui/phone.ts` (vista telefono, URL `?r=CODICE`).
- Test e2e usano un server PeerJS locale (`npx peerjs --port 9000`, avviato da playwright.config) con `?peer=localhost:9000`; `?t=ms` cambia il timer di risposta (default 15 s).
- Sessione dello schermo salvata in localStorage (`ruota.sessione`): bottone RIPRENDI PARTITA.
