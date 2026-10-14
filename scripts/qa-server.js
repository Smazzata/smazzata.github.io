'use strict';
// Server di prova per le verifiche a mano: porta 3100, dati in una cartella temporanea, computer veloci.
const os = require('os');
const path = require('path');
process.env.PORT = process.env.PORT || '3100';
// cartella fissa: i riavvii conservano profili e tavoli di prova
process.env.DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'burraco-qa');
process.env.BOT_DELAY = process.env.BOT_DELAY || '250';
require('../server/index.js');
