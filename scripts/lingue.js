'use strict';
/*
 * Lingue: dalle traduzioni in lingue/*.txt crea i dizionari che usa il browser (public/lingue/en.js, es.js, pt.js).
 * Ogni riga dei file .txt:   testo italiano ‖ English ‖ Español ‖ Português
 * (le righe vuote e quelle che iniziano con # sono ignorate; {0}, {1}… sono le parti variabili).
 *   node scripts/lingue.js           rigenera i dizionari
 *   node scripts/lingue.js --check   controlla che siano aggiornati (usato da npm test)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'lingue');
const OUT = path.join(root, 'public', 'lingue');
const LANGS = ['en', 'es', 'pt'];

function read() {
  const dicts = { en: {}, es: {}, pt: {} };
  const problems = [];
  for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.txt')).sort()) {
    fs.readFileSync(path.join(SRC, f), 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (!line.trim() || line.startsWith('#')) return;
      const parts = line.split('‖').map((s) => s.trim());
      if (parts.length !== 4 || parts.some((p) => !p)) { problems.push(`${f}:${i + 1} servono 4 testi separati da ‖`); return; }
      const holes = (s) => (s.match(/\{\d+\}/g) || []).sort().join();
      parts.slice(1).forEach((p, k) => {
        if (holes(p) !== holes(parts[0])) problems.push(`${f}:${i + 1} (${LANGS[k]}) parti variabili diverse dall'italiano`);
        dicts[LANGS[k]][parts[0]] = p;
      });
    });
  }
  return { dicts, problems };
}

function render(lang, dict) {
  return `/* Dizionario ${lang}: generato da scripts/lingue.js a partire da lingue/*.txt (non modificare a mano) */\nI18N.load(${JSON.stringify(dict, null, 0).replace(/","/g, '",\n"')});\n`;
}

function build(check) {
  const { dicts, problems } = read();
  if (problems.length) throw new Error('Traduzioni da sistemare:\n' + problems.join('\n'));
  fs.mkdirSync(OUT, { recursive: true });
  const stale = [];
  for (const l of LANGS) {
    const file = path.join(OUT, l + '.js');
    const text = render(l, dicts[l]);
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (cur.replace(/\r/g, '') === text) continue;
    if (check) stale.push(l); else fs.writeFileSync(file, text);
  }
  if (stale.length) throw new Error(`Dizionari da rigenerare (${stale.join(', ')}): node scripts/lingue.js`);
  return Object.keys(dicts.en).length;
}

module.exports = { build };
if (require.main === module) {
  const n = build(process.argv.includes('--check'));
  console.log(`Lingue: ${n} testi tradotti in ${LANGS.join(', ')}`);
}
