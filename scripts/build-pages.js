'use strict';
/*
 * Prepara il sito per GitHub Pages (indirizzo fisso):
 *   /         pagina d'ingresso (launcher/), che trova il server e ci porta i giocatori
 *   /gioca/   copia del gioco che funziona senza server: partite contro il computer, anche senza internet
 *   node scripts/build-pages.js [cartella di uscita, predefinita _site]
 */
const fs = require('fs');
const path = require('path');
const { bundle } = require('./bundle-engine');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '_site'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'launcher'), OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), path.join(OUT, 'gioca'), { recursive: true });
fs.cpSync(path.join(ROOT, 'shared'), path.join(OUT, 'gioca', 'shared'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'gioca', 'engine.js'), bundle());
// GitHub Pages non deve trattare il sito con Jekyll
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`Sito pronto in ${OUT}`);
