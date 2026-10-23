/* Avatar originali di Smazzata. Le chiavi e restano compatibili con i profili già salvati. */
'use strict';
(function (root) {
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
  const LIST = [
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
  const byKey = new Map();
  for (const entry of LIST) for (const key of [entry.id, entry.e, entry.e.replace(/\uFE0F/g, '')]) byKey.set(key, entry);
  for (const [old, id] of Object.entries({ '🐶':'orso', '🐯':'leone', '🐵':'fante-quadri', '🦄':'regina-picche', '🐙':'jolly-zaffiro', '🌻':'dama-fiori', '🍀':'panda', '⭐':'fenice' })) byKey.set(old, byKey.get(id));
  function resolve(value, name = '') {
    if (byKey.has(value)) return byKey.get(value);
    let hash = 0;
    for (const char of String(name)) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return LIST[hash % LIST.length];
  }
  function svg(value, name) {
    const entry = resolve(value, name);
    return `<svg class="avatar-art" viewBox="0 0 64 64" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${entry.art}</svg>`;
  }
  const api = { LIST, resolve, svg };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SmazzataAvatars = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
