'use strict';
// Genera avvisi leggibili e distribuiti anche nell'app, senza copiare dati del server.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const lock = require('../package-lock.json');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parts = [], inventory = [];
for (const [dir, spec] of Object.entries(lock.packages)) {
  if (!dir || spec.dev || !dir.startsWith('node_modules/')) continue;
  const location = path.join(root, dir);
  if (!fs.existsSync(location)) throw new Error('Dipendenza non installata: ' + dir);
  const pkg = JSON.parse(fs.readFileSync(path.join(location, 'package.json'), 'utf8'));
  const files = fs.readdirSync(location).filter((f) => /^(licen[sc]e|copying|notice)([.-]|$)/i.test(f) && fs.statSync(path.join(location, f)).isFile());
  let notices = files.map((f) => fs.readFileSync(path.join(location, f), 'utf8')).join('\n\n');
  if (!notices) {
    const readme = fs.readdirSync(location).find((f) => /^readme/i.test(f));
    const text = readme ? fs.readFileSync(path.join(location, readme), 'utf8') : '';
    const license = text.search(/^#+ Licen[sc]e\s*$/mi);
    if (license >= 0 && text.slice(license).includes('Permission is hereby granted')) notices = text.slice(license);
  }
  if (!notices && pkg.name === 'http_ece') notices = fs.readFileSync(path.join(root, 'docs/licenze/http_ece-MIT.txt'), 'utf8');
  if (!notices && pkg.name === 'qrcode-generator') {
    const mit = fs.readFileSync(path.join(root, 'node_modules/socket.io-client/LICENSE'), 'utf8');
    notices = 'Copyright (c) 2009 Kazuhiko Arase\n\n' + mit.slice(mit.indexOf('Permission is hereby granted'));
  }
  if (!notices) throw new Error('Licenza da verificare manualmente: ' + pkg.name);
  inventory.push(`| ${pkg.name} | ${pkg.version} | ${pkg.license || spec.license || 'vedi avvisi'} |`);
  parts.push(`<details><summary>${esc(pkg.name)} ${esc(pkg.version)} (${esc(pkg.license || spec.license || '')})</summary><pre>${esc(notices)}</pre></details>`);
}
const cap = fs.readFileSync(path.join(root, 'android-app/LICENSE-capacitor.txt'), 'utf8');
parts.push(`<details><summary>Capacitor — MIT</summary><pre>${esc(cap)}</pre></details>`);
fs.writeFileSync(path.join(root, 'public/licenze.html'), `<!doctype html>
<html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Licenze · Smazzata</title>
<style>body{font:16px/1.6 system-ui;margin:24px auto;padding:0 16px;max-width:850px;background:#fffdf6;color:#172b22}summary{cursor:pointer;padding:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}a{color:#155d3a}</style>
<main><a href="./">Torna al gioco</a><h1>Licenze dei componenti</h1><p>Componenti dell'app e del servizio Smazzata. I singoli componenti conservano le rispettive licenze e attribuzioni.</p>
<h2>Caratteri</h2><p>Nunito e Playfair Display: SIL Open Font License 1.1. <a href="fonts/nunito-OFL.txt">Copyright e licenza Nunito</a> · <a href="fonts/playfair-OFL.txt">Copyright e licenza Playfair Display</a>.</p>
<h2>Software</h2>${parts.join('\n')}<p>Inventario generato dal package-lock.json del progetto. Le dipendenze native effettive vanno controllate anche nell'AAB finale.</p></main></html>\n`);
fs.writeFileSync(path.join(root, 'docs/licenze-dipendenze.md'), '# Dipendenze del servizio — inventario\n\nGenerato con `node scripts/licenze.js`; avvisi completi in `public/licenze.html`.\n\n| Componente | Versione | Licenza dichiarata |\n|---|---|---|\n' + inventory.join('\n') + '\n');
console.log(`Licenze: ${inventory.length} dipendenze runtime, Capacitor e due font`);
