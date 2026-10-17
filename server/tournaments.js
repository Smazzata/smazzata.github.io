'use strict';
/*
 * Tornei a eliminazione diretta (4, 8 o 16 partecipanti, partite uno contro uno).
 * Il modulo gestisce iscrizioni, tabellone e avanzamento; le partite vere sono tavoli normali,
 * creati e conclusi dal server tramite i callback:
 *   openMatch(t, match)  → crea il tavolo della partita (restituisce il codice) o null se è tra due computer
 *   simulate(t, a, b)    → gioca all'istante una partita tra due computer: restituisce 'a' o 'b'
 *   notify(token, text, code) → avvisa un giocatore (in app o con notifica push)
 *   champion(token)      → premia il vincitore
 */
const SIZES = [4, 8, 16];
const GAMES = ['burraco', 'scala40', 'canasta', 'scopa', 'briscola', 'tressette', 'rubamazzetto'];
const { nomeComputer } = require('./nomi-computer');

module.exports = function createTournaments({ tournaments, nickOf, openMatch, simulate, notify, champion }) {
  const newId = () => {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id;
    do { id = 'T' + Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (tournaments.has(id));
    return id;
  };
  const err = (m) => { throw new Error(m); };
  const nameOf = (p) => (p.bot ? p.name : nickOf(p.token) || p.name);

  function create(owner, { name, game, size }) {
    const nm = String(name || '').replace(/[<>]/g, '').trim().slice(0, 30);
    if (nm.length < 3) err('Dai un nome al torneo (almeno 3 caratteri)');
    if (!GAMES.includes(game)) err('Gioco non valido');
    if (!SIZES.includes(Number(size))) err('Numero di partecipanti non valido');
    if ([...tournaments.values()].filter((t) => t.owner === owner && t.status !== 'finito').length >= 2) err('Hai già due tornei aperti');
    const id = newId();
    tournaments.set(id, {
      id, name: nm, game, size: Number(size), owner, status: 'iscrizioni', createdAt: Date.now(),
      players: [{ token: owner, name: nickOf(owner) }], rounds: [], champion: null,
    });
    return id;
  }

  function get(id) { const t = tournaments.get(String(id || '')); if (!t) err('Torneo non trovato'); return t; }

  function join(t, token) {
    if (t.status !== 'iscrizioni') err('Le iscrizioni sono chiuse');
    if (t.players.some((p) => p.token === token)) err('Sei già iscritto');
    if (t.players.length >= t.size) err('Il torneo è al completo');
    t.players.push({ token, name: nickOf(token) });
  }

  function leave(t, token) {
    if (t.status !== 'iscrizioni') err('Il torneo è già iniziato');
    if (t.owner === token) { tournaments.delete(t.id); return; }
    t.players = t.players.filter((p) => p.token !== token);
  }

  function fillBots(t, token) {
    if (t.owner !== token) err('Solo chi ha creato il torneo può farlo');
    if (t.status !== 'iscrizioni') err('Le iscrizioni sono chiuse');
    while (t.players.length < t.size) t.players.push({ bot: true, name: nomeComputer(t.players.map((p) => p.name)) });
  }

  function start(t, token) {
    if (t.owner !== token) err('Solo chi ha creato il torneo può farlo');
    if (t.status !== 'iscrizioni') err('Il torneo è già iniziato');
    if (t.players.length < t.size) err(`Servono ${t.size} partecipanti (puoi riempire con il computer)`);
    const order = t.players.map((_, i) => i).sort(() => Math.random() - 0.5);
    const first = [];
    for (let i = 0; i < order.length; i += 2) first.push({ a: order[i], b: order[i + 1], room: null, winner: null });
    t.rounds = [first];
    t.status = 'in corso';
    playRound(t);
  }

  /** Avvia le partite del turno corrente: tavoli per chi ha almeno un umano, simulazione per i computer */
  function playRound(t) {
    const round = t.rounds[t.rounds.length - 1];
    round.forEach((m, i) => {
      if (m.winner != null || m.room) return;
      const A = t.players[m.a], B = t.players[m.b];
      if (A.bot && B.bot) { m.winner = simulate(t, A, B) === 'a' ? m.a : m.b; return; }
      m.room = openMatch(t, { round: t.rounds.length - 1, index: i, a: A, b: B });
      for (const p of [A, B]) if (!p.bot) notify(p.token, `🏆 Torneo «${t.name}»: la tua partita contro ${nameOf(p === A ? B : A)} è pronta`, m.room);
    });
    advance(t);
  }

  /** Se il turno è finito si passa al successivo (o si proclama il campione) */
  function advance(t) {
    const round = t.rounds[t.rounds.length - 1];
    if (round.some((m) => m.winner == null)) return;
    const winners = round.map((m) => m.winner);
    if (winners.length === 1) {
      t.status = 'finito';
      t.champion = winners[0];
      t.endedAt = Date.now();
      const c = t.players[winners[0]];
      if (!c.bot) champion(c.token);
      for (const p of t.players) if (!p.bot) notify(p.token, `🏆 Il torneo «${t.name}» è finito: vince ${nameOf(c)}!`, null);
      return;
    }
    const next = [];
    for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1], room: null, winner: null });
    t.rounds.push(next);
    playRound(t);
  }

  /** Fine di una partita del torneo: winnerSide 'a' o 'b' */
  function matchDone(id, roundIdx, index, winnerSide) {
    const t = tournaments.get(id);
    if (!t || t.status !== 'in corso') return;
    const m = (t.rounds[roundIdx] || [])[index];
    if (!m || m.winner != null) return;
    m.winner = winnerSide === 'a' ? m.a : m.b;
    advance(t);
  }

  /** Chi ha creato il torneo assegna la vittoria a tavolino (per chi non si presenta) */
  function forfeit(t, token, roundIdx, index, winnerSide) {
    if (t.owner !== token) err('Solo chi ha creato il torneo può farlo');
    matchDone(t.id, roundIdx, index, winnerSide);
  }

  function view(t, me) {
    return {
      id: t.id, name: t.name, game: t.game, size: t.size, status: t.status, owner: nickOf(t.owner), mine: t.owner === me,
      joined: t.players.some((p) => p.token === me),
      players: t.players.map((p) => ({ name: nameOf(p), bot: !!p.bot, me: p.token === me })),
      rounds: t.rounds.map((r) => r.map((m) => ({ a: m.a, b: m.b, winner: m.winner, room: m.room }))),
      champion: t.champion,
    };
  }

  /** Elenco: tornei aperti alle iscrizioni, in corso o finiti da poco (prima i miei) */
  function list(me) {
    const recent = Date.now() - 7 * 24 * 3600 * 1000;
    return [...tournaments.values()]
      .filter((t) => t.status !== 'finito' || (t.endedAt || 0) > recent)
      .sort((a, b) => (b.players.some((p) => p.token === me) - a.players.some((p) => p.token === me)) || b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((t) => view(t, me));
  }

  return { create, get, join, leave, fillBots, start, matchDone, forfeit, view, list, GAMES, SIZES };
};
