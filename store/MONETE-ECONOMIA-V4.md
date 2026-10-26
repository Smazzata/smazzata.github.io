# Economia a monete — versione 4

Base `f9a0eff`. Implementazione autorizzata della variante «duratura» simulata, con rimozione dei frammenti senza conversione come richiesto dal titolare. Client `2026.10.25.9`, entrambe le cache `v89`.

## Modifiche attive

- Nuove chest: una ricompensa, monete oppure oggetto. Tabelle assolute 70/20/7/2,5/0,5 nella comune; 45/10/35,5/8/1,5 nella rara; 20/0/15/62/3 nell'epica; oggetto leggendario garantito nella leggendaria. Ordine: monete/comune/raro/epico/leggendario. Quantità di monete: 30/80/200. Tipi di chest 75/20/4/1 invariati.
- Garanzie globali 20/50 conservate contando anche le aperture a monete; alla scadenza esce un oggetto. Gli acquisti non avanzano né azzerano i contatori.
- Oggetto preciso dalla Collezione: prezzi 600/1800/6000/18000; doppioni 30/90/300/900 monete. Conferma esplicita, prezzo e possesso verificati dal server, ricevuta persistente, nessun doppio addebito dopo retry. Nessun equipaggiamento automatico.
- Cinque monete per ciascuna delle prime tre partite valide al giorno. Giornaliero di una chest dopo due partite invariato. Settimana 100/150/100 monete per partite/giochi/giorni, chest rara per tre partite con amici. Mese: sei premi monetari per 750 monete totali e quattro chest. Weekend e ricordi invariati.
- Portafoglio sempre visibile in Collezione/Bottino; progressi con icone monetarie e quantità. Nessuna percentuale esposta nel gioco. Anteprima, acquisto e conferma recuperabili anche dopo perdita della risposta. Stato offline impedisce spese.
- Campo, API di scambio e comandi dei frammenti rimossi. Vecchi dati ripuliti in migrazione, nessuna conversione. Oggetti posseduti e chest già guadagnate conservati: le chest di versione 1/2/3 continuano a dare un oggetto. Nessun secondo credito su tappe già completate; la vista conserva il premio storico delle tappe precedenti.
- Privacy, regole, pagina degli invii amministrativi e traduzioni aggiornate al comportamento effettivo. I resoconti datati e le simulazioni precedenti restano storici.

Saldi, proprietà e ricevute vengono salvati nella stessa transazione con rollback in errore. Importi controllati come interi sicuri; costo, rarità e saldo inviati dal client non sono autoritativi. Nessuna ricompensa da allenamento, bot, offline, resa o abbandono.

## Verifiche sul PC

- `test:prerilascio`: 71 verifiche, incluse migrazione senza conversione, rollback, acquisti concorrenti/idempotenti, prezzi falsificati, overflow e confronto del codice reale con i calendari simulati a 30/90/180 giorni.
- `test:stress`: quattro scenari riusciti, 1.800 eventi di fine partita, 909 aperture, 285 rollback ed errori simulati, 159 acquisti; verifica esaustiva di 40.000 esiti delle quattro chest; 96 smazzate del motore con ripristini.
- 120 profili, due connessioni ciascuno, 14 giorni: 3.360 completamenti simulati, 360 aperture uniche, acquisti concorrenti, rientri e riavvio su archivio temporaneo. I completamenti non sono partite intere del motore.
- Browser `--economy`: conferma, annullamento, doppio tocco, perdita della conferma con recupero allo stesso costo, saldo, monete, leggendaria, sei tappe monetarie, offline; 320/375/768 px.
- Browser `--qol`, `--menus`, `--journey`, `--first-use --small`, `--comfort`, `--simple`, `--rewards` e inventario completo riusciti. Il primo tentativo di inventario completo ha segnalato il controllo del volume: diagnostica ampliata e ripetizione completa riuscita.
- `test:rapido`, `e2e` e `npm run ui` riusciti, comprese partite dall'interfaccia, torneo, offline e lingue.
- Simulatore storico nuovamente riprodotto: i 162 scenari e le 162.000 traiettorie coincidono. Calendari congelati al commit precedente, separati dai moduli correnti; nuova prova dedicata verifica l'economia attiva.

Prove esclusivamente sul PC e su archivi temporanei. Capacità del telefono, Android fisico e distribuzione online non sono certificati da questi risultati. Il workflow Prove dopo il push resta necessario per l'aggiornamento del server.

## Passaggi successivi, non implementati qui

Gli acquisti in euro restano assenti. Le ipotesi discusse sono monete acquistabili, pacchetti estetici completi, rimozione degli annunci, benvenuto e successivamente pass/eventi: richiedono Play Billing con verifica server, recupero, rimborsi e aggiornamento delle dichiarazioni. Non sono stati creati prodotti o pubblicati contenuti in Play Console.

Per limitare gli APK alterati: Play Integrity verificata dal server prima di concedere una sessione multiplayer, con richieste fresche legate alla sessione e controlli di app/licenza. Il sito e l'APK esterno devono avere una politica d'accesso coerente; un controllo del solo User-Agent o un segreto dentro l'APK non basta. La firma dell'APK pubblico non sostituisce la firma privata di Play. Non è stato attivato un blocco multiplayer in questa modifica.
