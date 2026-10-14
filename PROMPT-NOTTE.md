# Istruzioni di lavoro autonomo – progetto "La Ruota"

Stai lavorando DA SOLO, di notte, senza nessuno che possa risponderti. Non fare mai domande e non aspettare conferme: nessuno le leggerà fino a domattina.

## Obiettivo
Realizza il gioco descritto in `SPEC.md` (nella root del repository), seguendo le fasi della sezione 11, in ordine, dalla prima ancora non completata.

**Questa regola sostituisce la sezione 13 di SPEC.md**: NON fermarti a fine fase per la prova manuale. Chiudi ogni fase con test automatici e deploy, poi passa alla successiva.

## Come lavorare
1. All'avvio leggi `SPEC.md`, poi `PROGRESS.md` e `DECISIONI.md` se esistono. Riprendi esattamente da dove indica `PROGRESS.md`.
2. Lavora a piccoli passi. Dopo ogni passo funzionante: test verdi, `git commit` con messaggio chiaro, `git push`.
3. Aggiorna `PROGRESS.md` dopo ogni passo: fase corrente, cosa è fatto, prossimo passo concreto. Deve permettere a una nuova sessione senza memoria di ripartire.
4. A fine fase: build di produzione, deploy su GitHub Pages tramite la GitHub Action, verifica che il sito pubblicato risponda (HTTP 200), poi segna la fase come completata in `PROGRESS.md`.

## Quando qualcosa non è chiaro
- Scegli l'opzione più semplice e coerente con SPEC.md, e vai avanti.
- Annota ogni scelta non banale in `DECISIONI.md`: data, cosa hai deciso, alternative scartate, come cambiarla.
- Se un problema ti blocca per più di 3 tentativi: annotalo in `PROBLEMI.md` (sintomo, tentativi, ipotesi), aggira la funzionalità con una soluzione temporanea o rimandala, e passa al punto successivo. Non restare bloccato.

## Verifica senza TV
Non puoi vedere lo schermo, quindi:
- Logica di gioco (macchina a stati, punteggi, regole di ogni manche, normalizzazione frasi) coperta da test unitari con Vitest.
- Flussi end-to-end con Playwright e Chromium headless: partita completa su un dispositivo; per la Fase 2, uno schermo e più telefoni simulati con contesti browser separati (viewport mobile) che si connettono via PeerJS.
- Salva screenshot dei momenti chiave in `docs/screenshot/<fase>/` (vista schermo 1920×1080 e vista telefono 390×844), così domattina posso controllare la grafica senza avviare nulla.

## Vincoli
- Lavora solo dentro questa cartella del repository. Non toccare altri percorsi del sistema, se non per installare strumenti di sviluppo (Node, Playwright e le sue dipendenze).
- Non creare altri repository, non modificare le impostazioni dell'account GitHub, non stampare né salvare token o credenziali nei file o nei log.
- Non usare asset del programma televisivo (logo, sigla, musiche, campionamenti, foto, voci). Audio generato con Web Audio API o creato da zero.
- Usa solo dipendenze open source diffuse e mantenute. Niente servizi a pagamento né account aggiuntivi.
- Non riscrivere la cronologia git (niente force push).

## Fine lavoro
Quando tutte le fasi sono completate, oppure quando non c'è altro di sensato da fare:
1. Scrivi `RIEPILOGO-NOTTE.md` in italiano: fasi completate, link al sito pubblicato, cosa provare per primo sulla TV, scelte principali (rimando a DECISIONI.md), problemi aperti (rimando a PROBLEMI.md).
2. Commit e push.
3. Solo se TUTTE le 6 fasi sono completate, crea il file vuoto `.lavoro-finito` nella root, poi commit e push. Serve allo script esterno per sapere che non deve più ripartire.
