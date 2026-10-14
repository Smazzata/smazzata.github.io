'use strict';
/*
 * Trofei: obiettivi da sbloccare giocando. Si salvano nella voce del giocatore in classifica
 * (e.trophies = { id: data }), quindi spariscono con l'eliminazione del profilo.
 * Alcuni dipendono da un contatore delle statistiche (stat + goal) e mostrano l'avanzamento.
 */
const LIST = [
  { id: 'primo_burraco', e: '🃏', name: 'Primo burraco', desc: 'Completa il tuo primo burraco', stat: 'burraco', goal: 1 },
  { id: 'pulito', e: '✨', name: 'Tutto pulito', desc: 'Fai un burraco pulito (senza matte)' },
  { id: 'tris_burraco', e: '🔥', name: 'Tris di burraco', desc: 'Fai 3 burraco nella stessa smazzata' },
  { id: 'reale', e: '👑', name: 'Scala reale', desc: 'Completa una scala dall\'Asso al Re' },
  { id: 'mille', e: '💯', name: 'Smazzata da mille', desc: 'Fai almeno 1000 punti in una smazzata' },
  { id: 'chiusura', e: '🚪', name: 'Si chiude!', desc: 'Chiudi una smazzata', stat: 'closures', goal: 1 },
  { id: 'chiusure_25', e: '🗝️', name: 'Specialista della chiusura', desc: 'Chiudi 25 smazzate', stat: 'closures', goal: 25 },
  { id: 'burraco_50', e: '🎴', name: 'Collezionista', desc: 'Completa 50 burraco', stat: 'burraco', goal: 50 },
  { id: 'prima_vittoria', e: '🏆', name: 'Prima vittoria', desc: 'Vinci una partita', stat: 'wins', goal: 1 },
  { id: 'vittorie_10', e: '🥉', name: 'Dieci vittorie', desc: 'Vinci 10 partite', stat: 'wins', goal: 10 },
  { id: 'vittorie_50', e: '🥈', name: 'Cinquanta vittorie', desc: 'Vinci 50 partite', stat: 'wins', goal: 50 },
  { id: 'vittorie_100', e: '🥇', name: 'Cento vittorie', desc: 'Vinci 100 partite', stat: 'wins', goal: 100 },
  { id: 'maratona', e: '🎯', name: 'Maratona', desc: 'Gioca 100 partite', stat: 'games', goal: 100 },
  { id: 'rimonta', e: '🔄', name: 'Rimonta', desc: 'Vinci una partita dopo essere stato sotto di almeno 500 punti' },
  { id: 'schiacciante', e: '🧹', name: 'Vittoria schiacciante', desc: 'Vinci con almeno 1000 punti di vantaggio' },
  { id: 'difficile', e: '🤖', name: 'Più forte del computer', desc: 'Batti il computer al livello difficile' },
  { id: 'campione', e: '🏅', name: 'Campione', desc: 'Vinci un mini-torneo' },
  { id: 'amici', e: '🤝', name: 'Tra amici', desc: 'Finisci una partita al tavolo con un amico' },
  { id: 'sfida', e: '📅', name: 'Sfidante', desc: 'Completa una sfida del giorno' },
  { id: 'sfida_primo', e: '🌟', name: 'Re del giorno', desc: 'Primo nella sfida del giorno (almeno 3 partecipanti)' },
  { id: 'campione_lega', e: '🏟️', name: 'Campione del campionato', desc: 'Vinci una stagione di un campionato tra amici' },
  { id: 's40_vittoria', e: '🂡', name: 'Prima Scala 40', desc: 'Vinci una partita di Scala 40' },
  { id: 's40_apertura', e: '⚡', name: 'Apertura lampo', desc: 'Scala 40: apri al tuo primo turno' },
  { id: 's40_mano', e: '🎩', name: 'Chiusura in mano', desc: 'Scala 40: apri e chiudi nello stesso turno' },
  { id: 's40_jolly', e: '🃏', name: 'Ladro di jolly', desc: 'Scala 40: prendi un jolly dal tavolo' },
  { id: 'can_vittoria', e: '🎴', name: 'Prima Canasta', desc: 'Vinci una partita di Canasta' },
  { id: 'can_pulita', e: '💎', name: 'Canasta pulita', desc: 'Canasta: completa una canasta senza matte' },
  { id: 'can_rossi', e: '🔴', name: 'Quattro tre rossi', desc: 'Canasta: metti in tavola tutti e quattro i tre rossi' },
  { id: 'sc_vittoria', e: '🧹', name: 'Prima Scopa', desc: 'Vinci una partita di Scopa' },
  { id: 'sc_scope3', e: '💨', name: 'Spazzino', desc: 'Scopa: fai almeno 3 scope nella stessa smazzata' },
  { id: 'sc_cappotto', e: '🎯', name: 'Tutto mio', desc: 'Scopa: prendi carte, denari, settebello e primiera nella stessa smazzata' },
  { id: 'br_vittoria', e: '🍷', name: 'Prima Briscola', desc: 'Vinci una partita di Briscola' },
  { id: 'br_cento', e: '💪', name: 'Briscola da cento', desc: 'Briscola: fai almeno 100 punti in una smazzata' },
  { id: 'tr_vittoria', e: '🂱', name: 'Primo Tressette', desc: 'Vinci una partita di Tressette' },
  { id: 'tr_napoletana', e: '🌋', name: 'Napoletana', desc: 'Tressette: accusa una napoletana (Asso, Due e Tre dello stesso seme)' },
  { id: 'rb_vittoria', e: '🃁', name: 'Primo Rubamazzetto', desc: 'Vinci una partita di Rubamazzetto' },
  { id: 'sm_vittoria', e: '🎲', name: 'Primo Sette e mezzo', desc: 'Vinci una partita di Sette e mezzo' },
  { id: 'sm_reale', e: '👑', name: 'Sette e mezzo reale', desc: 'Sette e mezzo: fai 7 e mezzo con due sole carte' },
  { id: 'torneo', e: '🎖️', name: 'Campione di torneo', desc: 'Vinci un torneo a eliminazione' },
  { id: 'diplomato', e: '🎓', name: 'Diplomato', desc: 'Finisci la partita di allenamento' },
];
const BY_ID = new Map(LIST.map((t) => [t.id, t]));

/** Trofei legati a un contatore: sbloccati quando il contatore arriva all'obiettivo */
function fromStats(e) {
  return LIST.filter((t) => t.stat && (e[t.stat] || 0) >= t.goal).map((t) => t.id);
}

/** Trofei di una smazzata appena finita (mine = risultato della mia squadra), secondo il gioco */
function fromHand(mine, gid = 'burraco') {
  const out = [];
  if (gid === 'canasta') {
    if (mine.burraco.some((b) => b.kind === 'clean')) out.push('can_pulita');
    if (mine.pozPts >= 800) out.push('can_rossi');
    return out;
  }
  if (gid === 'scopa') {
    const d = mine.detail || {};
    if (d.scope >= 3) out.push('sc_scope3');
    if (d.carte && d.denari && d.settebello && d.primiera) out.push('sc_cappotto');
    return out;
  }
  if (gid === 'briscola') return mine.points >= 100 ? ['br_cento'] : [];
  if (gid === 'tressette') return mine.napoletana ? ['tr_napoletana'] : [];
  if (gid === 'settemezzo') return mine.reale ? ['sm_reale'] : [];
  if (gid === 'rubamazzetto') return [];
  const kinds = mine.burraco.map((b) => b.kind);
  if (kinds.includes('clean') || kinds.includes('real13') || kinds.includes('real14')) out.push('pulito');
  if (kinds.length >= 3) out.push('tris_burraco');
  if (kinds.includes('real13') || kinds.includes('real14')) out.push('reale');
  if (mine.total >= 1000) out.push('mille');
  return out;
}

/**
 * Trofei di fine partita per il posto `seat`.
 * ctx: { allBotsDifficile, tutorial, withFriend }
 */
function fromGame(g, seat, ctx) {
  const out = [];
  if (ctx.tutorial) out.push('diplomato');
  if (ctx.withFriend) out.push('amici');
  if (!g.winners.includes(seat)) return out;
  const myTeamIdx = g.teams.findIndex((t) => t.members.includes(seat));
  // andamento dei punteggi smazzata per smazzata: per la rimonta
  const cum = g.teams.map(() => 0);
  let worst = 0;
  for (const h of g.history.slice(0, -1)) {
    h.teams.forEach((t) => {
      const i = g.teams.findIndex((x) => x.members.some((s) => t.members.includes(s)));
      if (i >= 0) cum[i] += t.total;
    });
    const others = cum.filter((_, i) => i !== myTeamIdx);
    if (others.length) worst = Math.min(worst, cum[myTeamIdx] - Math.max(...others));
  }
  if (worst <= -500) out.push('rimonta');
  const myScore = g.scores[seat];
  const rivals = g.players.filter((p) => !g.teams[myTeamIdx].members.includes(p.seat)).map((p) => g.scores[p.seat]);
  if (rivals.length && rivals.every((s) => myScore - s >= 1000)) out.push('schiacciante');
  if (ctx.allBotsDifficile) out.push('difficile');
  const first = { scala40: 's40_vittoria', canasta: 'can_vittoria', scopa: 'sc_vittoria', briscola: 'br_vittoria', tressette: 'tr_vittoria', rubamazzetto: 'rb_vittoria', settemezzo: 'sm_vittoria' }[ctx.gid];
  if (first) out.push(first);
  return out;
}

/** Trofei di una smazzata di Scala 40, ricavati dalla moviola (le mosse registrate sono tutte valide) */
function fromScala40(replay, hr, seat) {
  const out = [];
  if (!replay) return out;
  let turn = 0, openTurn = 0;
  for (const x of replay.actions) {
    if (x.s !== seat) continue;
    if (x.a.type === 'draw' || x.a.type === 'takePile') turn++;
    if (!openTurn && (x.a.type === 'meld' || (x.a.type === 'takePile' && x.a.cardIds && x.a.cardIds.length))) openTurn = turn;
    if (x.a.type === 'swap') out.push('s40_jolly');
  }
  if (openTurn === 1) out.push('s40_apertura');
  if (hr && hr.reason === 'close' && hr.closer === seat && openTurn && openTurn === turn) out.push('s40_mano');
  return out;
}

/** Elenco per l'interfaccia: sbloccati (con data) e da sbloccare (con avanzamento) */
function view(e) {
  const got = (e && e.trophies) || {};
  return LIST.map((t) => ({
    id: t.id, e: t.e, name: t.name, desc: t.desc, at: got[t.id] || null,
    progress: t.stat && t.goal > 1 && !got[t.id] ? { now: Math.min((e && e[t.stat]) || 0, t.goal), goal: t.goal } : null,
  }));
}

module.exports = { LIST, BY_ID, fromStats, fromHand, fromGame, fromScala40, view };
