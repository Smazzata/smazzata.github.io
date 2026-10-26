# Tavolo della campagna su schermi stretti

Il blocco di Prove sul commit 9709f4d è stato riprodotto sul PC: 241 px di contenuto in un tavolo alto 236 px, a 320×740.

La correzione riduce soltanto il margine fra le zone della campagna quando il tavolo è già compatto e la larghezza non supera 360 px. Recupera 6 px; carte, comandi e tolleranza della verifica restano invariati.

Verifiche PC superate: `node server/uitest.js --campaign` (tre mondi, 30 situazioni UI, 320 px, aiuti, pausa, ripresa e risorse offline) e `npm run test:rapido`. Schermata mobile controllata visivamente. Nessuna verifica su Android fisico; la distribuzione sul telefono non è confermata dalle prove locali.
