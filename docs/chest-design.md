# Premi e monete — versione 4

Economia autorizzata dal titolare dopo la simulazione in `store/ECONOMIA-SIMULAZIONI-2026-10-25.md`. Una sola ricompensa per chest, monete gratuite oppure un oggetto. Nessuna vendita in denaro implementata.

## Probabilità base assolute per apertura

| Chest | Monete | Comune | Raro | Epico | Leggendario |
|---|---:|---:|---:|---:|---:|
| Comune | 70% | 20% | 7% | 2,5% | 0,5% |
| Rara | 45% | 10% | 35,5% | 8% | 1,5% |
| Epica | 20% | 0% | 15% | 62% | 3% |
| Leggendaria | 0% | 0% | 0% | 0% | 100% |

Tipi di chest ottenuta: 75/20/4/1. Quantità quando escono monete: 30 comune, 80 rara, 200 epica. Le probabilità non sono esposte nelle schermate del gioco, secondo indicazione del titolare.

Garanzie dopo 19 aperture senza epico o superiore e 49 senza leggendario: alla successiva apertura si assegna l'oggetto garantito, anche se normalmente potevano uscire monete. Gli acquisti diretti non modificano i contatori.

Il catalogo estraibile ha 146 oggetti: 70 comuni, 45 rari, 23 epici, 8 leggendari. Quattro avatar iniziali esclusi dalle estrazioni. All'interno della rarità ogni oggetto ha la stessa probabilità, senza estrarre prima la categoria. I cento cosmetici restano divisi in cinque categorie, ciascuna con 10/6/3/1 oggetti; gli avatar estraibili sono 20/15/8/3.

## Acquisti diretti e doppioni

| Rarità | Prezzo | Monete per doppione |
|---|---:|---:|
| Comune | 600 | 30 |
| Rara | 1.800 | 90 |
| Epica | 6.000 | 300 |
| Leggendaria | 18.000 | 900 |

La Collezione permette di scegliere l'oggetto preciso. Mostra prezzo e saldo, richiede conferma e non equipaggia automaticamente. Prezzo e possesso sono verificati dal server. Una ricevuta persistente rende idempotente il recupero dopo una risposta persa; riutilizzare l'identificatore per un oggetto differente è rifiutato. Saldo, oggetto e ricevuta vengono salvati insieme, con rollback completo su errore. Nessun acquisto da copia offline, nessun acquisto di chest o di monete con denaro.

I doppioni dei regali amministrativi usano la stessa tabella di monete. Equipaggiamento e azzeramento dello stile restano gratuiti.

## Come si guadagna

- Cinque monete per ciascuna delle prime tre partite umane valide al giorno; massimo quindici da questa fonte.
- Una chest giornaliera dopo due partite valide, massimo una al giorno.
- Settimana: tre partite 100 monete; due giorni 100; due giochi 150; tre partite con amici una chest rara.
- Mese: dieci tappe ogni tre partite, con premi 50 monete / comune / 100 monete / 100 monete / comune / 150 monete / 150 monete / rara / 200 monete / epica.
- Weekend: chest rara dopo tre partite; ricordi permanenti invariati.

Calendario Europe/Rome. Nessun premio per allenamento, tutorial, offline, resa, identità duplicate, tavoli con computer o classificate abbandonate. I contatori e gli accrediti sono autoritativi, con salvataggio atomico per tutti i profili partecipanti e nessun doppio accredito dopo ripetizione o riavvio.

## Migrazione

Il titolare ha dichiarato che nessun account ha raccolto frammenti e ne ha chiesto la rimozione senza conversione. L'archivio attivo e le ricevute vengono ripuliti dai vecchi campi; l'API degli scambi è rimossa. Nessuna conversione 12:1.

Le chest già possedute di versione 1/2/3 conservano la precedente estrazione di un oggetto; le nuove sono versione 4. Gli oggetti posseduti e le consegne già avvenute restano conservati. Tappe mensili e obiettivi settimanali già completati prima dell'aggiornamento non attribuiscono nuovamente monete e mantengono il premio storico nella vista.

I resoconti datati delle simulazioni restano documenti storici. Il relativo simulatore usa calendari congelati al commit f9a0eff, separati dall'economia attiva. `server/economy-v4-test.js` confronta invece l'economia attuale con la variante raccomandata a 30/90/180 giorni.
