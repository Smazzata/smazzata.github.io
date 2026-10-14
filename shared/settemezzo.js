/*
 * Sette e mezzo: regole modificabili e valore di una mano. Condiviso tra server e browser.
 * Mazzo italiano da 40: dall'Asso al 7 valgono il loro numero, Fante, Cavallo e Re mezzo punto.
 * La "matta" (Re di denari, se in uso) vale quello che serve. Si gioca con fiches finte, mai con soldi veri.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoSetteMezzo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'players', label: 'Giocatori (banco compreso)', type: 'select', choices: [[2, '2'], [3, '3'], [4, '4']] },
    { group: 'Partita', key: 'target', label: 'Smazzate', type: 'select', choices: [[8, '8'], [12, '12'], [16, '16']] },
    { group: 'Carte', key: 'matta', label: 'Matta: il Re di denari vale quello che serve', type: 'bool' },
  ];
  const DEFAULTS = { game: 'settemezzo', players: 4, target: 12, matta: true };
  const START_CHIPS = 20;
  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      if (f.type === 'bool') out[f.key] = !!r[f.key];
      else { const v = Number(r[f.key]); if (f.choices.some(([o]) => o === v)) out[f.key] = v; }
    }
    out.game = 'settemezzo';
    return out;
  }
  const isMatta = (c, cfg) => !!(cfg && cfg.matta) && c.r === 10 && c.s === 'd';
  const value = (c) => (c.r <= 7 ? c.r : 0.5);
  /** Punteggio migliore di una mano (la matta prende il valore più utile senza sballare) */
  function total(cards, cfg) {
    let base = 0, mattas = 0;
    for (const c of cards) { if (isMatta(c, cfg)) mattas++; else base += value(c); }
    if (!mattas) return base;
    let best = base + 0.5;
    for (const v of [0.5, 1, 2, 3, 4, 5, 6, 7]) if (base + v <= 7.5 && base + v > best) best = base + v;
    return best;
  }
  /** "Sette e mezzo reale": 7,5 con due sole carte (un 7 e una figura, o la matta) */
  const reale = (cards, cfg) => cards.length === 2 && total(cards, cfg) === 7.5;
  /** 7.5 → "7 e ½", 0.5 → "½" */
  const fmt = (x) => (Number.isInteger(x) ? String(x) : Math.floor(x) ? `${Math.floor(x)} e ½` : '½');

  const PRESET = {
    id: 'settemezzo', name: 'Sette e mezzo', tagline: 'Il gioco delle feste: chiedi carte e avvicinati a 7 e mezzo senza sballare. Con fiches finte.', rules: { ...DEFAULTS },
    intro: '<p>Il Sette e mezzo si gioca con le carte italiane da 40: a turno si chiedono carte per avvicinarsi a <b>7 e mezzo</b> senza superarlo, e si sfida il <b>banco</b>. Qui si gioca con fiches finte.</p>',
  };
  function describe(r) {
    return `<h3>Sette e mezzo</h3>
<p>Mazzo italiano da 40 carte, ${r.players} giocatori; il <b>banco</b> passa a turno. Ognuno parte con ${START_CHIPS} fiches (finte) e riceve una carta coperta.</p>
<ul>
<li>Valori: dall'Asso al 7 il loro numero; Fante, Cavallo e Re <b>mezzo punto</b>.${r.matta ? ' Il <b>Re di denari</b> è la matta: vale quello che serve.' : ''}</li>
<li>A turno chiedi una carta (scoperta) toccando il mazzo, oppure ti fermi (✋). Se superi 7 e mezzo <b>sballi</b> e perdi subito la puntata.</li>
<li>Poi gioca il banco, vedendo le carte scoperte degli altri. Se il banco sballa paga tutti quelli rimasti in gioco.</li>
<li>Chi ha più del banco vince 1 fiche; a parità vince il banco. Il <b>sette e mezzo reale</b> (7 e mezzo con due carte) vale doppio.</li>
<li>Dopo <b>${r.target}</b> smazzate vince chi ha più fiches.</li>
</ul>`;
  }
  return { SCHEMA, DEFAULTS, PRESET, START_CHIPS, normalize, describe, total, reale, isMatta, value, fmt };
});
