# Inventario, posta e invii amministrativi — 24 ottobre 2026

Base: `3733eeb`. Implementazione richiesta dal titolare: inventario personale per chest e oggetti, comunicazioni e regali mirati dalla pagina di stato.

## Risultato

- Accessi Inventario personale e Posta personale in Home, Altro e profilo; conteggio dei messaggi non letti.
- Chest raggruppate per rarità, selezione del tipo da aprire, probabilità effettive e garanzie esposte dal server. Stesse percentuali precedenti; sempre un oggetto per chest.
- Posta paginata, lettura persistente, ricevute dei regali. Oggetti specifici già posseduti convertiti nei frammenti della loro rarità.
- Compositore amministrativo dalla pagina di stato: utenti singoli/multipli, tutti gli iscritti attuali, iscritti da/prima di una data italiana. Anteprima completa con conferma separata; nessuna consegna alla sola preparazione.
- Scelta di una chest delle quattro rarità oppure di un avatar/cosmetico preciso, o solo messaggio. Notifica push facoltativa sui dispositivi abilitati; nessuna email.
- Persistenza atomica delle consegne con rollback, ricevute contro duplicati anche dopo riavvio, nessuna API di assegnazione accessibile ai giocatori, token anti-CSRF sul pannello.
- Registrazione della data per i nuovi iscritti; recupero della data documentata `terms` per i precedenti. I profili senza data sono indicati ed esclusi dai filtri temporali.
- Privacy aggiornata, traduzioni inglese/spagnolo/portoghese rigenerate, cache offline v71, build client 2026.10.24.3.

## Verifiche realmente eseguite

- `npm run test:rapido`: passato (motori, archivio, privacy, lingue, copertura offline e simulazioni).
- `npm run test:prerilascio`: 34 prove passate, incluse le tre di result-progress e cinque nuove prove di invio/inventario.
- `npm run e2e`: passato integralmente sul server temporaneo.
- `node server/chest-uitest.js`: passato, incluse nuove verifiche di posta paginata e lettura, regalo visibile, selezione chest e probabilità, modale scorrevole, compositore amministrativo mobile, anteprima e invio dal browser. Conservate le verifiche dei 100 cosmetici, 20 effetti e 4 sprite.
- `node server/uitest.js --polish`: passato, ripetuto dopo gli accessi Home.
- `node server/release-ui-test.js --store`: passato, 24 acquisizioni e nove screenshot store; 148 hash delle sorgenti verificati senza difformità.
- `node --test server/deliveries-test.js server/deliveries-e2e-test.js`: cinque prove ripetute e passate dopo gli ultimi ritocchi al pannello.
- Prove privacy dedicate ripetute dopo l'aggiunta della pulizia dei riferimenti nei titoli dello storico: passate.
- `node scripts/lingue.js --check`: 2828 testi aggiornati.
- Diff controllato; nessun database, chiave privata, backup o artefatto temporaneo aggiunto.

## Limiti e distribuzione

Gli invii riguardano i destinatari fissati nell'anteprima; non sono regole automatiche per iscrizioni future. Per il benvenuto periodico si seleziona un intervallo dei nuovi iscritti. Una nuova anteprima crea un nuovo invio intenzionale: il blocco duplicati protegge la ripetizione della stessa conferma.

La notifica push richiesta non prova la ricezione sul telefono: la consegna garantita dal salvataggio è la posta personale con il regalo accreditato. I test hanno usato soltanto server e utenti temporanei, senza invii reali o notifiche esterne a dispositivi degli utenti.

Gli screenshot store usano file locali e risposte dimostrative; i controlli della posta e del pannello usano un server temporaneo reale. Non attestano una pubblicazione Android o l'aggiornamento del server pubblico. Il server si aggiorna soltanto dopo Prove; stato remoto da verificare dopo il push. L'AAB precedente non viene rigenerato o pubblicato da questa modifica.

## Secondo controllo — casi limite e prove estese

Correzioni successive richieste dal titolare:

- I filtri data vengono validati soltanto quando si sceglie l'intervallo di iscrizione: valori rimasti nei campi non bloccano gli invii per nickname o a tutti.
- Date impossibili restituite come errore comprensibile; timestamp storici non validi ignorati, con recupero della data documentata quando disponibile.
- Paginazione della posta ricondotta a pagine valide: una richiesta oltre l'ultima pagina mostra l'ultima disponibile. Copiati soltanto i venti messaggi da mostrare, anziché l'intero archivio.
- Richieste amministrative con contenuto inatteso rifiutate senza accedere a un corpo assente.

Verifiche aggiunte e passate: due conferme HTTP simultanee assegnano un solo regalo; parametri regalo/destinatari alterati nella conferma non cambiano l'anteprima; conferme sconosciute rifiutate; regalo di avatar e doppioni; destinatari eliminati o ospiti esclusi; garanzie invariate dalla consegna; 10.003 messaggi paginati senza modificare l'archivio; invio simulato a 1.000 profili con un solo salvataggio e nessuna scrittura al replay; anonimizzazione del titolo dello storico senza perdere la ricevuta antireplica.

Passati `npm run test:rapido`, le 37 prove di `test:prerilascio` prima dell'ultimo caso massivo e tutte le nove prove dedicate dopo la sua aggiunta. Privacy verificata anche con la nuova asserzione sullo storico. Nessun cambiamento visivo o alle probabilità, nessun invio reale.

Anche `npm run ui` è passato integralmente: Burraco e Scala 40 giocati tramite tocchi, Canasta, avvio Ramino, moviola, impostazioni, tornei, offline, aggiornamenti APK/Store e tre lingue, senza errori della pagina. Non sono stati modificati file dell'interfaccia: gli screenshot store precedenti restano pertinenti.
