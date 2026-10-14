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

Dopo il primo caricamento la modalità «un dispositivo» funziona anche senza rete (PWA).

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
