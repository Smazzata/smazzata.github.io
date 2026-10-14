/*
 * Tressette: regole modificabili, forza e punti delle carte, chi vince una presa, accusi. Condiviso tra server e browser.
 * Mazzo italiano da 40: semi d (denari), c (coppe), s (spade), b (bastoni); 1-7, Fante 8, Cavallo 9, Re 10.
 * Punti in terzi: l'Asso vale 1 punto (3 terzi), Tre, Due e figure 1/3 (1 terzo), le altre nulla; l'ultima presa vale 1 punto.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoTressette = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'players', label: 'Giocatori', type: 'select', choices: [[4, '4 (a coppie)'], [2, '2 (si pesca dal mazzo)']] },
    { group: 'Partita', key: 'target', label: 'Si vince a', type: 'select', choices: [[21, '21 punti'], [31, '31 punti']] },
    { group: 'Punteggio', key: 'accusi', label: 'Accusi (napoletana e tris o poker di Assi, Due o Tre)', type: 'bool' },
  ];
  const DEFAULTS = { game: 'tressette', players: 4, target: 31, accusi: true };
  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      if (f.type === 'bool') out[f.key] = !!r[f.key];
      else { const v = Number(r[f.key]); if (f.choices.some(([o]) => o === v)) out[f.key] = v; }
    }
    out.game = 'tressette';
    return out;
  }

  // forza: Tre, Due, Asso, Re, Cavallo, Fante, 7, 6, 5, 4
  const STRENGTH = { 3: 10, 2: 9, 1: 8, 10: 7, 9: 6, 8: 5, 7: 4, 6: 3, 5: 2, 4: 1 };
  const strength = (c) => STRENGTH[c.r];
  /** punti di una carta in terzi di punto */
  const thirds = (c) => (c.r === 1 ? 3 : [2, 3, 8, 9, 10].includes(c.r) ? 1 : 0);

  /** Indice della carta che vince la presa: la più forte del seme di uscita (non ci sono briscole) */
  function winner(trick) {
    let best = 0;
    for (let i = 1; i < trick.length; i++) if (trick[i].s === trick[0].s && strength(trick[i]) > strength(trick[best])) best = i;
    return best;
  }

  /** Carte giocabili: bisogna rispondere al seme di uscita, se si può */
  function legal(hand, trick) {
    if (!trick.length) return hand.slice();
    const lead = trick[0].s;
    const same = hand.filter((c) => c.s === lead);
    return same.length ? same : hand.slice();
  }

  /** Accusi di una mano (10 carte): napoletana (Asso, Due, Tre dello stesso seme) e tris/poker di Assi, Due o Tre */
  function accusi(hand) {
    const out = [];
    const SUIT = { d: 'denari', c: 'coppe', s: 'spade', b: 'bastoni' };
    for (const s of ['d', 'c', 's', 'b']) {
      if ([1, 2, 3].every((r) => hand.some((c) => c.s === s && c.r === r))) out.push({ label: `napoletana di ${SUIT[s]}`, points: 3 });
    }
    const NAMES = { 1: 'Assi', 2: 'Due', 3: 'Tre' };
    for (const r of [1, 2, 3]) {
      const n = hand.filter((c) => c.r === r).length;
      if (n >= 3) out.push({ label: `${n === 4 ? 'quattro' : 'tre'} ${NAMES[r]}`, points: n });
    }
    return out;
  }

  const PRESET = {
    id: 'tressette', name: 'Tressette', tagline: 'Il re dei giochi italiani a coppie: si risponde al seme, contano Assi, Due, Tre e figure.', rules: { ...DEFAULTS },
    intro: '<p>Il Tressette si gioca con le carte italiane da 40, di solito in quattro a coppie. Non ci sono briscole: si deve rispondere al seme e prende la carta più forte del seme di uscita. Il Tre è la carta più forte.</p>',
  };
  function describe(r) {
    return `<h3>Tressette</h3>
<p>Mazzo italiano da 40 carte (denari, coppe, spade, bastoni). ${r.players === 4
    ? 'In quattro a coppie (i compagni uno di fronte all\'altro): 10 carte a testa, senza mazzo.'
    : 'In due: 10 carte a testa; dopo ogni presa ognuno pesca una carta dal mazzo (prima chi ha preso), finché il mazzo finisce.'}</p>
<ul>
<li>Chi apre gioca una carta; gli altri <b>devono rispondere al seme</b> se possono. Prende la carta più forte del <b>seme di uscita</b> (non ci sono briscole).</li>
<li>Forza delle carte: <b>Tre, Due, Asso</b>, Re, Cavallo, Fante, 7, 6, 5, 4.</li>
<li>Punti: l'<b>Asso</b> vale 1 punto; <b>Tre, Due e figure</b> valgono 1/3 di punto; le altre nulla. L'<b>ultima presa</b> vale 1 punto. In tutto 11 punti a smazzata (i terzi si arrotondano per difetto).</li>
${r.accusi ? '<li><b>Accusi</b> (si dichiarano a inizio smazzata): napoletana (Asso, Due e Tre dello stesso seme) 3 punti; tre Assi, Due o Tre 3 punti, tutti e quattro 4 punti.</li>' : ''}
<li>Vince chi arriva per primo a <b>${r.target}</b> punti.</li>
</ul>`;
  }
  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, strength, thirds, winner, legal, accusi };
});
