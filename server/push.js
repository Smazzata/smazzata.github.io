'use strict';
/*
 * Notifiche push (Web Push, gratuite): arrivano anche con il gioco chiuso, sui browser che le supportano
 * (Chrome/Edge/Firefox su Android e computer, Safari su iPhone se il gioco è aggiunto alla Home).
 * Le chiavi VAPID si creano una volta e restano in DATA_DIR/vapid.json.
 * Le iscrizioni stanno nella sessione del giocatore (sess.push, al massimo 3 dispositivi).
 */
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

module.exports = function createPush({ dataDir, sessions, contact }) {
  const file = path.join(dataDir, 'vapid.json');
  let keys;
  try { keys = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    keys = webpush.generateVAPIDKeys();
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(keys));
  }
  webpush.setVapidDetails(contact, keys.publicKey, keys.privateKey);

  function subscribe(token, sub) {
    const sess = sessions.get(token);
    if (!sess) throw new Error('Sessione sconosciuta');
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      throw new Error('Iscrizione alle notifiche non valida');
    }
    const clean = { endpoint: sub.endpoint.slice(0, 1000), keys: { p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) } };
    sess.push = [clean, ...(sess.push || []).filter((s) => s.endpoint !== clean.endpoint)].slice(0, 3);
  }

  function unsubscribe(token, endpoint) {
    const sess = sessions.get(token);
    if (sess && sess.push) sess.push = sess.push.filter((s) => s.endpoint !== endpoint);
  }

  /** Invia a tutti i dispositivi del giocatore; le iscrizioni scadute (404/410) si cancellano */
  async function send(token, payload) {
    const sess = sessions.get(token);
    if (!sess || !sess.push || !sess.push.length) return 0;
    let sent = 0;
    await Promise.all(sess.push.map(async (sub) => {
      try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600 * 12 }); sent++; } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) unsubscribe(token, sub.endpoint);
      }
    }));
    return sent;
  }

  return { publicKey: keys.publicKey, subscribe, unsubscribe, send };
};
