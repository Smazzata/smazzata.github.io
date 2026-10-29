# Preparazione del test chiuso

Il test non risulta avviato o completato: la Console è accessibile dal 29 ottobre, ma Crea app è bloccato dalla verifica del numero di contatto; non abbiamo verificato un elenco di tester. Non confondere i test automatici del codice con il test chiuso Google Play.

Aggiornamento 26 ottobre 2026: il titolare comunica che Google ha confermato l’identità. Questo non avvia il conteggio dei 14 giorni: servono una release nel canale chiuso e adesioni reali. Tipo/data dell’account e applicabilità del requisito restano da verificare in Console.

## Come inserire i conoscenti

Vanno benissimo amici e parenti disponibili a provare davvero l’app. Raccogli privatamente l’email dell’account Google usato su Play Store; non serve che sia Gmail, ma deve essere associata a un account Google. Suggeriamo 15–20 persone per avere margine se qualcuno esce; il requisito ufficiale applicabile è 12 aderenti continui, non 20.

1. Play Console → app → Test e release → Test → Test chiuso → Gestisci canale → Tester. Le etichette possono cambiare.
2. Crea una lista email, inserisci gli indirizzi, salvala e associala al canale. Per poche persone basta la lista. Non caricare le email in questo repository. Un CSV importato può sostituire l’elenco precedente: controllarlo prima.
3. Imposta il recapito per i feedback, verifica i paesi e prepara la release AAB del test. Il link di adesione può richiedere alcune ore dopo la prima pubblicazione.
4. Condividi privatamente il link ufficiale. Ogni persona apre il link con l’account inserito, aderisce e installa da Play. Aggiungere l’email senza adesione non avvia il suo periodo.
5. Verifica adesioni e contatore in Console. Mantieni almeno 12 aderenti continuativamente per i 14 giorni richiesti prima di chiedere produzione, se il vincolo si applica al tuo account. Chi esce e rientra ricomincia il proprio periodo continuativo. Fai usare realmente il gioco e registra feedback e correzioni: non basta parcheggiare iscrizioni.

Il test interno e i test automatici PC non sostituiscono questo requisito. Nessun obbligo inventato di minuti o partite al giorno. La disponibilità continua dei tester non significa tenere l’app aperta: significa mantenere l’adesione e partecipare alle prove. Il testo breve da consegnare è in ISTRUZIONI-TESTER.md; il registro vuoto è REGISTRO-TEST-MODELLO.csv, da compilare in una copia privata senza credenziali.

## Prima di iniziare

1. Completare i blocchi in `PRIMA-DI-PUBBLICARE.md`, verificare tipo e data di creazione dell'account sviluppatore.
2. Caricare l'AAB aggiornato nel canale appropriato e completare le dichiarazioni richieste. Installare la versione **da Play**, non l'APK del sito: firme e aggiornamenti sono diversi.
3. Creare il canale di test chiuso, configurare tester/gruppo e paesi. Conservare email e identità dei tester soltanto in Console o in un archivio privato necessario al test, non nel repository.
4. Invitare persone reali e inviare il link di adesione ufficiale quando disponibile. L'adesione deve essere effettiva: l'inserimento di un'email nell'elenco non basta. Tenere un margine di partecipanti per eventuali uscite, senza creare account finti.
5. Per gli account personali a cui si applica la regola: mantenere almeno 12 tester aderenti continuativamente per 14 giorni prima di richiedere produzione. Verificare il contatore nella Console.

## Percorso suggerito

| Giorni | Prove |
|---|---|
| 1–2 | Installazione da Play, primo avvio, registrazione, email di conferma, lingua, privacy/regole raggiungibili |
| 3–4 | Amici, inviti, amichevole, classificata, scelta dei quattro giochi al lancio (Burraco, Scala 40, Ramino, Canasta) e riconnessione |
| 5–6 | Giochi offline, riapertura app, nessun progresso assegnato dalle partite col computer |
| 7–8 | Chat, segnalazione contenuto/utente, blocco e risposta di moderazione con account di prova |
| 9–10 | Classifica/gradi, accessibilità, notifiche facoltative, tornei e sfida del giorno |
| 11–12 | Recupero password e secondo dispositivo; eliminazione di un account appositamente creato, verifica che le vecchie credenziali non funzionino |
| 13–14 | Ripetere i difetti corretti, aggiornamento da Play, dispositivi/versioni Android diversi, controllo pre-launch report |

Non chiedere ai tester recensioni positive in cambio della partecipazione. Le prove non richiedono acquisti o annunci.

## Registro privato suggerito

Usare identificativi tipo T01/T02 nel riepilogo: data, versione installata, dispositivo/Android, funzione provata, esito, problema riproducibile e correzione. Non raccogliere password, codici, conversazioni o documenti personali. La prova di cancellazione va fatta su un profilo di test destinato a essere eliminato.

## Richiesta di produzione

Preparare risposte veritiere su partecipazione, feedback ricevuti, modifiche apportate e motivi della prontezza. Rispondere solo con fatti osservati, senza dichiarare completati test che nessuno ha svolto. La fine dei 14 giorni consente di richiedere accesso alla produzione, non garantisce approvazione automatica.

Fonte: https://support.google.com/googleplay/android-developer/answer/14151465?hl=it
