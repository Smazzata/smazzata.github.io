# Preparazione del test: AAB e interruzioni

Verifiche eseguite sul PC il 26 ottobre 2026, esclusivamente con profili e archivi temporanei. Nessun caricamento Play, messaggio a utenti reali o modifica dei loro inventari.

## Pacchetto Android 1.70

- Origine: release `apk-70`, tag verificato sul commit `b09c075c695bd02a8fd9cabb21bb4cac3b492b8b`.
- File: [Smazzata.aab](https://github.com/Smazzata/smazzata.github.io/releases/download/apk-70/Smazzata.aab), 23.022.719 byte.
- SHA-256: `00677dbcca8a47047e28f2fbb29c38cd8fa76242d5edfcd42536f01d383da9aa`.
- Firma crittografica interna valida, 690 file con digest verificato; chiave pubblica del firmatario diversa da quella dell'APK del sito. Impronta upload in `VERIFICA-AAB-1.70.json`, ancora da confrontare con la Console.
- Package `it.smazzata.app`, versione `1.70`/70, minimo Android API 24, target/compile API 36; modalità `SmazzataStore` presente.
- Client `2026.10.26.2`; 248 file di public/shared/launcher confrontati con i sorgenti, normalizzando solo CRLF/LF nei testi. Nessun riferimento al precedente servizio musicale nei file testuali distribuiti.
- Permessi rilevati: Internet, vibrazione e permesso interno per receiver non esportato. Nessun permesso microfono, rubrica o posizione nel manifest controllato.
- 34 scene browser eseguite sui file estratti dall'AAB, incluso il suo motore offline. Risposte social dimostrative: non equivale a installazione nativa, login Google Play o prova del server reale.
- Controlli negativi: una copia con JavaScript alterato viene rifiutata dai digest; un AAB valido confrontato con sorgenti diversi viene rifiutato. Il verificatore non usa più una data storica come indizio di privacy aggiornata: legge la data effettiva e può confrontare i file con `--source-root`.
- Il controllo certificati ora richiede soltanto Python standard e OpenSSL; non necessita di installare `cryptography`.

La correzione dei tornei di questa revisione è nel server e non cambia gli asset del client: l'AAB 1.70 resta coerente con il client controllato. Se cambia public/shared/launcher, ripetere il confronto e produrre un nuovo AAB quando necessario.

## Interruzioni e recupero

Nuova prova `node server/chest-uitest.js --interruptions`, aggiunta al workflow Prove:

1. Due aperture di chest v4, comune e rara: il server salva davvero, la prova intercetta la conferma prima che raggiunga la logica client e chiude il socket.
2. Riconnessione e ricarica della pagina: richiesta persistente recuperata con lo stesso premio, numero di chest e saldo, senza nuova estrazione.
3. Due acquisti di avatar, comune e raro: stessa perdita di conferma, reload e recupero con lo stesso identificativo; doppio tocco di recupero senza secondo addebito e oggetto effettivamente posseduto.
4. Apertura tentata mentre il collegamento è già interrotto: nessuna richiesta accodata e inventario invariato al rientro.
5. Pesca sul server reale di prova: stato aggiornato e conferma persa, poi riconnessione/reload; mano e tallone restano quelli dell'unica pesca, comandi nuovamente disponibili.

Tutte queste verifiche sono passate. La perdita di conferma è un'iniezione controllata nel callback del trasporto; il socket viene realmente chiuso. Non è una misura delle reti mobili o del sistema operativo Android. Il saldo iniziale di prova è preparato solo nel DATA_DIR temporaneo.

## Rallentamento dei tornei e blocco di Prove

Il workflow precedente falliva nel controllo del tabellone: `bracket:false, play:false`. Il test attendeva sei secondi. L'analisi ha individuato un calcolo sincrono di intere partite fra bot, fino a 20.000 mosse per incontro: durante quel lavoro il server non poteva rispondere agli altri utenti. Prima della modifica, un avvio da quattro ha richiesto circa 1,9 secondi sul PC; il costo poteva moltiplicarsi nei tabelloni grandi.

Ora gli incontri fra due bot di pari livello vengono risolti una sola volta con scelta casuale server, registrata nel tabellone. I tavoli con almeno una persona vengono sempre aperti e giocati con il normale motore. Nessun risultato umano viene sorteggiato.

La prova grafica usa un flusso condiviso con attese sui controlli attuali del modale, senza conservare elementi sostituiti dai ridisegni. Attesa massima 15 secondi con diagnostica di richieste, stato e avvisi; il tabellone e “Vai al tavolo” restano obbligatori. Tre esecuzioni isolate consecutive superate, avvii misurati di 4/9/10 ms.

E2E esteso: quattro tornei da 16, uno per gioco; sette incontri bot risolti nel primo turno, tavolo umano non risolto automaticamente, interrogazione concorrente delle statistiche e avanzamento fino alla conclusione dopo resa a tavolino del profilo di prova. Superato; massimo misurato in questa esecuzione PC 1 ms per avvio e richiesta concorrente. Non è una misura della capacità del telefono-server.

## Altre verifiche

- `npm run test:rapido`: superato.
- `npm run test:prerilascio`: 71 test superati.
- `npm run e2e`: superato, comprese le quattro nuove verifiche sui tornei grandi.
- `npm run ui`: superato, compreso il nuovo flusso del torneo e le quattro modalità di gioco.
- Nessuna modifica all'interfaccia pubblica o alle probabilità/prezzi dell'economia. Gli screenshot store della revisione client precedente restano pertinenti.

## Ancora necessario con il titolare

Installazione/aggiornamento da Play su Android, Play App Signing e confronto del certificato upload in Console, account revisore verificato, dichiarazioni e test chiuso; email e cancellazione sul server reale, gestione dei backup/chiavi e continuità del telefono-server. Telefonate, sospensione nativa e reti mobili richiedono telefoni reali. Prove su GitHub dopo il push e distribuzione del server restano verifiche separate; nessun controllo periodico viene creato.
