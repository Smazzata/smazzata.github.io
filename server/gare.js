'use strict';
/*
 * Gare tra amici: campionati (classifica di stagione) e tornei a eliminazione diretta
 * (tavoli aperti da soli, partite tra computer simulate, avvisi a chi deve giocare).
 */
const Games = require('./games');
const Rules = require('../shared/rules');
const createLeagues = require('./leagues');
const createTournaments = require('./tournaments');
const { HOME_URL } = require('./config');
const ctx = require('./contesto');
const { io, sessions, rooms, leagues, tournaments } = ctx;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const awardTrophies = (...a) => ctx.awardTrophies(...a);
const newCode = (...a) => ctx.newCode(...a);
const pushMyGames = (...a) => ctx.pushMyGames(...a);
const scheduleSave = (...a) => ctx.scheduleSave(...a);
const socketsOf = (...a) => ctx.socketsOf(...a);

/* campionati tra amici: id -> { name, owner, period, members, seasonStart, standings, past } */
const League = createLeagues({ leagues, nickOf: (t) => (sessions.get(t) || {}).nick });

/* ---------- Tornei a eliminazione ---------- */
/** regole "brevi" per le partite dei tornei (uno contro uno) */
function tournamentRules(game) {
  const short = {
    burraco: { ...Rules.PRESETS[0].rules, players: 2, target: 1005 },
    scala40: { game: 'scala40', players: 2 }, canasta: { game: 'canasta', players: 2, target: 2000 },
    scopa: { game: 'scopa', players: 2, target: 11 }, briscola: { game: 'briscola', players: 2, target: 2 },
  }[game];
  return Games.of(short).normalize(short);
}
const Tour = createTournaments({
  tournaments,
  nickOf: (t) => (sessions.get(t) || {}).nick,
  openMatch: (t, m) => {
    const seat = (p) => (p.bot ? { isBot: true, name: p.name } : { token: p.token, name: (sessions.get(p.token) || {}).nick || p.name, avatar: (sessions.get(p.token) || {}).avatar || null });
    const room = {
      code: newCode(), rules: tournamentRules(t.game), n: 2, hostToken: (m.a.bot ? m.b : m.a).token,
      seats: [seat(m.a), seat(m.b)], game: null, ready: new Set(), botTimer: null, botMemo: {}, botLevel: 'normale',
      tournament: { id: t.id, name: t.name, round: m.round, index: m.index },
    };
    rooms.set(room.code, room);
    for (const x of room.seats) if (x && !x.isBot) pushMyGames(x.token);
    return room.code;
  },
  simulate: (t, A, B) => {
    const rules = tournamentRules(t.game);
    const G = Games.of(rules);
    const g = G.E.createGame({ rules, players: [{ name: A.name, isBot: true }, { name: B.name, isBot: true }] });
    let guard = 0;
    while (!g.over && guard++ < 20000) {
      if (g.phase === 'handEnd') { G.E.nextHand(g); continue; }
      const s = g.turn;
      try { G.E.apply(g, s, G.Bot.nextAction(g, s, { level: 'normale' })); } catch (e) { break; }
    }
    return g.over ? (g.winners.includes(0) ? 'a' : 'b') : (Math.random() < 0.5 ? 'a' : 'b');
  },
  notify: (token, text, code) => {
    const socks = socketsOf(token);
    if (socks.length) for (const s of socks) { s.emit('notice', { text }); if (code) s.emit('tournamentMatch', { code, text }); }
    else ctx.push.send(token, { title: 'Burraco: torneo 🏆', body: text, tag: 'torneo', url: code ? `${HOME_URL}?t=${code}` : HOME_URL }).catch(() => {});
  },
  champion: (token) => awardTrophies(token, '', ['torneo']),
});
/** un torneo è cambiato: chi ha la finestra aperta la aggiorna */
const tournamentsChanged = () => { io.emit('tournamentsChanged'); scheduleSave(); };

Object.assign(ctx, { tournamentRules, tournamentsChanged, League, Tour });
