/*
 * Scala 40: regole modificabili, analisi delle combinazioni e valori delle carte.
 * Condiviso tra server (validazione) e browser (anteprima).
 *   - scale: stesso seme, carte consecutive; l'Asso va prima del 2 o dopo il K (non si "gira")
 *   - tris/poker: 3-4 carte dello stesso valore, tutte di semi diversi
 *   - matte: solo i jolly (al massimo `maxJokers` per combinazione)
 *   - valori: Asso 11 (1 nella scala A-2-3), figure 10, le altre il loro numero; il jolly vale la carta che sostituisce
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoScala40 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'players', label: 'Giocatori', type: 'select', choices: [[2, '2'], [3, '3'], [4, '4']] },
    { group: 'Partita', key: 'target', label: 'Eliminato chi arriva a', type: 'select', choices: [[101, '101 punti'], [201, '201 punti']] },
    { group: 'Combinazioni', key: 'opening', label: 'Punti per aprire', type: 'select', choices: [[40, '40'], [30, '30'], [50, '50']] },
    { group: 'Combinazioni', key: 'maxJokers', label: 'Jolly per combinazione', type: 'select', choices: [[1, 'al massimo 1'], [2, 'al massimo 2']] },
    { group: 'Combinazioni', key: 'swapJoker', label: 'Si può prendere un jolly dal tavolo sostituendolo', type: 'bool' },
    { group: 'Combinazioni', key: 'pileNeedsOpen', label: 'Lo scarto si prende solo se si è aperto (o si apre subito con esso)', type: 'bool' },
    { group: 'Combinazioni', key: 'jokerUseNow', label: 'Il jolly preso dal tavolo va usato nello stesso turno', type: 'bool' },
    { group: 'Punteggio', key: 'closeInHandDouble', label: 'Chiusura in mano (apri e chiudi nello stesso turno): penalità doppie agli altri', type: 'bool' },
  ];
  const DEFAULTS = { game: 'scala40', players: 4, target: 101, opening: 40, maxJokers: 1, swapJoker: true, pileNeedsOpen: true, jokerUseNow: false, closeInHandDouble: false };

  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      if (f.type === 'bool') out[f.key] = !!r[f.key];
      else {
        const v = Number(r[f.key]);
        if (f.choices.some(([o]) => o === v)) out[f.key] = v;
      }
    }
    out.game = 'scala40';
    return out;
  }

  const isJoker = (c) => c.r === 0;
  /** valore di una carta in una posizione (p = 1..14; l'Asso vale 1 solo in A-2-3) */
  const posValue = (p) => (p === 1 ? 1 : p === 14 ? 11 : p >= 11 ? 10 : p);
  /** valore in mano (penalità a fine smazzata) */
  const handValue = (c) => (isJoker(c) ? 25 : c.r === 1 ? 11 : c.r >= 11 ? 10 : c.r);

  function analyzeSet(cards, cfg) {
    if (cards.length < 3 || cards.length > 4) return null;
    const nat = cards.filter((c) => !isJoker(c));
    const jokers = cards.filter(isJoker);
    if (!nat.length || jokers.length > cfg.maxJokers || jokers.length >= nat.length + jokers.length - 1) return null;
    const rank = nat[0].r;
    if (nat.some((c) => c.r !== rank)) return null;
    if (new Set(nat.map((c) => c.s)).size !== nat.length) return null; // semi tutti diversi
    const v = posValue(rank === 1 ? 14 : rank);
    const order = { S: 0, H: 1, D: 2, C: 3 };
    return {
      type: 'set', rank, cards: nat.slice().sort((a, b) => order[a.s] - order[b.s]).concat(jokers),
      wild: nat.map(() => false).concat(jokers.map(() => true)), length: cards.length, wildCount: jokers.length,
      points: v * cards.length,
    };
  }

  function analyzeSequence(cards, cfg) {
    if (cards.length < 3 || cards.length > 13) return null;
    const nat = cards.filter((c) => !isJoker(c));
    const jokers = cards.filter(isJoker);
    if (!nat.length || jokers.length > cfg.maxJokers) return null;
    const suit = nat[0].s;
    if (nat.some((c) => c.s !== suit)) return null;
    const aces = nat.filter((c) => c.r === 1);
    if (aces.length > 1) return null;
    let best = null;
    for (const acePos of aces.length ? [1, 14] : [null]) {
      const pos = nat.map((c) => (c.r === 1 ? acePos : c.r));
      if (new Set(pos).size !== pos.length) continue;
      const lo0 = Math.min(...pos), hi0 = Math.max(...pos);
      const gaps = hi0 - lo0 + 1 - nat.length;
      if (gaps > jokers.length) continue;
      let lo = lo0, hi = hi0, extra = jokers.length - gaps;
      while (extra > 0) { if (hi < 14 && !(acePos === 1 && hi >= 13)) hi++; else if (lo > 1) lo--; else break; extra--; }
      if (extra > 0 || hi - lo + 1 > 13) continue;
      const byPos = new Map(nat.map((c, i) => [pos[i], c]));
      const ordered = [], wild = [], reps = [];
      const jq = jokers.slice();
      let points = 0;
      for (let p = lo; p <= hi; p++) {
        if (byPos.has(p)) { ordered.push(byPos.get(p)); wild.push(false); } else { ordered.push(jq.shift()); wild.push(true); }
        reps.push(p);
        points += posValue(p);
      }
      const an = { type: 'seq', suit, cards: ordered, wild, reps, lo, hi, length: ordered.length, wildCount: jokers.length, points };
      if (!best || an.points > best.points) best = an;
    }
    return best;
  }

  function analyzeMeld(cards, cfg, type) {
    if (type === 'set') return analyzeSet(cards, cfg);
    if (type === 'seq') return analyzeSequence(cards, cfg);
    return analyzeSequence(cards, cfg) || analyzeSet(cards, cfg);
  }

  /** Divide le carte in una o più combinazioni valide (per calare più giochi insieme) */
  function partitionMelds(cards, cfg) {
    const whole = analyzeMeld(cards, cfg);
    if (whole) return [whole];
    if (cards.length < 6 || cards.length > 14) return null;
    const n = cards.length;
    // ricerca: il primo gruppo contiene sempre la prima carta
    const rest = cards.slice(1);
    const m = rest.length;
    for (let mask = 0; mask < (1 << m); mask++) {
      const size = 1 + popcount(mask);
      if (size < 3 || n - size < 3) continue;
      const a = [cards[0]], b = [];
      for (let i = 0; i < m; i++) (mask & (1 << i) ? a : b).push(rest[i]);
      const an = analyzeMeld(a, cfg);
      if (!an) continue;
      const others = partitionMelds(b, cfg);
      if (others) return [an, ...others];
    }
    return null;
  }
  function popcount(x) { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; }

  const PRESET = {
    id: 'scala40', name: 'Scala 40', tagline: 'Il classico italiano: apri con 40 punti, attacca ovunque, chi arriva a 101 è fuori.', rules: { ...DEFAULTS },
    intro: '<p>La Scala 40 è il gioco di carte più diffuso in Italia insieme al Burraco: ognuno gioca per sé, si apre con almeno 40 punti e si cerca di restare senza carte prima degli altri.</p>',
  };

  function describe(r) {
    return `<h3>Scala 40</h3>
<p>Due mazzi da 52 carte e 4 jolly. Ognuno gioca per sé con <b>13 carte</b>. A ogni turno si pesca (dal tallone o lo scarto in cima), si calano o attaccano carte e si scarta.</p>
<ul>
<li><b>Combinazioni</b>: scale dello stesso seme (l'Asso va prima del 2 o dopo il K) e tris o poker di semi tutti diversi. Le matte sono solo i jolly (${r.maxJokers === 1 ? 'al massimo 1' : 'al massimo 2'} per combinazione).</li>
<li><b>Apertura</b>: la prima calata deve valere almeno <b>${r.opening} punti</b> (Asso 11, o 1 in A-2-3; figure 10; le altre il loro numero; il jolly vale la carta che sostituisce). Prima di aprire non si può attaccare${r.pileNeedsOpen ? ' e lo scarto si prende solo per aprire subito con esso' : ''}.</li>
<li>Dopo l'apertura si attacca a <b>tutti</b> i giochi sul tavolo${r.swapJoker ? ` e si può prendere un jolly dal tavolo mettendo al suo posto la carta che rappresenta${r.jokerUseNow ? ' (il jolly va usato nello stesso turno)' : ''}` : ''}.</li>
<li>Chiude chi scarta l'ultima carta. Gli altri si segnano i punti delle carte rimaste in mano (jolly 25, Asso 11, figure 10)${r.closeInHandDouble ? '; se chi chiude ha aperto nello stesso turno (<b>chiusura in mano</b>) le penalità raddoppiano' : ''}.</li>
<li>Se il tallone finisce si rimescolano gli scarti; alla terza volta la smazzata finisce senza chiusura e ognuno paga le carte che ha in mano.</li>
<li>Chi arriva a <b>${r.target}</b> punti è eliminato: vince l'ultimo rimasto.</li>
</ul>`;
  }

  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, isJoker, posValue, handValue, analyzeSet, analyzeSequence, analyzeMeld, partitionMelds };
});
