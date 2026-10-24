# Collezione e chest — 24 ottobre 2026

Base della revisione: `fe03bba`. Richiesta del titolare: 20 oggetti per ciascuna delle cinque categorie, senza set, con 10 comuni, 6 rari, 3 epici e un leggendario. La successiva correzione esclude il premio aggiuntivo al 25%: ogni chest assegna un solo oggetto, con categoria proporzionale alla quantità di oggetti nella rarità estratta.

## Implementazione

- Catalogo condiviso di 100 cosmetici indipendenti: dorsi, cornici, tappetini, reazioni e animazioni di vittoria. Rimangono i 50 avatar, di cui quattro iniziali esclusi dalle estrazioni.
- Pool da 70/45/23/8 oggetti comuni/rari/epici/leggendari. Prima rarità, poi scelta uniforme tra oggetti; nessuna seconda estrazione di bonus. Le probabilità dettagliate sono in `../docs/chest-design.md`.
- Conferma server con possesso, salvataggio atomico, ripristino dopo errore e richieste idempotenti. Migrazione delle chest chiuse alla versione 3; le ricevute già aperte restano immutate. Gli scambi scelgono un oggetto mancante; i doppioni diventano frammenti.
- Collezione con cinque filtri, soli oggetti posseduti, anteprime, selezione e ripristino. Conservati stili base e premi precedenti. Dorsi e tappetini si applicano al tavolo; cornici visibili agli altri; reazioni con verifica del possesso e limite di frequenza; vittorie saltabili e rispettose del movimento ridotto.
- Sessanta WebP originali, 20 cornici SVG e 20 effetti canvas. Revisionate tutte le illustrazioni in gallerie; corretti tre personaggi che riprendevano eccessivamente il riferimento. Istruzioni di generazione in `../docs/cosmetics-art-prompts.json`; immagini finali in `../public/art/cosmetics/`. Gli originali di generazione restano fuori dal repository.
- Traduzioni EN/ES/PT, entrambe le cache offline v70, inventario privato per profilo, informativa dati e regole aggiornati. Nessuna pubblicazione su Play Console.

## Verifiche locali

| Controllo | Esito |
|---|---|
| `npm run test:rapido` | Passato: simulazioni, archivio, privacy, lingue e copertura offline |
| `npm run test:risultati` | Passate tutte e tre le prove, compreso l'accredito naturale delle chest |
| `npm run e2e` | Passato integralmente su server temporaneo |
| `npm run test:prerilascio` | 29 prove passate: cataloghi, distribuzione uniforme, doppioni, garanzie, concorrenza, riavvio, isolamento e salvataggio |
| `node server/uitest.js --polish` | Passato: profilo responsive, quattro avatar iniziali, tornei, tastiera e temi |
| `npm run ui` | Passato: partite, impostazioni, tornei, offline, lingue; nessun errore nella pagina |
| `node server/privacy-uitest.js` | Passato dopo aver corretto la ricreazione di una cache vuota al logout: verificata anche la rimozione di `bur_cosmetic_cache` |
| Build Pages | Passata in `_site`, dopo verifica del percorso di destinazione |
| `node server/chest-uitest.js` | Passato sulla versione finale: sei layout chest, 20 layout delle collezioni, testo enorme, ultima riga raggiungibile, tutte le 60 immagini, selezione di ogni categoria, dimensioni reali delle cornici, tutte le 20 vittorie visibili/saltabili, recupero e offline |
| Traduzioni e diff | Dizionari aggiornati, 2812 testi; nessun errore di spaziatura |
| `node server/release-ui-test.js --store` | Passato: 24 acquisizioni, nove screenshot store 1080×1920 rigenerati; hash delle sorgenti confrontati con i file finali |

Diff, file nuovi, immagini e documenti controllati prima del commit: nessuna credenziale privata, chiave di firma, database, backup o file temporaneo incluso. Nessun file ignorato aggiunto forzatamente. Il workflow esistente esegue già le prove chest estese e la suite di prerilascio aggiornata, senza avviare browser grafici in parallelo.

I test grafici sono eseguiti uno alla volta. Dati e profili delle prove sono temporanei e dimostrativi. Queste verifiche non attestano l'installazione su Android fisico, l'AAB aggiornato o la distribuzione sul server pubblico. L'AAB 1.30 rimane precedente a queste modifiche.

## Pubblicazione

Il resoconto del commit, del push e del workflow Prove è fornito a fine intervento. Il server pubblico si aggiorna soltanto dopo il superamento di Prove, alla successiva verifica automatica del telefono.
