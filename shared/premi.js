/*
 * Premi da sbloccare giocando: titoli (si vedono sotto il nome), cornici dell'avatar e dorsi delle carte speciali.
 * Ogni premio chiede un livello minimo, un trofeo o un numero di trofei. Condiviso tra server (controlla) e browser (mostra).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoPremi = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LIST = [
    // titoli
    { id: 't_principiante', kind: 'title', name: 'Principiante', need: {} },
    { id: 't_appassionato', kind: 'title', name: 'Appassionato', need: { level: 3 } },
    { id: 't_veterano', kind: 'title', name: 'Veterano', need: { level: 6 } },
    { id: 't_maestro', kind: 'title', name: 'Maestro', need: { level: 10 } },
    { id: 't_leggenda', kind: 'title', name: 'Leggenda del tavolo', need: { level: 15 } },
    { id: 't_burrachista', kind: 'title', name: 'Re del Burraco', need: { trophy: 'burraco_50' }, how: '50 burraco' },
    { id: 't_scopa', kind: 'title', name: 'Re della Scopa', need: { trophy: 'sc_scope3' }, how: '3 scope in una smazzata' },
    { id: 't_briscola', kind: 'title', name: 'Asso di Briscola', need: { trophy: 'br_cento' }, how: '100 punti a Briscola' },
    { id: 't_tressette', kind: 'title', name: 'Napoletano doc', need: { trophy: 'tr_napoletana' }, how: 'una napoletana a Tressette' },
    { id: 't_jolly', kind: 'title', name: 'Ladro di jolly', need: { trophy: 's40_jolly' }, how: 'un jolly preso a Scala 40' },
    { id: 't_rimonta', kind: 'title', name: 'Mai dire mai', need: { trophy: 'rimonta' }, how: 'una rimonta' },
    { id: 't_campione', kind: 'title', name: 'Campione', need: { trophy: 'torneo' }, how: 'vincere un torneo' },
    { id: 't_giorno', kind: 'title', name: 'Re del giorno', need: { trophy: 'sfida_primo' }, how: 'primo nella sfida del giorno' },
    { id: 't_collezionista', kind: 'title', name: 'Collezionista di trofei', need: { trophies: 15 } },
    { id: 't_costante', kind: 'title', name: 'Costante', need: { trophy: 'serie_7' }, how: '7 giorni di gioco di fila' },
    { id: 't_instancabile', kind: 'title', name: 'Instancabile', need: { trophy: 'serie_30' }, how: '30 giorni di gioco di fila' },
    // cornici dell'avatar
    { id: 'f_nessuna', kind: 'frame', name: 'Nessuna', need: {} },
    { id: 'f_argento', kind: 'frame', name: 'Argento', need: { level: 5 } },
    { id: 'f_oro', kind: 'frame', name: 'Oro', need: { level: 10 } },
    { id: 'f_smeraldo', kind: 'frame', name: 'Smeraldo', need: { trophy: 'torneo' }, how: 'vincere un torneo' },
    { id: 'f_fiamma', kind: 'frame', name: 'Fiamma', need: { trophy: 'tris_burraco' }, how: '3 burraco in una smazzata' },
    { id: 'f_arcobaleno', kind: 'frame', name: 'Arcobaleno', need: { trophies: 20 } },
    // dorsi delle carte speciali (quelli normali sono sempre disponibili)
    { id: 'b_oro', kind: 'back', name: 'Oro', need: { trophy: 'vittorie_50' }, how: '50 vittorie' },
    { id: 'b_notte', kind: 'back', name: 'Notte stellata', need: { trophy: 'maratona' }, how: '100 partite' },
    { id: 'b_smeraldo', kind: 'back', name: 'Smeraldo', need: { level: 8 } },
  ];
  const BY_ID = {};
  for (const p of LIST) BY_ID[p.id] = p;

  /** p: premio; me: { level, trophies: { id: data } } */
  function isUnlocked(p, me) {
    const n = p.need || {};
    const tr = (me && me.trophies) || {};
    if (n.level && (!me || (me.level || 1) < n.level)) return false;
    if (n.trophy && !tr[n.trophy]) return false;
    if (n.trophies && Object.keys(tr).length < n.trophies) return false;
    return true;
  }
  const unlockedIds = (me) => LIST.filter((p) => isUnlocked(p, me)).map((p) => p.id);
  /** come si sblocca (testo per l'interfaccia) */
  function howTo(p, trophyName) {
    const n = p.need || {};
    if (p.how) return p.how;
    if (n.level) return `livello ${n.level}`;
    if (n.trophy) return `trofeo «${trophyName ? trophyName(n.trophy) : n.trophy}»`;
    if (n.trophies) return `${n.trophies} trofei`;
    return '';
  }
  return { LIST: LIST.filter((p) => !['t_scopa', 't_briscola', 't_tressette'].includes(p.id)), BY_ID, isUnlocked, unlockedIds, howTo };
});
