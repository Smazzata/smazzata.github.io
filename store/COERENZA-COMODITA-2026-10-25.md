# Coerenza e comodità prima del rilascio

Base `56f1fab`; client `2026.10.25.8`, cache principale e launcher `v88`.

## Sei interventi

1. Dorsi e tappetini si gestiscono in Collezione. Le impostazioni del profilo online hanno due collegamenti alle categorie, senza ripetere i selettori di colore. «Stile di base» comprende i colori e i dorsi storici già sbloccati; scegliere un base rimuove prima l'oggetto equipaggiato con conferma del server. Un rifiuto non cambia la preferenza. Per ospiti e uso offline restano i controlli locali nelle impostazioni.
2. Fine partita: «Premio giornaliero ottenuto» sostituisce l'invito a riprendere domani. Barra giornaliera completa quando il premio è consegnato, prossimo traguardo mensile e obiettivo settimanale ancora visibili. Premi e probabilità invariati.
3. Numero delle chest da aprire su Collezione nella Home. Stato privato del profilo, aggiornato dal server all'accesso e dagli inventari confermati dopo aperture/equipaggiamenti; nessun conteggio condiviso tra profili.
4. Bottino: riquadri più compatti, immagini da 94 px, meno spazi e nessun «Tocca per aprire» ripetuto sotto ogni chest. Restano pulsanti reali, quantità e nomi, con aree di tocco ampie.
5. Focus comune alle finestre: sfondo inattivo, Tab/Shift Tab contenuti nella finestra, ritorno al comando precedente anche dopo caricamento asincrono, conservazione del controllo durante aggiornamenti. Lo stato dell'input non viene persistito dal gestore del focus.
6. Storico, Chat e Menu hanno etichette brevi visibili sul tavolo. Ingombro e aree di tocco verificati a 320 px e altezza ridotta. Un avviso precedente viene trasferito nello spazio della partita, senza coprire i comandi.

Nuove traduzioni EN/ES/PT. Nessuna operazione in Play Console, nessun messaggio a giocatori reali e nessuna prova di carico sul telefono.

## Verifiche

Nuova prova `chest-uitest --coherence` inclusa in Prove: stile equipaggiato e reset confermati dal server, rifiuto senza modifiche, conteggio dopo apertura, geometria del Bottino, Tab/Shift Tab nativi, ritorno/conservazione del focus, sfondo inattivo, nomi dei comandi e Indietro a due livelli nelle impostazioni. 320/375/768 px e testo molto grande.

Prove riuscite: `--qol`, `--menus`, `--comfort`, `--simple`, `--first-use --small`, `--journey`, `npm run anim`, `npm run test:rapido`, `npm run ui` e `npm run e2e`. Un tentativo di test:prerilascio ha incontrato la porta 3994 occupata dalla prova delle animazioni eseguita in parallelo; ripetuto senza conflitto: 73 controlli riusciti.

La prova su due connessioni dello stesso profilo verifica un'apertura dal secondo dispositivo e l'aggiornamento del badge nella Home del primo. Ha permesso di correggere il conteggio iniziale (solo chest senza premio già assegnato, non lo storico) e la rilettura silenziosa nella Home su inventoryChanged. Confermati anche entrambi i reset di stile base, dorso e tappetino, sul server temporaneo.

Ripetute sulle fonti finali le prove di coerenza, comodità e menu; ricontrollato il riepilogo anche con una sola partita mancante. Verifica grafica store: 34 scene e rigenerazione degli screenshot, con hash delle fonti conservati in VERIFICA.json. Controllati visivamente Bottino compatto, scelte base e comandi a 320 px.

Le prove Android sul PC coprono Indietro e viewport ridotto; non attestano blocco schermo, tastiera del dispositivo, cambio Wi-Fi/dati o consumo batteria su Android fisico. Queste verifiche restano da fare sul telefono.
