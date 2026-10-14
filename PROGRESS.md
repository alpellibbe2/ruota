# PROGRESS

## Stato
- **Fase 1 – COMPLETATA** (deploy ok: https://alpellibbe2.github.io/ruota/, HTTP 200).
- Prossimo passo: Fase 2 (PeerJS: host sullo schermo, telefoni come client, QR, lobby, swipe, riconnessione). Serve: installare peerjs + qrcode, protocollo messaggi in src/net/, vista telefono in route `#/g/CODICE`.

## Struttura
- `src/core/` logica pura (phrase, wheel, game reducer, frasi). Test in `tests/`.
- `src/ui/` rendering (ruota canvas, tabellone DOM, audio WebAudio, css). `src/main.ts` controller.
- `e2e/` test Playwright; screenshot in `docs/screenshot/<fase>/`. `?test` nell'URL espone `window.__ruota.state()` e accelera la ruota.
- Frasi offuscate (rot13+base64) in `src/data/frasi/adulti.json` (campo `t`); il generatore NON è nel repo.
