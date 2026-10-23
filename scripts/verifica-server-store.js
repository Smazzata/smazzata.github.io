'use strict';
// Diagnostica locale in sola lettura. Nessuna chiave, account o contenuto backup nell'output.
// Eseguire nel Termux del server: node scripts/verifica-server-store.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
function stat(file) {
  try { const s = fs.lstatSync(file); return { present: true, symlink: s.isSymbolicLink(), mode: (s.mode & 0o777).toString(8), bytes: s.size, modified: s.mtime.toISOString() }; }
  catch (e) { return { present: false, error: e.code === 'ENOENT' ? 'absent' : 'unreadable' }; }
}
let processInfo = { verified: false };
let runtimeEnv = null;
try {
  const pid = fs.readFileSync(path.join(os.homedir(), '.burraco-server.pid'), 'utf8').trim();
  if (!/^\d+$/.test(pid)) throw new Error('pid');
  const cwd = fs.realpathSync(`/proc/${pid}/cwd`);
  const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
  if (cwd !== fs.realpathSync(root) || !cmd.some(x => /(^|\/)server\/index\.js$/.test(x))) throw new Error('process');
  runtimeEnv = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
  processInfo = { verified: true, admin_env_override: !!runtimeEnv.ADMIN_KEY, backup_env_present: !!runtimeEnv.BACKUP_PASSPHRASE, mail_test: runtimeEnv.MAIL_TEST === '1' };
} catch (_) { /* Non dedurre l'ambiente del server da quello del terminale. */ }
const env = runtimeEnv || process.env;
const data = path.resolve(root, env.DATA_DIR || 'data');
const backups = [];
try {
  const dir = path.join(data, 'backups');
  if (!fs.lstatSync(dir).isSymbolicLink()) for (const name of fs.readdirSync(dir)) {
    if (!/^backup-[\w.:-]+\.json$/.test(name)) continue;
    const s = stat(path.join(dir, name));
    backups.push({ ...s, older_than_7_days: s.modified ? Date.now() - Date.parse(s.modified) > 7 * 86400000 : null });
  }
} catch (_) { /* Assenza/inaccessibilità segnalata separatamente. */ }
let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_) {}
console.log(JSON.stringify({
  checked_at: new Date().toISOString(), platform: process.platform, checkout_commit: commit,
  process: processInfo, source: runtimeEnv ? 'ambiente processo verificato' : 'ambiente terminale: NON prova la configurazione del server',
  admin_file: stat(path.join(data, 'admin-key.txt')),
  backup_pass_file: stat(path.join(os.homedir(), '.burraco-backup-pass')),
  mail_file: stat(env.MAIL_FILE || path.join(os.homedir(), '.burraco-mail')),
  backup_directory: stat(path.join(data, 'backups')), backups,
  limits: 'Metadati soltanto. Il commit del checkout non prova la versione in memoria. Non verifica contratti, validità crittografica, assenza di uploader storici o revoca della chiave. Nessuna modifica eseguita.'
}, null, 2));
