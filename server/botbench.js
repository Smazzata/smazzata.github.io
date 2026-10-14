'use strict';
// Confronto di forza tra i livelli del computer: npm run bench [partite]
const E = require('./engine');
const Bot = require('./bot');
const Rules = require('../shared/rules');
function duel(la, lb, games, preset = 'classico') {
  const base = Rules.PRESETS.find((p) => p.id === preset).rules;
  let wa = 0, pa = 0, pb = 0;
  for (let k = 0; k < games; k++) {
    const levels = k % 2 ? [lb, la] : [la, lb];
    const g = E.createGame({ rules: { ...base, players: 2, target: 1005 }, players: [{ name: 'x', isBot: true }, { name: 'y', isBot: true }] });
    let guard = 0;
    while (!g.over && guard++ < 5000) {
      if (g.phase === 'handEnd') { E.nextHand(g); continue; }
      const seat = g.turn, memo = { level: levels[seat] };
      for (let i = 0; i < 200 && g.turn === seat && g.phase !== 'handEnd'; i++) E.apply(g, seat, Bot.nextAction(g, seat, memo));
    }
    const sa = g.scores[k % 2 ? 1 : 0], sb = g.scores[k % 2 ? 0 : 1];
    if (sa > sb) wa++; pa += sa; pb += sb;
  }
  console.log(`${la} vs ${lb} (${preset}): vince ${la} ${wa}/${games} (${Math.round(wa / games * 100)}%), punti medi ${Math.round(pa / games)} - ${Math.round(pb / games)}`);
}
const n = Number(process.argv[2] || 40);
duel('normale', 'facile', n);
duel('difficile', 'normale', n);
duel('difficile', 'facile', n);
