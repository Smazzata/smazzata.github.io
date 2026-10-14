'use strict';
/* Impostazioni del server (dalle variabili d'ambiente, con i valori di tutti i giorni) */
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  BOT_DELAY: Number(process.env.BOT_DELAY || 700),
  // solo per i test automatici: accelera il timer del turno (es. 0.02 = 50 volte più veloce)
  TIMER_SCALE: Number(process.env.TIMER_SCALE || 1),
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  // pagina d'ingresso fissa: le notifiche aprono il gioco da qui (l'indirizzo del server cambia)
  HOME_URL: process.env.HOME_URL || 'https://simonemuliello010500-web.github.io/BurracoByMSF/',
};
module.exports.BOT_SPEEDS = { lenta: module.exports.BOT_DELAY * 1.9, normale: module.exports.BOT_DELAY, veloce: module.exports.BOT_DELAY * 0.45 };
