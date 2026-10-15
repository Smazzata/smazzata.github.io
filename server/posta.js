'use strict';
/*
 * Email del gioco (codici di verifica, recupero password, avvisi) tramite un Gmail dedicato.
 * Credenziali in ~/.burraco-mail (due righe: indirizzo Gmail e "password per le app"), scritte sul telefono-server
 * con `bash scripts/android-server.sh --set-mail`. Senza file le funzioni email sono spente.
 * Con MAIL_TEST=1 (prove automatiche) le email non partono: finiscono in DATA_DIR/posta-inviata.jsonl.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DATA_DIR } = require('./config');

const FILE = process.env.MAIL_FILE || path.join(os.homedir(), '.burraco-mail');
let cache = null;

function config() {
  if (process.env.MAIL_TEST === '1') return { test: true, user: 'smazzata@prova.invalid' };
  if (cache && Date.now() - cache.at < 60000) return cache.cfg;
  let cfg = null;
  try {
    const [user, pass] = fs.readFileSync(FILE, 'utf8').split(/\r?\n/).map((x) => x.trim());
    if (user && pass) cfg = { user, pass: pass.replace(/\s+/g, '') };
  } catch (e) { /* niente email */ }
  cache = { at: Date.now(), cfg };
  return cfg;
}

const enabled = () => !!config();

let transport = null, transportUser = null;
async function send(to, subject, text) {
  const cfg = config();
  if (!cfg) throw new Error('Email non configurate sul server');
  if (cfg.test) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(path.join(DATA_DIR, 'posta-inviata.jsonl'), JSON.stringify({ to, subject, text, at: Date.now() }) + '\n');
    return;
  }
  if (!transport || transportUser !== cfg.user) {
    transport = require('nodemailer').createTransport({ service: 'gmail', auth: { user: cfg.user, pass: cfg.pass } });
    transportUser = cfg.user;
  }
  await transport.sendMail({ from: `"Smazzata" <${cfg.user}>`, to, subject, text });
}

const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const validEmail = (e) => EMAIL_RE.test(String(e || ''));

module.exports = { send, enabled, validEmail };
