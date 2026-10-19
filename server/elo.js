'use strict';
/*
 * Punteggio di bravura (Elo) per ogni gioco: si parte da 1000, sale battendo avversari forti e scende perdendo
 * contro avversari deboli. Il computer ha un punteggio fisso secondo il livello. Nelle partite a coppie conta la
 * media della coppia; con più squadre (Scala 40, Rubamazzetto…) ogni squadra si confronta con tutte le altre.
 *
 * Solo le partite CLASSIFICATE cambiano l'Elo: «Gioca subito» tra sole persone (avversari scelti dal server per
 * punteggio, non dagli amici). Tutte le altre sono AMICHEVOLI (tavoli creati a mano o con gli amici, computer,
 * tutorial, sfida del giorno, tornei, partite sul telefono): contano per statistiche, livello e trofei, non per l'Elo.
 * Per ogni gioco si tengono elo, eloMax e rankedGames/rankedWins: le future leghe (Bronzo → Leggenda) si
 * calcoleranno da questi valori.
 */
const START = 1000;
const BOT_RATING = { facile: 800, normale: 1000, difficile: 1200, esperto: 1350 };

/** La partita a questo tavolo è classificata (cambia l'Elo)? Il creatore non può sceglierlo: tra amici si potrebbe
 *  perdere apposta per far salire qualcuno. Se nel tavolo veloce entra anche un solo computer, diventa amichevole.
 *  Si decide all'avvio (room.rankedGame): chi abbandona a metà non la rende amichevole, e per lui conta come persa. */
function isRanked(room) {
  if (!room || !room.quick || room.queueMode === 'casual' || room.tutorial || room.daily || room.tournament || room.localGame) return false;
  if (room.game) return !!room.rankedGame;
  return room.seats.every((s) => !s || (!s.isBot && s.token));
}

const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

/**
 * Variazioni di punteggio a fine partita.
 * seats: per ogni posto { human: bool, rating, games } (games = partite classificate già giocate a questo gioco, per il fattore K)
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

module.exports = { START, BOT_RATING, deltas, expected, isRanked };
