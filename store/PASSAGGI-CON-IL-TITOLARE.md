# Ripresa con il titolare — preparazione del 22 ottobre 2026

Aggiornamento 23 ottobre: le rifiniture della UI e ranked sono ora incluse nella pubblicazione autorizzata su main; per sorgenti, verifiche e screenshot finali seguire `RIFINITURE-2026-10-23.md` e `SCHERMATE.md`. I riferimenti a `040e6d2` e all’AAB 1.30 qui sotto descrivono materiale storico, non il pacchetto finale.

Le operazioni seguenti non sono già eseguite. Non occorre attendere Google per backup, chiave e fornitori. Riconoscimento documenti e test chiuso restano separati.

## Primo accesso, nel pomeriggio

1. Sul PC autenticare GitHub con `gh auth login` e completare il login nel browser; non copiare token in chat. Non usare `git add .`, `git push --all`, `git push --mirror` o reset della copia di lavoro.
2. Rendere disponibile il terminale Termux del telefono-server. Non serve condividere la chiave amministrativa. Prima del riavvio verificare eventuali partite in corso.
3. Dopo che il server ha acquisito la versione verificata da Prove, controllare che `scripts/verifica-server-store.js` sia presente. Eseguirlo dalla copia server con `node scripts/verifica-server-store.js`. Lo script non cambia file e non stampa segreti; la prova su Windows non vale come verifica Termux.
4. Controllare il processo server e gli eventuali vecchi processi di backup in una sessione privata. Non incollare log integrali: lo script di avvio può riportare URL amministrativi con la chiave.

## Bonifica GitHub

L'inventario locale `test-output/inventario-backup-completo.json` contiene i metadati di tutti i 28 commit raggiungibili dal ramo backup alla verifica e 28 blob backup distinti. Non include contenuti decifrati. Per aggiornarlo: `node scripts/inventario-backup-github.js` (nessuna scrittura remota).

Prima della cancellazione: verificare arresto degli uploader storici e disponibilità di una copia locale cifrata dello stato attuale, dopo le cancellazioni applicabili. Accertare che il ramo non sia più una dipendenza operativa. Solo allora autorizzare la rimozione del ramo remoto `backup`; ricontrollarne lo SHA subito prima, perché potrebbe cambiare.

Dopo: verificare assenza del ramo, controllare gli altri riferimenti con accesso completo, chiedere a GitHub la valutazione degli oggetti residui e conservare risposta/esito. Non descrivere la sola cancellazione del ramo come cancellazione definitiva. Per la copia PC, attendere il coordinamento con il lavoro ranked prima di eliminare riferimenti/reflog o eseguire garbage collection. Censire anche telefono, altri PC, esportazioni e destinatari.

La bozza locale per il supporto è `test-output/BOZZA-GITHUB-SUPPORT.md`: non inviata, va aggiornata con ciò che è stato effettivamente fatto. Non allegare database, backup o frasi segrete.

## Rotazione chiave

La procedura va adattata all'ambiente reale: `ADMIN_KEY` prevale sul file e `DATA_DIR` può cambiare la posizione del file. Non modificare il file presumendo che sia la fonte in uso.

1. Identificare la fonte effettiva senza stampare la chiave; mantenere la vecchia solo temporaneamente in memoria per la verifica.
2. Generare una nuova chiave casuale, conservarla nella fonte effettiva con permessi privati, senza argomenti shell contenenti segreti o cronologia con URL completi.
3. Riavviare il processo nella finestra concordata, verificando che lo script supervisore non reintroduca una variabile vecchia. Se cambiano tunnel/indirizzo, usare l'indirizzo aggiornato.
4. Da un controllo locale verso `127.0.0.1`, verificare `/stato.json`: vecchia chiave → 403; nuova chiave → 200. Scartare il corpo della risposta, che può contenere dati reali. Non registrare URL con query, header segreti o contenuti dello stato.
5. Verificare accessibilità del gioco, custodire la nuova chiave e registrare soltanto data ed esiti. Verificare le vecchie copie/log che potrebbero contenere la chiave revocata.

## Scelta email e tunnel

Valutazione preliminare al 22 ottobre 2026; nessun account creato, contratto accettato o servizio acquistato.

| Opzione | Evidenza pubblica | Verifica prima di scegliere |
|---|---|---|
| Brevo transazionale | Invio SMTP/API e offerta pubblica di 300 email gratuite al giorno; DPA indicato disponibile | Condizioni applicabili al piano scelto, attivazione SMTP, dominio/mittente verificato, conservazione dei log e dei messaggi, subfornitori/trasferimenti, eventuale marchio nelle email |
| Resend | Piano Free con limite giornaliero 100, SMTP e DPA pubblico incorporato nell'accordo | Quota mensile effettiva in iscrizione, verifica dominio, trasferimenti/subfornitori, conservazione, disponibilità e gestione delle risposte |
| Cloudflare Tunnel con hostname stabile | La procedura ufficiale richiede account Cloudflare e dominio su Cloudflare per pubblicare l'applicazione | Se il titolare possiede già un dominio utilizzabile; costo di un eventuale dominio, termini/DPA applicabili, DNS, gestione privata delle credenziali del tunnel |

Fonti: [Brevo](https://www.brevo.com/products/transactional-email/), [Resend piano](https://resend.com/pricing), [Resend DPA](https://resend.com/legal/dpa), [Cloudflare configurazione](https://developers.cloudflare.com/tunnel/get-started/).

Orientamento da valutare: usare un dominio controllato dal titolare sia per l'hostname stabile sia per autenticare il mittente email. Non è stato scelto o acquistato un dominio. Non si può configurare la zona DNS `github.io` come propria. Il link pubblico GitHub Pages del progetto può restare l'ingresso già usato.

Un servizio di invio transazionale non risolve automaticamente la gestione delle caselle privacy/assistenza e delle risposte agli avvisi di sicurezza: verificare anche ricezione, presidio e contratto della casella. Per il nuovo SMTP servirà una modifica mirata a `server/posta.js`, oggi vincolato a Gmail; implementarla dopo la scelta, con TLS obbligatorio e prova di invio/ricezione, mantenendo credenziali fuori dal repository. Disabilitare tracking aperture/link non necessario e scegliere conservazione giustificata. Aggiornare privacy e Data Safety solo sulla configurazione reale.

## Prova reale di cancellazione

Usare un profilo creato appositamente, senza partecipazioni con giocatori reali. Registrare versione, data e identificativo di prova non personale. Verificare login da due dispositivi, cancellazione dal primo e mancato accesso con password/chiave dal secondo, rimozione dei dati locali e assenza del profilo/riferimenti sul server. Verificare anche la gestione delle copie locali precedenti alla cancellazione. Non ripristinare un vecchio backup per la prova. Conservare solo esiti, senza credenziali o schermate amministrative integrali.

## Play Console dopo lo sblocco

Confermare tipo/data account, identità/trader, paesi e pubblico; confrontare chiave upload della Console con quella dell'AAB 1.30; attivare/verificare Play App Signing; caricare nel canale appropriato. Preparare una nuova build dalla versione finale pubblicata e verificata da Prove, con gli screenshot aggiornati indicati in `SCHERMATE.md`; l’AAB 1.30 e il materiale `040e6d2` precedono le rifiniture. Completare le dichiarazioni dalla mappa Data Safety dopo la scelta dei fornitori. Creare un account revisore verificato e inserire le credenziali solo in Console.

Per i tester predisporre privatamente il registro: identificativo T01, versione, dispositivo/Android, giorno, funzione provata, risultato, difetto e verifica della correzione. Adesioni e contatore devono risultare dalla Console. Nessun giorno, tester o feedback è precompilato come svolto. Applicare il percorso in `TEST-CHIUSO.md`.
