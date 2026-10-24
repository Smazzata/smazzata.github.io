# Inventario semplice, volume e partite complete — 24 ottobre 2026

Base `da5fa27`. Richieste: simulare centinaia di partite, verificare i problemi emersi, aggiungere il volume musica e semplificare inventario/bottino senza informazioni percentuali.

## Modifiche

- Bottino con sole chest disponibili e un pulsante Apri. Rimossi collegamenti duplicati al profilo e ai cataloghi, percentuali, tabelle e contatori delle garanzie. Come ottenere altre chest, Usa frammenti e Ultime aperture sono sezioni chiuse. Nessuna variazione alle probabilità del server.
- Collezione con sei categorie tutte visibili sul telefono, senza scorrimento orizzontale. Solo posseduti/Mostra tutti rimangono subito accessibili; ricerca, rarità, novità e ordinamento sono raccolti sotto Cerca e filtra. I comandi secondari del singolo oggetto sono sotto Altre opzioni. Due azioni nella rivelazione: usare il premio o continuare; l'equipaggiamento riporta al bottino invece di aprire il profilo account.
- Prima chest spiegata in due brevi frasi: un oggetto per personalizzare il gioco, doppioni trasformati in frammenti. Eliminata la spiegazione tecnica del salvataggio e delle estrazioni. Corretto il testo delle regole che prometteva tabelle prima dell'apertura.
- Volume musica 0–100, cursore accessibile personalizzato, valore salvato sul dispositivo. Volume iniziale 50 conserva il livello sonoro precedente. Cambia con una breve rampa senza riavviare il tema; impostare zero non cambia la scelta degli effetti e modificare il volume non avvia musica disattivata.

## Bug concreto trovato e corretto

Nella serie riproducibile con seme 242026, partita numero 22 (Scala 40, seme del mazzo 2563253920), due computer rimasti con soli jolly raccoglievano un altro jolly e scartavano quello precedente. Il tallone non veniva consumato e la partita non avanzava; dopo oltre 12.000 azioni nello stesso caso il processo di prova è stato fermato e lo stato preservato.

Il computer ora pesca dal tallone quando ha soltanto jolly e lo scarto è un jolly. La modifica è alla scelta del bot Scala 40, usato anche da Ramino; nessuna regola o mossa umana è stata limitata. La fixture ricavata dallo stato reale conserva carte e situazione di gioco, con storico diagnostico rimosso e conoscenze duplicate compattate. Il test di regressione verifica la pesca e il termine della smazzata, raggiunto in 529 azioni anziché proseguire il ciclo.

## Risultati

Due serie concluse da 320 partite: **640 partite complete, 4.202 smazzate, 292.401 mosse e 1.814 ripristini durante la partita**. Ogni serie comprende 80 partite per Burraco, Scala 40, Ramino e Canasta, con dimensioni dei tavoli e livelli dei computer variati. Si controllano conservazione e unicità delle 108 carte, mani private, vista spettatore, punteggi finiti, vincitore e conclusione entro il limite di sicurezza.

La prima serie, prima della correzione, usa mazzi a seme e scelte casuali dei bot: 320 partite, 2.052 smazzate, 143.142 mosse, 883 ripristini, 438 secondi. Non ha incontrato il caso problematico.

La seconda serie, ripetuta dopo la correzione con casualità interamente riproducibile, termina con 320 partite, 2.150 smazzate, 149.259 mosse, 931 ripristini, zero fallimenti, 437 secondi. I dati aggregati sono in `VERIFICA-PARTITE-2026-10-24.json`. Il workflow Prove ora esegue 40 partite complete oltre ai quattro test di stress già permanenti.

A queste due serie si aggiunge la prova del comando usato in CI: altre 40 partite complete, 247 smazzate e 17.883 mosse, tutte superate. Totale delle tre serie: **680 partite, 4.449 smazzate, 310.284 mosse e 1.927 ripristini**.

Ulteriori verifiche superate: test rapido, 52 test prerelease (inclusi volume e ciclo jolly), quattro scenari stress con 40.000 estrazioni, multigiocatore end-to-end, animazioni e atterraggi delle carte, prova UI delle chest su sei combinazioni dimensione/tema, testo enorme, equipaggiamento, retry e offline. Screenshot store rigenerati; 32 scene locali con hash dei sorgenti in `schermate-rilascio/VERIFICA.json`. Le prove grafiche non sono state eseguite contemporaneamente.

## Distribuzione e limiti

Il workflow [Prove di da5fa27](https://github.com/Smazzata/smazzata.github.io/actions/runs/40110355764) è passato, comprese animazioni e UI. Non sono state indebolite tolleranze o aggiunti retry al controllo delle animazioni; il precedente fallimento non è stato riprodotto e la causa precisa rimane ignota. La diagnostica aggiunta rimane attiva per eventuali ricorrenze.

La correzione del bot e l'interfaccia di questa revisione richiedono una nuova esecuzione Prove; il suo avvio non certifica l'aggiornamento online. Su Android fisico rimangono da provare Indietro/gesti, chiamate, schermo bloccato e cambio rete. Il codice nativo è stato compilato dal workflow APK precedente; le simulazioni sul PC non sostituiscono un collaudo del telefono. Nessuna pubblicazione su Play Console, nessuna comunicazione o modifica a profili reali.
