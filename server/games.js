'use strict';
/*
 * Registro dei giochi: per ogni gioco motore (E), computer (Bot) e regole.
 * Il server sceglie il gioco dalle regole del tavolo (rules.game; senza = Burraco).
 * Per aggiungere un gioco: un motore con la stessa interfaccia (createGame, apply, isLegal, viewFor,
 * nextHand, surrender, teamOf, note), un computer (nextAction, thinkMs) e le regole (normalize, preset).
 */
const Rules = require('../shared/rules');
const S40 = require('../shared/scala40');
const CAN = require('../shared/canasta');

const GAMES = {
  burraco: {
    id: 'burraco', name: 'Burraco',
    E: require('./engine'), Bot: require('./bot'),
    normalize: (r) => Rules.normalize(r),
    presetOf: (r) => Rules.matchPreset(r),
  },
  scala40: {
    id: 'scala40', name: 'Scala 40',
    E: require('./scala40'), Bot: require('./scala40-bot'),
    normalize: (r) => S40.normalize(r),
    presetOf: () => 'scala40',
  },
  canasta: {
    id: 'canasta', name: 'Canasta',
    E: require('./canasta'), Bot: require('./canasta-bot'),
    normalize: (r) => CAN.normalize(r),
    presetOf: () => 'canasta',
  },
};

const idOf = (rules) => (rules && GAMES[rules.game] ? rules.game : 'burraco');
const of = (rulesOrRoom) => GAMES[idOf(rulesOrRoom && rulesOrRoom.rules ? rulesOrRoom.rules : rulesOrRoom)];

module.exports = { GAMES, of, idOf };
