/*
 * Briscola in 5 ("chiamata"): regole modificabili e asta. Condiviso tra server e browser.
 * 5 giocatori, 8 carte a testa, niente mazzo. All'asta si "chiama" una carta sempre più bassa (Asso, Tre, Re…, Due)
 * e poi, sul Due, un punteggio sempre più alto (61, 62…). Chi vince l'asta sceglie la briscola: chi ha la carta
 * chiamata di quel seme è il suo socio segreto. Si scopre solo quando la carta viene giocata.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoBriscola5 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SCHEMA = [
    { group: 'Partita', key: 'target', label: 'Smazzate', type: 'select', choices: [[5, '5'], [10, '10'], [15, '15']] },
  ];
  const DEFAULTS = { game: 'briscola5', players: 5, target: 10 };
  function normalize(r) {
    const out = { ...DEFAULTS };
    for (const f of SCHEMA) {
      if (!r || r[f.key] === undefined) continue;
      const v = Number(r[f.key]);
      if (f.choices.some(([o]) => o === v)) out[f.key] = v;
    }
    out.game = 'briscola5';
    out.players = 5;
    return out;
  }
  // l'asta va dall'Asso al Due (carte sempre più basse = si promette di più), poi sul Due si alza il punteggio
  const BID_RANKS = [1, 3, 10, 9, 8, 7, 6, 5, 4, 2];
  const MAX_LEVEL = 9 + (120 - 61);
  /** livello d'asta → { rank, points } */
  const bidOf = (level) => (level <= 9 ? { rank: BID_RANKS[level], points: 61 } : { rank: 2, points: 61 + (level - 9) });
  const RANK_NAMES = { 1: 'Asso', 2: 'Due', 3: 'Tre', 8: 'Fante', 9: 'Cavallo', 10: 'Re' };
  const rankName = (r) => RANK_NAMES[r] || String(r);
  const bidLabel = (level) => { const b = bidOf(level); return b.points > 61 ? `${rankName(b.rank)} a ${b.points}` : rankName(b.rank); };

  const PRESET = {
    id: 'briscola5', name: 'Briscola in 5', tagline: 'La Briscola chiamata del Sud: asta, carta chiamata e socio segreto. In cinque.', rules: { ...DEFAULTS },
    intro: '<p>La Briscola in 5 (o "chiamata") si gioca in cinque con le carte italiane: chi vince l\'asta sceglie la briscola e chiama una carta; chi la possiede è il suo socio, ma nessuno lo sa finché non la gioca.</p>',
  };
  function describe(r) {
    return `<h3>Briscola in 5 (chiamata)</h3>
<p>Mazzo italiano da 40 carte, 5 giocatori, <b>8 carte a testa</b>, niente mazzo. Forza e punti delle carte come nella Briscola (Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2).</p>
<ul>
<li><b>Asta</b>: a turno si chiama una carta sempre più bassa (Asso, Tre, Re, Cavallo, Fante, 7… fino al Due) oppure si passa (chi passa non rientra). Arrivati al Due si rilancia sul punteggio da fare: 62, 63…</li>
<li>Chi vince l'asta è il <b>chiamante</b>: sceglie il seme di <b>briscola</b>. Chi ha la carta chiamata di quel seme è il suo <b>socio</b>, in segreto: si scopre quando la gioca. Se la carta chiamata ce l'ha il chiamante, gioca da solo contro tutti.</li>
<li>Si gioca come la Briscola (nessun obbligo di seme). Chiamante e socio devono fare almeno <b>61 punti</b> (o il punteggio dell'asta).</li>
<li>Punti della smazzata: se vincono, chiamante +2 e socio +1, gli altri −1; se perdono, chiamante −2 e socio −1, gli altri +1. Da solo: ±4.</li>
<li>Dopo <b>${r.target}</b> smazzate vince chi ha più punti.</li>
</ul>`;
  }
  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, BID_RANKS, MAX_LEVEL, bidOf, bidLabel, rankName };
});
