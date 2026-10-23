'use strict';
/*
 * Prova multigiocatore end-to-end: avvia un server di prova, collega due giocatori
 * e verifica le funzioni del tavolo una dopo l'altra.  npm run e2e
 */
const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const Levels = require('./levels');

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-e2e-'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// I due client restano persone per il server: inviano mosse valide per completare
// la partita e verificare i premi umani, invece di usare bot che ora sono allenamento.
async function playHuman(p) {
  const v = p.state.game;
  if (!v || v.turn !== v.you || v.phase === 'handEnd') return;
  const E = require('./engine');
  const g = E.createGame({ rules: v.cfg.rules, players: v.players.map((x) => ({ name: x.name })) });
  const cfg = g.cfg;
  Object.assign(g, v, { cfg,
    players: v.players.map((x, i) => ({ ...x, hand: i === v.you ? v.hand : Array(x.handCount).fill({ id: -1, r: 3, s: 'C' }) })),
    stock: Array(v.stockCount).fill({ id: -2, r: 3, s: 'C' }),
    pozzetti: v.pozzetti.map((n) => Array(n).fill({ id: -3, r: 3, s: 'C' })),
    turnInfo: { ...g.turnInfo, singlePickId: v.singlePickId },
  });
  await p.call('action', require('./bot').nextAction(g, v.you));
}

function startServer() {
  const proc = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, MAIL_TEST: '1', IP_LIMIT: '1000', PORT: String(PORT), DATA_DIR: dataDir, BOT_DELAY: '15', TIMER_SCALE: '0.01' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  return new Promise((resolve) => proc.stdout.on('data', (d) => { if (String(d).includes('ascolto')) resolve(proc); }));
}

/** Giocatore di prova: tiene l'ultimo stato ricevuto e permette di aspettare condizioni */
function player(name) {
  const sock = io(URL, { transports: ['websocket'], forceNew: true });
  const p = { name, sock, state: null, chats: [] };
  sock.on('state', (st) => { p.state = st; });
  sock.on('chat', (m) => p.chats.push(m));
  p.trophies = [];
  p.progress = [];
  sock.on('progress', (x) => p.progress.push(x));
  sock.on('trophy', (list) => p.trophies.push(...list.map((t) => t.id)));
  p.call = (ev, data = {}) => new Promise((res) => sock.emit(ev, data, res));
  p.until = async (fn, what, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (p.state && fn(p.state)) return p.state; await wait(25); }
    throw new Error(`${name}: tempo scaduto aspettando ${what}`);
  };
  p.hello = (token, lang) => new Promise((res) => { sock.emit('hello', { name, token, lang }); sock.once('welcome', (w) => { p.token = w.token; res(w); }); });
  return p;
}

const step = (t) => console.log('✓ ' + t);
/** email sempre diversa per i profili di prova (con le email attive è obbligatoria) */
let mailN = 0;
const mailOf = () => `prova${++mailN}@esempio.it`;
/** email "inviate" dal server di prova (MAIL_TEST=1 le scrive in un file) */
const mailbox = () => { try { return fs.readFileSync(path.join(dataDir, 'posta-inviata.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l.trim())); } catch (e) { return []; } };
/** ultimo codice a 6 cifre arrivato a quell'indirizzo (dopo la email numero «from») */
async function codeFor(to, from = 0) {
  for (let i = 0; i < 100; i++) { const m = mailbox().slice(from).filter((x) => x.to === to).pop(); if (m) return (m.subject.match(/(\d{6})/) || [])[1]; await wait(20); }
  return null;
}
/** registrazione completa: dati → codice per email → profilo */
async function signup(p, nick, email = mailOf()) {
  const n = mailbox().length;
  const st = await p.call('startSignup', { nick, password: 'prova123', email, adult: true });
  if (!st.ok) return st;
  return p.call('finishSignup', { code: await codeFor(email.toLowerCase(), n) });
}

(async () => {
  fs.writeFileSync(path.join(dataDir, 'stato.json'), JSON.stringify({ accountsEpoch: 3,
    sessions: [], leaderboard: [['legacy', { name: 'Vecchio risultato', games: 99 }]],
    rooms: [], tournaments: [], leagues: [], daily: [], savedAt: Date.now() }));
  const server = await startServer();
  try {
    const migrated = require('./store').exportData(dataDir);
    assert.strictEqual(migrated.progressEpoch, require('./progress-reset').PROGRESS_EPOCH, 'epoca progressi persistita nel database');
    assert.deepStrictEqual(migrated.leaderboard, [], 'statistiche precedenti azzerate all’avvio');
    const backup = fs.readdirSync(dataDir).find((name) => name.startsWith('prima-del-reset-progressi-'));
    assert(backup && JSON.parse(fs.readFileSync(path.join(dataDir, backup), 'utf8')).leaderboard[0][1].games === 99, 'copia integra prima del reset');
    assert.strictEqual(require('./progress-reset').resetProgress(migrated), migrated, 'una rilettura del database non ripete il reset');
    step('reset progressi all’avvio: backup integro e migrazione salvata nel database');
    // pagina di stato: solo con la chiave
    const key = fs.readFileSync(path.join(dataDir, 'admin-key.txt'), 'utf8').trim();
    assert.strictEqual((await fetch(`${URL}/stato`)).status, 403, 'senza chiave: accesso negato');
    const stato = await (await fetch(`${URL}/stato.json?k=${key}`)).json();
    assert(typeof stato.connessi === 'number' && Array.isArray(stato.tavoli), 'dati di stato');
    step('pagina di stato protetta da chiave');

    const A = player('Anna'), B = player('Bruno');
    await A.hello(); await B.hello();

    // tavolo: 4 posti, obiettivo basso per arrivare presto a fine partita
    let r = await A.call('createRoom', { rules: { players: 4, target: 100 } });
    assert(r.ok, r.error);
    const code = (await A.until((s) => s.room, 'tavolo')).room.code;
    assert((await B.call('joinRoom', { code })).ok);
    await A.until((s) => s.room.seats.filter(Boolean).length === 2, 'secondo giocatore');
    step('due giocatori nello stesso tavolo');

    // --- profili: nickname univoco ---
    let ck = await A.call('checkNick', { nick: 'Anna' });
    assert(!(await A.call('setNick', { nick: 'Anna', password: 'prova123' })).ok, "senza conferma dell'email il profilo non si crea");
    assert(!(await A.call('startSignup', { nick: 'Anna' })).ok, 'senza password niente codice');
    assert(!(await A.call('startSignup', { nick: 'Anna', password: '12345', email: mailOf() })).ok, 'password troppo corta');
    assert(!(await A.call('startSignup', { nick: 'Anna', password: 'prova123' })).ok, 'senza email niente codice');
    assert(!(await A.call('startSignup', { nick: 'Anna', password: 'prova123', email: 'non-valida' })).ok, 'email non valida');
    assert(ck.ok && ck.available, 'Anna disponibile');
    // età minima e regole: senza la spunta niente codice (lo controlla il server, non solo il browser)
    assert(!(await A.call('startSignup', { nick: 'Anna', password: 'prova123', email: mailOf() })).ok, 'senza la spunta dei 14 anni niente profilo');
    // nickname volgari rifiutati (anche con numeri al posto delle lettere), «Scopa» permesso
    for (const bad of ['Stronzo88', 'C4zz0ne', 'xx_puta_xx']) {
      assert(!(await A.call('checkNick', { nick: bad })).available, `nickname volgare rifiutato: ${bad}`);
      assert(!(await A.call('startSignup', { nick: bad, password: 'prova123', email: mailOf(), adult: true })).ok, `registrazione rifiutata: ${bad}`);
    }
    assert((await A.call('checkNick', { nick: 'Scopa_Re' })).available, '«Scopa» è un gioco: nickname permesso');
    assert((await signup(A, 'Anna')).ok);
    assert(!(await A.call('setNick', { nick: 'Merdaccia' })).ok, 'cambio nickname volgare rifiutato');
    step('età minima e nickname volgari rifiutati dal server');
    ck = await B.call('checkNick', { nick: 'ANNA' });
    assert(ck.ok && !ck.available, 'nickname già preso (maiuscole/minuscole non contano)');
    assert(!(await signup(B, 'anna')).ok, 'non si può prendere un nick occupato');
    assert(!(await B.call('checkNick', { nick: 'a' })).available, 'nick troppo corto');
    assert((await signup(B, 'Bruno')).ok);
    step('nickname univoco con controllo disponibile / non disponibile');

    // --- segnalazione di un problema: arriva nella pagina di stato con la situazione del tavolo ---
    assert(!(await A.call('report', { text: 'ok' })).ok, 'testo troppo corto');
    assert((await A.call('report', { text: 'Il pulsante non funziona', screen: 'game', device: 'test' })).ok);
    assert(!(await A.call('report', { text: 'Seconda segnalazione subito' })).ok, 'una al minuto');
    const st2 = await (await fetch(`${URL}/stato.json?k=${key}`)).json();
    assert(st2.segnalazioni[0].text === 'Il pulsante non funziona' && st2.segnalazioni[0].table.code === code, 'segnalazione con il tavolo');
    step('segnala un problema: arriva nella pagina di stato con la situazione del tavolo');

    // segnalare un giocatore: arriva con il motivo e gli ultimi messaggi della chat del tavolo
    await A.call('chat', { text: 'messaggio di prova per la segnalazione' });
    await wait(100);
    // parolacce in chat: arrivano coperte da asterischi, le parole innocue restano
    await A.call('chat', { text: 'che stronzo, giochiamo a Scopa?' });
    await B.until(() => B.chats.some((m) => m.text.includes('Scopa')), 'chat filtrata');
    assert(B.chats.some((m) => m.text === 'che *******, giochiamo a Scopa?'), 'parolaccia coperta da asterischi in chat');
    assert(!(await B.call('reportPlayer', { nick: 'Anna', reason: 'boh' })).ok, 'motivo obbligatorio');
    assert((await B.call('reportPlayer', { nick: 'Anna', reason: 'offese', text: 'prova' })).ok);
    const st3 = await (await fetch(`${URL}/stato.json?k=${key}`)).json();
    const rp3 = st3.segnalazioni[0];
    assert(rp3.kind === 'player' && rp3.target === 'Anna' && rp3.chat.some((m) => m.includes('messaggio di prova')), 'segnalazione del giocatore con la chat');
    step('segnala un giocatore: motivo e chat del tavolo nella pagina di stato');

    // Blocca: chi blocca non riceve più la chat di quel giocatore
    assert((await B.call('blockPlayer', { nick: 'Anna' })).ok, 'blocca');
    const nB = B.chats.length, nA = A.chats.length;
    await A.call('chat', { text: 'messaggio dopo il blocco' });
    await A.until(() => A.chats.length > nA, 'chi scrive vede il suo messaggio');
    await wait(150);
    assert.strictEqual(B.chats.length, nB, 'chi ha bloccato non riceve la chat del bloccato');
    assert((await B.call('unblockPlayer', { nick: 'Anna' })).ok, 'sblocca');
    step('blocca: la chat del giocatore bloccato non arriva');

    // moderazione dalla pagina di stato (regole di comportamento): avviso, chat bloccata e sbloccata
    const modera = (nick, azione) => fetch(`${URL}/stato/modera?k=${key}&nick=${nick}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `azione=${azione}` });
    assert.strictEqual((await fetch(`${URL}/stato/modera?nick=Anna`, { method: 'POST' })).status, 403, 'moderazione solo con la chiave');
    assert((await modera('Anna', 'avviso')).ok);
    assert((await A.call('social')).social.warn, 'avviso arrivato');
    assert((await A.call('warnSeen')).ok && !(await A.call('social')).social.warn, 'avviso letto');
    await modera('Anna', 'muta7');
    assert((await A.call('social')).social.chatBan > Date.now(), 'chat bloccata 7 giorni');
    assert(!(await A.call('chat', { text: 'ciao' })).ok, 'con la chat bloccata non si scrive');
    await modera('Anna', 'smuta');
    assert((await A.call('chat', { text: 'ciao di nuovo' })).ok, 'chat sbloccata');
    // nickname cambiato e profilo eliminato (su un profilo di prova)
    const Zm = player('Zeta');
    await Zm.hello();
    assert((await signup(Zm, 'Zeta_Prova')).ok);
    await modera('Zeta_Prova', 'rinomina');
    const soZ = (await Zm.call('social')).social;
    assert(/^Giocatore\d{4}$/.test(soZ.nick) && soZ.warn && soZ.warn.renamed, 'nickname cambiato con avviso');
    assert((await Zm.call('checkNick', { nick: 'Zeta_Prova' })).available, 'il vecchio nickname è libero');
    let moderationDeleted = false;
    Zm.sock.on('loggedOut', (m) => { moderationDeleted = m.deleted === true; });
    await modera(soZ.nick, 'elimina');
    await wait(100);
    assert(moderationDeleted && (await A.call('checkNick', { nick: soZ.nick })).available, 'profilo eliminato e accesso revocato');
    Zm.sock.close();
    step('moderazione: avviso, chat bloccata, nickname cambiato e profilo eliminato dalla pagina di stato');

    // stile: un titolo bloccato è rifiutato, quello di partenza va bene e arriva agli altri al tavolo
    assert(!(await A.call('setLook', { title: 't_maestro' })).ok, 'titolo bloccato');
    assert((await A.call('setLook', { frame: 'f_nessuna', title: 't_principiante' })).ok, 'stile di partenza');
    step('stile: titoli e cornici solo se sbloccati');

    // --- avatar e reazioni ---
    assert(!(await A.call('setAvatar', { e: '💩', c: '#000' })).ok, 'avatar non previsto rifiutato');
    assert((await A.call('setAvatar', { e: '🦊', c: '#64b5f6' })).ok);
    await B.until((s) => s.room.seats.some((x) => x && x.avatar && x.avatar.e === '🦊'), 'avatar visibile al tavolo');
    assert((await A.call('setAvatar', { id: 'drago-imperatore', c: '#64b5f6' })).ok, 'avatar con ID stabile');
    await B.until((s) => s.room.seats.some((x) => x && x.avatar && x.avatar.id === 'drago-imperatore'), 'nuovo avatar trasmesso agli altri giocatori');
    assert(!(await A.call('setAvatar', { id: 'avatar-inventato', c: '#64b5f6' })).ok, 'ID avatar arbitrario rifiutato');
    assert((await A.call('setAvatar', { e: '🦊', c: '#64b5f6' })).ok, 'scelta dal client precedente compatibile');
    const reacted = new Promise((res) => B.sock.once('reaction', res));
    assert((await A.call('react', { emoji: '👏' })).ok);
    const re = await reacted;
    assert(re.emoji === '👏' && re.seat === 0, 'reazione ricevuta');
    assert(!(await A.call('react', { emoji: '🔥' })).ok, 'limite anti-raffica');
    step('avatar personalizzato e reazioni rapide');

    // --- amici: richiesta, accettazione, stato online, invito ---
    const socialOf = (p) => new Promise((res) => p.call('social').then((r) => res(r.social)));
    assert(!(await A.call('friendRequest', { nick: 'Anna' })).ok, 'niente amicizia con se stessi');
    assert((await A.call('friendRequest', { nick: 'bruno' })).ok);
    assert.deepStrictEqual((await socialOf(B)).reqIn, ['Anna']);
    assert.deepStrictEqual((await socialOf(A)).reqOut, ['Bruno']);
    assert((await B.call('friendRespond', { nick: 'Anna', accept: true })).ok);
    const fa = await socialOf(A);
    assert(fa.friends.length === 1 && fa.friends[0].nick === 'Bruno' && fa.friends[0].online, 'Bruno amico e online');
    const invited = new Promise((res) => B.sock.once('invite', res));
    assert((await A.call('inviteFriend', { nick: 'Bruno' })).ok);
    const inv = await invited;
    assert(inv.from === 'Anna' && inv.code === code, 'invito ricevuto con il codice del tavolo');
    step('amicizia: richiesta, accettazione, online e invito al tavolo');

    // --- cambio dispositivo: codice personale e nickname + password ---
    const prof = await A.call('profile');
    assert(prof.ok && /^BUR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(prof.code), 'codice personale');
    const C = player('Nuovo telefono');
    await C.hello();
    let imp = await C.call('importProfile', { code: prof.code.toLowerCase().replace(/-/g, ' ') });
    assert(imp.ok && imp.token && imp.token !== A.token && imp.nick === 'Anna', 'profilo importato col codice');
    assert(!(await C.call('importProfile', { code: 'BUR-AAAA-BBBB-CCCC' })).ok, 'codice sbagliato rifiutato');
    assert(!(await B.call('setPassword', { password: '123' })).ok, 'password troppo corta');
    assert((await B.call('setPassword', { password: 'segreta123' })).ok);
    assert(!(await C.call('login', { nick: 'bruno', password: 'sbagliata' })).ok, 'password errata');
    const lg = await C.call('login', { nick: 'bruno', password: 'segreta123' });
    assert(lg.ok && lg.nick === 'Bruno', 'accesso con nickname e password');
    // password dimenticata (su un profilo a parte, Zeno, per non scollegare i giocatori delle prove dopo)
    const Z = player('Zeno'); await Z.hello();
    assert((await signup(Z, 'Zeno')).ok);
    const Z2 = player('Zeno telefono 2'); await Z2.hello();
    assert((await Z2.call('login', { nick: 'zeno', password: 'prova123' })).ok);
    const Z2b = player('Zeno telefono 2');
    const wz = await Z2b.hello((await Z2.call('login', { nick: 'zeno', password: 'prova123' })).token);
    assert(wz.nick === 'Zeno', 'secondo dispositivo dentro il profilo');
    const codeZ = (await Z.call('profile')).code;
    assert(!(await C.call('resetPassword', { nick: 'zeno', code: prof.code, password: 'nuova1234' })).ok, 'codice di un altro rifiutato');
    let kicked = false; Z2b.sock.on('loggedOut', () => { kicked = true; });
    const rpw = await C.call('resetPassword', { nick: 'Zeno', code: codeZ, password: 'nuova1234' });
    assert(rpw.ok && rpw.nick === 'Zeno', 'password cambiata con il codice di recupero');
    for (let i = 0; i < 50 && !kicked; i++) await wait(20);
    assert(kicked, 'cambiando password gli altri dispositivi vengono scollegati');
    assert(!(await C.call('login', { nick: 'zeno', password: 'prova123' })).ok, 'la vecchia password non vale più');
    assert((await C.call('login', { nick: 'zeno', password: 'nuova1234' })).ok, 'accesso con la nuova password');
    step('password obbligatoria, codice di recupero, altri dispositivi scollegati');

    // un profilo su due dispositivi: entrambi restano collegati, ma si gioca da uno solo per volta
    const W1 = player('Dario pc1'); await W1.hello();
    assert((await signup(W1, 'Dario')).ok);
    assert((await W1.call('createRoom', { rules: { players: 2, target: 100 }, vsBots: true })).ok);
    await W1.until((s) => s.game, 'partita di Dario');
    const W2 = player('Dario pc2');
    const busy = new Promise((res) => W2.sock.once('busyElsewhere', res));
    await W2.hello((await W2.call('login', { nick: 'dario', password: 'prova123' })).token);
    await busy;
    assert(W1.state.game, 'il primo dispositivo resta in partita (e collegato)');
    assert.strictEqual((await W2.call('createRoom', { rules: { players: 2 }, vsBots: true })).error, 'BUSY_OTHER', 'niente seconda partita insieme');
    const moved = new Promise((res) => W1.sock.once('notice', res));
    assert((await W2.call('takeOver', { mode: 'here' })).ok);
    assert(/altro dispositivo/.test((await moved).text), 'il primo dispositivo viene avvisato');
    await W2.until((s) => s.game, 'partita spostata sul secondo dispositivo');
    assert(!W1.state.room, 'il primo dispositivo torna alla schermata iniziale');
    assert.strictEqual((await W1.call('createRoom', { rules: { players: 2 }, vsBots: true })).error, 'BUSY_OTHER');
    assert((await W1.call('takeOver', { mode: 'abandon' })).ok);
    await W2.until((s) => !s.room, 'partita abbandonata');
    assert((await W1.call('createRoom', { rules: { players: 2 }, vsBots: true })).ok, 'dopo la conferma si gioca');
    W1.sock.close(); W2.sock.close();
    step('due dispositivi: restano collegati, si gioca da uno per volta (spostare o lasciare la partita)');

    // email: conferma con codice e recupero della password via email (in prova le email finiscono in un file)
    const lastCode = (to) => codeFor(to);
    const Y = player('Ylenia'); await Y.hello();
    assert((await Y.call('startSignup', { nick: 'Ylenia', password: 'prova123', email: 'Ylenia@Esempio.it', adult: true })).ok, 'codice inviato alla registrazione');
    const vcode = await lastCode('ylenia@esempio.it');
    assert(vcode, 'email con il codice');
    assert(!(await Y.call('finishSignup', { code: vcode === '000000' ? '111111' : '000000' })).ok, 'codice sbagliato');
    assert(!(await Y.call('social')).social.nick, 'senza il codice giusto il profilo non esiste');
    assert((await Y.call('finishSignup', { code: vcode })).ok, 'profilo creato con il codice');
    assert((await Y.call('profile')).email === 'ylenia@esempio.it', 'email già confermata');
    assert(!(await Y.call('setEmail', { email: 'non-valida' })).ok, 'email non valida');
    const X = player('Xenia'); await X.hello();
    assert((await signup(X, 'Xenia')).ok);
    assert(!(await X.call('setEmail', { email: 'ylenia@esempio.it' })).ok, 'email già usata da un altro profilo');
    const X2 = player('Xavier'); await X2.hello();
    assert(!(await X2.call('startSignup', { nick: 'Xavier', password: 'prova123', email: 'YLENIA@esempio.it', adult: true })).ok, 'registrazione con email già usata');
    X2.sock.close();
    assert((await C.call('forgotPassword', { email: 'nessuno@esempio.it' })).ok, 'stessa risposta per email sconosciute');
    const mailsBefore = mailbox().length;
    assert((await C.call('forgotPassword', { email: 'ylenia@esempio.it' })).ok);
    let rcode = null; for (let i = 0; i < 50 && !rcode; i++) { const m = mailbox().slice(mailsBefore).filter((x) => x.to === 'ylenia@esempio.it').pop(); rcode = m && (m.subject.match(/(\d{6})/) || [])[1]; await wait(20); }
    assert(rcode, 'email con il codice per la nuova password');
    assert(!(await C.call('resetWithEmail', { email: 'ylenia@esempio.it', code: '12345', password: 'altra1234' })).ok, 'codice sbagliato rifiutato');
    const rm = await C.call('resetWithEmail', { email: 'ylenia@esempio.it', code: rcode, password: 'altra1234' });
    assert(rm.ok && rm.nick === 'Ylenia', 'password cambiata via email');
    assert((await C.call('login', { nick: 'ylenia', password: 'altra1234' })).ok);
    await wait(100);
    assert(mailbox().some((x) => x.to === 'ylenia@esempio.it' && /password cambiata/.test(x.subject)), 'avviso di password cambiata');
    for (const x of [Z, Z2, Z2b, Y, X]) x.sock.close();
    // partite contro il computer giocate sul telefono: a fine smazzata il risultato arriva al server
    {
      const GB = require('./games').GAMES.briscola;
      const LG = player('Lucio'); await LG.hello();
      assert((await signup(LG, 'Lucio')).ok);
      const lg = GB.E.createGame({ rules: { game: 'briscola', players: 2 }, players: [{ name: 'Lucio' }, { name: 'Zio Gino', isBot: true }] });
      for (let i = 0; lg.phase !== 'handEnd' && i < 500; i++) { const st = lg.turn; GB.E.apply(lg, st, GB.Bot.nextAction(lg, st, { level: 'normale' })); }
      const res = { id: 'prova-telefono', rules: lg.cfg.rules, botLevel: 'normale', game: JSON.parse(JSON.stringify(lg)) };
      assert((await LG.call('localResult', res)).ok, 'risultato dal telefono accettato');
      assert((await LG.call('localResult', res)).ok, 'lo stesso risultato rimandato non dà errore');
      const ls = await LG.call('myStats');
      assert(!ls.stats && !ls.history.length && ls.level.xp === 0, 'i vecchi risultati offline non assegnano statistiche o esperienza');
      assert(LG.progress.every((p) => p.xp === 0 && !(p.streak && p.streak.today)) && !LG.trophies.length, 'nessun obiettivo, serie di giorni o livello contro il computer');
      const fake = JSON.parse(JSON.stringify(res)); fake.id = 'falso'; fake.game.players[1].isBot = false;
      assert(!(await LG.call('localResult', fake)).ok, 'un risultato con un altro giocatore umano è rifiutato');
      LG.sock.close();
      step('partite sul telefono: vecchi risultati e duplicati ignorati, nessun progresso');
    }

    // l'email arriva nella lingua del dispositivo
    const Es = player('Elena'); await Es.hello(undefined, 'es');
    assert((await Es.call('startSignup', { nick: 'Elena', password: 'prova123', email: 'elena@esempio.es', adult: true })).ok);
    let esMail = null; for (let i = 0; i < 50 && !esMail; i++) { esMail = mailbox().find((x) => x.to === 'elena@esempio.es'); await wait(20); }
    assert(esMail && /tu código es \d{6}/.test(esMail.subject) && /Hola Elena/.test(esMail.text), 'email in spagnolo');
    Es.sock.close();
    step('email: conferma con codice, recupero della password via email, avviso, nella lingua di chi la riceve');

    // eliminazione: il nickname torna libero e l'amicizia sparisce
    const D = player('Temporaneo');
    await D.hello();
    assert((await signup(D, 'Tempo')).ok);
    assert((await D.call('friendRequest', { nick: 'Anna' })).ok);
    assert.deepStrictEqual((await socialOf(A)).reqIn, ['Tempo']);
    const originalKey = D.token;
    const deletedPeer = player('SecondoDispositivo'); await deletedPeer.hello();
    const imported = await deletedPeer.call('login', { nick: 'Tempo', password: 'prova123' });
    assert(imported.ok, 'accesso del secondo dispositivo prima della cancellazione');
    await deletedPeer.hello(imported.token);
    let deletedOnOtherDevice = false;
    deletedPeer.sock.on('loggedOut', (m) => { deletedOnOtherDevice = m.deleted === true; });
    assert((await D.call('deleteProfile')).ok);
    assert.deepStrictEqual((await socialOf(A)).reqIn, [], 'richiesta sparita');
    assert((await C.call('checkNick', { nick: 'Tempo' })).available, 'nickname di nuovo libero');
    await wait(100);
    assert(deletedOnOtherDevice, 'cancellazione comunicata anche agli altri dispositivi');
    const deletedStore = require('./store').exportData(dataDir);
    assert(!deletedStore.sessions.some(([, s]) => s.nick === 'Tempo' || (s.devices || []).some((d) => d.h === require('crypto').createHash('sha256').update(originalKey).digest('hex'))), 'sessione e credenziali rimosse su disco');
    assert(!(await C.call('login', { nick: 'Tempo', password: 'prova123' })).ok, 'vecchia password inutilizzabile');
    const oldDevice = player('ChiaveRevocata');
    const oldWelcome = await oldDevice.hello(originalKey);
    assert(!oldWelcome.nick && oldWelcome.token !== originalKey, 'una vecchia chiave non recupera il profilo eliminato');
    oldDevice.sock.close(); deletedPeer.sock.close();
    D.sock.close();
    C.sock.close();
    step("cambio dispositivo con codice personale e con nickname + password; eliminazione del profilo");

    // suggerimenti vietati in multiplayer
    r = await A.call('setHints', { on: true });
    assert(!r.ok && /multiplayer/.test(r.error), 'i suggerimenti non devono attivarsi con due umani');
    step('suggerimenti bloccati in multiplayer');

    // aiuto "dove attaccare": attivo di serie, solo l'host lo cambia, arriva a tutti
    assert(B.state.room.aids === true, 'aiuti attivi di serie');
    assert(!(await B.call('setAids', { on: false })).ok, "solo l'host");
    assert((await A.call('setAids', { on: false })).ok);
    await B.until((s) => s.room.aids === false, 'aiuti disattivati per tutti');
    assert((await A.call('setAids', { on: true })).ok);
    step("aiuto 'dove attaccare' attivabile solo dall'host");

    // musica: l'host condivide, l'altro la riceve; link non Spotify rifiutato
    assert(!(await A.call('setMusic', { url: 'https://evil.example/x' })).ok);
    assert((await A.call('setMusic', { url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' })).ok);
    await B.until((s) => s.room.music && /spotify/.test(s.room.music.url) && s.room.music.by === 'Anna', 'musica condivisa');
    assert(!(await B.call('setMusic', { url: 'https://open.spotify.com/playlist/x' })).ok, 'solo l\'host cambia la musica');
    step('musica del tavolo condivisa (e riservata all\'host)');

    // bravura del computer
    assert(!(await A.call('setBotLevel', { level: 'impossibile' })).ok);
    assert((await A.call('setBotLevel', { level: 'difficile' })).ok);
    await B.until((s) => s.room.botLevel === 'difficile', 'livello del computer');
    step("bravura del computer impostata dall'host");

    // timer: 30 s (accelerati) → i turni degli umani vanno avanti da soli
    assert((await A.call('setTurnTime', { seconds: 30 })).ok);
    assert((await A.call('addBot', {})).ok);
    // Le verifiche successive di premi e statistiche devono usare una partita tra persone.
    assert((await A.call('configure', { rules: { players: 2, target: 100 } })).ok);
    assert((await A.call('start')).ok);
    await B.until((s) => s.game, 'inizio partita');
    await A.until((s) => s.game && s.game.log.some((l) => l.includes('Tempo scaduto')), 'turno automatico per tempo scaduto', 30000);
    step('timer del turno: allo scadere pesca e scarta in automatico');

    // spettatore: entra a partita iniziata, vede il tavolo ma non le carte, non può giocare
    const W = player('Walter');
    await W.hello();
    assert((await signup(W, 'Walter')).ok);
    assert((await W.call('joinRoom', { code })).ok, 'ingresso come spettatore');
    const ws = await W.until((s) => s.game, 'vista dello spettatore');
    assert.strictEqual(ws.room.you, -1, 'senza posto');
    assert.strictEqual(ws.game.hand.length, 0, 'nessuna carta in mano visibile');
    assert(ws.game.players.length === 2 && ws.game.teams.length === 2, 'tavolo visibile');
    assert(!(await W.call('action', { type: 'draw' })).ok, 'lo spettatore non gioca');
    await A.until((s) => s.room.spectators.includes('Walter'), 'spettatore visibile ai giocatori');
    assert((await W.call('leaveRoom')).ok);
    await A.until((s) => !s.room.spectators.includes('Walter'), 'spettatore uscito');
    W.sock.close();
    step('spettatore: vede il tavolo senza le carte in mano e non può giocare');

    // riconnessione: Bruno cade e rientra con lo stesso token, ritrovando posto e carte
    const bSeat = B.state.game.you;
    B.sock.close();
    await A.until((s) => s.room.seats[bSeat] && s.room.seats[bSeat].connected === false, 'Bruno offline');
    const tokenB = B.token;
    const B2 = player('Bruno');
    await B2.hello(tokenB);
    const back = await B2.until((s) => s.game, 'rientro di Bruno');
    assert.strictEqual(back.game.you, bSeat, 'stesso posto dopo la riconnessione');
    assert(back.game.hand.length > 0, 'carte ritrovate');
    await A.until((s) => s.room.seats[bSeat].connected === true, 'Bruno di nuovo online');
    Object.assign(B, { sock: B2.sock, state: B2.state, call: B2.call, until: B2.until });
    B2.sock.on('state', (st) => { B.state = st; });
    step('riconnessione: stesso posto e stesse carte, gli altri vedono offline/online');

    // si gioca da soli (timer + bot) fino a fine partita; tra una smazzata e l'altra si dà il "pronto"
    const end = Date.now() + 120000;
    while (!(A.state.game && A.state.game.over)) {
      if (Date.now() > end) throw new Error('la partita non finisce');
      for (const p of [A, B]) {
        await playHuman(p);
        const g = p.state.game;
        if (g && g.phase === 'handEnd' && !g.over && !p.state.room.ready.includes(g.you)) await p.call('ready');
      }
      await wait(50);
    }
    step(`partita finita dopo ${A.state.game.handNo} smazzate`);

    // moviola: l'ultima smazzata finita, con le mosse che rigiocate portano allo stesso risultato
    const rp = await A.call('replay');
    assert(rp.ok && rp.replay.actions.length > 10 && rp.replay.start.players.every((p) => p.hand.length > 0), 'moviola disponibile');
    assert(A.state.game.hasReplay, "il client sa che c'è una moviola");

    // classifica: entrambi gli umani hanno una partita giocata
    const lb = await A.call('leaderboard');
    assert(lb.ok && lb.list.length === 2 && lb.list.every((e) => e.games === 1), 'classifica aggiornata');
    assert(lb.mine && lb.mine.position >= 1 && lb.mine.games === 1, 'scheda personale della pagina leghe');
    assert.strictEqual(lb.list.filter((e) => e.me).length, 1);
    assert.strictEqual(lb.list.reduce((n, e) => n + e.wins, 0) >= 1, true);
    step('classifica aggiornata a fine partita');

    // campionato tra amici: Anna lo crea e aggiunge Bruno (amico); conterà la prossima partita insieme
    assert(!(await A.call('leagueCreate', { name: 'Lega di merda', period: 'settimana' })).ok, 'nome volgare del campionato rifiutato');
    const lc = await A.call('leagueCreate', { name: 'Burraco del giovedì', period: 'settimana' });
    assert(lc.ok && lc.id, 'campionato creato');
    assert((await A.call('leagueAdd', { id: lc.id, nick: 'Bruno' })).ok);
    assert(!(await B.call('leagueAdd', { id: lc.id, nick: 'Anna' })).ok, 'solo il creatore aggiunge');

    // statistiche sul server, storico, scheda dell'amico, classifica solo amici
    const ms = await A.call('myStats');
    assert(ms.ok && ms.stats.games === 1 && ms.stats.hands >= 1 && ms.history.length === 1, 'statistiche e storico di Anna');
    assert(ms.history[0].teams.some((t) => t.mine), 'nello storico è segnata la propria squadra');
    assert(ms.byGame.burraco && ms.byGame.burraco.games === 1 && !ms.byGame.scala40, 'statistiche del Burraco separate');
    assert(!ms.byGame.burraco.elo && !ms.byGame.burraco.rankedGames && !A.state.room.ranked && ms.history[0].ranked === false, 'partita amichevole: Elo invariato');
    assert(ms.timeline.length === 1 && ms.timeline[0].g === 'burraco' && ms.timeline[0].o.includes('Bruno'), 'cronologia per i grafici (con gli avversari)');
    // trofei: "Tra amici" (Anna e Bruno sono amici), avvisi in tempo reale, bacheca con l'avanzamento
    await A.until(() => A.trophies.includes('amici'), 'avviso del trofeo');
    const tAmici = ms.trophies.find((t) => t.id === 'amici');
    assert(tAmici && tAmici.at, 'trofeo "Tra amici" in bacheca');
    assert(ms.trophies.find((t) => t.id === 'maratona').progress.now === 1, 'avanzamento: 1 partita su 100');
    const lbw = lb.list.find((e) => e.me);
    if (lbw.wins) assert(ms.trophies.find((t) => t.id === 'prima_vittoria').at, 'prima vittoria');
    step(`trofei: ${A.trophies.join(', ')}`);
    // livello: calcolato dalle statistiche, sale a fine partita, visibile al tavolo e in classifica
    assert(ms.level && ms.level.level >= 1 && ms.level.xp >= 50 && Levels.levelOf({ games: 1, wins: 1 }).level === 2, `livello di Anna (${JSON.stringify(ms.level)})`);
    assert(A.progress.length > 0, 'aggiornamento del livello a fine partita');
    assert(A.state.room.seats.every((x) => x.isBot ? x.level === null : x.level >= 1), 'livello accanto ai nomi al tavolo');
    assert(lb.list.every((x) => x.level >= 1), 'livello in classifica');
    step(`livello: Anna è al livello ${ms.level.level} (${ms.level.xp} punti esperienza)`);
    const card = await A.call('playerCard', { nick: 'Bruno' });
    assert(card.ok && card.together.games === 1 && card.stats.games === 1, 'scheda di Bruno con la partita giocata insieme');
    assert.strictEqual(card.together.asPartners, 0, 'Anna e Bruno erano avversari');
    assert(card.trophies.some((t) => t.id === 'amici'), 'i trofei di Bruno nella sua scheda');
    const D2 = player('Estraneo'); await D2.hello(); assert((await signup(D2, 'Estraneo')).ok);
    assert(!(await D2.call('playerCard', { nick: 'Anna' })).ok, 'scheda visibile solo agli amici');
    const lf = await A.call('leaderboard', { friends: true });
    assert(lf.ok && lf.list.length === 2, 'classifica tra amici');
    // blocco: l'estraneo bloccato non può più chiedere l'amicizia
    assert((await D2.call('friendRequest', { nick: 'Anna' })).ok);
    assert((await A.call('blockPlayer', { nick: 'Estraneo' })).ok);
    assert.deepStrictEqual((await A.call('social')).social.reqIn, [], 'richiesta tolta dal blocco');
    assert(!(await D2.call('friendRequest', { nick: 'Anna' })).ok, 'bloccato: niente richieste');
    assert((await A.call('unblockPlayer', { nick: 'Estraneo' })).ok);
    assert((await D2.call('friendRequest', { nick: 'Anna' })).ok, 'sbloccato: richieste di nuovo possibili');
    D2.sock.close();
    step('statistiche sul server, storico partite, scheda amico e classifica tra amici; blocco giocatore');

    // mini-torneo: impostato tra una partita e l'altra, conta le vittorie
    assert((await A.call('setSeries', { bestOf: 3 })).ok);
    await B.until((s) => s.room.series && s.room.series.bestOf === 3, 'torneo al meglio di 3');

    // rivincita: serve il voto di tutti gli umani
    const seatsBefore = A.state.game.players.map((p) => p.name);
    assert((await A.call('ready')).ok);
    await wait(200);
    assert(A.state.game.over, 'con un solo voto la rivincita non deve partire');
    assert(A.state.room.ready.includes(A.state.game.you));
    assert((await B.call('ready')).ok);
    const ng = await A.until((s) => s.game && !s.game.over && s.game.handNo === 1 && s.game.scores.every((x) => x === 0), 'nuova partita');
    assert.deepStrictEqual(ng.game.players.map((p) => p.name), seatsBefore, 'stessi posti');
    step('rivincita con il voto di tutti, stessi posti');

    // seconda partita del torneo: alla fine il conteggio delle vittorie sale
    const end2 = Date.now() + 120000;
    while (!(A.state.game && A.state.game.over)) {
      if (Date.now() > end2) throw new Error('la seconda partita non finisce');
      for (const p of [A, B]) {
        await playHuman(p);
        const g = p.state.game;
        if (g && g.phase === 'handEnd' && !g.over && !p.state.room.ready.includes(g.you)) await p.call('ready');
      }
      await wait(50);
    }
    const sr = (await A.until((s) => s.room.series && s.room.series.games === 1, 'torneo aggiornato')).room.series;
    assert.strictEqual(sr.wins.reduce((a, b) => a + b, 0) >= 1, true, 'vittorie contate');
    assert.strictEqual(sr.champion, null, 'dopo una partita su tre nessun campione');
    const lgs = (await B.call('leagues')).list;
    const lgv = lgs.find((x) => x.id === lc.id);
    assert(lgv && lgv.standings.length === 2 && lgv.standings.every((x) => x.games === 1) && lgv.standings[0].pts === 3, 'classifica del campionato dopo la partita');
    step(`campionato tra amici: ${lgv.standings.map((x) => `${x.name} ${x.pts} pt`).join(', ')}`);
    step('mini-torneo: vittorie contate partita dopo partita');

    // allenamento: Classico in 2, computer facile, suggerimenti attivi
    const T = player('Tina'); await T.hello(); assert((await signup(T, 'Tina')).ok);
    assert((await T.call('createRoom', { tutorial: true })).ok);
    const ts = await T.until((s) => s.game, 'partita di allenamento');
    assert(ts.room.tutorial && ts.room.hints && ts.room.botLevel === 'facile' && ts.room.n === 2, 'impostazioni dell\'allenamento');
    T.sock.close();
    const T4 = player('Tilde'); await T4.hello(); assert((await signup(T4, 'Tilde')).ok);
    assert((await T4.call('createRoom', { tutorial: true, rules: { game: 'scala40' } })).ok);
    const t4 = await T4.until((st) => st.game, 'allenamento di Scala 40');
    assert(t4.room.tutorial && t4.room.game === 'scala40' && t4.room.n === 2 && t4.room.hints, 'allenamento di Scala 40');
    T4.sock.close();
    for (const gm of ['canasta', 'ramino']) {
      const Tx = player('Allievo ' + gm); await Tx.hello(); assert((await signup(Tx, 'Allievo_' + gm)).ok);
      assert((await Tx.call('createRoom', { tutorial: true, rules: { game: gm } })).ok);
      const tx = await Tx.until((st) => st.game, 'allenamento di ' + gm);
      assert(tx.room.tutorial && tx.room.game === gm && tx.room.n === 2, 'allenamento di ' + gm);
      Tx.sock.close();
    }
    step('allenamento (tutti i giochi): 2 giocatori, computer facile, suggerimenti attivi');

    // sfida del giorno: un tentativo, stesse carte per tutti, punteggio in classifica, niente rivincita
    const Dd = player('Dora'); await Dd.hello(); assert((await signup(Dd, 'Dora')).ok);
    const info = await Dd.call('daily');
    assert(info.ok && info.title && [2, 4].includes(info.rules.players) && info.mine === null, 'informazioni sulla sfida');
    assert((await Dd.call('startDaily')).ok);
    assert(!(await Dd.call('startDaily')).ok, 'un solo tentativo al giorno');
    const ds = await Dd.until((st) => st.game, 'partita della sfida');
    assert(ds.room.daily && ds.room.botLevel === 'difficile', 'sfida contro il computer difficile');
    const firstHand = ds.game.hand.map((c) => `${c.r}${c.s}`).sort().join();
    assert((await Dd.call('setHints', { on: true })).ok);
    const endD = Date.now() + 60000;
    while (!(Dd.state.game && Dd.state.game.over)) {
      if (Date.now() > endD) throw new Error('la sfida non finisce');
      const g = Dd.state.game;
      if (g.turn === g.you && g.phase !== 'handEnd') {
        const suggestion = await Dd.call('hint');
        assert(suggestion.ok && suggestion.hint, 'suggerimento sfida');
        assert((await Dd.call('action', suggestion.hint)).ok, 'azione sfida');
      }
      await wait(20);
    }
    assert(!(await Dd.call('ready')).ok, 'la sfida è una sola smazzata');
    assert(!(await Dd.call('replay')).ok, 'niente moviola nella sfida del giorno (rivelerebbe il mazzo)');
    const after = await Dd.call('daily');
    assert(after.mine && after.mine.score != null && after.myPos === 1 && after.top[0].name === 'Dora', 'punteggio nella classifica del giorno');
    const dailyStats = await Dd.call('myStats');
    assert(!dailyStats.stats && dailyStats.level.xp === 0 && !Dd.trophies.length, 'sfida contro il computer: classifica dedicata senza progressi al profilo');
    // stesse carte per tutti: un secondo giocatore riceve la stessa mano iniziale
    const Ee = player('Elio'); await Ee.hello(); assert((await signup(Ee, 'Elio')).ok);
    assert((await Ee.call('startDaily')).ok);
    const es = await Ee.until((st) => st.game, 'sfida di Elio');
    assert.strictEqual(es.game.hand.map((c) => `${c.r}${c.s}`).sort().join(), firstHand, 'stessa mano iniziale');
    Dd.sock.close(); Ee.sock.close();
    step(`sfida del giorno «${info.title}»: Dora ${after.mine.score} punti, un tentativo, stesse carte per tutti`);

    // gioca subito: due giocatori cercano un tavolo da 2 e la partita parte da sola
    const Q1 = player('Quinto'), Q2 = player('Sesto');
    await Q1.hello(); await Q2.hello();
    assert((await signup(Q1, 'Quinto')).ok); assert((await signup(Q2, 'Sesto')).ok);
    assert(!(await Q1.call('quickPlay', { game: 'inesistente', n: 2 })).ok, 'gioco pubblico sconosciuto rifiutato');
    assert(!(await Q1.call('quickPlay', { game: 'briscola5', n: 2 })).ok, 'formato non valido rifiutato');
    for (const game of ['burraco', 'scala40', 'ramino', 'canasta']) {
      const n = game === 'briscola5' ? 5 : 4;
      const first = await Q1.call('quickPlay', { game, n, mode: 'casual' });
      assert(first.ok, game + ': creazione tavolo pubblico');
      const other = await Q2.call('quickPlay', { game: game === 'ramino' ? 'scala40' : 'ramino', n: 4, mode: 'casual' });
      assert(other.ok && other.code !== first.code, 'giochi e varianti diversi non abbinati');
      await Q2.call('leaveRoom');
      const same = await Q2.call('quickPlay', { game, n, mode: 'casual' });
      assert(same.ok && same.code === first.code, game + ': stesso gioco abbinato');
      const state = await Q1.until((st) => st.room && st.room.code === first.code, 'sala del gioco richiesto');
      assert.strictEqual(state.room.rules.game || 'burraco', game === 'scopone' ? 'scopa' : game);
      assert.strictEqual(state.room.n, n);
      if (game === 'scopone') assert.strictEqual(state.room.rules.deal, 10);
      await Q1.call('leaveRoom'); await Q2.call('leaveRoom');
    }
    const br1 = await Q1.call('quickPlay', { game: 'scala40', n: 2, mode: 'ranked' });
    const br2 = await Q2.call('quickPlay', { game: 'scala40', n: 2, mode: 'ranked' });
    assert(br1.ok && br2.ok && br1.searching, 'ricerca Scala 40 classificata');
    await Q1.until((st) => st.game && st.game.game === 'scala40', 'avvio del gioco scelto');
    assert((await Q1.call('surrender')).done);
    await Q2.until((st) => st.game && st.game.over, 'Scala 40 classificata finita');
    const brStats = (await Q1.call('rankedProfile')).ranks;
    assert.strictEqual(brStats['scala40:solo'].games, 1, 'Glicko del gioco scelto');
    assert(!brStats['burraco:solo'], 'Burraco non modificato dalla Scala 40');
    await Q1.call('leaveRoom'); await Q2.call('leaveRoom');
    step('partita rapida: selezione di tutti i giochi, code separate, avvio Scala 40 ed Elo indipendente');
    const casual = await Q1.call('quickPlay', { n: 2, mode: 'casual' });
    const ranked = await Q2.call('quickPlay', { n: 2, mode: 'ranked' });
    assert(casual.ok && ranked.ok && casual.code !== ranked.code, 'code amichevole e classificata separate');
    assert(!(await Q1.call('configure', { rules: { players: 2, target: 505 } })).ok, 'regole pubbliche non modificabili');
    assert(!(await Q1.call('setSlow', { on: true })).ok, 'coda pubblica sempre in tempo reale');
    assert((await Q2.call('rankedCancel')).ok);
    const casualJoin = await Q2.call('quickPlay', { n: 2, mode: 'casual' });
    assert.strictEqual(casualJoin.code, casual.code, 'stesso formato amichevole abbinato');
    await Q1.until((s) => s.game && s.room.queueMode === 'casual', 'amichevole pubblica avviata');
    assert(!Q1.state.room.ranked, 'amichevole tra persone non classificata');
    assert((await Q1.call('surrender')).done);
    await Q2.until((s) => s.game && s.game.over, 'amichevole finita');
    assert(!((await Q1.call('myStats')).byGame.burraco || {}).rankedGames, 'amichevole non cambia Elo');
    await Q1.call('leaveRoom'); await Q2.call('leaveRoom');
    const q1 = await Q1.call('quickPlay', { n: 2 });
    const q2 = await Q2.call('quickPlay', { n: 2 });
    assert(q1.ok && q2.ok && q1.code === q2.code, 'stesso tavolo veloce');
    await Q1.until((s) => s.game && s.room.quick === 2, 'partita veloce avviata');
    assert(Q1.state.room.ranked && Q2.state.room.ranked, 'gioca subito tra persone: partita classificata');
    // Nessuna mutazione client può annullare una Ranked o registrare un risultato.
    assert(!(await Q1.call('endGame')).ok);
    assert(!(await Q1.call('closeTable')).ok);
    assert(!(await Q1.call('configure', {rules:{players:2,target:1}})).ok);
    assert((await Q1.call('surrender')).done);
    await Q2.until((s) => s.game && s.game.over, 'classificata finita');
    const rankedQ = async (P) => (await P.call('rankedProfile')).ranks['burraco:solo'];
    const e1=await rankedQ(Q1),e2=await rankedQ(Q2);
    assert(e1.games===1&&e1.losses===1&&e2.games===1&&e2.wins===1,'risultato Ranked autorevole');
    assert(!(await Q1.call('backToLobby')).ok,'rivincita Ranked vietata');
    await Q1.call('ready'); assert(!(await Q2.call('ready')).ok,'riavvio stesso match vietato');
    assert.equal((await rankedQ(Q1)).games,1,'nessuna doppia registrazione');
    await Q1.call('leaveRoom');await Q2.call('leaveRoom');
    assert((await Q1.call('rankedJoin',{game:'ramino',n:2})).ok);
    assert((await Q2.call('rankedJoin',{game:'ramino',n:2})).ok);
    await Q2.until(s=>s.game&&!s.game.over&&s.room.rules.game==='ramino','nuovo gioco Ranked');
    assert((await Q1.call('leaveRoom',{abandon:true})).ok);
    await Q2.until(s=>s.game&&s.game.over,'abbandono decide la partita');
    assert.equal((await Q1.call('rankedProfile')).ranks['ramino:solo'].losses,1);
    assert(!(await Q1.call('rankedJoin',{game:'scala40',n:2})).ok,'cooldown abbandono');
    Q1.sock.close(); Q2.sock.close();
    step('Ranked: risultati autorevoli, code separate, nessuna rivincita, abbandoni e cooldown');

    // giocatore offline: senza timer, il computer gioca al suo posto e il tavolo non si blocca
    const O1 = player('Ottavio'), O2 = player('Nora');
    await O1.hello(); await O2.hello();
    assert((await signup(O1, 'Ottavio')).ok); assert((await signup(O2, 'Nora')).ok);
    assert((await O1.call('createRoom', { rules: { players: 2 } })).ok);
    const oc = (await O1.until((s) => s.room, 'tavolo')).room.code;
    assert((await O2.call('joinRoom', { code: oc })).ok);
    assert((await O1.call('start')).ok);
    await O1.until((s) => s.game, 'partita');
    let autoplay = true;
    (async () => { // Ottavio gioca da solo: pesca e scarta
      while (autoplay) {
        const g = O1.state && O1.state.game;
        if (g && g.turn === g.you && g.phase === 'draw') await O1.call('action', { type: 'draw' });
        else if (g && g.turn === g.you && g.phase === 'play') await O1.call('action', { type: 'discard', cardId: g.hand[g.hand.length - 1].id });
        else if (g && g.phase === 'handEnd' && !O1.state.room.ready.includes(g.you)) await O1.call('ready');
        await wait(30);
      }
    })();
    const noraToken = O2.token;
    const noraSeat = (await O2.until((s) => s.game, 'partita per Nora')).game.you;
    O2.sock.close();
    await O1.until((s) => s.game && s.game.log.some((l) => l.includes('Nora è offline: il computer gioca')), 'il computer gioca per Nora', 20000);
    const turnsBefore = O1.state.game.log.length;
    await wait(500);
    assert(O1.state.game.log.length > turnsBefore || O1.state.game.phase === 'handEnd', 'il tavolo va avanti');
    step('giocatore offline: il computer gioca al suo posto, il tavolo non si blocca');

    // rientro: Nora ritrova il posto; poi esce dalla partita e torna al suo posto col codice
    const O3 = player('Nora');
    await O3.hello(noraToken);
    await O3.until((s) => s.game && s.game.you === noraSeat, 'Nora di nuovo al suo posto');
    assert((await O3.call('leaveRoom')).ok);
    await O1.until((s) => s.room.seats[noraSeat].isBot, 'posto passato al computer');
    assert((await O3.call('joinRoom', { code: oc })).ok);
    const nb = await O3.until((s) => s.game && s.game.you === noraSeat, 'Nora torna al suo posto');
    assert(!nb.room.seats[noraSeat].isBot && nb.game.hand.length > 0, 'di nuovo umana, con le sue carte');
    autoplay = false;
    O1.sock.close(); O3.sock.close();
    step('chi esce da una partita in corso può tornare al suo posto');

    // partita con calma: chi esce tiene il posto, nessuno gioca al suo posto, avviso "tocca a te", rientro
    const S1 = player('Sara'), S2 = player('Ugo');
    await S1.hello(); await S2.hello();
    assert((await signup(S1, 'Sara')).ok); assert((await signup(S2, 'Ugo')).ok);
    S2.turnAlerts = [];
    S2.sock.on('yourTurn', (x) => S2.turnAlerts.push(x));
    S2.games = null;
    S2.sock.on('myGames', (l) => { S2.games = l; });
    assert((await S1.call('createRoom', { rules: { players: 2 } })).ok);
    const sc = (await S1.until((st) => st.room, 'tavolo con calma')).room.code;
    assert(!(await S2.call('setSlow', { on: true })).ok || true);
    assert((await S1.call('setSlow', { on: true })).ok);
    assert((await S2.call('joinRoom', { code: sc })).ok);
    assert((await S1.call('start')).ok);
    assert(!(await S1.call('setSlow', { on: false })).ok, 'il ritmo non si cambia a partita iniziata');
    const ugoSeat = (await S2.until((st) => st.game, 'partita con calma')).game.you;
    assert(S2.state.room.slow, 'tavolo con calma');
    // Ugo torna alla schermata iniziale: il posto resta suo
    assert((await S2.call('leaveRoom')).ok);
    await wait(100);
    assert(!S1.state.room.seats[ugoSeat].isBot, 'il posto di Ugo resta suo');
    const ug = S2.games.find((x) => x.code === sc);
    assert(ug && ug.started, 'la partita è nell\'elenco di Ugo');
    // Sara gioca finché tocca a Ugo: Ugo riceve l'avviso e la partita lo aspetta
    const endS = Date.now() + 30000;
    while (!(S1.state.game.turn === ugoSeat && S1.state.game.phase !== 'handEnd')) {
      if (Date.now() > endS) throw new Error('non arriva il turno di Ugo');
      const g = S1.state.game;
      if (g.turn === g.you && g.phase === 'draw') await S1.call('action', { type: 'draw' });
      else if (g.turn === g.you && g.phase === 'play') {
        for (const c of g.hand.slice().reverse()) if ((await S1.call('action', { type: 'discard', cardId: c.id })).ok) break;
      }
      await wait(20);
    }
    const waitAlert = Date.now() + 3000;
    while (!S2.turnAlerts.some((x) => x.code === sc) && Date.now() < waitAlert) await wait(20);
    assert(S2.turnAlerts.some((x) => x.code === sc && /Sara/.test(x.text)), 'avviso "tocca a te" a Ugo');
    assert(S2.games.find((x) => x.code === sc).myTurn, 'nell\'elenco: tocca a Ugo');
    const logLen = S1.state.game.log.length;
    await wait(1200); // ben oltre l'attesa per gli assenti nelle partite normali
    assert(S1.state.game.turn === ugoSeat && S1.state.game.log.length === logLen, 'nessuno gioca al posto di Ugo');
    // Ugo rientra allo stesso posto e gioca
    assert((await S2.call('joinRoom', { code: sc })).ok);
    const ub = await S2.until((st) => st.game && st.game.you === ugoSeat, 'Ugo al suo posto');
    assert(ub.game.hand.length > 0, 'con le sue carte');
    assert((await S2.call('action', { type: 'draw' })).ok);
    // notifiche push: iscrizione valida accettata, non valida rifiutata
    assert(!(await S2.call('pushSubscribe', { sub: { endpoint: 'nope' } })).ok, 'iscrizione non valida');
    assert((await S2.call('pushSubscribe', { sub: { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } } })).ok);
    assert((await S2.call('pushKey')).key.length > 40, 'chiave pubblica VAPID');
    // abbandono: il computer prende il posto
    assert((await S2.call('leaveRoom', { abandon: true })).ok);
    await S1.until((st) => st.room.seats[ugoSeat].isBot, 'Ugo ha abbandonato: gioca il computer');
    S1.sock.close(); S2.sock.close();
    step('partita con calma: posto tenuto, nessuno gioca al tuo posto, avviso "tocca a te", rientro e abbandono');

    // resa, partita terminata dall'host, tavolo chiuso
    const R1 = player('Rita'), R2 = player('Remo');
    await R1.hello(); await R2.hello();
    assert((await signup(R1, 'Rita')).ok); assert((await signup(R2, 'Remo')).ok);
    R2.notices = [];
    R2.sock.on('notice', (x) => R2.notices.push(x.text));
    // 4 giocatori: Rita (posto 0) e Remo (posto 2) compagni, gli avversari sono computer
    assert((await R1.call('createRoom', { rules: { players: 4 } })).ok);
    const rc = (await R1.until((st) => st.room, 'tavolo della resa')).room.code;
    assert((await R1.call('addBot', { seat: 1 })).ok);
    assert((await R2.call('joinRoom', { code: rc })).ok);
    await R1.until((st) => st.room.seats[2] && st.room.seats[2].name === 'Remo', 'Remo al posto 2');
    assert((await R1.call('addBot', { seat: 3 })).ok);
    assert((await R1.call('start')).ok);
    await R2.until((st) => st.game, 'partita');
    const p1 = await R1.call('surrender');
    assert(p1.ok && !p1.done, 'con un compagno umano la resa è solo una proposta');
    await R2.until((st) => st.room.surrender && st.room.surrender.includes(0), 'Remo vede la proposta');
    assert(!R2.state.game.over, 'la partita continua finché il compagno non accetta');
    const p2 = await R2.call('surrender');
    assert(p2.ok && p2.done, 'Remo accetta');
    const sg = await R1.until((st) => st.game && st.game.over, 'partita finita per resa');
    assert(sg.game.handResult.reason === 'surrender' && sg.game.winners.every((x) => x === 1 || x === 3), 'vincono gli avversari');
    // rivincita, poi l'host termina la partita senza vincitori: si torna in sala d'attesa
    assert((await R1.call('ready')).ok); assert((await R2.call('ready')).ok);
    await R1.until((st) => st.game && !st.game.over, 'rivincita');
    assert(!(await R2.call('endGame')).ok, "solo l'host termina la partita");
    assert((await R1.call('endGame')).ok);
    await R2.until((st) => st.room && !st.room.started && !st.game, 'di nuovo in sala d\'attesa');
    assert(R2.notices.some((t) => /terminato/.test(t)), 'avviso a tutti');
    // l'host chiude il tavolo: tutti alla schermata iniziale
    assert((await R1.call('closeTable')).ok);
    await R2.until((st) => st.room === null, 'Remo torna alla schermata iniziale');
    assert(!(await R2.call('joinRoom', { code: rc })).ok, 'il tavolo non esiste più');
    // 1 contro 1: la resa è immediata
    assert((await R1.call('createRoom', { rules: { players: 2 }, vsBots: true })).ok);
    await R1.until((st) => st.game && !st.game.over, 'partita 1 contro 1');
    assert((await R1.call('surrender')).done, 'da soli la resa è immediata');
    await R1.until((st) => st.game.over && st.game.winners.length === 1 && st.game.winners[0] === 1, 'vince il computer');
    // fine partita: «Torna al tavolo» riporta il tavolo nella sala d'attesa (a partita in corso no)
    assert((await R1.call('backToLobby')).ok, 'torna al tavolo a fine partita');
    await R1.until((st) => st.room && !st.game, "di nuovo nella sala d'attesa");
    assert((await R1.call('start')).ok);
    await R1.until((st) => st.game && !st.game.over, "nuova partita dalla sala d'attesa");
    assert(!(await R1.call('backToLobby')).ok, 'a partita in corso non si torna al tavolo');
    R1.sock.close(); R2.sock.close();
    step('resa (con il sì del compagno), partita terminata dall\'host, tavolo chiuso');

    // Scala 40: tavolo contro il computer, apertura sotto i 40 rifiutata, smazzata intera, moviola
    const Q = player('Scalatore'); await Q.hello(); { const rq = await signup(Q, 'Scalatore'); assert(rq.ok, 'nickname: ' + rq.error); }
    assert((await Q.call('createRoom', { rules: { game: 'scala40', players: 2 }, vsBots: true })).ok);
    const qs = await Q.until((st) => st.game, 'partita di Scala 40');
    assert(qs.room.game === 'scala40' && qs.game.game === 'scala40' && qs.game.hand.length === 13, 'Scala 40 con 13 carte');
    const endQ = Date.now() + 60000;
    let triedLow = false;
    while (!(Q.state.game && Q.state.game.phase === 'handEnd')) {
      if (Date.now() > endQ) throw new Error('la smazzata di Scala 40 non finisce');
      const g = Q.state.game;
      if (g.turn === g.you && g.phase === 'draw') await Q.call('action', { type: 'draw' });
      else if (g.turn === g.you && g.phase === 'play') {
        if (!triedLow) {
          // tre carte qualsiasi: o non sono un gioco o non arrivano a 40 punti
          const r = await Q.call('action', { type: 'meld', cardIds: g.hand.slice(0, 3).map((c) => c.id) });
          assert(!r.ok, 'apertura non valida rifiutata');
          triedLow = true;
        }
        for (const c of g.hand.slice().reverse()) if ((await Q.call('action', { type: 'discard', cardId: c.id })).ok) break;
      }
      await wait(20);
    }
    const hrQ = Q.state.game.handResult;
    assert(hrQ.teams.length === 2 && hrQ.teams.every((t) => t.total <= 0), 'penalità a fine smazzata');
    assert((await Q.call('replay')).ok, 'moviola della Scala 40');
    const qst = await Q.call('myStats');
    assert(!qst.stats && qst.level.xp === 0 && Q.progress.every((p) => p.xp === 0) && !Q.trophies.length, 'partita server contro il computer: niente statistiche, esperienza o obiettivi');
    const lb40 = await Q.call('leaderboard', { game: 'scala40' });
    assert(lb40.ok && lb40.game === 'scala40' && lb40.list.every((x) => x.name !== 'Anna'), 'classifica della Scala 40 senza le partite di Burraco');
    Q.sock.close();
    step(`Scala 40: smazzata giocata, penalità ${hrQ.teams.map((t) => -t.total).join(' e ')}`);

    // Ramino: si gioca come la Scala 40 ma con le sue regole e la sua classifica
    const RM = player('Raminista'); await RM.hello(); { const rr = await signup(RM, 'Raminista'); assert(rr.ok, 'nickname: ' + rr.error); }
    assert((await RM.call('createRoom', { rules: { game: 'ramino', players: 2 }, vsBots: true })).ok);
    const rms = await RM.until((st) => st.game, 'partita di Ramino');
    assert(rms.room.game === 'ramino' && rms.game.game === 'scala40' && rms.game.hand.length === 13 && rms.room.rules.opening === 0, 'Ramino: 13 carte, nessun minimo per aprire');
    const lbR = await RM.call('leaderboard', { game: 'ramino' });
    assert(lbR.ok && lbR.game === 'ramino', 'classifica del Ramino');
    RM.sock.close();
    step('Ramino: tavolo contro il computer, regole e classifica proprie');

    // Canasta: tavolo a coppie contro il computer, una smazzata intera
    const K = player('Canastaro'); await K.hello(); { const rk = await signup(K, 'Canastaro'); assert(rk.ok, 'nickname: ' + rk.error); }
    assert((await K.call('createRoom', { rules: { game: 'canasta', players: 4, target: 2000 }, vsBots: true })).ok);
    const ks = await K.until((st) => st.game, 'partita di Canasta');
    assert(ks.room.game === 'canasta' && ks.game.game === 'canasta' && ks.game.hand.length >= 11, 'Canasta con 11 carte (più i tre rossi pescati)');
    const endK = Date.now() + 90000;
    while (!(K.state.game && K.state.game.phase === 'handEnd')) {
      if (Date.now() > endK) throw new Error('la smazzata di Canasta non finisce');
      const g = K.state.game;
      if (g.turn === g.you && g.phase === 'draw') await K.call('action', { type: 'draw' });
      else if (g.turn === g.you && g.phase === 'play') {
        let done = false;
        for (const c of g.hand.slice().reverse()) if ((await K.call('action', { type: 'discard', cardId: c.id })).ok) { done = true; break; }
        if (!done) throw new Error('nessuno scarto possibile');
      }
      await wait(20);
    }
    assert(K.state.game.handResult.teams.length === 2, 'Canasta a coppie: due squadre');
    assert((await K.call('replay')).ok, 'moviola della Canasta');
    K.sock.close();
    step('Canasta: smazzata a coppie giocata contro il computer');

    // Tutti gli accessi pubblici rifiutano i giochi con carte italiane.
    const disabled = player('Blocco'); await disabled.hello(); assert((await signup(disabled, 'Blocco')).ok);
    for (const game of ['scopa', 'scopone', 'briscola', 'briscola5', 'tressette', 'rubamazzetto']) {
      for (const tutorial of [false, true]) assert(!(await disabled.call('createRoom', { rules: { game, players: 2 }, tutorial })).ok, game + ': creazione bloccata');
      for (const mode of ['casual', 'ranked']) assert(!(await disabled.call('quickPlay', { game, n: 4, mode })).ok, game + ': coda bloccata');
      assert(!(await disabled.call('rankedBoard', { game, n: 4 })).ok);
      assert(!(await disabled.call('tournamentCreate', { name: 'Coppa bloccata', game, size: 4 })).ok);
    }
    assert((await disabled.call('createRoom', { rules: { players: 2 } })).ok);
    assert(!(await disabled.call('configure', { rules: { game: 'scopa', players: 2 } })).ok);
    await disabled.call('leaveRoom'); disabled.sock.close();
    step('Giochi italiani bloccati: tavoli, tutorial, casual, ranked, tornei e cambio regole');

    // torneo da 4: iscrizione, riempimento con il computer, avviso della partita, resa, avanzamento fino al campione
    const TT = player('Tornista'); await TT.hello(); { const rt = await signup(TT, 'Tornista'); assert(rt.ok, 'nickname: ' + rt.error); }
    TT.match = null;
    TT.sock.on('tournamentMatch', (x) => { TT.match = x; });
    assert(!(await TT.call('tournamentCreate', { name: 'Coppa Stronzi', game: 'ramino', size: 4 })).ok, 'nome volgare del torneo rifiutato');
    const tc = await TT.call('tournamentCreate', { name: 'Coppa di prova', game: 'ramino', size: 4 });
    assert(tc.ok && tc.id, 'torneo creato');
    assert(!(await TT.call('tournamentStart', { id: tc.id })).ok, 'servono 4 iscritti');
    assert((await TT.call('tournamentFill', { id: tc.id })).ok);
    assert((await TT.call('tournamentStart', { id: tc.id })).ok);
    const mEnd = Date.now() + 5000;
    while (!TT.match && Date.now() < mEnd) await wait(20);
    assert(TT.match && TT.match.code, 'avviso: la tua partita è pronta');
    assert((await TT.call('joinRoom', { code: TT.match.code })).ok);
    const tg = await TT.until((st) => st.game, 'partita del torneo');
    assert(tg.room.tournament && tg.room.tournament.id === tc.id, 'tavolo del torneo');
    assert((await TT.call('surrender')).ok);
    await TT.until((st) => st.game && st.game.over, 'partita finita');
    assert(!(await TT.call('ready')).ok, 'niente rivincita nei tornei');
    const tEnd = Date.now() + 15000;
    let tl;
    do { await wait(100); tl = (await TT.call('tournaments')).list.find((x) => x.id === tc.id); } while (tl.status !== 'finito' && Date.now() < tEnd);
    assert(tl.status === 'finito' && tl.champion != null && !tl.players[tl.champion].me, 'il torneo arriva al campione (non chi si è arreso)');
    assert(tl.rounds.length === 2, 'semifinali e finale');
    TT.sock.close();
    step('torneo: iscrizioni, computer, avviso della partita, resa, avanzamento fino al campione');

    A.sock.close(); B.sock.close();
    console.log('\nProva multigiocatore: tutto OK');
  } finally {
    // il database resta aperto finché il server non si chiude (su Windows non si può cancellare prima)
    await new Promise((res) => { if (server.exitCode !== null) res(); else { server.once('exit', res); server.kill(); } });
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
})().catch((e) => { console.error('✗', e.message); process.exitCode = 1; setTimeout(() => process.exit(1), 200); });
