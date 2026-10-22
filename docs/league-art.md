# Leghe: grafica e comportamento

## Insegne Ranked attuali

Il Ranked recupera le sette illustrazioni originali in `public/art/leagues/`, senza modificarne
i file. Gran Maestro (`grandmaster.webp`, rubino e platino) e Campione (`champion.webp`,
zaffiro e oro) completano la famiglia: creati con ImageGen integrato usando le originali
come riferimento, poi esportati in WebP trasparente 512×512.

`scripts/ranked-art.js` incorpora queste nove illustrazioni nei 33 SVG di `public/art/ranked/`.
Ogni divisione mantiene intatta la stessa illustrazione e aggiunge un pendente con una,
due, tre o quattro gemme per IV/III/II/I. Non sono 33 illustrazioni ridisegnate: sono nove
illustrazioni con ornamenti di divisione. Leggenda conserva l'immagine originale unica.
Gli SVG sono contenitori misti bitmap/vettoriali autonomi, funzionanti come `<img>` anche
offline, senza font o richieste esterne. Non richiedono ImageGen a runtime o per rigenerare
i contenitori. Le sette vecchie illustrazioni sono dunque nuovamente le sorgenti attive,
non un archivio dismesso. Regole e prove: [ranked-system.md](ranked-system.md).

## Provenienza delle sette illustrazioni recuperate

Pagina dedicata in `public/js/classifica.js` e `public/classifica.css`.
Le sette insegne finali sono in `public/art/leagues/`:
`bronze.webp`, `silver.webp`, `gold.webp`, `platinum.webp`, `diamond.webp`, `master.webp`, `legend.webp`.
Sono immagini trasparenti 512×512, ricavate dall'atlante generato con il tool imagegen integrato,
con ritaglio, margini uniformi e compressione WebP per l'app. Non servono API o servizi grafici a runtime.

La pagina mostra la propria lega anche quando il giocatore non rientra nelle prime trenta posizioni.
Permette di esplorare le insegne, cambiare gioco, filtrare gli amici e aprire la classificata del gioco scelto.
I valori Elo e le soglie restano nascosti. Promozioni e retrocessioni reali attivano la presentazione
del passaggio, con focus contenuto nel dialogo, uscita da tastiera e modalità senza animazioni.
Le prove con i dati dimostrativi vivono solo nel test, non nella classifica pubblicata.

## Prompt originale (imagegen integrato, sfondo trasparente)

Production sprite atlas for an original premium Italian mobile playing-card game Smazzata. A SINGLE horizontal row of EXACTLY SEVEN equally sized square cells, on transparent background. Each cell contains one centered monumental league crest, consistent front-facing heraldic shield shape and card-suit language, soft polished 3D game art, premium collectible materials, strong silhouette readable at 48px and impressive at 200px, warm studio lighting, NO TEXT, NO LETTERS, NO NUMBERS, no UI, no scenery, no floor. All crests fit within their own cell with 12% transparent padding on all sides, no overlap or particles outside own cell, consistent size and baseline. Left to right progression of EXACTLY 7 crests: 1 BRONZE: copper bronze shield, simple engraved club and two small playing cards, modest bronze laurel; 2 SILVER: luminous brushed silver shield, paired spade/heart motifs and silver laurel; 3 GOLD: rich golden shield with red ruby heart gemstone, golden laurel and three-card fan; 4 PLATINUM: elegant platinum and jade shield, emerald club gemstone, sculpted sweeping wings; 5 DIAMOND: icy blue crystal diamond shield with faceted diamond suit jewel, luminous cyan silver wings; 6 MASTER: royal amethyst shield, violet spade gemstone with ornate platinum crown and four-suit accents; 7 LEGEND: majestic ruby and gold shield, brilliant golden four-suit crown with royal layered wings, radiant warm halo entirely within cell. Sophisticated visual evolution: simple early crests become increasingly elaborate, each unmistakably distinct but same family. Original art inspired by quality of premium casual mobile games, not casino slots, not copied designs. Very wide image, seven square cells in a single row, clean transparent alpha.

## Prompt delle due aggiunte (ImageGen integrato)

Riferimenti Gran Maestro: `master.webp`, `legend.webp`. Sfondo trasparente.

> Create ONE new original GRAN MAESTRO league crest for Smazzata. Input images are STYLE REFERENCES for an existing set, not edit targets. Match exactly their premium hand-painted polished 3D mobile game collectible heraldic crest style, sculpted gold highlights, beveled gemstone facets, front view. New rank sits between violet Master (reference 1) and ultimate gold/ruby Legend (reference 2). Use deep crimson garnet and dark platinum, gold edges, central ruby DIAMOND playing-card suit, compact regal crown, symmetrical layered sculpted silver wings and small four-card-suit details. It must be recognizably its own league and less magnificent than Legend. Single centered shield, square 512-friendly composition with 8% transparent margin, entire crest visible, clean TRUE TRANSPARENT alpha background. No scenery, ground, text, lettering, numerals, watermark, UI. Preserve the same dimensional rendering and ornate material quality as the references. Save the resulting image for integration into the project.

Riferimenti Campione: `master.webp`, `legend.webp`, `gold.webp`. Sfondo trasparente.

> Create ONE new original CAMPIONE league crest for the Smazzata card game. Input images are STYLE REFERENCES from the existing set, not targets to alter. Match their premium polished 3D hand-painted mobile game collectible heraldic style precisely: sculpted metallic bevels, warm gold highlights, sparkling faceted gems, symmetrical front-facing shield, no flat vector art. This league is just below ultimate Legend (reference 2): distinguish it by ROYAL SAPPHIRE BLUE enamel field, grand CHAMPAGNE GOLD frame, one large blue faceted SPADE jewel as centerpiece, tasteful royal gold crown inset with blue gems, paired golden laurel branches and compact sweeping gold wings. Tiny ivory playing cards subtly visible at shield base. Rich and regal but no Legend radiant halo and no four-large-suit shield. Single centered crest, square composition, 8% transparent margin, entire crest visible, truly TRANSPARENT background. No text, numbers, watermark, scenery, floor, UI. Same family, comparable visual scale and exquisite material quality to supplied references.

## Insegna dei piazzamenti

`public/art/leagues/unranked.webp`: scudo neutro grafite e peltro con carte coperte,
creato con ImageGen integrato prendendo `silver.webp` come riferimento di stile.
Non è una decima lega. Prima di completare i piazzamenti sostituisce l'insegna di lega
nelle viste del profilo; le anteprime del percorso restano esplorabili.

Prompt (sfondo trasparente):

> Create a single UNRANKED placement emblem for Smazzata matching the polished sculpted 3D card-game crest style of the reference. Reference is style guidance only, not a target. A restrained matte graphite and pewter shield with softly beveled metallic edges, two overlapping face-down dark cards in its center with delicate neutral engraved geometric card backs. NO suit jewels, NO crown, NO wings, NO laurels, NO stars, NO gold, no assigned league identity. Elegant mysterious yet welcoming, subtle cool silver highlights, clearly lower-key than a silver ranked emblem. One centered front-facing crest, square composition, 14% transparent margin, no text, letters, numbers, question marks, background, floor, or shadow outside the object. TRUE transparent alpha. This is an actual production asset shown before finishing ten placement matches.
