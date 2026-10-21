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

/** Copie cifrate private, mai committate: intervallo 6 ore, scadenza per età. */
function localBackup(dataDir, now = Date.now()) {
  const { cleanCopies, privateCopies } = require('../server/privacy');
  cleanCopies(dataDir, { now });
  let pass;
  try { pass = passphrase(); } catch (e) { return { enabled: false }; }
  if (pass.length < 12) throw new Error('Frase del backup troppo corta (almeno 12 caratteri)');
  const dir = path.join(dataDir, 'backups');
  if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('La cartella dei backup non può essere un collegamento');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const latest = privateCopies(dataDir).filter((f) => path.dirname(f) === dir).reduce((n, f) => Math.max(n, fs.statSync(f).mtimeMs), 0);
  if (latest && now - latest < 6 * 60 * 60 * 1000) return { enabled: true, created: false };
  const data = require('../server/store').exportData(dataDir);
  if (!data || !data.savedAt) return { enabled: true, created: false };
  const dest = path.join(dir, `backup-${new Date(now).toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(dest, encrypt(Buffer.from(JSON.stringify(data)), pass), { mode: 0o600, flag: 'wx' });
  return { enabled: true, created: true };
}

module.exports = { encrypt, decrypt, localBackup };

/** se la frase non è salvata, la si chiede a chi usa il terminale (senza mostrarla mentre si scrive) */
function askPassphrase() {
  try { return Promise.resolve(passphrase()); } catch (e) { if (!process.stdin.isTTY) throw e; }
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    rl.question('Frase segreta del backup: ', (p) => { rl.close(); console.log(); resolve(p.trim()); });
    rl._writeToOutput = (str) => { if (/Frase segreta/.test(str)) process.stdout.write(str); };
  });
}

if (require.main === module) {
  const [cmd, from, to] = process.argv.slice(2);
  (async () => {
    if (cmd === 'crea') {
      // Blocca anche i vecchi processi Termux che tentano ancora di caricare copie su GitHub.
      const allowed = path.resolve(path.dirname(from), 'backups');
      if (path.dirname(path.resolve(to)) !== allowed || (fs.existsSync(allowed) && fs.lstatSync(allowed).isSymbolicLink())) {
        throw new Error('I backup devono restare nella cartella privata data/backups; caricamento GitHub disattivato');
      }
      fs.mkdirSync(allowed, { recursive: true, mode: 0o700 });
      // dati dal database (se c'è) o da stato.json, nello stesso formato
      const plain = Buffer.from(JSON.stringify(require('../server/store').exportData(path.dirname(from))));
      const pass = await askPassphrase();
      if (pass.length < 12) throw new Error('Frase troppo corta (almeno 12 caratteri)');
      fs.writeFileSync(to, encrypt(plain, pass), { mode: 0o600 });
      console.log(`Backup cifrato creato: ${to} (${plain.length} byte di dati)`);
    } else if (cmd === 'ripristina') {
      const plain = decrypt(fs.readFileSync(from, 'utf8'), await askPassphrase());
      JSON.parse(plain);
      // Non accumulare un'altra copia in chiaro senza scadenza.
      fs.writeFileSync(to, plain, { mode: 0o600 });
      console.log(`Dati ripristinati in ${to}`);
    } else {
      console.log('Uso: node scripts/backup.js crea <dati> <backup> | ripristina <backup> <dati>');
      process.exitCode = 1;
    }
  })().catch((e) => {
    console.error('Errore:', e.message);
    process.exitCode = 1;
  });
}
