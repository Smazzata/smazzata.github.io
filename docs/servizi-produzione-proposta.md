# Proposta per il passaggio ai servizi di produzione

Verificata il 29 ottobre 2026. Il titolare conferma che non possiede un dominio né un account Cloudflare. Nessun acquisto, contratto, nuovo account o invio reale eseguiti.

## Proposta

Mantenere il server Termux, acquistare un solo dominio dopo scelta e autorizzazione del titolare, configurare un tunnel Cloudflare nominato e Brevo per le email transazionali. Lo stesso dominio può avere un sottodominio per il gioco e un mittente autenticato per l’email. Non è necessario spostare il database su un nuovo hosting per questa migrazione; restano però continuità, capacità e ripristino del telefono da verificare.

Il prezzo del dominio dipende dal nome, dal registrar, dall’estensione e dal rinnovo: nessuna cifra o disponibilità inventata. Per chi non ha un dominio questa proposta non è completamente gratuita. Verificare il piano effettivo e le quote Cloudflare in fase di registrazione; non selezionare piani a pagamento, SLA o funzionalità aggiuntive senza autorizzazione. Non confondere eventuali posti Access per dipendenti con il numero dei giocatori della normale app pubblica.

## Confronto email

| Servizio | Piano gratuito consultato | Integrazione e condizioni | Valutazione |
|---|---|---|---|
| Brevo | 300 invii/giorno, quota non cumulabile | SMTP incluso, dominio/mittente da autenticare; guida ufficiale colloca il DPA nelle condizioni | Proposta iniziale: più margine per conferme e recuperi |
| Resend | 3.000 invii/mese e 100/giorno | DPA e termini pubblici, dominio di invio da verificare | Alternativa se più adatta al titolare; quota giornaliera inferiore |
| Gmail attuale | Non usato come confronto economico per una nuova offerta | Compatibilità conservata, copertura contrattuale specifica non documentata | Non migrato automaticamente né dichiarato soluzione di produzione già verificata |

Le quote sono email, non utenti: registrazione, reinvio, recupero e avvisi consumano più invii per persona. Per la prova con 15–20 tester le quote possono bastare, ma dipende dalle azioni reali. La coda Brevo oltre quota non è una garanzia di consegna tempestiva: i codici scadono. Ricontrollare i termini e il piano nel proprio account prima dell’adesione; la pagina legale Brevo non è stata interamente estratta dal lettore web, mentre la guida ufficiale conferma dove reperire il DPA. Nessuna copertura contrattuale personale già attiva viene attestata.

SMTP transazionale non è hosting di una casella email: Brevo non sostituisce automaticamente le caselle assistenza/privacy. Va valutato separatamente un recapito presidiato e un servizio mailbox con condizioni adeguate per le richieste ricevute. I recapiti pubblici e la privacy attuale non sono stati sostituiti con servizi non ancora attivi. Prima della migrazione aggiornare informativa, mappa dati, fornitori, conservazione/log e trasferimenti realmente applicabili; disattivare tracciamento aperture/click non necessario e non importare rubriche marketing.

## Preparazione tecnica già presente

- `server/mail-config.js`: legge il file privato email storico a due righe oppure JSON SMTP; porta 465 con TLS diretto, 587/2525 con STARTTLS obbligatorio e verifica dei certificati. Mittente distinto dal login. Nessun fallback Gmail se JSON malformato.
- `server/posta.js`: usa la configurazione selezionata, conserva la modalità test senza invii, rilegge entro un minuto anche le credenziali ruotate dello stesso utente. Nessuna nuova dipendenza.
- `scripts/tunnel-stabile.sh`: valida l’hostname pubblico HTTPS senza credenziali, query o percorso; non legge o stampa il contenuto del token.
- `scripts/android-server.sh`: senza file stabili conserva Quick Tunnel; se uno dei due file è presente ma la configurazione è incompleta si ferma con errore invece di tornare silenziosamente al tunnel temporaneo. Tunnel nominato con `--token-file`, cloudflared >=2025.4.0; pubblica l’hostname al primo messaggio di connessione registrata, una volta per processo, evitando i push concorrenti delle quattro connessioni.

La connessione registrata da cloudflared non attesta DNS o route corretti: prima del passaggio verificare il nuovo hostname dall’esterno e il multiplayer. Nessun test di collegamento reale al tunnel nominato è stato eseguito in assenza dell’account.

## Passi che richiedono il titolare

1. Scegliere un dominio, verificare disponibilità, prezzo di primo anno/rinnovo e autorizzare l’eventuale acquisto. Non è stato prenotato un nome.
2. Creare gli account necessari e leggere/accettare le condizioni. Conservare privatamente le evidenze DPA pertinenti. Non inviare token in chat.
3. Collegare il dominio a Cloudflare e creare un tunnel nominato; configurare nel pannello una route pubblica al servizio `http://localhost:3000`. L’app online deve restare accessibile senza una pagina Access con OTP davanti al gioco. Non esporre porte del router.
4. In Brevo, verificare dominio e mittente, aggiungere i record DNS richiesti (DKIM/DMARC e gli altri effettivamente indicati, senza inventare record o duplicare SPF). Verificare abilitazione SMTP, quota e conservazione dei log; generare una chiave SMTP con l’autorizzazione del titolare. Una chiave API non è automaticamente una chiave SMTP.
5. Sul telefono con Termux applicare la configurazione privata e fare prove con indirizzi controllati dal titolare. Il codice permette la migrazione ma non attesta l’accettazione dei contratti.

## Configurazione email, sul solo telefono

Il file privato rimane `~/.burraco-mail`, oppure il percorso indicato da MAIL_FILE. Non committarlo. Dopo aver conservato privatamente la configurazione precedente per il ripristino, sostituirne il contenuto con JSON completo. Esempio NON utilizzabile senza valori reali:

```json
{
  "host": "smtp-relay.brevo.com",
  "port": 587,
  "user": "LOGIN_SMTP_FORNITO_DAL_SERVIZIO",
  "pass": "CHIAVE_SMTP_PRIVATA",
  "from": "accesso@dominio-da-scegliere.invalid"
}
```

Modificare con editor locale e impostare permessi 600. Non usare la password del normale account Brevo né incollare la chiave in comandi salvati nella cronologia. Non rinominare le caselle pubbliche prima di averle attivate. Il comando storico `--set-mail` continua a configurare Gmail e sovrascrive il file: non usarlo per configurare SMTP.

Il controllo del formato avviene alla lettura; la verifica della consegna deve essere esplicita, non una campagna o invio a tutti gli utenti. Se SMTP rifiuta la richiesta il server non torna automaticamente a Gmail. Per rollback ripristinare privatamente il vecchio file e attendere il ricaricamento o riavviare.

## Configurazione tunnel, sul solo telefono

Preparare due file fuori dal repository con permessi 600:

- `~/.smazzata-tunnel-token`: solo il token del tunnel nominato.
- `~/.smazzata-tunnel-url`: solo l’URL pubblico, ad esempio `https://gioca.dominio-da-scegliere.invalid` (segnaposto).

Prima di riavviare lo script principale, provare il tunnel nominato e il suo hostname dall’esterno. Poi avviare lo script aggiornato in una finestra di manutenzione controllata: il processo shell già in esecuzione non adotta da solo il nuovo ramo. I dati e le partite persistenti non vanno cancellati. Se serve tornare al sistema di test, spostare entrambi i file in una posizione privata di conservazione e riavviare; l’URL del tunnel temporaneo cambierà. Nessuna cancellazione di file o credenziali è stata eseguita dall’assistente.

## Verifiche prima di dichiarare la migrazione completata

76 test di prerilascio e prova e2e passati sul PC; cinque nuovi test coprono Gmail precedente, TLS/mittente/password SMTP, configurazione invalida, invio con trasporto simulato e rotazione, validazione hostname con Bash. Controllata la sintassi Bash. Nessuna email reale o DNS modificato da queste prove. Restano invio/ricezione e recupero con account di prova, route/DNS/WebSocket, spegnimento e riapertura, disponibilità server e configurazione contrattuale reale.

Questa modifica riguarda server e script: non cambia l’interfaccia o dichiara un nuovo fornitore attivo nel pacchetto Android. Il nuovo servizio va indicato nella privacy quando viene effettivamente adottato e prima dell’uso con utenti reali.

## Fonti ufficiali

- [Tunnel: requisiti account e dominio](https://developers.cloudflare.com/tunnel/get-started/)
- [Tunnel: parametri e token-file](https://developers.cloudflare.com/tunnel/reference/run-parameters/)
- [Cloudflare, condizioni e DPA incorporato](https://www.cloudflare.com/terms/)
- [Brevo, piano e quota gratuita](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)
- [Brevo, limiti e coda](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Brevo, SMTP e autenticazione dominio](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- [Brevo, ubicazione del DPA](https://help.brevo.com/hc/en-us/articles/15403782599570-Where-can-I-find-the-Data-Processing-Agreement-DPA)
- [Resend, prezzi](https://resend.com/pricing?product=transactional)
- [Resend, DPA](https://resend.com/legal/dpa)
