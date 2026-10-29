# Risorse e licenze prima della pubblicazione

Aggiornamento 29 ottobre 2026: rigenerati gli avvisi dopo body-parser 1.20.9 e qs 6.16.2; audit runtime attuale con 0 segnalazioni note. La tabella seguente conserva le evidenze di provenienza, non certifica diritti o marchi.

Verifica del 21 ottobre 2026. Questo inventario non assegna al progetto diritti che il titolare non possiede.

| Risorsa | Evidenza nel progetto | Stato |
|---|---|---|
| Nunito | `public/fonts/nunito.woff2`; copyright e OFL ufficiale in `nunito-OFL.txt` | Avviso e licenza distribuiti |
| Playfair Display | `public/fonts/playfair.woff2`; copyright e OFL ufficiale in `playfair-OFL.txt` | Avviso e licenza distribuiti; verificare eventuali modifiche e Reserved Font Name |
| QR Code Generator | `qrcode-generator`, MIT, copyright Kazuhiko Arase nel sorgente | Avviso completo in `public/licenze.html` |
| Librerie Node.js | 105 dipendenze runtime nel lockfile, inventario `licenze-dipendenze.md` | Licenze incluse negli avvisi; audit npm runtime: 0 vulnerabilità note al momento del controllo |
| Capacitor | Versione dichiarata 8.5.3; MIT ufficiale in `android-app/LICENSE-capacitor.txt` | Avviso incluso; dipendenze native finali da ricontrollare nell'AAB |
| Icona e feature graphic | Generatori `scripts/icona.js` e `scripts/make-icons.js` | Sorgente presente; conferma del titolare sull'originalità e sull'uso del nome ancora necessaria |
| Carte | Disegni e simboli in `public/js/carte.js` e CSS, senza un atlante commerciale esterno rilevato | Confermare originalità dei contributi e assenza di parti copiate da mazzi protetti |
| Insegne leghe e illustrazioni Avventura | Provenienza e prompt in `docs/league-art.md` e `docs/campaign-art.md`, generazione ImageGen documentata | Provenienza documentata; controllare diritti applicabili e somiglianze prima di pubblicare. Non sono risorse estratte da Candy Crush |
| Avatar illustrati | 50 ritratti generati individualmente con imagegen, riferimento stilistico interno Avventura; 3 sprite leggendari. Provenienza in `docs/avatar-illustrati.md`, istruzioni in `docs/avatar-prompts.json` | Asset WebP nel progetto; nessun atlante commerciale esterno aggiunto |
| Chest illustrate | Quattro sprite trasparenti generati con imagegen integrato nello stile interno Avventura; quattro pose per apertura. Prompt in `docs/chest-art-prompts.json` e `docs/chest-art-variants.json` | Asset originali ottimizzati in `public/art/chests/`; nessuna risorsa commerciale esterna |
| Emoji | Caratteri resi dal sistema/browser, non un pacchetto di immagini acquistato | Non aggiungere atlanti emoji esterni senza relativa licenza |
| Musica | Dodici partiture e sintesi Web Audio interne in `public/js/music.js`; provenienza in `musiche-originali.md` | Nessuna registrazione, campione o melodia di terzi deliberatamente utilizzata; non è una certificazione legale di unicità |

Le licenze complete si consultano nell'app attraverso il collegamento nella privacy. Per rigenerare gli avvisi dopo `npm ci`: `node scripts/licenze.js`. Il generatore fallisce se manca un testo di licenza; non sostituisce una revisione delle condizioni di uso o del codice originale.

Fonti dei file aggiunti:

- https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt
- https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/OFL.txt
- https://raw.githubusercontent.com/ionic-team/capacitor/8.5.3/LICENSE
- https://raw.githubusercontent.com/martinthomson/encrypted-content-encoding/master/LICENSE

L'inventario di software non equivale a verifica del marchio «Smazzata» nei registri né a garanzia di assenza di diritti di terzi su ogni contributo storico. Queste verifiche rimangono al titolare prima del lancio commerciale.

## Cosmetici delle chest — 24 ottobre 2026

Sessanta illustrazioni originali (20 dorsi, 20 tessuti/tappetini, 20 reazioni) generate con lo strumento immagini integrato, usando il personaggio originale Barone soltanto come riferimento di stile. Prompt in `cosmetics-art-prompts.json`. Nessun marchio o personaggio di terzi richiesto. I WebP finali sono in `public/art/cosmetics/`. Le 20 cornici SVG e le 20 animazioni canvas sono disegni procedurali originali del progetto.
