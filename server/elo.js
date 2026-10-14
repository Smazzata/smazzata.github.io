'use strict';
/*
 * Punteggio di bravura (Elo) per ogni gioco: si parte da 1000, sale battendo avversari forti e scende perdendo
 * contro avversari deboli. Il computer ha un punteggio fisso secondo il livello. Nelle partite a coppie conta la
 * media della coppia; con più squadre (Scala 40, Rubamazzetto…) ogni squadra si confronta con tutte le altre.
 */
const START = 1000;
const BOT_RATING = { facile: 800, normale: 1000, difficile: 1200, esperto: 1350 };

const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

/**
 * Variazioni di punteggio a fine partita.
 * seats: per ogni posto { human: bool, rating, games } (games = partite già giocate a questo gioco, per il fattore K)
 * teams: elenco di squadre (posti), winners: posti vincitori.
 * Restituisce per ogni posto la variazione (0 per il computer).
 */
function deltas(seats, teams, winners) {
  const rating = (t) => t.reduce((a, s) => a + seats[s].rating, 0) / t.length;
  const won = (t) => t.some((s) => winners.includes(s));
  const out = seats.map(() => 0);
  if (teams.length < 2) return out;
  teams.forEach((ta) => {
    let sum = 0;
    for (const tb of teams) {
      if (tb === ta) continue;
      const score = won(ta) === won(tb) ? 0.5 : won(ta) ? 1 : 0;
      sum += score - expected(rating(ta), rating(tb));
    }
    for (const s of ta) {
      if (!seats[s].human) continue;
      const k = seats[s].games < 10 ? 40 : 24; // all'inizio il punteggio si assesta più in fretta
      out[s] = Math.round((k * sum) / (teams.length - 1));
    }
  });
  return out;
}

module.exports = { START, BOT_RATING, deltas, expected };
