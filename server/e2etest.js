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

    // classifica: entrambi gli umani hanno una partita giocata
    const lb = await A.call('leaderboard');
    assert(lb.ok && lb.list.length === 2 && lb.list.every((e) => e.games === 1), 'classifica aggiornata');
    assert.strictEqual(lb.list.filter((e) => e.me).length, 1);
    assert.strictEqual(lb.list.reduce((n, e) => n + e.wins, 0) >= 1, true);
    step('classifica aggiornata a fine partita');

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

    A.sock.close(); B.sock.close();
    console.log('\nProva multigiocatore: tutto OK');
  } finally {
    server.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((e) => { console.error('✗', e.message); process.exitCode = 1; setTimeout(() => process.exit(1), 200); });
