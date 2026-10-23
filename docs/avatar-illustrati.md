# Collezione illustrata — 23 ottobre 2026

La collezione contiene 50 ritratti: 24 comuni, 15 rari, 8 epici, 3 leggendari. Lo stile segue i personaggi originali dell'Avventura: volumi morbidi, espressioni leggibili, materiali dettagliati e luce calda. La rarità cresce attraverso abiti, silhouette e composizione, oltre alla cornice.

## Leggendari

Fenice dorata, Drago imperatore e Volpe dalle nove code hanno ciascuno uno sprite orizzontale di tre pose. Il browser alterna delicatamente le pose e aggiunge respiro, riflessi e particelle; non sono video. Le animazioni si fermano con l'impostazione senza animazioni e con la preferenza di sistema per il movimento ridotto.

## Possesso e compatibilità

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
