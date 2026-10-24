# Pubblicazione delle modifiche delle sessioni precedenti — 24 ottobre 2026

Base: `7ec4bfb`, coincidente con `origin/main` al controllo prima del commit. Il titolare ha autorizzato a raccogliere e pubblicare anche il lavoro delle altre sessioni.

## Modifiche raccolte

- Protezione da tocchi ripetuti, richieste scollegate, conferme tardive e timeout; riconnessione con sincronizzazione prima di nuove mosse, senza ripetizione automatica.
- Allenamento e tutorial locali accessibili senza registrazione; creazione del profilo online raccolta in una sezione dedicata.
- Attesa matchmaking con timer, annullamento e passaggio al computer; aiuto contestuale e ritorno alla home dai risultati.
- Segnalazioni con bozza locale e contesto limitato (versione, tavolo, fase, connessione); nuovi premi effettivamente sbloccati nel riepilogo.
- Solo avatar posseduti nel profilo, quattro iniziali e conservazione degli sblocchi espliciti e delle scelte pregresse. Titoli non sbloccati nascosti. Proposta chest documentata, non attiva.
- Traduzioni, entrambe le cache offline, prove automatiche e screenshot store aggiornati. I nove test mirati sono inclusi nel workflow Prove.

## Controlli eseguiti prima del commit

- `npm run test:prerilascio`: nove prove passate (trasporto, doppio tocco, progressi e possesso avatar).
- `npm run test:rapido`: passato, comprese simulazioni, archivio, lingue e copertura delle cache offline.
- `npm run e2e`: passato integralmente sul server temporaneo.
- `node server/uitest.js --polish`: passato, compresi profilo a 320/375/768 px e controllo del possesso tramite API.
- `node server/release-ui-test.js --store`: passato, 24 acquisizioni; nove PNG store rigenerati e corrispondenza dei 78 hash sorgenti verificata. Screenshot della collezione ispezionato.
- `npm run ui`: passato integralmente (giochi, moviola, impostazioni, tornei, offline, aggiornamenti e lingue).
- `node server/uitest.js --campaign`: passato, tre mondi da 50 livelli, 30 situazioni UI, personaggi, boss, offline, movimento ridotto e tavolo a 320 px.
- Sintassi dei JavaScript modificati, 2642 testi tradotti e `git diff --check`: passati.
- Diff e file non tracciati controllati: sorgenti, documentazione, traduzioni e prove intenzionali; nessuna credenziale riconosciuta, chiave privata, database, backup o file temporaneo aggiunto. Nessun file ignorato forzato nella pubblicazione. Dati degli screenshot dimostrativi.

## Limiti

Le verifiche in browser non sostituiscono Android fisico, cambi di rete reali e background prolungato. L'aggiornamento del server pubblico dipende dal workflow Prove del commit pubblicato; gli esiti locali non attestano la distribuzione online. Nessuna pubblicazione Play Console, contratto, comunicazione a terzi o cancellazione di backup/rami remoti.
