# Fornitori: verifica delle condizioni applicabili

29 ottobre 2026. Fonti ufficiali consultate online e confronto con il codice. Nessun contratto accettato, account creato, acquisto o migrazione eseguiti. I ruoli privacy dipendono dal trattamento specifico: non tutti i servizi esterni sono automaticamente responsabili del trattamento per ogni dato.

## Informazioni confermate dal titolare

Durante questa verifica il titolare dichiara che le due caselle sono Gmail e che non dispone di un account Cloudflare intestato a sé. Non trascriviamo nuovi indirizzi dal messaggio vocale e non cambiamo quelli già documentati. Non sono stati mostrati contratti Workspace o altri accordi specifici per l’email. L’assenza di un account Cloudflare rende concreta la necessità di predisporre una configurazione di produzione e identificarne l’accordo, invece di presumere una sottoscrizione Self-Serve già verificata.

## Risultato sintetico

| Fornitore e impiego | Riscontro | Cosa manca per chiudere |
|---|---|---|
| Cloudflare: proxy del server | Il Self-Serve Subscription Agreement, §6.1, incorpora il DPA per i dati personali trattati come responsabile/subresponsabile. Il DPA non è riservato al piano Enterprise | Verificare il servizio/account e il contratto realmente applicabile al Quick Tunnel; per produzione configurazione stabile conforme alla documentazione |
| Google: email operative | Il codice configura SMTP Gmail. Il CDPA ufficiale copre i servizi dei contratti indicati, fra cui Workspace/Cloud Identity; non è provata una sua estensione automatica a Gmail personale | Confermare tipo di account e contratto. Se Gmail consumer senza copertura documentata, scegliere prima del lancio una soluzione email con accordo adeguato al trattamento; nessun abbonamento deciso |
| GitHub: codice, sito statico, release | GitHub documenta la raccolta degli IP dei visitatori Pages per sicurezza e una propria informativa per i trattamenti svolti come titolare. Il DPA è parte del Customer Agreement cui si riferisce | Identificare accordo dell’account/organizzazione per gli usi che comportano trattamento per conto del gestore. Non dedurre copertura DPA dalla sola esistenza della pagina contrattuale |
| GitHub: vecchi backup | Già verificata la presenza del ramo storico, senza scaricarne i contenuti | Inventario privato e bonifica autorizzata. Non presentare GitHub come semplice contenitore di file pubblici finché questo punto resta aperto |

## Cloudflare — confermato e non confermato

Fonti:
- [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/), ultimo aggiornamento indicato 12 settembre 2025: §1 per l’ambito dei servizi, §2.6 per servizi gratuiti, §6.1 per incorporazione del DPA.
- [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), versione 6.4, efficace 3 aprile 2026.
- [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Il §6.1 dà una risposta concreta: sotto l’accordo Self-Serve il DPA è incorporato, non serve presumere una firma separata. Tuttavia il §1 descrive servizi forniti con sottoscrizione o account e software connesso. Il codice attuale avvia `cloudflared tunnel --url` e usa un indirizzo temporaneo trycloudflare.com; non mostra né prova un account intestato al gestore o un tunnel nominato. La documentazione Quick Tunnel ne indica l’uso per sviluppo/test e non una distribuzione di produzione. Non deduciamo dal solo binario quale accordo sia stato accettato dal titolare.

Azione: acquisire solo il nome del servizio/piano e il riferimento contrattuale, senza token o password; predisporre un tunnel stabile prima della produzione. Se la copertura del Quick Tunnel deve essere provata per il periodo precedente, occorre un chiarimento del fornitore tramite canale autorizzato. Non è stato inviato alcun messaggio.

## Google/Gmail — il codice non prova il contratto

Fonti:
- [CDPA Google](https://cloud.google.com/terms/data-processing-addendum/): definizioni e appendice relativa a Workspace/Cloud Identity.
- [Guida all’applicazione del CDPA](https://knowledge.workspace.google.com/admin/compliance/privacy-compliance-and-records-for-google-workspace-and-cloud-identity): quando incorporato nel contratto non è richiesta un’ulteriore adesione; altrimenti Google indica la procedura amministrativa.
- [Gmail personale e Workspace](https://support.google.com/mail/answer/56256): Google distingue le due offerte; non dichiara che ogni uso professionale di Gmail sia vietato.

`server/posta.js` invia destinatario e testo (nickname/codici di verifica o recupero) tramite SMTP Gmail. Le caselle pubblicate terminano in gmail.com, ma questo e il trasporto SMTP non bastano a identificare con certezza tutti i contratti o abbonamenti del titolare. Il file di configurazione sul telefono non è stato letto e non è necessario pubblicarlo per questa verifica.

Non concludiamo “Gmail è illegale” o “serve obbligatoriamente Workspace”. Concludiamo: una copertura contrattuale adeguata per questo flusso non è stata documentata. Per chiudere serve il tipo di servizio e il contratto applicabile, oppure una soluzione alternativa con DPA pertinente, termini e costi da valutare prima di sceglierla. La gestione delle richieste privacy nelle caselle richiede inoltre accesso, presidio e regole di conservazione: non è risolta dal solo invio SMTP.

## GitHub — separare i trattamenti

Fonti:
- [GitHub Data Protection Agreement](https://github.com/customer-terms/github-data-protection-agreement): apertura e definizione di Online Services nel contratto richiamato.
- [Informativa GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement): ambito dei trattamenti come titolare.
- [GitHub Pages e raccolta IP](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).
- [Condizioni prodotti aggiuntivi](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features).

Pages serve materiale statico e il gioco locale; non ospita il backend di autenticazione o il database online. Gli IP dei visitatori sono comunque trattati da GitHub. Per questi trattamenti occorre distinguere il ruolo proprio del fornitore, descriverlo correttamente e valutare termini e trasferimenti; non assumere che sia sempre un responsabile al quale far firmare un DPA.

Per eventuali dati caricati per conto del gestore il DPA esaminato rinvia al Customer Agreement: la sua disponibilità pubblica non prova l’adesione di questa organizzazione, né la sua assenza. Non abbiamo verificato il piano o il contratto privato dell’account. Non consigliamo un acquisto Enterprise sulla sola base di questa incertezza.

I vecchi backup sono un problema distinto da risolvere anche se il contratto è adeguato: cifratura o DPA non sostituiscono minimizzazione, cancellazioni e gestione delle copie. Nessun ramo, commit o backup eliminato in questa sessione.

## Evidenze minime da conservare privatamente

Per ogni servizio: titolare dell’account, nome prodotto/piano, data/versione del contratto applicabile e dove è incorporato il DPA quando serve, trattamenti coperti e meccanismo dei trasferimenti pertinenti. Conservare questi riferimenti senza password, codici, token, elenchi utenti o contenuti delle email nel repository.

La verifica delle fonti pubbliche è conclusa. Il titolare ha confermato Gmail e nessun proprio account Cloudflare: restano da selezionare/configurare i servizi di produzione e documentare i contratti applicabili, senza presumere che sia obbligatorio un piano a pagamento. Non sono state create utenze o accettate condizioni. Il modulo Play rimane preparato ma non confermato.
