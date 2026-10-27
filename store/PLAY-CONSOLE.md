# Preparazione della Play Console

Rifiniture correnti: [collezione e premi](RIFINITURE-COLLEZIONE-2026-10-27.md).
Aggiornamento 27 ottobre: client 2026.10.27.2, traduzioni e messaggi di uscita corretti dopo il primo test Android. Per questa revisione serve il nuovo AAB generato dal push; AAB 1.70 e relativo ZIP descrivono il client precedente. Dettagli in `CORREZIONI-ANDROID-2026-10-27.md`.

Aggiornato al 26 ottobre 2026. Guida da confrontare con le schermate effettive della Console: nessuna dichiarazione inviata, nessun contratto accettato o caricamento eseguito da questa preparazione.

## Dati dell'app

| Campo | Materiale da usare |
|---|---|
| Identificativo | `it.smazzata.app`, non cambiarlo |
| Nome e descrizioni | `testi.md`, quattro lingue; solo Burraco, Scala 40, Ramino e Canasta |
| Tipo | Gioco, gratuito |
| Categoria proposta | Carte, da confermare in Console |
| Annunci | No: questa versione non integra pubblicità |
| Acquisti in denaro | Assenti. Le monete sono gratuite e servono per cosmetici; non sono riscattabili né trasferibili in denaro |
| Assistenza | `smazzata.play@gmail.com`, accesso e ricezione da verificare dal titolare |
| Privacy | `https://smazzata.github.io/gioca/privacy.html` |
| Cancellazione | `https://smazzata.github.io/gioca/elimina-profilo.html` |
| Condizioni | `https://smazzata.github.io/gioca/regole.html` |
| Icona | `icona-512.png`, 512×512 |
| Immagine in evidenza | `immagine-in-evidenza.png`, 1024×500 |
| Screenshot | Solo la selezione in `SCHERMATE.md`, da confrontare con l'AAB finale |

Le pagine pubbliche devono aprirsi senza login anche da una rete esterna. Gli URL e i documenti predisposti non provano da soli questa verifica.

## Dichiarazioni

1. **Account sviluppatore:** controllare tipo e data di apertura, eventuale verifica dispositivo richiesta, recapiti e stato professionale/trader. L'identità è stata confermata secondo il titolare; non segnare automaticamente completati gli altri punti.
2. **Pubblico:** il servizio online richiede almeno 14 anni. Le fasce Google non coincidono con questa soglia: scegliere quelle coerenti con il pubblico effettivo e confermare paesi iniziali. Non dichiarare un'app per bambini se non lo è.
3. **Classificazione dei contenuti:** dichiarare chat/interazione fra utenti, segnalazione e blocco, giochi di carte e premi cosmetici casuali gratuiti. Nessuna puntata o premio convertibile in denaro. Rispondere al testo effettivo delle domande; il rating lo assegna il questionario.
4. **Sicurezza dei dati:** usare `SICUREZZA-DEI-DATI.md`; verificare email, cloud/tunnel e backend realmente utilizzati. Non selezionare “nessun dato raccolto”.
5. **Accesso app:** alcune funzioni richiedono il profilo; preparare un account revisore dedicato e già verificato. Il testo inglese seguente va accompagnato da credenziali valide inserite solo nella Console.

## Istruzioni per i revisori, in inglese

Inserire nickname e password dell'account dedicato negli appositi campi privati della Console. Il testo seguente non contiene credenziali ed è pronto da adattare dopo la prova dell'AAB:

> Offline practice is available without an account. For online features, open Menu, then Profile, choose the sign-in option and use the reviewer credentials provided in this form. The account is already verified; no email code or personal device is needed for sign-in. Select Burraco, Scala 40, Ramino or Canasta on the home screen. “Play with friends” creates a private room; “Play online” and ranked play require other players to be available. Collection and Loot are accessible from the home screen. Coins and chests are free gameplay rewards; there are no real-money payments or ads. Music is optional and can be enabled in the audio settings. Account deletion is available in Profile and through the public deletion URL provided in the Data safety form.

Confrontare etichette e percorso con l'app in inglese prima dell'invio. Usare la normale verifica email iniziale: nessun accesso amministrativo o aggiramento speciale nel codice. Non usare l'account personale del titolare. Garantire server raggiungibile e credenziali riutilizzabili anche dopo il test.

## Pacchetto e avvio

1. Attendere Prove sul commit definitivo, controllando l'esito una volta su richiesta; nessun monitor periodico.
2. Ottenere un nuovo `Smazzata.aab` da quella versione. La verifica dell'AAB 1.30 è storica.
3. Verificare firma upload privata, Play App Signing, versione crescente, package, target API, contenuti offline e assenza del prompt di aggiornamento APK esterno. Procedura in `LEGGIMI.md`: `python scripts/verifica-aab.py <file.aab> --source-root .` e confronto del certificato con `scripts/verifica-certificato-play.py`.
4. Installare da un canale di test Play e provare registrazione/email, login dopo riavvio, partita, riconnessione, premi, monete, cancellazione e musica/Indietro Android. Il test interno non sostituisce il test chiuso richiesto per la produzione.
5. Configurare il test chiuso e invitare i tester seguendo `TEST-CHIUSO.md`. Conservare le loro email privatamente.

## Note di versione italiane proposte

> Prima versione di prova di Smazzata: Burraco, Scala 40, Ramino e Canasta. Partite con amici, allenamento offline, classificate e collezione di cosmetici con ricompense gratuite. Musiche originali facoltative e impostazioni di leggibilità. Aiutateci a verificare installazione, partite, connessione e semplicità dei menu.

Non promettere approvazione, data di pubblicazione o presenza di funzioni future.

## Fonti ufficiali consultate

- [Configurazione test e liste email](https://support.google.com/googleplay/android-developer/answer/9845334?hl=it)
- [Requisiti per nuovi account personali](https://support.google.com/googleplay/android-developer/answer/14151465?hl=it)
- [Accesso per i revisori](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en)
- [Eliminazione account](https://support.google.com/googleplay/android-developer/answer/13327111?hl=it)
