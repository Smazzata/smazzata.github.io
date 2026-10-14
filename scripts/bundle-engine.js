'use strict';
/*
 * Impacchetta motore e computer (server/engine.js, server/bot.js e i moduli condivisi)
 * in un unico file per il browser: serve al gioco senza internet.
 *   - il server lo offre su /engine.js (generato all'avvio)
 *   - per la pagina fissa su GitHub Pages: node scripts/bundle-engine.js <file di uscita>
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODULES = ['shared/rules', 'shared/melds', 'shared/scala40', 'server/engine', 'server/bot', 'server/scala40', 'server/scala40-bot'];

function bundle() {
  const defs = MODULES.map((name) => {
    const src = fs.readFileSync(path.join(ROOT, name + '.js'), 'utf8').replace(/^﻿/, '');
    return `defs[${JSON.stringify(name)}] = function (module, exports, require) {\n${src}\n};`;
  }).join('\n');
  return `/* Generato da scripts/bundle-engine.js: motore e computer per giocare senza internet. Non modificare a mano. */
(function () {
  var defs = {}, cache = {};
  ${defs}
  function resolve(from, name) {
    var parts = from.split('/').slice(0, -1);
    name.replace(/\\.js$/, '').split('/').forEach(function (p) {
      if (p === '..') parts.pop(); else if (p !== '.') parts.push(p);
    });
    return parts.join('/');
  }
  function load(key) {
    if (cache[key]) return cache[key].exports;
    if (!defs[key]) throw new Error('Modulo mancante: ' + key);
    var m = cache[key] = { exports: {} };
    defs[key](m, m.exports, function (name) { return load(resolve(key, name)); });
    return m.exports;
  }
  self.BurracoEngine = load('server/engine');
  self.BurracoBot = load('server/bot');
  // tutti i giochi: motore e computer
  self.BurracoGames = {
    burraco: { E: self.BurracoEngine, Bot: self.BurracoBot },
    scala40: { E: load('server/scala40'), Bot: load('server/scala40-bot') },
  };
})();
`;
}

module.exports = { bundle };

if (require.main === module) {
  const out = process.argv[2];
  if (!out) { console.error('Uso: node scripts/bundle-engine.js <file di uscita>'); process.exit(1); }
  fs.writeFileSync(out, bundle());
  console.log(`Scritto ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
}
