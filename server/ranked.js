'use strict';
const crypto = require('crypto');
const Glicko = require('./glicko2');
const R = require('./ranked-rules');
const Games = require('./games');
const BurracoRules = require('../shared/rules');
const E = require('./engine');
const Migration = require('./ranked-migration');
const empty = () => ({ version: 2, players: {}, matches: {}, legends: {}, legendAt: 0 });
const clone = (x) => JSON.parse(JSON.stringify(x));
const keyOf = (game, n, queue) => queue === 'solo' ? `${game}:solo` : `${game}:${n}:${queue}`;
const teamGames = new Set(['burraco', 'reale', 'aberto', 'fechado', 'canasta', 'scopa', 'scopone', 'briscola', 'tressette']);
function createRanked(ctx, options = {}) {
  const c = { ...R.CONFIG, ...options.config }, clock = options.clock || Date.now;
  const view = (p) => R.view(p, c);
  const queue = new Map(), invites = new Map();
  const party = require('./ranked-party')({ctx,clock,checked,format,enter,cancel,queue,emit});
  if (!ctx.ranked) ctx.ranked = empty();
  const persist = () => ctx.saveNow('ranked');
  function transaction(fn) {
    const previous = ctx.ranked;
    ctx.ranked = clone(previous);
    try { const result = fn(); persist(); return result; }
    catch (e) { ctx.ranked = previous; throw e; }
  }
  function profile(token, key, now = clock()) {
    key = Migration.ratingKey(key);
    const all = ctx.ranked.players[token] ||= {};
    const p = all[key] ||= R.fresh(now, c);
    return R.rollover(p, now, c);
  }
  function eligible(token) {
    const s = ctx.sessions.get(token);
    return !!s?.nick && !s.suspended && !s.banned && !(s.rankedBanUntil > clock());
  }
  function checked(token) {
    if (!eligible(token)) throw new E.GameError('Ranked non disponibile per questo profilo');
    for (const room of ctx.rooms.values()) if (Games.enabled(room) && room.game && !room.game.over && room.seats.some((s) => s && (s.token === token || s.leftToken === token))) throw new E.GameError('Completa prima la partita in corso');
    const all = ctx.ranked.players[token] || {};
    if (Object.values(all).some((p) => p.cooldownUntil > clock())) throw new E.GameError('Pausa Ranked dopo un abbandono');
  }
  function format({ game = 'burraco', n = 2, queue: q = 'solo' } = {}) {
    const variant = ['reale', 'aberto', 'fechado'].includes(game) && BurracoRules.PRESETS.find((p) => p.id === game);
    const rules = variant ? BurracoRules.normalize({ ...variant.rules, players: Number(n) }) : Games.publicRules(game, n);
    if (variant && (![2, 3, 4].includes(Number(n)) || rules.players !== Number(n))) throw new E.GameError('Numero di giocatori non valido per questo gioco');
    if (!['solo', 'duo'].includes(q) || (q === 'duo' && (rules.players !== 4 || !teamGames.has(game)))) throw new E.GameError('Coda non valida per questo formato');
    return { game, n: rules.players, queue: q, rules, key: keyOf(game, rules.players, q) };
  }
  function emit(token, event, data) { for (const s of ctx.socketsOf(token)) s.emit(event, data); }
  function cancel(token) {
    for (const [id, entry] of queue) if (entry.tokens.includes(token)) { queue.delete(id); entry.tokens.forEach((t) => emit(t, 'rankedQueue', { searching: false })); }
    for (const [id, invite] of invites) if (invite.tokens.includes(token)) { invites.delete(id); invite.tokens.forEach((t) => emit(t, 'rankedQueue', { searching: false })); }
  }
  function enter(tokens, f) {
    tokens.forEach(checked);
    for (const t of tokens) if (party.mine(t) && party.mine(t).id !== f.id) party.leave(t);
    if (tokens.some((t) => !ctx.isConnected(t))) throw new E.GameError('Entrambi i giocatori devono essere online');
    const now = clock();
    const profiles = tokens.map((t) => profile(t, f.key, now));
    if (tokens.length === 2 && Math.abs(profiles[0].rating - profiles[1].rating) > c.duoGap) throw new E.GameError('Differenza di rating troppo alta per la Duo');
    tokens.forEach(cancel);
    queue.set(crypto.randomUUID(), { ...f, tokens, at: now });
    tokens.forEach((t) => emit(t, 'rankedQueue', { searching: true, game: f.game, n: f.n, queue: f.queue, at: now }));
    tick(); return { searching: true };
  }
  function join(token, data) {
    const f = format(data); checked(token);
    party.leave(token);
    if (f.queue === 'solo') return enter([token], f);
    const sess = ctx.sessions.get(token);
    const friend = [...ctx.sessions].find(([t, s]) => (sess.friends || []).includes(t) && s.nick === data.friend);
    if (!friend || friend[0] === token || !ctx.isConnected(friend[0])) throw new E.GameError('Scegli un amico online');
    checked(friend[0]); cancel(token);
    const id = crypto.randomUUID();
    invites.set(id, { ...f, tokens: [token, friend[0]], expires: clock() + 60000 });
    emit(friend[0], 'rankedInvite', { id, from: sess.nick, game: f.game, n: f.n });
    return { invited: true };
  }
  function accept(token, id) {
    const invite = invites.get(id);
    if (!invite || invite.tokens[1] !== token || invite.expires < clock()) throw new E.GameError('Invito Ranked scaduto');
    invites.delete(id); return enter(invite.tokens, invite);
  }
  function rating(token, key) {
    const p = profile(token, key);
    return Glicko.inactive(p, Math.floor(Math.max(0, clock() - p.lastAt) / c.periodMs), c);
  }
  const windowFor = (wait) => wait < 15000 ? c.initialWindow : wait < 30000 ? c.middleWindow : Math.min(c.maxWindow, c.middleWindow + (wait - 30000) / 300);
  function quality(tokens, teams, key) {
    const ps = tokens.map((t) => rating(t, key));
    const avgs = teams.map((team) => team.reduce((s, i) => s + ps[i].rating, 0) / team.length);
    const spread = Math.max(...avgs) - Math.min(...avgs);
    const rd = Math.max(...ps.map((p) => p.rd)) - Math.min(...ps.map((p) => p.rd));
    const partner = Math.max(...teams.map((team) => Math.max(...team.map((i) => ps[i].rating)) - Math.min(...team.map((i) => ps[i].rating))));
    return { spread, cost: spread + 0.15 * rd + 0.1 * partner };
  }
  function recentOpponents(tokens, teams, key) {
    return teams.some((team, i) => team.some((s) => (ctx.ranked.players[tokens[s]]?.[key]?.recent || []).some((r) => clock() - r.at < c.rematchMs && teams.some((other, j) => j !== i && other.some((o) => r.opponents.includes(tokens[o]))))));
  }
  function arrangement(entries) {
    const f = entries[0], tokens = entries.flatMap((x) => x.tokens);
    let alternatives;
    if (f.n === 4 && teamGames.has(f.game)) alternatives = f.queue === 'duo' ? [[[0, 1], [2, 3]]] : [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
    else alternatives = [tokens.map((_, i) => [i])];
    const max = Math.min(...entries.map((x) => windowFor(clock() - x.at)));
    const candidates = alternatives.map((teams) => ({ teams, ...quality(tokens, teams, f.key) }))
      .filter((x) => x.spread <= max && x.cost <= max + 70 && !recentOpponents(tokens, x.teams, f.key)).sort((a, b) => a.cost - b.cost);
    if (!candidates.length) return null;
    const teams = candidates[0].teams;
    // I motori a coppie siedono 0/2 contro 1/3.
    return teams.length === 2 && tokens.length === 4 ? [tokens[teams[0][0]], tokens[teams[1][0]], tokens[teams[0][1]], tokens[teams[1][1]]] : tokens;
  }
  function launch(entries, tokens) {
    const f = entries[0], code = ctx.newCode();
    const room = { code, rules: f.rules, n: f.n, quick: f.n, queueMode: 'ranked', hostToken: tokens[0],
      rankedMatch: { id: crypto.randomUUID(), key: f.key, queue: f.queue, tokens, season: R.seasonOf(clock(), c), created: clock() },
      seats: tokens.map((token) => ({ token, name: ctx.sessions.get(token).nick, avatar: ctx.sessions.get(token).avatar || null })),
      game: null, ready: new Set(), botTimer: null, botMemo: {}, turnTime: c.turnSeconds };
    ctx.rooms.set(code, room);
    try {
      // Tutti i posti sono fissati dal server prima dell'avvio; nessun invito diretto può inserirsi.
      tokens.forEach((t) => { const s = ctx.socketsOf(t)[0]; if (s.data.room) ctx.leaveRoom(s); s.join(code); s.data.room = code; ctx.sessions.get(t).room = code; });
      ctx.startGame(room); persist();
      party.matched(tokens);
      tokens.forEach(cancel);
    } catch (e) { ctx.rooms.delete(code); throw e; }
  }
  function tick() {
    party.tick();
    for (const room of ctx.rooms.values()) {
      if (!Games.enabled(room)) continue;
      if (!room.rankedMatch || !room.game) continue;
      if (room.game.over) {
        if (!ctx.ranked.matches[room.rankedMatch.id]) {
          if (ctx.recordLeaderboard) ctx.recordLeaderboard(room); else record(room);
        }
        continue;
      }
      room.rankedAbsent = room.rankedAbsent || {};
      for (let i = 0; i < room.rankedMatch.tokens.length; i++) {
        const token = room.rankedMatch.tokens[i];
        if (ctx.isConnected(token)) { delete room.rankedAbsent[token]; continue; }
        room.rankedAbsent[token] ||= clock();
        if (clock() - room.rankedAbsent[token] >= (c.disconnectGraceMs || 120000)) {
          room.rankedMatch.abandoned = [...new Set([...(room.rankedMatch.abandoned || []), token])];
          Games.of(room).E.surrender(room.game, i); ctx.afterAction(room); break;
        }
      }
      if (room.game.over) continue;
      if (room.game.phase !== 'handEnd') { delete room.rankedHandEndAt; continue; }
      room.rankedHandEndAt ||= clock();
      if (clock() - room.rankedHandEndAt > (c.disconnectGraceMs || 120000)) {
        const seat = room.rankedMatch.tokens.findIndex((_, i) => !room.ready.has(i));
        if (seat >= 0) { room.rankedMatch.abandoned = [...new Set([...(room.rankedMatch.abandoned || []), room.rankedMatch.tokens[seat]])]; Games.of(room).E.surrender(room.game, seat); ctx.afterAction(room); }
      }
    }
    for (const [id, invite] of invites) if (invite.expires < clock()) { invites.delete(id); invite.tokens.forEach((t) => emit(t, 'rankedQueue', { searching: false })); }
    for (const entry of [...queue.values()]) if (entry.tokens.some((t) => !ctx.isConnected(t) || !eligible(t) || [...ctx.rooms.values()].some((r) => Games.enabled(r) && r.game && !r.game.over && r.seats.some((s) => s?.token === t)))) entry.tokens.forEach(cancel);
    // Ricerca limitata a 24 candidati per testa: limita il lavoro sul telefono-server.
    for (const entry of [...queue.values()]) {
      if (![...queue.values()].includes(entry)) continue;
      const pool = [...queue.values()].filter((x) => x.key === entry.key && x.n === entry.n && x !== entry).slice(0, 23);
      const needed = entry.queue === 'duo' ? 2 : entry.n;
      let selection = null, seats = null, explored = 0;
      function search(chosen, offset) {
        if (selection || explored++ > 1500) return;
        if (chosen.length === needed) { const order = arrangement(chosen); if (order) { selection = chosen; seats = order; } return; }
        for (let i = offset; i < pool.length; i++) search([...chosen, pool[i]], i + 1);
      }
      search([entry], 0);
      if (selection) launch(selection, seats);
    }
  }
  function record(room) {
    if (!Games.enabled(room)) return;
    const m = room.rankedMatch, g = room.game;
    if (!m || !g?.over || !room.rankedGame || ctx.ranked.matches[m.id]) return null;
    if (room.localGame || room.daily || room.tournament || room.tutorial || new Set(m.tokens).size !== room.n || m.tokens.some((t) => !ctx.sessions.has(t))) return null;
    if (!g.teams?.length || !g.winners?.length) return null;
    m.key = Migration.ratingKey(m.key);
    const updates = transaction(() => {
      const now = clock(), ps = m.tokens.map((t) => clone(rating(t, m.key)));
      const teams = g.teams.map((t) => t.members);
      const scores = teams.map((t) => t.some((s) => g.winners.includes(s)) ? 1 : 0);
      const next = Glicko.teamUpdate(teams.map((t) => t.map((s) => ps[s])), scores, c);
      const results = [];
      teams.forEach((team, i) => team.forEach((seat, j) => {
        const token = m.tokens[seat], before = view(ps[seat]), p = next[i][j];
        const abandoned = (m.abandoned || []).includes(token);
        const score = abandoned ? 0 : scores.every((s) => s === scores[0]) ? 0.5 : scores[i];
        if (abandoned) { p.rating = Math.min(p.rating, ps[seat].rating); p.cooldownUntil = now + c.abandonMs * Math.min(8, (p.abandons || 0) + 1); p.abandons = (p.abandons || 0) + 1; }
        const delta = R.progress(p, score, c); p.lastAt = now;
        const opponents = teams.filter((_, k) => k !== i).flatMap((t) => t.map((s) => m.tokens[s]));
        p.recent = [{ at: now, opponents }, ...(p.recent || []).filter((r) => now - r.at < c.rematchMs)].slice(0, 20);
        p.history = [{ id: m.id, at: now, n: room.n, score, delta, placementMatch: before.provisional, league: view(p).league, division: view(p).division, lp: p.lp, abandoned }, ...p.history].slice(0, 100);
        ctx.ranked.players[token][m.key] = p;
        results.push({ token, matchId: m.id, key: m.key, before, after: view(p), delta, placementMatch: before.provisional });
      }));
      ctx.ranked.matches[m.id] = { at: now, key: m.key, season: R.seasonOf(now, c) };
      return results;
    });
    updates.forEach(({ token, ...u }) => emit(token, 'rankedResult', u));
    return updates;
  }
  function legends(force = false) {
    if (!force && clock() - ctx.ranked.legendAt < R.DAY && R.seasonOf(ctx.ranked.legendAt, c) === R.seasonOf(clock(), c)) return;
    const changes = transaction(() => {
      const changes = [];
      const now = clock(), keys = new Set(Object.values(ctx.ranked.players).flatMap(Object.keys));
      // I match ancora salvati mantengono il proprio identificatore; gli altri non
      // sono richiamabili dal client e il ledger vecchio può essere compattato.
      const live = new Set([...ctx.rooms.values()].map((r) => r.rankedMatch?.id));
      for (const [id, m] of Object.entries(ctx.ranked.matches)) if (now - m.at > 2 * c.seasonMs && !live.has(id)) delete ctx.ranked.matches[id];
      for (const key of keys) {
        if (!Games.enabled(key.split(':')[0]) && !['reale','aberto','fechado'].includes(key.split(':')[0])) continue;
        const all = Object.keys(ctx.ranked.players).filter((t) => ctx.ranked.players[t][key]).map((token) => ({ token, p: profile(token, key, now) }));
        const pool = all.filter(({ token, p }) => eligible(token) && p.games >= c.minLegendGames && now - p.lastAt <= c.activeMs)
          .sort((a, b) => b.p.rating - a.p.rating || (a.token < b.token ? -1 : 1));
        const slots = pool.length ? Math.max(1, Math.floor(pool.length * c.legendFraction)) : 0;
        const winners = new Set(pool.slice(0, slots).filter(({ p }) => p.rating >= c.legendRating).map((x) => x.token));
        for (const { token, p } of all) {
          const before = view(p), wasLegend = p.legend;
          if (p.legend && !winners.has(token)) Object.assign(p, { tier: 7, division: 3, lp: 75, promo: null });
          p.legend = winners.has(token);
          if (p.legend) { p.promo = null; p.best = Math.max(p.best, 3300); p.allTimeBest = Math.max(p.allTimeBest, 3300); }
          if (wasLegend !== p.legend) changes.push({ token, key, before, after: view(p) });
        }
        ctx.ranked.legends[key] = { at: now, eligible: pool.length, slots, cutoff: Math.max(c.legendRating, pool[slots - 1]?.p.rating || c.legendRating), order: pool.map((x) => x.token) };
      }
      ctx.ranked.legendAt = now;
      return changes;
    });
    changes.forEach(({ token, ...change }) => emit(token, 'rankedRankChange', change));
  }
  function board(token, data = {}) {
    const f = format(data); legends();
    const currentSeason = R.seasonOf(clock(), c);
    const season = Number.isInteger(data.season) && data.season >= 0 && data.season < currentSeason ? data.season : currentSeason;
    const atSeason = (p) => season === currentSeason ? p : { ...R.fresh(clock(), c), ...p.seasons.find((s) => s.season === season), season };
    const mine = atSeason(profile(token, f.key)), s = ctx.ranked.legends[f.key] || { eligible: 0, slots: 0, order: [], cutoff: c.legendRating };
    const globalPos = s.order.indexOf(token) + 1;
    const friends = new Set([token, ...(ctx.sessions.get(token)?.friends || [])]);
    const all = Object.keys(ctx.ranked.players).filter((t) => eligible(t) && (!data.friends || friends.has(t)) && ctx.ranked.players[t][f.key])
      .map((t) => ({ token: t, p: atSeason(profile(t, f.key)) })).filter(({ p }) => p.games > 0)
      .sort((a, b) => b.p.rating - a.p.rating || (a.token < b.token ? -1 : 1));
    const seasons = [...new Set([currentSeason, ...Object.values(ctx.ranked.players).flatMap((p) => (p[f.key]?.seasons || []).map((s) => s.season))])].sort((a,b)=>b-a);
    return { game: f.game, n: f.n, queue: f.queue, season, currentSeason, seasons, archived: season !== currentSeason, ends: c.epoch + (season + 1) * c.seasonMs,
      mine: { ...view(mine), position: all.findIndex((x) => x.token === token) + 1 || null },
      legend: { eligible: s.eligible, slots: s.slots, position: globalPos || null, percentile: globalPos ? 100 * globalPos / s.eligible : null,
        distance: Math.max(0, Math.ceil(s.cutoff - mine.rating)), minimumGames: c.minLegendGames, updatedAt: s.at || null },
      list: all.slice(0, 100).map(({ token: t, p }, i) => ({ ...view(p), history: undefined, seasons: undefined, rewards: undefined, name: ctx.sessions.get(t).nick,
        avatar: ctx.sessions.get(t).avatar || null, position: i + 1, me: t === token })) };
  }
  function mine(token) { return Object.fromEntries(Object.keys(ctx.ranked.players[token] || {}).filter((k) => Games.enabled(k.split(':')[0]) || ['reale','aberto','fechado'].includes(k.split(':')[0])).map((k) => [k, view(profile(token, k))])); }
  function register(socket, handler) {
    socket.on('rankedJoin', handler((data) => join(socket.data.token, data)));
    socket.on('rankedAccept', handler(({ id }) => accept(socket.data.token, id)));
    socket.on('rankedCancel', handler(() => { cancel(socket.data.token); party.reset(socket.data.token); return {}; }));
    socket.on('rankedPartyCreate', handler(({game}) => party.create(socket.data.token,game)));
    socket.on('rankedPartyInvite', handler(({nick}) => party.invite(socket.data.token,nick)));
    socket.on('rankedPartyAccept', handler(({id}) => party.accept(socket.data.token,id)));
    socket.on('rankedPartyReady', handler(() => party.ready(socket.data.token)));
    socket.on('rankedPartyLeave', handler(() => {party.leave(socket.data.token);return {};}));
    socket.on('rankedBoard', handler((data) => board(socket.data.token, data)));
    socket.on('rankedProfile', handler(() => {
      const currentSeason = R.seasonOf(clock(), c);
      return { ranks: mine(socket.data.token), currentSeason, ends: c.epoch + (currentSeason + 1) * c.seasonMs,
        party: party.mine(socket.data.token), queue: [...queue.values()].find((e) => e.tokens.includes(socket.data.token)) ? { searching: true } : null };
    }));
    socket.on('disconnect', () => { if (!ctx.isConnected(socket.data.token)) cancel(socket.data.token); });
  }
  function migrate() {
    if ((ctx.ranked.version || 1) < 2) transaction(() => Migration.migrate(ctx.ranked, clock(), c));
    // Anche un tavolo iniziato con la vecchia versione aggiorna il punteggio comune.
    for (const room of ctx.rooms.values()) if (room.rankedMatch) room.rankedMatch.key = Migration.ratingKey(room.rankedMatch.key);
  }
  migrate();
  return { register, join, accept, cancel:token=>{cancel(token);party.leave(token);}, tick, record, board, mine, legends, profile, queue, invites, party, windowFor, arrangement, transaction, format, migrate };
}
module.exports = { createRanked, empty, keyOf };
