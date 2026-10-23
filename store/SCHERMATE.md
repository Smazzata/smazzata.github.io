# Screenshot della versione rifinita

Rigenerati il 23 ottobre 2026 in `schermate-rilascio/`. I nove PNG numerati sono **1080×1920**. L'interfaccia, le illustrazioni e il motore sono quelli della copia locale finale; i dati social sono risposte vuote simulate per il rendering. Non sono screenshot di una release già distribuita o una prova del multiplayer.

Selezione consigliata per la scheda italiana, in ordine:

1. `schermate-rilascio/01-home.png` — giochi e modalità disponibili al lancio.
2. `schermate-rilascio/03-burraco-tavolo.png` — allenamento Burraco con il motore locale.
3. `schermate-rilascio/05-scala40-tavolo.png` — allenamento Scala 40.
4. `schermate-rilascio/06-collezione.png` — nuova collezione illustrata di 50 avatar, 24 comuni inizialmente posseduti e filtro Solo posseduti.
5. `schermate-rilascio/08-risultato.png` — risultato di una partita dimostrativa calcolata dal motore, nessun progresso attribuito all'allenamento.
6. `schermate-rilascio/07-amici.png` — elenco amici vuoto con azione utile.
7. `schermate-rilascio/09-classifica.png` — primo accesso alle classificate, nessun giocatore o grado inventato.

`02-allenamento.png` mostra le impostazioni dell'allenamento. `04-fine-allenamento.png` verifica la resa: non è nella selezione consigliata. La prova delle rarità superiori è in `test-output/rilascio/avatar-leggendario.png`: non suggerisce che questi avatar siano già sbloccabili.

Gli screenshot precedenti in `schermate/` restano conservati, ma **non sono la selezione finale**. In particolare, non usare il vecchio screenshot Scopa, non disponibile al lancio, né le vecchie leghe o l'avviso di aggiornamento APK. Le vecchie schermate in altre lingue non sono state rigenerate in questa verifica e non vanno presentate come aggiornate.

Rigenerazione sequenziale (mai più browser contemporaneamente):

```powershell
node server/release-ui-test.js --store
```

Il resoconto leggibile da macchina è `schermate-rilascio/VERIFICA.json`; le prove responsive sono in `test-output/rilascio/`. Prima del caricamento, confrontare queste immagini con l'AAB effettivamente costruito dalla medesima versione. Nessun caricamento in Play Console eseguito.
