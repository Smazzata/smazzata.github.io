# Smazzata sul Play Store — cosa c'è qui e come pubblicare

## Materiale pronto in questa cartella
- `icona-512.png` — icona per la scheda del Play Store (512×512).
- `immagine-in-evidenza.png` — immagine in evidenza (1024×500).
- `schermate/` — schermate del telefono (1080×1920). Si rigenerano con `STORE=1 node server/uitest.js`.
- `testi.md` — nome, descrizione breve e descrizione completa in italiano, inglese, spagnolo e portoghese.
- Il pacchetto da caricare (**Smazzata.aab**) viene creato da GitHub a ogni nuova versione dell'app,
  nella pagina *Releases* del progetto, accanto a `Burraco.apk`. È costruito per Android 16 (API 36, Capacitor 8),
  come chiede Google dal 31 agosto 2026. Serve la chiave di caricamento nei Secrets di GitHub (vedi sotto, punto 3):
  senza, GitHub crea solo l'APK.

## Prima di pubblicare (da non dimenticare)
- **Cambiare la chiave della pagina di stato** (è stata scritta in una chat): in Termux, in una nuova sessione,
  `rm ~/burraco/data/admin-key.txt`, poi `pkill -f "node server/index.js"` (lo script riavvia il server con una
  chiave nuova), poi `cat ~/burraco/data/admin-key.txt` per leggerla. Salvarla solo tra i preferiti, mai in chat.
- ✅ Fatto: la versione per il Play Store (`Smazzata.aab`) non mostra l'avviso «scarica la nuova app» e ha il gioco dentro l'app (si apre anche senza internet). L'`Burraco.apk` delle Releases continua a mostrarlo.
- Decidere il server: il telefono di casa va bene per gli amici, con utenti sconosciuti serve qualcosa di più stabile.

## Cosa devi fare tu (una volta sola)
1. **Account sviluppatore Google Play**: https://play.google.com/console — costo unico di 25 dollari.
   Serve un documento d'identità; Google può chiedere di verificare un numero di telefono.
2. **Crea l'app** nella Console: nome «Smazzata», lingua predefinita italiano, *Gioco*, *Gratuita*.
3. **Firma dell'app**: lascia attiva la «Firma dell'app da parte di Google Play». `Smazzata.aab` è firmato con la
   *chiave di caricamento* segreta, che sta solo sul PC nella cartella `Smazzata-chiavi` (fuori dal progetto) e nei
   Secrets di GitHub `PLAY_UPLOAD_KEY` e `PLAY_UPLOAD_KEY_PASSWORD` (istruzioni nel `LEGGIMI.txt` di quella cartella).
   Non usare `android-app/burraco.p12` per il Play Store: è nel progetto pubblico, serve solo all'APK del sito.
   Tieni una copia della cartella delle chiavi; se si perde, Google permette di chiedere una nuova chiave di caricamento.
4. **Scheda dello Store**: copia i testi da `testi.md` e carica icona, immagine in evidenza e almeno 2 schermate.
5. **Norme sulla privacy**: indirizzo https://simonemuliello010500-web.github.io/BurracoByMSF/gioca/privacy.html
6. **Sicurezza dei dati**: dichiara che l'app raccoglie **indirizzo email** (Informazioni personali → Indirizzo email:
   obbligatorio, scopo «Gestione dell'account», non condiviso con terzi) e **ID utente** (il nickname). Salva anche
   statistiche di gioco e una password cifrata; dati cifrati in transito (https); nessun dato venduto;
   l'utente può eliminare il profilo dall'app (Profilo → Elimina il mio profilo).
   **Link per eliminare l'account** (richiesto da Google): https://simonemuliello010500-web.github.io/BurracoByMSF/gioca/elimina-profilo.html
7. **Classificazione dei contenuti** (questionario): niente violenza, niente acquisti, **niente gioco d'azzardo
   simulato** (nessun gioco con puntate o fiches: il Sette e mezzo è stato tolto apposta). Va invece dichiarato che
   **gli utenti interagiscono** (chat, messaggi vocali, amici), con la possibilità di segnalare e bloccare.
8. **Pubblico di destinazione**: 13 anni in su (per via della chat tra giocatori).
9. **Test chiuso**: per i nuovi account personali Google chiede un test chiuso con almeno 12 tester per 14 giorni
   prima della pubblicazione. Li inviti con la loro email Google (o un Gruppo Google). Se non conosci abbastanza
   persone: scambio di tester tra sviluppatori (Reddit r/AndroidClosedTesting, r/TestersCommunity) e gruppi di
   giocatori di Burraco/Scala 40 su Facebook. Mai account finti o emulatori: Google può chiudere l'account.
10. **Produzione**: dopo il test, «Crea nuova release» → carica `Smazzata.aab` → invia per la revisione (qualche giorno).

## Da sapere
- **Pubblicità (in arrivo)**: quando la aggiungi, nella Console vanno aggiornati «Contiene annunci» (sì),
  «Sicurezza dei dati» (ID pubblicità e dati raccolti dal servizio di annunci) e la pagina sulla privacy
  (`public/privacy.html`, con il nome del servizio); in Europa serve anche la richiesta di consenso.
- Ogni nuova versione: GitHub crea un nuovo `Smazzata.aab` (numero di versione già crescente): lo carichi come nuova release.
- L'APK scaricato dal sito continua a funzionare come prima; chi installa dal Play Store riceve gli aggiornamenti da lì.
