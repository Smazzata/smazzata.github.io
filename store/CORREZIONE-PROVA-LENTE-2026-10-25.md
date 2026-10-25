# Attesa del turno nella prova della lente

Il workflow Prove `40210720874` del commit `67dd8e0` ha interrotto la fase «Lente, tavolo e anteprime» con «Turno non disponibile». I passaggi precedenti erano passati; APK e Pages erano riusciti. Questo non certificava il rilascio sul server del telefono.

La preparazione della prova aspettava al massimo dieci secondi su un tavolo a quattro con primo turno casuale: non bastava sempre ad arrivare al giocatore umano. Il test ora porta la pagina in primo piano prima della preparazione, crea un tavolo a due, usa l'impostazione reale di velocità del computer e aspetta il turno umano effettivo in fase di pesca, con limite di trenta secondi. In caso di fallimento riporta schermata, fase, posti e turno, senza informazioni personali. Il primo turno osservato viene registrato per distinguere le due condizioni iniziali.

Nessuna modifica al gioco pubblicato, ai turni o ai premi. Il test non assegna il turno al giocatore e non arresta i computer; conserva tutte le prove con mouse e touch nativi, trascinamento, selezione e annullamento. Non serve cambiare versione client, cache o screenshot del prodotto.

Verifiche sul PC: sette esecuzioni consecutive di `node server/chest-uitest.js --comfort` superate con nuove partite e profili temporanei; `npm run test:prerilascio`, 72 controlli superati. L'esito definitivo su GitHub richiede la nuova esecuzione di Prove dopo il push.
