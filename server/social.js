'use strict';
/*
 * Profili e amici.
 * Un profilo è la "sessione" del dispositivo (token segreto) arricchita con:
 *  - nick: nickname univoco (senza distinzione maiuscole/minuscole)
 *  - code: codice personale per spostare il profilo su un altro dispositivo (anche via QR)
 *  - pw:   password facoltativa, salvata solo come hash scrypt con sale
 *  - friends / reqIn / reqOut: token degli amici e delle richieste
 */
const crypto = require('crypto');
const { GameError } = require('./engine');

const NICK_RE = /^[A-Za-z0-9_.-]{3,16}$/;
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RESERVED = new Set(['admin', 'host', 'bot', 'computer', 'burraco', 'tu', 'server']);
const AVATAR_EMOJI = ['😀', '😎', '🤠', '🥳', '😇', '🤓', '🧐', '😺', '🐶', '🦊', '🐻', '🐼', '🐸', '🦁', '🐯', '🐵', '🦄', '🐙', '🦉', '🐢', '🌻', '🍀', '⭐', '🔥', '♠️', '♥️', '♦️', '♣️'];
const AVATAR_COLORS = ['#f2c14e', '#64b5f6', '#ef7d7d', '#81c784', '#ba68c8', '#ffb74d', '#4dd0e1', '#e0e0e0'];

module.exports = function createSocial({ io, sessions, isConnected, roomOfToken, renamePlayer, onDelete }) {
  const nickIndex = new Map(); // nick in minuscolo → token
  const codeIndex = new Map(); // codice personale → token
  const attempts = new Map(); // limite tentativi di accesso: chiave → { n, until }

  function rebuildIndexes() {
    nickIndex.clear(); codeIndex.clear();
    for (const [token, s] of sessions) {
      if (s.nick) nickIndex.set(s.nick.toLowerCase(), token);
      if (s.code) codeIndex.set(s.code, token);
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

  function checkNick(nick, selfToken) {
    nick = String(nick || '').trim();
    if (!NICK_RE.test(nick)) return { available: false, reason: 'Da 3 a 16 caratteri: lettere, numeri, punto, trattino o _' };
    if (RESERVED.has(nick.toLowerCase())) return { available: false, reason: 'Nickname riservato' };
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
  function limit(key) {
    const now = Date.now();
    const a = attempts.get(key);
    if (a && a.until > now && a.n >= 8) fail('Troppi tentativi: riprova tra qualche minuto');
    if (!a || a.until <= now) attempts.set(key, { n: 1, until: now + 10 * 60 * 1000 });
    else a.n++;
  }

  function hashPassword(pw, salt) {
    return crypto.scryptSync(pw, salt, 64).toString('hex');
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
      avatar: s.avatar || null,
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

    socket.on('setNick', handler(({ nick }) => {
      const token = me();
      nick = String(nick || '').trim();
      const ok = checkNick(nick, token);
      if (!ok.available) fail(ok.reason);
      const s = sess(token);
      if (s.nick) nickIndex.delete(s.nick.toLowerCase());
      s.nick = nick;
      s.name = nick;
      nickIndex.set(nick.toLowerCase(), token);
      ensureCode(token);
      renamePlayer(token, nick);
      push(token);
      pushFriends(token);
      return { nick };
    }));

    socket.on('setAvatar', handler(({ e, c }) => {
      const token = me();
      const s = sess(token);
      if (!AVATAR_EMOJI.includes(e) || !AVATAR_COLORS.includes(c)) fail('Avatar non valido');
      s.avatar = { e, c };
      renamePlayer(token, null);
      push(token);
      pushFriends(token);
      return { avatar: s.avatar };
    }));

    socket.on('profile', handler(() => {
      const token = me();
      const s = sess(token);
      return { nick: s.nick || null, code: s.nick ? ensureCode(token) : null, hasPassword: !!s.pw, avatar: s.avatar || null, emoji: AVATAR_EMOJI, colors: AVATAR_COLORS };
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
      const pw = String(password || '');
      if (pw.length < 6) fail('La password deve avere almeno 6 caratteri');
      if (pw.length > 100) fail('Password troppo lunga');
      const salt = crypto.randomBytes(16).toString('hex');
      s.pw = { salt, hash: hashPassword(pw, salt) };
      return {};
    }));

    // Spostare il profilo su questo dispositivo: col codice personale o con nickname + password
    socket.on('importProfile', handler(({ code }) => {
      limit('ip:' + ip);
      // accetta il codice con o senza trattini, minuscolo, con o senza "BUR"
      let c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (c.length === 15 && c.startsWith('BUR')) c = c.slice(3);
      const norm = 'BUR-' + c.replace(/(.{4})(?=.)/g, '$1-');
      const token = codeIndex.get(norm);
      if (!token) fail('Codice non valido');
      return { token, nick: nickOf(token) };
    }));

    socket.on('login', handler(({ nick, password }) => {
      limit('ip:' + ip);
      limit('nick:' + String(nick || '').toLowerCase());
      const t = nickIndex.get(String(nick || '').trim().toLowerCase());
      const s = t && sessions.get(t);
      if (!s || !s.pw) fail('Nickname o password errati');
      const h = hashPassword(String(password || ''), s.pw.salt);
      if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(s.pw.hash, 'hex'))) fail('Nickname o password errati');
      return { token: t, nick: s.nick };
    }));

    socket.on('social', handler(() => ({ social: socialView(me()) })));

    // Elimina il profilo: libera il nickname, cancella codice, password e amicizie
    socket.on('deleteProfile', handler(() => {
      const token = me();
      const s = sess(token);
      for (const t of [...s.friends, ...s.reqIn, ...s.reqOut]) {
        const o = withLists(sessions.get(t));
        if (!o) continue;
        o.friends = o.friends.filter((x) => x !== token);
        o.reqIn = o.reqIn.filter((x) => x !== token);
        o.reqOut = o.reqOut.filter((x) => x !== token);
        push(t);
      }
      if (s.nick) nickIndex.delete(s.nick.toLowerCase());
      if (s.code) codeIndex.delete(s.code);
      delete s.nick; delete s.code; delete s.pw; delete s.avatar;
      s.friends = []; s.reqIn = []; s.reqOut = []; s.blocked = []; s.name = 'Giocatore';
      if (onDelete) onDelete(token);
      push(token);
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
      if (!isConnected(other)) fail(`${nickOf(other)} non è online`);
      let sent = 0;
      for (const so of io.sockets.sockets.values()) {
        if (so.data.token === other) { so.emit('invite', { from: s.nick, code: room.code, started: !!room.game }); sent++; }
      }
      return { sent };
    }));
  }

  return { rebuildIndexes, register, push, pushFriends, socialView, checkNick };
};
