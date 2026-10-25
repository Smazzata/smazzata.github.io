# Carte pescate e verifica dei percorsi

Base `1326508`, il cui workflow Prove `40213197864` è risultato riuscito. Client `2026.10.25.7`; entrambe le cache `v87`.

Le nuove carte della propria mano sono evidenziate per tre secondi dopo una pesca dal mazzo o una raccolta dagli scarti confermata. Il contorno non seleziona carte, non modifica la loro posizione e resta visibile anche senza animazioni. Alto contrasto supportato. Un ridisegno non prolunga il tempo; cambio smazzata/partita, accesso iniziale e cambio posto non simulano pescate. La pesca avversaria non evidenzia né espone carte nascoste.

La prova browser usa una pesca reale dal motore locale e una vista dimostrativa di raccolta multipla; verifica ridisegno, scadenza di entrambe, selezione invariata e alto contrasto. Il test dei segnali verifica anche pesca multipla, raccolta, duplicati, nuova smazzata e cambio posto. Nessuna modifica a regole, premi o probabilità.

Controllati nuovamente progressi, ricordi e inventario su 320/375/768 px, due temi e testo grande: prove `--journey` e `--simple` riuscite. Prova della lente e della nuova pescata `--comfort` riuscita. `npm run anim` riuscito, con atterraggio delle carte e rifiuto delle mosse non valide.

`npm run test:rapido`, `npm run test:prerilascio` (73 controlli) e `npm run e2e` riusciti. `release-ui-test.js --store`: 34 scene riuscite, screenshot rigenerati e hash delle 151 fonti finali verificati. Queste prove coprono gli scenari eseguiti, senza attestare l'assenza assoluta di difetti.

Il titolare ha comunicato che Google ha confermato l'identità: checklist aggiornata senza dedurre l'approvazione dell'app o lo stato degli altri passaggi in Console. Nessun accesso o pubblicazione su Play Console. Le prove locali sono sul PC, non su Android fisico né sul server del telefono.
