# Progressi del profilo

Le partite con computer presenti all'avvio sono allenamento: non assegnano statistiche,
storico del profilo, esperienza, avanzamenti dei trofei, serie giornaliere o punti nei campionati.
Vale anche per tavoli misti, tutorial e partite sul dispositivo online o offline.
I risultati locali in coda e quelli inviati dalle app precedenti vengono ignorati.

Le amichevoli e le classificate tra persone continuano ad assegnare progressi. Se una persona
abbandona e viene sostituita da un computer, il risultato resta valido: non si può annullare
una sconfitta abbandonando. La validità è fissata all'avvio e salvata con il tavolo.

La sfida del giorno mantiene la propria classifica separata, senza premi al profilo contro il computer.
I tornei con computer continuano ad avanzare nel tabellone, ma il trofeo del torneo richiede
un torneo interamente tra persone.

Su richiesta del proprietario tutti i progressi precedenti vengono azzerati con `PROGRESS_EPOCH = 1`:
classifica e rating, statistiche e storico, esperienza, trofei, sfide, risultati delle gare e salvataggi
locali di Avventura. Il server salva una copia completa prima della migrazione. Profili, password,
email, dispositivi, avatar di base e amicizie restano disponibili. Le cornici e i titoli sbloccati
vengono rimossi. I gruppi dei campionati rimangono, con classifiche e albo d'oro vuoti.
I vecchi tavoli e tornei vengono chiusi per impedire di ricreare progressi precedenti al reset.
L'epoca viene salvata anche nel database SQLite: i successivi riavvii conservano i nuovi progressi.
Ogni dispositivo azzera i propri salvataggi una volta sola, quando carica la nuova versione.

La difficoltà automatica dei bot continua ad adattarsi localmente e non è il livello del giocatore.
