'use strict';
// Illustrazioni originali intatte, con ornamenti vettoriali di divisione.
// WebP incorporati: compatibili con <img> e offline senza richieste annidate.
const fs = require('fs');
const path = require('path');
const { IDS, LEAGUES } = require('../server/ranked-rules');
const dir = path.join(__dirname, '../public/art/ranked');
const sources = path.join(__dirname, '../public/art/leagues');
const palettes = [
  ['#ffe0b7', '#ae6e3d', '#593320'], ['#ffffff', '#b9cbdc', '#53677a'],
  ['#fff5c3', '#e6b941', '#77501b'], ['#defff7', '#77cebc', '#315f64'],
  ['#ecffff', '#69d5fa', '#2e6090'], ['#f7e5ff', '#be82ee', '#603478'],
  ['#ffe1e7', '#ec5770', '#762738'], ['#e9f3ff', '#568ee9', '#243f78'],
];
fs.mkdirSync(dir, { recursive: true });
// Valida tutte le sorgenti prima di scrivere qualsiasi variante.
const images = IDS.map(id => fs.readFileSync(path.join(sources, `${id}.webp`)).toString('base64'));
IDS.forEach((id, tier) => {
  (id === 'legend' ? [''] : ['IV', 'III', 'II', 'I']).forEach((division, d) => {
    const [light, gem, dark] = palettes[tier] || palettes[2];
    const jewels = Array.from({ length: d + 1 }, (_, i) => {
      const x = 256 + (i - d / 2) * 29;
      return `<g transform="translate(${x} 473)"><path d="M0-14L11 0 0 14-11 0Z" fill="${dark}" stroke="url(#gold)" stroke-width="3"/><path d="M0-10L8 0 0 10-8 0Z" fill="${gem}"/><path d="M0-10V0H-8Z" fill="${light}"/><path d="M0 0H8L0 10Z" fill="${dark}"/><path d="M0-10L8 0" fill="none" stroke="${light}" stroke-width="1.5"/></g>`;
    }).join('');
    const width = 48 + d * 29;
    const badge = division ? `<g><path d="M${256-width/2} 453Q256 445 ${256+width/2} 453L${267+width/2} 473 256 496 ${245-width/2} 473Z" fill="url(#enamel)" stroke="url(#gold)" stroke-width="3"/>${jewels}</g>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title"><title id="title">Smazzata — ${LEAGUES[tier]} ${division}</title><defs><linearGradient id="gold" x2="0.3" y2="1"><stop stop-color="#fff2b9"/><stop offset=".35" stop-color="#d7a239"/><stop offset=".7" stop-color="#754714"/><stop offset="1" stop-color="#ffe59b"/></linearGradient><linearGradient id="enamel" x2="0" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="#121421"/></linearGradient></defs><image x="0" y="${division ? -8 : 0}" width="512" height="${division ? 480 : 512}" href="data:image/webp;base64,${images[tier]}"/>${badge}</svg>`;
    fs.writeFileSync(path.join(dir, `${id}${division ? '-' + division : ''}.svg`), svg);
  });
});
console.log('Create 33 insegne Ranked dalle 9 illustrazioni originali, con divisioni a gemme');
