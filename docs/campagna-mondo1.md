# Il primo mondo di Smazzata

La campagna comprende 50 livelli per Burraco, 50 per Scala 40 e 50 per Ramino.
Ogni percorso ha una mappa in cinque zone da dieci tappe, un guardiano al 25 e un
antagonista finale al 50. Il tavolo, i controlli e le regole sono quelli normali.

| Gioco | Mondo | Guida | Guardiano | Antagonista |
| --- | --- | --- | --- | --- |
| Burraco | Il prato delle prime carte | Nonna Rosa | Bruno il Riccio | Il Barone di Picche |
| Scala 40 | Il borgo dei quaranta | Maestro Arturo | Nina degli Ingranaggi | Il Conte Quaranta |
| Ramino | La spiaggia delle prime mani | Capitana Marina | Pippo il Granchio | Capitan Nebbia |

## Progressione

- 1–5: azioni guidate, prima scala, tris, matta e attacco.
- 6–10: scale e scelte autonome; tutti i movimenti legali sono accettati dal 6.
- 11–20: tris/poker, più combinazioni e aperture composte nella Scala 40.
- 21–25: matte, pianificazione del turno seguente, primo boss con limite di turni.
- 26–30: giochi già presenti, attacchi e primo burraco nel Burraco.
- 31–35: raccolta degli scarti, apertura immediata con lo scarto nella Scala 40.
- 36–40: 2 naturale nel Burraco; recupero e riutilizzo del jolly negli altri giochi.
- 41–45: finali di smazzata con chiusura reale; nel Burraco il pozzetto risulta già preso.
- 46–50: finali di quattro turni, due combinazioni e tre attacchi. Il boss finale
  richiede di completare tutto entro quattro turni.

Le scene sono deterministiche e contengono tutte le 108 carte una sola volta.
Ogni livello ha una soluzione di riferimento controllata dai motori. Dopo le prime
cinque lezioni, questa soluzione serve ai suggerimenti: la vittoria dipende dagli
obiettivi osservati sullo stato reale, non da una sequenza obbligatoria di risposte.
Il computer segue mosse preparate e ricorre al motore dei bot se la mano cambia.

## Vite, tempo e aiuti

Cinque vite condivise; una vita si ricarica ogni 30 minuti. Una sconfitta in un
livello non completato costa una vita. Le ripetizioni dei livelli superati sono
allenamento gratuito. Le mosse sbagliate non tolgono vite.

Il tempo viene consumato soltanto nel turno del giocatore, con pagina visibile e
senza finestre aperte. Pausa, turno del bot e permanenza nella mappa non consumano
tempo. La mano sospesa viene salvata dopo le mosse, periodicamente e all'uscita.

La prima vittoria assegna 15 monete, un boss 100. Le ricompense non sono ripetibili.
Ogni dieci livelli si ricevono un suggerimento e un tempo extra. La dotazione
iniziale è 120 monete, tre suggerimenti, due allenatori e due tempi extra.

La bottega usa esclusivamente monete della campagna: suggerimento 40, allenatore
80, tempo extra 30, una vita 60. Il tempo extra aggiunge 30 secondi, al massimo
due volte per tentativo. L'allenatore rivela le azioni di un turno; il suggerimento
evidenzia una mossa per 20 secondi. Nessun pagamento reale o pubblicità è simulato.
Per introdurre ricompense pubblicitarie o acquisti reali serviranno i rispettivi
provider e le configurazioni dello store.

I personaggi hanno ritratti SVG, dialoghi e lettura facoltativa con la voce del
dispositivo. La voce viene attivata dal giocatore. I progressi sono locali e non
modificano classifiche, Elo o statistiche delle partite normali.

## Verifica

`npm run test:campagna` prova i 150 livelli, tutte le soluzioni, la conservazione
delle carte, mosse alternative, chiusure, salvataggi, vite e ricompense.
`node server/uitest.js --campaign` verifica sul tavolo normale scene di tutti i
capitoli, entrambi i boss dei tre giochi, timer, pausa, sconfitta, ripresa dopo
ricaricamento, aiuti, bottega, modalità offline e schermo da 320 pixel.
