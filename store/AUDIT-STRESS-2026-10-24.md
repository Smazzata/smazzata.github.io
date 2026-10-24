# Audit esteso e scenari riproducibili — 24 ottobre 2026

Base verificata: `aa3ff404ddb04521434b1da6c9bf9b5a30b6bb18`. Tutte le prove usano dati fittizi e server temporanei; nessun invio, regalo o modifica a profili reali.

## Nuovi controlli permanenti

`npm run test:stress`, aggiunto anche al workflow Prove:

- 1.800 partite distribuite fra dodici profili e quattro giochi, attraverso circa 46 giorni, inclusi mezzanotte, settimane e passaggio all'ora solare. Esclusione di allenamento/resa, amicizie reciproche, premi ordinari e settimanali, retry della stessa partita e ripristini JSON.
- 1.159 aperture e 98 scambi; 348 salvataggi deliberatamente falliti, con verifica integrale del rollback, dei frammenti e del possesso. Nessun doppio accredito, ID ripetuto o superamento dei limiti.
- 40.000 estrazioni base: ogni possibile valore del generatore a 10.000 passi per ciascuno dei quattro tipi. Percentuali esatte 66,5/25/8/0,5; 20/61,5/17/1,5; 0/20/77/3; 0/0/0/100. Qui le garanzie sono azzerate per verificare la tabella base; le garanzie globali vengono verificate separatamente dai test chest esistenti, comprese 10.000 aperture consecutive.
- 96 smazzate dei quattro giochi di lancio: 7.500 mosse, 438 ripristini a metà gioco, mosse illegali respinte senza mutare lo stato, 108 carte conservate e nessun ID duplicato. Controllo delle mani private e della vista spettatore. Seme riproducibile 39871.
- Confini espliciti di mezzanotte, cambio ora legale/solare e lunedì Europe/Rome.

Esito: quattro prove superate, circa 37 secondi sul PC utilizzato. Le 1.800 partite dell'inventario sono eventi di conclusione simulati, non 1.800 partite giocate dal motore.

## Altre verifiche eseguite

| Controllo | Esito reale |
|---|---|
| `npm test` completo | Superato: preset da 2/3/4 giocatori, configurazioni casuali, replay, archivio, privacy, giochi disponibili e motori conservati |
| `npm run playtest -- 12 classico,reale,aberto,fechado` | 72 partite complete, sei combinazioni di preset/dimensione, 290 secondi |
| `npm run test:prerilascio` | 50 prove superate |
| `npm run test:ranked` | 35 prove superate |
| `npm run sim:ranked` | 150.000 incontri sintetici fra 600 profili; superato |
| `npm run e2e:ranked` | Superato: Duo, consensi, accessi negati, promozioni, crash/riavvio, replay e abbandono |
| `npm run test:campagna` | 150 livelli, 1.342 mosse; superato |
| `npm run anim` | Superato localmente |
| `ANIM_CPU_RATE=4 npm run anim` | Superato: sequenza completa con CPU rallentata, oltre alle prove di atterraggio già rallentate |
| `node server/privacy-uitest.js` | Superato |
| `node server/chest-uitest.js` | Superato: inventario, posta, guida, musica, navigazione, recupero, scambi, offline e accessibilità |
| `node server/uitest.js --polish` | Superato |
| `node server/uitest.js --campaign` | Superato: tre mondi, boss, 30 situazioni UI, 320 px, riduzione movimento, timer, pausa, vite e ripresa dopo reload |

La simulazione delle classificate usa esiti Bradley–Terry, non il motore delle carte e non una popolazione reale. I risultati non calibrano da soli la difficoltà o il matchmaking al lancio.

## Carico locale

24 tavoli, 48 client e 48 computer per 45 secondi: 668 mosse, zero rifiuti. Mediana 0,9 ms, percentile 95 a 10,6 ms, massimo 24 ms. Ritardo del server al percentile 99: massimo 40,7 ms; CPU massima 17%; memoria finale 210 MB.

Misure del PC locale, raccolte durante altre simulazioni: non sono una stima delle prestazioni del telefono-server, della rete mobile o del tunnel.

## Blocco della distribuzione rilevato

Il workflow APK di `aa3ff40` ha compilato correttamente la parte nativa Android; Pages è passato. Il workflow [Prove 40109347175](https://github.com/Smazzata/smazzata.github.io/actions/runs/40109347175) è invece fallito nel controllo delle animazioni, dopo aver superato motori, multigiocatore, prerelease, Ranked e Avventura. Il controllo UI successivo è stato saltato e non va considerato passato su quel runner.

L'API dei log completi restituisce HTTP 403; le annotazioni disponibili non riportano la causa precisa. Il problema non è stato riprodotto localmente, neppure con CPU rallentata. Non si attribuisce quindi il fallimento a un bug grafico o a un falso positivo senza evidenze.

`animtest.js` ora salva l'errore in JSON fra gli artefatti ed emette un'annotazione GitHub pubblica con il messaggio completo. È disponibile `ANIM_CPU_RATE` da 1 a 12 per riprodurre dispositivi più lenti. Non sono state allargate tolleranze, rimossi assert o aggiunti retry per far passare il controllo. La nuova esecuzione deve ancora essere valutata.

Nessun bug di produzione è stato riprodotto da questa batteria. Questo non certifica l'assenza di errori: rimangono da verificare su dispositivi reali Indietro/gesti Android, chiamate o audio concorrente, schermo bloccato, lunga permanenza in background e cambio Wi-Fi/dati mobili. Il server non va dichiarato aggiornato finché Prove non passa e non viene verificata la versione servita.
