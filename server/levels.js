'use strict';
/*
 * Livello del giocatore: si calcola dalle statistiche già salvate (niente dati in più).
 * Esperienza: 50 a partita, +50 se vinta, 5 a smazzata, 10 a burraco, 15 a chiusura, 30 a trofeo.
 * Per passare dal livello L al successivo servono L × 100 punti esperienza (100, 200, 300…).
 */
function xpOf(e) {
  if (!e) return 0;
  return (e.games || 0) * 50 + (e.wins || 0) * 50 + (e.hands || 0) * 5 + (e.burraco || 0) * 10
    + (e.closures || 0) * 15 + Object.keys(e.trophies || {}).length * 30;
}

/** { level, xp, into, need }: livello, esperienza totale, avanzamento nel livello e quanto serve per il prossimo */
function levelOf(e) {
  const xp = xpOf(e);
  let level = 1, base = 0;
  while (xp >= base + level * 100) { base += level * 100; level++; }
  return { level, xp, into: xp - base, need: level * 100 };
}

module.exports = { xpOf, levelOf };
