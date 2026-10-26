# Verifica storica dei dieci punti richiesti

Per lo stato attuale usare [STATO-RILASCIO-2026-10-26.md](STATO-RILASCIO-2026-10-26.md). Le evidenze qui sotto descrivono le date indicate, non una verifica dell’AAB finale.

Data: 21 ottobre 2026; aggiornamento build e stato operativo: 22 ottobre 2026. «Preparato» indica file e comportamento verificati nel progetto; «non verificato in Console» non equivale a bocciato né a completato. La release va controllata dopo la distribuzione, prima dell'invio a Google.

| Punto | Verifica eseguita | Esito e cosa resta |
|---|---|---|
| 1. Privacy Policy | Informativa aggiornata con titolare indicato dall'utente, contatto privacy, dati/finalità/basi giuridiche, diritti/reclamo, fornitori, scadenze, memoria locale e backup pregressi; link in app e registrazione; pagina a 360 px senza overflow | **Preparata e testata.** Verificare contratti/trasferimenti dei fornitori e bonifica dei backup storici; revisione legale mirata prima dell'apertura pubblica |
| 2. Termini e condizioni | Età, account, contenuti vietati, moderazione, segnalazione, blocco, riesame, gratuità/assenza denaro, contatti e diritti inderogabili; accettazione esplicita registrata server | **Preparati e testati.** Confermare pubblico/paesi, status professionale e obblighi applicabili |
| 3. Eliminazione account | Test su server isolato con due dispositivi, password e vecchia chiave revocate; sessione rimossa su disco; cancellazione risultati/riferimenti/copie; test browser rimuove dati locali; pagina email accessibile senza login | **Funzione verificata.** Le vecchie copie GitHub richiedono bonifica separata; non dichiariamo eliminazione retroattiva già avvenuta |
| 4. Data Safety | Mappa del codice in `SICUREZZA-DEI-DATI.md`, inclusi chat, segnalazioni, diagnostica, identificativi e WebView; nessun SDK ads rilevato | **Scheda preparata; invio/risposte in Console non verificati.** Condivisione e fornitori vanno confermati sui contratti reali |
| 5. Chat e contenuti degli utenti | E2E: segnalazione utente con messaggi allegati, blocco chat/inviti, filtro, avviso, blocco chat, rinomina ed eliminazione amministrativa; regole esplicite e canale riesame | **Funzioni verificate.** Moderazione effettiva e casella presidiata restano attività continuative del titolare |
| 6. Classificazione contenuti | Funzioni attuali inventariate: chat/interazione utenti, giochi di carte senza puntate o premi monetari | **Indicazioni preparate; questionario IARC e rating non verificati in Console.** Non assegniamo noi un rating |
| 7. Pubblicità e acquisti | Dipendenze/configurazione e interfaccia: niente SDK ads, acquisti, Advertising ID o Billing nel progetto attuale; collegamenti musicali esterni senza iframe/rete preventiva verificato nel browser | **Assenti nella versione attuale.** Dichiarazione «contiene annunci: no» da verificare/inserire in Console. Non serve integrare Billing per acquisti che non esistono |
| 8. Build Android | AAB pubblico apk-30 già verificato: firma crittografica interna valida, digest di 528 file, package `it.smazzata.app`, versione 1.30/30, min SDK 24, target/compile SDK 36, modalità Store e privacy aggiornata, niente permessi microfono/contatti/posizione. Evidenza: `test-output/verifica-aab-30.json` | **AAB 1.30 verificato tecnicamente.** Sostituisce il precedente riscontro su 1.29. Chiave registrata in Play, App Signing, pre-launch report e compatibilità dispositivi non verificati in Console |
| 9. Materiale Play Store | Icona 512×512, feature graphic 1024×500, screenshot rigenerati 1080×1920, testi in quattro lingue entro limiti (nome ≤30, breve ≤80, completa ≤4000), rimossi riferimenti a Elo visibile e campagna | **Materiale preparato e dimensioni controllate.** Selezione screenshot in `SCHERMATE.md`; caricamento effettivo in Console non verificato |
| 10. Test chiuso | Procedura, percorso 14 giorni e registro minimo in `TEST-CHIUSO.md`; requisito ufficiale controllato | **Preparazione disponibile; tester, adesioni e giorni effettivi non verificati.** Per account personali interessati, almeno 12 aderenti continuativamente per 14 giorni e successiva richiesta produzione |

## Evidenze tecniche

- `npm run test:rapido`: passato, inclusi nuovi test privacy e backup.
- `npm run e2e`: cancellazione multi-dispositivo, social, moderazione, gioco e progressi su dati temporanei.
- `node server/privacy-uitest.js`: passato; pagine legali/contatti, collegamenti musicali esterni e cancellazione tramite interfaccia in un browser reale.
- `STORE=1 node server/uitest.js`: passato; schermate rigenerate e flussi telefono/offline/lingue/leghe controllati.
- `npm audit --omit=dev`: zero vulnerabilità note nella fotografia attuale del database npm, non una garanzia di assenza di difetti.
- `python scripts/verifica-aab.py <file.aab>`: firma JAR interna, digest e manifest effettivo; non invia il file a Google.
- `node scripts/licenze.js`: avvisi di 105 dipendenze runtime, Capacitor e due font distribuiti nell'app.

## Aggiornamento del 23 ottobre

L’AAB 1.30 resta una verifica storica: precede le rifiniture e non è la build finale da inviare. Sorgenti e nuovi screenshot sono descritti in `RIFINITURE-2026-10-23.md` e `SCHERMATE.md`; occorre costruire e verificare un nuovo AAB prima del caricamento.

## Esito complessivo

**Preparazione tecnica avanzata, pubblicazione definitiva non ancora autorizzabile come «tutto completato».** Restano bonifica backup pregressi, verifica contratti/trasferimenti e recapiti/status del titolare, prova di cancellazione dopo installazione sul server reale, dichiarazioni e verifiche della Play Console e test chiuso quando richiesto. Nessun invio a Google, contratto, acquisto o messaggio a terzi è stato eseguito da questa verifica.
