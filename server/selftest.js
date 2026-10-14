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
  // lingue: dizionari aggiornati rispetto a lingue/*.txt e salvati per l'uso offline
  const n = require('../scripts/lingue').build(true);
  for (const l of ['en', 'es', 'pt']) {
    assert(sw.includes(`'lingue/${l}.js'`) && lsw.includes(`'gioca/lingue/${l}.js'`), `dizionario ${l} non salvato per l'uso offline`);
  }
  console.log(`lingue: ${n} testi in inglese, spagnolo e portoghese`);
}

/** Archivio: salvataggio e rilettura, scritture solo delle voci cambiate, importazione da stato.json */
/** Scala 40: combinazioni e partite simulate tra computer (carte conservate, moviola, fine partita) */
function scala40Tests() {
  const S40 = require('../shared/scala40');
  const E4 = require('./scala40');
  const B4 = require('./scala40-bot');
  const cfg = S40.normalize({});
  const c = (r, s, id) => ({ id, r, s });
  const J = (id) => ({ id, r: 0, s: 'J' });
  assert(S40.analyzeMeld([c(1, 'H', 1), c(2, 'H', 2), c(3, 'H', 3)], cfg).points === 6, "A-2-3: l'Asso vale 1");
  assert(S40.analyzeMeld([c(12, 'H', 1), c(13, 'H', 2), c(1, 'H', 3)], cfg).points === 31, "Q-K-A: l'Asso vale 11");
  assert(!S40.analyzeMeld([c(13, 'H', 1), c(1, 'H', 2), c(2, 'H', 3)], cfg), 'niente giro K-A-2');
  assert(!S40.analyzeMeld([c(7, 'H', 1), c(7, 'H', 2), c(7, 'D', 3)], cfg), 'tris con semi uguali vietato');
  assert(!S40.analyzeMeld([c(10, 'H', 1), J(2), J(3)], cfg), 'al massimo un jolly');
  assert(S40.analyzeMeld([c(2, 'S', 1), c(3, 'S', 2), c(4, 'S', 3)], cfg).wildCount === 0, 'il 2 non è una matta');
  let hands = 0;
  for (const n of [2, 3, 4]) {
    for (let k = 0; k < (process.env.TEST_RAPIDO ? 1 : 2); k++) {
      // la seconda partita con le varianti: jolly da usare subito, chiusura in mano a penalità doppie
      const g = E4.createGame({ rules: { players: n, ...(k === 1 ? { jokerUseNow: true, closeInHandDouble: true } : {}) }, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, isBot: true })) });
      let guard = 0;
      while (!g.over && guard++ < 50000) {
        if (g.phase === 'handEnd') {
          hands++;
          const h = JSON.parse(JSON.stringify(g.lastReplay.start));
          Object.assign(h, { log: [], events: [], history: [] });
          for (const x of g.lastReplay.actions) E4.apply(h, x.s, x.a);
          assert.deepStrictEqual(h.handResult.teams.map((t) => t.total), g.handResult.teams.map((t) => t.total), 'moviola della Scala 40');
          E4.nextHand(g);
          continue;
        }
        const seat = g.turn, memo = {};
        let steps = 0;
        while (g.turn === seat && g.phase !== 'handEnd' && steps++ < 200) {
          E4.apply(g, seat, B4.nextAction(g, seat, memo));
          const total = g.stock.length + g.discard.length + g.players.reduce((a, p) => a + p.hand.length, 0) + g.teams.reduce((a, t) => a + t.melds.reduce((b, m) => b + m.cards.length, 0), 0);
          assert.strictEqual(total, 108, 'Scala 40: carte non conservate');
        }
        assert(steps < 200, 'Scala 40: computer bloccato');
      }
      assert(g.over && g.winners.length >= 1, 'Scala 40: partita finita');
    }
  }
  console.log(`Scala 40: combinazioni e ${hands} smazzate simulate OK`);
}

/** Canasta: combinazioni, tre rossi, partite simulate (carte conservate, moviola, fine partita) */
function canastaTests() {
  const CN = require('../shared/canasta');
  const EC = require('./canasta');
  const BC = require('./canasta-bot');
  const cfg = CN.normalize({});
  const c = (r, s, id) => ({ id, r, s });
  assert(CN.analyzeMeld([c(7, 'H', 1), c(7, 'S', 2), c(2, 'C', 3)], cfg), 'due naturali e una matta');
  assert(!CN.analyzeMeld([c(7, 'H', 1), c(2, 'S', 2), c(0, 'J', 3)], cfg), 'servono almeno due naturali');
  assert(!CN.analyzeMeld([c(7, 'H', 1), c(8, 'S', 2), c(9, 'C', 3)], cfg), 'niente scale nella Canasta');
  assert(!CN.analyzeMeld([c(3, 'S', 1), c(3, 'C', 2), c(3, 'S', 3)], cfg), 'i tre non si calano');
  assert.strictEqual(CN.minimum(-10), 15); assert.strictEqual(CN.minimum(1600), 90); assert.strictEqual(CN.minimum(3200), 120);
  let hands = 0;
  for (const n of [4, 2, 3]) {
    for (let k = 0; k < (process.env.TEST_RAPIDO ? 1 : 2); k++) {
      const g = EC.createGame({ rules: { players: n, target: 3000 }, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, isBot: true })) });
      assert(g.players.every((p) => !p.hand.some(CN.isRed3)), 'i tre rossi vanno subito in tavola');
      let guard = 0;
      while (!g.over && guard++ < 20000) {
        if (g.phase === 'handEnd') {
          hands++;
          const h = JSON.parse(JSON.stringify(g.lastReplay.start));
          Object.assign(h, { log: [], events: [], history: [] });
          for (const x of g.lastReplay.actions) EC.apply(h, x.s, x.a);
          assert.deepStrictEqual(h.handResult.teams.map((t) => t.total), g.handResult.teams.map((t) => t.total), 'moviola della Canasta');
          EC.nextHand(g);
          continue;
        }
        const seat = g.turn;
        let steps = 0;
        while (g.turn === seat && g.phase !== 'handEnd' && steps++ < 200) {
          EC.apply(g, seat, BC.nextAction(g, seat, {}));
          const total = g.stock.length + g.discard.length + g.players.reduce((a, p) => a + p.hand.length, 0)
            + g.teams.reduce((a, t) => a + t.red3.length + t.melds.reduce((b, m) => b + m.cards.length, 0), 0);
          assert.strictEqual(total, 108, 'Canasta: carte non conservate');
        }
        assert(steps < 200, 'Canasta: computer bloccato');
      }
      assert(g.over, 'Canasta: partita finita');
    }
  }
  console.log(`Canasta: combinazioni e ${hands} smazzate simulate OK`);
}

/** Scopa e Briscola: prese, punti e partite simulate (40 carte conservate, moviola, fine partita) */
function presaTests() {
  const SC = require('../shared/scopa');
  const BR = require('../shared/briscola');
  const c = (r, s, id) => ({ id, r, s });
  // Scopa: la carta uguale ha la precedenza sulla somma
  assert.deepStrictEqual(SC.captures(c(5, 'd', 1), [c(5, 'c', 2), c(2, 's', 3), c(3, 'b', 4)], {}).map((o) => o.map((x) => x.id)), [[2]]);
  assert.strictEqual(SC.captures(c(7, 'd', 1), [c(3, 'c', 2), c(4, 's', 3), c(2, 'b', 4), c(5, 'b', 5)], {}).length, 2, 'due somme possibili');
  assert.strictEqual(SC.primiera([c(7, 'd', 1), c(7, 'c', 2), c(6, 's', 3), c(1, 'b', 4)]), 21 + 21 + 18 + 16);
  // Briscola: la briscola batte il seme di uscita, l'Asso batte il Tre
  assert.strictEqual(BR.winner([c(3, 'd', 1), c(1, 'd', 2)], 'c'), 1);
  assert.strictEqual(BR.winner([c(1, 'd', 1), c(2, 'c', 2)], 'c'), 1);
  assert.strictEqual(BR.winner([c(1, 'd', 1), c(10, 's', 2)], 'c'), 0, 'seme diverso senza briscola: vince chi esce');
  let hands = 0;
  // Rubamazzetto: con una carta uguale alla cima di un mazzetto lo si ruba
  const RMB = require('../shared/rubamazzetto');
  const mv = RMB.moves(c(5, 'd', 1), [c(5, 'c', 2)], [[], [c(9, 'b', 3), c(5, 's', 4)]], 0);
  assert.deepStrictEqual(mv.map((m) => m.kind), ['steal', 'table'], 'si può rubare o prendere dal tavolo');
  // Sette e mezzo: figure mezzo punto, matta, reale
  const SMB = require('../shared/settemezzo');
  assert.strictEqual(SMB.total([c(7, 'c', 1), c(9, 'b', 2)], {}), 7.5);
  assert.strictEqual(SMB.total([c(10, 'd', 1), c(3, 'c', 2)], { matta: true }), 7, 'la matta vale quello che serve (fino a 7)');
  assert(SMB.reale([c(7, 'c', 1), c(8, 's', 2)], {}) && !SMB.reale([c(3, 'c', 1), c(4, 's', 2), c(8, 'b', 3)], {}), 'reale solo con due carte');
  {
    const ES = require('./settemezzo'), BS = require('./settemezzo-bot');
    for (const n of [2, 4]) {
      const g = ES.createGame({ rules: { players: n }, players: Array.from({ length: n }, (_, i) => ({ name: 'S' + i, isBot: true })) });
      let guard = 0;
      while (!g.over && guard++ < 5000) {
        if (g.phase === 'handEnd') {
          assert.strictEqual(g.scores.reduce((a, b) => a + b, 0), SMB.START_CHIPS * n, 'le fiches non si creano né si perdono');
          ES.nextHand(g); continue;
        }
        ES.apply(g, g.turn, BS.nextAction(g, g.turn, { level: guard % 2 ? 'difficile' : 'normale' }));
      }
      assert(g.over, 'sette e mezzo: la partita finisce');
      // le carte coperte degli altri non si vedono
      const g2 = ES.createGame({ rules: { players: n }, players: Array.from({ length: n }, (_, i) => ({ name: 'S' + i, isBot: true })) });
      const v = ES.viewFor(g2, 0);
      assert(v.seats[1].cards[0].hidden && !v.seats[0].cards[0].hidden, 'carta coperta visibile solo a chi la ha');
    }
  }
  // Tressette: si risponde al seme; il Tre batte l'Asso; accusi
  const TRS = require('../shared/tressette');
  assert.strictEqual(TRS.winner([c(1, 'd', 1), c(3, 'd', 2), c(3, 'c', 3)]), 1, 'il Tre di denari prende; il Tre di coppe non risponde');
  assert.deepStrictEqual(TRS.legal([c(5, 'c', 1), c(7, 'd', 2)], [c(1, 'd', 3)]).map((x) => x.id), [2], 'obbligo di rispondere al seme');
  assert.deepStrictEqual(TRS.accusi([c(1, 's', 1), c(2, 's', 2), c(3, 's', 3), c(3, 'd', 4), c(3, 'c', 5)]).map((a) => a.points), [3, 3], 'napoletana e tre Tre');
  // napola: Asso, 2, 3 di denari = 3 punti, con il 4 e il 5 in fila = 5
  assert.strictEqual(SC.napola([c(1, 'd', 1), c(2, 'd', 2), c(3, 'd', 3), c(4, 'd', 4), c(5, 'd', 5), c(7, 'd', 6)]), 5);
  assert.strictEqual(SC.napola([c(1, 'd', 1), c(3, 'd', 3)]), 0);
  for (const [gid, ns, extra] of [['scopa', [2, 4], {}], ['scopa', [4], { deal: 10, napola: true }], ['scopa', [4], { deal: 9 }], ['briscola', [2, 4], {}], ['tressette', [2, 4], {}], ['rubamazzetto', [2, 3, 4], {}]]) {
    const EG = require('./' + gid), BG = require('./' + gid + '-bot');
    for (const n of ns) {
      const g = EG.createGame({ rules: { players: n, ...extra }, players: Array.from({ length: n }, (_, i) => ({ name: 'B' + i, isBot: true })) });
      let guard = 0;
      while (!g.over && guard++ < 5000) {
        if (g.phase === 'handEnd') {
          hands++;
          const h = JSON.parse(JSON.stringify(g.lastReplay.start));
          Object.assign(h, { log: [], events: [], history: [] });
          for (const x of g.lastReplay.actions) EG.apply(h, x.s, x.a);
          assert.deepStrictEqual(h.handResult.teams.map((t) => t.total), g.handResult.teams.map((t) => t.total), 'moviola ' + gid);
          EG.nextHand(g);
          continue;
        }
        EG.apply(g, g.turn, BG.nextAction(g, g.turn, {}));
        const total = g.stock.length + (g.table || []).length + (g.trick || []).length + g.players.reduce((a, p) => a + p.hand.length, 0) + g.teams.reduce((a, t) => a + t.taken.length, 0);
        assert.strictEqual(total, 40, gid + ': carte non conservate');
      }
      assert(g.over, gid + ': partita finita');
    }
  }
  console.log(`Scopa e Briscola: prese, punti e ${hands} smazzate simulate OK`);
}

/** Tornei: tabellone, partite tra computer simulate, avanzamento fino al campione */
function tournamentTests() {
  const tournaments = new Map();
  const opened = [], notes = [], champs = [];
  const T = require('./tournaments')({
    tournaments, nickOf: (t) => ({ a: 'Anna', b: 'Bruno' }[t]),
    openMatch: (t, m) => { opened.push(m); return 'R' + opened.length; },
    simulate: () => 'a', notify: (tok, text) => notes.push(text), champion: (tok) => champs.push(tok),
  });
  const id = T.create('a', { name: 'Coppa', game: 'scopa', size: 8 });
  const t = T.get(id);
  T.join(t, 'b');
  assert.throws(() => T.start(t, 'a'), /Servono 8/);
  T.fillBots(t, 'a');
  assert.strictEqual(t.players.length, 8);
  T.start(t, 'a');
  // primo turno: 4 partite; quelle con un umano aprono un tavolo, le altre si simulano
  const humans = t.rounds[0].filter((m) => !t.players[m.a].bot || !t.players[m.b].bot);
  assert.strictEqual(opened.length, humans.length, 'tavoli solo per le partite con umani');
  for (const m of humans) T.matchDone(id, 0, t.rounds[0].indexOf(m), 'a');
  // si va avanti da soli fino alla finale (le partite tra computer si simulano)
  let guard = 0;
  while (t.status === 'in corso' && guard++ < 10) {
    const r = t.rounds.length - 1;
    t.rounds[r].forEach((m, i) => { if (m.winner == null) T.matchDone(id, r, i, 'b'); });
  }
  assert.strictEqual(t.status, 'finito');
  assert.strictEqual(t.rounds.length, 3, '8 giocatori: quarti, semifinali, finale');
  assert(t.champion != null && notes.some((x) => /è finito/.test(x)), 'campione e avviso');
  console.log('tornei: tabellone, partite simulate e campione OK');
}

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

/** Sfida del giorno: ogni variante (tutti i giochi) si gioca fino a fine smazzata, con le stesse carte per tutti */
function dailyTests() {
  const Daily = require('./daily');
  const Games = require('./games');
  const seen = new Set();
  for (let d = 0; d < Daily.VARIANTS.length; d++) {
    const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
    const c = Daily.challenge(date);
    seen.add(c.title);
    const G = Games.of(c.rules);
    const mk = () => G.E.createGame({ rules: c.rules, seed: c.seed, players: Array.from({ length: c.rules.players }, (_, i) => ({ name: i ? 'PC' + i : 'Tu', isBot: !!i })) });
    const g = mk();
    assert.deepStrictEqual(mk().players[0].hand.map((x) => x.id), g.players[0].hand.map((x) => x.id), 'stesse carte per tutti: ' + c.title);
    let guard = 0;
    while (g.phase !== 'handEnd' && guard++ < 5000) { const s = g.turn; G.E.apply(g, s, G.Bot.nextAction(g, s, { level: 'difficile' })); }
    assert.strictEqual(g.phase, 'handEnd', 'la sfida finisce: ' + c.title);
  }
  assert.strictEqual(seen.size, Daily.VARIANTS.length, 'una variante diversa ogni giorno');
  console.log(`sfida del giorno: ${seen.size} varianti, tutti i giochi OK`);
}

/** Punteggio Elo: chi vince contro un pari guadagna, contro il computer facile guadagna poco */
function eloTests() {
  const Elo = require('./elo');
  const h = (rating, games = 20) => ({ human: true, rating, games });
  let d = Elo.deltas([h(1000), h(1000)], [[0], [1]], [0]);
  assert(d[0] === 12 && d[1] === -12, 'pari livello: +12 e -12');
  d = Elo.deltas([h(1000), { human: false, rating: Elo.BOT_RATING.facile, games: 0 }], [[0], [1]], [0]);
  assert(d[0] > 0 && d[0] <= 6 && d[1] === 0, 'battere il computer facile vale poco; il computer non cambia');
  d = Elo.deltas([h(1000, 0), h(1000, 0), h(1000, 0), h(1000, 0)], [[0, 2], [1, 3]], [1, 3]);
  assert(d[1] === 20 && d[3] === 20 && d[0] === -20, 'a coppie: tutta la coppia sale o scende');
  console.log('punteggio Elo OK');
  // premi: sbloccati per livello o trofei
  const P = require('../shared/premi');
  const ids = P.unlockedIds({ level: 6, trophies: { torneo: 1 } });
  assert(ids.includes('t_veterano') && ids.includes('f_smeraldo') && ids.includes('f_argento') && !ids.includes('t_maestro'), 'premi sbloccati');
  assert(P.LIST.every((p) => !p.need.trophy || require('./trophies').BY_ID.get(p.need.trophy)), 'ogni premio chiede un trofeo che esiste');
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
  // altri giochi: trofei propri, niente trofei del Burraco
  assert.deepStrictEqual(T.fromHand({ burraco: [{ kind: 'clean' }], pozPts: 800, total: 3000 }, 'canasta').sort(), ['can_pulita', 'can_rossi']);
  assert.deepStrictEqual(T.fromHand({ burraco: [], detail: { carte: 1, denari: 1, settebello: 1, primiera: 1, scope: 3 }, total: 7 }, 'scopa').sort(), ['sc_cappotto', 'sc_scope3']);
  assert.deepStrictEqual(T.fromHand({ burraco: [], points: 101, total: 1 }, 'briscola'), ['br_cento']);
  assert(T.fromGame(g, 0, { gid: 'scopa' }).includes('sc_vittoria') && !T.fromGame(g, 1, { gid: 'scopa' }).includes('sc_vittoria'));
  assert.deepStrictEqual(T.fromStats({ wins: 10, burraco: 0, closures: 1, games: 12 }).sort(), ['chiusura', 'prima_vittoria', 'vittorie_10']);
  // Scala 40: apertura al primo turno, chiusura in mano, jolly rubato (dalla moviola)
  const rp = { actions: [
    { s: 0, a: { type: 'draw' } }, { s: 0, a: { type: 'meld', cardIds: [1, 2, 3] } }, { s: 0, a: { type: 'discard', cardId: 4 } },
    { s: 1, a: { type: 'draw' } }, { s: 1, a: { type: 'discard', cardId: 9 } },
    { s: 0, a: { type: 'draw' } }, { s: 0, a: { type: 'swap', meldId: 1, cardId: 5 } }, { s: 0, a: { type: 'discard', cardId: 6 } },
  ] };
  assert.deepStrictEqual(T.fromScala40(rp, { reason: 'close', closer: 1 }, 0).sort(), ['s40_apertura', 's40_jolly']);
  const inHand = { actions: [{ s: 1, a: { type: 'draw' } }, { s: 1, a: { type: 'discard', cardId: 9 } }, { s: 1, a: { type: 'draw' } }, { s: 1, a: { type: 'meld', cardIds: [1, 2, 3] } }, { s: 1, a: { type: 'discard', cardId: 4 } }] };
  assert.deepStrictEqual(T.fromScala40(inHand, { reason: 'close', closer: 1 }, 1), ['s40_mano'], 'chiusura in mano');
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
eloTests();
dailyTests();
leagueTests();
storeTests();
scala40Tests();
canastaTests();
presaTests();
tournamentTests();
filesTests();
// TEST_RAPIDO=1 (npm run test:rapido): meno partite simulate, per le verifiche durante il lavoro.
// Le prove su GitHub usano sempre la versione completa.
const QUICK = !!process.env.TEST_RAPIDO;
for (const p of Rules.PRESETS) for (const n of QUICK ? [4, 2] : [4, 2, 3]) simulate(p.id, p.rules, n, QUICK ? 1 : 3);
// configurazioni casuali
for (let i = 0; i < (QUICK ? 3 : 12); i++) {
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
