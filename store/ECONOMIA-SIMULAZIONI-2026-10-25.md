# Monete, chest e durata della collezione — proposta simulata

Analisi del 25 ottobre 2026, base applicativa `ab4e399`. Nessuna modifica ai premi attivi. Simulatore riproducibile: `node scripts/simulate-economy.js`; risultati completi in `SIMULAZIONE-ECONOMIA-2026-10-25.json`.

## Metodo e limiti

162.000 traiettorie: 3.000 per combinazione di tre calendari, sei economie e tre strategie d'acquisto, ciascuna osservata a 30/90/180 giorni. Calendario dal 1 novembre 2026; i premi sono generati dai moduli reali chests, weekly-rewards e player-journey. Le estrazioni e le scelte degli oggetti usano un generatore deterministico; non vengono giocate partite del motore né misurati comportamento reale o fidelizzazione.

Catalogo: 146 oggetti estraibili, oltre ai quattro avatar iniziali: 70 comuni, 45 rari, 23 epici, 8 leggendari. Profili nuovi, circa metà vittorie, giochi alternati tra i quattro disponibili; frequenze di partite con amici ipotizzate al 25/35/50%. Le sessioni considerate sono partite umane valide. Nessun premio da allenamento, pubblicità, acquisto in denaro o regalo amministrativo. Non sono modellati abbandoni, tempi delle partite e migrazione di saldi preesistenti.

| Profilo | Calendario | Partite nei primi 30 giorni |
|---|---|---:|
| Occasionale | Martedì e sabato, due partite | 16 |
| Regolare | Lunedì, martedì, mercoledì, venerdì e sabato, due partite | 42 |
| Assiduo | Quattro partite ogni giorno | 120 |

Sono calendari campione, non stime del pubblico. Con questi orari i primi due profili non completano tre partite nello stesso weekend: la differenza è inclusa nei risultati. Confini delle settimane e mesi reali, compresi periodi parziali, spiegano quantità non uniformi di premi.

## Ispirazione da Clash Royale

Le fonti ufficiali descrivono oro nelle ricompense di battaglia e nei percorsi, acquisti mirati e Lucky Chests che possono dare oro oppure altri premi. È utile riprendere l'alternanza tra avanzamento prevedibile e sorpresa, non i prezzi: le carte di Clash Royale hanno anche potenziamenti, mentre i nostri cosmetici si sbloccano una volta sola.

- [Gems & Gold — Supercell](https://support.supercell.com/clash-royale/en/articles/gems-and-gold-8.html)
- [Probabilità delle Lucky Chests — Supercell](https://support.clashroyale.com/hc/en-us/articles/49484957630619-Information-About-Discounts-Offers-and-Drop-Rates)
- [Shop Offers — Supercell](https://support.clashroyale.com/hc/en-us/articles/49484889956251-Shop-Offers)

## Risultati

Media dei **nuovi oggetti distinti**, esclusi i quattro iniziali, acquistando prima quelli economici mancanti. Doppioni e acquisti sono inclusi. Ogni cella riporta 30 / 90 / 180 giorni, arrotondati.

| Profilo | Economia attuale | Monete, prezzi 400/1200/4000/12000 e meno chest | Variante raccomandata |
|---|---:|---:|---:|
| Occasionale | 29 / 69 / 114 | 12 / 33 / 62 | **9 / 23 / 45** |
| Regolare | 48 / 109 / 140 | 24 / 63 / 107 | **19 / 52 / 90** |
| Assiduo | 62 / 126 / 144 | 34 / 81 / 127 | **28 / 69 / 117** |

L'economia attuale non permette di ottenere tutto in un mese nei calendari esaminati, ma si avvicina alla saturazione in sei mesi: 5,43% delle simulazioni assidue completano il catalogo. Nella variante raccomandata nessuna delle traiettorie esaminate lo completa entro 180 giorni; questo non prova che sia impossibile.

Dispersione della variante raccomandata: il 10°–90° percentile a 180 giorni è 41–50 oggetti per l'occasionale, 85–95 per il regolare e 112–122 per l'assiduo. Sono intervalli della simulazione, non previsioni su persone reali.

Il risultato dipende dagli acquisti: risparmiando esclusivamente per i leggendari, il regolare ottiene circa 59 oggetti in sei mesi, contro 90 privilegiando gli economici. Nessun acquisto: circa 58. Le strategie simulate sono estremi utili per stressare l'economia; non rappresentano la scelta media dei giocatori.

## Probabilità raccomandate

Una sola ricompensa per chest: monete oppure un oggetto. Questa tabella contiene **probabilità assolute per apertura**, prima delle garanzie; tutte le righe sommano a 100%.

| Chest | Monete | Oggetto comune | Raro | Epico | Leggendario |
|---|---:|---:|---:|---:|---:|
| Comune | 70% | 20% | 7% | 2,5% | **0,5%** |
| Rara | 45% | 10% | 35,5% | 8% | **1,5%** |
| Epica | 20% | 0% | 15% | 62% | **3%** |
| Leggendaria | 0% | 0% | 0% | 0% | **100%** |

Tipi di chest ottenuta invariati: comune 75%, rara 20%, epica 4%, leggendaria 1%. Premi con tipo prestabilito mantengono quel tipo. Una volta estratta la rarità dell'oggetto, selezione uniforme nel catalogo di quella rarità, mantenendo il peso delle categorie proporzionale alla loro quantità di oggetti.

La precedente idea «70% monete, altrimenti usa le vecchie probabilità» abbasserebbe il leggendario della comune allo 0,15% complessivo. La tabella raccomandata evita questo effetto: conserva lo 0,5/1,5/3% richiesto dal titolare.

Garanzie già esistenti conservate: dopo 19 aperture senza epico o superiore, la successiva dà epico o leggendario; dopo 49 senza leggendario, la successiva dà un leggendario. Anche le aperture con monete contano: quando scatta la garanzia non possono dare solo monete. Gli acquisti non avanzano o azzerano i contatori. Le frequenze effettive nel lungo periodo sono quindi diverse dalle probabilità base della tabella.

## Valori e prezzi raccomandati

| Chest quando escono monete | Quantità |
|---|---:|
| Comune | 30 |
| Rara | 80 |
| Epica | 200 |
| Leggendaria | Sempre oggetto |

| Rarità dell'oggetto | Acquisto diretto | Doppione convertito in monete |
|---|---:|---:|
| Comune | **600** | 30 |
| Rara | **1.800** | 90 |
| Epica | **6.000** | 300 |
| Leggendaria | **18.000** | 900 |

Stesso prezzo per rarità in tutte le categorie. Acquisto di un oggetto preciso mancante dalla Collezione, senza estrazione né costo di equipaggiamento. La simulazione non prevede monete acquistabili in denaro o reinvestibili in chest.

In sei mesi il profilo regolare della variante raccomandata guadagna circa 22.700 monete totali, inclusi doppioni, e ne spende quasi tutte con la strategia economica. Nei primi 30 giorni circa 3.560: consente alcuni acquisti comuni o uno raro, mentre epici e leggendari richiedono risparmio. Non sono monete tutte disponibili contemporaneamente.

## Distribuzione dei premi simulata nella variante raccomandata

- Giornaliero: chest ogni due partite valide, massimo una al giorno, come ora.
- Partite: cinque monete per ciascuna delle prime tre partite umane valide del giorno, senza premio per vittoria aggiuntivo. Massimo quindici monete al giorno da questa fonte.
- Settimana: obiettivo tre partite → 100 monete; due giorni → 100; due giochi → 150; tre partite con amici → chest rara.
- Weekend: chest rara dopo tre partite, invariato.
- Mese, dieci tappe ogni tre partite: **50 monete / chest comune / 100 monete / 100 monete / chest comune / 150 monete / 150 monete / chest rara / 200 monete / chest epica**.
- Ricordi una tantum invariati. Nessun reset dei ricordi al mese nuovo.

Quindi non basta aggiungere monete alle chest: una parte delle chest degli obiettivi diventa direttamente valuta. Nel calendario assiduo le chest dei primi 30 giorni scendono da 74 a 52, nel regolare da 55 a 36. Si conserva la ricompensa frequente, cambiandone il contenuto.

## Migrazione e decisione prima dell'implementazione

Convertire i frammenti esistenti a **12 monete per frammento** conserva il loro potere d'acquisto: i prezzi precedenti 50/150/500/1500 diventano esattamente 600/1800/6000/18000. Conservare oggetti, premi già assegnati e ricevute. I futuri doppioni renderebbero il 5% del prezzo, invece del 10% attuale.

Proposta prudente: nuove regole soltanto sulle chest guadagnate dopo l'attivazione, mantenendo il contenuto oggetto delle chest già possedute. Effetto di questi saldi e inventari pregressi escluso dalle simulazioni dei nuovi profili; richiede una prova di migrazione distinta.

La variante raccomandata prolunga il catalogo e conserva scelte acquistabili. Prima di trattarla come definitiva, provare le aperture con giocatori: il 70% di monete nelle comuni può risultare poco emozionante anche se matematicamente bilanciato. Non dedurre ritorno o soddisfazione dai numeri. Eventuali nuove protezioni contro sequenze di sole monete andrebbero simulate separatamente.
