'use strict';
/*
 * Messaggi dal browser che riguardano il tavolo e la partita: creare/entrare/uscire, posti, regole,
 * mosse, suggerimenti, impostazioni dell'host, resa, rivincita, moviola, reazioni e chat.
 */
const E = require('./engine');
const Games = require('./games');
const Rules = require('../shared/rules');
const Daily = require('./daily');
const { BOT_SPEEDS } = require('./config');
const ctx = require('./contesto');
/** dimensione massima di un messaggio vocale (15 secondi di voce compressa stanno in ~60 KB) */
const VOICE_MAX = 300 * 1024;
const { io, sessions, rooms, daily } = ctx;
/** motore e computer del gioco di questo tavolo */
const GE = (room) => Games.of(room).E;
const GBot = (room) => Games.of(room).Bot;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const afterAction = (...a) => ctx.afterAction(...a);
const botName = (...a) => ctx.botName(...a);
const botReactions = (...a) => ctx.botReactions(...a);
const broadcast = (...a) => ctx.broadcast(...a);
const checkReady = (...a) => ctx.checkReady(...a);
const cleanName = (...a) => ctx.cleanName(...a);
const dailyBoard = (...a) => ctx.dailyBoard(...a);
const fillBots = (...a) => ctx.fillBots(...a);
const getRoom = (...a) => ctx.getRoom(...a);
const humanCount = (...a) => ctx.humanCount(...a);
const isConnected = (...a) => ctx.isConnected(...a);
const joinRoom = (...a) => ctx.joinRoom(...a);
const checkOtherDevice = (...a) => ctx.checkOtherDevice(...a);
const leaveRoom = (...a) => ctx.leaveRoom(...a);
const myGames = (...a) => ctx.myGames(...a);
const newCode = (...a) => ctx.newCode(...a);
const pushMyGames = (...a) => ctx.pushMyGames(...a);
const socketsOf = (...a) => ctx.socketsOf(...a);
const reactionSnapshot = (...a) => ctx.reactionSnapshot(...a);
const requireHost = (...a) => ctx.requireHost(...a);
const scheduleSave = (...a) => ctx.scheduleSave(...a);
const seatOfToken = (...a) => ctx.seatOfToken(...a);
const startGame = (...a) => ctx.startGame(...a);

module.exports.register = function register(socket, handler) {
  socket.on('setName', handler(({ name }) => {
    const sess = sessions.get(socket.data.token);
    if (!sess) throw new E.GameError('Sessione non valida');
    if (sess.nick) return; // il nome è il nickname
    sess.name = cleanName(name);
    const room = rooms.get(socket.data.room);
    if (room) {
      const seat = seatOfToken(room, socket.data.token);
      if (seat >= 0) {
        room.seats[seat].name = sess.name;
        if (room.game) room.game.players[seat].name = sess.name;
      }
      broadcast(room);
    }
  }));

  // si gioca da un dispositivo per volta: l'utente ha confermato di spostare (o lasciare) la partita dell'altro
  socket.on('takeOver', handler(({ mode }) => {
    ctx.takeOver(socket, mode === 'here' ? 'here' : 'abandon');
  }));

  socket.on('createRoom', handler(({ rules, vsBots, tutorial }) => {
    checkOtherDevice(socket, null);
    // allenamento: Classico in 2 (a 505) oppure un altro gioco in 2, contro un computer facile e lento, con i suggerimenti
    const other = tutorial && rules && Games.idOf(rules) !== 'burraco' ? Games.idOf(rules) : null;
    const r = tutorial
      ? (other ? Games.of(rules).normalize({ game: other, players: 2 }) : Rules.normalize({ ...Rules.PRESETS[0].rules, players: 2, target: 505 }))
      : Games.of(rules).normalize(rules);
    const code = newCode();
    const room = {
      code, rules: r, n: r.players, hostToken: socket.data.token,
      seats: Array(r.players).fill(null), game: null, ready: new Set(), botTimer: null, botMemo: {},
    };
    if (tutorial) Object.assign(room, { tutorial: true, hints: true, botLevel: 'facile', botSpeed: 'lenta' });
    rooms.set(code, room);
    joinRoom(socket, room);
    if (tutorial) { fillBots(room); startGame(room); return; }
    if (vsBots) {
      fillBots(room);
      startGame(room);
    }
  }));

  // Sfida del giorno: informazioni, classifica e avvio (un tentativo al giorno)
  socket.on('daily', handler(() => {
    const c = Daily.challenge();
    const b = dailyBoard(c.date, socket.data.token);
    return { date: c.date, title: c.title, game: Games.idOf(c.rules), preset: Games.of(c.rules).presetOf(c.rules), rules: c.rules, top: b.list.slice(0, 10), players: b.list.length, mine: b.mine, myPos: b.myPos };
  }));

  socket.on('startDaily', handler(() => {
    checkOtherDevice(socket, null);
    const sess = sessions.get(socket.data.token);
    if (!sess || !sess.nick) throw new E.GameError('Scegli prima il tuo nickname');
    const c = Daily.challenge();
    const board = daily.get(c.date) || {};
    if (board[socket.data.token]) throw new E.GameError('Hai già giocato la sfida di oggi: torna domani!');
    board[socket.data.token] = { name: sess.nick, score: null, at: Date.now() };
    daily.set(c.date, board);
    const room = {
      code: newCode(), rules: c.rules, n: c.rules.players, hostToken: socket.data.token, daily: c.date, seed: c.seed,
      seats: Array(c.rules.players).fill(null), game: null, ready: new Set(), botTimer: null, botMemo: {}, botLevel: 'difficile',
    };
    rooms.set(room.code, room);
    joinRoom(socket, room);
    fillBots(room);
    startGame(room);
    return { code: room.code };
  }));

  socket.on('quickPlay', handler(({ n }) => {
    checkOtherDevice(socket, null);
    n = Number(n) === 2 ? 2 : 4;
    const sess = sessions.get(socket.data.token);
    if (!sess || !sess.nick) throw new E.GameError('Scegli prima il tuo nickname');
    // tra i tavoli veloci aperti si sceglie quello con i giocatori più vicini al mio punteggio di bravura (Elo)
    const eloOf = (t) => ((((ctx.leaderboard.get(t) || {}).byGame || {}).burraco || {}).elo) || 1000;
    const mine = eloOf(socket.data.token);
    const avg = (r) => { const h = r.seats.filter((s) => s && !s.isBot); return h.reduce((a, s) => a + eloOf(s.token), 0) / Math.max(1, h.length); };
    let room = [...rooms.values()].filter((r) => r.quick === n && !r.game && r.seats.some((s) => !s)
      && seatOfToken(r, socket.data.token) < 0 && r.seats.some((s) => s && !s.isBot && isConnected(s.token)))
      .sort((a, b) => Math.abs(avg(a) - mine) - Math.abs(avg(b) - mine))[0];
    if (!room) {
      const r = Rules.normalize({ ...Rules.PRESETS[0].rules, players: n });
      room = {
        code: newCode(), rules: r, n, hostToken: socket.data.token, quick: n,
        seats: Array(n).fill(null), game: null, ready: new Set(), botTimer: null, botMemo: {},
      };
      rooms.set(room.code, room);
    }
    joinRoom(socket, room);
    return { code: room.code };
  }));

  socket.on('joinRoom', handler(({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) throw new E.GameError('Tavolo non trovato');
    checkOtherDevice(socket, room.code);
    joinRoom(socket, room);
  }));

  socket.on('leaveRoom', handler(({ abandon } = {}) => {
    leaveRoom(socket, !!abandon);
    socket.emit('state', { room: null, game: null });
  }));

  socket.on('sit', handler(({ seat }) => {
    const room = getRoom(socket);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (room.seats[seat]) throw new E.GameError('Posto occupato');
    const cur = seatOfToken(room, socket.data.token);
    room.seats[seat] = room.seats[cur];
    room.seats[cur] = null;
    broadcast(room);
  }));

  socket.on('addBot', handler(({ seat }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (seat === undefined) { fillBots(room); } else {
      if (room.seats[seat]) throw new E.GameError('Posto occupato');
      room.seats[seat] = { isBot: true, name: botName(room) };
    }
    broadcast(room);
  }));

  socket.on('removeSeat', handler(({ seat }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (!room.seats[seat] || !room.seats[seat].isBot) throw new E.GameError('Puoi togliere solo i bot');
    room.seats[seat] = null;
    broadcast(room);
  }));

  socket.on('configure', handler(({ rules }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    const r = Games.of(rules).normalize(rules);
    const n = r.players;
    const people = room.seats.filter(Boolean);
    if (people.filter((s) => !s.isBot).length > n) throw new E.GameError('Troppi giocatori al tavolo per questa variante');
    const humans = people.filter((s) => !s.isBot);
    const bots = people.filter((s) => s.isBot);
    room.seats = Array(n).fill(null);
    [...humans, ...bots].slice(0, n).forEach((s, i) => { room.seats[i] = s; });
    room.rules = r; room.n = n;
    broadcast(room);
  }));

  socket.on('start', handler(() => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (room.seats.some((s) => !s)) throw new E.GameError('Ci sono posti liberi: aspetta altri giocatori o aggiungi dei bot');
    startGame(room);
  }));

  socket.on('action', handler((action) => {
    const room = getRoom(socket);
    if (!room.game) throw new E.GameError('Partita non iniziata');
    const seat = seatOfToken(room, socket.data.token);
    const before = reactionSnapshot(room.game);
    GE(room).apply(room.game, seat, action);
    botReactions(room, seat, before, action);
    afterAction(room);
  }));

  socket.on('hint', handler(() => {
    const room = getRoom(socket);
    const g = room.game;
    const seat = seatOfToken(room, socket.data.token);
    if (humanCount(room) > 1 || !room.hints) throw new E.GameError('I suggerimenti sono disponibili solo giocando da soli contro il computer');
    if (!g || g.turn !== seat || g.phase === 'handEnd') throw new E.GameError('Il suggerimento è disponibile solo nel tuo turno');
    const hint = GBot(room).nextAction(JSON.parse(JSON.stringify(g)), seat, { level: 'difficile' });
    return { hint };
  }));

  // Musica del tavolo: l'host condivide un link Spotify (Jam, playlist, album o brano)
  socket.on('setMusic', handler(({ url }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (!url) { room.music = null; broadcast(room); return; }
    const u = String(url).trim().slice(0, 300);
    let parsed;
    try { parsed = new URL(u); } catch (e) { throw new E.GameError('Link non valido'); }
    if (parsed.protocol !== 'https:' || !/(^|\.)(spotify\.com|spotify\.link)$/.test(parsed.hostname)) {
      throw new E.GameError('Incolla un link di Spotify (Jam, playlist, album o brano)');
    }
    const seat = seatOfToken(room, socket.data.token);
    room.music = { url: parsed.href, by: seat >= 0 ? room.seats[seat].name : 'Host', at: Date.now() };
    broadcast(room);
  }));

  socket.on('setSeries', handler(({ bestOf }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    bestOf = Number(bestOf);
    if (![1, 3, 5].includes(bestOf)) throw new E.GameError('Torneo non valido');
    if (room.game && !room.game.over) throw new E.GameError('Si cambia il torneo tra una partita e l\'altra');
    room.series = bestOf > 1 ? { bestOf, wins: Array(room.n).fill(0), games: 0, champion: null } : null;
    broadcast(room);
  }));

  socket.on('setBotLevel', handler(({ level }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (!['facile', 'normale', 'difficile', 'esperto'].includes(level)) throw new E.GameError('Livello non valido');
    room.botLevel = level;
    broadcast(room);
  }));

  socket.on('setTurnTime', handler(({ seconds }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    const sec = Number(seconds);
    if (![0, 30, 60, 90].includes(sec)) throw new E.GameError('Tempo non valido');
    room.turnTime = sec;
    room.timerKey = undefined; // riparte il conteggio con il nuovo tempo
    broadcast(room);
  }));

  // Aiuto visivo "dove attaccare": l'host lo attiva o lo disattiva per tutto il tavolo
  socket.on('setAids', handler(({ on }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    room.aids = !!on;
    broadcast(room);
  }));

  // Ritmo della partita: "con calma" = ognuno gioca quando può, il posto resta suo e la partita aspetta
  // Resa: la propria squadra abbandona (se il compagno è una persona deve essere d'accordo)
  socket.on('surrender', handler(() => {
    const room = getRoom(socket);
    const g = room.game;
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Solo chi gioca può arrendersi');
    if (!g || g.over) throw new E.GameError('Nessuna partita in corso');
    const team = GE(room).teamOf(g, seat);
    const humans = team.members.filter((x) => room.seats[x] && !room.seats[x].isBot);
    room.surrenderVotes = [...new Set([...(room.surrenderVotes || []).filter((x) => team.members.includes(x)), seat])];
    if (humans.every((x) => room.surrenderVotes.includes(x))) {
      room.surrenderVotes = null;
      GE(room).surrender(g, seat);
      clearTimeout(room.botTimer); room.botTimer = null;
      afterAction(room);
      return { done: true };
    }
    broadcast(room); // il compagno vede la proposta
    return { done: false };
  }));

  socket.on('surrenderCancel', handler(() => {
    const room = getRoom(socket);
    room.surrenderVotes = null;
    broadcast(room);
  }));

  // L'host termina la partita senza vincitori (non conta nelle statistiche): tutti tornano in sala d'attesa
  socket.on('endGame', handler(() => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (!room.game) throw new E.GameError('Nessuna partita in corso');
    if (room.daily) throw new E.GameError('Non disponibile nella sfida del giorno');
    if (room.tournament) throw new E.GameError('Nei tornei la partita non si può annullare: puoi arrenderti');
    clearTimeout(room.botTimer); room.botTimer = null;
    room.game = null;
    room.ready = new Set();
    room.surrenderVotes = null;
    // i posti lasciati al computer da chi era uscito tornano liberi
    room.seats = room.seats.map((s) => (s && s.leftToken ? null : s));
    io.to(room.code).emit('notice', { text: "L'host ha terminato la partita" });
    broadcast(room);
  }));

  // Partita finita: chiunque sia seduto può riportare il tavolo nella sala d'attesa (regole, posti, computer)
  socket.on('backToLobby', handler(() => {
    const room = getRoom(socket);
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Solo chi è seduto al tavolo può farlo');
    if (!room.game || !room.game.over) throw new E.GameError('La partita non è ancora finita');
    if (room.daily || room.tournament) throw new E.GameError('Non disponibile qui');
    clearTimeout(room.botTimer); room.botTimer = null;
    room.game = null;
    room.ready = new Set();
    room.surrenderVotes = null;
    room.series = null;
    room.seats = room.seats.map((s) => (s && s.leftToken ? null : s));
    io.to(room.code).emit('notice', { text: `${room.seats[seat].name} ha riportato il tavolo nella sala d'attesa` });
    broadcast(room);
  }));

  // L'host chiude il tavolo: tutti alla schermata iniziale, il tavolo sparisce
  socket.on('closeTable', handler(() => {
    const room = getRoom(socket);
    requireHost(socket, room);
    clearTimeout(room.botTimer); clearTimeout(room.turnTimerHandle); clearTimeout(room.absentHandle);
    for (const s of io.sockets.sockets.values()) {
      if (s.data.room !== room.code) continue;
      s.leave(room.code);
      s.data.room = null;
      const sess = sessions.get(s.data.token);
      if (sess) sess.room = null;
      if (s !== socket) s.emit('notice', { text: "L'host ha chiuso il tavolo" });
      s.emit('state', { room: null, game: null });
    }
    rooms.delete(room.code);
    for (const x of room.seats) if (x && !x.isBot && x.token) pushMyGames(x.token);
    scheduleSave();
  }));

  socket.on('setSlow', handler(({ on }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Il ritmo si sceglie prima di iniziare');
    if (room.daily || room.tutorial) throw new E.GameError('Non disponibile per questa partita');
    room.slow = !!on;
    if (room.slow) room.turnTime = 0;
    broadcast(room);
  }));

  socket.on('myGames', handler(() => ({ list: myGames(socket.data.token) })));

  // Moviola: l'ultima smazzata finita, con le carte di tutti (mai nella sfida del giorno: rivelerebbe il mazzo)
  socket.on('replay', handler(() => {
    const room = getRoom(socket);
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Solo chi gioca può rivedere la smazzata');
    if (room.daily) throw new E.GameError('Nella sfida del giorno la moviola non è disponibile');
    const g = room.game;
    if (!g || !g.lastReplay) throw new E.GameError('Nessuna smazzata da rivedere');
    return { replay: g.lastReplay, you: seat };
  }));

  socket.on('setHints', handler(({ on }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (humanCount(room) > 1) throw new E.GameError('In multiplayer i suggerimenti non sono disponibili');
    room.hints = !!on;
    broadcast(room);
  }));

  socket.on('setBotSpeed', handler(({ speed }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (!BOT_SPEEDS[speed]) throw new E.GameError('Velocità non valida');
    room.botSpeed = speed;
    broadcast(room);
  }));

  socket.on('ready', handler(() => {
    const room = getRoom(socket);
    const g = room.game;
    if (!g || g.phase !== 'handEnd') throw new E.GameError('Nessuna smazzata da chiudere');
    if (room.daily) throw new E.GameError('La sfida del giorno è una sola smazzata: riprova domani!');
    if (room.tournament && g.over) throw new E.GameError('La partita del torneo è finita: guarda il tabellone in 🏆 Tornei');
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Gli spettatori non partecipano');
    room.ready.add(seat);
    checkReady(room);
  }));

  // Reazioni rapide al tavolo (con un limite per evitare raffiche)
  const REACTIONS = ['👏', '😂', '😱', '🔥', '👍', '😡', '🙏', '😍'];
  socket.on('react', handler(({ emoji }) => {
    const room = getRoom(socket);
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Solo chi è seduto al tavolo può reagire');
    if (!REACTIONS.includes(emoji)) throw new E.GameError('Reazione non valida');
    const now = Date.now();
    if (socket.data.lastReact && now - socket.data.lastReact < 1000) throw new E.GameError('Piano con le reazioni 🙂');
    socket.data.lastReact = now;
    io.to(room.code).emit('reaction', { seat, emoji });
  }));

  socket.on('chat', handler(({ text }) => {
    const room = getRoom(socket);
    const t = String(text || '').replace(/[<>]/g, '').trim().slice(0, 140);
    if (!t) return;
    const seat = seatOfToken(room, socket.data.token);
    const name = seat >= 0 ? room.seats[seat].name : 'Ospite';
    // ultimi messaggi solo in memoria (mai salvati): servono se qualcuno segnala un giocatore
    room.chatLog = [...(room.chatLog || []), { at: Date.now(), name, text: t }].slice(-30);
    io.to(room.code).emit('chat', { name, text: t, seat });
  }));

  // Messaggi vocali: si tiene premuto 🎤, il registrato (max 15 s) arriva agli altri al tavolo.
  // Il server lo inoltra soltanto: non viene mai salvato.
  socket.on('voice', handler(({ audio, mime, ms } = {}) => {
    const room = getRoom(socket);
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Solo chi è seduto al tavolo può mandare messaggi vocali');
    const buf = Buffer.isBuffer(audio) ? audio : audio instanceof ArrayBuffer ? Buffer.from(audio) : null;
    if (!buf || buf.length < 200) throw new E.GameError('Messaggio vocale vuoto');
    if (buf.length > VOICE_MAX) throw new E.GameError('Messaggio vocale troppo lungo');
    const type = String(mime || '');
    if (!/^audio\/(webm|ogg|mp4|mpeg|aac)(;[\w=.,\s-]*)?$/.test(type)) throw new E.GameError('Formato audio non supportato');
    const now = Date.now();
    if (socket.data.lastVoice && now - socket.data.lastVoice < 2000) throw new E.GameError('Aspetta un attimo prima del prossimo messaggio');
    const name = room.seats[seat].name;
    const dur = Math.max(0, Math.min(15000, Number(ms) || 0));
    // arriva solo a chi è seduto, ha i vocali attivi e non ha silenziato chi parla
    const to = [];
    room.seats.forEach((x, i) => {
      if (!x || x.isBot || i === seat || (sessions.get(x.token) || {}).voice === false || (x.muted || []).includes(seat)) return;
      for (const sk of socketsOf(x.token)) if (sk.data.room === room.code) to.push(sk);
    });
    if (!to.length) throw new E.GameError('Nessuno al tavolo può ascoltare i vocali in questo momento');
    socket.data.lastVoice = now;
    room.chatLog = [...(room.chatLog || []), { at: now, name, text: '🎤 messaggio vocale' }].slice(-30);
    for (const sk of to) sk.emit('voice', { seat, name, audio: buf, mime: type, ms: dur });
  }));

  /*
   * Smazzata finita di una partita contro il computer giocata sul telefono (public/local-server.js): si registrano
   * statistiche, livello e trofei come per le partite sul server (non l'Elo). Una volta sola per smazzata.
   */
  socket.on('localResult', handler(({ id, rules, botLevel, tutorial, game } = {}) => {
    const token = socket.data.token;
    const sess = sessions.get(token);
    if (!sess || !sess.nick) return {}; // senza profilo non c'è niente da registrare
    const g = game;
    if (!g || typeof g !== 'object' || g.phase !== 'handEnd' || !g.handResult || !Array.isArray(g.players) || !Array.isArray(g.teams)) throw new E.GameError('Risultato non valido');
    if (JSON.stringify(g).length > 600 * 1024) throw new E.GameError('Risultato troppo grande');
    if (g.players.length < 2 || g.players.length > 6 || g.players[0].isBot || g.players.slice(1).some((p) => !p.isBot)) throw new E.GameError('Risultato non valido');
    const gid = Games.idOf(rules);
    if (!rules || (rules.game && rules.game !== gid)) throw new E.GameError('Gioco sconosciuto');
    const lid = String(id || '').slice(0, 40);
    const rec = sess.localRec && sess.localRec.id === lid ? sess.localRec : { id: lid, gameSeq: 1 };
    const room = {
      code: 'LOCALE', rules, n: g.players.length, game: g, localGame: true, tutorial: !!tutorial,
      botLevel: ['facile', 'normale', 'difficile', 'esperto'].includes(botLevel) ? botLevel : 'normale',
      seats: g.players.map((p, i) => (i === 0 ? { token, name: sess.nick } : { isBot: true, name: String(p.name || 'Computer').slice(0, 30) })),
      gameSeq: rec.gameSeq, recordedHand: rec.recordedHand, recordedGame: rec.recordedGame,
    };
    try { ctx.recordLeaderboard(room); } catch (e) { console.error('Risultato dal telefono non registrato:', e.message); throw new E.GameError('Risultato non valido'); }
    sess.localRec = { id: lid, gameSeq: room.gameSeq, recordedHand: room.recordedHand, recordedGame: room.recordedGame };
    ctx.scheduleSave();
    return {};
  }));

  // Promemoria (notifiche gentili): attivi o spenti dalle impostazioni
  socket.on('setRemind', handler(({ on } = {}) => {
    const sess = sessions.get(socket.data.token);
    if (sess) sess.remind = !!on;
    return {};
  }));

  // Vocali: attivati o no nelle impostazioni personali (vale per tutti i tavoli)
  socket.on('voicePref', handler(({ on } = {}) => {
    const sess = sessions.get(socket.data.token);
    if (!sess) return;
    sess.voice = !!on;
    if (sess.room && rooms.has(sess.room)) broadcast(rooms.get(sess.room));
  }));

  // Silenziare un giocatore al tavolo: i suoi vocali non arrivano più (lui non lo sa)
  socket.on('voiceMute', handler(({ seat: other, on } = {}) => {
    const room = getRoom(socket);
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Solo chi è seduto al tavolo può farlo');
    const o = Number(other);
    if (!Number.isInteger(o) || o === seat || !room.seats[o]) throw new E.GameError('Giocatore non valido');
    const me = room.seats[seat];
    me.muted = (me.muted || []).filter((x) => x !== o);
    if (on) me.muted.push(o);
    broadcast(room);
  }));
};
