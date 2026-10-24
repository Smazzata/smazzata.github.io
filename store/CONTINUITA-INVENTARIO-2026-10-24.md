# Inventario, conferme e continuità — 24 ottobre 2026

## Modifiche

- Conferma leggibile dell’oggetto equipaggiato, dopo il salvataggio riuscito.
- Selezione avatar salvata prima della conferma e ripristinata in caso di errore.
- Messaggio di ricollegamento fino al ritorno dello stato del server.
- Collezione e bottino aggiornati quando lo stesso account li modifica da un altro dispositivo. Segnale privato senza contenuti personali.
- Un aggiornamento arrivato in ritardo non riapre il menu chiuso dall’utente; nessuna interruzione delle aperture in corso.
- Traduzioni aggiornate; versione client 2026.10.24.8, entrambe le cache v76; screenshot store rigenerati.

## Verifiche realmente ottenute

- test:rapido: superato.
- test:prerilascio: 57 test superati.
- e2e multigiocatore: superato.
- chest-uitest.js: superato.
- chest-uitest.js --first-use --small: superato a 320 px, 10 tocchi sui comandi visibili, sincronizzazione con una seconda connessione e recupero dopo interruzione della rete.
- release-ui-test.js --store: superato, 32 scene; verifica e impronte delle sorgenti in schermate-rilascio/VERIFICA.json.
- Simulazione annuale: 365 giorni, 2.190 eventi di fine partita validi, 942 chest assegnate, 183 aperte e 759 conservate. Due chiavi dispositivo sullo stesso profilo; controllate aperture e scambi concorrenti, recupero della conferma persa, ripetizione delle 183 ricevute, riavvio del server e isolamento da altri profili.
- I 2.190 eventi simulano la progressione: non sono 2.190 partite complete del motore.

## Limiti

Le prove guidate sono automatiche su profili temporanei: non sostituiscono una sessione osservata con persone inesperte. Nessun messaggio o regalo è stato inviato a utenti reali. Nessuna prova su telefono fisico né pubblicazione Play Console. La disponibilità online della nuova versione richiede il completamento di Prove e il successivo aggiornamento del server.
