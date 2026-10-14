# PROBLEMI APERTI

Nessun problema ha bloccato lo sviluppo. Qui sotto ciò che non ho potuto verificare senza TV/telefoni veri, o che è un limite noto.

## Non verificato su dispositivi reali
- **Rete**: i test usano Chromium headless sulla stessa macchina. Il collegamento schermo↔telefoni è WebRTC peer-to-peer con il server di segnalazione pubblico di PeerJS (testato anche contro quello pubblico: `PUBLIC=1 npx playwright test e2e/pubblico.spec.ts`). Non c'è un server TURN: se i telefoni sono su dati mobili e lo schermo sul Wi-Fi di casa (o il router isola i client Wi-Fi tra loro), la connessione può non stabilirsi. Rimedio: far collegare i telefoni allo stesso Wi-Fi dello schermo; in alternativa usare la modalità «un dispositivo».
- **Audio**: i suoni sono sintetizzati con Web Audio; non ho potuto ascoltarli. Il browser richiede un tocco/click prima di far suonare l'audio (il primo click su INIZIA lo sblocca). Volume e mute sul palco.
- **Grafica sulla TV**: controllati solo gli screenshot in `docs/screenshot/` (1920×1080 e 390×844). Palco fisso 16:9 scalato; su schermi non 16:9 compaiono bande nere.
- **Swipe sul telefono**: testato con eventi puntatore simulati, non con un dito vero; c'è sempre anche il pulsante GIRA.
- **PWA**: offline verificato in Chromium (service worker); non provato su iOS/Android/smart TV. Il caricamento dei font Google richiede rete la prima volta (poi in cache; senza font si usa un carattere di riserva).

## Limiti noti / interpretazioni
- Regole di Cruciruota, Triplete, Round Jackpot, Testacoda (numero di lettere concesse) e valori degli spicchi sono interpretazioni mie (vedi `DECISIONI.md`, dove sono marcate (*) e dove cambiarle).
- La frase del tabellone deve entrare in 4 righe × 14 colonne: le frasi personalizzate che non entrano vengono rifiutate dall'editor.
- Se lo schermo viene ricaricato, «RIPRENDI PARTITA» riporta lo stato; i telefoni rientrano da soli con lo stesso nome. Il tempo di risposta ricomincia da capo.
- Con un solo conduttore alla volta; il conduttore non vede ancora un elenco storico degli errori dei giocatori.
- Il campione della finale con totale in parità tra tutti a zero fa partire lo spareggio (Ultimo Round, una frase).
