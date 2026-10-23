# Punti operativi Google Play — 22 ottobre 2026

Base del rilascio: `040e6d2`. Nessuna nuova pubblicazione, modifica al backend o esecuzione dei test già passati in questa sessione. Le modifiche ranked/Glicko2 presenti nella copia di lavoro sono escluse da questa verifica e non sono state toccate.

## Preparazione autonoma successiva

- Inventariati tutti i 28 commit raggiungibili dal ramo `backup` alla verifica e 28 blob backup distinti, solo metadati. Report ignorato da Git: `test-output/inventario-backup-completo.json`. Script riutilizzabile: `scripts/inventario-backup-github.js`. Non prova assenza di copie fuori dal ramo.
- Nei riferimenti locali, il primo commit del ramo backup è raggiungibile da `refs/remotes/origin/backup`; non sono state cancellate refs o copie né scaricati altri blob.
- Preparato `scripts/verifica-server-store.js`: diagnostica in sola lettura per Termux. Sintassi e prove con processo simulato/assente superate; segreti sentinella esclusi dall'output. Eseguito anche su Windows, dove correttamente non attesta il processo Termux. Non ancora eseguito sul telefono.
- Preparata bozza privata per GitHub Support in `test-output/BOZZA-GITHUB-SUPPORT.md`, non inviata.
- Preparato pacchetto locale `test-output/play-1.30-preparato/`: AAB verificato per hash e materiale store estratto da `040e6d2`, senza includere ranked. Nessun upload.
- Nuova verifica della chiave AAB: chiave pubblica del firmatario diversa da quella APK pubblicata nel repository. Certificato upload SHA-256: `7866C935A935DED7000E4E2BFB327F860C27278671DB25DB0C9C726F98D7F6FE`. Corrispondenza con Play Console ancora NON verificata. Script: `scripts/verifica-certificato-play.py`; evidenza: `test-output/play-1.30-preparato/certificato-upload.json`.
- Procedure e opzioni fornitori in [PASSAGGI-CON-IL-TITOLARE.md](PASSAGGI-CON-IL-TITOLARE.md). Nessun servizio attivato, contratto accettato o spesa sostenuta.

Le nuove verifiche riguardano gli strumenti preparati e l'identità della chiave: non è stata ripetuta la suite del gioco. Nessun commit o push effettuato.

## Account Google Play

Il titolare riferisce che il riconoscimento dei documenti non è ancora terminato ed è in attesa della risposta Google. Nel browser disponibile è stata raggiunta soltanto la pagina di accesso: nessuna configurazione della Console è stata verificata o inviata.

Attendere l'esito della verifica per proseguire con i passaggi che la Console rende disponibili. Nel frattempo completare backup, fornitori e accessi al server. Non creare un altro account per aggirare l'attesa e non considerare iniziato il test chiuso.

Tipo e data di creazione dell'account restano da verificare. Per gli account personali creati dopo il 13 novembre 2023, Google richiede almeno 12 tester aderenti continuativamente per 14 giorni prima della richiesta di produzione. L'attesa della verifica documentale non conta come periodo di test. Fonte ricontrollata: [requisiti Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=it).

## Backup storici: inventario iniziale verificato, bonifica aperta

La lettura dell'API pubblica GitHub ha confermato il ramo remoto `backup`, con 28 commit dal 15 al 21 ottobre 2026. Ultimo commit del ramo: 21 ottobre 2026, ore 19:07:47 Europe/Rome. Nell'albero corrente sono presenti sette file di backup, datati dal 15 al 21 ottobre, oltre al file LEGGIMI. Non sono stati scaricati o decifrati i contenuti.

Il repository risulta pubblico e il contatore API dei fork è zero: questo non prova l'assenza di cloni, esportazioni, cache o copie storiche. Anche questa copia locale conserva `origin/backup` e oggetti storici. Il riferimento locale è precedente al remoto e non è stato aggiornato scaricando altri backup.

Evidenza locale esclusa da Git: `test-output/inventario-backup-github-2026-10-22.json`, con SHA, date e metadati dei file. Non è un inventario completo di tutti gli oggetti, riferimenti o dispositivi.

Prossime operazioni, nell'ordine:

1. Accedere al telefono-server, verificare il processo aggiornato, l'interruzione dei caricamenti remoti e una copia locale cifrata dello stato attuale. Non ripristinare copie storiche.
2. Con accesso GitHub amministrativo, preparare la rimozione del ramo e dei riferimenti pertinenti, senza riscrivere o pubblicare le modifiche ranked locali. La CLI `gh` non è autenticata in questa sessione.
3. Richiedere al supporto GitHub la valutazione dei residui raggiungibili tramite SHA/cache e conservare la risposta. Nessuna richiesta è stata inviata. Il supporto valuta l'ammissibilità: la cancellazione completa non è garantita dalla sola eliminazione del ramo.
4. Bonificare anche i riferimenti e gli oggetti locali con una procedura che preservi il lavoro concorrente; censire altri cloni/esportazioni del titolare. Non eseguire una pulizia Git indiscriminata mentre è in corso altro lavoro.
5. Registrare esito, limiti, data e responsabile prima di aggiornare l'informativa pubblica.

Fonte: [rimozione dati sensibili GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Fornitori: evidenze e decisioni ancora necessarie

| Servizio | Riscontro | Cosa manca |
|---|---|---|
| Email | `server/posta.js` configura Nodemailer con `service: 'gmail'`. Google dichiara che non offre DPA per Gmail consumer e non opera come responsabile per quella versione | Verificare il servizio realmente usato dal titolare, ruolo e condizioni applicabili. Non segnare il DPA come acquisito. Se occorre un servizio che operi per conto del titolare, scegliere e configurare un fornitore coperto da accordi adeguati; includere anche le caselle privacy/assistenza nella valutazione |
| Cloudflare | Lo script usa un Quick Tunnel `trycloudflare.com`. Cloudflare lo indica per sviluppo/test, senza garanzia di disponibilità; per produzione rimanda a Cloudflare Tunnel | Verificare account, contratto applicabile e copertura DPA del servizio effettivo; definire la configurazione per produzione. Il DPA pubblico non prova da solo un accordo applicabile al Quick Tunnel usato |
| GitHub | Repository pubblico, Pages, distribuzione e vecchi backup; informativa e DPA standard non sono evidenza dell'accordo specifico del titolare | Verificare piano/termini effettivi, ruoli per ogni trattamento, conservazione, trasferimenti e bonifica pregressa |

Fonti consultate il 22 ottobre 2026:

- [Google: Gmail consumer e DPA](https://support.google.com/policies/answer/9581826?hl=en).
- [Cloudflare Quick Tunnels: destinazione e limiti](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
- [Cloudflare DPA](https://www.cloudflare.com/cloudflare-customer-dpa/).
- [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

Per ciascun fornitore conservare privatamente servizio/piano, intestatario, versione e data dei termini applicabili, accordo sul trattamento quando necessario, subfornitori, paesi/garanzie dei trasferimenti, conservazione e contatto per cancellazioni. Nessun contratto è stato accettato o verificato sull'account in questa sessione. Non aggiornare «condivisione: no» nella Data Safety per la sola presenza di un DPA pubblico.

## Chiave amministrativa

Rotazione non eseguita: manca un accesso operativo al telefono-server. Nel codice `ADMIN_KEY` d'ambiente prevale sul file `data/admin-key.txt` e la chiave viene letta all'avvio. Cambiare soltanto il file senza riavviare il processo non revoca la chiave in memoria.

Con accesso al server: identificare `DATA_DIR` e l'eventuale variabile `ADMIN_KEY` senza stamparne il contenuto; generare e custodire una nuova chiave con permessi privati; aggiornare la fonte realmente utilizzata e riavviare il servizio in una finestra concordata. Verificare che la vecchia chiave riceva HTTP 403 e la nuova funzioni. Registrare solo esiti e data, mai chiavi o URL amministrativi completi. La rotazione non sostituisce la bonifica dei backup.

## Build e verifiche già disponibili

Android 1.30/30, package `it.smazzata.app`, target 36: evidenza in `test-output/verifica-aab-30.json`, firma interna valida e 528 digest verificati. SHA-256 AAB: `f58fa247e7ab2b727a25e5893e34d3214ff24c6a7720454b0500f6946c5ce68b`. Questa evidenza non verifica la chiave registrata in Play Console.

La sessione precedente documenta sito/server aggiornati e workflow passato. Resta distinta la prova di cancellazione dopo installazione sul server reale con un account creato appositamente: non risulta attestata dalle evidenze lette. Non ripetere tutta la suite per modifiche esclusivamente documentali.
