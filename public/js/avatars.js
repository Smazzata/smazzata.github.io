/* Avatar originali di Smazzata. Le chiavi e restano compatibili con i profili già salvati. */
'use strict';
(function (root) {
  const catalog = typeof module === 'object' && module.exports ? require('../../shared/avatars') : root.SmazzataAvatarCatalog;
  const ink = '#294b3c';
  const suit = (kind, x, y, size, color) => {
    const shapes = {
      heart: 'M8 4C2-3-5 6 8 15 21 6 14-3 8 4Z',
      spade: 'M8 0C5 5 0 6 0 10c0 5 5 5 8 1 3 4 8 4 8-1C16 6 11 5 8 0Zm0 10-3 6h6Z',
      diamond: 'm8 0 8 8-8 8L0 8Z',
      club: 'M8 0a4 4 0 0 0-3 7c-7-3-7 8-1 7 2 0 3-1 4-3 1 2 2 3 4 3 6 1 6-10-1-7A4 4 0 0 0 8 0Zm0 10-3 6h6Z'
    };
    return `<g transform="translate(${x} ${y}) scale(${size / 16})"><path d="${shapes[kind]}" fill="${color}" stroke="none"/></g>`;
  };
  const eyes = (y = 29) => `<path d="M26 ${y}v2m12-2v2" stroke-width="2.7"/><path d="M28 ${y + 8}q4 3 8 0" stroke="#a36444"/>`;
  const collar = (color = '#d5765d', kind = 'heart') => `<path d="M13 62v-5c0-11 8-17 19-17s19 6 19 17v5" fill="${color}"/><path d="m23 43 9 10 9-10" fill="#fff0cb"/>${suit(kind, 28, 52, 8, '#b88228')}`;
  const crown = (color = '#efbf52') => `<path d="m18 19-3-13 10 6 7-10 7 10 10-6-3 13Z" fill="${color}" stroke="#946c2a"/><path d="M19 19h26v5H19Z" fill="#f7d989" stroke="#946c2a"/><circle cx="32" cy="15" r="2.5" fill="#ce6c55" stroke="none"/>`;
  const royal = (skin, hair, color, kind, headwear, long = false) => `${collar(color, kind)}${long ? `<path d="M18 43V27c0-19 28-19 28 0v16" fill="${hair}"/>` : ''}<ellipse cx="32" cy="29" rx="12" ry="15" fill="${skin}"/><path d="M20 26c-4-16 26-19 24 0-6-1-9-5-10-8-3 5-7 7-14 8Z" fill="${hair}"/>${eyes()}${headwear}`;
  const jester = (color, other) => `${collar(color, 'diamond')}<path d="M19 35c-5-6-5-16 1-22h24c6 6 6 16 1 22" fill="${other}"/><ellipse cx="32" cy="31" rx="12" ry="14" fill="#f7d6a5"/>${eyes(29)}<path d="M17 24 9 7c12-4 16 9 23 10C39 3 48 3 55 10L46 24Z" fill="${color}"/><path d="M32 17c-2-12-2-14 2-16l8 20" fill="${other}"/><circle cx="9" cy="7" r="3" fill="#efbf52"/><circle cx="55" cy="10" r="3" fill="#efbf52"/><circle cx="34" cy="2" r="2.5" fill="#efbf52"/><path d="M17 23q15-6 30 0" stroke="#a77d37" stroke-width="3"/>`;
  const card = kind => `<path d="M17 50 9 55m38-5 8 5M24 57v5m16-5v5" stroke="#a77d37" stroke-width="3"/><rect x="13" y="5" width="38" height="52" rx="8" fill="#fff4d5" stroke="#ac873e"/><path d="m19 18 3-7 3 7m-5-2h4" stroke="${['heart','diamond'].includes(kind) ? '#c66752' : '#397a58'}"/>${suit(kind, 22, 23, 20, ['heart','diamond'].includes(kind) ? '#d57860' : '#398566')}<path d="M27 30v2m10-2v2" stroke="#fff4d5" stroke-width="2.3"/><path d="M28 49q4 3 8 0" stroke="#b58c43"/>`;
  const ORIGINAL_ART = [
    { id: 're-cuori', e: '😎', name: 'Re di cuori', art: royal('#f3ca96', '#8c593c', '#c76b54', 'heart', crown()) },
    { id: 'regina-picche', e: '😇', name: 'Regina di picche', art: royal('#f6d7b1', '#3b4e52', '#5b8da1', 'spade', `<path d="m21 17-3-9 9 4 5-10 5 10 9-4-3 9Z" fill="#eac261" stroke="#9b7b37"/>${suit('spade', 29, 7, 6, '#3d7957')}`, true) },
    { id: 'fante-quadri', e: '🤠', name: 'Fante di quadri', art: royal('#b97852', '#3b3b32', '#548c78', 'diamond', `<path d="M17 22c-4-12 12-22 26-15 5 2 7 7 7 10Z" fill="#6099ac"/><path d="M16 22q18-8 34-5" stroke="#e8bd5b" stroke-width="4"/><path d="M43 12c9-8 11-7 10-10-6 0-10 3-10 10" fill="#fff0cb"/>`) },
    { id: 'dama-fiori', e: '🧐', name: 'Dama di fiori', art: royal('#b87750', '#49372d', '#7aa078', 'club', `<path d="M18 20q14-17 28 0" fill="none" stroke="#e8bd5b" stroke-width="4"/><circle cx="43" cy="16" r="6" fill="#d98370"/><circle cx="43" cy="16" r="2" fill="#f4d178" stroke="none"/>`, true) },
    { id: 'jolly-corallo', e: '🥳', name: 'Jolly corallo', art: jester('#d67c63', '#5b997b') },
    { id: 'jolly-zaffiro', e: '🤓', name: 'Jolly zaffiro', art: jester('#689fb2', '#9b86b7') },
    { id: 'mazziere', e: '😀', name: 'Il mazziere', art: `${collar('#398566')}<path d="M32 6v6"/><circle cx="32" cy="4" r="3" fill="#efbf52"/><path d="M15 24H9v13h6m34-13h6v13h-6" fill="#75a9ba"/><rect x="14" y="12" width="36" height="32" rx="13" fill="#fff0cb"/><path d="M20 16q12-6 24 0" stroke="#e8bd5b" stroke-width="3"/><circle cx="24" cy="28" r="2.5" fill="${ink}" stroke="none"/><circle cx="40" cy="28" r="2.5" fill="${ink}" stroke="none"/><path d="M26 36q6 4 12 0" stroke="#a87836"/><path d="m32 49-7-4v9l7-5 7 5v-9Z" fill="#d5765d"/><rect x="43" y="43" width="13" height="18" rx="2" fill="#fff0cb" transform="rotate(10 49 52)"/>${suit('heart', 46, 48, 7, '#d5765d')}` },
    { id: 'volpe', e: '🦊', name: 'Volpe del fante', art: `${collar('#5d91a3','diamond')}<path d="M11 11 27 18h10l16-7-3 28-18 12-18-12Z" fill="#ce7c48"/><path d="m16 17 7 5-8 5m33-10-7 5 8 5" fill="#855133"/><path d="m14 30 18 10 18-10-5 13-13 8-13-8Z" fill="#fff0cb"/><path d="m20 30 4-1m16 1 4-1" stroke-width="2.5"/><path d="m28 38 4 4 4-4Z" fill="${ink}"/><path d="M27 45q5 3 10 0"/><path d="M13 19q13-17 34-9l-7 9Z" fill="#528f6b"/>${suit('diamond', 30, 7, 8, '#efbf52')}` },
    { id: 'gatto', e: '😺', name: 'Gatto di cuori', art: `${collar('#c77a6b')}<path d="m14 10 13 9h10l13-9-1 26c-1 18-33 18-34 0Z" fill="#e4bc88"/><path d="m18 17 6 6-7 2m29-8-6 6 7 2" fill="#cf8f7c"/><path d="M22 31v2m20-2v2" stroke-width="2.6"/><path d="m29 37 3 3 3-3Z" fill="#c36e5d"/><path d="M32 40v3m-5 0q5 4 10 0M17 37l-7-2m7 6-7 1m37-5 7-2m-7 6 7 1"/>${suit('heart', 27, 51, 10, '#fff0cb')}` },
    { id: 'gufo', e: '🦉', name: 'Gufo stratega', art: `<path d="M16 37c-7 6-9 13-8 24h48c1-11-1-18-8-24" fill="#6598a9"/><path d="M15 9 26 15h12l11-6 1 26c-1 22-35 22-36 0Z" fill="#a47750"/><ellipse cx="24" cy="30" rx="10" ry="12" fill="#fff0cb"/><ellipse cx="40" cy="30" rx="10" ry="12" fill="#fff0cb"/><circle cx="25" cy="30" r="4" fill="${ink}"/><circle cx="39" cy="30" r="4" fill="${ink}"/><path d="m28 38 4 6 4-6Z" fill="#edbf53"/><path d="m20 52 12 7 12-7" stroke="#c9e2dc"/>${suit('spade', 28, 6, 8, '#edbf53')}` },
    { id: 'orso', e: '🐻', name: 'Orso fortunato', art: `${collar('#a38bb3','club')}<circle cx="16" cy="18" r="8" fill="#ad7e54"/><circle cx="48" cy="18" r="8" fill="#ad7e54"/><circle cx="16" cy="18" r="4" fill="#e7be8b" stroke="none"/><circle cx="48" cy="18" r="4" fill="#e7be8b" stroke="none"/><ellipse cx="32" cy="31" rx="22" ry="20" fill="#b58a61"/><ellipse cx="32" cy="38" rx="11" ry="9" fill="#f4d8a8"/><path d="M23 28v2m18-2v2" stroke-width="2.6"/><path d="m28 35 4 4 4-4Z" fill="${ink}"/><path d="M28 43q4 2 8 0"/>${suit('club', 39, 7, 11, '#56916b')}` },
    { id: 'tartaruga', e: '🐢', name: 'Tartaruga zen', art: `<path d="M10 63c-2-21 42-21 44 0" fill="#b18a4e"/><path d="m20 55 12 7 12-7" fill="#efd181"/><path d="M16 35c-4-29 36-29 32 0v5c-3 14-29 14-32 0Z" fill="#82ad7b"/><path d="M22 30q3-3 6 0m8 0q3-3 6 0" stroke-width="2"/><path d="M27 40q5 4 10 0"/><path d="M15 20 21 8h22l6 12Z" fill="#d5b86c"/><path d="M19 17h26" stroke="#987c39"/><path d="M9 21h46" stroke="#d5b86c" stroke-width="4"/>${suit('diamond', 28, 8, 8, '#498363')}` },
    { id: 'leone', e: '🦁', name: 'Leone reale', art: `${collar('#6999ae','spade')}<path d="m32 9 8 3 8-1 3 8 6 6-3 9 2 8-8 4-5 8-11-3-11 3-5-8-8-4 2-8-3-9 6-6 3-8 8 1Z" fill="#b87936"/><ellipse cx="32" cy="31" rx="15" ry="18" fill="#edc46f"/><path d="M24 29v2m16-2v2" stroke-width="2.6"/><ellipse cx="32" cy="39" rx="9" ry="7" fill="#fff0cb"/><path d="m28 35 4 4 4-4Z" fill="#815338"/><path d="M28 43q4 2 8 0"/>${crown()}` },
    { id: 'panda', e: '🐼', name: 'Panda di fiori', art: `${collar('#79a68b','club')}<circle cx="16" cy="16" r="8" fill="#38544e"/><circle cx="48" cy="16" r="8" fill="#38544e"/><ellipse cx="32" cy="31" rx="22" ry="21" fill="#fff0d1"/><ellipse cx="23" cy="30" rx="7" ry="9" fill="#38544e" transform="rotate(20 23 30)"/><ellipse cx="41" cy="30" rx="7" ry="9" fill="#38544e" transform="rotate(-20 41 30)"/><circle cx="24" cy="29" r="2" fill="#fff0d1" stroke="none"/><circle cx="40" cy="29" r="2" fill="#fff0d1" stroke="none"/><path d="m29 39 3 3 3-3Z" fill="#38544e"/><path d="M28 46q4 2 8 0"/>${suit('club', 40, 7, 12, '#559773')}` },
    { id: 'drago', e: '🐸', name: 'Drago smeraldo', art: `<path d="M12 61V50c-1-7 7-12 20-12s21 5 20 12v11" fill="#398566"/><path d="m18 20-5-15 13 9m20 6 5-15-13 9" fill="#e6bd68"/><path d="M16 30 7 21l3 18 11 5m27-14 9-9-3 18-11 5" fill="#80b5a0"/><path d="M17 26c-2-21 32-21 30 0l-1 14c-3 14-25 14-28 0Z" fill="#5a9e7e"/><path d="M23 27v3m18-3v3" stroke-width="2.5"/><ellipse cx="32" cy="38" rx="13" ry="8" fill="#b8cf94"/><path d="M27 36v1m10-1v1m-9 7q4 2 8 0"/>${suit('diamond', 27, 51, 10, '#f0ca6c')}` },
    { id: 'fenice', e: '🔥', name: 'Fenice dorata', art: `<path d="M32 56C9 56 2 37 6 20l17 14C14 21 20 10 24 6l8 16 8-16c4 4 10 15 1 28l17-14c4 17-3 36-26 36Z" fill="#cd7458"/><path d="M32 57C16 53 13 39 15 30l13 10-3-24 7 9 7-9-3 24 13-10c2 9-1 23-17 27Z" fill="#eabc58"/><ellipse cx="32" cy="35" rx="9" ry="14" fill="#fff0cb"/><path d="M27 33v2m10-2v2" stroke-width="2.4"/><path d="m29 39 3 5 3-5Z" fill="#cf7b45"/><path d="m32 55-8 7 8-2 8 2Z" fill="#d69a3e"/>` },
    { id: 'asso-cuori', e: '♥️', name: 'Asso di cuori', art: card('heart') },
    { id: 'asso-picche', e: '♠️', name: 'Asso di picche', art: card('spade') },
    { id: 'asso-quadri', e: '♦️', name: 'Asso di quadri', art: card('diamond') },
    { id: 'asso-fiori', e: '♣️', name: 'Asso di fiori', art: card('club') }
  ];
  const sparkle = (x,y,size=3,color='#edc873') => `<path d="m${x} ${y-size} 1 ${size-1} ${size-1} 1-${size-1} 1-1 ${size-1}-1-${size-1}-${size-1}-1 ${size-1}-1Z" fill="${color}" stroke="none"/>`;
  function backdrop(a) {
    let art='';
    if(['tails','nine-tails'].includes(a.gear)) {
      const angles=a.gear==='nine-tails'?[-68,-51,-34,-17,0,17,34,51,68]:[-42,-21,0,21,42];
      art+=angles.map(angle=>`<path d="M29 57C7 39 18 12 29 8 36 25 37 44 35 57Z" fill="${a.accent}" stroke="#a3865b" transform="rotate(${angle} 32 53)"/><path d="M29 8c-6 5-10 11-10 18l11-4Z" fill="#f8e8c9" stroke="none" transform="rotate(${angle} 32 53)"/>`).join('');
    }
    if(['wings','imperial'].includes(a.gear) || a.design==='griffin') art+=`<path d="M23 54C2 52 1 30 4 15l18 21-7-20 16 23m10 15c21-2 22-24 19-39L42 36l7-20-16 23" fill="${a.accent}" stroke="#a78a52"/>`;
    if(['aurora','stars','celestial','destiny'].includes(a.gear)) art+=`<path d="M4 36C-2 13 25-1 45 7S63 37 56 51C61 25 44 10 25 15S8 44 4 36Z" fill="${a.accent}" opacity=".6" stroke="none"/>${sparkle(8,19,4)}${sparkle(52,12,4)}${sparkle(56,42,3)}<path d="m9 16 10-8 11 3m19 33 7-10" stroke="#f9e4aa" stroke-width="1"/>`;
    if(a.design==='peacock') art+=`<path d="M11 53C-11 24 12-5 25 18 31-9 52-2 48 18 72 1 75 38 53 53Z" fill="#659d8c"/><path d="m11 23 16 24m20-24-10 24M32 9v36" stroke="#e6c67a"/>${[[11,24],[32,11],[51,25]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="5" ry="7" fill="#8eb9c3"/><ellipse cx="${x}" cy="${y}" rx="2" ry="3" fill="#d9be77" stroke="none"/>`).join('')}`;
    return art;
  }
  function accessory(a) {
    const c=a.accent,gold='#e6c477',light='#fff0ce';
    const extras={
      bow:`<path d="m32 49-8-5v10l8-5 8 5V44Z" fill="${c}" stroke="#8f7042"/><circle cx="32" cy="49" r="2" fill="${gold}"/>`,
      scarf:`<path d="M18 43q14 9 28 0l-1 7q-15 8-28-1Z" fill="${c}"/><path d="m36 51 9-2 3 11-9 2Z" fill="${c}"/><path d="m40 54 6-2m-5 6 6-2" stroke="${light}"/>`,
      glasses:`<circle cx="24" cy="29" r="7" fill="none" stroke="#a7833e"/><circle cx="40" cy="29" r="7" fill="none" stroke="#a7833e"/><path d="M31 28h2m-16-2-4-2m34 2 4-2" stroke="#a7833e"/>`,
      leaf:`<path d="M37 15C32 0 48 1 50 3c-1 11-10 14-13 12Z" fill="#72a17a"/><path d="m37 15 9-9" stroke="#c7dda0"/>`,
      flower:`<path d="M47 18c-13-3-8-13-2-9 0-9 12-8 9-1 10-1 10 10 2 10 4 8-7 13-10 5-8 5-12-5-7-7" fill="#d69a96"/><circle cx="49" cy="16" r="4" fill="${gold}"/>`,
      beret:`<path d="M14 20C6 7 36-1 48 9c7 8-3 12-3 12Z" fill="${c}"/><path d="M16 20h29" stroke="${gold}" stroke-width="3"/><path d="m31 7 3-5" stroke="#6f6553" stroke-width="3"/>`,
      cap:`<path d="M14 21c-1-20 32-20 34 0Z" fill="${c}"/><path d="M14 21h39q1 5-12 4Z" fill="${c}"/>${suit(a.suit,28,10,8,gold)}`,
      straw:`<path d="m15 21 5-13h24l6 13" fill="#ddc68b" stroke="#9c834b"/><path d="M20 16h24" stroke="${c}" stroke-width="4"/><path d="M8 22h48" stroke="#ddc68b" stroke-width="5"/>`,
      chef:`<path d="M17 23v-8C4 6 20-2 26 7c4-10 17-6 15 1 13-6 19 8 6 11v4Z" fill="${light}" stroke="#b5ac8c"/><path d="M18 23h28v-6H18Z" fill="${c}"/>`,
      sailor:`<path d="M15 19 10 7q22-9 44 0l-5 12" fill="${light}" stroke="#a5b3a5"/><path d="M16 18h32v5H16Z" fill="${c}"/>${suit(a.suit,28,8,8,'#b38d47')}`,
      explorer:`<path d="M13 22 20 7h24l7 15Z" fill="#c4ab77" stroke="#897749"/><path d="M19 17h27" stroke="${c}" stroke-width="4"/><path d="M7 23h50" stroke="#c4ab77" stroke-width="5"/>`,
      tophat:`<path d="M20 22 17 3h30l-3 19" fill="#405d60"/><path d="M19 18h26" stroke="${c}" stroke-width="5"/><path d="M11 24h43" stroke="#405d60" stroke-width="5"/>${suit('heart',28,7,8,gold)}`,
      moon:`<path d="M44 3C28 2 30 24 46 20 34 17 36 7 44 3Z" fill="${gold}" stroke="#a78745"/>`,
      gem:`<path d="m32 5 7 7-7 9-7-9Z" fill="${gold}" stroke="#ad8b4c"/><path d="m27 11 5-3 5 3-5 6Z" fill="#fff0b3" stroke="none"/>`,
      pirate:`<path d="M8 20c2-8 8-7 13-10l5-7h13l5 7c5 3 11 2 13 10l-12 4H20Z" fill="${c}"/><path d="M14 20q19-5 38 0" stroke="${gold}" stroke-width="2.5"/>${suit(a.suit,28,8,9,light)}`,
      pearls:`<path d="M20 45q12 13 24 0" fill="none" stroke="${light}" stroke-width="3"/>${[21,26,32,38,43].map((x,i)=>`<circle cx="${x}" cy="${[47,50,51,50,47][i]}" r="2" fill="${light}" stroke="#b7a37d"/>`).join('')}<path d="M20 17q12-14 24 0" stroke="${gold}" stroke-width="2.4" fill="none"/>`,
      crown:crown(gold),
      nightcap:`<path d="M16 21C8-2 45 0 52 17L41 12 44 22Z" fill="${c}"/><path d="M16 22h29" stroke="${light}" stroke-width="4"/><circle cx="52" cy="17" r="4" fill="${gold}"/>${sparkle(28,11,3,light)}`,
      admiral:`<path d="M14 20 7 9q24-15 50 0l-7 11Z" fill="${c}"/><path d="M15 20h34v5H15Z" fill="#354f56"/><path d="M18 20h28" stroke="${gold}" stroke-width="2"/>${suit(a.suit,27,6,10,gold)}`,
      goggles:`<path d="M16 20q16-8 32 0" stroke="#8b704a" stroke-width="5"/><circle cx="24" cy="19" r="7" fill="#c2e0dc" stroke="#ab8c4f" stroke-width="2.5"/><circle cx="40" cy="19" r="7" fill="#c2e0dc" stroke="#ab8c4f" stroke-width="2.5"/><path d="m20 17 3-2m13 2 3-2" stroke="${light}"/>`,
      wizard:`<path d="M13 22 28 1l8 9 13 12Z" fill="${c}"/><path d="M9 24h46" stroke="${c}" stroke-width="5"/><path d="M18 19h26" stroke="${gold}" stroke-width="3"/>${sparkle(29,12,4,gold)}`,
      hood:`<path d="M18 43C-2 12 13-3 32 1 51-3 66 12 46 43l-3-19C35 11 29 11 21 24Z" fill="${c}"/><path d="M19 43 29 51m16-8-10 8" stroke="${gold}"/>`,
      cape:`<path d="M16 35 6 60h18l8-9 8 9h18L48 35 40 44H24Z" fill="${c}" stroke="#a78b66"/><path d="m24 44 8 7 8-7" stroke="${gold}" stroke-width="2"/>`,
      oracle:`<path d="M15 20 20 5l7 6 5-10 5 10 7-6 5 15Z" fill="${c}" stroke="#a98b56"/><path d="M17 19h30" stroke="${gold}" stroke-width="3"/><ellipse cx="32" cy="13" rx="4" ry="3" fill="${light}"/><circle cx="32" cy="13" r="1.5" fill="#80709d" stroke="none"/>`,
      antlers:`<path d="M20 23 12 12V2m0 10L6 7m38 16 8-11V2m0 10 6-5" stroke="${gold}" stroke-width="3"/>`,
      armor:`<path d="m16 44-8 9 7 10h34l7-10-8-9-16 9Z" fill="${c}" stroke="#a88b51"/><path d="m12 52 12 4m28-4-12 4M32 54v7" stroke="${gold}" stroke-width="2"/>${suit(a.suit,28,51,8,light)}`,
      horns:`<path d="M18 19C3 18 7 3 12 2c-1 9 3 9 10 8m24 9c15-1 11-16 6-17 1 9-3 9-10 8" fill="${gold}" stroke="#a88852"/>`,
      veil:`<path d="M15 45C0 8 18-6 32 5 46-6 64 8 49 45l-6-23C36 15 28 15 21 22Z" fill="${c}"/><path d="M16 18q16-19 32 0" stroke="${gold}" stroke-width="2"/>${sparkle(32,9,4,gold)}`,
      witch:`<path d="M12 24 24 2l16 4-9 2 16 16Z" fill="${c}"/><path d="M7 25q24-10 50 0" stroke="${c}" stroke-width="6"/><path d="m19 19 21-2" stroke="${gold}" stroke-width="3"/><path d="M34 7c-8 1-7 10 1 10-5-2-5-7-1-10Z" fill="${light}" stroke="none"/>`,
      imperial:`${crown(gold)}<path d="M16 46 9 56l6 7h34l6-7-7-10-16 7Z" fill="${c}" stroke="#9c7940"/><path d="m17 50 15 9 15-9" stroke="${gold}" stroke-width="3"/>${suit(a.suit,28,51,8,light)}`,
      sun:`<circle cx="32" cy="12" r="8" fill="${gold}" stroke="#b48c42"/><path d="M32 0v3m-13 2 3 3m23-3-3 3M18 14h3m22 0h3" stroke="${gold}" stroke-width="2"/>`,
      celestial:`<path d="M18 18 21 5l7 8 4-12 4 12 7-8 3 13" fill="${c}" stroke="${gold}" stroke-width="2"/>${sparkle(32,11,4,light)}<path d="m19 48 13 9 13-9" stroke="${gold}" stroke-width="2"/>`,
      eternal:`<path d="M32 2q12 0 19 9l-7 12-12-6Z" fill="${gold}" stroke="#ac8b43"/>${sparkle(32,14,4,light)}<path d="m19 48 13 10 13-10" stroke="${gold}" stroke-width="2"/>`,
      destiny:`<path d="M14 8 19 3l6 2m14 0 6-2 5 5M14 55l5 6 6-2m14 0 6 2 5-6" stroke="${gold}" stroke-width="2"/>${sparkle(32,5,4,light)}`
    };
    if(a.gear==='knight') return `<path d="M16 40V20c0-23 32-23 32 0v20l-8-4V23H24v13Z" fill="#a1b4bb" stroke="#687b7c"/><path d="M32 5v15M18 20h28" stroke="${gold}" stroke-width="2"/>${suit('spade',28,8,8,'#557f82')}`;
    return extras[a.gear]||'';
  }
  function creature(a) {
    const f=a.color, c=a.accent, cream='#fff0cd', dark='#40584d';
    let base=collar(c,a.suit),head='',marks='';
    const round=`<ellipse cx="32" cy="32" rx="21" ry="20" fill="${f}"/>`;
    const smallEyes=`<circle cx="24" cy="30" r="2.2" fill="${ink}" stroke="none"/><circle cx="40" cy="30" r="2.2" fill="${ink}" stroke="none"/>`;
    const smile=`<path d="M27 43q5 3 10 0"/>`;
    const nose=`<path d="m29 36 3 3 3-3Z" fill="${ink}"/>`;
    switch(a.design) {
      case 'rabbit': head=`<ellipse cx="21" cy="16" rx="6" ry="16" fill="${f}" transform="rotate(-12 21 16)"/><ellipse cx="43" cy="16" rx="6" ry="16" fill="${f}" transform="rotate(12 43 16)"/><path d="M21 7v14m22-14v14" stroke="#d5a3a0" stroke-width="3"/>${round}`;marks=`<ellipse cx="32" cy="40" rx="12" ry="9" fill="${cream}"/>${smallEyes}<path d="m29 36 3 3 3-3Z" fill="#c98378"/><path d="M29 42h6v5h-6Z" fill="${cream}"/>`;break;
      case 'dog': head=`<path d="M19 16C2 7 2 42 14 43l8-19m23-8c17-9 17 26 5 27l-8-19" fill="#8c6c52"/>${round}`;marks=`<ellipse cx="32" cy="39" rx="13" ry="10" fill="${cream}"/>${smallEyes}${nose}${smile}`;break;
      case 'fox': case 'wolf': case 'cat': case 'redpanda':
        head=`<path d="m13 9 15 9h8l15-9-1 27c-2 20-34 20-36 0Z" fill="${f}"/><path d="m17 16 7 7-8 3m31-10-7 7 8 3" fill="${a.design==='wolf'?'#839eaa':'#c88672'}"/>`;
        marks=`<path d="m15 31 17 8 17-8-4 13-13 7-13-7Z" fill="${cream}"/>${smallEyes}${nose}${smile}`;
        if(a.design==='cat')marks+=`<path d="M16 36 8 34m9 7-8 2m39-7 8-2m-9 7 8 2m-27-21 4 5 4-5" stroke="#967749"/>`;
        if(a.design==='redpanda')marks+=`<path d="m18 25 8-3m12 0 8 3" stroke="${cream}" stroke-width="4"/>`;
        break;
      case 'raccoon': case 'badger': case 'panda':
        head=`<circle cx="17" cy="16" r="8" fill="${f}"/><circle cx="47" cy="16" r="8" fill="${f}"/>${round}`;
        marks=`<path d="M15 26q17-12 34 0l-4 13-13-5-13 5Z" fill="${dark}"/><ellipse cx="32" cy="42" rx="10" ry="7" fill="${cream}"/><circle cx="24" cy="29" r="2" fill="${cream}" stroke="none"/><circle cx="40" cy="29" r="2" fill="${cream}" stroke="none"/>${nose}${smile}`;
        if(a.design==='badger')marks+=`<path d="m30 15-5 20 7-2 7 2-5-20Z" fill="${cream}" stroke="none"/>`;
        if(a.design==='panda')marks+=`<path d="M17 24c-1-13 32-13 30 0l-15-4Z" fill="${cream}" stroke="none"/>`;
        break;
      case 'otter': case 'koala': case 'mouse': case 'bear': case 'squirrel':
        if(a.design==='squirrel')base=`<path d="M18 58C-7 55-2 17 12 16c13-2 16 15 3 18" fill="${f}"/>`+base;
        head=`<circle cx="16" cy="17" r="${a.design==='mouse'?11:8}" fill="${f}"/><circle cx="48" cy="17" r="${a.design==='mouse'?11:8}" fill="${f}"/><circle cx="16" cy="17" r="5" fill="${a.design==='mouse'?'#d6aaa0':cream}" stroke="none"/><circle cx="48" cy="17" r="5" fill="${a.design==='mouse'?'#d6aaa0':cream}" stroke="none"/>${round}`;
        marks=`<ellipse cx="32" cy="40" rx="12" ry="9" fill="${cream}"/>${smallEyes}${nose}${smile}`;
        if(a.design==='koala')marks+=`<ellipse cx="32" cy="32" rx="5" ry="7" fill="${dark}"/>`;
        if(a.design==='mouse')marks+=`<path d="m16 36-7-2m7 6-7 2m39-6 7-2m-7 6 7 2" stroke="#8c8070"/>`;
        if(a.design==='squirrel')marks+=`<path d="M29 40h6v6h-6Z" fill="${cream}"/>`;
        break;
      case 'hedgehog': case 'lion':
        head=`<path d="m32 5 7 7 10-2 2 10 9 5-5 9 4 10-10 3-5 10-12-5-12 5-5-10-10-3 4-10-5-9 9-5 2-10 10 2Z" fill="${a.design==='lion'?'#a97c3c':'#85664b'}"/><ellipse cx="32" cy="33" rx="17" ry="19" fill="${f}"/>`;
        marks=`<ellipse cx="32" cy="40" rx="10" ry="8" fill="${cream}"/>${smallEyes}${nose}${smile}`;break;
      case 'deer':
        head=`<path d="M20 23C4 23 4 11 5 7c12 2 16 8 15 16Zm24 0c16 0 16-12 15-16-12 2-16 8-15 16Z" fill="${f}"/><ellipse cx="32" cy="32" rx="16" ry="21" fill="${f}"/>`;
        marks=`<path d="M22 22h1m18 0h1" stroke="${cream}" stroke-width="3"/><ellipse cx="32" cy="43" rx="9" ry="8" fill="${cream}"/>${smallEyes}${nose}${smile}`;
        if(a.rarity!=='common')head=`<path d="m21 22-8-9V2m0 9-6-4m36 15 8-9V2m0 9 6-4" stroke="#b69a62" stroke-width="2.5"/>`+head;
        break;
      case 'tiger': head=`<circle cx="16" cy="16" r="8" fill="${f}"/><circle cx="48" cy="16" r="8" fill="${f}"/>${round}`;marks=`<path d="m30 14 2 8 2-8m-19 9 9 4-10 1m35-5-9 4 10 1m-34 7 7 2m24-2-7 2" stroke="#796148" stroke-width="2.5"/><ellipse cx="32" cy="40" rx="12" ry="9" fill="${cream}"/>${smallEyes}${nose}${smile}`;break;
      case 'frog': case 'turtle':
        head=`${a.design==='frog'?`<circle cx="20" cy="20" r="10" fill="${f}"/><circle cx="44" cy="20" r="10" fill="${f}"/>`:''}<ellipse cx="32" cy="34" rx="23" ry="18" fill="${f}"/>`;
        marks=a.design==='frog'?`<circle cx="20" cy="20" r="5" fill="${cream}"/><circle cx="44" cy="20" r="5" fill="${cream}"/><circle cx="21" cy="21" r="2" fill="${ink}"/><circle cx="43" cy="21" r="2" fill="${ink}"/><path d="M20 38q12 12 24 0"/>`:`${smallEyes}<path d="M21 41q11 9 22 0"/><path d="M25 36h1m12 0h1" stroke="#62835d"/>`;
        break;
      case 'owl':
        head=`<path d="m13 9 13 7h12l13-7v28c-1 20-37 20-38 0Z" fill="${f}"/>`;
        marks=`<ellipse cx="23" cy="31" rx="11" ry="13" fill="${cream}"/><ellipse cx="41" cy="31" rx="11" ry="13" fill="${cream}"/><circle cx="25" cy="31" r="4" fill="${ink}"/><circle cx="39" cy="31" r="4" fill="${ink}"/><path d="m28 39 4 6 4-6Z" fill="#d6a353"/>`;break;
      case 'penguin': case 'duck': case 'swan': case 'peacock':
        head=`<ellipse cx="32" cy="31" rx="20" ry="23" fill="${f}"/>`;
        marks=`<path d="M17 29c-3-14 12-18 15-9 3-9 18-5 15 9v6c-1 22-29 22-30 0Z" fill="${cream}"/>${smallEyes}<path d="m26 37 6 7 6-7Z" fill="#d4a252"/>`;
        if(a.design==='duck')marks+=`<ellipse cx="32" cy="39" rx="11" ry="4" fill="#dca45d"/>`;
        if(a.design==='peacock')head+=`<path d="M32 10V1m0 7-8-6m8 6 8-6" stroke="#c1a65e" stroke-width="2"/>`;
        break;
      case 'dragon': case 'unicorn': case 'griffin':
        head=`<path d="m19 22-8-18 15 10m19 8 8-18-15 10" fill="#dfc57e"/><path d="M17 29 6 23l4 17 12 5m25-16 11-6-4 17-12 5" fill="${c}"/><ellipse cx="32" cy="31" rx="18" ry="21" fill="${f}"/>`;
        marks=`${smallEyes}<ellipse cx="32" cy="41" rx="13" ry="9" fill="${cream}"/><path d="M27 39v1m10-1v1"/>${smile}`;
        if(a.design==='unicorn'){head=`<path d="M19 52C3 34 12 6 33 9 55 8 61 34 45 52Z" fill="${c}"/><ellipse cx="32" cy="32" rx="16" ry="21" fill="${f}"/><path d="m27 17 5-17 5 17Z" fill="#e4c77d"/><path d="m30 8 5 2m-6 3 7 2" stroke="#ae8c4b"/>`;marks=`${smallEyes}<ellipse cx="32" cy="43" rx="11" ry="8" fill="#ead9cf"/>${smile}`;}
        if(a.design==='griffin')marks=`${smallEyes}<path d="M25 34q12-6 18 7l-11 8-7-10Z" fill="#d7ad59"/><path d="m19 20 5 3m21-3-5 3" stroke="${cream}" stroke-width="3"/>`;
        break;
      case 'phoenix': head=`<path d="M32 57C8 56 0 39 5 19l18 14C15 18 20 8 25 3l7 19 7-19c5 5 10 15 2 30l18-14c5 20-3 37-27 38Z" fill="${f}"/><path d="M32 56C13 50 13 36 17 26l15 14 15-14c4 10 4 24-15 30Z" fill="${c}"/><ellipse cx="32" cy="34" rx="10" ry="17" fill="${cream}"/>`;marks=`<path d="M27 31v3m10-3v3" stroke-width="2.5"/><path d="m29 39 3 6 3-6Z" fill="#c5924d"/>`;break;
      case 'octopus': base=`<path d="M17 43C0 46 3 63 13 58l6-8c-8 17 8 19 10 4 2 16 16 16 17 0 8 15 18 4 8-5l-9-7Z" fill="${f}"/>`;head=`<path d="M12 34C3 0 61 0 52 34l-5 16H17Z" fill="${f}"/>`;marks=`<ellipse cx="23" cy="31" rx="4" ry="6" fill="${cream}"/><ellipse cx="41" cy="31" rx="4" ry="6" fill="${cream}"/>${smallEyes}${smile}`;break;
      case 'mantis': head=`<path d="M20 17 13 3m31 14 7-14" stroke="#b5bd7a" stroke-width="2"/><path d="m8 22 24-9 24 9-13 23H21Z" fill="${f}"/>`;marks=`<ellipse cx="18" cy="27" rx="7" ry="9" fill="${cream}"/><ellipse cx="46" cy="27" rx="7" ry="9" fill="${cream}"/><circle cx="20" cy="27" r="2" fill="${ink}"/><circle cx="44" cy="27" r="2" fill="${ink}"/><path d="M28 39q4 3 8 0m-12 13-9-7 3 14m22-7 9-7-3 14"/>`;break;
      default: head=round;marks=smallEyes+nose+smile;
    }
    return base+head+marks;
  }
  function extendedArt(a) {
    let body;
    if(a.design==='human') {
      const hair=['#5c4334','#8d6041','#424650','#b38455','#6b493b'][a.id.length%5];
      const long=/dama|incantatrice|regina|pasticciera|marinaia|pittrice|strega|guardiana/.test(a.id);
      body=royal(a.color,hair,a.accent,a.suit,'',long);
    } else if(a.design==='jester')body=jester(a.color,a.accent);
    else if(a.design==='card')body=`<path d="M12 20 4 59h17m31-39 8 39H43" fill="${a.accent}" stroke="#a88b56"/>${card(a.suit)}<path d="M16 8h7m18 0h7M16 53h7m18 0h7" stroke="#d2b574"/>`;
    else body=creature(a);
    return backdrop(a)+body+accessory(a);
  }
  const originalById = new Map(ORIGINAL_ART.map(a=>[a.id,a.art]));
  const LIST = catalog.LIST.map(a=>({...a,art:originalById.get(a.id)||extendedArt(a)}));
  const byId = new Map(LIST.map(a=>[a.id,a]));
  function resolve(value,name='') { return byId.get(catalog.resolve(value,name).id); }
  function ornament(a) {
    if(a.rarity==='common')return '';
    const color=catalog.RARITIES.find(r=>r.id===a.rarity).color;
    if(a.rarity==='rare')return sparkle(7,17,2.5,'#a9ccdd')+sparkle(55,46,2.5,'#a9ccdd');
    if(a.rarity==='epic')return `<path d="M9 47C-1 27 8 9 23 5m32 42C65 27 56 9 41 5" stroke="${color}" opacity=".35" stroke-width="2.5"/>${sparkle(7,16,3,'#d5bee5')}${sparkle(57,20,3,'#d5bee5')}`;
    return `<circle cx="32" cy="32" r="29" stroke="#e2c16d" stroke-width="2" opacity=".8"/><path d="m6 21 6 3m40 16 6 3M14 8l3 5m30 38 3 5M8 48l5-3m38-28 5-3" stroke="#eed396" stroke-width="1.5"/>${sparkle(8,15,3)}${sparkle(55,12,4)}${sparkle(55,48,3)}`;
  }
  function svg(value, name) {
    const entry = resolve(value, name);
    return `<svg class="avatar-art" viewBox="0 0 64 64" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ornament(entry)}${entry.art}</svg>`;
  }
  const api = { LIST, RARITIES:catalog.RARITIES, resolve, svg };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmazzataAvatars = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
