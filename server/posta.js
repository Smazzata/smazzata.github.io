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

/*
 * Testi delle email nelle 4 lingue dell'app ({nick} e {code} si sostituiscono). La lingua è quella che il
 * dispositivo ha comunicato al server (sess.lang); senza, italiano.
 */
const TEXTS = {
  verify: {
    it: ['Smazzata: il tuo codice è {code}', 'Ciao {nick},\n\nil codice per confermare la tua email è: {code}\n\nScade tra 15 minuti. Se non hai chiesto tu questo codice, ignora questa email.'],
    en: ['Smazzata: your code is {code}', 'Hi {nick},\n\nthe code to confirm your email is: {code}\n\nIt expires in 15 minutes. If you did not ask for this code, ignore this email.'],
    es: ['Smazzata: tu código es {code}', 'Hola {nick}:\n\nel código para confirmar tu email es: {code}\n\nCaduca en 15 minutos. Si no has pedido este código, ignora este email.'],
    pt: ['Smazzata: seu código é {code}', 'Olá {nick},\n\no código para confirmar seu email é: {code}\n\nExpira em 15 minutos. Se você não pediu este código, ignore este email.'],
  },
  signup: {
    it: ['Smazzata: il tuo codice è {code}', 'Ciao {nick},\n\nil codice per creare il tuo profilo è: {code}\n\nScade tra 15 minuti. Se non hai chiesto tu questo codice, ignora questa email.'],
    en: ['Smazzata: your code is {code}', 'Hi {nick},\n\nthe code to create your profile is: {code}\n\nIt expires in 15 minutes. If you did not ask for this code, ignore this email.'],
    es: ['Smazzata: tu código es {code}', 'Hola {nick}:\n\nel código para crear tu perfil es: {code}\n\nCaduca en 15 minutos. Si no has pedido este código, ignora este email.'],
    pt: ['Smazzata: seu código é {code}', 'Olá {nick},\n\no código para criar seu perfil é: {code}\n\nExpira em 15 minutos. Se você não pediu este código, ignore este email.'],
  },
  reset: {
    it: ['Smazzata: codice per la nuova password {code}', "Ciao {nick},\n\nil codice per scegliere una nuova password è: {code}\n\nScade tra 15 minuti. Se non l'hai chiesto tu, ignora questa email: la tua password resta quella di prima."],
    en: ['Smazzata: code for your new password {code}', 'Hi {nick},\n\nthe code to choose a new password is: {code}\n\nIt expires in 15 minutes. If you did not ask for it, ignore this email: your password stays the same.'],
    es: ['Smazzata: código para la nueva contraseña {code}', 'Hola {nick}:\n\nel código para elegir una nueva contraseña es: {code}\n\nCaduca en 15 minutos. Si no lo has pedido, ignora este email: tu contraseña sigue siendo la misma.'],
    pt: ['Smazzata: código para a nova senha {code}', 'Olá {nick},\n\no código para escolher uma nova senha é: {code}\n\nExpira em 15 minutos. Se você não pediu, ignore este email: sua senha continua a mesma.'],
  },
  changedInside: {
    it: ['Smazzata: password cambiata', "Ciao {nick},\n\nla password del tuo profilo è stata cambiata e gli altri dispositivi sono stati scollegati.\nSe non sei stato tu, usa «Password dimenticata?» nell'app."],
    en: ['Smazzata: password changed', 'Hi {nick},\n\nyour profile password was changed and your other devices were signed out.\nIf it was not you, use «Forgot your password?» in the app.'],
    es: ['Smazzata: contraseña cambiada', 'Hola {nick}:\n\nla contraseña de tu perfil ha cambiado y se ha cerrado la sesión en tus otros dispositivos.\nSi no has sido tú, usa «¿Olvidaste la contraseña?» en la app.'],
    pt: ['Smazzata: senha alterada', 'Olá {nick},\n\na senha do seu perfil foi alterada e seus outros dispositivos foram desconectados.\nSe não foi você, use «Esqueceu a senha?» no app.'],
  },
  changedByCode: {
    it: ['Smazzata: password cambiata', 'Ciao {nick},\n\nla password del tuo profilo è stata cambiata con il codice di recupero.\nSe non sei stato tu, cambiala subito con il codice di recupero e genera un codice nuovo (👤 Profilo).'],
    en: ['Smazzata: password changed', 'Hi {nick},\n\nyour profile password was changed with the recovery code.\nIf it was not you, change it right away with the recovery code and create a new code (👤 Profile).'],
    es: ['Smazzata: contraseña cambiada', 'Hola {nick}:\n\nla contraseña de tu perfil se ha cambiado con el código de recuperación.\nSi no has sido tú, cámbiala enseguida con el código de recuperación y genera un código nuevo (👤 Perfil).'],
    pt: ['Smazzata: senha alterada', 'Olá {nick},\n\na senha do seu perfil foi alterada com o código de recuperação.\nSe não foi você, altere-a imediatamente com o código de recuperação e gere um novo código (👤 Perfil).'],
  },
  changedByEmail: {
    it: ['Smazzata: password cambiata', 'Ciao {nick},\n\nla password del tuo profilo è stata cambiata (con il codice ricevuto via email).\nSe non sei stato tu, rispondi a questa email.'],
    en: ['Smazzata: password changed', 'Hi {nick},\n\nyour profile password was changed (with the code received by email).\nIf it was not you, reply to this email.'],
    es: ['Smazzata: contraseña cambiada', 'Hola {nick}:\n\nla contraseña de tu perfil se ha cambiado (con el código recibido por email).\nSi no has sido tú, responde a este email.'],
    pt: ['Smazzata: senha alterada', 'Olá {nick},\n\na senha do seu perfil foi alterada (com o código recebido por email).\nSe não foi você, responda a este email.'],
  },
};
/** { subject, text } di un'email nella lingua indicata */
function compose(kind, lang, vars) {
  const t = TEXTS[kind][lang] || TEXTS[kind].it;
  const fill = (x) => x.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  return { subject: fill(t[0]), text: fill(t[1]) + '\n\n— Smazzata' };
}
const LANGS = ['it', 'en', 'es', 'pt'];

const EMAIL_RE = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const validEmail = (e) => EMAIL_RE.test(String(e || ''));

module.exports = { send, enabled, validEmail, compose, LANGS };
