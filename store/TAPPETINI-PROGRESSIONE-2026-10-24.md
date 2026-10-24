# Tappetini personali, collezione e premi — 24 ottobre 2026

Base `ebe7eea`. Implementate le migliorie autorizzate dal titolare.

## Risultato

- Tappetino visibile soltanto nel settore del proprietario, condiviso con giocatori e spettatori. Due metà in due; settori in tre/quattro; rotazione corretta per ciascun posto, centro comune e raccordi sfumati. Si condividono solo identificativi di stili equipaggiati e verificati, non l'inventario. Cambio e rimozione aggiornano il tavolo in corso per tutti. Materiali sotto le carte, senza intercettare tocchi; alto contrasto ripristina la superficie base, Avventura conserva la scenografia.
- Anteprima combinata di avatar, cornice, dorso e tappetino con comando di conferma separato. Le quattro carte dimostrative formano un poker di re con semi diversi.
- Oggetti Nuovi ricavati dalle ricevute reali, lettura persistente, filtro novità e ordinamento per acquisizione/nome/rarità. Collegamento dal premio alla Collezione.
- Profilo essenziale per account/sicurezza/statistiche; personalizzazione, titoli e colori nella Collezione.
- Tre obiettivi settimanali: 3 partite = chest comune, 2 giochi diversi = chest rara, 2 giorni = chest comune. Solo partite online umane idonee concluse; massimo tre premi aggiuntivi per settimana, reset lunedì in Italia, contatori e accrediti atomici. Stesse probabilità all'apertura.
- Campagne con codice e ricevuta per profilo, blocco degli accrediti ripetuti anche da invii distinti; bozze salvabili e riapribili, massimo 30 senza cancellazioni automatiche.
- Benvenuto automatico configurabile con anteprima/conferma, disattivato inizialmente. Solo nuovi iscritti successivi all'attivazione, una volta per profilo; recupero di accrediti falliti a profilo/riconnessione. Nessuna push esterna automatica.
- Persistenza delle nuove configurazioni sia in SQLite sia in JSON, privacy e regole aggiornate. Cache offline v73, build 2026.10.24.5, 2869 testi tradotti.

## Verifiche realmente ottenute

| Prova | Esito |
|---|---|
| `npm run test:rapido` | Passata: motori, archivio, privacy, lingue e copertura dei 23 script offline |
| `npm run test:prerilascio` | 45 prove passate, incluse le tre di risultati e i nuovi casi di progressione e tavolo personale |
| `npm run e2e` | Passata integralmente su server temporaneo |
| `npm run anim` | Passata nei quattro giochi, con ritardo simulato e controllo degli atterraggi |
| `npm run ui` | Passata: partite Burraco/Scala 40/Canasta, Ramino, tornei, moviola, impostazioni, offline e lingue; nessun errore nella pagina |
| `node server/uitest.js --polish` | Passata con il profilo essenziale e la selezione nella Collezione |
| `node server/chest-uitest.js` | Passata: anteprima senza assegnazione, conferma equipaggiamento, filtro Nuovi/lettura server, ricerca, profilo, bozze riaperte dal browser, apertura/scambio, offline, testo enorme, griglie e animazioni |
| `node server/privacy-uitest.js` | Passata; anche i test privacy dello storico e delle bozze sono passati |
| `node server/release-ui-test.js --store` | Passata: 30 acquisizioni, nove screenshot store rigenerati, casi di tappetini in due/tre/quattro e cambio posto, spettatore e alto contrasto |
| Prova multiplayer dei tappetini | Quattro profili reali nel server temporaneo, avvio e pesca di una carta; cambio/rimozione del materiale visibili a tutti; equipaggiamento non posseduto rifiutato; spettatore senza carte private e senza facoltà di giocare |
| Prova amministrativa HTTP | Bozza salvata/riletta, benvenuto configurato e confermato senza repliche, regalo accreditato al nuovo iscritto e non al precedente, riletture senza doppioni |

Le prove degli obiettivi verificano limiti, fuso italiano e cambio settimana, esclusioni, rollback e ripartenza. Le campagne verificano invii sovrapposti, regalo diverso sotto lo stesso codice rifiutato, ricevute dopo riavvio, recupero da errore e salvataggio delle configurazioni.

## Limiti

Nessun utente reale ha ricevuto comunicazioni o regali durante le prove. Il benvenuto reale non viene attivato da questa modifica: lo configura il gestore dalla pagina di stato. Le notifiche sul telefono a gioco chiuso, il blocco schermo e il comportamento su Android fisico restano da provare sul dispositivo: non era disponibile un collegamento ADB in questa sessione.

Gli screenshot store usano interfaccia/motore reali da file locali con risposte dimostrative; i test multiplayer e amministrativi usano server temporanei con dati isolati. Non attestano la distribuzione online, un AAB aggiornato o una pubblicazione Play Store. Il server pubblico si aggiorna solo dopo il passaggio di Prove; controllare il workflow del commit pubblicato.
