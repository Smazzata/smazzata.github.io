# Collezione illustrata — 23 ottobre 2026

La collezione contiene 50 ritratti: 24 comuni, 15 rari, 8 epici, 3 leggendari. Lo stile segue i personaggi originali dell'Avventura: volumi morbidi, espressioni leggibili, materiali dettagliati e luce calda. La rarità cresce attraverso abiti, silhouette e composizione, oltre alla cornice.

## Leggendari

Fenice dorata, Drago imperatore e Volpe dalle nove code hanno ciascuno uno sprite orizzontale di tre pose. Il browser alterna delicatamente le pose e aggiunge respiro, riflessi e particelle; non sono video. Le animazioni si fermano con l'impostazione senza animazioni e con la preferenza di sistema per il movimento ridotto.

## Possesso e compatibilità

Aggiornamento del 24 ottobre: il profilo mostra solo i posseduti. I quattro avatar iniziali sono Fante di quadri, Dama di fiori, Giardiniere di fiori e Pasticciera vaniglia; gli sblocchi espliciti e le scelte pregresse sono conservati. Rimossi catalogo completo e filtri di rarità. La descrizione dei 24 comuni qui sotto documenta la versione precedente. La proposta chest è in `chest-design.md` e non è attiva.

I 24 comuni sono posseduti fin dall'inizio. Gli altri sono visibili in anteprima ma non assegnabili, salvo avatar già salvati nei profili precedenti. La collezione si apre su Solo posseduti e ricorda la preferenza sul dispositivo. Il filtro Solo posseduti usa la risposta privata `ownedAvatarIds` del server. Il server conserva le scelte pregresse in `avatarOwned` quando si cambia ritratto, così si può tornare a quello posseduto.

Gli ID ritirati sono ricondotti a personaggi della collezione curata, privilegiando famiglia e rarità; i profili restano leggibili e utilizzabili. Non si cambiano nickname, titoli o cornici. Il colore scelto resta come bordo del ritratto. Il vecchio campo emoji rimane solo per i client precedenti.

Non è stato introdotto un sistema di sblocco, acquisto o assegnazione di premi. Queste regole saranno definite separatamente con il titolare.

## Asset e riproducibilità

I ritratti sono generati individualmente con lo strumento integrato imagegen. Riferimento di stile: `public/art/campaign/barone.webp`. Le istruzioni dei singoli asset sono conservate in `docs/avatar-prompts.json`. Gli originali di generazione restano locali; il progetto usa solo i WebP ottimizzati in `public/art/avatars/` (512×512, oppure 1536×512 per i leggendari), presenti in entrambe le cache offline.

`scripts/prepara-avatar.js` converte un manifest locale ID→file originale in WebP; richiede Sharp come strumento locale e non aggiunge dipendenze runtime. Esempio: `node scripts/prepara-avatar.js manifest-locale.json percorso/node_modules/sharp`. Nessuna chiamata API o credenziale nello script.

## Verifiche eseguite

- `npm run test:avatar`: due prove passate; 50 file distinti, 24/15/8/3, risorse offline, tre pose, possesso e compatibilità.
- `npm run test:rapido`: passato. Un tentativo precedente si era fermato nel limite di mosse della simulazione casuale Ramino; la ripetizione è passata senza modificare i motori. Un primo controllo delle lingue era stato eseguito prima di completare la rigenerazione dei dizionari; dizionari finali verificati, 2617 testi.
- `npm run e2e`: passato, incluso il rifiuto dell'autoassegnazione di un leggendario e i 24 comuni posseduti inizialmente.
- `node server/uitest.js --polish`: passato; caricamento di tutti i ritratti, proporzioni degli sprite, filtri combinati, anteprime bloccate, opt-out dalle animazioni, profilo a 320/375 px e tema scuro.
- `node server/release-ui-test.js --store`: passato, 23 acquisizioni e nove screenshot store aggiornati. Verificata la corrispondenza dei 78 hash di sorgenti, catalogo e immagini nel relativo `VERIFICA.json`.
- Build Pages eseguita. I 50 WebP pesano complessivamente circa 3,97 MiB. Nessun originale PNG o manifest con percorsi locali viene distribuito.

Le verifiche non sostituiscono una prova Android fisica né attestano l'aggiornamento del server pubblico. La pubblicazione su Git avviene al termine dei controlli; l'installazione online resta subordinata al workflow Prove.


## Correzione dopo il controllo GitHub

Il workflow Prove di `5d94385` è fallito nel test completo della UI: i controlli cercavano i vecchi riquadri Solo/Duo anche per un profilo senza partite. Aggiornati al nuovo stato vuoto con azione utile; i controlli su code, risultati, piazzamenti e stagioni con dati restano presenti. Aggiornato anche il controllo offline, che cercava una emoji sostituita dagli SVG.

`npm run ui` è passato integralmente in locale. Il controllo successivo `node server/uitest.js --campaign` ha individuato un overflow reale di 8 px nel tavolo a 320 px: le icone negli header di squadra avevano la misura generale da 24 px. Ora seguono la dimensione del testo, senza alzare la riga. La ripetizione del test Avventura è passata: tre mondi, 30 situazioni, tavoli piccoli, animazioni ridotte e risorse offline. Aggiornate entrambe le cache; screenshot store rigenerati dopo la correzione. L’esito del nuovo workflow remoto resta distinto dalle verifiche locali.

## Carte e scorrimento della collezione

Corretti con imagegen i ventagli del Coniglio prestigiatore, del Gatto stregone e delle tre pose del Drago imperatore: quattro assi, uno per seme, senza duplicati. Ispezionati gli asset WebP finali. I prompt di correzione sono registrati in `avatar-prompts.json`; i tentativi con carte ancora duplicate sono stati scartati.

Rimosso lo scorrimento interno della griglia: ora scorre soltanto la finestra del profilo, così l’ultima riga resta raggiungibile interamente. L’anteprima parte dall’alto e il ritorno alla collezione ripristina la posizione. La prova grafica controlla questi comportamenti a 320 e 375 px e salva le schermate dell’ultima riga.

Passati nuovamente `test:rapido`, `test:avatar` e `uitest --polish` dopo le correzioni. Rigenerati gli screenshot store con `release-ui-test --store`: 23 acquisizioni, 78 hash delle sorgenti verificati. Il workflow Prove del precedente commit `ad5ade8` è passato su GitHub; questo non attesta la distribuzione delle nuove correzioni.
