'use strict';
/*
 * Prova di gioco in massa: tante partite tra computer, con statistiche sull'esperienza
 * (durata, finali, punteggi, scarti, dati inviati ai client).  npm run playtest [partite]
 */
const E = require('./engine');
const Bot = require('./bot');
const Rules = require('../shared/rules');

const N = Number(process.argv[2] || 60);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '-');
const r1 = (x) => Math.round(x * 10) / 10;

function run(preset, n, level = 'normale') {
  const base = Rules.PRESETS.find((p) => p.id === preset).rules;
  const st = {
    games: 0, hands: 0, closes: 0, stockEnds: 0, turnsPerHand: [], handsPerGame: [], handScores: [],
    burracoPerHand: [], pozzettoTaken: 0, pozzettoChances: 0, maxPile: [], pileTakes: 0, draws: 0,
    viewBytes: [], negativeHands: 0, turnsWithoutMeld: [], longestDrought: [], actionsPerTurn: [],
  };
  for (let k = 0; k < N; k++) {
    const g = E.createGame({ rules: { ...base, players: n }, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, isBot: true })) });
    let turns = 0, maxPile = 0, drought = 0, longest = 0;
    while (!g.over) {
      if (g.phase === 'handEnd') {
        const hr = g.handResult;
        st.hands++;
        if (hr.reason === 'close') st.closes++; else st.stockEnds++;
        st.turnsPerHand.push(turns);
        st.maxPile.push(maxPile);
        st.longestDrought.push(longest);
        for (const t of hr.teams) {
          st.handScores.push(t.total);
          st.burracoPerHand.push(t.burraco.length);
          if (t.total < 0) st.negativeHands++;
          st.pozzettoChances++;
          if (t.pozPts === 0) st.pozzettoTaken++;
        }
        turns = 0; maxPile = 0; drought = 0; longest = 0;
        E.nextHand(g);
        continue;
      }
      const seat = g.turn, memo = { level };
      const meldsBefore = g.teams.reduce((s, t) => s + t.melds.reduce((a, m) => a + m.cards.length, 0), 0);
      let acts = 0;
      while (g.turn === seat && g.phase !== 'handEnd' && acts < 200) {
        const a = Bot.nextAction(g, seat, memo);
        if (a.type === 'draw') st.draws++;
        if (a.type === 'takePile') st.pileTakes++;
        E.apply(g, seat, a);
        acts++;
        maxPile = Math.max(maxPile, g.discard.length);
      }
      st.actionsPerTurn.push(acts);
      const meldsAfter = g.teams.reduce((s, t) => s + t.melds.reduce((a, m) => a + m.cards.length, 0), 0);
      drought = meldsAfter > meldsBefore ? 0 : drought + 1;
      longest = Math.max(longest, drought);
      turns++;
      if (turns % 7 === 0) st.viewBytes.push(Buffer.byteLength(JSON.stringify(E.viewFor(g, 0))));
    }
    st.games++;
    st.handsPerGame.push(g.history.length);
  }
  const sorted = st.handScores.slice().sort((a, b) => a - b);
  console.log(`\n=== ${preset} · ${n} giocatori · computer ${level} · ${st.games} partite ===`);
  console.log(`smazzate per partita: media ${r1(avg(st.handsPerGame))} (min ${Math.min(...st.handsPerGame)}, max ${Math.max(...st.handsPerGame)})`);
  console.log(`turni per smazzata: media ${r1(avg(st.turnsPerHand))}  →  giri ${r1(avg(st.turnsPerHand) / n)}`);
  console.log(`finali: chiusura ${pct(st.closes, st.hands)}, tallone esaurito ${pct(st.stockEnds, st.hands)}`);
  console.log(`punti per squadra a smazzata: media ${Math.round(avg(st.handScores))}, mediana ${sorted[Math.floor(sorted.length / 2)]}, negativi ${pct(st.negativeHands, st.handScores.length)}`);
  console.log(`burraco per squadra a smazzata: ${r1(avg(st.burracoPerHand))}; pozzetto preso: ${pct(st.pozzettoTaken, st.pozzettoChances)}`);
  console.log(`pescate dal tallone ${st.draws}, raccolte dello scarto ${st.pileTakes} (${pct(st.pileTakes, st.draws + st.pileTakes)}); scarto massimo medio ${r1(avg(st.maxPile))} carte`);
  console.log(`turni consecutivi senza calate (massimo per smazzata): media ${r1(avg(st.longestDrought))}`);
  console.log(`azioni per turno: media ${r1(avg(st.actionsPerTurn))}, max ${Math.max(...st.actionsPerTurn)}`);
  console.log(`dati per aggiornamento al client: media ${Math.round(avg(st.viewBytes) / 1024 * 10) / 10} KB, max ${Math.round(Math.max(...st.viewBytes) / 1024 * 10) / 10} KB`);
  return st;
}

const t0 = Date.now();
for (const [p, n] of [['classico', 4], ['classico', 2], ['classico', 3], ['reale', 4], ['aberto', 4], ['fechado', 4]]) run(p, n);
run('classico', 4, 'difficile');
console.log(`\nTempo totale: ${Math.round((Date.now() - t0) / 1000)} s`);
