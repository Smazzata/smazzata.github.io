# Progressi essenziali — 25 ottobre 2026

Richiesta: rendere giornalieri, settimanali e mensili intuitivi, senza pagine lunghe né spiegazioni estese. Base `df6182e`; client `2026.10.25.6`, entrambe le cache `v86`.

- Tre schede: Oggi, Settimana e Mese. Un solo periodo visibile, ingresso sempre su Oggi.
- Premio illustrato, obiettivo breve, contatore e barra. I premi già consegnati mostrano la spunta e «Nel bottino». Il giornaliero non indica una rarità garantita.
- Weekend visibile soltanto quando attivo. Rinnovo espresso con una breve etichetta.
- Mese: prossimo premio in evidenza e dieci premi consultabili in due righe. Nessuna lista verticale di dieci schede. Il contatore mostra le partite complessive del mese rispetto alla soglia del premio selezionato.
- Ricordi separati, tre per pagina. Indietro Android torna al periodo precedente.
- Bottino: un solo riepilogo con collegamento ai progressi; eliminate spiegazioni duplicate e obiettivi settimanali annidati sotto Altro.
- Traduzioni EN/ES/PT. Proprietà, premi, scadenze e probabilità rimangono gestiti dal server senza modifiche.

## Verifiche locali

- `npm run test:rapido`: superato.
- `npm run test:prerilascio`: 72 verifiche superate.
- `node server/chest-uitest.js --journey`: superato; tre periodi, tutti i premi mensili, pagine dei ricordi, Indietro, aggiornamento senza perdere scheda/pagina, riapertura su Oggi, copia offline, completamento e assenza di mutazioni dei premi. 320/375/768 px, due temi, testo molto grande, inglese/spagnolo/portoghese.
- A 320×812 con testo normale, tutte le viste dei progressi entrano senza scorrimento. Test automatico sulla geometria e controllo visivo delle schermate; con testo molto grande o schermi più bassi lo scorrimento resta disponibile.
- `--simple`, `--qol` e `--first-use --small`: superati; apertura diretta delle chest, doppio tocco, tastiera, offline/recupero, equipaggiamento confermato e percorso iniziale di nove tocchi.
- `node server/release-ui-test.js --store`: 34 scene superate; screenshot rigenerati e hash delle 151 fonti finali verificati.
- Test Android Indietro ripetuto dopo il nuovo percorso dei ricordi: superato.

## Controllo della pubblicazione precedente

Prove del commit precedente `df6182e` è fallito nel test della lente: il clic nativo simulato non avviava la pressione sulla carta. Il test usava un'attesa fissa e il centro del rettangolo della carta. Ora aspetta la rimozione effettiva dell'intro, il caricamento dei font e controlla con elementFromPoint che il punto da premere raggiunga davvero la carta. Non sono sostituiti i gesti nativi con chiamate agli handler. `chest-uitest --comfort` ripetuto sul PC: superato. Il riscontro su GitHub resta da ottenere con il nuovo push.

Prove eseguite sul PC con Chrome, non su Android fisico. Nessuna operazione su profili reali o sul server del telefono. La pubblicazione online richiede Prove completato e successivo aggiornamento del server.
