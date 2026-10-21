'use strict';

// I progressi didattici sono locali: nessun Elo, premio o risultato inviato al server.
const CAMPAIGN_KEY = 'smazzata_campaign_world1_matches_v2';
const Campaign = window.CardCampaign;
function campaignProgress() { return Campaign.progress(store.get(CAMPAIGN_KEY, {})); }
function campaignPath() { return Campaign.paths.find((p) => p.id === S.campaignPath); }
function campaignSave(path, level, done) {
  const progress = campaignCurrentProgress();
  progress[path.id][level.id] = Math.max(progress[path.id][level.id], done);
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(progress)); S.campaignSaveFailed = false; }
  catch (e) { S.campaignSaveFailed = true; }
  // Permette di continuare anche se la memoria del browser non è disponibile.
  S.campaignSession = progress;
}
function campaignCurrentProgress() { return S.campaignSession || campaignProgress(); }
function campaignCompleted(path, progress) { return path.levels.filter((l) => progress[path.id][l.id] >= l.steps.length).length; }
// Stelle come nei giochi a livelli: 3 senza errori, 2 con un errore, 1 con più errori. Si tiene il risultato migliore.
const CAMPAIGN_STARS_KEY = 'smazzata_campaign_stars_matches_v2';
function campaignStars() {
  const raw = S.campaignStarsSession || store.get(CAMPAIGN_STARS_KEY, {}) || {}, out = {};
  for (const p of Campaign.paths) {
    out[p.id] = {};
    for (const l of p.levels) { const n = raw[p.id] && raw[p.id][l.id]; out[p.id][l.id] = Number.isInteger(n) ? Math.max(0, Math.min(3, n)) : 0; }
  }
  return out;
}
function campaignSaveStars(path, level, n) {
  const stars = campaignStars();
  stars[path.id][level.id] = Math.max(stars[path.id][level.id], n);
  try { localStorage.setItem(CAMPAIGN_STARS_KEY, JSON.stringify(stars)); } catch (e) { /* restano per questa sessione */ }
  S.campaignStarsSession = stars;
}
function campaignLevelStars(path, level, progress, stars) {
  // un livello completato ha sempre almeno una stella (anche se finito prima che esistessero le stelle)
  return progress[path.id][level.id] >= level.steps.length ? Math.max(1, stars[path.id][level.id]) : 0;
}
function campaignStarsHTML(n, cls = '') { return `<span class="cstars ${cls}" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`; }
function campaignMyAvatar() {
  const nick = (S.social && S.social.nick) || (S.name || '');
  return avatarHTML(nick || 'Tu', 0, false, S.social && S.social.avatar ? S.social.avatar : { e: (nick.charAt(0) || '🙂').toUpperCase(), c: '#f2c14e' });
}
/* ---- Illustrazioni della campagna: SVG disegnato al volo (niente immagini da scaricare, funziona offline) ----
   Ogni percorso ha la sua stagione: Burraco prato primaverile, Scala 40 autunno, Ramino in riva al mare.
   Profondità finta con gradienti, facce chiare/scure e ombre a ellisse (niente filtri SVG: leggero sui telefoni). */
const CMAP_THEMES = {
  burraco: { sky: ['#6fc3ee', '#dff4fb'], far: ['#b9c9e8', '#8fa6d0'], grass: ['#a3dc72', '#6db449'], patch: '#bce88a', cliff: ['#5fa83f', '#3a7a2a'],
    tree: ['#93df73', '#45a14a', '#256b34'], trunk: '#7a4f2c', path: ['#f6e4b5', '#b88a52', '#d9bc85'], water: ['#7fdcf7', '#2f9fd6'],
    flower: ['#ff5f86', '#ffd23f', '#ffffff', '#a974ff'], roof: ['#ff7a6b', '#b8352d'], kind: 'round' },
  scala40: { sky: ['#f3a874', '#fde5c4'], far: ['#c98b72', '#a0645a'], grass: ['#d8c76a', '#a8963c'], patch: '#e8d985', cliff: ['#a48f36', '#6f6024'],
    tree: ['#ffc861', '#ea6d2a', '#9c3517'], trunk: '#6b4226', path: ['#f3d8aa', '#a8763f', '#d6b27a'], water: ['#8bd0dc', '#3f8ea6'],
    flower: ['#e0393e', '#ff9f1c', '#fff3d6', '#8e3b8a'], roof: ['#7d63c9', '#43308a'], kind: 'autumn' },
  ramino: { sky: ['#4cc3f0', '#e4f8ff'], far: ['#46c3e3', '#1d8fc0'], grass: ['#b2e07f', '#79c25b'], patch: '#f4e4ae', cliff: ['#6db94e', '#3f8a38'],
    tree: ['#8fe07a', '#3fa458', '#24723f'], trunk: '#a8743f', path: ['#fcefcb', '#c9a466', '#ecd49b'], water: ['#5fe0f0', '#1aa3cc'],
    flower: ['#ff6fa0', '#ffd23f', '#ffffff', '#33c3f0'], roof: ['#4aa8ff', '#1c5fa8'], kind: 'palm' }
};
// semi delle carte disegnati come forme (i caratteri ♥♦♣♠ sui telefoni a volte diventano emoji)
const CMAP_SUITS = {
  H: 'M0 8 C-13 -1 -8 -11 0 -4 C8 -11 13 -1 0 8Z',
  D: 'M0 -9.5 L7.5 0 L0 9.5 L-7.5 0Z',
  C: 'M0 -9 a4.3 4.3 0 1 1 -.1 0Z M-4.6 -1 a4.3 4.3 0 1 0 .1 0Z M4.6 -1 a4.3 4.3 0 1 0 -.1 0Z M-1 2 L-3 9 H3 L1 2Z',
  S: 'M0 -9.5 C-3 -4 -9 -1 -8.4 3.2 C-7.6 7.4 -2.6 6.4 -1 4 L-3 9.5 H3 L1 4 C2.6 6.4 7.6 7.4 8.4 3.2 C9 -1 3 -4 0 -9.5Z'
};
/** Attrezzi per disegnare un paesaggio nella tinta del percorso; pre = prefisso degli id (più disegni nella stessa pagina) */
function cmapKit(themeId, pre) {
  const t = CMAP_THEMES[themeId] || CMAP_THEMES.burraco;
  pre = pre || 'cm' + (CMAP_THEMES[themeId] ? themeId : 'burraco');
  const u = (n) => `url(#${pre}${n})`, red = (s) => s === 'H' || s === 'D';
  const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${pre}${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const defs = `<defs>${lin('Sky', t.sky[0], t.sky[1])}${lin('Far', t.far[0], t.far[1])}${lin('Grass', t.grass[0], t.grass[1])}${lin('Cliff', t.cliff[0], t.cliff[1])}
    ${lin('Water', t.water[0], t.water[1])}${lin('Roof', t.roof[0], t.roof[1], 1, 0)}${lin('Wood', '#d79b5f', '#8a5a32')}${lin('Card', '#ffffff', '#ece3cc', 1, 1)}
    ${lin('Wall', '#fff6df', '#dcc596')}${lin('Stone', '#f4efe2', '#b5aa92')}
    <linearGradient id="${pre}Tower" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffaf0"/><stop offset=".45" stop-color="#f0e2c0"/><stop offset="1" stop-color="#b39766"/></linearGradient>
    <radialGradient id="${pre}Crown" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="${t.tree[0]}"/><stop offset=".55" stop-color="${t.tree[1]}"/><stop offset="1" stop-color="${t.tree[2]}"/></radialGradient>
    <radialGradient id="${pre}Glow"><stop offset="0" stop-color="#fffbe0"/><stop offset=".35" stop-color="#ffe46b" stop-opacity=".85"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient>
    <radialGradient id="${pre}Sun"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#ffe58a"/><stop offset=".7" stop-color="#ffd84f" stop-opacity=".45"/><stop offset="1" stop-color="#ffd84f" stop-opacity="0"/></radialGradient>
    ${Object.keys(CMAP_SUITS).map((s) => `<symbol id="${pre}S${s}" viewBox="-10 -10 20 20"><path d="${CMAP_SUITS[s]}"/></symbol>`).join('')}</defs>`;
  const suit = (s, x, y, size, fill) => `<use href="#${pre}S${s}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" fill="${fill}"/>`;
  const shadow = (rx, ry = rx / 3.4, y = 0, o = 0.18) => `<ellipse cy="${y}" rx="${rx}" ry="${ry}" fill="#1b2a12" opacity="${o}"/>`;
  const at = (x, y, s, inner) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${s && s !== 1 ? ` scale(${s})` : ''}">${inner}</g>`;
  const k = {
    t, u, defs, suit, at,
    tree(x, y, s = 1) {
      if (t.kind === 'palm') return k.palm(x, y, s);
      if (t.kind === 'autumn' && (Math.round(x + y) % 3 === 0)) return k.pine(x, y, s);
      return at(x, y, s, `${shadow(22)}<path d="M-3.5 2 L-2.2 -20 H2.2 L3.5 2Z" fill="${t.trunk}"/><path d="M0 2 L.6 -20 H2.2 L3.5 2Z" fill="#000" opacity=".2"/>
        <circle cx="-12" cy="-22" r="13" fill="${u('Crown')}"/><circle cx="12" cy="-23" r="12" fill="${u('Crown')}"/><circle cy="-35" r="19" fill="${u('Crown')}"/>
        <ellipse cx="-7" cy="-43" rx="7" ry="4" fill="#fff" opacity=".28"/>${t.kind === 'autumn' ? '<circle cx="9" cy="-30" r="2.2" fill="#ffe08a"/><circle cx="-6" cy="-24" r="2" fill="#c6401b"/>' : '<circle cx="8" cy="-31" r="2.4" fill="#ff6f86"/><circle cx="-9" cy="-22" r="2.2" fill="#fff"/>'}`);
    },
    pine(x, y, s = 1) {
      return at(x, y, s, `${shadow(18)}<rect x="-3" y="-12" width="6" height="14" fill="${t.trunk}"/><path d="M0 -62 L-17 -30 H17Z" fill="${u('Crown')}"/><path d="M0 -48 L-21 -12 H21Z" fill="${u('Crown')}"/><path d="M0 -62 L0 -12 H21 L0 -48 L17 -30 H6Z" fill="#000" opacity=".14"/>`);
    },
    palm(x, y, s = 1) {
      const leaf = (r) => `<path d="M0 0 Q14 -9 30 2 Q15 -3 0 4Z" fill="${r % 2 ? t.tree[1] : t.tree[2]}" transform="rotate(${r * 45 - 20})"/>`;
      return at(x, y, s, `${shadow(18)}<path d="M-3 2 Q-6 -24 4 -52 L8 -50 Q0 -24 3 2Z" fill="${t.trunk}"/><path d="M-4 -12 h7 M-4 -24 h7 M-2 -36 h7" stroke="#6e4a26" stroke-width="1.5"/>
        <g transform="translate(6 -52)">${[0, 1, 2, 3, 4, 5, 6].map(leaf).join('')}<circle r="3.5" fill="#7a4f2c"/><circle cx="3" cy="2" r="3" fill="#8a5a32"/></g>`);
    },
    bush(x, y, s = 1) {
      return at(x, y, s, `${shadow(18)}<circle cx="-9" cy="-7" r="9" fill="${u('Crown')}"/><circle cx="9" cy="-7" r="8" fill="${u('Crown')}"/><circle cy="-12" r="11" fill="${u('Crown')}"/>
        <circle cx="-5" cy="-14" r="2.2" fill="${t.flower[0]}"/><circle cx="5" cy="-9" r="2.2" fill="${t.flower[1]}"/><circle cx="-10" cy="-6" r="2" fill="${t.flower[2]}"/>`);
    },
    // fiore a forma di seme delle carte
    flower(x, y, s, col, sc = 1) {
      return at(x, y, sc, `<path d="M0 0 V-10" stroke="#3b7a2e" stroke-width="1.6"/><path d="M0 -4 q5 -4 7 0 q-4 3 -7 0" fill="#4f9a3e"/>${suit(s, 0, -14, 11, col)}<circle cy="-14" r="1.3" fill="#fff" opacity=".6"/>`);
    },
    flowers(x, y, n = 3) {
      const ss = ['H', 'D', 'C', 'S'];
      return Array.from({ length: n }, (_, i) => { const s = ss[(i + Math.round(x)) % 4]; return k.flower(x + (i - (n - 1) / 2) * 9, y + (i % 2) * 4, s, s === 'C' || s === 'S' ? '#2b2b3a' : t.flower[(i + Math.round(y)) % 2 ? 0 : 3], 0.9); }).join('');
    },
    tuft(x, y) { return `<path d="M${x - 6} ${y} l2 -8 l2 8 l3 -10 l2 10 l3 -7 l2 7" fill="${t.grass[1]}" stroke="${t.tree[2]}" stroke-width="1" stroke-linejoin="round" opacity=".8"/>`; },
    rock(x, y, s = 1) {
      return at(x, y, s, `${shadow(13, 3.5, 1)}<path d="M-12 0 L-9 -9 L-1 -14 L9 -10 L12 0Z" fill="#c4bfb0"/><path d="M-1 -14 L9 -10 L12 0 H2Z" fill="#8f8a7c"/><path d="M-9 -9 L-1 -14 L2 -8 L-6 -6Z" fill="#e4e0d4"/>`);
    },
    mushroom(x, y, s = 1) {
      return at(x, y, s, `${shadow(7, 2)}<rect x="-2.6" y="-9" width="5.2" height="9" rx="2" fill="#f6ecd4"/><path d="M-10 -8 Q0 -22 10 -8Z" fill="#e5463b"/><path d="M2 -20 Q8 -16 10 -8 H4Z" fill="#000" opacity=".15"/><circle cx="-4" cy="-12" r="1.8" fill="#fff"/><circle cx="3" cy="-14" r="1.4" fill="#fff"/>`);
    },
    // carta gigante piantata nel terreno (spessore a destra, ombra alla base)
    card(x, y, rot, rank, s, sc = 1) {
      const col = rank === '★' ? '#c0392b' : red(s) ? '#d23c3c' : '#1f2433';
      return at(x, y, sc, `${shadow(15, 4, 1)}<g transform="rotate(${rot})"><rect x="-10" y="-40" width="24" height="38" rx="3.5" fill="#b9ad90"/><rect x="-12.5" y="-41" width="24" height="38" rx="3.5" fill="${u('Card')}" stroke="#d6cbb0" stroke-width="1"/>
        <text x="-9.5" y="-31" font-size="8.5" font-weight="900" fill="${col}">${rank}</text>${rank === '★' ? `<circle cx="-.5" cy="-20" r="7" fill="#ffd23f"/><path d="M-.5 -26 l1.8 4 4.2.4 -3.2 2.8 1 4.2 -3.8 -2.2 -3.8 2.2 1 -4.2 -3.2 -2.8 4.2 -.4Z" fill="#e5463b"/>` : suit(s, -0.5, -19, 12, col)}</g>`);
    },
    fence(x1, y1, x2, y2) {
      const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 15)), posts = [];
      for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; posts.push(`<rect x="${(x - 2).toFixed(1)}" y="${(y - 15).toFixed(1)}" width="4" height="16" rx="1" fill="#f4dfb4"/><rect x="${(x + .5).toFixed(1)}" y="${(y - 15).toFixed(1)}" width="1.5" height="16" fill="#000" opacity=".15"/>`); }
      return `<g><path d="M${x1} ${y1 + 1} L${x2} ${y2 + 1}" stroke="#1b2a12" stroke-width="4" opacity=".12"/><path d="M${x1} ${y1 - 11} L${x2} ${y2 - 11} M${x1} ${y1 - 5} L${x2} ${y2 - 5}" stroke="#c99b62" stroke-width="2.6"/>${posts.join('')}</g>`;
    },
    cloud(x, y, s = 1, cls = '') {
      return `<g class="${cls}">${at(x, y, s, `<ellipse cx="2" cy="9" rx="36" ry="8" fill="#000" opacity=".06"/><circle cx="-17" cy="0" r="12" fill="#eef6fb"/><circle cx="3" cy="-7" r="17" fill="#fff"/><circle cx="21" cy="1" r="11" fill="#f3f8fc"/><ellipse cx="2" cy="4" rx="33" ry="8.5" fill="#fff"/><ellipse cx="2" cy="7" rx="30" ry="4" fill="#d6e7f2"/><ellipse cx="-3" cy="-13" rx="7" ry="3" fill="#fff" opacity=".9"/>`)}</g>`;
    },
    // aquilone a quadri (il seme delle carte) con la coda a fiocchi
    kite(x, y, a, b, cls = '') {
      return `<g class="${cls}">${at(x, y, 1, `<path d="M0 22 C-6 42 10 52 2 74" fill="none" stroke="#5b5b5b" stroke-width="1" opacity=".6"/><path d="M0 0 L-13 0 L0 -20Z" fill="${a}"/><path d="M0 -20 L13 0 L0 0Z" fill="${b}"/><path d="M-13 0 L0 22 L0 0Z" fill="${b}"/><path d="M13 0 L0 0 L0 22Z" fill="${a}"/><path d="M0 -20 V22 M-13 0 H13" stroke="#fff" stroke-width="1" opacity=".7"/>
        <path d="M0 22 q-6 8 2 14 q6 6 -2 14" fill="none" stroke="#555" stroke-width="1"/><path d="M-4 30 l4 2 -4 2Z M4 30 l-4 2 4 2Z" fill="${a}"/><path d="M-4 42 l4 2 -4 2Z M4 42 l-4 2 4 2Z" fill="${b}"/>`)}</g>`;
    },
    birds(x, y) { return `<path d="M${x} ${y} q4 -5 8 0 q4 -5 8 0 M${x + 22} ${y - 9} q3 -4 6 0 q3 -4 6 0" fill="none" stroke="#34495e" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`; },
    butterfly(x, y, col, cls = '') {
      return `<g class="${cls}">${at(x, y, 1, `<ellipse cx="-4" cy="-2" rx="4.5" ry="3.5" fill="${col}" transform="rotate(-25 -4 -2)"/><ellipse cx="4" cy="-2" rx="4.5" ry="3.5" fill="${col}" transform="rotate(25 4 -2)"/><ellipse cx="-3" cy="3" rx="3" ry="2.3" fill="${col}" opacity=".8"/><ellipse cx="3" cy="3" rx="3" ry="2.3" fill="${col}" opacity=".8"/><rect x="-.7" y="-4" width="1.4" height="9" rx=".7" fill="#333"/>`)}</g>`;
    },
    // casetta all'inizio del sentiero: facciata chiara, fianco scuro, finestra a cuore
    cottage(x, y, s = 1) {
      return at(x, y, s, `${shadow(40, 9, 2)}<path d="M8 0 V-26 L34 -34 V-8Z" fill="#d9c49a"/><path d="M-24 0 V-28 H8 V0Z" fill="#fff4d8"/><path d="M-28 -26 L-8 -50 L12 -26Z" fill="${u('Roof')}"/><path d="M-8 -50 L20 -58 L38 -34 L12 -26Z" fill="${t.roof[1]}"/>
        <rect x="18" y="-62" width="7" height="14" fill="#a8806a"/><circle cx="23" cy="-70" r="4" fill="#fff" opacity=".7"/><circle cx="28" cy="-78" r="5" fill="#fff" opacity=".5"/>
        <path d="M-17 0 V-13 Q-12 -19 -7 -13 V0Z" fill="#8a5a32"/><rect x="-3" y="-21" width="9" height="9" rx="1.5" fill="#7cc6e6" stroke="#fff" stroke-width="1.5"/>${suit('H', 1.5, -16.5, 6, '#e5463b')}
        <rect x="18" y="-24" width="8" height="8" rx="1" fill="#6aa9c4" transform="skewY(-17)"/>`);
    },
    // mulino a vento con le pale che girano
    windmill(x, y, s = 1) {
      const blade = (r) => `<g transform="rotate(${r})"><rect x="-1.2" y="-40" width="2.4" height="40" fill="#7a4f2c"/><rect x="1.2" y="-38" width="9" height="28" fill="#fff8e8" stroke="#c9a46c" stroke-width="1"/><path d="M1.2 -31 h9 M1.2 -24 h9 M1.2 -17 h9" stroke="#c9a46c" stroke-width=".8"/></g>`;
      return at(x, y, s, `${shadow(30, 8, 2)}<path d="M-16 0 L-10 -56 H10 L16 0Z" fill="${u('Tower')}"/><path d="M-14 -56 Q0 -76 14 -56Z" fill="${u('Roof')}"/>
        <path d="M-5 0 V-12 Q0 -17 5 -12 V0Z" fill="#8a5a32"/><circle cy="-34" r="4" fill="#7cc6e6" stroke="#fff" stroke-width="1.5"/>
        <g transform="translate(0 -58)"><g class="cmap-spin"><circle r="42" fill="none"/>${[0, 90, 180, 270].map(blade).join('')}<circle r="4" fill="#5b3a22"/></g></g>`);
    },
    // faro (Ramino al mare) con la luce che pulsa
    lighthouse(x, y, s = 1) {
      return at(x, y, s, `${shadow(30, 8, 2)}<path d="M-26 2 Q-20 -12 -4 -10 Q12 -16 26 2Z" fill="#a39a88"/><path d="M-4 -10 Q12 -16 26 2 H6Z" fill="#7d7566"/>
        <path d="M-11 -8 L-7 -70 H7 L11 -8Z" fill="#fff"/><path d="M-10.2 -20 L-9.4 -32 H9.4 L10.2 -20Z M-8.8 -44 L-8 -56 H8 L8.8 -44Z" fill="#e5463b"/><path d="M2 -70 H7 L11 -8 H4Z" fill="#000" opacity=".12"/>
        <rect x="-9" y="-74" width="18" height="4" fill="#3b3b4a"/><rect x="-6" y="-86" width="12" height="12" fill="#fff5b8" stroke="#3b3b4a" stroke-width="1.5"/><circle class="cmap-beam" cy="-80" r="17" fill="${u('Glow')}"/>
        <path d="M-9 -86 L0 -96 L9 -86Z" fill="#e5463b"/>`);
    },
    // ponte di legno sul ruscello, orientato lungo il sentiero (ang in gradi)
    bridge(x, y, ang) {
      const planks = Array.from({ length: 9 }, (_, i) => `<rect x="${-28 + i * 6.3}" y="-19" width="5.4" height="38" rx="1" fill="${i % 2 ? '#c48a52' : '#d79b5f'}"/>`).join('');
      const rail = (yy) => `<path d="M-30 ${yy} Q0 ${yy - 3} 30 ${yy}" stroke="#7a4f2c" stroke-width="3" fill="none"/>${[-28, -9, 9, 28].map((px) => `<rect x="${px - 2}" y="${yy - 2}" width="4" height="5" rx="1" fill="#5e3a1f"/>`).join('')}`;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})"><rect x="-31" y="-21" width="62" height="46" rx="5" fill="#1b2a12" opacity=".2"/><rect x="-30" y="-21" width="60" height="42" rx="4" fill="#8a5a32"/>${planks}${rail(-20)}${rail(21)}</g>`;
    },
    // arco di pietra (la porta dei quaranta): ante aperte se la porta è "già aperta"
    arch(x, y, open, label, sc = 1) {
      const stones = [-1, 0, 1].map((i) => `<rect x="${i * 11 - 5}" y="-71" width="10" height="9" rx="2" fill="${i ? '#e7e0cf' : '#ffd23f'}" stroke="#a89d84" stroke-width="1"/>`).join('');
      return at(x, y, sc, `${shadow(40, 7, 3)}<path d="M-34 2 V-46 Q-34 -76 0 -76 Q34 -76 34 -46 V2 H22 V-46 Q22 -62 0 -62 Q-22 -62 -22 -46 V2Z" fill="${u('Stone')}" stroke="#a89d84" stroke-width="1.5"/>
        <path d="M22 2 V-46 Q22 -62 0 -62 V-76 Q34 -76 34 -46 V2Z" fill="#000" opacity=".1"/><path d="M-34 -30 h12 M-34 -14 h12 M22 -22 h12 M22 -6 h12" stroke="#a89d84" stroke-width="1"/>
        ${open ? `<path d="M-22 2 V-44 L-36 -40 V8Z" fill="${u('Wood')}"/><path d="M22 2 V-44 L36 -40 V8Z" fill="${u('Wood')}"/>` : `<path d="M-22 2 V-46 Q-22 -62 0 -62 Q22 -62 22 -46 V2 H14 V-44 Q14 -54 0 -54 Q-14 -54 -14 -44 V2Z" fill="${u('Wood')}" opacity=".85"/>`}
        ${stones}<text y="-63.5" text-anchor="middle" font-size="7.5" font-weight="900" fill="#7a4f00">${label}</text>`);
    },
    // radura magica: cerchio di funghi, carta jolly al centro, lucciole
    clearing(x, y) {
      const ring = [0, 1, 2, 3, 4, 5, 6].map((i) => { const a = Math.PI * (i / 6); return k.mushroom(-44 * Math.cos(a), -14 * Math.sin(a) + 6, 0.85); }).join('');
      const flies = [[-30, -40], [22, -52], [36, -26], [-12, -62], [8, -30], [-40, -20]].map(([fx, fy], i) => `<circle cx="${fx}" cy="${fy}" r="${i % 2 ? 6 : 8}" fill="${u('Glow')}"/>`);
      return at(x, y, 1, `<ellipse rx="56" ry="20" fill="${t.patch}" opacity=".9"/><ellipse cy="3" rx="46" ry="14" fill="${t.grass[0]}"/>${ring}${k.card(0, 8, -4, '★', 'H', 1.05)}
        ${[[-26, 14], [26, 12], [0, 20]].map(([fx, fy]) => k.mushroom(fx, fy, 0.75)).join('')}<g class="cmap-fly">${flies.filter((_, i) => i % 2).join('')}</g><g class="cmap-fly two">${flies.filter((_, i) => !(i % 2)).join('')}</g>`);
    },
    // collina con sette carte giganti piantate a ventaglio
    cardHill(x, y) {
      const ranks = ['A', '2', '3', '4', '5', '6', '7'];
      const cards = ranks.map((r, i) => { const a = (i - 3) / 3 * 1.05; return { x: 52 * Math.sin(a), y: -14 - 16 * Math.cos(a), rot: a * 22, r }; });
      return at(x, y, 1, `${shadow(70, 18, 6, .16)}<path d="M-68 4 Q-40 -34 0 -36 Q40 -34 68 4Z" fill="${t.grass[0]}"/><path d="M0 -36 Q40 -34 68 4 H0Z" fill="#000" opacity=".08"/><path d="M-52 -10 Q-20 -30 10 -30" stroke="#fff" stroke-width="3" fill="none" opacity=".35"/>
        ${cards.map((c) => k.card(c.x, c.y, c.rot, c.r, 'H', 0.82)).join('')}${k.flowers(-30, 2, 2)}${k.flowers(36, 2, 2)}`);
    },
    // giardino dei jolly: aiuola con i fiori a seme e un jolly gigante
    garden(x, y) {
      return at(x, y, 1, `${shadow(62, 16, 6, .14)}<ellipse rx="60" ry="20" fill="#9a6b3c"/><ellipse cy="-3" rx="56" ry="17" fill="#6e4a2b"/><ellipse cy="-1" rx="60" ry="20" fill="none" stroke="#f4dfb4" stroke-width="3" stroke-dasharray="6 3"/>
        ${k.flowers(-34, -4, 3)}${k.flowers(30, -4, 3)}${k.flowers(-10, 10, 3)}${k.flowers(18, 12, 2)}${k.card(-2, -6, 5, '★', 'H', 1.1)}${k.card(-30, -10, -12, '★', 'S', 0.8)}`);
    },
    // castello in cima: torri cilindriche, tetti a cono, stendardi con i semi, bandiera che sventola
    castle(x, y, gold) {
      const tower = (tx, s) => at(tx, 0, s, `<rect x="-15" y="-96" width="30" height="96" fill="${u('Tower')}"/><ellipse cy="0" rx="15" ry="4" fill="#b39766"/>
        <path d="M-17 -96 v-8 h6 v4 h5 v-4 h6 v4 h5 v-4 h6 v4 h5 v-4 h1 v8Z" fill="${u('Tower')}"/>
        <path d="M-20 -103 L0 -146 L20 -103Z" fill="${u('Roof')}"/><ellipse cy="-103" rx="20" ry="5" fill="${t.roof[1]}"/><path d="M0 -146 V-160" stroke="#5e3a1f" stroke-width="1.5"/><path d="M0 -160 L12 -156 L0 -152Z" fill="${gold ? '#ffd23f' : '#fff'}"/>
        <path d="M-5 -60 V-70 Q0 -76 5 -70 V-60Z" fill="#5b4a3a"/><path d="M-5 -30 V-38 Q0 -43 5 -38 V-30Z" fill="#5b4a3a"/>`);
      const merlons = Array.from({ length: 10 }, (_, i) => `<rect x="${-60 + i * 12.4}" y="-82" width="7" height="12" fill="${u('Wall')}"/>`).join('');
      const bricks = [[-48, -54], [-30, -40], [30, -50], [44, -30], [-40, -20], [24, -16], [-16, -60], [16, -64]].map(([bx, by]) => `<rect x="${bx}" y="${by}" width="10" height="4" rx="1" fill="#c8b083" opacity=".55"/>`).join('');
      return at(x, y, 1, `${shadow(100, 16, 4, .2)}
        <g transform="translate(0 -60)"><rect x="-26" y="-64" width="52" height="64" fill="${u('Wall')}"/><path d="M8 -64 h18 v64 h-18Z" fill="#000" opacity=".08"/><path d="M-32 -64 L0 -110 L32 -64Z" fill="${u('Roof')}"/><ellipse cy="-64" rx="32" ry="6" fill="${t.roof[1]}"/>
          <path d="M-7 -30 V-44 Q0 -52 7 -44 V-30Z" fill="#5b4a3a"/><path d="M0 -110 V-140" stroke="#5e3a1f" stroke-width="2"/>
          <g class="cmap-flag"><path d="M1 -140 Q12 -144 22 -139 Q32 -134 42 -138 V-121 Q32 -117 22 -122 Q12 -127 1 -123Z" fill="${gold ? '#ffd23f' : '#e5463b'}"/>${suit('H', 20, -130.5, 9, gold ? '#e5463b' : '#fff')}</g></g>
        <rect x="-62" y="-72" width="124" height="72" fill="${u('Wall')}"/>${merlons}${bricks}<path d="M30 -72 h32 v72 h-32Z" fill="#000" opacity=".06"/>
        <rect x="-50" y="-66" width="16" height="30" fill="#e5463b"/><path d="M-50 -36 l8 -6 8 6Z" fill="${u('Wall')}"/>${suit('H', -42, -53, 10, '#fff')}
        <rect x="34" y="-66" width="16" height="30" fill="#1f2433"/><path d="M34 -36 l8 -6 8 6Z" fill="${u('Wall')}"/>${suit('S', 42, -53, 10, '#fff')}
        ${gold ? `<ellipse cy="-14" rx="34" ry="30" fill="${u('Glow')}"/>` : ''}
        <path d="M-20 0 V-26 Q-20 -44 0 -44 Q20 -44 20 -26 V0Z" fill="${u('Stone')}"/><path d="M-15 0 V-25 Q-15 -38 0 -38 Q15 -38 15 -25 V0Z" fill="${gold ? '#ffe9a0' : '#5b3a22'}"/>
        ${gold ? '' : '<path d="M-10 -34 V0 M-4 -37 V0 M4 -37 V0 M10 -34 V0 M-15 -24 H15 M-15 -12 H15" stroke="#3b2414" stroke-width="1.6"/>'}
        ${tower(-66, 1)}${tower(66, 1)}`);
    }
  };
  return k;
}
// punto e direzione a metà di un tratto del sentiero (curva cubica con i punti di controllo in verticale)
function cmapMid(a, p) { return { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2, ang: Math.atan2(0.75 * (p.y - a.y), 1.5 * (p.x - a.x)) * 180 / Math.PI }; }
// punto a una frazione s di un tratto del sentiero
function cmapAt(a, p, s) {
  const r = 1 - s, my = (a.y + p.y) / 2, m = cmapMid(a, p);
  return { x: (r * r * r + 3 * r * r * s) * a.x + (3 * r * s * s + s * s * s) * p.x, y: r * r * r * a.y + (3 * r * r * s + 3 * r * s * s) * my + s * s * s * p.y, ang: m.ang };
}
function cmapCurve(list) { return list.map((p, i) => i ? (() => { const a = list[i - 1], my = (a.y + p.y) / 2; return `C${a.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`; })() : `M${p.x} ${p.y}`).join(' '); }
function cmapSample(list) {
  const out = [];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], p = list[i], my = (a.y + p.y) / 2;
    for (let s = 0; s <= 1; s += 0.05) { const r = 1 - s; out.push({ x: r * r * r * a.x + 3 * r * r * s * a.x + 3 * r * s * s * p.x + s * s * s * p.x, y: r * r * r * a.y + 3 * r * r * s * my + 3 * r * s * s * my + s * s * s * p.y }); }
  }
  return out;
}
// bordo di un terrazzo che passa per il punto (mx, my) dove lo attraversa il sentiero
function cmapWave(mx, my, H, dy = 0) {
  const y = my + dy;
  return `M-5 ${y + 24} C${(mx * 0.45).toFixed(1)} ${y + 28} ${mx - 60} ${y + 3} ${mx} ${y} C${mx + 60} ${y - 3} ${(mx + (360 - mx) * 0.55).toFixed(1)} ${y - 26} 365 ${y - 18} V${H + 5} H-5Z`;
}
// Mappa del mondo: sentiero che sale dal basso verso il castello, a terrazzi; ogni livello ha il suo luogo a tema.
function campaignWorldMapHTML(path, progress, stars) {
  if (path.id === 'burraco') return campaignGardenMap(path, progress, stars);
  const k = cmapKit(path.id), t = k.t, u = k.u;
  const W = 360, GAP = 190, TOP = 340, BOTTOM = 120, n = path.levels.length, H = TOP + (n - 1) * GAP + BOTTOM;
  const XS = [200, 100, 260, 115, 255, 105];
  const pts = path.levels.map((l, i) => ({ x: i === n - 1 ? 180 : XS[i % XS.length], y: H - BOTTOM - i * GAP }));
  const castle = { x: 180, y: 262 };
  const isDone = (i) => progress[path.id][path.levels[i].id] >= path.levels[i].steps.length;
  const isLocked = (i) => { const globalI = path.levels[i].number - 1, previous = Campaign.paths.find(p => p.id === path.id).levels[globalI - 1]; return previous && progress[path.id][previous.id] < previous.steps.length; };
  const cur = path.levels.findIndex((l, i) => !isDone(i));
  const allDone = cur < 0;
  const route = [{ x: pts[0].x, y: H + 10 }].concat(pts, castle);
  const walked = route.slice(0, allDone ? route.length : cur + 2);
  const samples = cmapSample(route);
  const mids = pts.map((p, i) => i ? cmapMid(pts[i - 1], p) : null);
  // zone libere per le decorazioni: lontano dal sentiero, dai livelli (titolo e stelle) e dai luoghi a tema
  const reserved = [{ x1: 70, y1: 0, x2: 290, y2: 290 }];
  pts.forEach((p) => reserved.push({ x1: p.x - 74, y1: p.y - 92, x2: p.x + 74, y2: p.y + 90 }));
  const free = (x, y, r) => samples.every((s) => Math.hypot(s.x - x, s.y - y) > 26 + r) && reserved.every((b) => x < b.x1 - r || x > b.x2 + r || y < b.y1 || y > b.y2 + r);
  const items = []; // [y della base, svg]: disegnati dall'alto in basso per sovrapporsi bene
  const add = (y, svg, box) => { items.push([y, svg]); if (box) reserved.push(box); };
  const side = (p) => p.x < 180 ? 285 : 72;
  // luoghi a tema dei livelli (scelti dall'id del livello, così valgono per tutti i percorsi)
  const terraces = [];
  path.levels.forEach((l, i) => {
    const p = pts[i], sx = side(p), m = mids[i];
    if (l.id === 'turno') { add(p.y + 30, k.cottage(sx, p.y + 30), { x1: sx - 45, y1: p.y - 50, x2: sx + 45, y2: p.y + 40 }); add(p.y + 60, k.flowers(sx + 40 * (sx < 180 ? 1 : -1), p.y + 62, 3)); }
    else if (l.id === 'combinazioni') {
      add(p.y + 6, t.kind === 'palm' ? k.lighthouse(sx, p.y + 6) : k.windmill(sx, p.y + 6), { x1: sx - 38, y1: p.y - 95, x2: sx + 38, y2: p.y + 20 });
    } else if (l.id === 'matte') add(p.y + 4, k.clearing(sx, p.y + 4), { x1: sx - 60, y1: p.y - 70, x2: sx + 60, y2: p.y + 30 });
    else if (l.id === 'apertura') {
      if (m) { const g = cmapAt(pts[i - 1], p, 0.45); add(g.y + 12, k.arch(g.x, g.y + 12, path.id !== 'scala40', path.id === 'scala40' ? '40' : '✓', 0.85)); terraces.push(g); }
      add(p.y + 10, k.card(sx - 14, p.y + 4, -8, 'K', 'C', 1.25) + k.card(sx + 14, p.y + 10, 9, 'Q', 'D', 1.25) + k.rock(sx + 34, p.y + 22) + k.flowers(sx - 30, p.y + 30, 3), { x1: sx - 50, y1: p.y - 50, x2: sx + 50, y2: p.y + 35 });
    } else if (l.id === 'jolly') add(p.y + 8, k.garden(sx, p.y + 8), { x1: sx - 64, y1: p.y - 60, x2: sx + 64, y2: p.y + 30 });
    else if (l.id === 'burraco') add(p.y + 16, k.cardHill(sx - (sx > 180 ? 8 : -8), p.y + 16), { x1: sx - 78, y1: p.y - 55, x2: sx + 70, y2: p.y + 36 });
  });
  // il ponte attraversa il ruscello nel tratto che porta al secondo livello
  const br = mids[1];
  // terrazzi: uno a metà salita (se non c'è già la porta) e uno sotto il castello
  if (!terraces.length && mids[2]) terraces.push(mids[2]);
  if (mids[n - 1]) terraces.push(mids[n - 1]);
  terraces.sort((a, b) => a.y - b.y);
  // riempitivi: alberi ai bordi, fiori a seme, sassi, funghi, ciuffi, carte giganti (sempre uguali: generatore con seme)
  let seed = [...path.id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 2147483647 || 1;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const cardRanks = [['A', 'S'], ['K', 'H'], ['7', 'D'], ['J', 'C'], ['Q', 'H']];
  let cards = 0;
  for (let tries = 0, placed = 0; tries < 900 && placed < 46; tries++) {
    const edge = rnd() < 0.55, x = edge ? (rnd() < 0.5 ? 10 + rnd() * 50 : 300 + rnd() * 50) : 20 + rnd() * 320, y = 300 + rnd() * (H - 310);
    const r = rnd(), kind = edge ? (r < 0.62 ? 'tree' : r < 0.78 ? 'bush' : r < 0.9 ? 'rock' : 'flowers') : (r < 0.36 ? 'flowers' : r < 0.52 ? 'tuft' : r < 0.64 ? 'rock' : r < 0.76 ? 'mushroom' : r < 0.86 && cards < 4 ? 'card' : 'bush');
    const rad = { tree: 18, bush: 16, rock: 12, flowers: 14, tuft: 6, mushroom: 6, card: 14 }[kind];
    if (!free(x, y, rad)) continue;
    placed++;
    const s = 0.85 + rnd() * 0.35;
    const svg = kind === 'tree' ? k.tree(x, y, s) : kind === 'bush' ? k.bush(x, y, s * 0.9) : kind === 'rock' ? k.rock(x, y, s) : kind === 'flowers' ? k.flowers(x, y, 2 + Math.floor(rnd() * 3))
      : kind === 'tuft' ? k.tuft(x, y) : kind === 'mushroom' ? k.mushroom(x, y, s) : k.card(x, y, (rnd() - 0.5) * 24, ...cardRanks[cards++ % cardRanks.length], 1.1);
    add(y, svg, kind === 'tuft' ? null : { x1: x - rad, y1: y - rad * 1.6, x2: x + rad, y2: y + 4 });
  }
  items.sort((a, b) => a[0] - b[0]);
  const fences = [[pts[0].x + 34, H - 40, pts[0].x + 110, H - 62], [pts[0].x - 40, H - 8, pts[0].x - 100, H - 26]].map((f) => k.fence(...f)).join('');
  // piattaforme di pietra sotto i gettoni dei livelli
  const pads = pts.map((p, i) => { const lk = isLocked(i), dn = isDone(i); return `<g transform="translate(${p.x} ${p.y})"><ellipse cy="30" rx="48" ry="15" fill="#1b2a12" opacity=".2"/><ellipse cy="24" rx="44" ry="15" fill="${lk ? '#8f938a' : dn ? '#9a8a68' : '#b0782a'}"/><ellipse cy="19" rx="44" ry="14" fill="${lk ? '#c9cbc2' : dn ? u('Stone') : '#ffd768'}"/><ellipse cy="17" rx="34" ry="9" fill="#fff" opacity=".18"/></g>`; }).join('');
  const stairs = terraces.map((m) => `<g transform="translate(${m.x.toFixed(1)} ${(m.y + 6).toFixed(1)}) rotate(${m.ang.toFixed(1)})">${[-9, -2, 5, 12].map((sx) => `<rect x="${sx}" y="-14" width="5" height="28" rx="1.5" fill="${t.path[1]}" opacity=".55"/>`).join('')}</g>`).join('');
  const far = t.kind === 'palm'
    ? `<rect y="214" width="${W}" height="60" fill="${u('Far')}"/><path d="M0 222 H${W}" stroke="#fff" stroke-width="2" opacity=".5"/><g class="cmap-shine"><path d="M30 236 h26 M120 246 h18 M250 232 h30 M300 252 h20" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/></g>
       <g transform="translate(58 228)"><path d="M0 0 L0 -18 L12 0Z" fill="#fff"/><path d="M-1 0 L-1 -14 L-9 0Z" fill="#ffd23f"/><path d="M-12 2 H14 L10 6 H-8Z" fill="#c0392b"/></g><g transform="translate(300 240) scale(.7)"><path d="M0 0 L0 -18 L12 0Z" fill="#fff"/><path d="M-12 2 H14 L10 6 H-8Z" fill="#2f7fc1"/></g>`
    : `<path d="M-5 250 L40 196 L70 214 L120 160 L170 220 L210 186 L260 226 L300 176 L365 236 V280 H-5Z" fill="${u('Far')}" opacity=".85"/>
       <path d="M120 160 L104 180 L114 178 L122 186 L132 176Z M300 176 L288 190 L298 188 L306 194 L314 188Z" fill="#fff" opacity="${t.kind === 'autumn' ? '.5' : '.9'}"/>
       <path d="M-5 262 Q60 222 130 240 Q200 214 270 238 Q320 226 365 244 V290 H-5Z" fill="${t.grass[1]}" opacity=".55"/>`;
  const river = `M-10 ${br ? br.y + 34 : 0} C40 ${br ? br.y + 40 : 0} ${br ? br.x - 70 : 0} ${br ? br.y + 6 : 0} ${br ? br.x : 0} ${br ? br.y : 0} S${br ? br.x + 120 : 0} ${br ? br.y - 30 : 0} 370 ${br ? br.y - 34 : 0}`;
  const nodes = path.levels.map((l, i) => {
    const done = isDone(i), locked = isLocked(i), here = !done && !locked, st = campaignLevelStars(path, l, progress, stars);
    const label = `Livello ${l.number}: ${l.title}. ${done ? `Completato, ${st} ${st === 1 ? 'stella' : 'stelle'}` : locked ? 'Bloccato' : 'Da giocare'}`;
    return `<div class="cmap-spot ${done ? 'done' : locked ? 'locked' : 'current'}" style="left:${(pts[i].x / W * 100).toFixed(3)}%;top:${(pts[i].y / H * 100).toFixed(3)}%">
      ${here ? `<span class="cmap-rays" aria-hidden="true"></span><span class="cmap-me ${(pts[i + 1] || castle).x > pts[i].x ? 'left' : 'right'}" aria-hidden="true">${campaignMyAvatar()}</span><i class="cmap-spark" aria-hidden="true"></i><i class="cmap-spark two" aria-hidden="true"></i>` : done ? campaignStarsHTML(st) : ''}
      <button class="cmap-node ${l.boss ? 'cad-boss-node' : ''}" data-act="campaignPreview" data-i="${l.number - 1}" ${locked ? 'disabled' : ''} ${here ? 'aria-current="step"' : ''} aria-label="${esc(label)}"><b>${l.boss ? '👑' : l.number}</b>${locked ? '<span class="cmap-lock" aria-hidden="true">🔒</span>' : ''}</button>
      <span class="cmap-title" aria-hidden="true">${esc(l.title)}</span></div>`;
  }).join('');
  const kiteCols = t.kind === 'autumn' ? ['#e5463b', '#ffd23f'] : t.kind === 'palm' ? ['#ff6fa0', '#33c3f0'] : ['#e5463b', '#fff'];
  return `<div class="cmap cmap-${t.kind}${allDone ? ' cmap-alldone' : ''}" style="aspect-ratio:${W} / ${H}">
    <svg class="cmap-bg" viewBox="0 0 ${W} ${H}" aria-hidden="true" preserveAspectRatio="none">${k.defs}
      <rect width="${W}" height="${H}" fill="${u('Grass')}"/><rect width="${W}" height="300" fill="${u('Sky')}"/>
      <circle cx="312" cy="58" r="44" fill="${u('Sun')}"/><circle cx="312" cy="58" r="17" fill="#fff6c9"/>
      ${k.cloud(60, 118, 0.8, 'cmap-cloud slow')}${k.cloud(292, 140, 0.65, 'cmap-cloud')}${k.birds(222, 104)}
      ${k.kite(36, 160, kiteCols[0], kiteCols[1], 'cmap-kite')}${k.kite(330, 196, kiteCols[1] === '#fff' ? '#3d7ee0' : kiteCols[1], '#ffd23f')}
      ${far}
      <path d="M-5 272 C50 248 120 244 180 248 C250 244 310 252 365 266 V${H + 5} H-5Z" fill="${u('Grass')}"/>
      <path d="M-5 272 C50 248 120 244 180 248 C250 244 310 252 365 266" fill="none" stroke="${t.patch}" stroke-width="3" opacity=".7"/>
      ${terraces.map((m) => `<path d="${cmapWave(m.x, m.y, H)}" fill="${u('Cliff')}"/><path d="${cmapWave(m.x, m.y, H, 3)}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".18"/><path d="${cmapWave(m.x, m.y, H, 9)}" fill="none" stroke="${t.cliff[1]}" stroke-width="2" stroke-dasharray="14 10 6 12" opacity=".5"/><path d="${cmapWave(m.x, m.y, H, 22)}" fill="${u('Grass')}"/><path d="${cmapWave(m.x, m.y, H, 27)}" fill="none" stroke="#1b2a12" stroke-width="9" opacity=".1"/><path d="${cmapWave(m.x, m.y, H, -1)}" fill="none" stroke="${t.grass[0]}" stroke-width="5" stroke-linecap="round"/>`).join('')}
      ${pts.map((p, i) => `<ellipse cx="${i % 2 ? 270 : 90}" cy="${p.y + 40}" rx="110" ry="40" fill="${t.patch}" opacity=".35"/>`).join('')}
      ${br ? `<path d="${river}" fill="none" stroke="${t.cliff[0]}" stroke-width="40" opacity=".55"/><path d="${river}" fill="none" stroke="${t.path[0]}" stroke-width="34"/><path d="${river}" fill="none" stroke="${u('Water')}" stroke-width="26"/>
        <path d="${river}" fill="none" stroke="${t.water[0]}" stroke-width="10" opacity=".6" transform="translate(0 -4)"/><path class="cmap-shine" d="${river}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 26" stroke-linecap="round" opacity=".8"/>` : ''}
      ${k.castle(castle.x, castle.y, allDone)}
      <path d="${cmapCurve(route)}" fill="none" stroke="#1b2a12" stroke-width="38" stroke-linecap="round" opacity=".16" transform="translate(0 5)"/>
      <path d="${cmapCurve(route)}" fill="none" stroke="${t.path[1]}" stroke-width="36" stroke-linecap="round"/>
      <path d="${cmapCurve(route)}" fill="none" stroke="${t.path[0]}" stroke-width="29" stroke-linecap="round"/>
      <path d="${cmapCurve(route)}" fill="none" stroke="${t.path[2]}" stroke-width="5" stroke-dasharray="9 7 4 12" stroke-linecap="round" opacity=".7" transform="translate(-7 0)"/>
      <path d="${cmapCurve(route)}" fill="none" stroke="${t.path[2]}" stroke-width="5" stroke-dasharray="5 11 8 8" stroke-linecap="round" opacity=".7" transform="translate(7 0)"/>
      <path d="${cmapCurve(walked)}" fill="none" stroke="#ffd23f" stroke-width="8" stroke-linecap="round" stroke-dasharray="1 15"/>
      <path d="${cmapCurve(walked)}" fill="none" stroke="#fff6c9" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 15"/>
      ${stairs}${br ? k.bridge(br.x, br.y, br.ang) : ''}${fences}${pads}
      ${items.map((it) => it[1]).join('')}
      ${k.butterfly(70, 430, t.flower[0], 'cmap-bfly')}${k.butterfly(300, 770, t.flower[3], 'cmap-bfly two')}
      ${allDone ? [[110, 120], [250, 110], [140, 70], [228, 160]].map(([sx, sy], i) => `<path d="M${sx} ${sy - 8} L${sx + 2} ${sy - 2} L${sx + 8} ${sy} L${sx + 2} ${sy + 2} L${sx} ${sy + 8} L${sx - 2} ${sy + 2} L${sx - 8} ${sy} L${sx - 2} ${sy - 2}Z" fill="#fff6a8" class="cmap-twinkle${i % 2 ? ' two' : ''}"/>`).join('') : ''}
      <g transform="translate(180 30)"><path d="M-58 -30 V-12 M58 -30 V-12" stroke="#7a4f2c" stroke-width="2"/><rect x="-80" y="-12" width="160" height="32" rx="7" fill="#5e3a1f" transform="translate(0 3)"/><rect x="-80" y="-14" width="160" height="32" rx="7" fill="${u('Wood')}" stroke="#7a4f2c" stroke-width="1.5"/>
        <path d="M-74 -6 H74 M-74 8 H74" stroke="#7a4f2c" stroke-width=".8" opacity=".35"/><text y="7" text-anchor="middle" font-size="13" font-weight="800" fill="#fff6dd">${path.levels[path.levels.length - 1].number === 50 ? '🏰 Il cuore del mondo' : 'La prossima zona ti aspetta'}</text></g>
    </svg>
    ${nodes}
  </div>`;
}
function campaignScrollToCurrent() {
  const el = $('.cmap-spot.current');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); else window.scrollTo(0, 0);
}
function campaignFocus(selector = '.campaign h1') {
  const el = $(selector); if (el) el.focus({ preventScroll: true });
}
/** Piccolo paesaggio della stagione di un percorso (schede dei percorsi e finestrella del livello) */
function campaignMiniArt(themeId, pre) {
  if (themeId === 'burraco') return '<img class="cad-mini-paint" src="art/campaign/garden.webp" alt="" loading="lazy">';
  const k = cmapKit(themeId, pre), t = k.t, u = k.u;
  const trees = t.kind === 'palm' ? k.palm(30, 112, 1) + k.palm(318, 108, 0.9) : k.tree(28, 112, 1) + k.tree(322, 110, 0.9) + k.tree(300, 116, 0.7);
  return `<svg viewBox="0 0 340 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${k.defs}
    <rect width="340" height="120" fill="${u('Sky')}"/><circle cx="290" cy="26" r="30" fill="${u('Sun')}"/><circle cx="290" cy="26" r="11" fill="#fff6c9"/>
    ${k.cloud(70, 28, 0.6)}${k.kite(250, 36, t.flower[0], '#ffd23f')}
    ${t.kind === 'palm' ? `<rect y="64" width="340" height="30" fill="${u('Far')}"/><path d="M40 74 h22 M200 78 h26" stroke="#fff" stroke-width="2" opacity=".7"/>` : `<path d="M0 78 L40 50 L80 70 L130 36 L180 72 L230 48 L280 74 L340 52 V100 H0Z" fill="${u('Far')}" opacity=".85"/>`}
    <path d="M0 92 Q90 70 170 84 Q260 70 340 90 V120 H0Z" fill="${u('Grass')}"/>
    <path d="M170 120 C170 104 140 100 160 90" stroke="${t.path[1]}" stroke-width="15" fill="none"/><path d="M170 120 C170 104 140 100 160 90" stroke="${t.path[0]}" stroke-width="11" fill="none"/>
    <g transform="translate(166 92) scale(.32)">${k.castle(0, 0, false).replace(/class="cmap-flag"/, '')}</g>
    ${trees}${k.flowers(84, 110, 3)}${k.card(250, 114, 8, 'A', 'S', 0.75)}${k.card(110, 112, -10, 'K', 'H', 0.7)}
  </svg>`;
}
function campaignScene() {
  const k = cmapKit('burraco', 'hero'), u = k.u, a = cmapKit('scala40', 'heroA'), m = cmapKit('ramino', 'heroM');
  return `<svg class="campaign-scene" viewBox="0 0 700 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${k.defs}${a.defs}${m.defs}
    <circle cx="560" cy="44" r="46" fill="${u('Sun')}"/><circle cx="560" cy="44" r="18" fill="#fff6c9"/>
    ${k.cloud(170, 40, 0.7, 'cmap-cloud slow')}${k.cloud(470, 62, 0.55, 'cmap-cloud')}${k.kite(260, 54, '#e5463b', '#ffd23f', 'cmap-kite')}${k.birds(420, 40)}
    <path d="M0 120 L60 84 L110 104 L180 66 L250 110 L320 90 L380 112 L450 80 L520 110 L600 76 L700 110 V190 H0Z" fill="${u('Far')}" opacity=".7"/>
    <path d="M0 126 Q120 86 250 118 Q330 136 350 136 V190 H0Z" fill="${a.u('Grass')}"/>
    <path d="M350 136 Q420 124 470 116 Q580 92 700 120 V190 H350Z" fill="${m.u('Grass')}"/>
    <path d="M200 150 Q330 104 350 104 Q380 104 500 146 V190 H200Z" fill="${u('Grass')}"/>
    <path d="M330 190 C340 160 310 150 335 132 C350 122 352 118 350 110" stroke="${k.t.path[1]}" stroke-width="22" fill="none"/><path d="M330 190 C340 160 310 150 335 132 C350 122 352 118 350 110" stroke="${k.t.path[0]}" stroke-width="16" fill="none"/>
    <g transform="translate(350 112) scale(.42)">${k.castle(0, 0, false)}</g>
    ${a.tree(150, 150, 0.9)}${a.pine(205, 150, 0.8)}${a.tree(100, 168, 1.1)}${m.palm(560, 150, 1)}${m.palm(612, 160, 0.85)}${m.lighthouse(650, 136, 0.6)}
    ${k.tree(280, 162, 0.8)}${k.tree(430, 166, 0.85)}${k.card(250, 182, -10, 'A', 'H', 1)}${k.card(470, 184, 9, 'K', 'S', 1)}${k.card(400, 186, -4, '★', 'H', 0.9)}
    ${k.flowers(300, 184, 3)}${k.flowers(520, 176, 3)}${k.mushroom(210, 178, 1)}${k.butterfly(380, 150, '#ff5f86', 'cmap-bfly')}
  </svg>`;
}
function campaignHTML() {
  const path = campaignPath();
  const progress = campaignCurrentProgress();
  const back = `<button class="btn ghost small" data-act="${path ? 'campaignPaths' : 'goHome'}">← ${path ? 'Tutti i percorsi' : 'Home'}</button>`;
  const note = `<p class="campaign-note">Progressi, aiuti e partite in pausa salvati su questo dispositivo. Una vita si ricarica ogni 30 minuti. Puoi rigiocare i livelli completati senza consumare vite.</p>${S.campaignSaveFailed ? '<p role="alert">Non riesco a salvare sul dispositivo. Puoi continuare, ma chiudendo la pagina perderai questi progressi.</p>' : ''}`;
  const stars = campaignStars();
  if (!path) return `<main class="page campaign">${back}${campaignWalletHTML()}
    <header class="campaign-hero"><span class="campaign-kicker">LA TUA AVVENTURA</span><h1 tabindex="-1">Un gioco, un percorso</h1><p>Scegli cosa vuoi imparare. Ogni avventura comincia da zero e cresce con te.</p>${campaignScene()}</header>
    <div class="campaign-paths">${Campaign.paths.map((p) => { const n = campaignCompleted(p, progress), st = p.levels.reduce((s, l) => s + campaignLevelStars(p, l, progress, stars), 0); return `<button class="campaign-path cp-${p.id}" data-act="campaignPath" data-id="${p.id}"><span class="cp-art" aria-hidden="true">${campaignMiniArt(p.id)}</span><span class="campaign-path-icon" aria-hidden="true">${p.icon}</span><span class="cp-text"><strong>${p.name}</strong><span>${p.subtitle}</span><small>${n === p.levels.length ? 'Primo mondo completato · Rigioca' : n ? `Riprendi · ${n} di ${p.levels.length} livelli` : 'Inizia · 50 livelli · 2 boss'}${st ? ` · <i class="cstar">★</i> ${st}/${p.levels.length * 3}` : ''}</small><span class="cp-pips" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<i class="${(i + 1) * 10 <= n ? 'on' : ''}"></i>`).join('')}</span></span><b aria-hidden="true">▶</b></button>`; }).join('')}</div>
    ${note}<button class="btn ghost" data-act="tutorial">📖 Preferisci leggere le regole?</button></main>`;
  const current = path.levels[S.campaignLevel];
  if (current) return campaignExerciseHTML(path, current, note);
  const completed = campaignCompleted(path, progress);
  const starSum = path.levels.reduce((s, l) => s + campaignLevelStars(path, l, progress, stars), 0);
  const chapter = Number.isInteger(S.campaignChapter) ? S.campaignChapter : Math.min(4, Math.floor(completed / 10));
  const mapPath = { ...path, levels: path.levels.slice(chapter * 10, chapter * 10 + 10) };
  return `<main class="page campaign campaign-world">${back}${campaignWalletHTML()}<header class="cmap-head"><span class="campaign-kicker">${esc(path.name)} · MONDO 1</span><h1 tabindex="-1">${esc(path.world)}</h1>
      <div class="cmap-stats"><span title="Livelli completati">🏁 ${completed}/${path.levels.length}</span><span title="Stelle raccolte"><i class="cstar">★</i> ${starSum}/${path.levels.length * 3}</span></div></header>
    ${campaignWorldGreeting(path)}
    <nav class="cad-chapters" aria-label="Zone del mondo">${CAMPAIGN_CHAPTERS[path.id].map((name, i) => `<button class="btn small ${i === chapter ? 'primary' : ''}" data-act="campaignChapter" data-i="${i}" aria-pressed="${i === chapter}">${i + 1}. ${esc(name)}<small>${i * 10 + 1}–${i * 10 + 10}</small></button>`).join('')}</nav>
    <p class="campaign-note">${esc(CAMPAIGN_CHAPTERS[path.id][chapter])} · Livelli ${chapter * 10 + 1}–${chapter * 10 + 10} · Boss al 25 e al 50</p>
    ${campaignWorldMapHTML(mapPath, progress, stars)}
    ${completed === path.levels.length ? `<div class="campaign-celebrate"><span class="cmedal" aria-hidden="true">🏰</span>${campaignConfetti()}<h2>Il primo mondo è tuo!</h2><p>Hai scoperto le basi di ${esc(path.name)}. Puoi rigiocare ogni livello o provarle al tavolo.</p><button class="btn primary" data-act="campaignTrain">Prova contro il computer</button></div>` : ''}
    ${note}<p class="campaign-note">${esc(path.rules)}. Le varianti personalizzate possono avere regole diverse.</p></main>`;
}
// coriandoli a forma di seme per la fine del livello (cadono una volta sola)
function campaignConfetti() {
  const cols = ['#e5463b', '#ffd23f', '#2fae5c', '#3d7ee0', '#ff7aa2', '#1f2433'];
  return `<span class="cconf" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 7.3 + 3) % 100}%;background:${cols[i % cols.length]};animation-delay:${(i % 5) * 0.12}s;--r:${(i % 2 ? 1 : -1) * (180 + i * 40)}deg"></i>`).join('')}</span>`;
}

Object.assign(handlers, {
  campaign() { closeModal(); S.campaignPath = null; S.campaignLevel = null; S.screen = 'campaign'; render(); window.scrollTo(0, 0); campaignFocus(); },
  campaignPaths() { S.campaignPath = null; S.campaignLevel = null; render(); window.scrollTo(0, 0); campaignFocus(); },
  campaignPath(el) { if (!Campaign.paths.some((p) => p.id === el.dataset.id)) return; S.campaignPath = el.dataset.id; S.campaignLevel = null; render(); campaignScrollToCurrent(); campaignFocus(); },
  campaignMap() { closeModal(); campaignStopTable(); S.campaignLevel = null; render(); campaignScrollToCurrent(); campaignFocus(); },
  campaignReplay() { handlers.campaignLevel({ dataset: { i: S.campaignLevel } }); },
  campaignTrain() {
    const path = campaignPath(); if (!path || !requireName()) return;
    S.playMode = 'bots'; S.screen = 'setup';
    handlers.pickGame({ dataset: { game: path.id } }); window.scrollTo(0, 0);
  }
});
