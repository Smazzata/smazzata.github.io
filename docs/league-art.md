# Leghe: grafica e comportamento

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
