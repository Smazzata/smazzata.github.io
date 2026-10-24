# Sicurezza dei dati — scheda di compilazione

Versione verificata: 21 ottobre 2026. Questa è una mappa del codice attuale, non una dichiarazione già inviata alla Play Console. Ricontrollare il pacchetto AAB definitivo e i servizi effettivamente configurati prima di inviare il modulo.

## Risposte generali

- L'app trasmette dati fuori dal dispositivo: **sì**. La WebView di Capacitor è parte dell'app: non è un'esenzione.
- Trasporto verso i servizi pubblici: HTTPS/WSS; email dal server tramite SMTP TLS. Verificare anche la configurazione reale.
- Vendita di dati: nessuna funzione di vendita nel codice.
- Account: nickname/password; conferma e recupero email quando il servizio email è configurato. Accesso con password, codice di recupero o chiave dispositivo; non con Google/Facebook.
- Profilo facoltativo per giocare offline contro il computer. Non descrivere la raccolta come obbligatoria per ogni utilizzo dell'app: distinguere i campi necessari alla registrazione dalla possibilità di usare l'app senza account.
- Eliminazione nell'app: Profilo → Elimina il mio profilo.
- Eliminazione senza app: https://smazzata.github.io/gioca/elimina-profilo.html
- Privacy: https://smazzata.github.io/gioca/privacy.html
- Pubblicità, acquisti, SDK di analytics e Advertising ID: non presenti nella versione attuale. Ricontrollare le dipendenze finali; non estendere questa risposta a versioni future.

## Dati da dichiarare

Le etichette possono cambiare nella Console. Selezionare le categorie corrispondenti, non copiare alla cieca una risposta «non raccoglie dati».

| Categoria Google Play | Dati effettivi | Finalità proposte | Facoltatività e conservazione |
|---|---|---|---|
| Informazioni personali → Indirizzo email | Email di conferma, recupero e notifiche di sicurezza | Gestione account; sicurezza/prevenzione frodi dove pertinente | Raccolta con il profilo online; necessaria quando la conferma email è attiva. Offline senza account disponibile. Fino alla cancellazione |
| Informazioni personali → ID utente | Nickname, identificativo del profilo, codici/chiavi di accesso e recupero (impronte per le chiavi dispositivo) | Funzionalità; gestione account; sicurezza | Profilo online facoltativo; identificativi necessari per usarlo |
| Attività nell'app → Interazioni con l'app | Mosse, risultati, classifica/grado, trofei, livello, sfide, tornei, amici e inviti; inventario avatar/chest, aperture con data e premio, frammenti, scambi e contatori di garanzia | Funzionalità dell'app | Trasmesse quando si usano le relative funzioni online; non analytics pubblicitari. Inventario e ricevute conservati nel profilo fino alla sua cancellazione; copia locale funzionale |
| Messaggi → Altri messaggi in-app | Chat fra giocatori e chat allegata alle segnalazioni | Funzionalità; sicurezza e moderazione | Messaggi volontari. La sola chat ordinaria è temporanea, gli allegati alle segnalazioni persistono fino a 90 giorni |
| Attività nell'app → Altri contenuti generati dagli utenti | Testi delle segnalazioni, nomi dei tornei/campionati, link musicali condivisi, avatar predefinito scelto | Funzionalità; assistenza; sicurezza | Volontari; segnalazioni massimo 90 giorni e 100 voci |
| Informazioni e prestazioni dell'app → Diagnostica | Browser/dispositivo, dimensioni schermo e contesto tecnico allegati manualmente alla segnalazione | Funzionalità/assistenza, secondo le opzioni del modulo | Invio volontario col pulsante Segnala un problema; niente SDK automatico di crash reporting |
| ID dispositivo o altri ID | Endpoint e chiavi Web Push, impronte di chiavi per dispositivo se incluse in questa categoria dalla definizione vigente | Funzionalità; gestione account; sicurezza | Push solo dopo attivazione; chiavi di accesso necessarie per il profilo |

Non raccogliamo nome anagrafico degli utenti, rubrica, posizione GPS, dati audio/foto, informazioni sanitarie o pagamenti. Il nickname non è necessariamente un nome anagrafico. La password è un hash scrypt con sale, non una password cifrata reversibilmente.

### Raccolta temporanea

Non escludere dal questionario un dato soltanto perché resta in memoria: verificare le domande sul trattamento effimero. La chat allegata a una segnalazione non è effimera. L'IP è trattato per limiti di accesso in finestre di 10 minuti, con eliminazione dei limiti scaduti ogni minuto; verificare separatamente log di Cloudflare e degli altri fornitori. Non dichiarare raccolta di posizione se l'IP non viene usato per ricavarla.

### Condivisione

La risposta non si deduce dalla presenza di Cloudflare/GitHub/Google. Le eccezioni per fornitori che operano per conto del titolare e per trasferimenti avviati consapevolmente dall'utente vanno applicate solo se ne ricorrono le condizioni contrattuali e tecniche. Documentare i contratti reali prima di segnare «non condiviso». Nickname, avatar, risultati e messaggi sono visibili ai destinatari descritti nell'informativa; l'email non è pubblica.

Spotify ora è un collegamento esterno scelto dall'utente: nessun iframe viene caricato nell'app. Non dichiarare raccolta di dati Spotify da parte di Smazzata se non avviene.

## Controllo finale per ogni riga

1. Verificare raccolto/condiviso rispetto alla definizione attuale Google e ai contratti del fornitore.
2. Indicare tutte e soltanto le finalità effettive.
3. Verificare se tutti gli utenti possono evitare la raccolta, ad esempio giocando senza account, e rispondere coerentemente alla domanda sulla facoltatività.
4. Distinguere trattamento effimero e conservazione su disco.
5. Confrontare modulo, privacy, cancellazione, AAB e backend della medesima release.

Fonte: [Guida ufficiale Sicurezza dei dati](https://support.google.com/googleplay/android-developer/answer/10787469?hl=it). Non è un'autocertificazione legale né un'esenzione dalle verifiche richieste al titolare.
