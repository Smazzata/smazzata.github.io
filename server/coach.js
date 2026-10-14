'use strict';
/*
 * Coach di fine smazzata: rigioca la smazzata dalla moviola e guarda gli scarti di un giocatore.
 * Segnala (al massimo 3 consigli, i più importanti):
 *   - una matta scartata
 *   - una carta scartata che si poteva attaccare a un proprio gioco
 *   - una carta scartata che il giocatore successivo poteva attaccare ai suoi giochi (peggio se poi ha raccolto)
 * Usa il motore passato come parametro, così funziona sia sul server sia nel gioco offline.
 */
function analyze(E, replay, seat) {
  if (!replay) return [];
  const g = JSON.parse(JSON.stringify(replay.start));
  Object.assign(g, { log: [], events: [], history: [] });
  const tips = [];
  let turn = 0;
  const acts = replay.actions;
  for (let i = 0; i < acts.length; i++) {
    const x = acts[i];
    if (x.s === seat && (x.a.type === 'draw' || x.a.type === 'takePile')) turn++;
    if (x.s === seat && x.a.type === 'discard') {
      const card = g.players[seat].hand.find((c) => c.id === x.a.cardId);
      const mine = E.teamOf(g, seat);
      if (card) {
        const name = E.cardName(card);
        const fits = (team) => team.melds.some((m) => E.analyzeMeld(m.cards.concat([card]), g.cfg, m.type));
        if (E.isWild(card)) {
          tips.push({ w: 3, turn, text: `Turno ${turn}: hai scartato una matta (${name}). Le matte valgono oro: tienile per completare i giochi.` });
        } else if (fits(mine)) {
          tips.push({ w: 2, turn, text: `Turno ${turn}: hai scartato ${name}, ma potevi attaccarlo a un tuo gioco.` });
        } else {
          const next = (seat + 1) % g.n;
          const theirs = E.teamOf(g, next);
          if (theirs && theirs !== mine && fits(theirs)) {
            const nx = acts[i + 1];
            const took = nx && nx.s === next && nx.a.type === 'takePile';
            tips.push({
              w: took ? 3 : 1, turn,
              text: `Turno ${turn}: hai scartato ${name}, che ${g.players[next].name} poteva attaccare ai suoi giochi${took ? ' (e infatti ha raccolto gli scarti)' : ''}.`,
            });
          }
        }
      }
    }
    try { E.apply(g, x.s, x.a); } catch (e) { break; }
  }
  return tips.sort((a, b) => b.w - a.w || a.turn - b.turn).slice(0, 3).map((t) => t.text);
}

module.exports = { analyze };
