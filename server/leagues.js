'use strict';
/*
 * Campionati tra amici: un gruppo (fino a 20 giocatori) con una classifica che dura una settimana o un mese.
 * Contano le partite finite in cui siedono almeno due membri: 3 punti a chi vince, 1 a chi partecipa.
 * A fine stagione il primo entra nell'albo d'oro (e riceve un trofeo), poi la classifica riparte da zero.
 */
const Parole = require('../shared/parole');
const DAY = 24 * 3600 * 1000;
const MAX_MEMBERS = 20;
const MAX_PER_PLAYER = 5;

module.exports = function createLeagues({ leagues, nickOf }) {
  const newId = () => {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id;
    do { id = Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (leagues.has(id));
    return id;
  };

  /** Fine della stagione: lunedì successivo (settimana) o il primo del mese dopo (mese), a mezzanotte UTC */
  function seasonEnd(start, period) {
    const d = new Date(start);
    if (period === 'mese') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    const day = d.getUTCDay(); // 0 = domenica
    const toMonday = ((8 - day) % 7) || 7;
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + toMonday);
  }

  /** Classifica ordinata: punti, poi vittorie, poi meno partite */
  const ranking = (lg) => Object.entries(lg.standings)
    .map(([token, x]) => ({ token, ...x }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.games - b.games);

  /** Se la stagione è finita: albo d'oro, trofeo al vincitore e classifica azzerata. Restituisce i token premiati */
  function rollover(lg, now = Date.now()) {
    const champions = [];
    while (now >= seasonEnd(lg.seasonStart, lg.period)) {
      const end = seasonEnd(lg.seasonStart, lg.period);
      const rank = ranking(lg).filter((x) => x.games > 0);
      if (rank.length) {
        const top = rank.filter((x) => x.pts === rank[0].pts && x.wins === rank[0].wins);
        lg.past = [{ from: lg.seasonStart, to: end, winners: top.map((x) => nickOf(x.token) || x.name), pts: rank[0].pts }, ...(lg.past || [])].slice(0, 12);
        champions.push(...top.map((x) => x.token));
      }
      lg.standings = {};
      lg.seasonStart = end;
    }
    return champions;
  }

  function create(owner, name, period) {
    const nm = String(name || '').replace(/[<>]/g, '').trim().slice(0, 30);
    if (nm.length < 3) throw new Error('Dai un nome al campionato (almeno 3 caratteri)');
    if (Parole.contiene(nm)) throw new Error('Nome non permesso dalle regole');
    if (!['settimana', 'mese'].includes(period)) throw new Error('Durata non valida');
    if (mine(owner).length >= MAX_PER_PLAYER) throw new Error(`Puoi far parte di al massimo ${MAX_PER_PLAYER} campionati`);
    const id = newId();
    leagues.set(id, { id, name: nm, owner, period, members: [owner], seasonStart: Date.now(), standings: {}, past: [] });
    return id;
  }

  const mine = (token) => [...leagues.values()].filter((lg) => lg.members.includes(token));

  function get(id, token) {
    const lg = leagues.get(String(id || ''));
    if (!lg || !lg.members.includes(token)) throw new Error('Campionato non trovato');
    return lg;
  }

  function addMember(lg, token, other) {
    if (lg.owner !== token) throw new Error('Solo chi ha creato il campionato può aggiungere giocatori');
    if (lg.members.includes(other)) throw new Error('È già nel campionato');
    if (lg.members.length >= MAX_MEMBERS) throw new Error(`Al massimo ${MAX_MEMBERS} giocatori`);
    if (mine(other).length >= MAX_PER_PLAYER) throw new Error(`${nickOf(other)} è già in ${MAX_PER_PLAYER} campionati`);
    lg.members.push(other);
  }

  /** Togliere un membro (il creatore) o uscire da soli; se esce il creatore passa al primo rimasto */
  function removeMember(lg, token, other) {
    if (other !== token && lg.owner !== token) throw new Error('Solo chi ha creato il campionato può togliere giocatori');
    lg.members = lg.members.filter((t) => t !== other);
    delete lg.standings[other];
    if (!lg.members.length) { leagues.delete(lg.id); return; }
    if (lg.owner === other) lg.owner = lg.members[0];
  }

  /** Fine partita: per ogni campionato con almeno due membri al tavolo, punti a tutti i membri presenti */
  function recordGame(players) {
    // players: [{ token, name, won }]
    const champions = [];
    for (const lg of leagues.values()) {
      const here = players.filter((p) => lg.members.includes(p.token));
      if (here.length < 2) continue;
      champions.push(...rollover(lg));
      for (const p of here) {
        const x = lg.standings[p.token] || { name: p.name, pts: 0, games: 0, wins: 0 };
        x.name = p.name; x.games++; if (p.won) x.wins++;
        x.pts += p.won ? 3 : 1;
        lg.standings[p.token] = x;
      }
    }
    return champions;
  }

  /** Vista per un membro: classifica con nomi, albo d'oro, fine stagione */
  function view(lg, token) {
    const rank = ranking(lg);
    const noGames = lg.members.filter((t) => !lg.standings[t]).map((t) => ({ token: t, name: nickOf(t) || '?', pts: 0, games: 0, wins: 0 }));
    return {
      id: lg.id, name: lg.name, period: lg.period, owner: nickOf(lg.owner), mineOwner: lg.owner === token,
      ends: seasonEnd(lg.seasonStart, lg.period),
      standings: rank.concat(noGames).map((x, i) => ({ pos: i + 1, name: nickOf(x.token) || x.name, pts: x.pts, games: x.games, wins: x.wins, me: x.token === token })),
      members: lg.members.map((t) => nickOf(t)).filter(Boolean),
      past: lg.past || [],
    };
  }

  /** Eliminazione del profilo: esce da tutti i campionati */
  function forget(token) {
    for (const lg of [...leagues.values()]) if (lg.members.includes(token)) removeMember(lg, token, token);
  }

  return { create, mine, get, addMember, removeMember, recordGame, rollover, view, forget, seasonEnd };
};
