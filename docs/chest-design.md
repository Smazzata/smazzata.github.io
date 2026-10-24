# Premi e chest — proposta per il rilascio

Stato: specifica di progetto; nessuna chest, valuta o assegnazione casuale è attiva.

## Collezione iniziale

Tutti i profili nuovi ricevono Fante di quadri, Dama di fiori, Giardiniere di fiori e Pasticciera vaniglia. Gli avatar non posseduti restano nascosti. Gli sblocchi espliciti e gli avatar già equipaggiati nei profili precedenti restano conservati. I titoli continuano a dipendere esclusivamente da livelli e trofei.

## Acquisizione gratuita

Proposta: una chest ogni 3 partite online completate con avversari umani, massimo 2 al giorno. Nessun premio per allenamento locale, partite annullate o sconfitte assegnate per abbandono. Una partita conta una volta sola, anche dopo riconnessione o riavvio. Nessun acquisto di chest nella prima versione.

## Estrazione

Proposta iniziale da bilanciare: comune 65%, raro 25%, epico 8%, leggendario 2%. L'interfaccia deve mostrare le probabilità prima dell'apertura. Prima si estrae la rarità, poi un avatar uniforme di quella rarità, escludendo i quattro iniziali. Se quel gruppo non contiene avatar mancanti, il risultato diventa un doppione.

Il premio resta estetico: nessun effetto su carte, matchmaking, LP o abilità del computer. Le probabilità sono versionate e non cambiano silenziosamente.

## Doppioni e garanzie

Proposta: doppioni convertiti in frammenti (comune 5, raro 15, epico 50, leggendario 150). Scambio per un avatar mancante a 50/150/500/1500 frammenti della rispettiva rarità. La schermata di scambio può mostrare solo la rarità e assegnare casualmente un avatar mancante, mantenendo nascosti gli avatar non posseduti.

Proposta di garanzia: dopo 19 aperture consecutive senza epico o leggendario, la ventesima dà almeno un epico; dopo 49 senza leggendario, la cinquantesima dà un leggendario. La garanzia leggendaria prevale. I contatori sono persistenti e visibili. Le probabilità effettive con le garanzie richiedono simulazione prima dell'attivazione.

## Flusso proposto nell'app

Nel profilo, sotto gli avatar posseduti, un accesso «Le tue chest» con il numero di aperture disponibili e il progresso verso la prossima (0/3, 1/3, 2/3). Al raggiungimento del limite giornaliero, indicare chiaramente quando il conteggio riprende. Nessun timer per aprire una chest già guadagnata e nessuna scadenza che obblighi a collegarsi.

Prima dell'apertura mostrare probabilità, contatori di garanzia e regole dei doppioni. Il server conferma il premio, poi parte una breve animazione saltabile, diversa per rarità e rispettosa del movimento ridotto. Infine: nome, ritratto e azioni «Usa avatar» oppure «Continua». Le nuove acquisizioni compaiono subito nella collezione; gli avatar mancanti restano nascosti.

Priorità proposta: prima un solo tipo di chest gratuita con queste regole; eventi, chest speciali, acquisti e valute a pagamento restano fuori dalla prima versione. Va approvato il bilanciamento prima dell'attivazione.

## Persistenza e controlli da implementare

- Inventario e casualità soltanto sul server; mai fidarsi di premi o rarità inviati dal client.
- Ogni chest ha ID univoco, proprietario, stato e versione della tabella premi.
- Apertura atomica: consumo, estrazione, frammenti, inventario e contatori salvati insieme.
- Ripetere la richiesta con lo stesso ID restituisce lo stesso risultato senza un secondo consumo.
- Offline si può consultare una copia dell'inventario; l'apertura richiede connessione.
- In caso di interruzione si recupera il risultato già salvato; l'animazione non decide il premio.
- Verificare distribuzione con simulazioni, garanzie, collezione completa, doppioni, richieste simultanee, riavvii e migrazione dei profili esistenti.

L'attivazione richiede implementazione e bilanciamento separati. Questi valori sono una proposta, non promesse già mostrate ai giocatori.
