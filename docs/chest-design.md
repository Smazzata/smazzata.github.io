# Premi e chest — versione 2

Implementazione autorizzata il 24 ottobre 2026. Quattro chest gratuite, nessun acquisto. Regole in `server/chests.js`; immagini originali in `public/art/chests/`, istruzioni di generazione in `chest-art-prompts.json` e `chest-art-variants.json`.

## Collezione iniziale

Tutti i profili nuovi ricevono Fante di quadri, Dama di fiori, Giardiniere di fiori e Pasticciera vaniglia. Gli avatar non posseduti restano nascosti. Gli sblocchi espliciti e gli avatar già equipaggiati nei profili precedenti restano conservati. I titoli continuano a dipendere esclusivamente da livelli e trofei.

## Acquisizione gratuita

Una chest ogni 3 partite online completate con soli avversari umani registrati, massimo 2 al giorno per profilo. Nessun premio da allenamento locale, tutorial, sfida del giorno, partite annullate, rese, abbandoni o sostituzioni con bot. Il limite giornaliero si rinnova a mezzanotte Europe/Rome; il progresso parziale resta. Le partite oltre il limite non accumulano progressi. Una partita conta una sola volta, anche dopo riconnessione o riavvio. Nessun accredito retroattivo per partite precedenti alla funzione.

## Estrazione

La rarità della chest viene estratta e salvata quando la si ottiene: comune **75%**, rara **20%**, epica **4%**, leggendaria **1%**. Non si trovano altre chest dentro una chest. Ogni chest contiene un avatar:

| Chest | Avatar comune | Raro | Epico | Leggendario |
|---|---:|---:|---:|---:|
| Comune | 66,5% | 25% | 8% | 0,5% |
| Rara | 20% | 61,5% | 17% | 1,5% |
| Epica | 0% | 20% | 77% | 3% |
| Leggendaria | 0% | 0% | 0% | **100%** |

Versione 2, ribilanciamento richiesto dal titolare: probabilità leggendario 0,5% / 1,5% / 3% nelle chest comuni / rare / epiche. La differenza torna alla rarità principale della chest. Le nuove tabelle valgono anche per le chest ancora chiuse della versione 1; le ricevute dei premi già aperti restano immutate. Estrazione su 10000 valori interi per rappresentare esattamente le frazioni percentuali.

Prima si estrae la rarità dell'avatar, poi un avatar uniforme di quella rarità, esclusi i quattro iniziali. Un avatar già posseduto è un doppione; anche un premio leggendario può essere un doppione. L'interfaccia mostra la tabella base di ogni chest e le probabilità effettive della prossima apertura, comprensive delle garanzie.

Il premio resta estetico: nessun effetto su carte, matchmaking, LP o abilità del computer. Le probabilità sono versionate e non cambiano silenziosamente.

## Doppioni e garanzie

I doppioni diventano frammenti: comune 5, raro 15, epico 50, leggendario 150. Un unico saldo gratuito; nessuna conversione in denaro. Lo scambio costa 50/150/500/1500 frammenti e assegna un avatar casuale **mancante** della rarità scelta. Se il gruppo è completo, lo scambio è disabilitato. Gli avatar non posseduti restano nascosti.

Dopo 19 aperture consecutive senza epico o leggendario, la ventesima dà almeno un epico; dopo 49 senza leggendario, la cinquantesima dà un leggendario. Contatori globali per tutti i tipi di chest, persistenti e visibili; si azzerano anche con un premio doppione della rarità garantita. La garanzia leggendaria prevale. La garanzia epica trasferisce la probabilità dei comuni/rari agli epici, conservando quella leggendaria della chest. Gli scambi non avanzano e non azzerano i contatori. Simulazione deterministica di 10000 chest comuni con garanzie: 6453 comuni, 2384 rari, 942 epici, 221 leggendari; non sono le percentuali base promesse per ogni singola apertura.

## Flusso nell'app

Nel profilo, sotto gli avatar posseduti, un accesso «Le tue chest» con il numero di aperture disponibili e il progresso verso la prossima (0/3, 1/3, 2/3). Al raggiungimento del limite giornaliero, indicare chiaramente quando il conteggio riprende. Nessun timer per aprire una chest già guadagnata e nessuna scadenza che obblighi a collegarsi.

Prima dell'apertura mostrare probabilità, contatori di garanzia e regole dei doppioni. Il server conferma il premio, poi parte una breve animazione saltabile, diversa per rarità e rispettosa del movimento ridotto. Infine: nome, ritratto e azioni «Usa avatar» oppure «Continua». Le nuove acquisizioni compaiono subito nella collezione; gli avatar mancanti restano nascosti.

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
