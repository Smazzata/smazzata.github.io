# Preparazione Play Console — 29 ottobre 2026

Aggiornamento successivo: numero verificato e Crea app disponibile; modulo compilato, tre dichiarazioni non accettate. La verifica tecnica successiva e gli aggiornamenti di sicurezza sono in [VERIFICHE-CONFORMITA-2026-10-29.md](VERIFICHE-CONFORMITA-2026-10-29.md). Le sezioni seguenti conservano il riscontro precedente.

## Verifica effettiva della Console

Accesso all’account sviluppatore riuscito. Account personale. La home richiede la verifica del numero di telefono di contatto e mantiene Crea app disabilitato. Aperta la pagina Dettagli account / Dati di contatto, con verifica tramite SMS o chiamata. Nessun codice richiesto dall’assistente, nessun numero modificato, nessun contratto accettato, nessuna app creata o file caricato. Il numero deve essere verificato dal titolare; non richiede Termux.

Il test chiuso non è avviato. Non è ancora verificata la data di creazione dell’account o l’applicabilità del requisito specifico per i nuovi account personali.

## Pacchetto corrente

AAB ufficiale 1.72, versionCode 72, release apk-72, client 2026.10.27.2. Prove, build Android e Pages del commit 7f953a87f8b26f16da3ad59ceaf6ffc1209d0da9 risultano tutti conclusi con successo.

- Package it.smazzata.app, min SDK 24, target SDK 36.
- Firma crittografica valida; 690 digest verificati; 248 file public/shared/launcher coerenti con i sorgenti.
- Certificato upload SHA256: 7866C935A935DED7000E4E2BFB327F860C27278671DB25DB0C9C726F98D7F6FE. Distinto dalla chiave APK pubblica; corrispondenza con Play Console ancora da verificare al primo caricamento.
- SHA256 AAB: c636a73f438303d7619b05884818f7951f00a4e7d9f33e608e7b1626bb7cae77.
- 34 scene grafiche passate usando gli asset estratti dall’AAB effettivo. Non equivale a installazione tramite Play.

Evidenza in VERIFICA-AAB-1.72.json. Nessuna distribuzione online verificata dal solo workflow. Il pacchetto Play-test-1.72.zip in test-output contiene AAB, testi, icona, immagine in evidenza, screenshot selezionati e documentazione pertinente; nessuna chiave privata o lista tester.

## Passi successivi

1. Il titolare verifica il numero via SMS o chiamata nella Console.
2. Creare l’app gratuita Smazzata, gioco di carte, rispettando identificativo fisso it.smazzata.app. Eventuali dichiarazioni e contratti vanno controllati dal titolare.
3. Caricare l’AAB 1.72 in bozza e verificare firma, avvisi e requisiti effettivi.
4. Completare scheda, accesso revisori, privacy, dati e questionario usando i documenti predisposti e i dati reali del servizio.
5. Avviare il canale autorizzato solo dopo prova d’installazione, verifica del backend e predisposizione dei tester.

Fonte Google: https://support.google.com/googleplay/android-developer/answer/9845334?hl=it
