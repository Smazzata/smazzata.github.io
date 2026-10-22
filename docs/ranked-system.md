# Ranked: implementazione e gestione

## Architettura e migrazione

Il progetto usa Express/Socket.IO, motori autorevoli per ogni gioco, profili con chiavi dispositivo e archivio `kv` SQLite (Node 22.13+/24), con fallback JSON. Non sono stati aggiunti servizi o pacchetti.

`server/ranked.js` gestisce code, inviti, risultati, stagioni e Leggenda. `ranked-rules.js` contiene la progressione; `glicko2.js` la matematica. Il browser riceve viste pubbliche e invia soltanto intenzioni (cercare, accettare, annullare, giocare una mossa). Non esiste un endpoint per impostare vincitori, rating, LP o promozioni.

La migrazione è additiva: nessun incremento delle epoche di account/progressi. Sessioni, amicizie, storico, tornei, campionati e vecchi valori Elo rimangono nell'archivio. I nuovi profili Ranked nascono a 1500/350/0,06; il vecchio Elo non viene convertito arbitrariamente. I vecchi tavoli già iniziati senza `rankedMatch` terminano con il percorso precedente. Le nuove ricerche classificate passano tutte dal nuovo modulo.

Collezioni SQLite aggiunte nello schema `kv` esistente:

| Collezione | Chiave | Dato |
|---|---|---|
| `rankedPlayers` | ID account interno | profili per formato/coda, promozioni, statistiche, storico e stagioni |
| `rankedMatches` | UUID server | ricevuta idempotente, formato, stagione, data |
| `meta` | `rankedMeta` | versione, ultimo aggiornamento e fotografie Leggenda |
| `rooms` | codice tavolo esistente | nuovo `rankedMatch`: UUID, roster immutabile, formato e abbandoni |

La rappresentazione esportata continua a essere un oggetto `ranked` in `stato.json`, incluso nei backup esistenti. La lettura accetta anche il formato iniziale monolitico `meta/ranked`. Ogni risultato aggiorna tutti i partecipanti e la ricevuta nella stessa transazione SQLite/sostituzione atomica JSON. Il commit è sincrono, prima delle notifiche; un errore di scrittura ripristina lo stato Ranked in memoria e viene riprovato dal ciclo server. Al riavvio si riprendono i risultati conclusi non ancora elaborati. Le ricevute vecchie di 180 giorni vengono eliminate soltanto se il relativo tavolo non esiste più: il client non può ripresentare match arbitrari.

La cancellazione account rimuove i profili Ranked e anonimizza i riferimenti anche in fotografie, roster e controllo avversari recenti.

## Formati e matchmaking

La chiave è `gioco-o-variante:numero-giocatori:solo|duo`. Burraco Classico/Reale/Aberto/Fechado, Scopa/Scopone e i diversi numeri di giocatori sono separati. Si usano esclusivamente regole standard definite dal server.

Solo ammette una persona per iscrizione e forma automaticamente le coppie nei formati 2v2. Duo ammette due amici online: il primo propone, il secondo accetta entro 60 secondi. Duo esiste soltanto nei formati da quattro a coppie, non in Scala 40, Ramino, Rubamazzetto o Briscola in 5. Non esiste rating condiviso della coppia.

La ricerca usa rating e RD; penalizza anche la differenza fra compagni. In Solo 2v2 valuta le tre possibili divisioni in coppie. In Duo conserva le coppie accettate e rifiuta differenze superiori a 400 rating. Le code non vengono mescolate, nemmeno dopo lunga attesa. Finestre per **tutti** gli iscritti: ±100 prima di 15 s, ±150 fra 15 e 30 s, ampliamento fino a ±250 a 60 s. La qualità aggiunge 0,15 della differenza RD e 0,10 dello sbilanciamento dei compagni, con budget extra massimo 70. Sono considerati al massimo 24 candidati e 1500 combinazioni per testa, ogni due secondi.

Nessun ingresso per codice, invito diretto, cambio regole, annullamento dell'host, riempimento CPU o rivincita Ranked. Terminata la partita si torna in coda. Contro lo stesso avversario non si viene riabbinati per 15 minuti. Un account può essere in una sola iscrizione e non cercare durante una partita in corso. Le code/inviti sono volutamente effimeri: dopo un riavvio si deve ricercare; i tavoli già creati e i progressi sono persistenti.

Turni da 60 secondi: l'inattività di un giocatore collegato causa resa autorevole, senza giocare mosse CPU. Una disconnessione concede 120 secondi; la riconnessione mantiene posto e partita. Dopo 120 secondi senza confermare la prossima smazzata si applica lo stesso criterio. Abbandonare esplicitamente causa resa immediata. Pausa Ranked crescente di 15 minuti per abbandono, fino a 120 minuti. La sconfitta è quella della squadra secondo il motore. Amichevoli e offline conservano il precedente comportamento con sostituti CPU.

## Glicko-2 e modello di squadra

Fonte: [Mark E. Glickman, Example of the Glicko-2 system, 2022](https://www.glicko.net/glicko/glicko2.pdf).

Parametri iniziali: rating 1500, RD 350, volatilità 0,06, τ 0,5, tolleranza 10⁻⁶. La volatilità usa il procedimento Illinois dell'articolo. Il test ufficiale restituisce rating 1464,05067, RD 151,51652 e volatilità 0,05999598.

Un match completo è un periodo osservato; tutte le abilità sono fotografate prima dell'aggiornamento e aggiornate insieme. I giorni interi senza incontri sono periodi vuoti: cresce RD, fino a 350; rating e volatilità non vengono alterati. Le letture non accumulano nuovamente la stessa inattività. Questa versione online usa periodi osservati di un match: non è il batching di 10–15 partite suggerito dall'autore per popolazioni più grandi.

Squadra: media aritmetica dei rating, `RD_team = sqrt(sum(RD_i²))/n`, volatilità aggregata analogamente. Una squadra osserva ogni squadra avversaria una volta; con più di due squadre il peso totale delle osservazioni rimane 1. Non si contano due partite per avere affrontato due avversari. Il cambiamento collettivo è ripartito tra compagni in proporzione alle varianze individuali; la media dei loro cambiamenti coincide con quella di squadra. La contrazione della varianza è ripartita secondo il condizionamento gaussiano. Le covarianze fra compagni non vengono memorizzate: l'incertezza successiva è conservativa e il modello è un'approssimazione, non una formula ufficiale Glicko-2 per squadre. In formati multigiocatore i vincitori sono sopra gli altri; vincitori multipli e perdenti senza ordinamento ulteriore sono pari fra loro. Il risultato è sempre quello dell'intera partita.

## Leghe, LP e promozioni

Bronzo → Argento → Oro → Platino → Diamante → Maestro → Gran Maestro → Campione → Leggenda. Le prime otto hanno IV, III, II, I; Leggenda non ha divisioni.

La posizione visibile è distinta dal rating. Una divisione vale 100 LP. Il centro di riferimento parte da rating 1000 e cresce di 50 per divisione. La variazione usa base 24 LP più/minus una correzione proporzionale (0,12) al disallineamento fra rating e posizione; minimo 5, massimo 40. Le perdite crescono quando il grado è superiore all'abilità stimata. La divisione avanza automaticamente conservando il residuo. Sotto zero si retrocede conservando il debito; Bronzo IV si ferma a zero.

Al raggiungimento di 100 LP in divisione I si avvia BO3: due vittorie promuovono subito, due sconfitte falliscono subito. Successo: IV della lega seguente, 0 LP; fallimento: I della lega corrente, 75 LP. I pareggi aggiornano Glicko ma non consumano la serie. La promozione riguarda soltanto la chiave in cui è iniziata. Campione I a 100 LP **non** avvia una BO3. Il miglior rank non attribuisce la lega seguente al semplice ingresso in promo.

Dieci piazzamenti per chiave. Il grado provvisorio deriva da `rating − RD`, con tetto Oro I per nuovi profili. Dopo il cambio stagione il tetto considera il grado già conquistato. Non si azzera il rating a ogni stagione.

## Leggenda e stagioni

Stagioni da 90 giorni, epoca iniziale 21 ottobre 2026 00:00 UTC, configurabile. Le partite a cavallo della scadenza contano nella stagione in cui finiscono. Il cambio stagione archivia statistiche, rating, grado finale e migliore; assegna un'insegna stagionale persistente nella collezione del profilo; chiude le promo aperte senza trasferire vittorie; riduce moderatamente il grado visibile (85%, limitato dall'abilità) e apre i nuovi piazzamenti. Glicko e massimo storico restano. Le classifiche precedenti sono consultabili dal selettore stagione.

Ogni 24 ore (anche senza visitatori, recuperando l'aggiornamento all'avvio) si calcola Leggenda per chiave. Denominatore: account con almeno 30 partite nella stagione, ultima partita entro 30 giorni, non sospesi (`suspended`, `banned`, `rankedBanUntil`). Ordine: rating decrescente e ID interno crescente per parità. Posti: `max(1, floor(N × 0,01))` se N > 0. Fra quei posti entra solo chi ha rating ≥2600, equivalente al completamento teorico di Campione I. I posti possono rimanere vuoti. Uscendo si torna a Campione I, 75 LP, senza modificare il rating. Il cambio di stagione invalida subito la fotografia precedente.

UI: posizione e percentile della fotografia mondiale, numero idonei, posti, distanza dalla soglia; per Leggenda anche rating. RD, volatilità, token e graduatoria interna degli iscritti non sono esposti. Le variazioni giornaliere notificano promozione/retrocessione ai giocatori collegati.

## Grafica e interfaccia

33 insegne in `public/art/ranked`: otto leghe × quattro divisioni più Leggenda. Recuperate le sette illustrazioni WebP originali, aggiunti Gran Maestro rubino/platino e Campione zaffiro/oro con ImageGen integrato nello stesso stile tridimensionale. Ogni divisione conserva l'illustrazione e aggiunge un pendente con 1–4 gemme; Leggenda mantiene l'originale unica. Gli SVG incorporano i WebP: sono asset misti bitmap/vettoriali, non illustrazioni interamente vettoriali. `node scripts/ranked-art.js` rigenera i contenitori senza servizi esterni. Sorgenti, provenienza e prompt in [league-art.md](league-art.md).

Pagina Ranked integrata nella home e nelle classifiche; accesso al profilo competitivo dalle statistiche, riepiloghi per gioco/coda nelle schede amici, collezione di insegne stagionali, storico fino a 100 match, massimo stagionale/storico, progressione BO3 e riepilogo LP finale recuperabile dopo riconnessione. Animazioni con focus gestito e rispetto della preferenza di movimento ridotto. Testi in italiano, inglese, spagnolo e portoghese; asset e moduli inclusi nei service worker e nella build Android/web.

## Verifica e calibrazione

Comandi aggiunti: `npm run test:ranked`, `npm run e2e:ranked`, `npm run sim:ranked`; eseguiti anche in CI.

Verifica locale finale: superati `npm test`, `npm run test:rapido`, `npm run e2e`, `npm run test:ranked`, `npm run e2e:ranked`, `npm run sim:ranked`, `npm run ui -- --leagues` e `npm run ui`. La prova completa dell'interfaccia copre anche partite precedenti, moviola, tornei, offline, aggiornamento app e lingue, senza errori della pagina. Il primo tentativo E2E generale ha incontrato un timeout nella Briscola con CPU; la ripetizione completa è passata. Rigenerate con successo la build web e gli asset `android-app/www`; controlli sintattici JavaScript e `git diff --check` superati. APK/AAB nativo non compilato in questa verifica.

30 test automatici: riferimento Glicko, RD, squadre, tutte le sei BO3, residui/retrocessioni, piazzamenti, isolamento giochi/code/varianti, doppio consenso Duo, Solo 2v2, finestre, disconnessione/riconnessione e riarmo del timer, cooldown, pareggi, idempotenza, rollback e recupero da errore disco, persistenza, stagioni e Leggenda (limite, parità, frequenza, uscita, esclusioni). Verificati sia con SQLite sia con il fallback JSON (`node --no-experimental-sqlite --test server/ranked-test.js`).

E2E dedicato: cinque socket su server reale, squadre Duo, inviti autorizzati, intruso respinto, annullamenti vietati, promozione reale completata, arresto forzato e riavvio con SQLite, risultato applicato una volta, `localResult` ininfluente, Solo e abbandono con cooldown.

Simulazione deterministica: 600 giocatori ×500 partite =150.000 incontri, seed 73421. Modello di esiti Bradley–Terry; non riproduce la distribuzione della fortuna di ogni gioco di carte. Risultati:

- punti di grado medi per abilità bassa/media/alta/élite: 147 / 689 / 1201 / 1924;
- nessun giocatore del gruppo medio conclude in Diamante o sopra;
- successo promo 48,2% (5195 su 10778 iniziate);
- distanza rating mediana 8,0, 95° percentile 37,0 nel simulatore con avversari locali;
- 6 posti Leggenda su 600 idonei, nessun candidato oltre la soglia minima: nessuna assegnazione artificiale.

I test separati di matchmaking usano il servizio reale; questi numeri della simulazione non sono una misurazione dei tempi di attesa del servizio. La scala iniziale prudente è mantenuta: non si abbassa la soglia Leggenda soltanto per riempire i posti. Prime leghe élite vuote sono possibili. Parametri da ricalibrare con una popolazione e risultati reali, senza promettere una distribuzione già validata sul campo.

Benchmark locale Node 24/SQLite, 10.000 profili: aggiornamento Leggenda ~46 ms, lettura classifica media ~9,5 ms, salvataggio incrementale ~30 ms con una sola riga modificata. Non equivale a una prova sul telefono Termux. I profili e gli indici di ricerca restano in memoria come nell'architettura attuale; transazioni e serializzazione sono sincrone, quindi carichi molto superiori richiederanno misure e partizionamento.

## Configurazione, limiti e rilascio

- Parametri in `server/ranked-rules.js:CONFIG`; `createRanked(ctx,{config})` consente override nei test o nell'avvio. Non sono modificabili dal client. Epoca stagione da concordare prima del lancio effettivo: cambiarla a stagione iniziata cambierebbe i confini storici.
- Un solo processo autorevole deve scrivere l'archivio. Non è implementato un cluster di matchmaking distribuito.
- Protezioni contro abusi: doppio consenso, limiti Duo, esclusione CPU, regole/roster server, blocco rivincite recenti, piazzamenti prudenti, RD e penalità di abbandono. Non sono un sistema di riconoscimento certo di account secondari o collusione organizzata; restano necessarie moderazione e analisi dei dati reali.
- Le insegne stagionali sono ricompense effettive consultabili nel profilo competitivo; non aggiungono vantaggi di gioco o acquisti.
- Tutte le prove locali usano dati temporanei. La migrazione additiva viene applicata dal server al caricamento/salvataggio; il rilascio segue il normale push su `main` e i controlli CI del progetto.
- La build web/asset Android non sostituisce la verifica fisica di un APK/AAB firmato su dispositivo, né una prova di carico su Termux.

## File coinvolti

Nuovi moduli: `server/glicko2.js`, `server/ranked-rules.js`, `server/ranked.js`; prove: `server/ranked-test.js`, `server/ranked-e2e.js`, `server/ranked-simulation.js`.

Integrazione backend: `server/index.js`, `server/archivio.js`, `server/store.js`, `server/statistiche.js`, `server/tavoli.js`, `server/turni.js`, `server/messaggi-tavolo.js`, `server/messaggi-comunita.js`, `server/privacy.js`.

Frontend: `public/js/ranked.js`, `public/ranked.css`, `public/js/classifica.js`, `public/js/base.js`, `public/js/azioni.js`, `public/js/animazioni.js`, `public/js/finestre.js`, `public/index.html`, `public/sw.js`, `launcher/sw.js`.

Asset/traduzioni: `scripts/ranked-art.js`, i 33 SVG `public/art/ranked/{bronze,silver,gold,platinum,diamond,master,grandmaster,champion}-{IV,III,II,I}.svg` e `legend.svg`, `lingue/18-ranked.txt`, `public/lingue/{en,es,pt}.js`.

Verifiche/informazioni: `server/e2etest.js`, `server/uitest.js`, `server/league-ui-flow.js`, `package.json`, `.github/workflows/prove.yml`, `docs/ranked-system.md`, `docs/player-ranks.md`, `docs/league-art.md`, `README.md`.

## Presentazione dei piazzamenti

Durante i piazzamenti il frontend mostra «Non classificato», insegna neutra e progresso
partite/obiettivo (10 predefinite), senza lega, divisione o LP provvisori nelle schede e
nelle righe di classifica. Il percorso delle leghe rimane consultabile in anteprima.
Il completamento attiva «Piazzamenti completati!» anche quando viene assegnato Bronzo IV;
le variazioni intermedie della stima non attivano promozioni. Il risultato e lo storico
persistono `placementMatch`, così il riepilogo non scambia la calibrazione per LP guadagnati,
anche dopo riconnessione. Le nuove stringhe sono tradotte nelle quattro lingue.
Il rating e le regole di piazzamento non sono cambiati. Il test UI verifica stati 0/10,
9/10, assenza di LP e transizioni premature e rivelazione finale Bronzo IV.

La selezione Ranked presenta prima Coda singola / Coda Duo. La singola mostra i formati
supportati in ordine crescente (Burraco: 2, 3, 4); la Duo forza quattro giocatori e mostra
un riepilogo fisso delle due coppie. Il formato Solo viene ricordato per gioco quando si
passa alla Duo e viceversa. I giochi senza coppie non mostrano l'opzione Duo.

## Tavolo Duo e gioco nella home

La home ricorda il gioco scelto nel selettore `homeGame`; amici, computer, amichevole,
Ranked, classifica e tutorial si aprono su quel gioco. La selezione è locale al dispositivo.
Le configurazioni avanzate restano disponibili nella creazione delle partite private.

La nuova sala Duo (`server/ranked-party.js`) contiene il creatore e un amico invitato
tramite la lista amici online. Accettare l'invito occupa il secondo posto; la coda parte
soltanto dopo due conferme «Sono pronto». Gli avversari sono assegnati dal matchmaking.
Annullare la ricerca azzera entrambi i pronti; l'ospite può uscire e l'host può chiudere
la sala. Una disconnessione sospende la ricerca e azzera i pronti; dopo 120 secondi il
posto viene liberato (o la sala chiusa se manca l'host). La sala è recuperabile ricaricando
il browser, ma è effimera e va ricreata dopo un riavvio del server, senza penalità.
Il match successivo usa la normale persistenza e le protezioni Ranked già descritte.
Gli eventi legacy di invito diretto restano compatibili con i client precedenti.
