# Avventura: giardino, borgo e baia

La direzione visiva approvata è applicata ai primi 50 livelli di ognuno dei tre giochi: Burraco, Scala 40 e Ramino. Ogni percorso ha una mappa illustrata, tre personaggi con tre pose ciascuno, dialoghi a tema e una serie di oggetti collezionabili con il medaglione della propria guida.

## Sospensione per la preparazione Play Store

Avventura è temporaneamente nascosta dalla home, sia online sia offline, tramite `CAMPAIGN_VISIBLE = false` in `public/js/base.js`. Il codice, le illustrazioni e i salvataggi della campagna rimangono intatti. Per ripristinare la voce si riporta la costante a `true`. Le prove dedicate possono continuare ad aprire la campagna direttamente attraverso i suoi gestori interni.

La plancia degli aiuti conserva quattro elementi: tempo, mossa suggerita, guida del turno e tempo extra. Gli aiuti hanno etichette visibili, quantità separate e superfici toccabili di almeno 48 px. Gli obiettivi sono nel fumetto; la pausa è nella barra superiore e il ritorno alla mappa nel menu del tavolo.

Il giardino di Burraco conserva Rosa, Bruno e il Barone di Picche. Il borgo di Scala 40 è costruito con botteghe, orologi e ingranaggi dei quattro semi: Arturo accompagna il giocatore, Nina presidia la porta e il Conte Quaranta controlla la torre. La baia di Ramino usa isole, pontili, velieri di carte e un faro: Marina guida il viaggio, Pippo sorveglia il molo e Capitan Nebbia aspetta al faro.

Le mappe e le introduzioni usano la rispettiva ambientazione anche al tavolo. Le battute cambiano per zona e il boss finale cita la propria destinazione. Gli avversari mantengono il proprio nome nei primi livelli e nei tentativi ripresi, senza alternare nomi generici sulla stessa illustrazione. Regole, obiettivi, progressi e ricompense restano quelli delle partite esistenti.

## Risorse

Le cinque illustrazioni originali sono state prodotte con lo strumento integrato ImageGen, usando come riferimento il concept approvato nella conversazione. Non sono screenshot del prodotto né risorse estratte da altri giochi.

File distribuiti in `public/art/campaign/`:

| File | Contenuto | Formato |
| --- | --- | --- |
| garden.webp | Giardino con sentiero, ponti di carte e castello di picche | 941 × 1672 |
| rosa.webp | Rosa: attesa, spiegazione, celebrazione | 2172 × 724, alpha |
| bruno.webp | Riccio: attesa, sfida, sorpresa | 2172 × 724, alpha |
| barone.webp | Barone: attesa, sfida, sconfitta | 2172 × 724, alpha |
| boosters.webp | Bacchetta jolly, cronometro, medaglione, vita | 2172 × 724, alpha |

Estensione agli altri due mondi, generata con ImageGen integrato usando le illustrazioni di Burraco come riferimento stilistico:

| Risorsa | Contenuto |
| --- | --- |
| clockwork.webp | Borgo degli orologi e torre di Quaranta |
| arturo.webp | Arturo: attesa, spiegazione, celebrazione |
| nina.webp | Nina: attesa, sfida, reazione |
| conte.webp | Conte Quaranta: attesa, sfida, sconfitta |
| bay.webp | Baia, pontili e faro nella nebbia |
| marina.webp | Marina: attesa, spiegazione, celebrazione |
| pippo.webp | Pippo: attesa, sfida, reazione |
| nebbia.webp | Capitan Nebbia: attesa, sfida, sconfitta |
| boosters-scala40.webp | Aiuti con medaglione di Arturo |
| boosters-ramino.webp | Aiuti con medaglione di Marina |

I prompt completi dell’estensione sono in `docs/campaign-worlds-prompts.json`. Le sprite restano trasparenti, con tre pose orizzontali per personaggio e quattro celle per gli aiuti. I service worker comprendono tutte le nuove immagini anche nella copia Pages/Android.

I PNG generati sono stati esportati in WebP a qualità 86, preservando la trasparenza. Le cinque risorse pesano complessivamente circa 1,9 MB. Personaggi in tre celle orizzontali uguali, aiuti in quattro; il CSS sceglie la posa senza scaricare nuove immagini. Le pose sono illustrazioni animate con trasformazioni, non video né animazioni scheletriche o sincronizzazione labiale.

## Prompt utilizzati

Riferimento comune: concept approvato con giardino sulla sinistra, Rosa e riccio al tavolo in alto a destra, aiuti in basso a destra. Stile: originale avventura di carte, forme morbide tridimensionali, materiali curati, luce calda; niente caramelle, loghi o personaggi di altri giochi.

### Garden

Production game background for the approved original Smazzata card adventure. Match the reference's LEFT garden environment, high quality soft stylized 3D casual mobile game art. Portrait image, tall composition, enchanted lush garden with club shaped topiary, heart rose bushes, ivory playing-card bridges, diamond lanterns, distant imposing spade castle at TOP. A broad EMPTY winding ivory path from bottom foreground to top castle: reserve its middle for live clickable game level medallions, do NOT paint any level circles or numbers. Beautiful atmospheric depth, warm sun, emerald foliage, ivory ruby gold. View from above enough to see route clearly, path has 10 gently curving bends across tall composition. No characters, no UI, no logos, no text or letters. No candies. Must be useable as actual scrollable mobile level map background, crisp and finished, NOT a screenshot montage.

### Rosa

Production transparent character sprite sheet, EXACTLY THREE equally sized cells in ONE HORIZONTAL ROW, no grid lines, no text, transparent background. Same Nonna Rosa gardener mentor as reference top right: warm expressive silver haired elderly woman, rose decorated straw hat, emerald gardening coat with heart embroidery, stylized premium soft 3D mobile game art. Each pose centered within its own third, same head size and waist line, waist-up crop, entire hat and hands inside own cell, generous transparent margin, NO overlap between cells. LEFT cell: warm welcoming smile, hands resting holding fan of cards, mouth closed. MIDDLE cell: lively explaining gesture with one open hand toward viewer, mouth slightly open speaking, eyebrows lifted. RIGHT cell: delighted celebration, proud smile, one raised fist and card fan. Consistent exact character identity, beautiful material details and warm studio light. No scenery, no speech bubbles, no pedestal, no shadows outside character, no extra characters. This is an actual usable sprite sheet, not a concept board.

### Bruno

Production transparent character sprite sheet, EXACTLY THREE equally sized cells in ONE HORIZONTAL ROW, no grid lines, no text, transparent background. Same cute mischievous hedgehog rival as reference top right, rounded 3D character with expressive eyes, rich detailed soft brown quills, ivory belly, violet waistcoat with subtle spade brooch, holds real playing cards. Each pose centered within its own third, same character size and baseline, waist-up crop, entire quills and hands inside own cell, generous transparent margins, NO overlap between cells. LEFT: confident smirk holding concealed card fan. MIDDLE: talking playfully pointing at viewer with one paw, mouth open, raised brow. RIGHT: surprised impressed reaction, wide eyes, small open mouth, cards tilted. High quality premium stylized mobile game render, consistent identity and lighting. No scenery, bubbles, pedestal or other characters. Actual usable sprite sheet.

### Barone

Production transparent character sprite sheet, EXACTLY THREE equally sized cells in ONE HORIZONTAL ROW, no grid lines, no text, transparent background. An original charming theatrical villain for the reference's Smazzata card garden: the Baron of Spades, stylized rounded older gentleman with curling charcoal moustache, arched eyebrows, large expressive eyes, tall violet top hat with golden spade emblem, elaborate midnight-violet and gold coat, ivory gloves, holding black spade playing card. Charming rather than frightening, premium soft 3D casual mobile game character. Each pose centered within own third, same size/baseline, waist-up with full hat and hands inside cell, generous transparent margins, NO overlap. LEFT: smug composed grin with card held at chest. MIDDLE: grand challenging gesture with open gloved hand, mouth speaking. RIGHT: shocked comical defeat, hat crooked, wide eyes. Consistent identity and beautiful material details. No scenery, speech bubbles, pedestal or extra characters. Actual usable sprite sheet.

### Boosters

Production game item sprite sheet, exactly FOUR isolated objects, equally spaced in ONE horizontal row with equal square cells and transparent background. Match approved reference bottom right luxury whimsical soft 3D collectible card-game boosters. LEFT to right: 1 gold and ruby jester joker magic wand with tiny suit ornaments, 2 turquoise and gold ornate stopwatch with clear +30 on face, 3 violet and gold mentor medallion with kindly silver-haired gardener cameo, 4 luminous ruby heart inside golden card-suit frame, life refill collectible. Each object fully inside its own quarter with generous transparent margin, same visual size, no overlap, NO particles extending into adjacent cell, no scene or ground shadows. Readable silhouettes at 40px, beautiful highlights and volume, no extra text, no interface, no watermark. Actual usable sprite sheet, not a collage.

## Interazione e verifica

Le introduzioni hanno tre battute con cambio di interlocutore. Il tocco sulla battuta completa la scrittura; la risposta avanza subito. Il collegamento al tavolo permette di saltare la scena o riprendere un tentativo salvato. La guida reagisce alle azioni effettivamente accettate dal motore. Il testo mantiene il proprio spazio e la progressione durante i render della mano. Gli aiuti mantengono costi e limiti esistenti e accompagnano l'attivazione con un volo verso il controllo interessato.

`node server/uitest.js --campaign-story` controlla caricamento delle immagini, battute progressive, cambio personaggio, ingresso nel tavolo, reazione alla pesca, stabilità del layout, applicazione reale del tempo extra, 320 px, movimento ridotto e salvataggio delle risorse offline. La stessa verifica precede la prova completa `--campaign`. Tutti i file sono inclusi nei service worker e nella copia Pages/Android.
