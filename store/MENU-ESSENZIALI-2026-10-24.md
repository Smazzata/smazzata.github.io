# Menu essenziali e impostazioni — 24 ottobre 2026

## Struttura

- Home: scelta del gioco e quattro modalità con descrizioni brevi. Profilo tramite il proprio nome; Collezione, Amici e Menu nella barra inferiore, sempre raggiungibile su telefono. Tolti scorciatoie duplicate in alto, collegamento separato alla posta e riepilogo di livello/serie davanti ai pulsanti. Restano avvisi necessari per inviti, ripresa delle partite, sicurezza e aggiornamenti.
- Menu: Il mio profilo, Attività, Impostazioni, Aiuto. Per gli ospiti l’account porta al recupero; offline compaiono soltanto funzioni utilizzabili.
- Attività: classifica personale, sfida del giorno e tornei.
- Aiuto: allenamento guidato, regole dei quattro giochi, guida iniziale e segnalazione; informazioni, privacy e regole di comportamento raccolte in fondo.
- Impostazioni: cinque categorie, Suoni e musica, Aspetto, Leggibilità, Notifiche, Lingua. Notifiche escluse offline. Stile delle carte e altre opzioni restano nei dettagli dell’aspetto. Ogni scelta mantiene aperta la categoria corrente e i dettagli che l’utente ha espanso.
- Nuova partita: numero di giocatori e avvio; difficoltà del computer e regole avanzate solo quando richieste. Anche la preferenza di interfaccia completa non apre più da sola i dettagli del setup o della sala d’attesa.
- Partita: riprendi, punteggi, aiuto, preferenze personali, impostazioni del tavolo per l’host e uscita. Resa e chiusura restano tra le opzioni della partita, con le conferme esistenti. Tolte dalle preferenze personali.
- Profilo: nome, accesso/sicurezza, recupero e gestione account in sezioni distinte. Password mancante o email da confermare aprono automaticamente la sicurezza. Recupero e cancellazione inizialmente chiusi. Nessuna modifica alle operazioni account.

Gli stili dei menu sono coerenti: stessa disposizione, icone originali, testi brevi, comandi adatti al tocco. Nessuna nuova API, ricompensa o modifica alle probabilità. Collezione e apertura delle chest al tocco conservate.

## Verifiche ottenute

- test:rapido: superato.
- test:prerilascio: 63 test superati, inclusa navigazione Indietro aggiornata.
- e2e multigiocatore: superato.
- Nuova prova --menus: Home, quattro sezioni, cinque categorie, preferenze e dettagli conservati dopo la modifica, Indietro tra categorie/menu, attività, aiuto, profilo e controlli host. Verificati 320/375/768 pixel, entrambi i temi e testo molto grande. Verificato anche caricamento reale della modalità senza rete e assenza di comandi online.
- Primo uso --first-use --small: superato, nove tocchi a 320 pixel, equipaggiamento, apertura, seconda connessione, riconnessione e avvio partita.
- Inventario completo: superato.
- --polish: superato, incluse regole, campionati, tornei, selezioni, errori inline e profilo.
- --home: superato, incluse modalità, classifica personale, scelta del gioco e difficoltà del computer.
- Screenshot store: 32 scene verificate e selezione rigenerata; impronte delle sorgenti in schermate-rilascio/VERIFICA.json.

Versione client 2026.10.24.11, entrambe le cache offline v79, traduzioni EN/ES/PT aggiornate (2.982 testi). Le prove sono automatiche su profili temporanei; non attestano prove con utenti reali, telefono fisico o aggiornamento online. Il server si aggiorna dopo Prove superato e il successivo controllo degli aggiornamenti.
