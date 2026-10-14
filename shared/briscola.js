/*
 * Briscola: regole modificabili, forza e punti delle carte, chi vince una presa. Condiviso tra server e browser.
 * Mazzo italiano da 40: semi d (denari), c (coppe), s (spade), b (bastoni); 1-7, Fante 8, Cavallo 9, Re 10.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoBriscola = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'players', label: 'Giocatori', type: 'select', choices: [[2, '2'], [4, '4 (a coppie)']] },
    { group: 'Partita', key: 'target', label: 'Vince chi si aggiudica', type: 'select', choices: [[1, '1 smazzata'], [2, '2 smazzate'], [3, '3 smazzate']] },
  ];
  const DEFAULTS = { game: 'briscola', players: 2, target: 2 };
  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      const v = Number(r[f.key]);
      if (f.choices.some(([o]) => o === v)) out[f.key] = v;
    }
    out.game = 'briscola';
    return out;
  }
  // punti e forza: Asso, Tre, Re, Cavallo, Fante, 7, 6, 5, 4, 2
  const POINTS = { 1: 11, 3: 10, 10: 4, 9: 3, 8: 2 };
  const points = (c) => POINTS[c.r] || 0;
  const STRENGTH = { 1: 10, 3: 9, 10: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 2: 1 };
  const strength = (c) => STRENGTH[c.r];

  /** Indice della carta che vince la presa (carte nell'ordine in cui sono state giocate) */
  function winner(trick, trumpSuit) {
    let best = 0;
    for (let i = 1; i < trick.length; i++) {
      const a = trick[best], b = trick[i];
      const bTrump = b.s === trumpSuit, aTrump = a.s === trumpSuit;
      if (bTrump && !aTrump) best = i;
      else if (b.s === a.s && strength(b) > strength(a)) best = i;
    }
    return best;
  }

  const PRESET = {
    id: 'briscola', name: 'Briscola', tagline: 'Il classico delle osterie: prese, carichi e briscole, vince chi fa 61.', rules: { ...DEFAULTS },
    intro: '<p>La Briscola si gioca con le carte italiane da 40: a ogni giro ognuno gioca una carta e la presa va alla briscola più alta o alla carta più forte del seme di uscita. Vince la smazzata chi raccoglie almeno 61 punti su 120.</p>',
  };
  function describe(r) {
    return `<h3>Briscola</h3>
<p>Mazzo italiano da 40 carte. ${r.players === 4 ? 'In quattro si gioca a coppie' : 'In due'}: 3 carte a testa; la carta successiva, scoperta, indica il seme di <b>briscola</b> e resta in fondo al mazzo.</p>
<ul>
<li>A ogni giro ognuno gioca una carta (non c'è obbligo di rispondere al seme). Prende la <b>briscola più alta</b>; se non ci sono briscole, la carta più forte del <b>seme di uscita</b>.</li>
<li>Forza delle carte: Asso, Tre, Re, Cavallo, Fante, 7, 6, 5, 4, 2.</li>
<li>Chi prende pesca per primo dal mazzo e gioca per primo il giro successivo.</li>
<li>Punti: Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2 (in tutto 120). Vince la smazzata chi ne fa almeno <b>61</b> (60 a 60 è pari).</li>
<li>Vince la partita chi si aggiudica per primo <b>${r.target}</b> ${r.target === 1 ? 'smazzata' : 'smazzate'}.</li>
</ul>`;
  }
  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, points, strength, winner };
});
