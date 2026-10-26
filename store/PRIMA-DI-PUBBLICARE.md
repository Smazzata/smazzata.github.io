# Apertura di Smazzata su Google Play

Aggiornato al 26 ottobre 2026. Le caselle aperte sono verifiche reali ancora da completare: la presenza di questo documento non significa che siano state fatte. Non inviare in produzione finché i blocchi non sono chiusi. Evidenze e accessi mancanti in [STATO-OPERATIVO-2026-10-22.md](STATO-OPERATIVO-2026-10-22.md). Il titolare comunica il 25 ottobre 2026 che Google ha confermato la sua identità. Lo stato degli altri passaggi in Console e dell'eventuale test chiuso resta da verificare; la verifica dell'identità non certifica l'approvazione dell'app.

La verifica storica della build 1.30 non copre le rifiniture del 23 ottobre: vedere `RIFINITURE-2026-10-23.md`. Servono una nuova build finale e il confronto con `SCHERMATE.md`.

## Documenti e comportamento preparati nel progetto

- [x] Identità fornita dal titolare: Muliello Simone Francesco; recapito privacy muliellostudio@gmail.com.
- [x] Informativa: basi giuridiche, diritti, reclamo, fornitori, memoria locale, scadenze, minori, cancellazione e limiti dei vecchi backup.
- [x] Pagina di cancellazione con canale email utilizzabile senza reinstallare o accedere all'app.
- [x] Condizioni d'uso: contenuti vietati, segnalazione, blocco, riesame, niente denaro/premi monetari, diritti inderogabili preservati.
- [x] Cancellazione nel codice: credenziali/dispositivi, amicizie/blocchi, progressi, risultati quotidiani, riferimenti negli storici/gare/tavoli e copie locali precedenti.
- [x] Nuovi backup solo locali e cifrati; scadenze per età delle copie e delle segnalazioni; niente nuovi caricamenti automatici di backup su GitHub.
- [x] Solo musiche interne originali, disattivate inizialmente; rimossi collegamenti e condivisione musicale esterna.
- [x] Testi dello store aggiornati ai gradi e all'allenamento senza progressi; Avventura non pubblicizzata.
- [x] Versione privacy pubblicata e server/Pages verificati nella sessione precedente del 22 ottobre; Android 1.30 verificato in `test-output/verifica-aab-30.json`, ultimo commit `040e6d2`.
- [ ] Test di cancellazione con account di prova dopo installazione sul server reale: evidenza distinta ancora da acquisire.

## Blocchi operativi prima dell'apertura pubblica

- [ ] **Backup GitHub pregressi:** inventario e bonifica del ramo `backup`, cronologia, riferimenti e copie scaricate. Verificare con GitHub Support le copie raggiungibili per vecchio SHA/cache/fork: cancellare il ramo non prova la cancellazione completa. Conservare esito e data della bonifica. Non ripristinare dati cancellati. Procedura in `docs/privacy-operazioni.md`.
- [ ] **Fornitori e trasferimenti:** verificare ruoli, termini applicabili, eventuali accordi art. 28 GDPR e garanzie artt. 44–49 per Cloudflare, GitHub e invio email. Il Gmail consumer non va considerato automaticamente equivalente a un servizio professionale con DPA. Se i termini non coprono l'uso, configurare un servizio adeguato prima della pubblicazione e aggiornare l'informativa con il fornitore reale. Nessun DPA o adesione DPF è stato inventato nei documenti.
- [ ] **Recapiti e identità:** controllare titolare, indirizzi di contatto funzionanti e dati pubblici richiesti dalla Console. Determinare se l'offerta è attività professionale/trader e fornire gli eventuali recapiti postali/telefonici richiesti. Non usare dati fittizi o dichiarare «non trader» solo per evitare un indirizzo pubblico.
- [ ] **Chiavi e accessi:** ruotare la chiave amministrativa già condivisa in chat; verificarne la revoca. Proteggere account Google/GitHub con MFA, chiave privata AAB e frase backup; nessun segreto nei documenti o negli screenshot. La chiave pubblica dell'APK del sito non deve firmare l'AAB.
- [ ] **Gestione continuativa:** accedere realmente alle due caselle email, gestire richieste e moderazione, tenere una registrazione minima delle richieste e dei tempi. Il filtro automatico delle parolacce non sostituisce la moderazione.
- [ ] **Revisione legale mirata:** far verificare testi e configurazione effettiva, soprattutto trasferimenti, minori, status professionale e applicabilità degli obblighi DSA. La preparazione tecnica non certifica conformità né esclude responsabilità.
- [ ] **Licenze:** verificare diritti di codice, font, mazzi, illustrazioni, icona e materiali dello store; inventario in `docs/licenze-pubblicazione.md`.
- [ ] **Continuità:** connessione e dispositivo server adeguati, accesso amministrativo protetto, monitoraggio errori e prova di ripristino dei soli backup leciti. Le copie sullo stesso dispositivo non proteggono dalla sua perdita: un eventuale servizio di backup esterno deve essere privato, con scadenze e contratto verificati.

## Play Console: operazioni del titolare

- [x] Identità confermata da Google secondo comunicazione del titolare.
- [ ] Verificare eventuali altri adempimenti account, tipo/data account, dati pubblici e dichiarazione trader/DSA in Console.
- [ ] App `it.smazzata.app`, categoria gioco, gratuita; AAB firmato con chiave upload privata e Play App Signing.
- [ ] Scheda e schermate attuali, nessun Elo numerico/Avventura/promessa non presente. Screenshot finali in `schermate-rilascio/`, selezione e metodo in `SCHERMATE.md`; confrontarli con il nuovo AAB e leggerli tutti prima di caricarli.
- [ ] URL privacy e cancellazione aperti senza login e da una rete esterna. Contatti dello store effettivamente presidiati.
- [ ] Modulo Sicurezza dei dati compilato dalla mappa `SICUREZZA-DEI-DATI.md`, verificando i fornitori reali e la release finale.
- [ ] Dichiarazione annunci: **no** per questa release. Acquisti in denaro: assenti; monete gratuite e acquisti di cosmetici con monete presenti. Aggiornare prima di introdurli.
- [ ] Questionario classificazione: dichiarare chat/interazione utenti, segnalazione e blocco. Nessuna puntata, fiches monetizzabili o premio convertibile; rispondere alle domande sui giochi di carte secondo il loro testo effettivo. Il rating viene assegnato dal questionario, non scelto da noi.
- [ ] Pubblico e paesi: servizio online almeno 14 anni; decidere distribuzione iniziale e requisiti dei paesi. Le fasce Console non coincidono con 14 anni: non scegliere fasce per aggirare Families e non selezionare automaticamente tutti i paesi. Confrontare età dichiarata, pubblico reale, scheda e tutele tecniche.
- [ ] Accesso app per revisori: fornire un account di prova già verificato con istruzioni su login e funzioni online, senza OTP/email personali del titolare. Salvare le credenziali soltanto nella Console, non nel repository. Nessun bypass dei controlli nel codice.
- [ ] Se applicabile all'account personale creato dopo il 13 novembre 2023: test chiuso con almeno 12 tester iscritti continuativamente per 14 giorni, poi richiesta di accesso alla produzione. Test reale, feedback e correzioni documentati.
- [ ] Pre-launch report, avvisi policy, compatibilità dispositivi e requisiti target API controllati sulla Console; l'AAB attuale usa target 36. Non presumere che i test locali equivalgano all'approvazione Google.
- [ ] Invio alla revisione e rollout graduale soltanto dopo la chiusura dei punti precedenti.

## Fonti ufficiali da ricontrollare all'invio

- [Dati utente e privacy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=it)
- [Eliminazione account](https://support.google.com/googleplay/android-developer/answer/13327111?hl=it)
- [Sicurezza dei dati](https://support.google.com/googleplay/android-developer/answer/10787469?hl=it)
- [Test account personali nuovi](https://support.google.com/googleplay/android-developer/answer/14151465?hl=it)
- [Contenuti generati dagli utenti](https://support.google.com/googleplay/android-developer/answer/9876937?hl=it)
- [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Cookie e altri strumenti di tracciamento](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9677876)
