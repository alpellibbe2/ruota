# La Ruota – specifiche di gioco (v0.1)

Gioco da salotto ispirato alla versione italiana attuale de "La Ruota della Fortuna". Web app statica, portabile in qualsiasi casa: si apre da un link, lo schermo principale viene proiettato sulla TV e i giocatori partecipano con il proprio telefono.

> Uso privato tra amici. Lo **stile** è il più fedele possibile al programma (colori, ruota, tabellone, ritmo, tipi di suono), ma **tutti gli asset sono originali**: niente logo, sigla, musiche, campionamenti audio, foto o voce dei conduttori del programma. Il repository è pubblico, quindi questo vale a maggior ragione. Nome provvisorio: "La Ruota".

---

## 1. Vincoli

- **Zero installazioni**: niente app, account, server da gestire. Solo browser.
- **Portabile**: funziona in case diverse, con qualsiasi TV e metodo di proiezione (AirPlay, Chromecast, browser della smart TV, PC in HDMI).
- **Hosting gratuito**: GitHub Pages (account GitHub disponibile).
- **Lingua**: solo italiano.
- **Giocatori**: da 2 a 6.
- **Soldi finti**: gli euro sono solo punteggio.

## 2. Dispositivi e ruoli

| Ruolo | Dispositivo | Cosa vede / fa |
|---|---|---|
| **Schermo** | Qualsiasi dispositivo proiettato sulla TV | Ruota, tabellone, punteggi, QR code per entrare. Nessuna informazione segreta. Contiene lo stato della partita. |
| **Giocatore** | Telefono di ciascuno | Gira la ruota con uno swipe, sceglie consonanti/vocali, compra vocali, prova la soluzione (tastiera), si prenota. |
| **Conduttore** (opzionale) | Un telefono in più | Vede la frase, conferma/annulla risposte, assegna penalità, salta frasi, sceglie la manche successiva, corregge punteggi. |

**Modalità conduttore**, scelta all'avvio della partita:
- **Automatico**: l'app conosce la frase, scopre le lettere e verifica le soluzioni digitate. Nessuno vede la soluzione.
- **Umano**: come sopra, ma il conduttore può intervenire (es. accettare una soluzione scritta con un refuso, o detta a voce).

**Modalità tutto-su-un-dispositivo** (piano B, senza telefoni dei giocatori): i comandi dei giocatori compaiono sullo schermo stesso, a turno. Utile senza internet o con chi non ha lo smartphone. Richiede conduttore automatico.

## 3. Architettura tecnica

- **Build**: Vite + TypeScript. Nessun backend. Deploy automatico su GitHub Pages tramite GitHub Actions.
- **Rete**: WebRTC peer-to-peer con PeerJS (server di segnalazione pubblico gratuito di PeerJS; valutare il fallback su un altro segnalatore se instabile). Lo **schermo è l'host**: tiene lo stato autorevole, i telefoni sono client che inviano azioni e ricevono lo stato filtrato (mai la soluzione, tranne al conduttore).
- **Ingresso**: lo schermo genera un codice stanza di 4 lettere e un QR code con il link. Il giocatore inserisce il nome e sceglie un colore.
- **Riconnessione**: se un telefono si blocca o cambia rete, rientra con lo stesso nome/token senza perdere il posto. Se lo schermo si ricarica, lo stato si ripristina da `localStorage`.
- **Macchina a stati** esplicita per la partita (lobby → manche → turno → giro → scelta lettera → … → finale → classifica), testabile in isolamento.
- **Offline**: PWA con service worker, così la modalità tutto-su-un-dispositivo funziona anche senza rete dopo il primo caricamento.
- **Orientamento**: schermo in orizzontale 16:9; telefoni in verticale.
- **Anti-spoiler**: le frasi nel repository pubblico sono offuscate (es. base64 + rot), non in chiaro.

## 4. Regole base (manche classica)

- Il turno passa in senso orario. A inizio manche parte chi è indicato dalla rotazione (o il primo giocatore alla prima manche).
- Il giocatore di turno può:
  1. **Girare la ruota** (swipe sul telefono: la forza del gesto determina la velocità). Poi chiama una consonante: guadagna valore dello spicchio × occorrenze. Se la consonante non c'è o è già stata chiamata, il turno passa.
  2. **Comprare una vocale** (costo configurabile, default 500), se ha abbastanza punti nella manche.
  3. **Provare la soluzione**: se esatta vince la manche e incassa il montepremi della manche nel totale; se sbagliata il turno passa.
- **Prenotazione** (opzione, attiva di default nella manche finale "Ultimo Round"): chiunque può prenotarsi e provare la soluzione senza girare.
- Tempo per rispondere sul telefono: 15 s (configurabile), poi il turno passa.

### Spicchi
- **Valori in punti** (set configurabile per manche; la ruota ha sempre 24 spicchi).
- **Passa**: il turno passa.
- **Bancarotta**: azzera il montepremi della manche **e** il totale accumulato (fedele al programma; opzione "solo manche" per partite più tranquille).
- **Jolly**: si conquista chiamando una consonante presente quando la ruota si ferma sullo spicchio. Vale come immunità nelle prime tre manche regolari contro Passa, Bancarotta o errore. Si consuma all'uso.
- **Spicchio Premio** (equivalente dello spicchio auto): si conquista come il Jolly e vale un bonus punti alla fine della manche se il giocatore la vince.
- **Express** (spicchi fucsia, solo nella manche Express): vedi sotto.

### Frase e tabellone
- Le lettere accentate si scoprono con la lettera base (chiamare E scopre anche È/É).
- Apostrofi, trattini e punteggiatura sono visibili fin dall'inizio.
- La verifica della soluzione ignora maiuscole, accenti, punteggiatura e spazi multipli, e tollera 1 refuso nelle parole lunghe (configurabile; il conduttore umano può sempre decidere).
- Il tabellone mostra categoria/tema sopra le caselle, come nel programma.

## 5. Manche disponibili

Le manche del programma cambiano spesso (anche per stagione). Il gioco offre un catalogo da cui la partita pesca o che si sceglie a mano. Dove le regole televisive non sono note nel dettaglio, l'interpretazione è nostra ed è marcata (*).

| Manche | Regola |
|---|---|
| **Classica** | Regole base. Tema libero. |
| **A tema** (Ruota del Tempo, Regno animale, Musicale, Cinema, Libri, Cucina, Giramondo…) | Regole base con frase e grafica a tema. La manche musicale non riproduce musica. |
| **Express** | 3 spicchi fucsia. Chi ci si ferma e chiama una consonante presente può "andare in Express": da quel momento gioca da solo, ogni consonante corretta vale un importo fisso (default 1.000) senza girare, le vocali si comprano. Un errore (lettera assente o soluzione sbagliata) gli fa perdere quanto accumulato nella manche e passa il turno. Può fermarsi prima di entrare in Express. |
| **Cruciruota** (*) | Griglia stile cruciverba con 3–5 parole collegate da un tema. Le lettere si scoprono su tutta la griglia. Per risolvere basta elencare le parole. |
| **Triplete** (*) | Tre frasi brevi collegate dallo stesso tema, giocate in sequenza nella stessa manche; il montepremi si accumula su tutte e tre. |
| **Round Jackpot** (*) | Uno spicchio Jackpot si carica di tutti i valori incassati nella manche; chi ci si ferma, chiama una consonante giusta e poi risolve la frase vince il jackpot. |
| **Ultimo Round** | Manche veloce: niente ruota, le lettere si scoprono da sole una alla volta, chiunque si prenota e prova. Valore fisso (es. 1.000 punti a frase risolta). Si gioca su 2–3 frasi. |

## 6. Gioco finale – La Ruota delle Meraviglie

Accede chi ha il totale più alto (spareggio: frase lampo in Ultimo Round).

1. Il campione gira una ruota piccola a **24 buste** con premi in punti da 100 a 200.000 (distribuzione configurabile, pochi valori altissimi). Pesca tre buste, una per tabellone, senza vederne il contenuto.
2. Ha **60 secondi in totale** per risolvere tre tabelloni in sequenza:
   - **Tabellone 1**: classico, con alcune lettere già scoperte.
   - **Tabellone 2 – Testacoda**: sono visibili solo la prima e l'ultima lettera di ogni parola.
   - **Tabellone 3 – Rubasecondi**: il campione chiama liberamente consonanti e **una sola vocale**; ogni lettera assente toglie 3 secondi.
3. Ogni tabellone risolto conquista la busta corrispondente. Alla fine il campione **ne sceglie una** fra quelle conquistate e la apre; poi vengono rivelate anche le altre.

## 7. Configurazione partita

Preset a scelta all'avvio:
- **Completa**: 5 manche (Classica, A tema, Express, Cruciruota o Triplete, Ultimo Round) + finale. Circa 30–40 minuti.
- **Veloce**: 3 manche + finale. Circa 15–20 minuti.
- **Personalizzata**: numero e tipo di manche, tempi, valori della ruota, costo vocale, Bancarotta totale/solo manche, Jolly on/off, finale on/off.

Le impostazioni dell'ultima partita restano salvate sullo schermo.

## 8. Modalità bambini

Selezionabile all'avvio, cambia:
- Frasi corte e semplici (banca dedicata, categorie per bambini: animali, cartoni generici, cibo, giochi, scuola).
- **Nessuna Bancarotta totale** (al massimo solo manche, oppure disattivata) e niente Express.
- Vocali gratis oppure a costo basso.
- Niente timer stretti (tempo di risposta lungo o illimitato).
- Tastiera con lettere grandi; soluzione verificata con tolleranza alta.
- Finale semplificato: un solo tabellone, tempo più lungo.

## 9. Frasi

- File JSON in `src/data/frasi/`, con campi: `id`, `testo`, `categoria` (es. "Modo di dire", "Personaggio", "Luogo"), `tema` (titolo mostrato sopra il tabellone), `difficolta` (1–3), `bambini` (bool), `tipiManche` compatibili.
- Banca iniziale: circa **300 frasi adulti + 100 bambini**, scritte da zero (non frasi andate in onda), più set di parole per Cruciruota e Triplete.
- Vincolo di lunghezza: deve entrare nel tabellone (definire righe×colonne, es. 4×14 come il tabellone classico) con a capo automatico per parole intere.
- **Editor frasi personalizzate**: dallo schermo o dal telefono del conduttore si aggiungono frasi (es. battute sugli amici presenti), salvate in `localStorage`, con export/import JSON per portarle in un'altra casa. Opzione "usa solo le mie frasi" o "mescola".
- Le frasi già uscite non si ripetono finché la banca non si esaurisce (storico in `localStorage`).

## 10. Grafica e audio

- **Ruota**: 24 spicchi con colori saturi stile programma, valori in verticale, puntatore in alto, rotazione con fisica credibile (decelerazione, rimbalzo sui pioli, ticchettio sincronizzato).
- **Tabellone**: caselle verdi/bianche, lettere che si girano con animazione e un "ding" per ogni lettera, tema in alto.
- **Studio**: sfondo luminoso, punteggi dei giocatori in basso con il loro colore, evidenza di chi è di turno.
- **Audio** generato con Web Audio API o creato da zero: ticchettio, ding lettera, buzzer errore, effetto Bancarotta, applauso, jingle vittoria. Volume e mute dallo schermo.
- Carattere tipografico simile per stile (sans serif bold arrotondato) da Google Fonts.
- **Telefono**: grande pulsante/area swipe per girare, griglia consonanti/vocali (lettere già chiamate disattivate), punti personali, vibrazione su turno e Bancarotta.

## 11. Fasi di sviluppo

1. **Fase 1 – Tutto su un dispositivo**: ruota, tabellone, manche classica, punteggi 2–6 giocatori, frasi demo, deploy su GitHub Pages. Si prova proiettando il telefono.
2. **Fase 2 – Telefoni dei giocatori**: PeerJS, QR code, lobby, swipe per girare, riconnessione.
3. **Fase 3 – Conduttore umano** e editor frasi personalizzate.
4. **Fase 4 – Manche speciali**: Express, Jolly, Premio, Cruciruota, Triplete, Jackpot, Ultimo Round.
5. **Fase 5 – Ruota delle Meraviglie**.
6. **Fase 6 – Modalità bambini**, banca frasi completa, rifinitura grafica e audio, PWA offline.

Ogni fase si chiude con un deploy funzionante e una prova reale sulla TV.

## 12. Punti aperti (da verificare durante lo sviluppo)

- Valori esatti degli spicchi e costo vocale nel programma attuale: usati valori di default configurabili.
- Regole dettagliate di Cruciruota, Triplete e Round Jackpot: interpretazione nostra.
- Affidabilità del segnalatore PeerJS pubblico su reti di casa diverse; eventuale alternativa.
- Formato del tabellone (righe × colonne) da fissare in Fase 1.

## 13. Istruzioni per Claude Code

- Leggi tutto questo file prima di iniziare e lavora **una fase alla volta**, fermandoti a fine fase per la prova.
- Repository GitHub nuovo, pubblico, con deploy via GitHub Actions su Pages.
- Codice e commenti in inglese, testi dell'interfaccia in italiano.
- Logica di gioco separata dalla UI, con test automatici della macchina a stati e del calcolo punteggi.
- Non usare asset (immagini, audio, font, loghi) del programma televisivo.
