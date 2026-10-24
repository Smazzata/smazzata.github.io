# Premi e chest — versione 3

## Aggiornamento: un solo oggetto per chest

La versione 3 sostituisce l'estrazione riservata agli avatar con un unico catalogo: 46 avatar estraibili (i quattro iniziali sono esclusi) e 100 cosmetici indipendenti. Nessun premio extra al 25% e nessun set. Ogni chest assegna **esattamente un oggetto**, oppure i frammenti corrispondenti se è già posseduto. Le ricevute precedenti restano immutabili; le chest ancora chiuse passano alle nuove regole.

Prima viene estratta la rarità; poi viene scelto uniformemente un oggetto tra tutti quelli di quella rarità, inclusi i già posseduti. Non viene estratta prima una categoria con pesi uguali.

| Tipo | Comuni | Rari | Epici | Leggendari |
|---|---:|---:|---:|---:|
| Avatar estraibili | 20 | 15 | 8 | 3 |
| Dorsi | 10 | 6 | 3 | 1 |
| Cornici | 10 | 6 | 3 | 1 |
| Tappetini | 10 | 6 | 3 | 1 |
| Reazioni | 10 | 6 | 3 | 1 |
| Vittorie | 10 | 6 | 3 | 1 |
| Totale | **70** | **45** | **23** | **8** |

Quindi, condizionatamente alla rarità, gli avatar hanno probabilità 20/70, 15/45, 8/23 e 3/8; ciascuna delle altre cinque categorie ha probabilità 10/70, 6/45, 3/23 e 1/8. Ogni singolo oggetto ha probabilità 1/70, 1/45, 1/23 o 1/8. La chest leggendaria garantisce un oggetto leggendario di qualunque categoria.

| Chest ottenuta | Frequenza | Comune | Raro | Epico | Leggendario |
|---|---:|---:|---:|---:|---:|
| Comune | 75% | 66,5% | 25% | 8% | 0,5% |
| Rara | 20% | 20% | 61,5% | 17% | 1,5% |
| Epica | 4% | 0% | 20% | 77% | 3% |
| Leggendaria | 1% | 0% | 0% | 0% | 100% |

Le garanzie a 20 e 50 aperture continuano a riferirsi alla rarità del singolo oggetto, indipendentemente dal tipo. Gli scambi scelgono uniformemente fra gli oggetti mancanti della rarità scelta, conservando costi e idempotenza. I dettagli seguenti documentano l'introduzione delle chest; dove parlano soltanto di avatar, questo aggiornamento prevale.

Il profilo salva `cosmeticOwned` e `cosmeticLoadout`, verificati dal server. Le cornici sono pubbliche nell'avatar; le reazioni sono condivise al tavolo soltanto se possedute. Dorsi, tappetini e vittorie sono preferenze personali. Gli stili base e i precedenti premi di progressione restano utilizzabili. La collezione mostra soltanto oggetti posseduti, con anteprima, selezione e ripristino dello stile base. Tutti gli elementi sono estetici e non modificano le regole.

Implementazione autorizzata il 24 ottobre 2026. Quattro chest gratuite, nessun acquisto. Regole in `server/chests.js`; immagini originali in `public/art/chests/`, istruzioni di generazione in `chest-art-prompts.json` e `chest-art-variants.json`.

## Collezione iniziale

Tutti i profili nuovi ricevono Fante di quadri, Dama di fiori, Giardiniere di fiori e Pasticciera vaniglia. Gli avatar non posseduti restano nascosti. Gli sblocchi espliciti e gli avatar già equipaggiati nei profili precedenti restano conservati. I titoli continuano a dipendere esclusivamente da livelli e trofei.

## Acquisizione gratuita

Una chest ogni 3 partite online completate con soli avversari umani registrati, massimo 2 al giorno per profilo. Nessun premio da allenamento locale, tutorial, sfida del giorno, partite annullate, rese, abbandoni o sostituzioni con bot. Il limite giornaliero si rinnova a mezzanotte Europe/Rome; il progresso parziale resta. Le partite oltre il limite non accumulano progressi. Una partita conta una sola volta, anche dopo riconnessione o riavvio. Nessun accredito retroattivo per partite precedenti alla funzione.

## Estrazione

La rarità della chest viene estratta e salvata quando la si ottiene: comune **75%**, rara **20%**, epica **4%**, leggendaria **1%**. Non si trovano altre chest dentro una chest. Ogni chest contiene un oggetto:

| Chest | Oggetto comune | Raro | Epico | Leggendario |
|---|---:|---:|---:|---:|
| Comune | 66,5% | 25% | 8% | 0,5% |
| Rara | 20% | 61,5% | 17% | 1,5% |
| Epica | 0% | 20% | 77% | 3% |
| Leggendaria | 0% | 0% | 0% | **100%** |

Versione 2, ribilanciamento richiesto dal titolare: probabilità leggendario 0,5% / 1,5% / 3% nelle chest comuni / rare / epiche. La differenza torna alla rarità principale della chest. Le nuove tabelle valgono anche per le chest ancora chiuse della versione 1; le ricevute dei premi già aperti restano immutate. Estrazione su 10000 valori interi per rappresentare esattamente le frazioni percentuali.

Prima si estrae la rarità, poi un oggetto uniforme di quella rarità, esclusi i quattro avatar iniziali. Un oggetto già posseduto è un doppione; anche un premio leggendario può essere un doppione. L'interfaccia mostra la tabella base di ogni chest e le probabilità effettive della prossima apertura, comprensive delle garanzie.

Il premio resta estetico: nessun effetto su carte, matchmaking, LP o abilità del computer. Le probabilità sono versionate e non cambiano silenziosamente.

## Doppioni e garanzie

I doppioni diventano frammenti: comune 5, raro 15, epico 50, leggendario 150. Un unico saldo gratuito; nessuna conversione in denaro. Lo scambio costa 50/150/500/1500 frammenti e assegna un oggetto casuale **mancante** della rarità scelta. Se il gruppo è completo, lo scambio è disabilitato. Gli avatar non posseduti restano nascosti.

Dopo 19 aperture consecutive senza epico o leggendario, la ventesima dà almeno un epico; dopo 49 senza leggendario, la cinquantesima dà un leggendario. Contatori globali per tutti i tipi di chest, persistenti e visibili; si azzerano anche con un premio doppione della rarità garantita. La garanzia leggendaria prevale. La garanzia epica trasferisce la probabilità dei comuni/rari agli epici, conservando quella leggendaria della chest. Gli scambi non avanzano e non azzerano i contatori. Simulazione deterministica di 10000 chest comuni con garanzie: 6453 comuni, 2384 rari, 942 epici, 221 leggendari; non sono le percentuali base promesse per ogni singola apertura.

## Flusso nell'app

Nel profilo, sotto gli avatar posseduti, un accesso «Le tue chest» con il numero di aperture disponibili e il progresso verso la prossima (0/3, 1/3, 2/3). Al raggiungimento del limite giornaliero, indicare chiaramente quando il conteggio riprende. Nessun timer per aprire una chest già guadagnata e nessuna scadenza che obblighi a collegarsi.

Prima dell'apertura mostrare probabilità, contatori di garanzia e regole dei doppioni. Il server conferma il premio, poi parte una breve animazione saltabile, diversa per rarità e rispettosa del movimento ridotto. Infine: nome, illustrazione e azioni «Usa avatar»/«Usa questo stile» oppure «Continua». Le nuove acquisizioni compaiono subito nella collezione; gli avatar mancanti restano nascosti.

Quattro illustrazioni con quattro fotogrammi ciascuna (1536×512, trasparenza WebP). Sprite chiuso/socchiuso/aperto/illuminato, luce e particelle colorate, apertura saltabile. Con animazioni disattivate o movimento ridotto il premio appare subito. Nessun timer di apertura, scadenza, acquisto, evento o valuta a pagamento.

## Persistenza e controlli

- Inventario e casualità soltanto sul server; mai fidarsi di premi o rarità inviati dal client.
- Ogni chest ha ID univoco nel profilo, tipo immutabile, data, versione e risultato. Il proprietario deriva dalla sessione autenticata.
- Apertura atomica: consumo, estrazione, frammenti, inventario e contatori salvati insieme.
- Ripetere la richiesta con lo stesso ID restituisce lo stesso risultato senza un secondo consumo.
- Offline si può consultare una copia dell'inventario; l'apertura richiede connessione.
- In caso di interruzione si recupera il risultato già salvato; l'animazione non decide il premio.
- Verificare distribuzione con simulazioni, garanzie, collezione completa, doppioni, richieste simultanee, riavvii e migrazione dei profili esistenti.

Le mutazioni sono sincrone nel processo autoritativo, con salvataggio atomico dell'intero stato SQLite/JSON prima della risposta. Gli errori di salvataggio ripristinano inventario e contatori in memoria. Un UUID per partita e un marcatore persistito impediscono accrediti doppi; se il salvataggio fallisce, il recupero deve precedere una nuova partita. Le richieste di scambio hanno un ID conservato dal client fino alla conferma, così una risposta persa non causa un nuovo addebito. Nessun parametro client può impostare premi, frammenti, rarità della chest o possesso. Cancellando il profilo si elimina anche il suo inventario e la copia locale.
