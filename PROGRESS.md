# PROGRESS

## Stato
- **Fase 1 – Tutto su un dispositivo**: codice completo, test verdi (vitest + playwright). Resta da verificare il deploy su Pages.
- Prossimo passo: verificare l'azione di deploy e HTTP 200 del sito; poi segnare la Fase 1 completata e iniziare la Fase 2 (PeerJS).

## Struttura
- `src/core/` logica pura (phrase, wheel, game reducer, frasi). Test in `tests/`.
- `src/ui/` rendering (ruota canvas, tabellone DOM, audio WebAudio, css). `src/main.ts` controller.
- `e2e/` test Playwright; screenshot in `docs/screenshot/<fase>/`. `?test` nell'URL espone `window.__ruota.state()` e accelera la ruota.
- Frasi offuscate (rot13+base64) in `src/data/frasi/adulti.json` (campo `t`); il generatore NON è nel repo.
