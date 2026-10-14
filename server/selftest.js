'use strict';
// Simula partite complete tra bot per ogni variante e verifica gli invarianti.
const assert = require('assert');
const E = require('./engine');
const Bot = require('./bot');
const Rules = require('../shared/rules');

function countCards(g) {
  let n = g.stock.length + g.discard.length;
  for (const p of g.players) n += p.hand.length;
  for (const pz of g.pozzetti) n += pz.length;
  for (const t of g.teams) for (const m of t.melds) n += m.cards.length;
  return n;
}

/** I file dell'interfaccia (public/js) devono essere caricati dalla pagina e salvati per il gioco offline */
function filesTests() {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  const js = fs.readdirSync(path.join(root, 'public', 'js')).filter((f) => f.endsWith('.js'));
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
  const lsw = fs.readFileSync(path.join(root, 'launcher', 'sw.js'), 'utf8');
  for (const f of js) {
    assert(html.includes(`src="js/${f}"`), `index.html non carica js/${f}`);
    assert(sw.includes(`'js/${f}'`), `public/sw.js non salva js/${f} per l'uso offline`);
    assert(lsw.includes(`'gioca/js/${f}'`), `launcher/sw.js non salva gioca/js/${f}`);
  }
  console.log(`file dell'interfaccia: ${js.length}, tutti caricati e salvati per l'uso offline`);
}

/** Archivio: salvataggio e rilettura, scritture solo delle voci cambiate, importazione da stato.json */
function storeTests() {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { openStore, exportData } = require('./store');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-store-'));
  try {
    const data = {
      savedAt: 1, sessions: [['t1', { nick: 'Anna' }], ['t2', { nick: 'Bruno' }]], leaderboard: [['t1', { games: 3 }]],
      rooms: [{ code: 'ABCD', seats: [] }], leagues: [{ id: 'L1', name: 'Giovedì' }], daily: [['2026-10-14', { t1: { score: 5 } }]], reports: [{ text: 'ciao' }],
    };
    const st = openStore(dir);
    assert(st.save(data).written > 5, 'primo salvataggio completo');
    if (st.kind === 'sqlite') {
      data.sessions[1][1].nick = 'Bruno2';
      assert.strictEqual(st.save(data).written, 1, 'si riscrive solo la voce cambiata');
      data.rooms = [];
      assert.strictEqual(st.save(data).written, 1, 'tavolo eliminato');
      assert.strictEqual(st.save(data).written, 0, 'niente da scrivere');
    }
    const back = openStore(dir).load();
    assert.deepStrictEqual(back.sessions.find((x) => x[0] === 't2')[1], { nick: st.kind === 'sqlite' ? 'Bruno2' : 'Bruno' });
    assert(back.leagues[0].name === 'Giovedì' && back.reports[0].text === 'ciao' && back.daily[0][0] === '2026-10-14', 'tutto ritrovato');
    assert(exportData(dir).leaderboard[0][1].games === 3, 'esportazione per il backup');
    if (st.kind === 'sqlite') {
      // ripristino da backup: stato.json più recente viene importato nel database
      fs.writeFileSync(path.join(dir, 'stato.json'), JSON.stringify({ ...data, sessions: [['t9', { nick: 'Ripristinato' }]], savedAt: Date.now() + 1000 }));
      const again = openStore(dir).load();
      assert(again.sessions.some((x) => x[1].nick === 'Ripristinato'), 'importazione da stato.json');
      assert(fs.existsSync(path.join(dir, 'stato.json.importato')), 'stato.json messo da parte');
    }
    console.log(`archivio (${st.kind}): salvataggio, rilettura, importazione OK`);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* il database può essere ancora aperto su Windows */ }
  }
}

function leagueTests() {
  const leagues = new Map();
  const L = require('./leagues')({ leagues, nickOf: (t) => ({ a: 'Anna', b: 'Bruno', c: 'Ciro' }[t]) });
  const id = L.create('a', 'Giovedì', 'settimana');
  const lg = leagues.get(id);
  L.addMember(lg, 'a', 'b');
  assert.throws(() => L.addMember(lg, 'b', 'c'), /creato/, 'solo il creatore aggiunge');
  L.recordGame([{ token: 'a', name: 'Anna', won: true }, { token: 'b', name: 'Bruno', won: false }, { token: 'x', name: 'Ospite', won: true }]);
  L.recordGame([{ token: 'a', name: 'Anna', won: true }]); // da sola: non conta
  const v = L.view(lg, 'b');
  assert(v.standings[0].name === 'Anna' && v.standings[0].pts === 3 && v.standings[1].pts === 1 && v.standings[1].me, 'classifica del campionato');
  // fine stagione: albo d'oro, campione premiato, classifica azzerata
  const champs = L.rollover(lg, L.seasonEnd(lg.seasonStart, lg.period) + 1000);
  assert.deepStrictEqual(champs, ['a']);
  assert(lg.past[0].winners[0] === 'Anna' && Object.keys(lg.standings).length === 0, 'nuova stagione');
  // settimana: finisce il lunedì; mese: il primo del mese dopo
  assert.strictEqual(new Date(L.seasonEnd(Date.UTC(2026, 9, 14), 'settimana')).getUTCDay(), 1);
  assert.strictEqual(new Date(L.seasonEnd(Date.UTC(2026, 9, 14), 'mese')).toISOString().slice(0, 10), '2026-11-01');
  L.removeMember(lg, 'a', 'a');
  assert(lg.owner === 'b', 'se esce il creatore il campionato passa a un altro');
  L.forget('b');
  assert(!leagues.has(id), 'campionato vuoto eliminato');
  console.log('campionati: classifica, stagioni e albo d\'oro OK');
}

function trophyTests() {
  const T = require('./trophies');
  const hand = (kinds, total) => ({ burraco: kinds.map((kind) => ({ kind })), total });
  assert.deepStrictEqual(T.fromHand(hand(['clean', 'dirty', 'dirty'], 1200)).sort(), ['mille', 'pulito', 'tris_burraco']);
  assert.deepStrictEqual(T.fromHand(hand(['real13'], 300)).sort(), ['pulito', 'reale']);
  // rimonta: sotto di 600 dopo la prima smazzata, poi vittoria
  const g = {
    winners: [0, 2], teams: [{ members: [0, 2] }, { members: [1, 3] }], players: [0, 1, 2, 3].map((seat) => ({ seat })),
    scores: [2100, 900, 2100, 900],
    history: [{ teams: [{ members: [0, 2], total: 100 }, { members: [1, 3], total: 700 }] },
      { teams: [{ members: [0, 2], total: 2000 }, { members: [1, 3], total: 200 }] }],
  };
  const got = T.fromGame(g, 0, { allBotsDifficile: true, tutorial: false, withFriend: true });
  assert(got.includes('rimonta') && got.includes('schiacciante') && got.includes('difficile') && got.includes('amici'), 'trofei di fine partita');
  assert.deepStrictEqual(T.fromGame(g, 1, { withFriend: false }), [], 'chi perde non prende trofei di vittoria');
  assert.deepStrictEqual(T.fromStats({ wins: 10, burraco: 0, closures: 1, games: 12 }).sort(), ['chiusura', 'prima_vittoria', 'vittorie_10']);
  const v = T.view({ wins: 3, trophies: { prima_vittoria: 1 } });
  assert(v.find((t) => t.id === 'vittorie_10').progress.now === 3 && v.find((t) => t.id === 'prima_vittoria').at === 1, 'avanzamento trofei');
  console.log(`trofei: ${T.LIST.length} definiti, controlli OK`);
}

function unitTests() {
  const cfg = E.buildCfg({ bonusSemi: 150 });
  const c = (r, s, id) => ({ id, r, s });
  assert(E.analyzeMeld([c(3, 'H', 1), c(4, 'H', 2), c(5, 'H', 3)], cfg), 'scala semplice');
  assert(E.analyzeMeld([c(1, 'H', 1), c(2, 'H', 2), c(3, 'H', 3)], cfg).wildCount === 0, 'A-2-3 con pinella naturale');
  assert(E.analyzeMeld([c(12, 'H', 1), c(13, 'H', 2), c(1, 'H', 3)], cfg), 'Q-K-A');
  assert(E.analyzeMeld([c(3, 'H', 1), c(0, 'J', 2), c(5, 'H', 3)], cfg).wildCount === 1, 'buco con jolly');
  assert(!E.analyzeMeld([c(3, 'H', 1), c(0, 'J', 2), c(2, 'S', 3)], cfg), 'due matte vietate');
  assert(E.analyzeMeld([c(2, 'H', 1), c(3, 'H', 2), c(0, 'J', 3)], cfg), 'pinella naturale + jolly');
  assert(E.analyzeMeld([c(7, 'H', 1), c(7, 'S', 2), c(2, 'C', 3)], cfg).type === 'set', 'tris con pinella');
  assert(!E.analyzeMeld([c(7, 'H', 1), c(8, 'S', 2), c(9, 'C', 3)], cfg), 'semi diversi');
  assert.strictEqual(E.analyzeMeld([c(13, 'H', 1), c(1, 'H', 2), c(2, 'H', 3)], cfg).wildCount, 1, 'K-A-2: il 2 fa da matta (Q)');
  const reale = E.buildCfg(Rules.PRESETS.find((p) => p.id === 'reale').rules);
  assert(!E.analyzeMeld([c(7, 'H', 1), c(7, 'S', 2), c(7, 'C', 3)], reale), 'niente tris nel Reale');
  const full = [];
  for (let r = 1; r <= 13; r++) full.push(c(r, 'S', r));
  full.push(c(1, 'S', 99));
  const an = E.analyzeMeld(full, reale);
  assert(an && an.length === 14 && E.meldKind(an, reale).bonus === 1000, 'scala A-A nel Reale');
  assert(!E.analyzeMeld(full, cfg), 'A-A non ammessa nel classico senza matta');
  const semi = [c(3, 'H', 1), c(4, 'H', 2), c(5, 'H', 3), c(6, 'H', 4), c(7, 'H', 5), c(8, 'H', 6), c(9, 'H', 7), c(0, 'J', 8)];
  assert.strictEqual(E.meldKind(E.analyzeMeld(semi, cfg), cfg).kind, 'semi', 'semipulito');
  // più combinazioni calate insieme
  const M = require('../shared/melds');
  const two = M.partitionMelds([c(7, 'H', 1), c(3, 'S', 2), c(7, 'S', 3), c(4, 'S', 4), c(7, 'C', 5), c(5, 'S', 6)], cfg);
  assert(two && two.length === 2, 'tris + scala selezionati insieme');
  assert(!M.partitionMelds([c(7, 'H', 1), c(3, 'S', 2), c(9, 'D', 3), c(4, 'S', 4), c(7, 'C', 5), c(5, 'S', 6)], cfg), 'divisione impossibile');

  // vulnerabilità: una calata sotto i 75 punti viene rifiutata invece di bloccare il turno
  const br = Rules.PRESETS.find((p) => p.id === 'aberto').rules;
  const g = E.createGame({ rules: { ...br, players: 2 }, players: [{ name: 'A' }, { name: 'B', isBot: true }] });
  g.scores = [2000, 0];
  g.turn = 0; g.phase = 'draw';
  g.players[0].hand = [c(3, 'H', 501), c(4, 'H', 502), c(5, 'H', 503), c(8, 'S', 504), c(9, 'S', 505), c(10, 'S', 506), c(11, 'S', 507), c(12, 'S', 508), c(13, 'S', 509), c(1, 'S', 510), c(6, 'D', 511)];
  E.apply(g, 0, { type: 'draw' });
  assert.throws(() => E.apply(g, 0, { type: 'meld', cardIds: [501, 502, 503] }), /vulnerabili/, 'calata da 15 punti rifiutata');
  E.apply(g, 0, { type: 'meld', cardIds: [504, 505, 506, 507, 508, 509, 510] });
  assert.strictEqual(g.teams[0].melds.length, 1, 'calata da 75 punti accettata');
  console.log('Test unitari OK');
}

function simulate(label, rules, n, games = 3) {
  const variantId = label;
  const total = 104 + rules.jokers;
  let hands = 0, closes = 0, maxActions = 0;
  for (let k = 0; k < games; k++) {
    const players = Array.from({ length: n }, (_, i) => ({ name: 'Bot' + i, isBot: true }));
    const g = E.createGame({ rules, players });
    let guard = 0;
    while (!g.over && guard < 200000) {
      if (g.phase === 'handEnd') {
        hands++;
        if (g.handResult.reason === 'close') closes++;
        // moviola: rigiocando le mosse registrate si arriva allo stesso risultato
        const h = JSON.parse(JSON.stringify(g.lastReplay.start));
        Object.assign(h, { log: [], events: [], history: [] });
        for (const x of g.lastReplay.actions) E.apply(h, x.s, x.a);
        assert.deepStrictEqual(h.handResult.teams.map((t) => t.total), g.handResult.teams.map((t) => t.total), `moviola diversa (${variantId})`);
        E.nextHand(g);
        continue;
      }
      const seat = g.turn;
      const memo = {};
      let steps = 0;
      while (g.turn === seat && g.phase !== 'handEnd' && steps < 300) {
        const a = Bot.nextAction(g, seat, memo);
        E.apply(g, seat, a);
        assert.strictEqual(countCards(g), total, `carte non conservate (${variantId})`);
        // cronaca degli eventi: le carte calate/attaccate sono davvero sul tavolo, gli eventi sono in ordine
        const ev = g.events[g.events.length - 1];
        if (ev && (ev.type === 'meld' || ev.type === 'add') && g.phase !== 'handEnd') {
          const onTable = new Set(g.teams.flatMap((t) => t.melds.flatMap((m) => m.cards.map((c) => c.id))));
          assert(ev.cardIds.length && ev.cardIds.every((id) => onTable.has(id)), `cronaca: carte non sul tavolo (${variantId})`);
        }
        assert(g.events.every((e, i) => i === 0 || e.n > g.events[i - 1].n), 'cronaca fuori ordine');
        steps++;
      }
      maxActions = Math.max(maxActions, steps);
      if (steps >= 300) throw new Error(`Bot bloccato in ${variantId}`);
      guard++;
    }
    if (!g.over) throw new Error(`Partita infinita in ${variantId}`);
  }
  console.log(`${variantId} (${n} giocatori): ${games} partite, ${hands} smazzate, ${closes} chiusure, max azioni/turno ${maxActions}`);
}

unitTests();
trophyTests();
leagueTests();
storeTests();
filesTests();
for (const p of Rules.PRESETS) for (const n of [4, 2, 3]) simulate(p.id, p.rules, n);
// configurazioni casuali
for (let i = 0; i < 12; i++) {
  const r = {};
  for (const f of Rules.SCHEMA) {
    if (f.type === 'bool') r[f.key] = Math.random() < 0.5;
    else if (f.type === 'number') r[f.key] = 1005;
    else r[f.key] = f.choices[Math.floor(Math.random() * f.choices.length)][0];
  }
  const nr = Rules.normalize(r);
  simulate('random#' + i + ' ' + JSON.stringify(nr).length, nr, nr.players, 1);
}
console.log('Tutto OK');
