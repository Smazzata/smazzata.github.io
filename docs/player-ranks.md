# Gradi visibili ai giocatori

> **Sistema attuale:** [Ranked Glicko-2, Solo/Duo, LP, divisioni e stagioni](ranked-system.md).
> Le soglie sotto documentano esclusivamente il precedente sistema Elo, conservato per i dati storici e i tavoli già avviati prima dell'aggiornamento. Non governano le nuove Ranked.

L'Elo rimane il valore interno per gli abbinamenti e l'ordinamento della classifica.
L'interfaccia mostra solo il grado, distinto per ciascun gioco, senza numeri o variazioni numeriche a fine partita.
Le amichevoli non cambiano il grado. Livello esperienza e cornici del profilo sono indipendenti.

La precedente implementazione prevedeva le leghe future ma non definiva soglie. Questa prima scala è definita
in `PLAYER_RANKS` in `public/js/base.js` e può essere calibrata sulla distribuzione reale dei giocatori.

| Grado | Soglia interna inclusa |
| --- | ---: |
| Bronzo | meno di 1100 |
| Argento | 1100 |
| Oro | 1250 |
| Platino | 1400 |
| Diamante | 1600 |
| Maestro | 1800 |
| Leggenda | 2000 |

Il valore iniziale 1000 corrisponde a Bronzo. Le statistiche mostrano anche il grado migliore quando superiore
al corrente. A fine classificata viene mostrato il grado aggiornato e una celebrazione in caso di promozione.
