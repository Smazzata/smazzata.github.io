'use strict';
/*
 * Sfida del giorno: una smazzata secca contro il computer difficile, con le stesse carte per tutti
 * (mazzo mescolato con un "seme" ricavato dalla data) e una variante di regole che cambia ogni giorno.
 * Un solo tentativo al giorno; i punti della smazzata vanno nella classifica del giorno.
 * Le varianti girano tra tutti i giochi (Burraco, Scala 40, Canasta, Scopa, Briscola).
 */
const Rules = require('../shared/rules');
const Games = require('./games');

const VARIANTS = [
  { title: 'Burraco Classico', preset: 'classico' },
  { title: 'Burraco Reale', preset: 'reale' },
  { title: 'Classico solo scale', preset: 'classico', tweak: { allowSets: false } },
  { title: 'Buraco Brasiliano Aberto', preset: 'aberto' },
  { title: 'Classico con scarti chiusi', preset: 'classico', tweak: { pile: 'closed' } },
  { title: 'Buraco Brasiliano Fechado', preset: 'fechado' },
  { title: 'Classico, Asso alto e basso', preset: 'classico', tweak: { aceBothEnds: true } },
  { title: 'Scala 40', game: 'scala40' },
  { title: 'Canasta', game: 'canasta' },
  { title: 'Ramino', game: 'ramino' },
  { title: 'Scopa', game: 'scopa' },
  { title: 'Briscola', game: 'briscola' },
  { title: 'Tressette a due', game: 'tressette', tweak: { target: 21 } },
  { title: 'Rubamazzetto', game: 'rubamazzetto' },
  { title: 'Scopa, Asso piglia tutto', game: 'scopa', tweak: { aceTakesAll: true } },
  { title: 'Scopone scientifico', game: 'scopa', tweak: { deal: 10, napola: true, target: 21 }, players: 4 },
].filter((v) => Games.enabled(v.game || 'burraco'));

/** Data di oggi in Italia, es. "2026-10-14" */
function todayKey(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** La sfida di una data: titolo, regole (2 giocatori) e seme del mazzo */
function challenge(date = todayKey()) {
  const day = Math.floor(Date.parse(date + 'T12:00:00Z') / 86400000);
  const v = VARIANTS[((day % VARIANTS.length) + VARIANTS.length) % VARIANTS.length];
  const rules = v.game ? Games.of({ game: v.game }).normalize({ ...(v.tweak || {}), game: v.game, players: v.players || 2 })
    : Rules.normalize({ ...Rules.PRESETS.find((p) => p.id === v.preset).rules, ...(v.tweak || {}), players: 2 });
  return { date, title: v.title, rules, seed: hash('burraco-' + date) };
}

module.exports = { VARIANTS, todayKey, challenge };
