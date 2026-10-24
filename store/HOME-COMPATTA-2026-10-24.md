# Home compatta — 24 ottobre 2026

Correzione della sovrapposizione segnalata nello screenshot del telefono. La navigazione non è più un elemento fixed dentro un pannello con backdrop-filter: il contenitore Home occupa il viewport dinamico, il contenuto centrale scorre e il footer resta in una riga separata, con altezza reale e spazio per l'area sicura del telefono.

Modalità, profilo e intestazione più compatti. Il footer contiene anche la barra verso la prossima chest (0–3 partite), ricavata da nextChest del server. Al limite giornaliero mostra barra piena e messaggio esplicito. Nessuna modifica all'economia o alle probabilità. Testi già tradotti riutilizzati. Client 2026.10.24.12, entrambe le cache v80.

Verifiche locali superate:
- test:rapido.
- chest-uitest --menus: nuove verifiche geometriche con ripresa partita a 320×568, 375×812, 360×740 e 812×375, testo normale/enorme; nessuna sovrapposizione, Allenamento raggiungibile, footer dentro il viewport, progressione 2/3 e limite giornaliero. Conservate prove dei menu, preferenze, offline e Indietro.
- uitest --polish: home e finestre secondarie, tastiera, tema scuro e profilo.
- Controllo visivo dei fotogrammi 375×812 e 320×568.

Le prove usano browser e profili temporanei; non equivalgono a una prova su dispositivo Android fisico. La distribuzione online dipende dalle Prove GitHub e dal successivo aggiornamento del server.

Screenshot di rilascio rigenerati con release-ui-test --store: 32 scene, verifica completata.
