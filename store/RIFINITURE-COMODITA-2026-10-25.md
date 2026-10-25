# Rifiniture estetiche e comodità — 25 ottobre 2026

Richiesta autorizzata: tutte le otto proposte estetiche e di qualità d'uso. Nessuna nuova valuta, pubblicità o modifica alle regole e alle ricompense.

1. Finestre: spaziature e titoli comuni, chiusura da 44 px e collegamento accessibile tra finestra e titolo (anche nelle anteprime della Collezione). Cambio di sezione dall'inizio; aggiornamenti nella stessa sezione conservano la posizione.
2. Carte: indici principali leggibili anche nelle mani piccole, selezione con bordo e segno di spunta, stato aria-pressed, attivazione da tastiera e focus conservato. Mossa rifiutata: carte ripristinate, selezione conservata e richiamo visivo temporaneo.
3. Collezione: memoria dello scorrimento per categoria, possesso e singola anteprima; torna all'oggetto senza risalire ogni volta. Memoria solo in sessione, azzerata al cambio profilo.
4. Anteprima sul tavolo subito visibile nell'oggetto. Mostra la scelta insieme ad avatar, cornice, dorso e tappetino già equipaggiati; reazioni/vittorie hanno anche il campione dell'oggetto. Nessun cambio prima della conferma; dopo il salvataggio resta visibile l'anteprima con stato Equipaggiato. Non è un editor con acquisto o salvataggio simultaneo di più oggetti.
5. Conferme uniformi (3 secondi; equipaggiamento 3,6), errori più leggibili (6,5 secondi). Durante il gioco, avviso in una riga propria, richiudibile, sopra i punteggi: non copre carte o comandi e sopravvive ai render. Nelle finestre, conferma contenuta in larghezza per lasciare visibile la chiusura.
6. Pulsanti asincroni con stato di attesa e protezione dai doppi tocchi, ripristinati alla risposta. Invio mosse lento indicato nella barra del tavolo dopo 700 ms senza spostare carte o ripetere richieste. Ricerca Ranked con indicatore, spiegazione breve e annullamento; riconnessione con spiegazione della ripresa.
7. Transizioni brevi e coerenti; riduzione del movimento rispettata anche da indicatori e nuovi controlli. Carte in volo sotto le finestre aperte, senza cambiare traiettorie o tempistiche del gioco.
8. Menu partita: tre controlli rapidi per musica, effetti e leggibilità, con stato corrente. Stesse preferenze persistenti; Indietro dalla leggibilità torna al menu della partita. Disponibili anche nel percorso Avventura.

Client 2026.10.25.4; entrambe le cache v84. Traduzioni en/es/pt rigenerate: 2.997 testi.

Verifiche locali superate: 70 test:prerilascio; test:rapido; e2e multigiocatore; interfaccia completa con partite Burraco, Scala 40, Canasta, avvio Ramino, moviola, torneo, offline e lingue; chest-uitest --simple, --first-use --small (9 tocchi visibili), --rewards e completo; uitest --polish. Test aggiunti per invio lento senza ripetizione e rifiuto con selezione conservata. Prova --qol dedicata a memoria, anteprima con equipaggiamento reale su account temporaneo, controlli rapidi, Indietro, tastiera, avvisi senza sovrapposizione, doppio tocco e movimento ridotto; 320/375 px, due temi e testo enorme. La prova è inclusa nel workflow Prove.

Nessun invio a persone reali o test su Android fisico. La prova del browser non sostituisce quella del dispositivo.

Superati anche menus-ui-flow completo e prova delle animazioni dopo la correzione dei livelli di sovrapposizione. Screenshot di rilascio rigenerati: 34 scene, 151 fonti allineate. Tutti i browser grafici sono stati eseguiti in sequenza su Windows.
