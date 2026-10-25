# Musiche da salotto — 25 ottobre 2026

Sostituito l'arpeggio continuo con arrangiamenti originali più lenti e ariosi: accordi a quattro voci su otto battute, rivolti nel registro medio, basso discreto, fraseggi con pause e variazioni su quattro cicli. Piano elettrico sintetizzato con tre armoniche sinusoidali e decadimenti diversi; filtro passa-basso e breve eco con feedback contenuto. Partite con meno note melodiche rispetto a menu e collezione. Nessun campione esterno o brano di terzi.

Restano dodici contesti, consenso iniziale disattivato, volume personale, pausa in background e durante musica condivisa. Un solo scheduler; dissolvenza e scollegamento dei nodi del tema precedente. Client 2026.10.25.1, cache v81.

Verifiche: cinque test audio (preferenze, volume, sospensione, cambio contesto e sequenza lunga), chest-uitest completo nel browser. Anteprime realizzate dal medesimo codice con OfflineAudioContext, 34 secondi ciascuna, script scripts/music-preview.js; nessuna registrazione del sistema o microfono. Output locale test-output/musiche/home.wav e burraco.wav. Picco circa 0,054, RMS circa 0,0066 al volume 65: nessun clipping o valore non finito. La resa estetica resta da valutare ascoltando, le misure non equivalgono a un giudizio d'ascolto.

Superati anche test:rapido e release-ui-test --store (32 scene). Durante le verifiche sono comparse modifiche concorrenti alle chest: file e screenshot condivisi restano fuori dal commit audio; nessuna modifica grafica in questo intervento.
