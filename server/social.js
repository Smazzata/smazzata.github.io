'use strict';
/*
 * Profili e amici.
 * Un profilo è la "sessione" del dispositivo (token segreto) arricchita con:
 *  - nick: nickname univoco (senza distinzione maiuscole/minuscole)
 *  - code: codice personale (anche via QR): sposta il profilo su un altro dispositivo e fa da
 *          "codice di recupero" se si dimentica la password
 *  - pw:   password (obbligatoria per i profili nuovi), salvata solo come hash scrypt con sale
 *  - friends / reqIn / reqOut: token degli amici e delle richieste
 */
const crypto = require('crypto');
const { GameError } = require('./engine');
const Premi = require('../shared/premi');
const Levels = require('./levels');
const Posta = require('./posta');
const Parole = require('../shared/parole');
const Avatars = require('../shared/avatars');

const NICK_RE = /^[A-Za-z0-9_.-]{3,16}$/;
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** età minima per un profilo (in Italia l'età del consenso digitale): chi lo crea lo dichiara con la spunta */
const ETA_MINIMA = 14;
const NO_ETA = `Per creare un profilo devi avere almeno ${ETA_MINIMA} anni e accettare le regole`;
/** chat bloccata «per sempre» (un numero, così si salva in JSON) */
const CHAT_BAN_FOREVER = 8.64e15;
const RESERVED = new Set(['admin', 'host', 'bot', 'computer', 'burraco', 'tu', 'server']);
const AVATAR_EMOJI = ['😀', '😎', '🤠', '🥳', '😇', '🤓', '🧐', '😺', '🐶', '🦊', '🐻', '🐼', '🐸', '🦁', '🐯', '🐵', '🦄', '🐙', '🦉', '🐢', '🌻', '🍀', '⭐', '🔥', '♠️', '♥️', '♦️', '♣️'];
const AVATAR_COLORS = ['#f2c14e', '#64b5f6', '#ef7d7d', '#81c784', '#ba68c8', '#ffb74d', '#4dd0e1', '#e0e0e0'];

module.exports = function createSocial({ io, sessions, isConnected, roomOfToken, renamePlayer, onDelete, onDeleted, notifyOffline }) {
  const nickIndex = new Map(); // nick in minuscolo → token
  const codeIndex = new Map(); // codice personale → token
  const devIndex = new Map(); // impronta della chiave di un dispositivo → token del profilo
  const emailIndex = new Map(); // email verificata (minuscolo) → token
  const attempts = new Map(); // limite tentativi di accesso: chiave → { n, until }
  setInterval(() => {
    for (const [key, a] of attempts) if (a.until <= Date.now()) attempts.delete(key);
  }, 60000).unref();

  function rebuildIndexes() {
    nickIndex.clear(); codeIndex.clear(); devIndex.clear(); emailIndex.clear();
    for (const [token, s] of sessions) {
      if (s.nick) nickIndex.set(s.nick.toLowerCase(), token);
      if (s.code) codeIndex.set(s.code, token);
      if (s.email) emailIndex.set(s.email, token);
      for (const d of s.devices || []) devIndex.set(d.h, token);
      s.friends = s.friends || []; s.reqIn = s.reqIn || []; s.reqOut = s.reqOut || [];
    }
  }

  const fail = (m) => { throw new GameError(m); };
  /** profilo con le liste sempre presenti (anche per sessioni appena create) */
  const withLists = (s) => {
    if (s) { s.friends = s.friends || []; s.reqIn = s.reqIn || []; s.reqOut = s.reqOut || []; s.blocked = s.blocked || []; }
    return s;
  };
  const sess = (token) => withLists(sessions.get(token)) || fail('Sessione non valida');
  const nickOf = (token) => (sessions.get(token) || {}).nick;
  function rememberNickname(s) {
    if (s.nick) s.previousNicks = [...new Set([...(s.previousNicks || []), s.nick])];
  }

  function checkNick(nick, selfToken) {
    nick = String(nick || '').trim();
    if (!NICK_RE.test(nick)) return { available: false, reason: 'Da 3 a 16 caratteri: lettere, numeri, punto, trattino o _' };
    if (RESERVED.has(nick.toLowerCase())) return { available: false, reason: 'Nickname riservato' };
    if (Parole.nickVietato(nick)) return { available: false, reason: 'Nickname non permesso dalle regole' };
    const owner = nickIndex.get(nick.toLowerCase());
    if (owner && owner !== selfToken) return { available: false, reason: 'Già preso' };
    return { available: true };
  }

  function newCode() {
    let c;
    do {
      const b = crypto.randomBytes(12);
      c = 'BUR-' + Array.from(b, (x, i) => CODE_ALPHA[x % 32] + ((i % 4 === 3 && i < 11) ? '-' : '')).join('');
    } while (codeIndex.has(c));
    return c;
  }

  function ensureCode(token) {
    const s = sess(token);
    if (!s.code) { s.code = newCode(); codeIndex.set(s.code, token); }
    return s.code;
  }

  /** Limita i tentativi di accesso (codice o password) per evitare che vengano indovinati */
  // per indirizzo IP il limite è più largo (famiglie e amici dietro la stessa connessione); IP_LIMIT solo per le prove
  function limit(key, max = key.startsWith('ip:') ? Number(process.env.IP_LIMIT) || 30 : 8) {
    const now = Date.now();
    const a = attempts.get(key);
    if (a && a.until > now && a.n >= max) fail('Troppi tentativi: riprova tra qualche minuto');
    if (!a || a.until <= now) attempts.set(key, { n: 1, until: now + 10 * 60 * 1000 });
    else a.n++;
  }

  function hashPassword(pw, salt) {
    return crypto.scryptSync(pw, salt, 64).toString('hex');
  }

  /*
   * Dispositivi: ognuno ha una chiave segreta sua (il server ne tiene solo l'impronta). Cambiando password
   * si revocano le chiavi degli altri dispositivi, che vengono scollegati.
   */
  const keyHash = (key) => crypto.createHash('sha256').update(String(key || '')).digest('hex');
  function newDevice(token) {
    const s = sessions.get(token);
    const key = crypto.randomBytes(18).toString('hex');
    const h = keyHash(key);
    s.devices = (s.devices || []).concat([{ h, at: Date.now() }]);
    while (s.devices.length > 20) devIndex.delete(s.devices.shift().h);
    devIndex.set(h, token);
    return key;
  }
  const resolveDevice = (key) => devIndex.get(keyHash(key)) || null;
  /** scollega tutti i dispositivi del profilo tranne quello con impronta keepHash */
  function revokeDevices(token, keepHash) {
    const s = sessions.get(token);
    for (const d of s.devices || []) if (d.h !== keepHash) devIndex.delete(d.h);
    s.devices = (s.devices || []).filter((d) => d.h === keepHash);
    for (const so of io.sockets.sockets.values()) {
      if (so.data.token === token && so.data.devKey !== keepHash) {
        so.emit('loggedOut', { reason: 'La password del profilo è cambiata: entra di nuovo con la password nuova.' });
        so.data.token = null;
        so.disconnect(true);
      }
    }
  }

  /** email (in italiano: il server non conosce la lingua di chi la riceve) */
  /** email al profilo, nella sua lingua (vedi server/posta.js per i testi) */
  function mailTo(s, kind) {
    if (!s.email || !Posta.enabled()) return;
    const m = Posta.compose(kind, s.lang, { nick: s.nick });
    Posta.send(s.email, m.subject, m.text).catch((e) => console.error('Email non inviata:', e.message));
  }
  /** invia un'email con un codice (nella lingua lang) */
  const sendCode = (kind, lang, to, nick, code) => { const m = Posta.compose(kind, lang, { nick, code }); return Posta.send(to, m.subject, m.text); };
  const sixDigits = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  /** controlla un codice a 6 cifre (scade, massimo 5 tentativi); restituisce true se giusto */
  function checkCode(slot, code) {
    if (!slot || slot.exp < Date.now() || slot.tries >= 5) return false;
    slot.tries++;
    return crypto.timingSafeEqual(Buffer.from(slot.h), Buffer.from(keyHash(String(code || '').replace(/\D/g, ''))));
  }

  /** controlla un'email per il profilo token (formato e non usata da altri); restituisce l'email in minuscolo */
  function checkEmail(email, token) {
    email = String(email || '').trim().toLowerCase();
    if (!Posta.validEmail(email)) fail('Indirizzo email non valido');
    const owner = emailIndex.get(email);
    if (owner && owner !== token) fail('Questa email è già usata da un altro profilo');
    return email;
  }
  /** manda il codice di conferma; restituisce true se l'email è partita */
  async function sendVerify(s, email) {
    const code = sixDigits();
    s.emailCode = { email, h: keyHash(code), exp: Date.now() + 15 * 60000, tries: 0, sent: Date.now() };
    try {
      await sendCode('verify', s.lang, email, s.nick, code);
      return true;
    } catch (e) {
      console.error('Email non inviata:', e.message);
      s.emailCode.sent = 0; // si può richiedere subito
      return false;
    }
  }

  function setPw(s, password) {
    const pw = String(password || '');
    if (pw.length < 6) fail('La password deve avere almeno 6 caratteri');
    if (pw.length > 100) fail('Password troppo lunga');
    const salt = crypto.randomBytes(16).toString('hex');
    s.pw = { salt, hash: hashPassword(pw, salt) };
  }

  /** codice scritto a mano: con o senza trattini, minuscolo, con o senza "BUR" */
  function normCode(code) {
    let c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length === 15 && c.startsWith('BUR')) c = c.slice(3);
    return 'BUR-' + c.replace(/(.{4})(?=.)/g, '$1-');
  }

  /** nuovo codice di recupero per un nickname (dal gestore, pagina di stato): il vecchio smette di valere */
  function adminNewCode(nick) {
    const token = nickIndex.get(String(nick || '').toLowerCase());
    if (!token) return null;
    const s = sess(token);
    if (s.code) codeIndex.delete(s.code);
    s.code = null;
    return ensureCode(token);
  }

  /** Elimina il profilo: libera il nickname, cancella codice, password, email, amicizie e blocchi */
  function deleteProfileOf(token) {
    const s = sess(token);
    if (onDelete) onDelete(token);
    const affected = [];
    for (const [t, other] of sessions) {
      if (t === token) continue;
      const o = withLists(other);
      if ([...o.friends, ...o.reqIn, ...o.reqOut, ...o.blocked].includes(token)) affected.push(t);
      o.friends = o.friends.filter((x) => x !== token);
      o.reqIn = o.reqIn.filter((x) => x !== token);
      o.reqOut = o.reqOut.filter((x) => x !== token);
      o.blocked = o.blocked.filter((x) => x !== token);
    }
    if (s.nick) nickIndex.delete(s.nick.toLowerCase());
    if (s.code) codeIndex.delete(s.code);
    if (s.email) emailIndex.delete(s.email);
    for (const d of s.devices || []) devIndex.delete(d.h);
    sessions.delete(token);
    // Nessun dispositivo può continuare a operare con l'identificativo eliminato.
    const sockets = [...io.sockets.sockets.values()].filter((so) => so.data.token === token);
    for (const so of sockets) {
      if (so.data.room) so.leave(so.data.room);
      so.data.room = null; so.data.token = null; so.data.devKey = null;
    }
    if (onDeleted) onDeleted();
    for (const t of affected) push(t);
    // Lascia prima arrivare l'ack della richiesta; poi cancella anche le credenziali dei client.
    setTimeout(() => {
      for (const so of sockets) {
        so.emit('loggedOut', { reason: 'Profilo eliminato', deleted: true });
        so.disconnect(true);
      }
    }, 50).unref();
  }

  /** nickname libero «Giocatore1234» per chi aveva un nickname non permesso */
  function freeNick() {
    for (;;) {
      const n = 'Giocatore' + (1000 + crypto.randomInt(9000));
      if (!nickIndex.has(n.toLowerCase())) return n;
    }
  }

  /**
   * Moderazione dal gestore (pagina di stato), secondo le regole di comportamento:
   *  avviso · chat bloccata 7 giorni o per sempre · chat sbloccata · nickname cambiato · profilo eliminato.
   * Restituisce una frase per il gestore (null se il nickname non esiste).
   */
  function adminModerate(nick, action) {
    const token = nickIndex.get(String(nick || '').toLowerCase());
    if (!token) return null;
    const s = sess(token);
    const name = s.nick;
    switch (action) {
      case 'avviso':
        s.warn = { at: Date.now(), seen: false };
        push(token);
        return `${name} riceverà un avviso appena apre il gioco.`;
      case 'muta7':
        s.chatBan = Date.now() + 7 * 86400000;
        push(token);
        return `Chat bloccata per 7 giorni a ${name}.`;
      case 'muta':
        s.chatBan = CHAT_BAN_FOREVER;
        push(token);
        return `Chat bloccata per sempre a ${name}.`;
      case 'smuta':
        delete s.chatBan;
        push(token);
        return `Chat di nuovo attiva per ${name}.`;
      case 'rinomina': {
        const n = freeNick();
        nickIndex.delete(name.toLowerCase());
        rememberNickname(s);
        s.nick = n; s.name = n;
        nickIndex.set(n.toLowerCase(), token);
        s.warn = { at: Date.now(), seen: false, renamed: true };
        renamePlayer(token, n);
        push(token); pushFriends(token);
        return `${name} ora si chiama ${n} (riceve un avviso e può scegliere un nickname nuovo dal profilo).`;
      }
      case 'elimina':
        deleteProfileOf(token);
        return `Profilo ${name} eliminato.`;
      default:
        return 'Azione sconosciuta';
    }
  }

  /** Stato social del profilo, inviato a tutti i suoi dispositivi */
  function socialView(token) {
    const s = withLists(sessions.get(token));
    if (!s) return null;
    const entry = (t) => {
      const room = roomOfToken(t);
      return { nick: nickOf(t), avatar: (sessions.get(t) || {}).avatar || null, online: isConnected(t), room: room ? room.code : null, playing: !!(room && room.game) };
    };
    return {
      nick: s.nick || null,
      hasPassword: !!s.pw,
      hasEmail: !!s.email,
      emailPending: !s.email && s.emailCode && s.emailCode.exp > Date.now() ? s.emailCode.email : null,
      avatar: s.avatar || null,
      // moderazione: avviso del gestore da leggere, chat bloccata (fino a quando)
      warn: s.warn && !s.warn.seen ? { renamed: !!s.warn.renamed } : null,
      chatBan: s.chatBan && s.chatBan > Date.now() ? (s.chatBan >= CHAT_BAN_FOREVER ? 'sempre' : s.chatBan) : null,
      friends: s.friends.filter((t) => nickOf(t)).map(entry).sort((a, b) => b.online - a.online || a.nick.localeCompare(b.nick)),
      reqIn: s.reqIn.map(nickOf).filter(Boolean),
      reqOut: s.reqOut.map(nickOf).filter(Boolean),
      blocked: s.blocked.map(nickOf).filter(Boolean),
    };
  }

  function push(token) {
    const view = socialView(token);
    for (const so of io.sockets.sockets.values()) if (so.data.token === token) so.emit('social', view);
  }
  function pushFriends(token) {
    const s = withLists(sessions.get(token));
    if (s) for (const f of s.friends) push(f);
  }

  function tokenByNick(nick) {
    const t = nickIndex.get(String(nick || '').trim().toLowerCase());
    if (!t) fail('Nessun giocatore con questo nickname');
    return t;
  }

  function register(socket, handler) {
    const me = () => socket.data.token || fail('Sessione non valida');
    const ip = socket.handshake.address || 'ip';

    socket.on('checkNick', handler(({ nick }) => checkNick(nick, socket.data.token)));

    socket.on('setNick', handler(({ nick, password, adult }) => {
      const token = me();
      nick = String(nick || '').trim();
      const ok = checkNick(nick, token);
      if (!ok.available) fail(ok.reason);
      const s = sess(token);
      // con le email attive un profilo nuovo nasce solo confermando l'email (startSignup → finishSignup)
      if (!s.nick && Posta.enabled()) fail("Conferma l'email per creare il profilo");
      if (!s.nick && adult !== true) fail(NO_ETA);
      if (!s.nick || !s.pw) setPw(s, password);
      if (!s.nick) s.terms = Date.now(); // quando ha dichiarato l'età e accettato le regole
      if (s.nick) nickIndex.delete(s.nick.toLowerCase());
      rememberNickname(s);
      s.nick = nick;
      s.name = nick;
      nickIndex.set(nick.toLowerCase(), token);
      ensureCode(token);
      renamePlayer(token, nick);
      push(token);
      pushFriends(token);
      return { nick, code: s.code };
    }));

    socket.on('setAvatar', handler(({ id, e, c }) => {
      const token = me();
      const s = sess(token);
      if (!AVATAR_COLORS.includes(c)) fail('Avatar non valido');
      let avatar;
      if (id !== undefined) {
        avatar = Avatars.byId.get(id);
        if (!avatar) fail('Avatar non valido');
      } else {
        if (!AVATAR_EMOJI.includes(e)) fail('Avatar non valido');
        // I client precedenti inviano ancora la chiave emoji; il colore non cambia l'identità.
        avatar = s.avatar && s.avatar.e === e && Avatars.byId.get(s.avatar.id) || Avatars.resolve(e);
      }
      // Le scelte già salvate restano utilizzabili; cambiarne lo sfondo non assegna un nuovo avatar.
      const owned = Avatars.ownedIds(s);
      if (!owned.includes(avatar.id)) fail('Questo avatar non è ancora disponibile');
      s.avatarOwned = owned;
      // e è la rappresentazione di compatibilità per i client precedenti; id identifica l'illustrazione.
      s.avatar = { ...(s.avatar || {}), id:avatar.id, e:avatar.e, c };
      renamePlayer(token, null);
      push(token);
      pushFriends(token);
      return { avatar: s.avatar };
    }));

    // Il mio stile: titolo sotto il nome e cornice dell'avatar, tra i premi sbloccati giocando
    socket.on('setLook', handler(({ title, frame }) => {
      const token = me();
      const s = sess(token);
      if (!s.nick) fail('Scegli prima un nickname');
      const e = (require('./contesto').leaderboard.get(token)) || {};
      const mine = { level: Levels.levelOf(e).level, trophies: e.trophies || {} };
      const ok = (id, kind) => id && Premi.BY_ID[id] && Premi.BY_ID[id].kind === kind && Premi.isUnlocked(Premi.BY_ID[id], mine);
      if (title !== undefined && title !== null && !ok(title, 'title')) fail('Titolo non ancora sbloccato');
      if (frame !== undefined && frame !== null && !ok(frame, 'frame')) fail('Cornice non ancora sbloccata');
      const av = { ...(s.avatar || { e: s.nick.charAt(0).toUpperCase(), c: '#f2c14e' }) };
      if (title !== undefined) { if (title && title !== 't_principiante') av.t = Premi.BY_ID[title].name; else delete av.t; av.tid = title || undefined; }
      if (frame !== undefined) { if (frame && frame !== 'f_nessuna') av.f = frame.slice(2); else delete av.f; }
      s.avatar = av;
      renamePlayer(token, null);
      push(token);
      pushFriends(token);
      return { avatar: s.avatar };
    }));

    socket.on('profile', handler(() => {
      const token = me();
      const s = sess(token);
      return { nick: s.nick || null, code: s.nick ? ensureCode(token) : null, hasPassword: !!s.pw, email: s.email || null, emailPending: s.emailCode && s.emailCode.exp > Date.now() ? s.emailCode.email : null, emailLast: s.emailCode ? s.emailCode.email : null, mail: Posta.enabled(), avatar: s.avatar || null, ownedAvatarIds: Avatars.ownedIds(s), emoji: AVATAR_EMOJI, colors: AVATAR_COLORS };
    }));

    socket.on('regenCode', handler(() => {
      const token = me();
      const s = sess(token);
      if (s.code) codeIndex.delete(s.code);
      s.code = null;
      return { code: ensureCode(token) };
    }));

    socket.on('setPassword', handler(({ password }) => {
      const s = sess(me());
      if (!s.nick) fail('Scegli prima un nickname');
      const had = !!s.pw;
      setPw(s, password);
      if (had) {
        revokeDevices(me(), socket.data.devKey);
        mailTo(s, 'changedInside');
      }
      push(me());
      return {};
    }));

    // Spostare il profilo su questo dispositivo: col codice personale o con nickname + password
    socket.on('importProfile', handler(({ code }) => {
      limit('ip:' + ip);
      const token = codeIndex.get(normCode(code));
      if (!token) fail('Codice non valido');
      return { token: newDevice(token), nick: nickOf(token) };
    }, true));

    socket.on('login', handler(({ nick, password }) => {
      limit('ip:' + ip);
      limit('nick:' + String(nick || '').toLowerCase());
      const t = nickIndex.get(String(nick || '').trim().toLowerCase());
      const s = t && sessions.get(t);
      if (!s || !s.pw) fail('Nickname o password errati');
      const h = hashPassword(String(password || ''), s.pw.salt);
      if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(s.pw.hash, 'hex'))) fail('Nickname o password errati');
      return { token: newDevice(t), nick: s.nick };
    }, true));

    // Password dimenticata: nickname + codice di recupero → nuova password
    socket.on('resetPassword', handler(({ nick, code, password }) => {
      limit('ip:' + ip);
      limit('nick:' + String(nick || '').toLowerCase());
      const t = nickIndex.get(String(nick || '').trim().toLowerCase());
      if (!t || codeIndex.get(normCode(code)) !== t) fail('Nickname o codice di recupero errati');
      const s = sess(t);
      setPw(s, password);
      revokeDevices(t, null);
      mailTo(s, 'changedByCode');
      return { token: newDevice(t), nick: s.nick };
    }));

    // --- Registrazione con email: il profilo nasce solo dopo aver scritto il codice arrivato per email ---
    socket.on('startSignup', handler(async ({ nick, password, email, adult }) => {
      const token = me();
      const s = sess(token);
      if (s.nick) fail('Hai già un profilo');
      if (!Posta.enabled()) fail('Le email non sono attive su questo server');
      if (adult !== true) fail(NO_ETA);
      nick = String(nick || '').trim();
      const ok = checkNick(nick, token);
      if (!ok.available) fail(ok.reason);
      const tmp = {};
      setPw(tmp, password);
      email = checkEmail(email, token);
      if (s.signup && s.signup.email === email && Date.now() - s.signup.sent < 60000) fail('Aspetta un minuto prima di chiedere un altro codice');
      limit('ip:mail:' + ip);
      const code = sixDigits();
      s.signup = { nick, pw: tmp.pw, email, h: keyHash(code), exp: Date.now() + 15 * 60000, tries: 0, sent: Date.now() };
      try {
        await sendCode('signup', s.lang, email, nick, code);
      } catch (e) {
        s.signup = null;
        console.error('Email non inviata:', e.message);
        fail("Invio dell'email non riuscito: controlla l'indirizzo o riprova più tardi");
      }
      return { email };
    }));

    socket.on('finishSignup', handler(({ code }) => {
      const token = me();
      const s = sess(token);
      const su = s.signup;
      if (s.nick) fail('Hai già un profilo');
      if (!su) fail('Prima chiedi il codice');
      if (!checkCode(su, code)) fail(su.tries >= 5 || su.exp < Date.now() ? 'Codice scaduto: chiedine uno nuovo' : 'Codice sbagliato');
      // nel frattempo nickname o email potrebbero essere stati presi
      const ok = checkNick(su.nick, token);
      if (!ok.available) { s.signup = null; fail(ok.reason); }
      checkEmail(su.email, token);
      s.nick = su.nick;
      s.name = su.nick;
      s.pw = su.pw;
      s.email = su.email;
      s.terms = Date.now(); // quando ha dichiarato l'età e accettato le regole (spunta chiesta da startSignup)
      s.signup = null;
      nickIndex.set(s.nick.toLowerCase(), token);
      emailIndex.set(s.email, token);
      ensureCode(token);
      renamePlayer(token, s.nick);
      push(token);
      pushFriends(token);
      return { nick: s.nick, code: s.code };
    }));

    // --- Email: aggiunta con codice di verifica, recupero della password ---
    socket.on('setEmail', handler(async ({ email }) => {
      const token = me();
      const s = sess(token);
      if (!s.nick) fail('Scegli prima un nickname');
      if (!Posta.enabled()) fail('Le email non sono attive su questo server');
      email = checkEmail(email, token);
      if (s.emailCode && Date.now() - s.emailCode.sent < 60000) fail('Aspetta un minuto prima di chiedere un altro codice');
      limit('ip:mail:' + ip);
      if (!(await sendVerify(s, email))) fail("Invio dell'email non riuscito: riprova più tardi");
      push(token);
      return { pending: email };
    }));

    socket.on('verifyEmail', handler(({ code }) => {
      const token = me();
      const s = sess(token);
      const slot = s.emailCode;
      if (!slot) fail('Prima chiedi il codice');
      if (!checkCode(slot, code)) fail(slot.tries >= 5 || slot.exp < Date.now() ? 'Codice scaduto: chiedine uno nuovo' : 'Codice sbagliato');
      const owner = emailIndex.get(slot.email);
      if (owner && owner !== token) fail('Questa email è già usata da un altro profilo');
      if (s.email) emailIndex.delete(s.email);
      s.email = slot.email;
      s.emailCode = null;
      emailIndex.set(s.email, token);
      push(token);
      return { email: s.email };
    }));

    // Password dimenticata, via email: si manda un codice all'email verificata (la risposta è sempre la stessa,
    // così non si scopre quali email sono registrate)
    socket.on('forgotPassword', handler(({ email }) => {
      limit('ip:' + ip);
      email = String(email || '').trim().toLowerCase();
      if (!Posta.enabled()) fail('Le email non sono attive su questo server');
      const t = emailIndex.get(email);
      const s = t && sessions.get(t);
      if (s && !(s.resetCode && Date.now() - s.resetCode.sent < 60000)) {
        const code = sixDigits();
        s.resetCode = { h: keyHash(code), exp: Date.now() + 15 * 60000, tries: 0, sent: Date.now() };
        sendCode('reset', s.lang, email, s.nick, code)
          .catch((e) => console.error('Email non inviata:', e.message));
      }
      return {};
    }));

    socket.on('resetWithEmail', handler(({ email, code, password }) => {
      limit('ip:' + ip);
      const t = emailIndex.get(String(email || '').trim().toLowerCase());
      const s = t && sessions.get(t);
      if (!s || !checkCode(s.resetCode, code)) fail('Codice sbagliato o scaduto');
      setPw(s, password);
      s.resetCode = null;
      revokeDevices(t, null);
      mailTo(s, 'changedByEmail');
      return { token: newDevice(t), nick: s.nick };
    }));

    socket.on('social', handler(() => ({ social: socialView(me()) })));

    // Elimina il profilo: libera il nickname, cancella codice, password e amicizie
    socket.on('deleteProfile', handler(() => {
      deleteProfileOf(me());
      return {};
    }));

    // avviso del gestore letto: non si mostra più
    socket.on('warnSeen', handler(() => {
      const s = sess(me());
      if (s.warn) s.warn.seen = true;
      push(me());
      return {};
    }));

    socket.on('friendRequest', handler(({ nick }) => {
      const token = me();
      const s = sess(token);
      if (!s.nick) fail('Scegli prima il tuo nickname');
      const other = tokenByNick(nick);
      if (other === token) fail('Non puoi aggiungere te stesso');
      const o = sess(other);
      if (s.blocked.includes(other)) fail('Hai bloccato questo giocatore: sbloccalo prima');
      if (o.blocked.includes(token)) fail('Non è possibile inviare la richiesta');
      if (s.friends.includes(other)) fail('Siete già amici');
      if (s.reqIn.includes(other)) {
        // aveva già chiesto lui: diventate amici subito
        s.reqIn = s.reqIn.filter((t) => t !== other); o.reqOut = o.reqOut.filter((t) => t !== token);
        s.friends.push(other); o.friends.push(token);
      } else if (!s.reqOut.includes(other)) {
        s.reqOut.push(other); o.reqIn.push(token);
      }
      push(token); push(other);
      return {};
    }));

    socket.on('friendRespond', handler(({ nick, accept }) => {
      const token = me();
      const s = sess(token);
      const other = tokenByNick(nick);
      if (!s.reqIn.includes(other)) fail('Nessuna richiesta da questo giocatore');
      const o = sess(other);
      s.reqIn = s.reqIn.filter((t) => t !== other);
      o.reqOut = o.reqOut.filter((t) => t !== token);
      if (accept) { s.friends.push(other); o.friends.push(token); }
      push(token); push(other);
      return {};
    }));

    socket.on('friendRemove', handler(({ nick }) => {
      const token = me();
      const s = sess(token);
      const other = tokenByNick(nick);
      const o = sess(other);
      s.friends = s.friends.filter((t) => t !== other); o.friends = o.friends.filter((t) => t !== token);
      s.reqOut = s.reqOut.filter((t) => t !== other); o.reqIn = o.reqIn.filter((t) => t !== token);
      push(token); push(other);
      return {};
    }));

    // Blocca: niente più richieste né inviti da quel giocatore, e l'amicizia viene tolta
    socket.on('blockPlayer', handler(({ nick }) => {
      const token = me();
      const s = sess(token);
      const other = tokenByNick(nick);
      if (other === token) fail('Non puoi bloccare te stesso');
      const o = sess(other);
      s.friends = s.friends.filter((t) => t !== other); o.friends = o.friends.filter((t) => t !== token);
      s.reqIn = s.reqIn.filter((t) => t !== other); s.reqOut = s.reqOut.filter((t) => t !== other);
      o.reqIn = o.reqIn.filter((t) => t !== token); o.reqOut = o.reqOut.filter((t) => t !== token);
      if (!s.blocked.includes(other)) s.blocked.push(other);
      push(token); push(other);
      return {};
    }));

    socket.on('unblockPlayer', handler(({ nick }) => {
      const token = me();
      const s = sess(token);
      const other = tokenByNick(nick);
      s.blocked = s.blocked.filter((t) => t !== other);
      push(token);
      return {};
    }));

    socket.on('inviteFriend', handler(({ nick }) => {
      const token = me();
      const s = sess(token);
      const other = tokenByNick(nick);
      if (!s.friends.includes(other)) fail('Puoi invitare solo i tuoi amici');
      const room = roomOfToken(token);
      if (!room) fail('Entra prima in un tavolo');
      if (!isConnected(other)) {
        // amico non collegato: se ha attivato le notifiche gli arriva comunque l'invito
        if (notifyOffline && notifyOffline(other, { title: 'Smazzata: invito 🎴', body: `${s.nick} ti invita al tavolo ${room.code}`, tag: 'invite-' + room.code, code: room.code })) return { sent: 0, pushed: true };
        fail(`${nickOf(other)} non è online`);
      }
      let sent = 0;
      for (const so of io.sockets.sockets.values()) {
        if (so.data.token === other) { so.emit('invite', { from: s.nick, code: room.code, started: !!room.game }); sent++; }
      }
      return { sent };
    }));
  }

  return { keyHash, newDevice, resolveDevice, rebuildIndexes, register, push, pushFriends, socialView, checkNick, adminNewCode, adminModerate, nicks: () => [...nickIndex.values()].map(nickOf).filter(Boolean).sort((a, b) => a.localeCompare(b)) };
};
