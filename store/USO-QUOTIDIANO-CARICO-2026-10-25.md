# Uso quotidiano, molti profili e carico — 25 ottobre 2026

Richiesta: centinaia di prove di uso quotidiano, partite e chest con molti profili; capacità del server. Il titolare ha precisato «Per ora esegui solo le prove sul PC». Nessun carico o account di prova sul servizio pubblico e nessuna conclusione sulla capacità del telefono.

## Esiti funzionali

- **400 partite intere**, 100 per Burraco, Scala 40, Ramino e Canasta: **2.690 smazzate, 182.693 mosse, 1.142 ripristini**. Mazzi e casualità dei computer riproducibili (seme 25102026); vincitori, carte uniche, carte conservate e viste private verificati. Nessun errore; 519 secondi.
- **240 profili** con due chiavi dispositivo e fino a **480 socket**. Quattordici giorni simulati, **6.720 eventi di completamento**, 240 eventi di allenamento esclusi, **720 aperture uniche**, 720 richieste ripetute recuperate senza doppio consumo, 120 scambi concorrenti idempotenti, 240 equipaggiamenti, 240 equipaggiamenti non posseduti rifiutati e 240 riconnessioni. Dopo riavvio, inventari e ricevute identici. Il provisioning dei profili e dei frammenti per gli scambi è una fixture nell'archivio temporaneo; le operazioni successive passano dalle API vere. Gli eventi di completamento non sono altre 6.720 partite intere.
- **100 cicli nel browser**, **910 tocchi sui controlli visibili**, 100 aperture di chest, 10 avvii di allenamento nei quattro giochi e 10 passaggi offline simulati. Schermi 320/375/414 px, due temi e testo normale/enorme. Nessun errore JavaScript rilevato. Non è un test con persone reali.
- **60 iscrizioni complete** con conferma email locale simulata, **120 accessi**, 60 password errate rifiutate e 60 profili recuperati dopo riavvio. Nessuna email reale.

## Carico misurato sul PC

Intel Core 7 240H, 16 processori logici, Node 24 su Windows. Ogni tavolo ha due profili collegati e due computer eseguiti dal server. I client pescano/scartano con pause di 300/500 ms e danno il pronto tra le smazzate. Allestimento verificato prima di misurare: niente successi apparenti con tavoli non avviati. Altri test pesanti fermi durante i benchmark.

| Tavoli | Profili collegati | Computer | Durata misurata | Mosse | Risposta p95 | RAM massima server |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 20 | 20 | 30 s | 191 | 4,2 ms | 105 MB |
| 25 | 50 | 50 | 30 s | 457 | 6,6 ms | 203 MB |
| 50 | 100 | 100 | 30 s | 929 | 8,7 ms | 213 MB |
| 100 | 200 | 200 | 30 s | 1.856 | 15,0 ms | 300 MB |
| 50 | 100 | 100 | 180 s | 5.415 | 26,8 ms | 250 MB |

Nessuna mossa rifiutata né crash nelle cinque prove. Con 100 tavoli: massimo 41,7 ms di risposta e ritardo del ciclo eventi p99 massimo 44,3 ms. Nella prova di tre minuti: massimo 140,6 ms di risposta, ritardo p99 massimo 64,7 ms, memoria finale 249 MB. CPU massima del processo rispettivamente 39% e 61% (non la percentuale di utilizzo di tutti i core del PC).

Il budget indicativo di questa prova è p95 delle risposte entro 250 ms, ritardo eventi p99 entro 100 ms e zero rifiuti. Tutte le prove rientrano. Non è una capacità certificata del telefono: localhost non include Internet, tunnel, risparmio energetico, temperatura o batteria. Tre minuti non provano l'assenza di perdite di memoria per ore. Non fissare limiti di produzione del telefono usando questi numeri.

## Ripetibilità

- `npm run test:partite -- 400 25102026`
- `npm run test:quotidiano:server` (240 profili, 14 giorni)
- `npm run test:quotidiano:ui` (100 cicli, massimo 120)
- `npm run test:iscrizioni` (60 iscrizioni)
- `npm run load -- 10 30`, poi 25, 50 e 100 tavoli in sequenza
- `npm run load -- 50 180`

Tutti i server di prova hanno archivio temporaneo e URL locale fisso. MAIL_TEST impedisce invii reali; IP_LIMIT viene aumentato solo nelle prove per non simulare centinaia di utenti come tentativi dello stesso indirizzo. Chiavi dispositivo, password e archivi non sono nel resoconto o nel commit. I report grezzi restano in test-output, ignorato da Git; riepilogo strutturato privo di credenziali in VERIFICA-USO-QUOTIDIANO-2026-10-25.json.

La CI ora include 120 profili per sette giorni, 12 iscrizioni e 20 cicli del browser. Stesso codice con scala ridotta; nessuna scorciatoia alle verifiche di proprietà o persistenza.

Completati anche i 70 test di prerilascio, le quattro prove di stress (1.800 eventi inventario, 40.000 estrazioni e 96 smazzate motore) e l’e2e multigiocatore: tutti superati. Nessuna regressione funzionale rilevata nei percorsi esercitati; questo non esclude difetti fuori dagli scenari provati.

Nei 100 cicli UI le animazioni sono disattivate per accelerare la ripetizione. I passaggi offline del ciclo impostano lo stato client; le disconnessioni Socket.IO reali sono nella prova dei profili. La verifica finale conferma 480 socket ancora connessi prima del riavvio, oltre al numero di client creati.

Superate inoltre l’apertura con animazioni e quattro rarità (--rewards), la prova di primo uso a 320 px con riconnessione e 9 tocchi visibili, e le configurazioni CI ridotte (12 iscrizioni, 20 cicli UI).
