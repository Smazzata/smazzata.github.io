# Gestione operativa dei dati personali

Versione 21 ottobre 2026. Per il titolare: non pubblicare credenziali, richieste reali o dati identificativi dei giocatori nel repository, nelle issue o nelle chat di assistenza tecnica.

## Cosa è automatico nella nuova versione

- Cancellazione account: rimozione sessione, indici nickname/email/codice/dispositivo, relazioni anche nei blocchi altrui, leaderboard, risultati quotidiani e riferimenti negli storici e gare. I posti in partite in corso passano a un computer senza identità recuperabile. Credenziali revocate su tutte le connessioni; dati locali rimossi dai client collegati che supportano l'avviso.
- Le copie locali precedenti alla cancellazione sono eliminate, non semplicemente lasciate in rotazione. La cancellazione risponde con errore se la pulizia delle copie fallisce. Il salvataggio è immediato; SQLite usa secure_delete e checkpoint WAL dopo la cancellazione. Questo limita i residui logici, non promette cancellazione forense fisica da memoria flash o dispositivi terzi.
- Ogni ora e all'avvio: massimo 100 segnalazioni non più vecchie di 90 giorni, scadenza reale per data dei risultati quotidiani (7 giorni), copie locali scadute dopo 7 giorni. Se il server è spento la pulizia avviene al riavvio.
- Se esiste una frase di almeno 12 caratteri in `~/.burraco-backup-pass` o `BACKUP_PASSPHRASE`, copia locale cifrata ogni 6 ore circa in `data/backups`, permessi privati sul sistema. Nessuna nuova dipendenza o servizio a pagamento.
- Il vecchio processo shell può restare in memoria dopo un aggiornamento: il nuovo `scripts/backup.js` rifiuta comunque destinazioni fuori da `data/backups`, impedendo nuovi caricamenti dal vecchio ciclo. Riavviare lo script Termux dopo il rilascio per caricare anche lo script aggiornato.
- `--restore` cerca solo copie locali e rifiuta di procedere se rileva il server attivo. Fermare prima il servizio. Mai ripristinare una copia scaricata precedentemente a una cancellazione senza ripetere le cancellazioni documentate.

## Bonifica delle vecchie copie su GitHub — blocco prima della pubblicazione

1. Annotare privatamente repository/ramo, date dei backup, eventuali cloni, esportazioni, altri riferimenti e destinatari. Non scaricare o committare backup in chiaro per fare l'inventario.
2. Verificare che sul server giri la versione che blocca i caricamenti GitHub. Riavviare Termux e controllare che non siano stati creati nuovi commit sul ramo `backup`.
3. Se è l'unica copia di sicurezza necessaria, creare e verificare prima una copia **locale cifrata dello stato attuale**, già privo dei dati da cancellare. Custodire la frase separatamente. Non salvare «per sicurezza» l'intera cronologia con dati da eliminare.
4. Bonificare il ramo remoto e tutti i riferimenti pertinenti seguendo la documentazione GitHub per i dati sensibili. La rimozione del solo ramo o una force push non garantisce la rimozione di vecchi oggetti raggiungibili per SHA, cache o fork. Richiedere a GitHub Support le operazioni ammesse per i residui e conservare la risposta. Non sono state eseguite automaticamente cancellazioni remote o riscritture della cronologia.
5. Eliminare le vecchie copie scaricate ed eventuali cloni del ramo dai dispositivi sotto controllo del titolare; verificare destinatari/fornitori. Documentare eventuali limiti e le richieste al fornitore, senza promettere una scadenza non confermata.
6. Registrare data, esito e responsabile della bonifica. Solo dopo verifica aggiornare il paragrafo pubblico sui backup pregressi. Fino a quel momento resta una condizione aperta di pubblicazione.

Fonte: [GitHub — rimuovere dati sensibili da un repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Richieste degli utenti

Casella privacy: `muliellostudio@gmail.com`. Casella assistenza/moderazione: `smazzata.play@gmail.com`. Controllarle regolarmente. Non raccogliere documenti d'identità per impostazione predefinita; usare l'email già verificata o un altro controllo proporzionato. Non chiedere mai password o codice di recupero per email.

Registro privato minimo: identificativo pratica, data ricezione, tipo richiesta, scadenza, verifica eseguita, azione/esito e data risposta. Non duplicare tutti i dati del profilo nel registro; stabilire con la revisione legale una durata giustificata del registro e le eventuali eccezioni di conservazione. Non introdurre conservazioni illimitate «per sicurezza».

### Risposta iniziale suggerita

> Abbiamo ricevuto la richiesta relativa al profilo [nickname]. Ti risponderemo senza ingiustificato ritardo, di regola entro un mese. Per proteggere il profilo verificheremo che la richiesta provenga dal suo titolare. Non inviare password, codici di recupero o documenti non richiesti. Ti contatteremo se servono informazioni proporzionate per identificare il profilo.

### Chiusura di una cancellazione

Verificare effettivamente account, credenziali, risultati, storici e copie. Se permangono copie pregresse o un'eccezione di legge, spiegarlo nella risposta con motivo, azione e tempi: non inviare il testo «tutto cancellato» per comodità. La pagina di moderazione dispone di eliminazione profilo per gestire la richiesta esterna dopo verifica della titolarità.

### Accesso, rettifica e portabilità

Esportare soltanto i dati dell'interessato da un ambiente protetto, senza hash password, segreti, codici di recupero o dati personali di altri giocatori. Consegnare con un canale sicuro all'indirizzo verificato; il backup dell'intero server non è una risposta corretta a una richiesta di accesso. Rettificare i dati inesatti e documentare l'esito. Valutare le condizioni della portabilità per i dati forniti e trattati con mezzi automatizzati.

## Incidenti

Contenere l'accesso, revocare le credenziali coinvolte, conservare solo le evidenze necessarie in un archivio protetto e stimare dati/persone/rischio. Il titolare deve valutare gli obblighi GDPR: notifica all'autorità entro 72 ore dalla conoscenza quando richiesta, e comunicazione agli interessati quando richiesta per rischio elevato. Registrare anche gli incidenti per cui si motiva la mancata notifica. Non pubblicare log o database reali per chiedere aiuto.

## Quando si aggiungono annunci, acquisti o nuovi servizi

Nuovo inventario SDK/fornitori, valutazione dei dati e minori, eventuale consenso preventivo e revocabile, testi e modulo Sicurezza dei dati, regole di fatturazione Play e nuovo test della release. Questa documentazione riguarda la versione gratuita attuale senza annunci/acquisti, non autorizza automaticamente la futura monetizzazione.
