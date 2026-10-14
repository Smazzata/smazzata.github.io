'use strict';
/*
 * Icona di Smazzata in SVG: un ventaglio di tre carte (dorso rosso, Asso di denari italiano, Asso di cuori francese)
 * su panno verde. Usata da scripts/make-icons.js (PNG di tutte le misure) e come public/icon.svg.
 *   svg({ shape: 'round' | 'full' | 'circle', scale })
 *   - round: angoli arrotondati (icona normale); full: quadrato pieno (maskable, Apple); circle: rotonda (Android)
 *   - scale: grandezza del ventaglio (più piccolo nelle icone "maskable", che il telefono ritaglia)
 */
function svg({ shape = 'round', scale = 1 } = {}) {
  const bg = shape === 'circle' ? '<circle cx="256" cy="256" r="256" fill="url(#felt)"/>'
    : `<rect width="512" height="512" rx="${shape === 'round' ? 112 : 0}" fill="url(#felt)"/>`;
  // una carta: rettangolo con il fulcro del ventaglio in basso al centro
  const card = (tf, inner) => `<g transform="${tf}"><rect x="-86" y="-252" width="172" height="244" rx="20" fill="url(#paper)" stroke="#d8cfb8" stroke-width="3"/>${inner}</g>`;
  const back = `<g transform="translate(-10 0) rotate(-26)"><rect x="-86" y="-252" width="172" height="244" rx="20" fill="#fff" stroke="#d8cfb8" stroke-width="3"/>
    <rect x="-74" y="-240" width="148" height="220" rx="13" fill="url(#back)"/>
    <rect x="-74" y="-240" width="148" height="220" rx="13" fill="url(#weave)"/>
    <rect x="-62" y="-228" width="124" height="196" rx="9" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3"/></g>`;
  const coin = card('translate(14 0) rotate(24)', `
    <circle cx="0" cy="-130" r="58" fill="url(#gold)" stroke="#9a6b10" stroke-width="4"/>
    <circle cx="0" cy="-130" r="42" fill="none" stroke="#9a6b10" stroke-width="3"/>
    <circle cx="0" cy="-130" r="16" fill="#c0392b" stroke="#7a2418" stroke-width="3"/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<circle cx="${(Math.cos(a * Math.PI / 180) * 30).toFixed(1)}" cy="${(-130 + Math.sin(a * Math.PI / 180) * 30).toFixed(1)}" r="4.5" fill="#9a6b10"/>`).join('')}`);
  const heart = card('rotate(-1)', `
    <text x="-62" y="-198" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="52" fill="#c62828">A</text>
    <path transform="translate(-61 -186) scale(.3)" d="M50 90 C 20 60, 0 45, 0 25 C 0 8, 14 0, 26 0 C 38 0, 46 8, 50 18 C 54 8, 62 0, 74 0 C 86 0, 100 8, 100 25 C 100 45, 80 60, 50 90 Z" fill="#c62828"/>
    <path transform="translate(-50 -165) scale(1)" d="M50 90 C 20 60, 0 45, 0 25 C 0 8, 14 0, 26 0 C 38 0, 46 8, 50 18 C 54 8, 62 0, 74 0 C 86 0, 100 8, 100 25 C 100 45, 80 60, 50 90 Z" fill="#c62828"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="felt" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#26905e"/><stop offset=".55" stop-color="#0f5132"/><stop offset="1" stop-color="#052014"/></radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1ead8"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#c8901c"/></linearGradient>
    <linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d23b52"/><stop offset="1" stop-color="#8e1b2e"/></linearGradient>
    <pattern id="weave" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="14" fill="rgba(255,255,255,.12)"/></pattern>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".38"/></filter>
  </defs>
  ${bg}
  <g transform="translate(256 ${Math.round(256 + 140 * scale)}) scale(${scale * 1.08})" filter="url(#sh)">${back}${heart}${coin}</g>
</svg>`;
}

module.exports = { svg };
if (require.main === module) process.stdout.write(svg());
