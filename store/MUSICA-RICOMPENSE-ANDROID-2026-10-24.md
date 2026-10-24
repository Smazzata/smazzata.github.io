# Musica, ricompense e navigazione Android — 24 ottobre 2026

Base: `989732a`. Richieste autorizzate: riepilogo ricompense, prima chest guidata, obiettivo settimanale con un amico, musica selezionabile e gestione del tasto Indietro Android.

## Comportamento

- Il risultato riunisce XP/trofei già confermati e bottino della stessa partita: chest ottenute, progresso ordinario e prossimo obiettivo settimanale. La ricevuta è collegata a profilo, tavolo e sequenza della partita; non compare in allenamento, a uno spettatore o nella partita successiva. Al limite giornaliero viene spiegato che occorre riprendere domani.
- Prima della prima apertura effettiva una guida spiega un oggetto per chest, rarità, doppioni/frammenti e salvataggio prima dell'animazione. Si può tornare al bottino senza consumare nulla; il premio si può equipaggiare dopo l'apertura. La guida non si ripete dopo un'apertura salvata.
- Quarto obiettivo settimanale: tre partite online umane idonee concluse con almeno un amico reciproco al tavolo, anche da avversari, danno una chest rara. Una partita conta una sola volta anche con più amici. Un solo premio per settimana, aggiuntivo rispetto al limite giornaliero; reset lunedì Europe/Rome. Nessuna ricostruzione retroattiva. Il contatore non memorizza identificativi degli amici. Le tabelle di rarità rimangono invariate.
- Dodici brevi temi originali sintetizzati sul dispositivo: Home, attesa, collezione, bottino, apertura, Avventura, Burraco, Scala 40, Ramino, Canasta, vittoria e sconfitta. Nessuno streaming, campione o servizio esterno. Preferenza Musica di sottofondo nelle impostazioni, inizialmente spenta, salvata indipendentemente dagli effetti sonori. Avvio dopo un gesto, volume contenuto, dissolvenza al cambio, un solo sequenziatore; sospensione in background e in presenza di musica condivisa dal tavolo. Disponibile anche offline, senza aumentare il peso con tracce audio.
- L'app Android chiama la stessa navigazione della pagina tramite `window.smazzataBack`: tastiera, dettagli, pannelli, conferma per lasciare il tavolo, Home. Dalla Home mette l'app in secondo piano. Non cambia il comportamento dei tasti Home e Recenti. Il browser mantiene il percorso popstate esistente. Il codice nativo viene copiato nel progetto Capacitor durante la compilazione APK/AAB.

L'integrazione usa [OnBackPressedDispatcher di AndroidX](https://developer.android.com/guide/navigation/navigation-custom-back), collegato al ciclo di vita dell'Activity, e [BridgeActivity di Capacitor 8.5.3](https://github.com/ionic-team/capacitor/blob/8.5.3/android/capacitor/src/main/java/com/getcapacitor/BridgeActivity.java). Non aggiunge interfacce JavaScript privilegiate né permessi.

## Verifiche

- `npm run test:rapido`: superato, 24 file client offline e 2887 traduzioni.
- `npm run test:prerilascio`: superato, 50 prove, incluse reciprocità dell'amicizia, limite settimanale, ripristino, rollback, correlazione delle ricompense, consenso e sospensione musica, navigazione Indietro.
- `npm run e2e`: superato.
- `node server/uitest.js --polish`: superato.
- `node server/chest-uitest.js`: superato, compresi avvio di un vero AudioContext, preferenza salvata, cambio di tema, spegnimento, navigazione chiamata come dall'app e prima apertura guidata senza consumo anticipato.
- `node server/release-ui-test.js --store`: superato; screenshot e hash dei sorgenti in `schermate-rilascio/VERIFICA.json`. Scenari social/ricompense di questa prova grafica simulati localmente; non attestano la distribuzione online.
- Verifica sintassi dei file JavaScript e controllo diff: superati. Nessuna credenziale, database, backup o artefatto temporaneo aggiunto; risorse generate di prova rimangono escluse da Git.

`npm run ui`: superato, partite complete Burraco/Scala 40/Canasta, avvio Ramino, moviola, torneo, impostazioni, offline, APK/Store e lingue; nessun errore nella pagina. Tutte le prove grafiche sono state eseguite una alla volta.

## Limiti

La modifica nativa richiede compilazione e installazione del nuovo APK; un aggiornamento web non cambia il guscio delle app già installate. Non sono disponibili Java/SDK/ADB locali: compilazione nativa affidata al workflow APK e comportamento fisico di pulsante/gesto da verificare su Android. Le prove audio verificano generazione e ciclo di vita nel browser, non l'ascolto sugli altoparlanti di un telefono. Nessuna pubblicazione su Play Console e nessun invio a utenti reali. Push e avvio dei workflow non attestano da soli l'aggiornamento del server: servono Prove superato e riscontro sul server pubblico.
