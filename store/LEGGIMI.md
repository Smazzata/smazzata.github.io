# Smazzata sul Play Store

Aggiornamento 29 ottobre: AAB 1.72 verificato, Prove superate. Console accessibile ma creazione app bloccata dalla verifica del numero di contatto. Stato effettivo in [PREPARAZIONE-PLAY-2026-10-29.md](PREPARAZIONE-PLAY-2026-10-29.md).

Rifiniture correnti: [collezione e premi](RIFINITURE-COLLEZIONE-2026-10-27.md).
Aggiornamento 27 ottobre: client 2026.10.27.2, traduzioni e messaggi di uscita corretti dopo il primo test Android. Per questa revisione serve il nuovo AAB generato dal push; AAB 1.70 e relativo ZIP descrivono il client precedente. Dettagli in `CORREZIONI-ANDROID-2026-10-27.md`.

Il punto attuale è [STATO-RILASCIO-2026-10-26.md](STATO-RILASCIO-2026-10-26.md); la guida Console è [PLAY-CONSOLE.md](PLAY-CONSOLE.md). La lista operativa è [PRIMA-DI-PUBBLICARE.md](PRIMA-DI-PUBBLICARE.md). Contiene anche i blocchi ancora aperti: non considerare pronta la pubblicazione soltanto perché i file esistono.

## Materiale

- `icona-512.png`: icona 512×512.
- `immagine-in-evidenza.png`: immagine 1024×500.
- `schermate-rilascio/`: selezione attuale in `SCHERMATE.md`, rigenerabile con `node server/release-ui-test.js --store`; `schermate/` conserva prove storiche da non caricare automaticamente.
- `testi.md`: nome, descrizione breve e completa in quattro lingue.
- `SICUREZZA-DEI-DATI.md`: mappa dei dati per compilare il modulo, da confrontare con fornitori e AAB effettivi.
- `../docs/privacy-operazioni.md`: cancellazioni, vecchi backup, gestione delle richieste e incidenti.
- `../docs/licenze-pubblicazione.md`: inventario delle risorse e verifiche sulle licenze.

## Pacchetto Android

AAB 1.70 verificato sul PC, client 2026.10.26.2; esiti in `PRETEST-AAB-2026-10-26.md` e `VERIFICA-AAB-1.70.json`. Non risulta installato o caricato su Play da questa verifica.

Identificativo fisso `it.smazzata.app`. `Smazzata.aab` viene creato dal workflow Android e pubblicato nelle Releases accanto a `Burraco.apk`. La compilazione corrente usa Capacitor 8 e target Android API 36; verificare in Console i requisiti al momento dell'invio.

L'AAB deve essere firmato con la chiave upload **privata**, configurata nei Secrets `PLAY_UPLOAD_KEY` e `PLAY_UPLOAD_KEY_PASSWORD`, con Play App Signing. La chiave `android-app/burraco.p12` è pubblica e serve solo all'APK distribuito dal sito: non usarla per Google Play. Conservare separatamente una copia protetta della chiave privata; non inserirla nel repository.

La versione store usa `SmazzataStore` e non mostra inviti a scaricare aggiornamenti APK esterni; contiene anche il gioco offline. Chi installa dallo store riceve gli aggiornamenti tramite Google Play.

## URL pubblici da inserire

- Privacy: https://smazzata.github.io/gioca/privacy.html
- Cancellazione: https://smazzata.github.io/gioca/elimina-profilo.html
- Condizioni e regole: https://smazzata.github.io/gioca/regole.html
- Assistenza: smazzata.play@gmail.com
- Richieste privacy: muliellostudio@gmail.com

La nuova documentazione riguarda la versione gratuita senza annunci e pagamenti in denaro. Sono presenti monete gratuite e acquisti di cosmetici con queste monete. Aggiungerli richiederà prima una nuova valutazione tecnica e delle dichiarazioni: non basta riutilizzare il modulo attuale.
