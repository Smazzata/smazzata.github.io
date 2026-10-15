/*
 * Ramino (Rummy all'italiana): stesso motore e stesse combinazioni della Scala 40 (shared/scala40.js), ma
 * senza un minimo per aprire, con lo scarto che si prende sempre e fino a 2 jolly per combinazione.
 * Le regole hanno game: 'ramino' (classifica e statistiche separate); la partita si gioca come una Scala 40.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./scala40'));
  else root.BurracoRamino = factory(root.BurracoScala40);
})(typeof self !== 'undefined' ? self : this, function (S40) {
  // si possono cambiare: giocatori, eliminazione, jolly, presa del jolly dal tavolo, chiusura in mano
  const SCHEMA = S40.SCHEMA.filter((f) => f.key !== 'opening' && f.key !== 'pileNeedsOpen');
  const DEFAULTS = { game: 'ramino', players: 4, target: 101, opening: 0, maxJokers: 2, swapJoker: true, pileNeedsOpen: false, jokerUseNow: false, closeInHandDouble: true };
  const normalize = (r) => S40.normalize({ ...DEFAULTS, ...(r || {}), game: 'ramino' });

  const PRESET = {
    id: 'ramino', name: 'Ramino', tagline: 'Il Rummy all\'italiana: scale e tris, si cala quando si vuole, chi arriva a 101 è fuori.', rules: { ...DEFAULTS },
    intro: '<p>Il Ramino è il Rummy all\'italiana: ognuno gioca per sé, cala scale e tris quando vuole e cerca di restare senza carte prima degli altri.</p>',
  };

  function describe(r) {
    return `<h3>Ramino</h3>
<p>Due mazzi da 52 carte e 4 jolly. Ognuno gioca per sé con <b>13 carte</b>. A ogni turno si pesca (dal tallone o lo scarto in cima), si calano o attaccano carte e si scarta.</p>
<ul>
<li><b>Combinazioni</b>: scale dello stesso seme (l'Asso va prima del 2 o dopo il K) e tris o poker di semi tutti diversi. Le matte sono i jolly (${r.maxJokers === 1 ? 'al massimo 1' : 'al massimo 2'} per combinazione).</li>
<li><b>Nessun minimo per aprire</b>: si cala quando si vuole, anche una sola combinazione. Lo scarto in cima si può sempre prendere.</li>
<li>Dopo la prima calata si attacca a <b>tutti</b> i giochi sul tavolo${r.swapJoker ? ' e si può prendere un jolly dal tavolo mettendo al suo posto la carta che rappresenta' : ''}.</li>
<li>Chiude chi scarta l'ultima carta. Gli altri si segnano i punti delle carte rimaste in mano (jolly 25, Asso 11, figure 10)${r.closeInHandDouble ? '; se chi chiude cala tutto in un solo turno (<b>chiusura in mano</b>) le penalità raddoppiano' : ''}.</li>
<li>Chi arriva a <b>${r.target}</b> punti è eliminato: vince l'ultimo rimasto.</li>
</ul>`;
  }

  return { SCHEMA, DEFAULTS, PRESET, normalize, describe, presetOf: () => 'ramino' };
});
