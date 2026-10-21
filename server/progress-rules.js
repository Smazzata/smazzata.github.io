'use strict';

// I bot aggiunti prima dell'avvio rendono il tavolo un allenamento.
// Una sostituzione dopo l'abbandono di una persona non annulla una partita umana.
module.exports = function countsForProgress(room) {
  return !!room && !room.localGame && !room.tutorial && room.progressEligible !== false
    && (room.seats || []).every((s) => s && (!s.isBot || !!s.leftToken));
};
