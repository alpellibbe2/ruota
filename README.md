# La Ruota

Gioco da salotto ispirato a "La Ruota della Fortuna", per 2–6 giocatori. Web app statica: si apre da un link, lo schermo principale si proietta sulla TV e i giocatori partecipano con il telefono (o si gioca tutti su un solo dispositivo).

**Gioca:** https://alpellibbe2.github.io/ruota/

> Uso privato tra amici. Stile ispirato al programma, ma tutti gli asset (grafica, suoni, frasi) sono originali. Niente logo, sigla, musiche o voci del programma.

## Come si gioca

1. Apri il link sul dispositivo collegato alla TV (AirPlay, Chromecast, browser della smart TV, PC in HDMI).
2. Scegli la partita: **Veloce** (3 manche), **Completa** (5 manche) o **Libera**; poi
   - **Inizia (un dispositivo)**: i comandi compaiono sullo schermo, a turno;
   - **Con i telefoni**: compare un QR code, ogni giocatore lo inquadra, sceglie nome e colore. Un telefono in più può fare il **conduttore** (tasto «Sono il conduttore»): vede la soluzione, conferma le risposte, corregge i punteggi, salta le frasi e sceglie la manche successiva.
3. Manche: Classica, A tema, Express, Cruciruota, Triplete, Round Jackpot, Ultimo Round. Poi la finale **La Ruota delle Meraviglie** (24 buste, 60 secondi, tre tabelloni).
4. **Modalità bambini**: frasi semplici, niente Express, vocali gratis, Bancarotta solo sulla manche, più tempo.
5. **Frasi personalizzate**: dall'editor (impostazioni) o dal telefono del conduttore; export/import JSON.

Dopo il primo caricamento la modalità «un dispositivo» funziona anche senza rete (PWA, solo su HTTPS o `localhost`).

## Installazione sul mini PC (alternativa)

In alternativa a GitHub Pages, tutto può girare in un container Debian 13 della rete di casa: nginx (sito, porta 80), server PeerJS per il collegamento schermo↔telefoni e coturn (TURN, porta 3478) che fa da ponte quando i telefoni non riescono a raggiungere lo schermo direttamente (per esempio Wi-Fi con i client isolati tra loro). Nessun servizio esterno, nessuna porta aperta verso internet: i telefoni devono essere sul Wi-Fi di casa.

```
deploy/crea-pacchetto.sh /root/ruota-server.tar.gz   # build + server PeerJS con dipendenze
# nel container di destinazione, come root:
tar -xzf ruota-server.tar.gz && ruota-server/installa.sh
```

`installa.sh` serve anche per gli aggiornamenti (rilanciarlo con un pacchetto nuovo). Scrive `rete.json` accanto al sito con la password del TURN, generata la prima volta in `/etc/ruota/turn-password`. Con `--relay` forza tutto il traffico attraverso il TURN, per provarlo; poi va rilanciato senza.

Prova automatica contro il server installato: `CASA=http://<ip>/ npx playwright test e2e/casa.spec.ts` (stampa il tipo di collegamento: `host` diretto, `relay` via TURN).

## Sviluppo

```
npm install
npm run dev        # sviluppo
npm test           # test unitari (Vitest): regole, punteggi, manche, finale
npm run build      # build di produzione in dist/
npx playwright install chromium
npm run e2e        # test end-to-end (partite complete, telefoni simulati via PeerJS, offline)
```

- `src/core/` logica di gioco pura (macchina a stati, regole, frasi). `src/ui/` interfaccia. `src/net/` PeerJS (lo schermo è l'host).
- Le frasi nel repository sono offuscate (rot13 + base64).
- Gli screenshot dei momenti chiave sono in `docs/screenshot/<fase>/`.
- Decisioni di progetto: `DECISIONI.md`. Problemi noti: `PROBLEMI.md`.
- Deploy automatico su GitHub Pages a ogni push su `main`.
- Senza `rete.json` (GitHub Pages, sviluppo) il gioco usa il server PeerJS pubblico; `?peer=host:porta` sceglie un server PeerJS a mano (test).
