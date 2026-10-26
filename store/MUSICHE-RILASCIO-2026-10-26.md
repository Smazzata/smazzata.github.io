# Musiche e preparazione del rilascio — 26 ottobre 2026

Client `2026.10.26.2`, entrambe le cache offline v91. Nessuna operazione sulla Play Console.

## Modifiche

- Rimossi interfaccia, collegamenti e condivisione musicale esterna; i vecchi client ricevono un rifiuto esplicito, gli URL precedenti non vengono ripristinati né trasmessi. Rimossi riferimenti da privacy, traduzioni e materiali.
- Dodici nuove partiture: sedici battute scritte, ripresa con dinamica e pause su un giro di trentadue. Corde pizzicate, piano soffice, basso e celesta sintetizzati; nessun campione o brano esterno importato. Provenienza e limiti in `../docs/musiche-originali.md`.
- Musica disattivata inizialmente, volume personale, pausa in background e controlli separati dagli effetti conservati. I temi delle partite sono più radi rispetto alla home.
- Guide Console e tester, registro vuoto, stato del rilascio e descrizioni in quattro lingue aggiornati ai quattro giochi disponibili. Distinti pagamenti assenti e acquisti con monete gratuite già presenti.

## Esiti realmente ottenuti sul PC

| Verifica | Esito |
|---|---|
| `npm run test:rapido` | Superato |
| `npm run test:prerilascio` | 71 test superati |
| `npm run e2e` | Superato, incluso rifiuto della vecchia condivisione musicale |
| `npm run ui` | Superato: quattro giochi, tornei, offline, Store, lingue e navigazione |
| `node server/chest-uitest.js --qol` | Superato: controlli, persistenza volume, navigazione e accessibilità |
| `node server/privacy-uitest.js` | Superato: quattro pagine a 360 px, nessuna richiesta a servizi esterni, cancellazione locale e nuova sessione |
| `node server/uitest.js --campaign-story` | Superato, compresi tavolo a 320 px e risorse offline |
| `node scripts/music-preview.js` | Dodici anteprime da 60 secondi generate dal motore reale, volume 65% |
| `node scripts/music-preview.js --verify` | Dodici render da 122 secondi a volume 100%; valori finiti, nessuna saturazione; massimo picco misurato 0,284 rispetto al limite digitale 1 |
| `node server/release-ui-test.js --store` | 34 scene superate, screenshot aggiornati; 151 hash sorgente coerenti |
| Testi store | Quattro nomi entro 30 caratteri, brevi entro 80, complete entro 4000 |
| Pagine pubbliche | Privacy, cancellazione e condizioni rispondono HTTP 200 al controllo; non attesta la distribuzione del nuovo codice |

Le prove grafiche sono state eseguite in sequenza. La prima prova privacy aveva completato i controlli ma falliva nella rimozione del profilo temporaneo occupato da Chrome su Windows: aggiunta attesa di pulizia e trattamento esplicito del solo blocco temporaneo Windows; riesecuzione terminata con successo. Non sono state allentate le verifiche dell'app.

Anteprime e log locali in `test-output/`, non inclusi nei sorgenti da pubblicare. Le prove tecniche dell'audio non sostituiscono l'ascolto sul telefono e l'approvazione estetica del titolare. Nessun telefono fisico o capacità del telefono-server verificati da queste prove.

La cattura delle immagini numerate attende ora la scomparsa naturale degli avvisi temporanei: il messaggio di avatar equipaggiato copriva il titolo nella Home. Screenshot rigenerati e Home ricontrollata visivamente senza avviso.

## Ancora aperto

AAB finale verificato e installato da Play, corrispondenza chiave con Console, dichiarazioni effettive, fornitori/backup/chiavi sul server reale, account revisore, tester e adesioni reali. Nessun test chiuso svolto o giorno di partecipazione attestato. Seguire `STATO-RILASCIO-2026-10-26.md` e `PRIMA-DI-PUBBLICARE.md`.
