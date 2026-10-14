'use strict';
/*
 * Backup cifrato dei dati del server (profili, amici, classifica, tavoli).
 * La cifratura usa una frase segreta scelta dall'utente (scrypt + AES-256-GCM),
 * così il backup si può ripristinare anche se il server va perso.
 *
 *   node scripts/backup.js crea  <data/stato.json> <file-backup>  (legge data/burraco.db se c'è; frase in BACKUP_PASSPHRASE o ~/.burraco-backup-pass)
 *   node scripts/backup.js ripristina <file-backup> <file-dati>
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MAGIC = 'BURRACO-BACKUP-1';

function passphrase() {
  if (process.env.BACKUP_PASSPHRASE) return process.env.BACKUP_PASSPHRASE;
  const f = path.join(os.homedir(), '.burraco-backup-pass');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  throw new Error('Frase segreta del backup mancante (BACKUP_PASSPHRASE o ~/.burraco-backup-pass)');
}

function keyFrom(pass, salt) {
  return crypto.scryptSync(pass, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function encrypt(plain, pass) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keyFrom(pass, salt), iv);
  const data = Buffer.concat([c.update(plain), c.final()]);
  return JSON.stringify({
    formato: MAGIC, creato: new Date().toISOString(),
    salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'),
    dati: data.toString('base64'),
  });
}

function decrypt(text, pass) {
  const b = JSON.parse(text);
  if (b.formato !== MAGIC) throw new Error('File di backup non riconosciuto');
  const d = crypto.createDecipheriv('aes-256-gcm', keyFrom(pass, Buffer.from(b.salt, 'base64')), Buffer.from(b.iv, 'base64'));
  d.setAuthTag(Buffer.from(b.tag, 'base64'));
  try {
    return Buffer.concat([d.update(Buffer.from(b.dati, 'base64')), d.final()]);
  } catch (e) {
    throw new Error('Frase segreta sbagliata o backup danneggiato');
  }
}

module.exports = { encrypt, decrypt };

if (require.main === module) {
  const [cmd, from, to] = process.argv.slice(2);
  try {
    if (cmd === 'crea') {
      // dati dal database (se c'è) o da stato.json, nello stesso formato
      const plain = Buffer.from(JSON.stringify(require('../server/store').exportData(path.dirname(from))));
      fs.writeFileSync(to, encrypt(plain, passphrase()));
      console.log(`Backup cifrato creato: ${to} (${plain.length} byte di dati)`);
    } else if (cmd === 'ripristina') {
      const plain = decrypt(fs.readFileSync(from, 'utf8'), passphrase());
      JSON.parse(plain);
      if (fs.existsSync(to)) fs.copyFileSync(to, to + '.prima-del-ripristino');
      fs.writeFileSync(to, plain);
      console.log(`Dati ripristinati in ${to}`);
    } else {
      console.log('Uso: node scripts/backup.js crea <dati> <backup> | ripristina <backup> <dati>');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('Errore:', e.message);
    process.exitCode = 1;
  }
}
