# Verifica distribuzione Home — 25 ottobre 2026

Segnalazione: navigazione ancora sovrapposta. Riscontro diretto sul server pubblico: CLIENT_BUILD 2026.10.24.11, mentre la correzione è nella .12 (582dbe9). Il workflow Prove 40136103206 è fallito nel passaggio unico delle otto prove UI; il server ha quindi conservato la versione precedente come previsto.

Tutte le otto prove rieseguite localmente e superate, in sequenza con un solo Chrome: menus, simple, journey, first-use, chest completo, polish, npm run ui, campaign. La prova completa ha giocato Burraco, Scala 40 e Canasta, avviato Ramino, verificato torneo, offline, aggiornamenti app e traduzioni. Campagna: tre mondi, 30 situazioni, schermo 320 px. L'errore remoto non si è riprodotto; i log Actions completi richiedono autenticazione non disponibile alla CLI.

Il workflow ora espone otto passaggi distinti, con gli stessi comandi e senza saltare controlli. I due runner UI pubblicano anche lo stack dell'errore nelle annotazioni Actions, con escaping dei caratteri di protocollo: sarà possibile diagnosticare un'eventuale nuova anomalia tramite API pubblica. Nessuna modifica ulteriore alla grafica, all'economia o al server. Screenshot della .12 già verificati nel commit precedente, non rigenerati perché il client resta identico.

Il nuovo push avvia nuovamente Prove. Non considerare la correzione online fino alla verifica del successo e del client effettivamente servito.
