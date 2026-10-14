# DECISIONI

## 2026-10-14
- **Palco fisso 1920×1080 scalato** con CSS transform: stessa grafica su qualsiasi TV/telefono. Alternativa scartata: layout responsive.
- **Tabellone 4×14**, a capo su parole intere, centrato verticalmente. Cambiare in `src/core/phrase.ts` (BOARD_ROWS/COLS).
- **Ruota con 24 spicchi**: valori 200–1500, 3 Bancarotta, 2 Passa. Modificabile in `src/core/wheel.ts`.
- **Reducer puro con casualità iniettata** (angolo del giro passato nell'azione) per testare tutto.
- **Frasi**: rot13+base64 nel JSON; solo 32 frasi demo in Fase 1, banca completa in Fase 6.
- Se tutte le lettere vengono scoperte, vince la manche chi ha chiamato l'ultima (semplificazione).
- Timer di risposta rimandato alla Fase 2 (serve ai telefoni).
- **Fase 2**: server di segnalazione = PeerJS cloud pubblico (default); nei test server locale. Se instabile: passare un altro `host` in `peerOptions()` (src/net/protocol.ts).
- Il telefono vede solo righe mascherate ('_'); la soluzione resta sullo schermo. Il token del posto è in localStorage del telefono per stanza.
- Timer di risposta 15 s solo in modalità telefoni (host); scaduto → turno passa.
- Colori duplicati: l'host assegna il primo colore libero.
- Test pubblico PeerJS cloud non eseguito in e2e (solo server locale).
