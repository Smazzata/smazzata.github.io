# Primo collaudo Android nell'emulatore

27 ottobre 2026. Dispositivo virtuale esistente “Medium Phone”, Android 16/API 36, x86_64, con Play Store presente. Avviato dal Device Manager di Android Studio; interazioni eseguite nella finestra del dispositivo tramite controllo del computer.

## Installazione

AAB 1.70 della release `apk-70`, già verificato nel resoconto `PRETEST-AAB-2026-10-26.md`. Generato un APK universale con bundletool ufficiale 1.18.3 e installato con gli strumenti Android sul solo `emulator-5554`. La firma dell'APK generato è quella pubblica del sito, impiegata esclusivamente per questa installazione locale; l'AAB originale non è stato modificato. Il contenuto conserva la modalità `SmazzataStore`.

Non è un'installazione da Google Play e non verifica Play App Signing, licenza Play o aggiornamenti distribuiti dallo store. Nessuna chiave upload privata utilizzata o nuovo account Google creato. Gli artefatti di installazione restano in `test-output/android-emulatore/`, esclusi dai sorgenti pubblicati.

## Verifiche eseguite e osservate

- Primo avvio: schermata iniziale e guida in due passaggi caricate.
- Selezione Burraco nella guida e avvio dell'allenamento senza registrazione.
- Tavolo Android caricato, carte e turni del computer visibili.
- Pulsante Indietro Android durante la partita: apre la conferma di uscita; l'app resta aperta.
- Secondo Indietro: chiude la conferma e torna alla partita.
- Pesca tramite tocco sul tallone: conteggio da 63 a 62, mano e comandi aggiornati alla fase successiva.

Si tratta di un primo controllo manuale dell'app nativa in un dispositivo virtuale, distinto dalle precedenti simulazioni PC. L'account “Simone” non è stato usato e le quattro chest richieste restano da assegnare quando sarà disponibile l'accesso amministrativo.

## Riscontro da approfondire

Il primo collaudo in inglese mostrava etichette italiane nella guida e nella conferma di uscita. Corrette nella revisione client 2026.10.27.1; controllo browser sulle quattro lingue e ricontrollo manuale inglese nella WebView documentati in `CORREZIONI-ANDROID-2026-10-27.md`. Non equivale a certificazione completa di ogni schermata Android.

## Controlli successivi

Quattro giochi, chiusura/riapertura e ripresa completa, tastiera, preferenze audio e leggibilità, schermo piccolo, notifiche e interruzioni. Per profili, inventario e regali usare un ambiente/profilo di prova dedicato. L'installazione e gli aggiornamenti da Play richiedono il canale di test e un account autorizzato. Telefono reale, reti mobili e capacità del telefono-server restano da verificare separatamente.
