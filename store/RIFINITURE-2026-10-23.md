# Rifiniture e verifiche — 23 ottobre 2026

Base: `7149eee`. Questa revisione raccoglie tutte le modifiche intenzionali autorizzate dal titolare, inclusi documenti store e script operativi preparati nelle sessioni precedenti. Le verifiche locali non attestano la distribuzione online: per quella servono esito del push, workflow Prove e riscontro sul server pubblico.

## Aggiornamento della collezione avatar

La successiva richiesta del titolare sostituisce i 100 disegni vettoriali descritti nella prima revisione con **50 ritratti illustrati** nello stile dei personaggi Avventura: 24 comuni, 15 rari, 8 epici e 3 leggendari con tre pose e movimenti leggeri. Aggiunti Tutti/Solo posseduti, preferenza ricordata sul dispositivo e possesso verificato dal server; gli sblocchi futuri non sono ancora definiti. I tre comuni non ottenuti dal servizio immagini sono sostituiti da giardiniere, marinaia e pasticciera. Dettagli, compatibilità, provenienza e prove in `../docs/avatar-illustrati.md`; screenshot store rigenerati. Le sezioni successive conservano il resoconto della prima revisione.

## Interventi

1. Esteso il sistema SVG con pittogrammi originali e simboli riutilizzabili. Sostituiti i pittogrammi decorativi nelle schermate secondarie, impostazioni, regole, avvisi e trofei. Nickname, nomi dei tornei, chat e reazioni dei giocatori conservano le emoji.
2. Amici, tornei e classifiche senza dati hanno illustrazioni, testo breve e accessi effettivi alle funzioni esistenti.
3. Modali dimensionate sul viewport visibile con tastiera, navigazione Indietro, pulizia del trascinamento quando si passa in background, conservazione della bozza amico e del campo attivo durante il ridisegno; testo grande senza ingrandire geometricamente tutta la pagina. Ripristino dal back/forward cache collegato alla riconnessione esistente.
4. Guida iniziale in due passi, saltabile e riapribile da Altro. Scelta fra i quattro giochi del lancio e accesso alla funzione di allenamento già esistente.
5. Anteprima grande per tutti i 100 avatar, nome/rarità/disponibilità e ritorno al catalogo. Solo i comuni possono essere scelti dall'anteprima. Server, ID, compatibilità, colori, titoli, cornici e definizioni dei disegni non sono stati cambiati. Il server conserva il blocco delle altre rarità e l'eccezione per le selezioni pregresse.
6. Risultato e azione principale precedono il dettaglio del punteggio. Allenamento: nessun XP/trofeo/grado. Amichevoli: eventuali progressi confermati. Classificate: ricerca di un'altra partita, senza rivincita contro gli stessi avversari. I progressi trasmessi dal server includono origine (tavolo, partita, smazzata), XP effettivamente registrati e soli nuovi trofei; il client non li stima e non li mostra su un'altra partita.
7. Esaminati i documenti operativi e gli strumenti già preparati; esiti sotto.
8. Rigenerati nove screenshot 1080×1920 e aggiornata la selezione in `SCHERMATE.md`, senza promuovere i giochi nascosti o le rarità bloccate.

Aggiornati entrambi i numeri di cache offline, le traduzioni EN/ES/PT e le prove della nuova navigazione nel catalogo. Nessun nuovo sistema di acquisti, ricompense o sblocco.

## Verifiche effettivamente eseguite

| Controllo | Esito |
|---|---|
| `npm run test:rapido` | Passato: motori, simulazioni, archivio, privacy, tornei, lingue e copertura dei file offline |
| `npm run test:risultati` | Due prove passate: XP/trofei reali, idempotenza e assenza di progressi per allenamento/tutorial/bot |
| `node server/release-ui-test.js --store` | Passato in Chrome da file locali: 23 acquisizioni, 320/375/768 px, temi chiaro/scuro, tre dimensioni testo, viewport ridotto, Indietro, guida, selezione/anteprima avatar, gradienti univoci, bozza con emoji, priorità delle azioni e isolamento dei progressi fra partite |
| `node scripts/lingue.js --check` | Dizionari generati aggiornati (2610 testi dopo la correzione del riepilogo) |
| Sintassi JS e `git diff --check` | Controllate le modifiche; nessun errore |
| `node scripts/licenze.js` | Eseguito, 105 dipendenze runtime/Capacitor/font; nessuna variazione sostanziale dei documenti generati |
| Diagnostica server store su Windows | Eseguita: nessun processo Termux attestabile, nessuna chiave/casella/configurazione remota verificabile da questa copia |
| AAB 1.30 disponibile localmente | SHA-256 identico al file già verificato: `f58fa247e7ab2b727a25e5893e34d3214ff24c6a7720454b0500f6946c5ce68b`. È precedente alle rifiniture; non è un AAB aggiornato |

Le prove grafiche usano l'interfaccia reale e il motore locale, con risposte social vuote di prova e alcuni stati controllati per verificare la presentazione. Non attestano una connessione Socket.IO, il matchmaking o il funzionamento del server pubblico. Le nove immagini numerate sono tutte 1080×1920; il file `schermate-rilascio/VERIFICA.json` documenta metodo e limiti.

## Ripresa con accesso Git e rete — 23 ottobre

- Rieseguito `npm run test:rapido`: passato, incluse simulazioni, lingue e file offline.
- Rieseguito `npm run test:risultati`: entrambe le prove passate.
- Rieseguito `npm run e2e`: passato integralmente su server temporaneo, inclusi profili, cancellazione, riconnessione, tornei e classificate.
- Rieseguito `node server/uitest.js --polish`: passato, incluse anteprime avatar, selezione dei soli comuni e profilo mobile. Ripetuto dopo le ultime correzioni.
- Rieseguito `node server/release-ui-test.js --store`: passato, 23 acquisizioni. Corretti il vecchio simbolo robot nell'intestazione dell'allenamento e la frase «Tu ha chiuso»; rigenerati tutti i nove PNG store 1080×1920. Gli hash delle sorgenti sono nel nuovo `VERIFICA.json`.
- Eseguito `node server/privacy-uitest.js`: passato, quattro pagine a 360 px, Spotify senza richieste anticipate, cancellazione e dati locali.
- Controllati diff, file non tracciati, sintassi JS/JSON e traduzioni. Nessuna credenziale privata, chiave privata, database, backup o artefatto temporaneo incluso; esempi email nei form, contatti pubblici del titolare e attribuzioni delle licenze sono contenuti intenzionali. Nessun file ignorato aggiunto forzatamente. Screenshot ispezionati: dati dimostrativi e nomi dei computer, nessun giocatore reale.
- La lettura del riferimento remoto `origin/main` è riuscita: base remota `7149eee`. I precedenti errori di connessione locale non si ripresentano. L'esito del push e dei controlli remoti va distinto dai test locali sopra elencati.

## Tentativi della sessione precedente (storico, superati dove indicato sopra)

- `npm run e2e`: passa il controllo preliminare del reset, poi `fetch failed`. Una richiesta diagnostica locale ha restituito `connect EACCES 127.0.0.1`.
- `node server/uitest.js --polish`: il browser non risponde sulla porta di debug; limite della rete locale nell'ambiente. La suite originale non è dichiarata passata. Il controllo da file locali è separato.
- Nuova verifica crittografica AAB/certificato: l'alias `python.exe` disponibile non è eseguibile. È stato confrontato l'hash, non rieseguita la verifica della firma. La corrispondenza con Play Console rimane aperta.
- Commit e push: tentati al termine del primo intervento; Git non può creare `.git/index.lock` (`Permission denied`). Il push fallisce anche sulla risoluzione della rete. Nessun nuovo commit creato o pubblicato, nessun workflow avviato per queste modifiche, nessuna distribuzione online attestata.

## Punti ancora aperti

| Punto | Accesso o verifica necessaria |
|---|---|
| Android reale | Tastiera di sistema, Indietro nativo, blocco/sblocco, background prolungato, perdita/ripristino Wi-Fi e rete mobile su dispositivo. L'emulazione del viewport non sostituisce queste prove |
| Backend reale | Accesso al Termux del telefono: diagnostica, fonte della chiave amministrativa, backup/uploader storici, scadenze reali, rotazione coordinata e prova di eliminazione con account dedicato |
| Backup storici | È ancora presente il riferimento locale `origin/backup`. Non è una lettura aggiornata del remoto né prova di bonifica. Nessuna cancellazione o richiesta a GitHub effettuata |
| Fornitori e titolare | Contratti/DPA, trasferimenti, dominio/tunnel, mittente e caselle presidiate, status e recapiti effettivi. Nessun contratto accettato o servizio attivato |
| Play Console | Accesso alla Console per stato identità/account, chiave upload e App Signing, questionari/dichiarazioni, revisore, pre-launch report, dispositivi e test chiuso. Nessun invio o modifica effettuati |
| Build finale | Commit/push, workflow Prove superato, nuova build AAB dalla versione completa e confronto con gli screenshot; poi verifiche Android e Console |

## File preesistenti inclusi nella ripresa autorizzata

Il titolare ha autorizzato esplicitamente commit e push anche delle modifiche preesistenti a `store/PRIMA-DI-PUBBLICARE.md`, `store/TEST-CHIUSO.md`, `store/VERIFICA-PUBBLICAZIONE.md`, dei tre script `inventario-backup-github.js`, `verifica-certificato-play.py`, `verifica-server-store.js` e dei documenti `PASSAGGI-CON-IL-TITOLARE.md` e `STATO-OPERATIVO-2026-10-22.md`. Vengono raccolti in un commit operativo distinto. I riferimenti alla vecchia build sono stati chiariti senza cancellare le evidenze storiche.

I nuovi file delle rifiniture sono `lingue/22-rifiniture.txt`, `server/result-progress-test.js`, `server/release-ui-test.js`, questo resoconto e `store/schermate-rilascio/`. Sorgenti, traduzioni, entrambe le cache offline, workflow, test, documentazione e screenshot pertinenti vengono raccolti nel commit delle rifiniture. Nessuna pubblicazione Play Console, accettazione di contratti, comunicazione a terzi o cancellazione di backup/rami remoti eseguita.
