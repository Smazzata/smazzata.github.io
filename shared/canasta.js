/*
 * Canasta (classica): regole modificabili, analisi delle combinazioni e valori delle carte.
 * Condiviso tra server (validazione) e browser (anteprima).
 *   - combinazioni solo di carte dello stesso valore (dal 4 all'Asso), almeno 2 naturali e al massimo 3 matte
 *   - matte: jolly e 2; i 3 rossi sono bonus, i 3 neri bloccano lo scarto
 *   - canasta: 7 carte (pulita 500, sporca 300); per chiudere serve almeno una canasta
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoCanasta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'players', label: 'Giocatori', type: 'select', choices: [[4, '4 (a coppie)'], [2, '2'], [3, '3']] },
    { group: 'Partita', key: 'target', label: 'Si vince a', type: 'select', choices: [[5000, '5000 punti'], [3000, '3000 punti'], [2000, '2000 punti']] },
    { group: 'Combinazioni', key: 'maxWild', label: 'Matte per combinazione', type: 'select', choices: [[3, 'al massimo 3'], [2, 'al massimo 2']] },
    { group: 'Punteggio', key: 'goOut', label: 'Bonus per la chiusura', type: 'select', choices: [[100, '100'], [200, '200']] },
  ];
  const DEFAULTS = { game: 'canasta', players: 4, target: 5000, maxWild: 3, goOut: 100 };

  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      const v = Number(r[f.key]);
      if (f.choices.some(([o]) => o === v)) out[f.key] = v;
    }
    out.game = 'canasta';
    return out;
  }

  const isJoker = (c) => c.r === 0;
  const isWild = (c) => c.r === 0 || c.r === 2;
  const isRed3 = (c) => c.r === 3 && (c.s === 'H' || c.s === 'D');
  const isBlack3 = (c) => c.r === 3 && (c.s === 'S' || c.s === 'C');
  /** valore di una carta (per l'apertura e per il conteggio) */
  const value = (c) => (isJoker(c) ? 50 : c.r === 2 || c.r === 1 ? 20 : c.r >= 8 ? 10 : 5);
  /** punti minimi per aprire, secondo il punteggio della squadra */
  const minimum = (score) => (score < 0 ? 15 : score < 1500 ? 50 : score < 3000 ? 90 : 120);

  /** Combinazione dello stesso valore: { rank, cards, wild, wildCount, length, points } */
  function analyzeMeld(cards, cfg) {
    if (cards.length < 3) return null;
    const nat = cards.filter((c) => !isWild(c));
    const wilds = cards.filter(isWild);
    if (nat.length < 2 || wilds.length > cfg.maxWild) return null;
    const rank = nat[0].r;
    if (rank === 3 || nat.some((c) => c.r !== rank)) return null;
    return {
      type: 'set', rank, cards: nat.concat(wilds), wild: nat.map(() => false).concat(wilds.map(() => true)),
      wildCount: wilds.length, length: cards.length, points: cards.reduce((s, c) => s + value(c), 0),
    };
  }

  /** Divide le carte in combinazioni (una per valore; le matte vanno dove servono) */
  function partitionMelds(cards, cfg) {
    const whole = analyzeMeld(cards, cfg);
    if (whole) return [whole];
    const wilds = cards.filter(isWild);
    const byRank = new Map();
    for (const c of cards.filter((x) => !isWild(x))) { if (!byRank.has(c.r)) byRank.set(c.r, []); byRank.get(c.r).push(c); }
    const groups = [...byRank.values()];
    if (groups.some((g) => g.length < 2) || groups.length < 2) return null;
    // le matte ai gruppi da 2 (ne servono per arrivare a 3), poi ai più lunghi
    const out = groups.map((g) => g.slice());
    const free = wilds.slice();
    for (const g of out) if (g.length === 2) { if (!free.length) return null; g.push(free.shift()); }
    for (const g of out) while (free.length && g.filter(isWild).length < cfg.maxWild) g.push(free.shift());
    if (free.length) return null;
    const res = out.map((g) => analyzeMeld(g, cfg));
    return res.every(Boolean) ? res : null;
  }

  /** Canasta: 7+ carte; pulita (senza matte) o sporca */
  const kindOf = (m) => (m.length < 7 ? null : m.wildCount ? 'dirty' : 'clean');

  const PRESET = {
    id: 'canasta', name: 'Canasta', tagline: 'La classica americana: solo combinazioni dello stesso valore, tre rossi, scarti congelati.', rules: { ...DEFAULTS },
    intro: '<p>La Canasta è la "madre" del Burraco: si fanno combinazioni di carte dello stesso valore e si punta alle canaste (7 carte). Si gioca di solito in quattro, a coppie.</p>',
  };

  function describe(r) {
    return `<h3>Canasta</h3>
<p>Due mazzi da 52 carte e 4 jolly. ${r.players === 4 ? 'In quattro si gioca a coppie, 11 carte a testa' : r.players === 3 ? 'In tre ognuno per sé, 13 carte a testa' : 'In due, 15 carte a testa'}. A ogni turno si pesca una carta (o si prende tutto il monte degli scarti), si cala e si scarta.</p>
<ul>
<li><b>Combinazioni</b> solo di carte <b>dello stesso valore</b> (dal 4 all'Asso): almeno 2 naturali e al massimo ${r.maxWild} matte. Matte: jolly e 2.</li>
<li><b>Canasta</b>: combinazione di 7 carte. <b>Pulita</b> (senza matte) 500 punti, <b>sporca</b> 300. Per chiudere serve almeno una canasta.</li>
<li><b>Tre rossi</b>: si mettono subito in tavola e si pesca un'altra carta; valgono 100 l'uno (800 tutti e quattro), ma in negativo se la squadra non ha calato nulla. I <b>tre neri</b> scartati bloccano il monte al giocatore successivo.</li>
<li><b>Apertura</b>: la prima calata deve valere almeno 50 punti (90 sopra i 1500, 120 sopra i 3000; 15 se si è sotto zero). Valori: jolly 50, Asso e 2 20, dall'8 al K 10, dal 4 al 7 5.</li>
<li><b>Monte degli scarti</b>: si prende tutto, ma la carta in cima va usata subito in una combinazione. È <b>congelato</b> finché la squadra non apre o se contiene una matta: allora servono due carte naturali uguali a quella in cima.</li>
<li>Chi chiude prende ${r.goOut} punti. Si contano le carte calate, le canaste e i tre rossi; si tolgono le carte rimaste in mano. Vince chi arriva a <b>${r.target}</b>.</li>
</ul>`;
  }

  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, isJoker, isWild, isRed3, isBlack3, value, minimum, analyzeMeld, partitionMelds, kindOf };
});
