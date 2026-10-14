'use strict';
/*
 * Contesto condiviso dai moduli del server: lo stato in memoria (sessioni, tavoli, classifica…)
 * e le funzioni che ogni modulo registra qui con Object.assign(ctx, {...}).
 * I moduli chiamano le funzioni degli altri attraverso il contesto, così possono richiamarsi a vicenda.
 */
module.exports = {
  io: null, // Socket.IO, impostato da index.js prima di caricare gli altri moduli
  /* sessions: token -> { name, room, nick, code, pw, friends, reqIn, reqOut } */
  sessions: new Map(),
  /* rooms: codice -> tavolo */
  rooms: new Map(),
  /* classifica: token -> statistiche (solo giocatori umani) */
  leaderboard: new Map(),
  /* sfida del giorno: data -> { token: { name, score, at } } (score null = partita in corso o abbandonata) */
  daily: new Map(),
  /* campionati tra amici: id -> { name, owner, period, members, seasonStart, standings, past } */
  leagues: new Map(),
  /* tornei a eliminazione: id -> torneo */
  tournaments: new Map(),
  /* segnalazioni dei giocatori (le più recenti per prime), visibili nella pagina di stato */
  reports: [],
};
