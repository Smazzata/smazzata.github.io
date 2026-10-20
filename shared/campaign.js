/* Spezzoni guidati: stato e mosse passano dal motore delle partite normali.
 * Il bot segue un copione; nessun risultato viene inviato alle classifiche. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules'), require('./ramino'));
  else root.CardCampaign = factory(root.BurracoRules, root.BurracoRamino);
})(typeof self !== 'undefined' ? self : this, function (R, Ramino) {
  'use strict';
  const move = (seat, type, cards, tip) => ({ seat, type, cards: cards ? cards.split(' ') : [], tip });
  const paths = [
    { id: 'burraco', name: 'Burraco', icon: '🃏', subtitle: 'Le prime mosse al tavolo', rules: 'Burraco Classico' },
    { id: 'scala40', name: 'Scala 40', icon: '🪜', subtitle: 'Pesca, apri e gioca contro il bot', rules: 'Scala 40 · regole base' },
    { id: 'ramino', name: 'Ramino', icon: '🧩', subtitle: 'Le prime combinazioni in partita', rules: 'Ramino · regole base' }
  ];
  for (const path of paths) {
    const scala = path.id === 'scala40', burraco = path.id === 'burraco';
    const wild = burraco ? '2D' : '0J';
    const specs = [
      ['turno', 'Il primo turno', '🌱', 'Pesca e scarta, poi osserva il bot', null, null],
      ['scala', 'La prima scala', '🌉', scala ? 'Apri con una scala da 40 punti' : 'Cala una scala dello stesso seme', scala ? '10H 11H 12H 13H' : '4H 5H 6H', null],
      ['tris', scala ? 'Aprire con un poker' : 'Il primo tris', '🚪', scala ? 'Cala quattro Re: 40 punti' : 'Cala tre carte dello stesso valore', scala ? '13S 13H 13D 13C' : '9S 9H 9D', null],
      ['matta', burraco ? 'Gioca la pinella' : 'Gioca il jolly', '✨', 'Usa una matta nella tua prima combinazione', scala ? `10H 11H ${wild} 13H` : `5H ${wild} 7H`, null],
      ['attacco', 'Allunga la tua scala', '🏰', 'Dopo il turno del bot, attacca una carta', scala ? '9H 10H 11H 12H 13H' : '4H 5H 6H', scala ? '8H' : '7H']
    ];
    path.levels = specs.map(([id, title, icon, goal, meld, add]) => {
      const steps = [move(0, 'draw', '', 'È il tuo turno. Tocca il tallone coperto per pescare una carta.')];
      if (meld) {
        const lesson = id === 'matta'
          ? (burraco ? 'La pinella (il 2) sostituisce il 6 di cuori.' : scala ? 'Il jolly sostituisce la Donna di cuori: questa scala vale 40 punti e permette di aprire.' : 'Il jolly sostituisce il 6 di cuori.')
          : id === 'tris' ? (scala ? 'Quattro Re di semi diversi valgono 40 punti: puoi aprire.' : 'Tre 9 formano un tris.')
          : scala ? 'Questa scala dello stesso seme raggiunge almeno 40 punti: puoi aprire.' : 'Le carte evidenziate formano una scala dello stesso seme.';
        steps.push(move(0, 'meld', meld, lesson + ' Seleziona le carte evidenziate e tocca Cala.'));
      }
      steps.push(move(0, 'discard', '8C', 'Termina il turno: seleziona l’8 di fiori e tocca gli scarti.'));
      steps.push(move(1, 'draw', '', 'Il bot pesca dal tallone.'));
      steps.push(move(1, 'meld', '10S 11S 12S 13S', 'Il bot cala una scala da 40 punti. Guarda le carte che arrivano sul tavolo.'));
      steps.push(move(1, 'discard', '3D', 'Il bot scarta il 3 di quadri. Ora tocca di nuovo a te.'));
      steps.push(move(0, 'draw', '', 'Tocca il tallone: comincia il tuo secondo turno.'));
      if (add) steps.push(move(0, 'add', add, 'Seleziona la carta evidenziata, poi tocca la tua scala sul tavolo per allungarla.'));
      steps.push(move(0, 'discard', '8D', 'Scarta l’8 di quadri per terminare questo spezzone di partita.'));
      return { id, title, icon, goal, steps, hand: `${meld || '4H 5H 9D'} 8C 8D`, add };
    });
  }
  const code = (c) => `${c.r}${c.s}`;
  function start(path, level, E) {
    const rules = path.id === 'burraco' ? R.PRESETS[0].rules : path.id === 'ramino' ? Ramino.normalize() : { game: 'scala40' };
    const g = E.createGame({ rules, players: [{ name: 'Tu' }, { name: 'Luca', isBot: true }], seed: 2718 });
    // Ripartizione di un mazzo reale: ID univoci e nessuna carta inventata o duplicata.
    const deck = g.players.flatMap((p) => p.hand).concat(g.stock, g.discard, ...g.pozzetti);
    const take = (name) => { const i = deck.findIndex((c) => code(c) === name); if (i < 0) throw new Error(`Carta mancante: ${name}`); return deck.splice(i, 1)[0]; };
    g.players[0].hand = level.hand.split(' ').map(take);
    g.players[1].hand = '10S 11S 12S 13S 3D 6C'.split(' ').map(take);
    const draws = ['6D', '4C', level.add || '7D'].map(take);
    g.discard = [take('3C')];
    g.pozzetti = g.pozzetti.map((p) => deck.splice(0, p.length));
    // Completa le mani: è una situazione di partita, non una selezione di risposte.
    const size = path.id === 'burraco' ? 11 : 13;
    for (const p of g.players) p.hand.push(...deck.splice(0, size - p.hand.length));
    g.stock = deck.concat(draws.reverse());
    g.turn = 0; g.phase = 'draw'; g.turnInfo = null; g.log = []; g.replay = null;
    return { g, index: 0 };
  }
  function expected(session, level) {
    const step = level.steps[session.index];
    if (!step) return null;
    const hand = session.g.players[step.seat].hand;
    const ids = step.cards.map((name) => {
      const c = hand.find((c) => code(c) === name);
      if (!c) throw new Error(`Carta del copione assente: ${name}`);
      return c.id;
    });
    const action = { type: step.type };
    if (step.type === 'discard') action.cardId = ids[0];
    if (step.type === 'meld' || step.type === 'add') action.cardIds = ids;
    if (step.type === 'add') action.meldId = session.g.teams[0].melds[0].id;
    return action;
  }
  function act(session, level, E, action) {
    const step = level.steps[session.index], wanted = expected(session, level);
    if (!step || !action || action.type !== wanted.type || action.cardId !== wanted.cardId || action.meldId !== wanted.meldId) return false;
    if (wanted.cardIds && (!Array.isArray(action.cardIds) || action.cardIds.length !== wanted.cardIds.length || new Set(action.cardIds).size !== action.cardIds.length || !action.cardIds.every((id) => wanted.cardIds.includes(id)))) return false;
    E.apply(session.g, step.seat, action);
    session.index++;
    return true;
  }
  function progress(raw) {
    const out = {};
    for (const p of paths) {
      out[p.id] = {}; let unlocked = true;
      for (const l of p.levels) {
        // Si salva solo uno spezzone concluso: riprenderlo ricrea tutta la mano.
        const done = unlocked && raw && raw[p.id] && raw[p.id][l.id] === l.steps.length;
        out[p.id][l.id] = done ? l.steps.length : 0; unlocked = !!done;
      }
    }
    return out;
  }
  return { paths, start, expected, act, progress };
});
