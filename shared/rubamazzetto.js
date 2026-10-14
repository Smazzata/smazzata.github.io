/*
 * Rubamazzetto: regole modificabili e prese possibili. Condiviso tra server e browser.
 * Mazzo italiano da 40. Ognuno per sé: con una carta si prende la carta dello stesso valore in tavola,
 * oppure si "ruba" il mazzetto di un avversario se la sua carta in cima ha lo stesso valore.
 * Vince la smazzata chi ha il mazzetto più alto.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoRubamazzetto = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'players', label: 'Giocatori', type: 'select', choices: [[2, '2'], [3, '3'], [4, '4 (ognuno per sé)']] },
    { group: 'Partita', key: 'target', label: 'Vince chi si aggiudica', type: 'select', choices: [[1, '1 smazzata'], [2, '2 smazzate'], [3, '3 smazzate']] },
  ];
  const DEFAULTS = { game: 'rubamazzetto', players: 2, target: 2 };
  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      const v = Number(r[f.key]);
      if (f.choices.some(([o]) => o === v)) out[f.key] = v;
    }
    out.game = 'rubamazzetto';
    return out;
  }

  /**
   * Mosse possibili con una carta: rubare un mazzetto (la cui carta in cima ha lo stesso valore),
   * prendere una carta uguale dal tavolo, o lasciarla in tavola se non si può fare altro.
   * piles: per ogni giocatore l'elenco delle carte del suo mazzetto (l'ultima è in cima).
   */
  function moves(card, table, piles, seat) {
    const out = [];
    piles.forEach((p, s) => {
      if (s !== seat && p.length && p[p.length - 1].r === card.r) out.push({ kind: 'steal', from: s, gain: p.length + 1 });
    });
    const same = table.find((c) => c.r === card.r);
    if (same) out.push({ kind: 'table', cardId: same.id, gain: 2 });
    return out;
  }

  const PRESET = {
    id: 'rubamazzetto', name: 'Rubamazzetto', tagline: 'Il gioco di carte dei bambini (e dei nonni): prendi le carte uguali e ruba il mazzetto agli altri.', rules: { ...DEFAULTS },
    intro: '<p>Il Rubamazzetto si gioca con le carte italiane da 40, ognuno per sé. Si prende la carta uguale dal tavolo e la si mette in cima al proprio mazzetto; se la carta in cima al mazzetto di un altro è uguale alla tua, gli rubi tutto il mazzetto!</p>',
  };
  function describe(r) {
    return `<h3>Rubamazzetto</h3>
<p>Mazzo italiano da 40 carte, ${r.players} giocatori, ognuno per sé: 3 carte a testa e 4 scoperte in tavola; finite le carte se ne danno altre 3 finché c'è mazzo.</p>
<ul>
<li>A turno giochi una carta. Se la carta in cima al <b>mazzetto di un avversario</b> ha lo stesso valore, glielo <b>rubi</b> tutto e lo metti sopra il tuo.</li>
<li>Altrimenti, se in tavola c'è una carta <b>dello stesso valore</b>, la prendi e la metti nel tuo mazzetto, con la tua carta in cima.</li>
<li>Se non puoi prendere nulla, la carta resta in tavola.</li>
<li>Il tuo mazzetto si vede: la carta in cima è quella che gli altri possono usare per rubartelo.</li>
<li>Finite le carte, vince la smazzata chi ha il <b>mazzetto più alto</b>. Vince la partita chi si aggiudica per primo <b>${r.target}</b> ${r.target === 1 ? 'smazzata' : 'smazzate'}.</li>
</ul>`;
  }
  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, moves };
});
