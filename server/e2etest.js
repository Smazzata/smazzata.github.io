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
  p.hello = () => new Promise((res) => { sock.emit('hello', { name }); sock.once('welcome', res); });
  return p;
}

const step = (t) => console.log('✓ ' + t);

(async () => {
  const server = await startServer();
  try {
    const A = player('Anna'), B = player('Bruno');
    await A.hello(); await B.hello();

    // tavolo: 4 posti, obiettivo basso per arrivare presto a fine partita
    let r = await A.call('createRoom', { rules: { players: 4, target: 100 } });
    assert(r.ok, r.error);
    const code = (await A.until((s) => s.room, 'tavolo')).room.code;
    assert((await B.call('joinRoom', { code })).ok);
    await A.until((s) => s.room.seats.filter(Boolean).length === 2, 'secondo giocatore');
    step('due giocatori nello stesso tavolo');

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

    // timer: 30 s (accelerati) → i turni degli umani vanno avanti da soli
    assert((await A.call('setTurnTime', { seconds: 30 })).ok);
    assert((await A.call('addBot', {})).ok);
    assert((await A.call('start')).ok);
    await B.until((s) => s.game, 'inizio partita');
    await A.until((s) => s.game && s.game.log.some((l) => l.includes('Tempo scaduto')), 'turno automatico per tempo scaduto', 30000);
    step('timer del turno: allo scadere pesca e scarta in automatico');

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
