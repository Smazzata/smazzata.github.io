'use strict';
/*
 * Server di Smazzata (Burraco Online): pagine, Socket.IO e collegamento dei moduli.
 *   config.js            impostazioni          contesto.js        stato condiviso tra i moduli
 *   admin.js             pagina di stato       archivio.js        salvataggio e ripristino
 *   tavoli.js            tavoli e posti        turni.js           timer, computer, reazioni
 *   statistiche.js       classifica e trofei   gare.js            campionati e tornei
 *   messaggi-tavolo.js   messaggi del tavolo   messaggi-comunita.js  classifica, gare, segnalazioni
 *   social.js            profili e amici       push.js            notifiche
 */
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const E = require('./engine');
const Levels = require('./levels');
const createPush = require('./push');
const createSocial = require('./social');
const { PORT, DATA_DIR, HOME_URL } = require('./config');
const ctx = require('./contesto');

const app = express();
const server = http.createServer(app);
// controlli più frequenti: le connessioni cadute (telefono in tasca, rete persa) si notano in pochi secondi
const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });
ctx.io = io;

// i moduli si registrano nel contesto (l'ordine non conta: si chiamano tra loro solo dopo l'avvio)
const Admin = require('./admin');
require('./tavoli');
require('./turni');
require('./statistiche');
require('./promemoria');
require('./gare');
require('./archivio');
const TableMessages = require('./messaggi-tavolo');
const CommunityMessages = require('./messaggi-comunita');
ctx.Ranked = require('./ranked').createRanked(ctx);
const { sessions, rooms, leaderboard } = ctx;
const { seatOfToken, broadcast, myGames, cleanName, checkReady, roomOfToken, renamePlayer, isConnected, scheduleSave } = ctx;

Admin.setup(app);
Admin.setupStatus(app);
// motore e computer impacchettati per il gioco senza internet (vedi public/local-server.js)
const { bundle: bundleEngine } = require('../scripts/bundle-engine');
let engineBundle = null;
app.get('/engine.js', (req, res) => {
  engineBundle = engineBundle || bundleEngine();
  res.type('application/javascript').send(engineBundle);
});
app.get('/vendor/qrcode.js', (req, res) => res.sendFile(require.resolve('qrcode-generator')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

ctx.social = createSocial({
  io, sessions, isConnected: (t) => isConnected(t), roomOfToken, renamePlayer,
  // true se l'amico ha almeno un dispositivo iscritto alle notifiche (l'invio avviene in sottofondo)
  notifyOffline: (token, { code, ...msg }) => {
    const sess = sessions.get(token);
    if (!sess || !sess.push || !sess.push.length) return false;
    ctx.push.send(token, { ...msg, url: `${HOME_URL}?t=${code}` }).catch(() => {});
    return true;
  },
  onDelete: (token) => {
    require('./privacy').eraseRelated(ctx, token, DATA_DIR);
  },
  onDeleted: () => ctx.saveNow(true),
});
ctx.push = createPush({ dataDir: DATA_DIR, sessions, contact: HOME_URL });
const { social } = ctx;
const Premi = require('../shared/premi');
/** livello + premi sbloccati (titoli, cornici, dorsi) */
const progressOf = (e) => { const lv = Levels.levelOf(e); return { ...lv, unlocks: Premi.unlockedIds({ level: lv.level, trophies: (e && e.trophies) || {} }), streak: ctx.streakOf(e) }; };

io.on('connection', (socket) => {
  const handler = (fn, allowHello = false) => (data, cb) => {
    const failed = (e) => {
      if (!(e instanceof E.GameError)) console.error(e);
      if (typeof cb === 'function') cb({ ok: false, error: e.message });
    };
    try {
      if (!allowHello && !sessions.has(socket.data.token)) throw new E.GameError('Sessione non valida');
      const res = fn(data || {});
      // le risposte che aspettano qualcosa (es. l'invio di un'email) arrivano più tardi
      if (res && typeof res.then === 'function') res.then((r) => { if (typeof cb === 'function') cb({ ok: true, ...(r || {}) }); }, failed);
      else if (typeof cb === 'function') cb({ ok: true, ...(res || {}) });
    } catch (e) { failed(e); }
  };

  socket.on('hello', handler(({ token: key, name, lang, remind }) => {
    // il dispositivo ha una sua chiave (che si può revocare), collegata al profilo
    let token = key ? social.resolveDevice(key) : null;
    if (!token) {
      token = crypto.randomBytes(12).toString('hex');
      sessions.set(token, { name: cleanName(name), room: null });
      key = social.newDevice(token);
    }
    socket.data.devKey = social.keyHash(key);
    const sess = sessions.get(token);
    // con un nickname il nome mostrato è sempre quello
    if (sess.nick) sess.name = sess.nick; else if (name) sess.name = cleanName(name);
    if (typeof remind === 'boolean') sess.remind = remind;
    // lingua del dispositivo: le email arrivano in questa lingua
    if (require('./posta').LANGS.includes(lang)) sess.lang = lang;
    socket.data.token = token;
    socket.emit('welcome', { token: key, name: sess.name, nick: sess.nick || null, mail: require('./posta').enabled(), progressEpoch: require('./progress-reset').PROGRESS_EPOCH });
    socket.emit('progress', progressOf(leaderboard.get(token)));
    socket.emit('myGames', myGames(token));
    social.push(token);
    social.pushFriends(token);
    if (sess.room && rooms.has(sess.room) && require('./games').enabled(rooms.get(sess.room))) {
      const room = rooms.get(sess.room);
      if (seatOfToken(room, token) >= 0 || (room.spectators || []).includes(token)) {
        // la partita è aperta su un altro dispositivo: qui si chiede se spostarla
        const other = ctx.otherDeviceGame(socket);
        if (other && other.data.room === room.code) {
          socket.emit('state', { room: null, game: null });
          socket.emit('busyElsewhere', {});
          return;
        }
        socket.join(room.code);
        socket.data.room = room.code;
        broadcast(room);
        return;
      }
    }
    socket.emit('state', { room: null, game: null });
  }, true));

  TableMessages.register(socket, handler);
  CommunityMessages.register(socket, handler);
  ctx.Ranked.register(socket, handler);
  social.register(socket, handler);

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.room);
    // chi va offline non blocca il "pronto" di fine smazzata
    if (room) setTimeout(() => { if (rooms.has(room.code)) { if (room.game && room.game.phase === 'handEnd') checkReady(room); else broadcast(room); } }, 50);
    const token = socket.data.token;
    if (token) setTimeout(() => social.pushFriends(token), 80);
  });
});

ctx.loadSaved();
// Riprende risultati conclusi prima di un arresto; il registro match rende il replay idempotente.
for (const room of rooms.values()) ctx.Ranked.record(room);
setInterval(() => { try { ctx.Ranked.tick(); ctx.Ranked.legends(); } catch (e) { console.error('Ranked:', e.message); } }, 2000).unref();

// Scadenze controllate anche se nessun giocatore apre l'app.
function privacyMaintenance() {
  try {
    const privacy = require('./privacy');
    privacy.cleanCopies(DATA_DIR);
    if (privacy.expireReports(ctx)) ctx.saveNow(true);
    require('../scripts/backup').localBackup(DATA_DIR);
  } catch (e) { console.error('Manutenzione privacy non riuscita:', e.message); }
}
privacyMaintenance();
setInterval(privacyMaintenance, 60 * 60 * 1000).unref();

server.listen(PORT, () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`Burraco in ascolto su http://localhost:${PORT}`);
  console.log(`  pagina di stato (solo per te): /stato?k=${Admin.ADMIN_KEY}`);
  for (const ip of ips) console.log(`  dalla rete locale (smartphone): http://${ip}:${PORT}`);
});
