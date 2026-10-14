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
const SCO = require('../shared/scopa');
const BRI = require('../shared/briscola');
const TRE = require('../shared/tressette');
const RUB = require('../shared/rubamazzetto');
const SEM = require('../shared/settemezzo');

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
  scopa: {
    id: 'scopa', name: 'Scopa',
    E: require('./scopa'), Bot: require('./scopa-bot'),
    normalize: (r) => SCO.normalize(r),
    presetOf: (r) => SCO.presetOf(r),
  },
  briscola: {
    id: 'briscola', name: 'Briscola',
    E: require('./briscola'), Bot: require('./briscola-bot'),
    normalize: (r) => BRI.normalize(r),
    presetOf: () => 'briscola',
  },
  tressette: {
    id: 'tressette', name: 'Tressette',
    E: require('./tressette'), Bot: require('./tressette-bot'),
    normalize: (r) => TRE.normalize(r),
    presetOf: () => 'tressette',
  },
  rubamazzetto: {
    id: 'rubamazzetto', name: 'Rubamazzetto',
    E: require('./rubamazzetto'), Bot: require('./rubamazzetto-bot'),
    normalize: (r) => RUB.normalize(r),
    presetOf: () => 'rubamazzetto',
  },
  settemezzo: {
    id: 'settemezzo', name: 'Sette e mezzo',
    E: require('./settemezzo'), Bot: require('./settemezzo-bot'),
    normalize: (r) => SEM.normalize(r),
    presetOf: () => 'settemezzo',
  },
};

const idOf = (rules) => (rules && GAMES[rules.game] ? rules.game : 'burraco');
const of = (rulesOrRoom) => GAMES[idOf(rulesOrRoom && rulesOrRoom.rules ? rulesOrRoom.rules : rulesOrRoom)];

module.exports = { GAMES, of, idOf };
