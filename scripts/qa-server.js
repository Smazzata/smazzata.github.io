'use strict';
// Server di prova per le verifiche a mano: porta 3100, dati in una cartella temporanea, computer veloci.
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.PORT = process.env.PORT || '3100';
process.env.DATA_DIR = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-qa-'));
process.env.BOT_DELAY = process.env.BOT_DELAY || '250';
require('../server/index.js');
