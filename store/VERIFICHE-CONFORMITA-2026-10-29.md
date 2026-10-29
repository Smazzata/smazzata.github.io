# Verifiche da remoto prima delle dichiarazioni Play

Preparazione della migrazione: [proposta tunnel stabile ed email](../docs/servizi-produzione-proposta.md). Supporto predisposto e testato, servizi non attivati; dominio ancora da scegliere.

Data: 29 ottobre 2026. Verifica tecnica e documentale, non attestazione generale di conformità. Nessuna casella contrattuale confermata, app non creata dall’assistente, nessun caricamento Play effettuato.

## Esiti realmente ottenuti

| Controllo | Esito | Limite |
|---|---|---|
| Account Google | Identità e numero di contatto verificati; Crea app disponibile | Modulo predisposto Smazzata / it.smazzata.app / italiano / gioco gratuito, dichiarazioni non accettate |
| Pagine pubbliche | Privacy, cancellazione, regole e licenze: HTTP 200, HTML via HTTPS senza login | Non dimostra ricezione delle email o adempimento di una richiesta reale |
| Privacy, scadenze e backup | `node -e "require('./server/privacy-test')()"` superato: cancellazione riferimenti, copie, credenziali, continuità partita e scadenze | Dati temporanei sul PC, non account reali su Termux |
| Percorso nel browser | `node server/privacy-uitest.js` superato: quattro pagine a 360 px, musica locale senza richieste musicali esterne, cancellazione e dati locali | Non è installazione da Google Play |
| Dipendenze | Audit iniziale: 1 vulnerabilità alta e 1 moderata. Aggiornati body-parser 1.20.8 → 1.20.9 e qs 6.16.0 → 6.16.2. Audit runtime finale: 0 segnalazioni note | Non è una garanzia di assenza di vulnerabilità nel servizio |
| Regressioni | Test rapidi e prova multigiocatore e2e passati, inclusi flussi amministrativi; 34 scene grafiche rigenerate | Server temporanei e browser sul PC |
| Licenze software | Rigenerati avvisi completi di 105 dipendenze runtime, Capacitor e due font | Dipendenze native finali e diritti sui contributi richiedono verifica distinta |
| Segreti nel checkout | 548 file tracciati censiti; scansione mirata senza riscontri di chiavi private PEM, token GitHub e chiavi API Google | Non copre tutti i formati, tutta la cronologia, segreti esterni o chiavi già condivise. La chiave APK pubblica resta distinta da quella upload privata |
| Vecchio ramo backup | Ramo presente, 8 file nel suo albero corrente, ultimo commit 21 ottobre 2026. Consultati soltanto metadati, nessun contenuto scaricato | Non certifica contenuto, cifratura, completezza della cronologia o liceità di ogni conservazione. Nessuna cancellazione eseguita |
| Server pubblico | /health risponde HTTP 200 nell’istante del controllo | Non dimostra disponibilità continuativa, aggiornamento alla nuova patch, capacità o ripristino |
| Pacchetto 1.72 | Verificato precedentemente: firma valida, 248 sorgenti coerenti, 34 scene dagli asset del pacchetto | Le librerie server ora corrette non sono installate sul telefono dal controllo locale; avvisi aggiornati richiedono nuova build ufficiale |

Le correzioni e gli avvisi aggiornati portano il client a 2026.10.29.1 e le due cache a v94. Il push avvia le prove e una nuova build Android. Non sostituire a mano l’AAB 1.72 o lo ZIP storico già verificato.

Approfondimento fornitori: [condizioni e azioni concrete](../docs/fornitori-verifica-2026-10-29.md). Cloudflare incorpora il DPA nel contratto Self-Serve: resta da verificare la configurazione effettiva; per GitHub distinguere i trattamenti da titolare da quelli svolti per conto del gestore. Non tutti i servizi richiedono un DPA separato.

## Problemi da risolvere prima del lancio pubblico

1. **Backup pregressi.** Inventariare le copie e le cancellazioni richieste, verificare una copia attuale lecita e cifrata, poi bonificare con autorizzazione esplicita i riferimenti e, se necessario, richiedere assistenza GitHub. Eliminare il solo ramo non prova la rimozione di ogni oggetto storico. Procedura in docs/privacy-operazioni.md.
2. **Tunnel e continuità.** scripts/android-server.sh usa Quick Tunnel, con hostname temporaneo. La documentazione Cloudflare lo destina a sviluppo/test: nessuna garanzia uptime e limite 200 richieste contemporaneamente in volo (non equivale a 200 giocatori). Per produzione predisporre un tunnel stabile o hosting adeguato, verificando termini e account reali; niente acquisti o migrazioni eseguiti.
3. **Fornitori e email.** Il codice invia tramite Gmail. Non è stato verificato un accordo applicabile al servizio effettivo, né la ricezione nelle due caselle del titolare. Il CDPA Google consultato riguarda Workspace/Cloud Identity: non prova una copertura del Gmail consumer. Cloudflare pubblica un DPA ma la sua esistenza non prova quale accordo si applichi al Quick Tunnel usato. Per GitHub distinguere sito pubblico, release e vecchi backup; nessun DPA specifico dichiarato come accettato.
4. **Sicurezza operativa.** Confermare su Termux revoca della vecchia chiave admin, aggiornamento delle dipendenze dopo Prove, backup cifrato e ripristino, cancellazione di un account appositamente creato. Non usare il profilo Simone per prove distruttive.
5. **Titolare, pubblico e diritti.** Confermare dati di contatto presidiati, status trader/professionale, paesi e fasce di età effettive. Provenienza delle illustrazioni e sintesi musicale documentata; nessuna ricerca marchi completa, autorizzazione su ogni contributo storico o certificazione di unicità musicale effettuata. Le norme esportazione e la conformità globale non vengono determinate dall’audit npm.
6. **Console e test.** Compilare dati, accesso revisori e classificazione sulla versione effettiva; installazione da Play ancora da provare. Email tester aggiungibili dopo la creazione, conservate privatamente. Per i nuovi account personali cui si applica il requisito: almeno 12 adesioni continuative per 14 giorni; non decorrono dalla creazione dell’app.

## Ambito di GitHub Pages

La copia su Pages ospita ingresso, documenti e allenamento locale; il backend online e l’autenticazione sono sul server di gioco, non su Pages. GitHub sconsiglia le transazioni sensibili su Pages e ne limita gli usi commerciali: rivalutare l’hosting prima di monetizzazione/SaaS; non usare Pages come deposito di dati personali o credenziali. Non è stata accertata un’infrazione specifica del sito gratuito attuale.

## Fonti ufficiali consultate

- Google, dati utente: https://support.google.com/googleplay/android-developer/answer/10144311
- Google, cancellazione: https://support.google.com/googleplay/android-developer/answer/13327111
- Google, test: https://support.google.com/googleplay/android-developer/answer/9845334?hl=it
- Google, requisiti nuovi account personali: https://support.google.com/googleplay/android-developer/answer/14151465
- Cloudflare, Quick Tunnels: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
- Cloudflare, DPA: https://www.cloudflare.com/cloudflare-customer-dpa/
- Google Workspace, CDPA: https://knowledge.workspace.google.com/admin/compliance/privacy-compliance-and-records-for-google-workspace-and-cloud-identity
- GitHub Pages, HTTPS e dati sensibili: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- GitHub Advisory body-parser: https://github.com/advisories/GHSA-27r3-jxmh-p828
- GitHub Advisory qs: https://github.com/advisories/GHSA-6pq8-jhm2-2vcw
