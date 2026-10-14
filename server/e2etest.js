'use strict';
/*
 * Prova multigiocatore end-to-end: avvia un server di prova, collega due giocatori
 * e verifica le funzioni del tavolo una dopo l'altra.  npm run e2e
 */
const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const Levels = require('./levels');

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-e2e-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer() {
  const proc = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, BOT_DELAY: '15', TIMER_SCALE: '0.01' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  return new Promise((resolve) => proc.stdout.on('data', (d) => { if (String(d).includes('ascolto')) resolve(proc); }));
}

/** Giocatore di prova: tiene l'ultimo stato ricevuto e permette di aspettare condizioni */
function player(name) {
  const sock = io(URL, { transports: ['websocket'], forceNew: true });
  const p = { name, sock, state: null, chats: [] };
  sock.on('state', (st) => { p.state = st; });
  sock.on('chat', (m) => p.chats.push(m));
  p.trophies = [];
  p.progress = [];
  sock.on('progress', (x) => p.progress.push(x));
  sock.on('trophy', (list) => p.trophies.push(...list.map((t) => t.id)));
  p.call = (ev, data = {}) => new Promise((res) => sock.emit(ev, data, res));
  p.until = async (fn, what, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (p.state && fn(p.state)) return p.state; await wait(25); }
    throw new Error(`${name}: tempo scaduto aspettando ${what}`);
  };
  p.hello = (token) => new Promise((res) => { sock.emit('hello', { name, token }); sock.once('welcome', (w) => { p.token = w.token; res(w); }); });
  return p;
}

const step = (t) => console.log('✓ ' + t);

(async () => {
  const server = await startServer();
  try {
    // pagina di stato: solo con la chiave
    const key = fs.readFileSync(path.join(dataDir, 'admin-key.txt'), 'utf8').trim();
    assert.strictEqual((await fetch(`${URL}/stato`)).status, 403, 'senza chiave: accesso negato');
    const stato = await (await fetch(`${URL}/stato.json?k=${key}`)).json();
    assert(typeof stato.connessi === 'number' && Array.isArray(stato.tavoli), 'dati di stato');
    step('pagina di stato protetta da chiave');

    const A = player('Anna'), B = player('Bruno');
    await A.hello(); await B.hello();

    // tavolo: 4 posti, obiettivo basso per arrivare presto a fine partita
    let r = await A.call('createRoom', { rules: { players: 4, target: 100 } });
    assert(r.ok, r.error);
    const code = (await A.until((s) => s.room, 'tavolo')).room.code;
    assert((await B.call('joinRoom', { code })).ok);
    await A.until((s) => s.room.seats.filter(Boolean).length === 2, 'secondo giocatore');
    step('due giocatori nello stesso tavolo');

    // --- profili: nickname univoco ---
    let ck = await A.call('checkNick', { nick: 'Anna' });
    assert(ck.ok && ck.available, 'Anna disponibile');
    assert((await A.call('setNick', { nick: 'Anna' })).ok);
    ck = await B.call('checkNick', { nick: 'ANNA' });
    assert(ck.ok && !ck.available, 'nickname già preso (maiuscole/minuscole non contano)');
    assert(!(await B.call('setNick', { nick: 'anna' })).ok, 'non si può prendere un nick occupato');
    assert(!(await B.call('checkNick', { nick: 'a' })).available, 'nick troppo corto');
    assert((await B.call('setNick', { nick: 'Bruno' })).ok);
    step('nickname univoco con controllo disponibile / non disponibile');

    // --- segnalazione di un problema: arriva nella pagina di stato con la situazione del tavolo ---
    assert(!(await A.call('report', { text: 'ok' })).ok, 'testo troppo corto');
    assert((await A.call('report', { text: 'Il pulsante non funziona', screen: 'game', device: 'test' })).ok);
    assert(!(await A.call('report', { text: 'Seconda segnalazione subito' })).ok, 'una al minuto');
    const st2 = await (await fetch(`${URL}/stato.json?k=${key}`)).json();
    assert(st2.segnalazioni[0].text === 'Il pulsante non funziona' && st2.segnalazioni[0].table.code === code, 'segnalazione con il tavolo');
    step('segnala un problema: arriva nella pagina di stato con la situazione del tavolo');

    // segnalare un giocatore: arriva con il motivo e gli ultimi messaggi della chat del tavolo
    await A.call('chat', { text: 'messaggio di prova per la segnalazione' });
    await wait(100);
    assert(!(await B.call('reportPlayer', { nick: 'Anna', reason: 'boh' })).ok, 'motivo obbligatorio');
    assert((await B.call('reportPlayer', { nick: 'Anna', reason: 'offese', text: 'prova' })).ok);
    const st3 = await (await fetch(`${URL}/stato.json?k=${key}`)).json();
    const rp3 = st3.segnalazioni[0];
    assert(rp3.kind === 'player' && rp3.target === 'Anna' && rp3.chat.some((m) => m.includes('messaggio di prova')), 'segnalazione del giocatore con la chat');
    step('segnala un giocatore: motivo e chat del tavolo nella pagina di stato');

    // --- avatar e reazioni ---
    assert(!(await A.call('setAvatar', { e: '💩', c: '#000' })).ok, 'avatar non previsto rifiutato');
    assert((await A.call('setAvatar', { e: '🦊', c: '#64b5f6' })).ok);
    await B.until((s) => s.room.seats.some((x) => x && x.avatar && x.avatar.e === '🦊'), 'avatar visibile al tavolo');
    const reacted = new Promise((res) => B.sock.once('reaction', res));
    assert((await A.call('react', { emoji: '👏' })).ok);
    const re = await reacted;
    assert(re.emoji === '👏' && re.seat === 0, 'reazione ricevuta');
    assert(!(await A.call('react', { emoji: '🔥' })).ok, 'limite anti-raffica');
    step('avatar personalizzato e reazioni rapide');

    // --- amici: richiesta, accettazione, stato online, invito ---
    const socialOf = (p) => new Promise((res) => p.call('social').then((r) => res(r.social)));
    assert(!(await A.call('friendRequest', { nick: 'Anna' })).ok, 'niente amicizia con se stessi');
    assert((await A.call('friendRequest', { nick: 'bruno' })).ok);
    assert.deepStrictEqual((await socialOf(B)).reqIn, ['Anna']);
    assert.deepStrictEqual((await socialOf(A)).reqOut, ['Bruno']);
    assert((await B.call('friendRespond', { nick: 'Anna', accept: true })).ok);
    const fa = await socialOf(A);
    assert(fa.friends.length === 1 && fa.friends[0].nick === 'Bruno' && fa.friends[0].online, 'Bruno amico e online');
    const invited = new Promise((res) => B.sock.once('invite', res));
    assert((await A.call('inviteFriend', { nick: 'Bruno' })).ok);
    const inv = await invited;
    assert(inv.from === 'Anna' && inv.code === code, 'invito ricevuto con il codice del tavolo');
    step('amicizia: richiesta, accettazione, online e invito al tavolo');

    // --- cambio dispositivo: codice personale e nickname + password ---
    const prof = await A.call('profile');
    assert(prof.ok && /^BUR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(prof.code), 'codice personale');
    const C = player('Nuovo telefono');
    await C.hello();
    let imp = await C.call('importProfile', { code: prof.code.toLowerCase().replace(/-/g, ' ') });
    assert(imp.ok && imp.token === A.token && imp.nick === 'Anna', 'profilo importato col codice');
    assert(!(await C.call('importProfile', { code: 'BUR-AAAA-BBBB-CCCC' })).ok, 'codice sbagliato rifiutato');
    assert(!(await B.call('setPassword', { password: '123' })).ok, 'password troppo corta');
    assert((await B.call('setPassword', { password: 'segreta123' })).ok);
    assert(!(await C.call('login', { nick: 'bruno', password: 'sbagliata' })).ok, 'password errata');
    const lg = await C.call('login', { nick: 'bruno', password: 'segreta123' });
    assert(lg.ok && lg.token === B.token, 'accesso con nickname e password');
    // eliminazione: il nickname torna libero e l'amicizia sparisce
    const D = player('Temporaneo');
    await D.hello();
    assert((await D.call('setNick', { nick: 'Tempo' })).ok);
    assert((await D.call('friendRequest', { nick: 'Anna' })).ok);
    assert.deepStrictEqual((await socialOf(A)).reqIn, ['Tempo']);
    assert((await D.call('deleteProfile')).ok);
    assert.deepStrictEqual((await socialOf(A)).reqIn, [], 'richiesta sparita');
    assert((await C.call('checkNick', { nick: 'Tempo' })).available, 'nickname di nuovo libero');
    D.sock.close();
    C.sock.close();
    step("cambio dispositivo con codice personale e con nickname + password; eliminazione del profilo");

    // suggerimenti vietati in multiplayer
    r = await A.call('setHints', { on: true });
    assert(!r.ok && /multiplayer/.test(r.error), 'i suggerimenti non devono attivarsi con due umani');
    step('suggerimenti bloccati in multiplayer');

    // aiuto "dove attaccare": attivo di serie, solo l'host lo cambia, arriva a tutti
    assert(B.state.room.aids === true, 'aiuti attivi di serie');
    assert(!(await B.call('setAids', { on: false })).ok, "solo l'host");
    assert((await A.call('setAids', { on: false })).ok);
    await B.until((s) => s.room.aids === false, 'aiuti disattivati per tutti');
    assert((await A.call('setAids', { on: true })).ok);
    step("aiuto 'dove attaccare' attivabile solo dall'host");

    // musica: l'host condivide, l'altro la riceve; link non Spotify rifiutato
    assert(!(await A.call('setMusic', { url: 'https://evil.example/x' })).ok);
    assert((await A.call('setMusic', { url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' })).ok);
    await B.until((s) => s.room.music && /spotify/.test(s.room.music.url) && s.room.music.by === 'Anna', 'musica condivisa');
    assert(!(await B.call('setMusic', { url: 'https://open.spotify.com/playlist/x' })).ok, 'solo l\'host cambia la musica');
    step('musica del tavolo condivisa (e riservata all\'host)');

    // bravura del computer
    assert(!(await A.call('setBotLevel', { level: 'impossibile' })).ok);
    assert((await A.call('setBotLevel', { level: 'difficile' })).ok);
    await B.until((s) => s.room.botLevel === 'difficile', 'livello del computer');
    step("bravura del computer impostata dall'host");

    // timer: 30 s (accelerati) → i turni degli umani vanno avanti da soli
    assert((await A.call('setTurnTime', { seconds: 30 })).ok);
    assert((await A.call('addBot', {})).ok);
    assert((await A.call('start')).ok);
    await B.until((s) => s.game, 'inizio partita');
    await A.until((s) => s.game && s.game.log.some((l) => l.includes('Tempo scaduto')), 'turno automatico per tempo scaduto', 30000);
    step('timer del turno: allo scadere pesca e scarta in automatico');

    // spettatore: entra a partita iniziata, vede il tavolo ma non le carte, non può giocare
    const W = player('Walter');
    await W.hello();
    assert((await W.call('setNick', { nick: 'Walter' })).ok);
    assert((await W.call('joinRoom', { code })).ok, 'ingresso come spettatore');
    const ws = await W.until((s) => s.game, 'vista dello spettatore');
    assert.strictEqual(ws.room.you, -1, 'senza posto');
    assert.strictEqual(ws.game.hand.length, 0, 'nessuna carta in mano visibile');
    assert(ws.game.players.length === 4 && ws.game.teams.length === 2, 'tavolo visibile');
    assert(!(await W.call('action', { type: 'draw' })).ok, 'lo spettatore non gioca');
    await A.until((s) => s.room.spectators.includes('Walter'), 'spettatore visibile ai giocatori');
    assert((await W.call('leaveRoom')).ok);
    await A.until((s) => !s.room.spectators.includes('Walter'), 'spettatore uscito');
    W.sock.close();
    step('spettatore: vede il tavolo senza le carte in mano e non può giocare');

    // riconnessione: Bruno cade e rientra con lo stesso token, ritrovando posto e carte
    const bSeat = B.state.game.you;
    B.sock.close();
    await A.until((s) => s.room.seats[bSeat] && s.room.seats[bSeat].connected === false, 'Bruno offline');
    const tokenB = B.token;
    const B2 = player('Bruno');
    await B2.hello(tokenB);
    const back = await B2.until((s) => s.game, 'rientro di Bruno');
    assert.strictEqual(back.game.you, bSeat, 'stesso posto dopo la riconnessione');
    assert(back.game.hand.length > 0, 'carte ritrovate');
    await A.until((s) => s.room.seats[bSeat].connected === true, 'Bruno di nuovo online');
    Object.assign(B, { sock: B2.sock, state: B2.state, call: B2.call, until: B2.until });
    B2.sock.on('state', (st) => { B.state = st; });
    step('riconnessione: stesso posto e stesse carte, gli altri vedono offline/online');

    // si gioca da soli (timer + bot) fino a fine partita; tra una smazzata e l'altra si dà il "pronto"
    const end = Date.now() + 120000;
    while (!(A.state.game && A.state.game.over)) {
      if (Date.now() > end) throw new Error('la partita non finisce');
      for (const p of [A, B]) {
        const g = p.state.game;
        if (g && g.phase === 'handEnd' && !g.over && !p.state.room.ready.includes(g.you)) await p.call('ready');
      }
      await wait(50);
    }
    step(`partita finita dopo ${A.state.game.handNo} smazzate`);

    // moviola: l'ultima smazzata finita, con le mosse che rigiocate portano allo stesso risultato
    const rp = await A.call('replay');
    assert(rp.ok && rp.replay.actions.length > 10 && rp.replay.start.players.every((p) => p.hand.length > 0), 'moviola disponibile');
    assert(A.state.game.hasReplay, "il client sa che c'è una moviola");

    // classifica: entrambi gli umani hanno una partita giocata
    const lb = await A.call('leaderboard');
    assert(lb.ok && lb.list.length === 2 && lb.list.every((e) => e.games === 1), 'classifica aggiornata');
    assert.strictEqual(lb.list.filter((e) => e.me).length, 1);
    assert.strictEqual(lb.list.reduce((n, e) => n + e.wins, 0) >= 1, true);
    step('classifica aggiornata a fine partita');

    // campionato tra amici: Anna lo crea e aggiunge Bruno (amico); conterà la prossima partita insieme
    const lc = await A.call('leagueCreate', { name: 'Burraco del giovedì', period: 'settimana' });
    assert(lc.ok && lc.id, 'campionato creato');
    assert((await A.call('leagueAdd', { id: lc.id, nick: 'Bruno' })).ok);
    assert(!(await B.call('leagueAdd', { id: lc.id, nick: 'Anna' })).ok, 'solo il creatore aggiunge');

    // statistiche sul server, storico, scheda dell'amico, classifica solo amici
    const ms = await A.call('myStats');
    assert(ms.ok && ms.stats.games === 1 && ms.stats.hands >= 1 && ms.history.length === 1, 'statistiche e storico di Anna');
    assert(ms.history[0].teams.some((t) => t.mine), 'nello storico è segnata la propria squadra');
    assert(ms.byGame.burraco && ms.byGame.burraco.games === 1 && !ms.byGame.scala40, 'statistiche del Burraco separate');
    // trofei: "Tra amici" (Anna e Bruno sono amici), avvisi in tempo reale, bacheca con l'avanzamento
    await A.until(() => A.trophies.includes('amici'), 'avviso del trofeo');
    const tAmici = ms.trophies.find((t) => t.id === 'amici');
    assert(tAmici && tAmici.at, 'trofeo "Tra amici" in bacheca');
    assert(ms.trophies.find((t) => t.id === 'maratona').progress.now === 1, 'avanzamento: 1 partita su 100');
    const lbw = lb.list.find((e) => e.me);
    if (lbw.wins) assert(ms.trophies.find((t) => t.id === 'prima_vittoria').at, 'prima vittoria');
    step(`trofei: ${A.trophies.join(', ')}`);
    // livello: calcolato dalle statistiche, sale a fine partita, visibile al tavolo e in classifica
    assert(ms.level && ms.level.level >= 1 && ms.level.xp >= 50 && Levels.levelOf({ games: 1, wins: 1 }).level === 2, `livello di Anna (${JSON.stringify(ms.level)})`);
    assert(A.progress.length > 0, 'aggiornamento del livello a fine partita');
    assert(A.state.room.seats.every((x) => x.isBot ? x.level === null : x.level >= 1), 'livello accanto ai nomi al tavolo');
    assert(lb.list.every((x) => x.level >= 1), 'livello in classifica');
    step(`livello: Anna è al livello ${ms.level.level} (${ms.level.xp} punti esperienza)`);
    const card = await A.call('playerCard', { nick: 'Bruno' });
    assert(card.ok && card.together.games === 1 && card.stats.games === 1, 'scheda di Bruno con la partita giocata insieme');
    assert.strictEqual(card.together.asPartners, 0, 'Anna e Bruno erano avversari');
    assert(card.trophies.some((t) => t.id === 'amici'), 'i trofei di Bruno nella sua scheda');
    const D2 = player('Estraneo'); await D2.hello(); assert((await D2.call('setNick', { nick: 'Estraneo' })).ok);
    assert(!(await D2.call('playerCard', { nick: 'Anna' })).ok, 'scheda visibile solo agli amici');
    const lf = await A.call('leaderboard', { friends: true });
    assert(lf.ok && lf.list.length === 2, 'classifica tra amici');
    // blocco: l'estraneo bloccato non può più chiedere l'amicizia
    assert((await D2.call('friendRequest', { nick: 'Anna' })).ok);
    assert((await A.call('blockPlayer', { nick: 'Estraneo' })).ok);
    assert.deepStrictEqual((await A.call('social')).social.reqIn, [], 'richiesta tolta dal blocco');
    assert(!(await D2.call('friendRequest', { nick: 'Anna' })).ok, 'bloccato: niente richieste');
    assert((await A.call('unblockPlayer', { nick: 'Estraneo' })).ok);
    assert((await D2.call('friendRequest', { nick: 'Anna' })).ok, 'sbloccato: richieste di nuovo possibili');
    D2.sock.close();
    step('statistiche sul server, storico partite, scheda amico e classifica tra amici; blocco giocatore');

    // mini-torneo: impostato tra una partita e l'altra, conta le vittorie
    assert((await A.call('setSeries', { bestOf: 3 })).ok);
    await B.until((s) => s.room.series && s.room.series.bestOf === 3, 'torneo al meglio di 3');

    // rivincita: serve il voto di tutti gli umani
    const seatsBefore = A.state.game.players.map((p) => p.name);
    assert((await A.call('ready')).ok);
    await wait(200);
    assert(A.state.game.over, 'con un solo voto la rivincita non deve partire');
    assert(A.state.room.ready.includes(A.state.game.you));
    assert((await B.call('ready')).ok);
    const ng = await A.until((s) => s.game && !s.game.over && s.game.handNo === 1 && s.game.scores.every((x) => x === 0), 'nuova partita');
    assert.deepStrictEqual(ng.game.players.map((p) => p.name), seatsBefore, 'stessi posti');
    step('rivincita con il voto di tutti, stessi posti');

    // seconda partita del torneo: alla fine il conteggio delle vittorie sale
    const end2 = Date.now() + 120000;
    while (!(A.state.game && A.state.game.over)) {
      if (Date.now() > end2) throw new Error('la seconda partita non finisce');
      for (const p of [A, B]) {
        const g = p.state.game;
        if (g && g.phase === 'handEnd' && !g.over && !p.state.room.ready.includes(g.you)) await p.call('ready');
      }
      await wait(50);
    }
    const sr = (await A.until((s) => s.room.series && s.room.series.games === 1, 'torneo aggiornato')).room.series;
    assert.strictEqual(sr.wins.reduce((a, b) => a + b, 0) >= 1, true, 'vittorie contate');
    assert.strictEqual(sr.champion, null, 'dopo una partita su tre nessun campione');
    const lgs = (await B.call('leagues')).list;
    const lgv = lgs.find((x) => x.id === lc.id);
    assert(lgv && lgv.standings.length === 2 && lgv.standings.every((x) => x.games === 1) && lgv.standings[0].pts === 3, 'classifica del campionato dopo la partita');
    step(`campionato tra amici: ${lgv.standings.map((x) => `${x.name} ${x.pts} pt`).join(', ')}`);
    step('mini-torneo: vittorie contate partita dopo partita');

    // allenamento: Classico in 2, computer facile, suggerimenti attivi
    const T = player('Tina'); await T.hello(); assert((await T.call('setNick', { nick: 'Tina' })).ok);
    assert((await T.call('createRoom', { tutorial: true })).ok);
    const ts = await T.until((s) => s.game, 'partita di allenamento');
    assert(ts.room.tutorial && ts.room.hints && ts.room.botLevel === 'facile' && ts.room.n === 2, 'impostazioni dell\'allenamento');
    T.sock.close();
    const T4 = player('Tilde'); await T4.hello(); assert((await T4.call('setNick', { nick: 'Tilde' })).ok);
    assert((await T4.call('createRoom', { tutorial: true, rules: { game: 'scala40' } })).ok);
    const t4 = await T4.until((st) => st.game, 'allenamento di Scala 40');
    assert(t4.room.tutorial && t4.room.game === 'scala40' && t4.room.n === 2 && t4.room.hints, 'allenamento di Scala 40');
    T4.sock.close();
    step('allenamento (Burraco e Scala 40): 2 giocatori, computer facile, suggerimenti attivi');

    // sfida del giorno: un tentativo, stesse carte per tutti, punteggio in classifica, niente rivincita
    const Dd = player('Dora'); await Dd.hello(); assert((await Dd.call('setNick', { nick: 'Dora' })).ok);
    const info = await Dd.call('daily');
    assert(info.ok && info.title && info.rules.players === 2 && info.mine === null, 'informazioni sulla sfida');
    assert((await Dd.call('startDaily')).ok);
    assert(!(await Dd.call('startDaily')).ok, 'un solo tentativo al giorno');
    const ds = await Dd.until((st) => st.game, 'partita della sfida');
    assert(ds.room.daily && ds.room.botLevel === 'difficile', 'sfida contro il computer difficile');
    const firstHand = ds.game.hand.map((c) => `${c.r}${c.s}`).sort().join();
    const endD = Date.now() + 60000;
    while (!(Dd.state.game && Dd.state.game.over)) {
      if (Date.now() > endD) throw new Error('la sfida non finisce');
      const g = Dd.state.game;
      if (g.turn === g.you && g.phase === 'draw') await Dd.call('action', { type: 'draw' });
      else if (g.turn === g.you && g.phase === 'play') {
        for (const c of g.hand.slice().reverse()) if ((await Dd.call('action', { type: 'discard', cardId: c.id })).ok) break;
      }
      await wait(20);
    }
    assert(!(await Dd.call('ready')).ok, 'la sfida è una sola smazzata');
    assert(!(await Dd.call('replay')).ok, 'niente moviola nella sfida del giorno (rivelerebbe il mazzo)');
    const after = await Dd.call('daily');
    assert(after.mine && after.mine.score != null && after.myPos === 1 && after.top[0].name === 'Dora', 'punteggio nella classifica del giorno');
    // stesse carte per tutti: un secondo giocatore riceve la stessa mano iniziale
    const Ee = player('Elio'); await Ee.hello(); assert((await Ee.call('setNick', { nick: 'Elio' })).ok);
    assert((await Ee.call('startDaily')).ok);
    const es = await Ee.until((st) => st.game, 'sfida di Elio');
    assert.strictEqual(es.game.hand.map((c) => `${c.r}${c.s}`).sort().join(), firstHand, 'stessa mano iniziale');
    Dd.sock.close(); Ee.sock.close();
    step(`sfida del giorno «${info.title}»: Dora ${after.mine.score} punti, un tentativo, stesse carte per tutti`);

    // gioca subito: due giocatori cercano un tavolo da 2 e la partita parte da sola
    const Q1 = player('Quinto'), Q2 = player('Sesto');
    await Q1.hello(); await Q2.hello();
    assert((await Q1.call('setNick', { nick: 'Quinto' })).ok); assert((await Q2.call('setNick', { nick: 'Sesto' })).ok);
    const q1 = await Q1.call('quickPlay', { n: 2 });
    const q2 = await Q2.call('quickPlay', { n: 2 });
    assert(q1.ok && q2.ok && q1.code === q2.code, 'stesso tavolo veloce');
    await Q1.until((s) => s.game && s.room.quick === 2, 'partita veloce avviata');
    Q1.sock.close(); Q2.sock.close();
    step('gioca subito: tavolo veloce che parte da solo quando è pieno');

    // giocatore offline: senza timer, il computer gioca al suo posto e il tavolo non si blocca
    const O1 = player('Ottavio'), O2 = player('Nora');
    await O1.hello(); await O2.hello();
    assert((await O1.call('setNick', { nick: 'Ottavio' })).ok); assert((await O2.call('setNick', { nick: 'Nora' })).ok);
    assert((await O1.call('createRoom', { rules: { players: 2 } })).ok);
    const oc = (await O1.until((s) => s.room, 'tavolo')).room.code;
    assert((await O2.call('joinRoom', { code: oc })).ok);
    assert((await O1.call('start')).ok);
    await O1.until((s) => s.game, 'partita');
    let autoplay = true;
    (async () => { // Ottavio gioca da solo: pesca e scarta
      while (autoplay) {
        const g = O1.state && O1.state.game;
        if (g && g.turn === g.you && g.phase === 'draw') await O1.call('action', { type: 'draw' });
        else if (g && g.turn === g.you && g.phase === 'play') await O1.call('action', { type: 'discard', cardId: g.hand[g.hand.length - 1].id });
        else if (g && g.phase === 'handEnd' && !O1.state.room.ready.includes(g.you)) await O1.call('ready');
        await wait(30);
      }
    })();
    const noraToken = O2.token;
    const noraSeat = (await O2.until((s) => s.game, 'partita per Nora')).game.you;
    O2.sock.close();
    await O1.until((s) => s.game && s.game.log.some((l) => l.includes('Nora è offline: il computer gioca')), 'il computer gioca per Nora', 20000);
    const turnsBefore = O1.state.game.log.length;
    await wait(500);
    assert(O1.state.game.log.length > turnsBefore || O1.state.game.phase === 'handEnd', 'il tavolo va avanti');
    step('giocatore offline: il computer gioca al suo posto, il tavolo non si blocca');

    // rientro: Nora ritrova il posto; poi esce dalla partita e torna al suo posto col codice
    const O3 = player('Nora');
    await O3.hello(noraToken);
    await O3.until((s) => s.game && s.game.you === noraSeat, 'Nora di nuovo al suo posto');
    assert((await O3.call('leaveRoom')).ok);
    await O1.until((s) => s.room.seats[noraSeat].isBot, 'posto passato al computer');
    assert((await O3.call('joinRoom', { code: oc })).ok);
    const nb = await O3.until((s) => s.game && s.game.you === noraSeat, 'Nora torna al suo posto');
    assert(!nb.room.seats[noraSeat].isBot && nb.game.hand.length > 0, 'di nuovo umana, con le sue carte');
    autoplay = false;
    O1.sock.close(); O3.sock.close();
    step('chi esce da una partita in corso può tornare al suo posto');

    // partita con calma: chi esce tiene il posto, nessuno gioca al suo posto, avviso "tocca a te", rientro
    const S1 = player('Sara'), S2 = player('Ugo');
    await S1.hello(); await S2.hello();
    assert((await S1.call('setNick', { nick: 'Sara' })).ok); assert((await S2.call('setNick', { nick: 'Ugo' })).ok);
    S2.turnAlerts = [];
    S2.sock.on('yourTurn', (x) => S2.turnAlerts.push(x));
    S2.games = null;
    S2.sock.on('myGames', (l) => { S2.games = l; });
    assert((await S1.call('createRoom', { rules: { players: 2 } })).ok);
    const sc = (await S1.until((st) => st.room, 'tavolo con calma')).room.code;
    assert(!(await S2.call('setSlow', { on: true })).ok || true);
    assert((await S1.call('setSlow', { on: true })).ok);
    assert((await S2.call('joinRoom', { code: sc })).ok);
    assert((await S1.call('start')).ok);
    assert(!(await S1.call('setSlow', { on: false })).ok, 'il ritmo non si cambia a partita iniziata');
    const ugoSeat = (await S2.until((st) => st.game, 'partita con calma')).game.you;
    assert(S2.state.room.slow, 'tavolo con calma');
    // Ugo torna alla schermata iniziale: il posto resta suo
    assert((await S2.call('leaveRoom')).ok);
    await wait(100);
    assert(!S1.state.room.seats[ugoSeat].isBot, 'il posto di Ugo resta suo');
    const ug = S2.games.find((x) => x.code === sc);
    assert(ug && ug.started, 'la partita è nell\'elenco di Ugo');
    // Sara gioca finché tocca a Ugo: Ugo riceve l'avviso e la partita lo aspetta
    const endS = Date.now() + 30000;
    while (!(S1.state.game.turn === ugoSeat && S1.state.game.phase !== 'handEnd')) {
      if (Date.now() > endS) throw new Error('non arriva il turno di Ugo');
      const g = S1.state.game;
      if (g.turn === g.you && g.phase === 'draw') await S1.call('action', { type: 'draw' });
      else if (g.turn === g.you && g.phase === 'play') {
        for (const c of g.hand.slice().reverse()) if ((await S1.call('action', { type: 'discard', cardId: c.id })).ok) break;
      }
      await wait(20);
    }
    const waitAlert = Date.now() + 3000;
    while (!S2.turnAlerts.some((x) => x.code === sc) && Date.now() < waitAlert) await wait(20);
    assert(S2.turnAlerts.some((x) => x.code === sc && /Sara/.test(x.text)), 'avviso "tocca a te" a Ugo');
    assert(S2.games.find((x) => x.code === sc).myTurn, 'nell\'elenco: tocca a Ugo');
    const logLen = S1.state.game.log.length;
    await wait(1200); // ben oltre l'attesa per gli assenti nelle partite normali
    assert(S1.state.game.turn === ugoSeat && S1.state.game.log.length === logLen, 'nessuno gioca al posto di Ugo');
    // Ugo rientra allo stesso posto e gioca
    assert((await S2.call('joinRoom', { code: sc })).ok);
    const ub = await S2.until((st) => st.game && st.game.you === ugoSeat, 'Ugo al suo posto');
    assert(ub.game.hand.length > 0, 'con le sue carte');
    assert((await S2.call('action', { type: 'draw' })).ok);
    // notifiche push: iscrizione valida accettata, non valida rifiutata
    assert(!(await S2.call('pushSubscribe', { sub: { endpoint: 'nope' } })).ok, 'iscrizione non valida');
    assert((await S2.call('pushSubscribe', { sub: { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } } })).ok);
    assert((await S2.call('pushKey')).key.length > 40, 'chiave pubblica VAPID');
    // abbandono: il computer prende il posto
    assert((await S2.call('leaveRoom', { abandon: true })).ok);
    await S1.until((st) => st.room.seats[ugoSeat].isBot, 'Ugo ha abbandonato: gioca il computer');
    S1.sock.close(); S2.sock.close();
    step('partita con calma: posto tenuto, nessuno gioca al tuo posto, avviso "tocca a te", rientro e abbandono');

    // resa, partita terminata dall'host, tavolo chiuso
    const R1 = player('Rita'), R2 = player('Remo');
    await R1.hello(); await R2.hello();
    assert((await R1.call('setNick', { nick: 'Rita' })).ok); assert((await R2.call('setNick', { nick: 'Remo' })).ok);
    R2.notices = [];
    R2.sock.on('notice', (x) => R2.notices.push(x.text));
    // 4 giocatori: Rita (posto 0) e Remo (posto 2) compagni, gli avversari sono computer
    assert((await R1.call('createRoom', { rules: { players: 4 } })).ok);
    const rc = (await R1.until((st) => st.room, 'tavolo della resa')).room.code;
    assert((await R1.call('addBot', { seat: 1 })).ok);
    assert((await R2.call('joinRoom', { code: rc })).ok);
    await R1.until((st) => st.room.seats[2] && st.room.seats[2].name === 'Remo', 'Remo al posto 2');
    assert((await R1.call('addBot', { seat: 3 })).ok);
    assert((await R1.call('start')).ok);
    await R2.until((st) => st.game, 'partita');
    const p1 = await R1.call('surrender');
    assert(p1.ok && !p1.done, 'con un compagno umano la resa è solo una proposta');
    await R2.until((st) => st.room.surrender && st.room.surrender.includes(0), 'Remo vede la proposta');
    assert(!R2.state.game.over, 'la partita continua finché il compagno non accetta');
    const p2 = await R2.call('surrender');
    assert(p2.ok && p2.done, 'Remo accetta');
    const sg = await R1.until((st) => st.game && st.game.over, 'partita finita per resa');
    assert(sg.game.handResult.reason === 'surrender' && sg.game.winners.every((x) => x === 1 || x === 3), 'vincono gli avversari');
    // rivincita, poi l'host termina la partita senza vincitori: si torna in sala d'attesa
    assert((await R1.call('ready')).ok); assert((await R2.call('ready')).ok);
    await R1.until((st) => st.game && !st.game.over, 'rivincita');
    assert(!(await R2.call('endGame')).ok, "solo l'host termina la partita");
    assert((await R1.call('endGame')).ok);
    await R2.until((st) => st.room && !st.room.started && !st.game, 'di nuovo in sala d\'attesa');
    assert(R2.notices.some((t) => /terminato/.test(t)), 'avviso a tutti');
    // l'host chiude il tavolo: tutti alla schermata iniziale
    assert((await R1.call('closeTable')).ok);
    await R2.until((st) => st.room === null, 'Remo torna alla schermata iniziale');
    assert(!(await R2.call('joinRoom', { code: rc })).ok, 'il tavolo non esiste più');
    // 1 contro 1: la resa è immediata
    assert((await R1.call('createRoom', { rules: { players: 2 }, vsBots: true })).ok);
    await R1.until((st) => st.game && !st.game.over, 'partita 1 contro 1');
    assert((await R1.call('surrender')).done, 'da soli la resa è immediata');
    await R1.until((st) => st.game.over && st.game.winners.length === 1 && st.game.winners[0] === 1, 'vince il computer');
    R1.sock.close(); R2.sock.close();
    step('resa (con il sì del compagno), partita terminata dall\'host, tavolo chiuso');

    // Scala 40: tavolo contro il computer, apertura sotto i 40 rifiutata, smazzata intera, moviola
    const Q = player('Scalatore'); await Q.hello(); { const rq = await Q.call('setNick', { nick: 'Scalatore' }); assert(rq.ok, 'nickname: ' + rq.error); }
    assert((await Q.call('createRoom', { rules: { game: 'scala40', players: 2 }, vsBots: true })).ok);
    const qs = await Q.until((st) => st.game, 'partita di Scala 40');
    assert(qs.room.game === 'scala40' && qs.game.game === 'scala40' && qs.game.hand.length === 13, 'Scala 40 con 13 carte');
    const endQ = Date.now() + 60000;
    let triedLow = false;
    while (!(Q.state.game && Q.state.game.phase === 'handEnd')) {
      if (Date.now() > endQ) throw new Error('la smazzata di Scala 40 non finisce');
      const g = Q.state.game;
      if (g.turn === g.you && g.phase === 'draw') await Q.call('action', { type: 'draw' });
      else if (g.turn === g.you && g.phase === 'play') {
        if (!triedLow) {
          // tre carte qualsiasi: o non sono un gioco o non arrivano a 40 punti
          const r = await Q.call('action', { type: 'meld', cardIds: g.hand.slice(0, 3).map((c) => c.id) });
          assert(!r.ok, 'apertura non valida rifiutata');
          triedLow = true;
        }
        for (const c of g.hand.slice().reverse()) if ((await Q.call('action', { type: 'discard', cardId: c.id })).ok) break;
      }
      await wait(20);
    }
    const hrQ = Q.state.game.handResult;
    assert(hrQ.teams.length === 2 && hrQ.teams.every((t) => t.total <= 0), 'penalità a fine smazzata');
    assert((await Q.call('replay')).ok, 'moviola della Scala 40');
    const qst = await Q.call('myStats');
    assert(qst.byGame.scala40 && qst.byGame.scala40.hands >= 1 && !qst.byGame.burraco, 'statistiche della Scala 40 separate');
    const lb40 = await Q.call('leaderboard', { game: 'scala40' });
    assert(lb40.ok && lb40.game === 'scala40' && lb40.list.every((x) => x.name !== 'Anna'), 'classifica della Scala 40 senza le partite di Burraco');
    Q.sock.close();
    step(`Scala 40: smazzata giocata, penalità ${hrQ.teams.map((t) => -t.total).join(' e ')}`);

    // Canasta: tavolo a coppie contro il computer, una smazzata intera
    const K = player('Canastaro'); await K.hello(); { const rk = await K.call('setNick', { nick: 'Canastaro' }); assert(rk.ok, 'nickname: ' + rk.error); }
    assert((await K.call('createRoom', { rules: { game: 'canasta', players: 4, target: 2000 }, vsBots: true })).ok);
    const ks = await K.until((st) => st.game, 'partita di Canasta');
    assert(ks.room.game === 'canasta' && ks.game.game === 'canasta' && ks.game.hand.length >= 11, 'Canasta con 11 carte (più i tre rossi pescati)');
    const endK = Date.now() + 90000;
    while (!(K.state.game && K.state.game.phase === 'handEnd')) {
      if (Date.now() > endK) throw new Error('la smazzata di Canasta non finisce');
      const g = K.state.game;
      if (g.turn === g.you && g.phase === 'draw') await K.call('action', { type: 'draw' });
      else if (g.turn === g.you && g.phase === 'play') {
        let done = false;
        for (const c of g.hand.slice().reverse()) if ((await K.call('action', { type: 'discard', cardId: c.id })).ok) { done = true; break; }
        if (!done) throw new Error('nessuno scarto possibile');
      }
      await wait(20);
    }
    assert(K.state.game.handResult.teams.length === 2, 'Canasta a coppie: due squadre');
    assert((await K.call('replay')).ok, 'moviola della Canasta');
    K.sock.close();
    step('Canasta: smazzata a coppie giocata contro il computer');

    // Scopa e Briscola: una smazzata ciascuna contro il computer (si gioca la prima presa possibile)
    const SCm = require('../shared/scopa');
    for (const gid of ['scopa', 'briscola']) {
      const P = player('Presa' + gid); await P.hello(); { const rp = await P.call('setNick', { nick: 'Presa_' + gid }); assert(rp.ok, 'nickname: ' + rp.error); }
      assert((await P.call('createRoom', { rules: { game: gid, players: 2 }, vsBots: true })).ok);
      const ps = await P.until((st) => st.game, 'partita di ' + gid);
      assert(ps.room.game === gid && ps.game.presa && ps.game.hand.length === 3, gid + ': 3 carte in mano');
      const endP = Date.now() + 60000;
      while (!(P.state.game && P.state.game.phase === 'handEnd')) {
        if (Date.now() > endP) throw new Error('la smazzata di ' + gid + ' non finisce');
        const g = P.state.game;
        if (g.turn === g.you && g.phase === 'play') {
          const card = g.hand[0];
          const opts = gid === 'scopa' ? SCm.captures(card, g.table, g.cfg.rules) : [];
          const r = await P.call('action', { type: 'play', cardId: card.id, ...(opts.length > 1 ? { take: opts[0].map((c) => c.id) } : {}) });
          assert(r.ok, gid + ': giocata rifiutata ' + r.error);
        }
        await wait(20);
      }
      const hrP = P.state.game.handResult;
      assert(hrP.rows && hrP.rows.length >= 2, gid + ': resoconto con le sue righe');
      assert((await P.call('replay')).ok, 'moviola ' + gid);
      P.sock.close();
    }
    step('Scopa e Briscola: una smazzata ciascuna contro il computer');

    A.sock.close(); B.sock.close();
    console.log('\nProva multigiocatore: tutto OK');
  } finally {
    // il database resta aperto finché il server non si chiude (su Windows non si può cancellare prima)
    await new Promise((res) => { if (server.exitCode !== null) res(); else { server.once('exit', res); server.kill(); } });
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
})().catch((e) => { console.error('✗', e.message); process.exitCode = 1; setTimeout(() => process.exit(1), 200); });
