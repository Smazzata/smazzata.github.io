'use strict';
/*
 * Messaggi dal browser fuori dal tavolo: classifica, statistiche, scheda di un amico, tornei,
 * campionati, notifiche push e segnalazioni.
 */
const E = require('./engine');
const Games = require('./games');
const Levels = require('./levels');
const Trophies = require('./trophies');
const ctx = require('./contesto');
const { sessions, rooms, leaderboard } = ctx;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const awardTrophies = (...a) => ctx.awardTrophies(...a);
const publicStats = (...a) => ctx.publicStats(...a);
const scheduleSave = (...a) => ctx.scheduleSave(...a);
const seatOfToken = (...a) => ctx.seatOfToken(...a);
const socketsOf = (...a) => ctx.socketsOf(...a);
const statsByGame = (...a) => ctx.statsByGame(...a);
const tournamentsChanged = (...a) => ctx.tournamentsChanged(...a);
const { GSTATS0 } = require('./statistiche');

module.exports.register = function register(socket, handler) {
  socket.on('leaderboard', handler(({ friends, game } = {}) => {
    const gid = Games.GAMES[game] ? game : 'burraco';
    const me = socket.data.token;
    const mine = sessions.get(me) || {};
    const allowed = friends ? new Set([me, ...(mine.friends || [])]) : null;
    const list = [...leaderboard.entries()]
      .filter(([token]) => !allowed || allowed.has(token))
      .map(([token, e]) => { const x = (e.byGame && e.byGame[gid]) || GSTATS0; return { name: e.name, games: x.games, wins: x.wins, points: x.points, burraco: x.burraco, level: Levels.levelOf(e).level, me: token === me }; })
      .filter((e) => e.games > 0)
      .sort((a, b) => b.wins - a.wins || (b.wins / b.games) - (a.wins / a.games) || b.points - a.points)
      .slice(0, 30);
    return { list, game: gid };
  }));

  // Le mie statistiche e il mio storico
  socket.on('myStats', handler(() => {
    const e = leaderboard.get(socket.data.token);
    if (!e) return { stats: null, history: [], trophies: Trophies.view(null), level: Levels.levelOf(null) };
    return {
      stats: publicStats(e),
      byGame: statsByGame(e),
      timeline: e.timeline || [],
      level: Levels.levelOf(e),
      trophies: Trophies.view(e),
      history: (e.history || []).map((h) => ({ at: h.at, game: h.game || 'burraco', preset: h.preset, won: h.won, hands: h.hands, teams: h.teams })),
    };
  }));

  // Scheda di un amico: le sue statistiche e le partite giocate insieme
  socket.on('playerCard', handler(({ nick }) => {
    const me = socket.data.token;
    const mine = sessions.get(me) || {};
    const other = [...sessions.entries()].find(([, x]) => x.nick && x.nick.toLowerCase() === String(nick || '').toLowerCase());
    if (!other) throw new E.GameError('Giocatore non trovato');
    const [token, sess] = other;
    if (token !== me && !(mine.friends || []).includes(token)) throw new E.GameError('Puoi vedere solo la scheda dei tuoi amici');
    const e = leaderboard.get(token);
    const shared = ((leaderboard.get(me) || {}).history || []).filter((h) => (h.tokens || []).includes(token));
    const sameTeam = (h) => {
      const myTeam = h.teams.find((t) => t.mine);
      return myTeam && myTeam.names.includes(sess.nick);
    };
    return {
      nick: sess.nick, avatar: sess.avatar || null,
      stats: e ? publicStats(e) : null,
      byGame: statsByGame(e),
      level: Levels.levelOf(e).level,
      trophies: Trophies.view(e).filter((t) => t.at).map(({ id, e: em, name, at }) => ({ id, e: em, name, at })),
      together: {
        games: shared.length,
        asPartners: shared.filter(sameTeam).length,
        winsTogether: shared.filter((h) => sameTeam(h) && h.won).length,
        winsAgainst: shared.filter((h) => !sameTeam(h) && h.won).length,
        recent: shared.slice(0, 5).map((h) => ({ at: h.at, won: h.won, partner: sameTeam(h), teams: h.teams })),
      },
    };
  }));

  const myNick = () => { const s = sessions.get(socket.data.token); if (!s || !s.nick) throw new E.GameError('Scegli prima il tuo nickname'); return s; };

  // Tornei a eliminazione
  const tourCall = (fn) => { try { const r = fn(); tournamentsChanged(); return r; } catch (e) { if (e instanceof E.GameError) throw e; throw new E.GameError(e.message); } };
  socket.on('tournaments', handler(() => ({ list: ctx.Tour.list(socket.data.token) })));
  socket.on('tournamentCreate', handler(({ name, game, size }) => { myNick(); return { id: tourCall(() => ctx.Tour.create(socket.data.token, { name, game, size })) }; }));
  socket.on('tournamentJoin', handler(({ id }) => { myNick(); tourCall(() => ctx.Tour.join(ctx.Tour.get(id), socket.data.token)); }));
  socket.on('tournamentLeave', handler(({ id }) => { tourCall(() => ctx.Tour.leave(ctx.Tour.get(id), socket.data.token)); }));
  socket.on('tournamentFill', handler(({ id }) => { tourCall(() => ctx.Tour.fillBots(ctx.Tour.get(id), socket.data.token)); }));
  socket.on('tournamentStart', handler(({ id }) => { tourCall(() => ctx.Tour.start(ctx.Tour.get(id), socket.data.token)); }));
  socket.on('tournamentForfeit', handler(({ id, round, index, side }) => {
    tourCall(() => ctx.Tour.forfeit(ctx.Tour.get(id), socket.data.token, Number(round), Number(index), side === 'b' ? 'b' : 'a'));
  }));

  // Campionati tra amici
  const leagueCall = (fn) => { try { return fn(); } catch (e) { if (e instanceof E.GameError) throw e; throw new E.GameError(e.message); } };
  const tokenOfNick = (nick) => { const x = [...sessions.entries()].find(([, v]) => v.nick && v.nick.toLowerCase() === String(nick || '').toLowerCase()); return x && x[0]; };
  socket.on('leagues', handler(() => {
    const me = socket.data.token;
    const list = ctx.League.mine(me);
    for (const lg of list) for (const t of ctx.League.rollover(lg)) awardTrophies(t, '', ['campione_lega']);
    scheduleSave();
    return { list: ctx.League.mine(me).map((lg) => ctx.League.view(lg, me)) };
  }));
  socket.on('leagueCreate', handler(({ name, period }) => {
    myNick();
    const id = leagueCall(() => ctx.League.create(socket.data.token, name, period));
    scheduleSave();
    return { id };
  }));
  socket.on('leagueAdd', handler(({ id, nick }) => {
    const me = myNick();
    const other = tokenOfNick(nick);
    if (!other || !(me.friends || []).includes(other)) throw new E.GameError('Puoi aggiungere solo i tuoi amici');
    const lg = leagueCall(() => ctx.League.get(id, socket.data.token));
    leagueCall(() => ctx.League.addMember(lg, socket.data.token, other));
    for (const s of socketsOf(other)) s.emit('notice', { text: `🏟️ ${me.nick} ti ha aggiunto al campionato «${lg.name}»` });
    scheduleSave();
  }));
  socket.on('leagueRemove', handler(({ id, nick }) => {
    const lg = leagueCall(() => ctx.League.get(id, socket.data.token));
    const other = nick ? tokenOfNick(nick) : socket.data.token;
    if (!other || !lg.members.includes(other)) throw new E.GameError('Giocatore non trovato nel campionato');
    leagueCall(() => ctx.League.removeMember(lg, socket.data.token, other));
    scheduleSave();
  }));

  // Notifiche ctx.push (anche a gioco chiuso)
  socket.on('pushKey', handler(() => ({ key: ctx.push.publicKey })));
  socket.on('pushSubscribe', handler(({ sub }) => {
    try { ctx.push.subscribe(socket.data.token, sub); } catch (e) { throw new E.GameError(e.message); }
    scheduleSave();
  }));
  socket.on('pushUnsubscribe', handler(({ endpoint }) => { ctx.push.unsubscribe(socket.data.token, String(endpoint || '')); scheduleSave(); }));

  // Segnala un problema: testo dell'utente + situazione del tavolo (senza le carte degli altri)
  // Segnala un giocatore (offese, comportamento scorretto…): arriva nella pagina di stato con la chat del tavolo
  const REPORT_REASONS = { offese: 'Offese o linguaggio inappropriato', scorretto: 'Comportamento scorretto', nick: 'Nickname inappropriato', altro: 'Altro' };
  socket.on('reportPlayer', handler(({ nick, reason, text }) => {
    const me = sessions.get(socket.data.token) || {};
    if (!me.nick) throw new E.GameError('Scegli prima il tuo nickname');
    const target = String(nick || '').trim();
    const other = [...sessions.values()].find((x) => x.nick && x.nick.toLowerCase() === target.toLowerCase());
    if (!other || other === me) throw new E.GameError('Giocatore non trovato');
    if (!REPORT_REASONS[reason]) throw new E.GameError('Scegli il motivo della segnalazione');
    const now = Date.now();
    if (socket.data.lastReport && now - socket.data.lastReport < 60000) throw new E.GameError('Hai già inviato una segnalazione: riprova tra un minuto');
    socket.data.lastReport = now;
    const room = rooms.get(socket.data.room);
    ctx.reports.unshift({
      at: now, kind: 'player', nick: me.nick, target: other.nick, reason: REPORT_REASONS[reason],
      text: String(text || '').trim().slice(0, 500), screen: 'giocatore', device: '',
      chat: room && room.chatLog ? room.chatLog.slice(-15).map((m) => `${m.name}: ${m.text}`) : [],
      table: room ? { code: room.code, rules: Games.of(room).presetOf(room.rules) || 'personalizzate', seat: seatOfToken(room, socket.data.token), game: null } : null,
    });
    ctx.reports = ctx.reports.slice(0, 100);
    scheduleSave();
    return {};
  }));

  socket.on('report', handler(({ text, screen, device }) => {
    const t = String(text || '').trim().slice(0, 1000);
    if (t.length < 5) throw new E.GameError('Descrivi il problema in qualche parola');
    const now = Date.now();
    if (socket.data.lastReport && now - socket.data.lastReport < 60000) throw new E.GameError('Hai già inviato una segnalazione: riprova tra un minuto');
    socket.data.lastReport = now;
    const sess = sessions.get(socket.data.token) || {};
    const room = rooms.get(socket.data.room);
    const g = room && room.game;
    const seat = room ? seatOfToken(room, socket.data.token) : -1;
    ctx.reports.unshift({
      at: now, nick: sess.nick || sess.name || 'anonimo', text: t,
      screen: String(screen || '').slice(0, 20), device: String(device || '').slice(0, 160),
      table: room ? {
        code: room.code, rules: Games.of(room).presetOf(room.rules) || 'personalizzate', seat,
        game: g ? {
          hand: g.handNo, phase: g.phase, turn: g.turn, stock: g.stock.length, discard: g.discard.length,
          myCards: seat >= 0 ? g.players[seat].hand.length : null, scores: g.scores, log: g.log.slice(-10),
        } : null,
      } : null,
    });
    ctx.reports = ctx.reports.slice(0, 100);
    scheduleSave();
    return {};
  }));
};
