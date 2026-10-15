'use strict';
/*
 * Serie di giorni di gioco e promemoria gentili (notifiche push, solo a chi le ha attivate e non le ha spente
 * con «Promemoria» nelle impostazioni; mai di notte, mai insistenti):
 *  - la sera, se c'è una serie aperta e oggi non si è ancora giocato: «Non perdere la tua serie di N giorni»;
 *  - dopo 3 giorni senza giocare: «Ti va una partita?» (al massimo ogni 4 giorni);
 *  - quando degli amici iniziano una partita insieme: «Mario e Lucia stanno giocando a Burraco» (al massimo ogni 12 ore).
 * I giorni sono quelli italiani (Europe/Rome).
 */
const ctx = require('./contesto');
const { HOME_URL } = require('./config');
const { sessions, leaderboard } = ctx;
const isConnected = (...a) => ctx.isConnected(...a);
const Games = require('./games');

const DAY = 24 * 3600 * 1000;
/** data italiana AAAA-MM-GG */
const romeDay = (t = Date.now()) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const romeHour = (t = Date.now()) => Number(new Date(t).toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }));
const dayBefore = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / DAY);

/** si è giocata una smazzata oggi: la serie sale (o riparte da 1 se si è saltato un giorno) */
function markPlayed(e) {
  const today = romeDay();
  if (e.lastDay === today) return false;
  e.streak = e.lastDay === dayBefore(today) ? (e.streak || 0) + 1 : 1;
  e.lastDay = today;
  e.bestStreak = Math.max(e.bestStreak || 0, e.streak);
  return true;
}

/** serie attuale (vale se si è giocato oggi o ieri), record, e se oggi si è già giocato */
function streakOf(e) {
  if (!e || !e.lastDay) return { streak: 0, best: 0, today: false };
  const today = romeDay();
  const alive = e.lastDay === today || e.lastDay === dayBefore(today);
  return { streak: alive ? e.streak || 0 : 0, best: e.bestStreak || 0, today: e.lastDay === today };
}

const send = (token, title, body, tag) => ctx.push && ctx.push.send(token, { title, body, tag, url: HOME_URL }).catch(() => {});
const canRemind = (token, s) => s && s.nick && s.push && s.push.length && s.remind !== false && !isConnected(token);

/** controllo periodico: serie in pericolo, giocatori che non si vedono da un po' */
function tick(now = Date.now()) {
  const hour = romeHour(now);
  if (hour < 10 || hour >= 21) return 0; // mai di notte né di prima mattina
  const today = romeDay(now);
  let sent = 0;
  for (const [token, s] of sessions) {
    if (!canRemind(token, s)) continue;
    const e = leaderboard.get(token);
    if (!e || !e.lastDay) continue;
    const st = streakOf(e);
    if (st.streak >= 2 && !st.today && hour >= 18 && s.remindStreak !== today) {
      s.remindStreak = today;
      send(token, 'Smazzata 🔥', `Non perdere la tua serie di ${st.streak} giorni: basta una smazzata!`, 'serie');
      sent++;
      continue;
    }
    if (daysBetween(e.lastDay, today) >= 3 && (!s.remindAt || now - s.remindAt > 4 * DAY)) {
      s.remindAt = now;
      send(token, 'Ti va una partita? 🃏', 'La sfida del giorno ti aspetta, e anche i tuoi amici.', 'ritorno');
      sent++;
    }
  }
  if (sent) ctx.scheduleSave();
  return sent;
}

/** una partita con più persone è iniziata: lo si dice agli amici che non sono collegati */
function friendsPlaying(room) {
  const humans = room.seats.filter((x) => x && !x.isBot && x.token);
  if (humans.length < 2) return 0;
  const inRoom = new Set(humans.map((x) => x.token));
  const names = humans.map((x) => x.name);
  const who = names.length > 2 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names.join(' e ');
  const game = Games.of(room).name;
  const now = Date.now();
  const told = new Set();
  let sent = 0;
  for (const h of humans) {
    for (const f of (sessions.get(h.token) || {}).friends || []) {
      if (inRoom.has(f) || told.has(f)) continue;
      const s = sessions.get(f);
      if (!canRemind(f, s) || (s.remindFriendsAt && now - s.remindFriendsAt < 12 * 3600 * 1000)) continue;
      told.add(f);
      s.remindFriendsAt = now;
      send(f, 'Smazzata 👥', `${who} stanno giocando a ${game}: apri Smazzata per salutarli o per la prossima partita.`, 'amici');
      sent++;
    }
  }
  return sent;
}

setInterval(() => { try { tick(); } catch (e) { console.error('Promemoria:', e.message); } }, 30 * 60 * 1000).unref();

Object.assign(ctx, { markPlayed, streakOf, friendsPlaying, remindTick: tick });
module.exports = { markPlayed, streakOf, friendsPlaying, tick, romeDay, dayBefore };
