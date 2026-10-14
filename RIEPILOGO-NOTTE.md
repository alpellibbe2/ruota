# Riepilogo della notte

Tutte e 6 le fasi di `SPEC.md` sono state completate, pubblicate e coperte da test automatici.

**Sito pubblicato:** https://alpellibbe2.github.io/ruota/ (HTTP 200 verificato dopo ogni fase; l'ultima azione di deploy è andata a buon fine).

## Cosa provare per primo sulla TV
1. Apri il link sul dispositivo collegato alla TV e premi **Completa → INIZIA (UN DISPOSITIVO)** per provare ruota, tabellone e suoni senza telefoni (clicca una volta per sbloccare l'audio).
2. Poi **CON I TELEFONI**: compare il QR; inquadralo con 2–3 telefoni **sullo stesso Wi-Fi**, scegli nome e colore, premi INIZIA. Prova lo swipe verso l'alto/basso per girare la ruota.
3. Per il conduttore: apri lo stesso link su un altro telefono e premi «Sono il conduttore» (vede la soluzione; risposte con refuso vanno in verifica).
4. Prova **Modalità bambini** dalle impostazioni, l'**Ultimo Round** (tutti si prenotano dal telefono) e la finale **Ruota delle Meraviglie** (si arriva dopo l'ultima manche).

## Cosa c'è
- **Fase 1**: ruota (24 spicchi), tabellone 4×14, punteggi 2–6 giocatori, manche classica, audio sintetizzato.
- **Fase 2**: PeerJS (lo schermo è l'host), QR e codice stanza, lobby, swipe, timer 15 s, riconnessione dei telefoni, ripresa dello schermo dopo ricarica.
- **Fase 3**: conduttore umano (verifica risposte, accetta a voce, passa turno, salta frase, correzione punteggi, scelta della manche) ed editor frasi personalizzate (banca / solo mie / mescola, export-import JSON).
- **Fase 4**: Express, Jolly, Premio, Cruciruota, Triplete, Round Jackpot, Ultimo Round; preset Veloce/Completa/Libera.
- **Fase 5**: La Ruota delle Meraviglie (24 buste, 60 s, Tabellone 1 / Testacoda / Rubasecondi, scelta della busta) e spareggio.
- **Fase 6**: modalità bambini, 355 frasi adulti + 120 bambini (offuscate), PWA offline per la modalità «un dispositivo», volume/mute, confetti, README.

## Verifica
- 48 test unitari (Vitest): regole, punteggi, ogni manche, finale, frasi, cruciverba.
- 18 test end-to-end (Playwright, Chromium headless): partita completa su un dispositivo, uno schermo + 2–3 telefoni simulati (contesti separati, viewport 390×844), conduttore, tutte le manche, finale, ripresa dopo ricarica, offline, più uno smoke test sul sito pubblico (`PUBLIC=1`).
- Screenshot dei momenti chiave in `docs/screenshot/fase1 … fase6/` (schermo 1920×1080, telefono 390×844).

## Dove guardare
- Scelte e interpretazioni (con come cambiarle): `DECISIONI.md`.
- Limiti e cose non verificabili senza dispositivi veri (rete, audio, TV): `PROBLEMI.md`.
- Stato e struttura del codice: `PROGRESS.md`, `README.md`.
