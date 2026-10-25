# Tavolo, stile e comodità — 25 ottobre 2026

Richiesta: implementare tutte le sette proposte grafiche e di qualità d'uso. Base `fd69fbb`; client `2026.10.25.5`, cache principale e launcher `v85`.

## Modifiche

1. Pressione di 480 ms su una carta della propria mano: lente di sola lettura, chiusa al rilascio senza selezionare o giocare. Muoversi prima dell'apertura conserva il trascinamento. Ridisegni della stessa mano non interrompono la lente; cambio partita, menu, background e Indietro la chiudono.
2. Ultimo scarto o gioco calato modificato evidenziato per 2,3 secondi, soltanto da eventi pubblici nuovi. Nessuna evidenza di carte pescate nascoste.
3. Conteggio delle carte selezionate nel comando che le deseleziona tutte, senza aggiungere un altro pulsante.
4. Richiamo visivo breve all'arrivo del proprio turno. Suono e vibrazione usano le preferenze esistenti; eliminate due vibrazioni dirette duplicate che le aggiravano.
5. Sala d'attesa con posti liberi, collegati, scollegati e computer distinguibili; riepilogo dei posti mancanti e comando esplicito «Completa con il computer». Nessuna nuova votazione di disponibilità.
6. Campioni reali delle dimensioni delle carte, del testo e del contrasto nelle impostazioni; conservate le otto anteprime dei mazzi. Visualizzare un campione non cambia le preferenze.
7. Bordo discreto per i nuovi oggetti e indicazione di categoria completata. Celebrazione soltanto alla transizione osservata da incompleta a completa, una volta per categoria nella sessione del profilo; nessuna celebrazione retroattiva, nuovo premio o valuta.

Movimento ridotto e alto contrasto rispettati. Traduzioni EN/ES/PT aggiornate. Nessuna modifica alle regole, alle probabilità o ai premi.

## Verifiche sul PC

- `npm run test:rapido`: superato.
- `npm run test:prerilascio`: 72 verifiche superate, compresi i test dei risultati e due nuovi test su eventi pubblici e completamento delle categorie.
- `npm run e2e`: superato, inclusi riconnessioni, abbandoni, quattro giochi e tornei.
- `npm run ui`: superato, partite giocate mediante interfaccia, impostazioni, tornei e modalità offline.
- `npm run anim`: superato.
- `node server/chest-uitest.js --qol` e `--menus`: superati, anche a 320/375/768 px con testo molto grande.
- `--comfort`: superato con mouse e touch simulato: pressione, rilascio, annullamento, ridisegno, trascinamento, Indietro, conteggio, segnali temporanei, sala e anteprime. Nuova prova inclusa nel workflow Prove.
- `--first-use --small`: percorso iniziale completo superato a 320 px, nove tocchi sui controlli visibili.
- `node server/release-ui-test.js --store`: 34 scene superate e screenshot store rigenerati sulle fonti finali. Un primo tentativo ha incontrato un errore di accesso Windows al PNG del risultato; la ripetizione completa è riuscita.

Screenshot delle anteprime a 320 px e della lente controllati visivamente. Le prove touch sono effettuate con Chrome sul PC: non attestano una prova su Android fisico né la capacità del server sul telefono. Distribuzione online subordinata al workflow Prove e all'aggiornamento del server.
