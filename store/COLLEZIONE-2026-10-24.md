# Collezione unificata — 24 ottobre 2026

Base `53ef6ba`. Richiesta: riorganizzare inventario e collezione con la gerarchia di un client di gioco come League of Legends. Interfaccia originale Smazzata, senza riprodurre marchi o materiali di altri giochi.

## Interfaccia

- Navigazione unica Collezione / Bottino / Posta, conteggio delle chest, messaggi non letti e saldo frammenti.
- Sei categorie: avatar, dorsi, cornici, tappetini, reazioni e vittorie.
- Griglia illustrata, contatore posseduti/totale, ricerca e filtri per rarità e possesso. Predefinito Solo posseduti; Mostra tutti presenta gli oggetti mancanti come anteprime bloccate.
- Anteprima laterale su desktop, pagina di dettaglio su telefono; equipaggiamento verificato dal server, indicatore In uso, ripristino stile base e prova degli effetti vittoria.
- Verde notte, metallo dorato e accenti progressivi di rarità; illustrazioni originali esistenti. Nessuna emoji aggiunta come icona.
- Bottino con quattro tipi di chest, quantità e probabilità dell'apertura selezionata; dettagli di progressi/scambi/garanzie richiudibili. La selezione porta al comando di apertura, senza aprire automaticamente.
- Posta e risultati di apertura inseriti nella stessa cornice visiva. I nuovi regali aggiornano la collezione già aperta.
- Home e Altro conducono alla Collezione; accessi dell'account conservati. Cache offline v72, build 2026.10.24.4, 2852 testi tradotti.

## Verifiche

- `npm run test:prerilascio`: 38 prove passate.
- `npm run test:rapido`: passato, inclusi archivio/privacy/lingue e tutti i 23 file client nelle cache offline.
- `node server/chest-uitest.js`: passato su server temporaneo reale. Nuove prove: quattro avatar iniziali, catalogo completo 50 e filtro tre leggendari, impossibilità di equipaggiare un oggetto bloccato, anteprima mobile, equipaggiamento e ricerca, pannello desktop. Conservate le prove precedenti su 320/375/768 px, testo enorme, temi, ultima riga, offline, isolamento profilo, quattro sprite e 20 effetti vittoria.
- `node server/privacy-uitest.js`: passato, cancellazione e dati locali verificati.
- `node server/release-ui-test.js --store`: passato, 24 acquisizioni, screenshot store Collezione aggiornato e sorgenti identificate per hash.
- `npm run anim`: passato localmente nei quattro giochi. Il workflow precedente `8f092e3` aveva fallito questo passaggio; il successivo workflow `53ef6ba` ha superato le animazioni ed è arrivato alla prova UI. La causa del primo fallimento non è attestata: i log completi non erano accessibili via API.

Nessuna modifica alle percentuali, alle regole di consegna o ai premi. Nessun invio agli utenti reali. Gli screenshot della prova chest usano un server temporaneo e una collezione dimostrativa; gli screenshot store usano file locali e risposte dimostrative. Non attestano l'aggiornamento del server pubblico o la pubblicazione Play Store.

Superato anche `node server/uitest.js --polish`: profilo, Home, menu, tornei, tastiera e tema scuro. Gli hash finali degli screenshot corrispondono a tutte le 149 sorgenti elencate; sintassi JS, dizionari e diff controllati, nessuna credenziale/database/backup/artefatto temporaneo incluso.
