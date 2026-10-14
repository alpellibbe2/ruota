# PROGRESS

## Stato
- **Fasi 1, 2, 3, 4 – COMPLETATE** (https://alpellibbe2.github.io/ruota/).
- **Fase 5 – Ruota delle Meraviglie**: codice e test (vitest 46 + e2e 13) verdi. Deploy ok (HTTP 200). **Fase 5 COMPLETATA.**
- Prossimo passo: Fase 6 (modalità bambini con banca frasi dedicata, banca frasi completa ~300 adulti + 100 bambini, rifinitura grafica/audio, PWA offline con service worker).

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
- Manche (src/core/rounds.ts): classica, tema, express, cruciruota, triplete, jackpot, ultimo. `GameState.rounds[]` + `phrases[]` piatto + `board` (indice globale). Preset Veloce/Completa/Libera in impostazioni (Libera = scelta del tipo per ogni manche; i test e2e usano Libera).
- Gettoni Jolly/Premio/Jackpot in `Player`; spicchi speciali in `wheelFor(type)`. Cruciruota: `src/core/crossword.ts` (max 7×14). Ultimo Round: REVEAL/BOOK nel reducer, timer di scoperta nel controller (main.ts, 2,5 s).
- Hook test: `?test` espone `window.__ruota.{state,dispatch,force(idx)}`.
- Finale: `src/core/finale.ts` (FinaleState dentro `GameState.finale`, azioni F_*). Dopo l'ultima manche `toFinale` → NEXT_ROUND (con frase spareggio) → eventuale spareggio ultimo-round tra i pari → `phase: 'finale'`. Tick 60 s nel controller (main.ts `syncFinaleTimer`). Vista telefono del campione in phone.ts (`v.finale`). Spegnibile dalle impostazioni (checkbox).
- I test e2e vecchi disattivano il finale con `finale-toggle`.
