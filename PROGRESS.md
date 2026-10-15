# PROGRESS

## Stato
- **Fasi 1–5 COMPLETATE**. **Fase 6** (bambini, banca frasi 355+120, PWA offline, rifiniture): codice e test verdi (vitest 48 + e2e 17). Deploy ok, smoke test pubblico ok. **Tutte le fasi completate.**
- Sito: https://alpellibbe2.github.io/ruota/ (GitHub Pages, deploy a ogni push). Server di casa (`deploy/`) disponibile come alternativa, non in uso.

- 2026-10-15: richieste dopo la prima prova (tempo 60 s, conduttore decide il tempo, consonanti uscite non segnate, Jolly a scelta, motivi dei blocchi, fix disconnessioni). Vedi DECISIONI.md. vitest 49 + e2e 20 verdi.

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
- Fase 6: `config.kids` (setup: checkbox) → banca `bambini.json` (`setKidsMode`), preset senza Express, vocali gratis, Bancarotta solo manche, tolleranza 2 refusi, timer risposta 45 s, finale 1 tabellone/120 s, tastiera grande. PWA: `public/sw.js` (cache runtime + precache dei file caricati), `manifest.webmanifest`, icone generate.
- `deploy/`: pacchetto per il mini PC (nginx + server PeerJS + coturn). `rete.json` a runtime attiva PeerJS sulla stessa origine e il TURN; `e2e/casa.spec.ts` prova un'installazione (`CASA=http://<ip>/`).
- Lobby: «← Indietro» (testid `lobby-back`) torna alle impostazioni; `Host.closeRoom(reason)` avvisa i telefoni (messaggio `rejected`, smettono di riconnettersi) e chiude la stanza. Lista a 6 posti con posti vuoti (`.lp.empty`), contatore n/6. Test: `e2e/lobby.spec.ts`.
- Tema colori ispirato allo studio TV: token CSS in `:root` (style.css: --yellow, --cyan, --magenta, --purple, --violet, --blue…), ruota viola/blu notte/blu/azzurro con valori gialli (wheelView.ts), tabellone con caselle bianche su celle blu e cornice bianca + neon magenta, tema in barra viola sotto il tabellone, `PLAYER_COLORS` rosso/arancio/blu/verde/viola/ciano.
- Font: Montserrat (testi, tabellone, pulsanti; sostituto libero del Gotham dello studio) e Nunito 900 per i numeri della ruota (sostituto del Gotham Rounded), da Google Fonts in index.html. La ruota si ridisegna a `document.fonts.ready`.
- Finale: fasi `letters` (lettere scelte a tempo fermo in `picked`, scoperte a F_GO «VIA»), `board` (tempo che scorre, F_SOLVE o F_STOP «STOP»), `pause` (soluzione visibile, tempo fermo fino a F_START «PRONTO»). Rubasecondi: penalità calcolata al VIA. Intent telefono `fgo`/`fstop`.
- Preset `ultimo` («Solo prenotazione» in impostazioni): 3 manche Ultimo Round, nessun gioco finale (startGame non passa `buildFinale()`), checkbox finale nascosta. Test: `e2e/prenotazione.spec.ts`.
