'use strict';
// Nomi dei giocatori-computer: nomi comuni, pescati a caso (stessa lista in public/local-server.js).

const NOMI_COMPUTER = [
  'Marco', 'Luca', 'Giulia', 'Francesca', 'Andrea', 'Sara', 'Matteo', 'Chiara', 'Paolo', 'Elena',
  'Davide', 'Laura', 'Stefano', 'Valentina', 'Roberto', 'Martina', 'Simone', 'Federica', 'Alessandro', 'Silvia',
  'Giorgio', 'Anna', 'Fabio', 'Alessia', 'Riccardo', 'Paola', 'Daniele', 'Serena', 'Claudio', 'Monica',
  'Lorenzo', 'Elisa', 'Michele', 'Roberta', 'Massimo', 'Cristina', 'Emanuele', 'Ilaria', 'Filippo', 'Marta',
];

// Un nome a caso tra quelli non ancora usati.
function nomeComputer(usati = []) {
  const presi = new Set(usati);
  const liberi = NOMI_COMPUTER.filter((n) => !presi.has(n));
  return liberi.length ? liberi[Math.floor(Math.random() * liberi.length)] : 'Computer ' + Math.floor(Math.random() * 100);
}

module.exports = { NOMI_COMPUTER, nomeComputer };
