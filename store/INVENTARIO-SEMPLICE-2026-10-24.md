# Collezione e Bottino al tocco — 24 ottobre 2026

## Modifiche

- Due schede principali: Collezione e Bottino. La posta resta accessibile dall’icona con il numero di messaggi in alto.
- Chest grandi, colorate per tipo e con quantità visibile. Toccare una chest ne apre un esemplare direttamente, anche alla prima apertura. Eliminati selezione preliminare, pulsante Apri separato e prima conferma introduttiva.
- Collezione con sei categorie e Solo posseduti/Mostra tutti. Rimossi ricerca, ordinamenti e filtri di rarità. Oggetti in uso prima degli altri, poi acquisizioni recenti. Anteprima e pulsante di equipaggiamento conservati, oggetti non posseduti bloccati.
- Carte arrotondate e più grandi, titoli leggibili, meno contatori e nessun riepilogo nel piè di pagina. Su telefono la scheda dell’oggetto nasconde anche le categorie per dare spazio al premio.
- Nel Bottino rimangono chest, prossimo premio e collegamento al percorso. Obiettivi, frammenti e storico raccolti sotto Altro, inizialmente chiuso.
- Restano blocco dei doppi tocchi, richieste persistenti, recupero di risultati senza nuovi consumi, isolamento dei profili, modalità offline e accessibilità con tastiera. Nessuna modifica al server, ai premi o alle probabilità.

Riferimento per l’interazione diretta: [apertura al tocco delle chest di Clash Royale](https://support.supercell.com/clash-royale/en/articles/lucky-chests-6.html). Immagini e stile sono quelli originali di Smazzata; nessun asset di Supercell aggiunto.

## Verifiche effettivamente ottenute

- test:rapido: superato.
- e2e multigiocatore: superato.
- test:prerilascio: 63 test superati.
- Nuova prova --simple: due schede, assenza di controlli avanzati, chest raggruppate e contatori corretti, 320/375/768 pixel, testo normale/enorme, doppio tocco senza doppio consumo, apertura con Invio, offline e recupero.
- Primo uso --first-use --small: superato a 320 pixel, nove tocchi visibili per Collezione, equipaggiamento, apertura diretta, uso del premio e avvio partita; verificati anche secondo dispositivo e ripristino della connessione.
- Prova completa inventario: superata; controllati entrambi i temi, testo enorme, animazioni, oggetti bloccati, equipaggiamento, assenza di percentuali, recupero e ultima riga raggiungibile.
- Percorso --journey: superato, comprese tappe, album e gruppo abituale.
- Interfaccia --polish: superata.
- Screenshot store: 32 scene verificate e immagini interessate rigenerate; sorgenti identificate in schermate-rilascio/VERIFICA.json.

Versione client 2026.10.24.10, cache offline v78, traduzioni EN/ES/PT aggiornate (2.956 testi complessivi). Le prove usano browser automatici e profili temporanei; non sono test con utenti reali o su telefono fisico. Disponibilità online subordinata a Prove superato e aggiornamento del server.
