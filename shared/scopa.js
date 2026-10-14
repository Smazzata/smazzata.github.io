/*
 * Scopa: regole modificabili, prese possibili e conteggio dei punti. Condiviso tra server e browser.
 * Mazzo italiano da 40 carte: semi d (denari), c (coppe), s (spade), b (bastoni); valori 1-7, Fante 8, Cavallo 9, Re 10.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoScopa = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'players', label: 'Giocatori', type: 'select', choices: [[2, '2'], [4, '4 (a coppie)']] },
    { group: 'Partita', key: 'target', label: 'Si vince a', type: 'select', choices: [[11, '11 punti'], [21, '21 punti']] },
    { group: 'Prese', key: 'aceTakesAll', label: 'Asso piglia tutto (l\'Asso prende tutte le carte in tavola)', type: 'bool' },
  ];
  const DEFAULTS = { game: 'scopa', players: 2, target: 11, aceTakesAll: false };
  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      if (f.type === 'bool') out[f.key] = !!r[f.key];
      else { const v = Number(r[f.key]); if (f.choices.some(([o]) => o === v)) out[f.key] = v; }
    }
    out.game = 'scopa';
    return out;
  }

  /** Prese possibili con una carta: prima le carte di valore uguale, altrimenti le combinazioni che sommano al valore */
  function captures(card, table, cfg) {
    if (cfg && cfg.aceTakesAll && card.r === 1 && table.length && !table.some((c) => c.r === 1)) return [table.slice()];
    const same = table.filter((c) => c.r === card.r);
    if (same.length) return same.map((c) => [c]);
    const out = [];
    const n = table.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      let sum = 0;
      const pick = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += table[i].r; pick.push(table[i]); }
      if (sum === card.r && pick.length >= 2) out.push(pick);
    }
    return out;
  }

  // primiera: valore delle carte (si sceglie la migliore per ogni seme)
  const PRIM = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 };
  function primiera(cards) {
    let tot = 0;
    for (const s of ['d', 'c', 's', 'b']) {
      const best = Math.max(0, ...cards.filter((c) => c.s === s).map((c) => PRIM[c.r]));
      if (!best) return 0; // serve almeno una carta per seme
      tot += best;
    }
    return tot;
  }

  /** Punti di fine smazzata per ogni squadra: carte, denari, settebello, primiera, scope */
  function handPoints(taken, scope) {
    const n = taken.length;
    const res = taken.map(() => ({ carte: 0, denari: 0, settebello: 0, primiera: 0, scope: 0 }));
    const best = (vals, key) => {
      const max = Math.max(...vals);
      if (vals.filter((v) => v === max).length === 1 && max > 0) res[vals.indexOf(max)][key] = 1;
    };
    best(taken.map((t) => t.length), 'carte');
    best(taken.map((t) => t.filter((c) => c.s === 'd').length), 'denari');
    for (let i = 0; i < n; i++) if (taken[i].some((c) => c.s === 'd' && c.r === 7)) res[i].settebello = 1;
    best(taken.map(primiera), 'primiera');
    for (let i = 0; i < n; i++) res[i].scope = scope[i];
    return res.map((r) => ({ ...r, total: r.carte + r.denari + r.settebello + r.primiera + r.scope }));
  }

  const PRESET = {
    id: 'scopa', name: 'Scopa', tagline: 'La regina dei giochi italiani: prendi le carte, fai scopa, conta denari e primiera.', rules: { ...DEFAULTS },
    intro: '<p>La Scopa si gioca con le carte italiane da 40. Si prende dal tavolo la carta dello stesso valore o più carte che sommano al valore giocato; chi pulisce il tavolo fa <b>scopa</b>.</p>',
  };

  function describe(r) {
    return `<h3>Scopa</h3>
<p>Mazzo italiano da 40 carte (denari, coppe, spade, bastoni; Fante 8, Cavallo 9, Re 10). ${r.players === 4 ? 'In quattro si gioca a coppie' : 'In due'}: 3 carte a testa e 4 scoperte in tavola; finite le carte se ne danno altre 3 finché c'è mazzo.</p>
<ul>
<li>Giochi una carta: se in tavola c'è una carta <b>dello stesso valore</b> la prendi (è obbligatorio prendere quella), altrimenti puoi prendere <b>più carte che sommano</b> al valore. Se non prendi nulla la carta resta in tavola.</li>
${r.aceTakesAll ? '<li><b>Asso piglia tutto</b>: l\'Asso prende tutte le carte in tavola (se in tavola non c\'è già un Asso).</li>' : ''}
<li><b>Scopa</b>: se prendi tutte le carte in tavola fai scopa (1 punto), tranne all'ultima giocata.</li>
<li>A fine smazzata le carte rimaste in tavola vanno a chi ha fatto l'ultima presa.</li>
<li>Punti: <b>carte</b> (chi ne ha di più), <b>denari</b> (chi ne ha di più), <b>settebello</b> (il 7 di denari), <b>primiera</b> (la miglior carta per seme: 7, 6, Asso…), più le <b>scope</b>.</li>
<li>Vince chi arriva per primo a <b>${r.target}</b>.</li>
</ul>`;
  }

  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, captures, primiera, handPoints };
});
