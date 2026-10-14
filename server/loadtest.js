'use strict';
/*
 * Prova di carico: avvia un server di prova e simula tanti tavoli da 4
 * (2 giocatori umani "finti" + 2 computer per tavolo) che giocano insieme.
 * Misura i tempi di risposta delle mosse, il ritardo del server, CPU e memoria.
 *   npm run load [tavoli] [secondi]
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const ROOMS = Number(process.argv[2] || 10);
const SECONDS = Number(process.argv[3] || 40);
const PORT = 3998;
const URL = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-load-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

const latencies = [];
let errors = 0, actions = 0;

function client(name) {
  const sock = io(URL, { transports: ['websocket'], forceNew: true });
  const c = { sock, state: null, busy: false };
  sock.on('state', (st) => { c.state = st; });
  c.call = (ev, data = {}) => new Promise((res) => {
    const t = process.hrtime.bigint();
    sock.emit(ev, data, (r) => {
      if (ev === 'action') { latencies.push(Number(process.hrtime.bigint() - t) / 1e6); actions++; if (!r.ok) errors++; }
      res(r);
    });
  });
  c.ready = new Promise((res) => { sock.emit('hello', { name }); sock.once('welcome', res); });
  // gioca come una persona veloce: pesca, ci pensa un attimo, scarta
  c.loop = async (until) => {
    while (Date.now() < until) {
      const g = c.state && c.state.game;
      if (g && !c.busy) {
        c.busy = true;
        if (g.turn === g.you && g.phase === 'draw') { await wait(300); await c.call('action', { type: 'draw' }); }
        else if (g.turn === g.you && g.phase === 'play') { await wait(500); await c.call('action', { type: 'discard', cardId: g.hand[g.hand.length - 1].id }); }
        else if (g.phase === 'handEnd' && !c.state.room.ready.includes(g.you)) await c.call('ready');
        c.busy = false;
      }
      await wait(50);
    }
  };
  return c;
}

const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; };

(async () => {
  await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('ascolto')) res(); }));
  const key = fs.readFileSync(path.join(dataDir, 'admin-key.txt'), 'utf8').trim();
  const clients = [];
  for (let i = 0; i < ROOMS; i++) {
    const a = client('A' + i), b = client('B' + i);
    await a.ready; await b.ready;
    await a.call('createRoom', { rules: { players: 4 } });
    while (!a.state || !a.state.room) await wait(10);
    await b.call('joinRoom', { code: a.state.room.code });
    await a.call('addBot', {});
    await a.call('start');
    clients.push(a, b);
  }
  console.log(`${ROOMS} tavoli avviati (${clients.length} giocatori collegati + ${ROOMS * 2} computer). Gioco per ${SECONDS} s…`);
  const until = Date.now() + SECONDS * 1000;
  const stats = [];
  const poll = setInterval(async () => {
    try { stats.push(await (await fetch(`${URL}/stato.json?k=${key}`)).json()); } catch (e) { /* ignora */ }
  }, 5000);
  await Promise.all(clients.map((c) => c.loop(until)));
  clearInterval(poll);
  const last = stats[stats.length - 1] || {};
  console.log(`mosse inviate: ${actions} (${Math.round(actions / SECONDS)} al secondo), rifiutate: ${errors}`);
  console.log(`tempo di risposta di una mossa: mediana ${pct(latencies, 50).toFixed(1)} ms, 95% ${pct(latencies, 95).toFixed(1)} ms, massimo ${Math.max(...latencies).toFixed(0)} ms`);
  console.log(`ritardo del server (99%): ${Math.max(...stats.map((s) => s.ritardo_ms.p99))} ms · CPU massima: ${Math.max(...stats.map((s) => s.cpu_percento))}% · memoria: ${last.memoria_mb} MB`);
  clients.forEach((c) => c.sock.close());
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
  setTimeout(() => process.exit(0), 300);
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });
