# Correzioni dopo il primo collaudo Android

Client `2026.10.27.1`, entrambe le cache offline v92. Nessuna modifica alle regole, alla progressione o all'economia.

## Problemi corretti

- Traduzioni mancanti per Allenamento, Amichevole online, Musica, titolo e azioni di uscita, resa e ritorno alla home. Aggiunte in inglese, spagnolo e portoghese; dizionari rigenerati.
- Una descrizione di uscita veniva tradotta solo a metà dal modello della cronaca “{0} gioca {1}”. Aggiunta la frase completa: non lascia più pezzi italiani attorno alla parola “plays”.
- La conferma di uscita usava lo stesso messaggio online anche nell'allenamento locale. Ora descrive il comportamento effettivo: offline l'allenamento viene chiuso; nell'allenamento sul dispositivo collegato si può riprendere dalla home; nel tavolo online il computer può sostituire il giocatore. Cambia solo il testo, non la gestione del salvataggio o dell'uscita.

## Verifiche

Nuovo percorso `node server/chest-uitest.js --languages --small`: 16 schermate in ciascuna delle quattro lingue, per 64 controlli a 320 px. Copre home, guida, menu, audio/aspetto, amici, collezione, bottino, progressi, menu partita e uscita locale/online/offline. Controlla etichette italiane residue, frammenti parzialmente tradotti, coerenza dell'avviso offline e assenza di sforamento orizzontale. Prova aggiunta al workflow Prove.

Eseguite anche le verifiche rapide e i 71 test di prerilascio. Rigenerate le 34 scene di rilascio e le immagini store pertinenti; gli hash dei sorgenti identificano questa revisione.

## Riscontro nell'emulatore

Medium Phone Android 16/API 36, x86_64. Usato un APK esclusivamente QA: stesso guscio dell'AAB 1.70, asset aggiornati e ingresso forzato nella pagina offline `gioca/index.html?offline=1`, firmato con la chiave pubblica del sito. Artefatto in `test-output/android-emulatore/`, non pubblicato e non destinato al caricamento su Play. L'AAB originale 1.70 è conservato intatto.

Controllati visivamente guida in inglese, avvio di Scala 40 offline, menu e commutazione musica accesa/spenta, conferma di uscita interamente tradotta e con descrizione offline corretta. La partita è ricomparsa dopo l'aggiornamento locale/riapertura; Indietro chiude la conferma e torna al tavolo. Nessun crash nativo rilevato nei log dell'app durante questo controllo. Nessun account reale o inventario di Simone modificato.

La prima bozza del solo ingresso QA puntava alla directory `gioca/`, mentre il server asset Android richiede il percorso esplicito `gioca/index.html`: corretta la build QA. La pagina d'ingresso pubblica usava già il percorso corretto; non è stata modificata per questo motivo.

## Pacchetto Play

L'AAB 1.70 e lo ZIP Play-test-1.70 restano evidenze della revisione precedente, non includono queste correzioni. Il push della cache launcher genera una nuova build Android ufficiale: confrontare e verificare quell'AAB prima del caricamento Play. La prova QA non attesta firma Play, installazione dal canale chiuso, notifiche native, reti mobili o capacità del telefono-server. Nessuna pubblicazione Play o monitoraggio periodico effettuati.
