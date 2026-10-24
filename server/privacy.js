'use strict';

// Conservazione e cancellazione dei dati: nessun accesso al server di produzione nei test.
const fs = require('fs');
const path = require('path');
const DAY = 86400000;
const BACKUP_DAYS = 7;
const REPORT_DAYS = 90;
const DELETED_NAME = 'Profilo eliminato';

function privateCopies(dataDir) {
  const files = [];
  if (!fs.existsSync(dataDir)) return files;
  for (const e of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (e.isFile() && (/^prima-del-reset-.*\.json$/.test(e.name) || /^stato\.json\.(importato|prima-del-ripristino|tmp)$/.test(e.name))) files.push(path.join(dataDir, e.name));
  }
  const dir = path.join(dataDir, 'backups');
  if (fs.existsSync(dir) && !fs.lstatSync(dir).isSymbolicLink()) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && /^backup-[\dT.Z-]+\.json$/.test(e.name)) files.push(path.join(dir, e.name));
    }
  }
  return files;
}

function cleanCopies(dataDir, { all = false, now = Date.now() } = {}) {
  for (const f of privateCopies(dataDir)) {
    if (all || now - fs.statSync(f).mtimeMs >= BACKUP_DAYS * DAY) fs.unlinkSync(f);
  }
}

// Sostituisce identificativi anche nei log/moviole, senza cambiare carte o punteggi.
function scrub(value, token, names) {
  if (typeof value === 'string') {
    if (value === token) return null;
    for (const name of names) {
      if (!name) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      value = value.replace(new RegExp(`(^|[^A-Za-z0-9_.-])${escaped}(?=$|[^A-Za-z0-9_.-])`, 'gi'), (m, before) => before + DELETED_NAME);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => scrub(v, token, names));
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key === token) delete value[key];
      else value[key] = scrub(value[key], token, names);
    }
  }
  return value;
}

function eraseRelated(ctx, token, dataDir) {
  const session = ctx.sessions.get(token) || {};
  const names = [...new Set([session.nick, session.name, session.email, session.code, ...(session.previousNicks || [])].filter((n) => n && n !== 'Giocatore'))];
  // Prima di confermare la cancellazione eliminiamo tutte le copie locali precedenti.
  // Se fallisce, la richiesta restituisce un errore e può essere ripetuta.
  cleanCopies(dataDir, { all: true });
  if(ctx.deliveries) scrub(ctx.deliveries, token, names);
  ctx.leaderboard.delete(token);
  if (ctx.Ranked) ctx.Ranked.cancel(token);
  if (ctx.ranked) {
    delete ctx.ranked.players[token];
    scrub(ctx.ranked, token, names);
  }
  for (const e of ctx.leaderboard.values()) {
    // Gli storici salvati prima di un cambio nickname possono contenere il vecchio nome.
    if (e.history) e.history = scrub(e.history.filter((h) => !(h.tokens || []).includes(token)), token, names);
    if (e.timeline) {
      for (const row of e.timeline) {
        if (row.opponentTokens) {
          row.o = (row.o || []).map((n, i) => row.opponentTokens[i] === token ? DELETED_NAME : n);
        } else if (row.o && row.o.length) {
          // Nei vecchi dati c'erano solo nomi: senza associazione affidabile li anonimizzamo tutti.
          row.o = row.o.map(() => DELETED_NAME);
        }
      }
      e.timeline = scrub(e.timeline, token, names);
    }
  }
  for (const m of ctx.daily.values()) delete m[token];
  ctx.League.forget(token);
  for (const lg of ctx.leagues.values()) scrub(lg, token, names);
  for (const t of ctx.tournaments.values()) {
    for (const p of t.players || []) if (p.token === token) {
      delete p.token; p.bot = true; p.name = DELETED_NAME;
    }
    if (t.owner === token) t.owner = ((t.players || []).find((p) => p.token) || {}).token || null;
    scrub(t, token, names);
  }
  // Le segnalazioni collegate si eliminano; non si conserva uno storico personale occulto.
  ctx.reports = ctx.reports.filter((r) => JSON.stringify(scrub(JSON.parse(JSON.stringify(r)), token, names)) === JSON.stringify(r));
  for (const room of ctx.rooms.values()) {
    for (let i = 0; i < room.seats.length; i++) {
      const s = room.seats[i];
      if (!s || (s.token !== token && s.leftToken !== token)) continue;
      if (!room.game) { room.seats[i] = null; continue; }
      room.seats[i] = { isBot: true, token: null, name: DELETED_NAME };
      room.game.players[i].isBot = true;
      room.game.players[i].name = DELETED_NAME;
      room.botMemo = {};
    }
    room.spectators = (room.spectators || []).filter((t) => t !== token);
    if (room.hostToken === token) room.hostToken = ((room.seats || []).find((s) => s && !s.isBot) || {}).token || null;
    // Non attraversare timer e memorie runtime: solo i dati di gioco serializzabili.
    for (const key of ['game', 'series', 'chatLog', 'music', 'rankedMatch']) if (room[key]) scrub(room[key], token, names);
    if (!room.seats.some((s) => s && !s.isBot)) {
      clearTimeout(room.botTimer); ctx.rooms.delete(room.code);
    } else ctx.broadcast(room);
  }
}

function expireReports(ctx, now = Date.now()) {
  const old = ctx.reports.length;
  ctx.reports = ctx.reports.filter((r) => Number.isFinite(r.at) && r.at > now - REPORT_DAYS * DAY).slice(0, 100);
  let changed = old !== ctx.reports.length;
  for (const d of ctx.daily.keys()) {
    const day = Date.parse(d + 'T00:00:00Z');
    if (!Number.isFinite(day) || day <= now - 7 * DAY) { ctx.daily.delete(d); changed = true; }
  }
  return changed;
}

module.exports = { BACKUP_DAYS, REPORT_DAYS, DELETED_NAME, privateCopies, cleanCopies, scrub, eraseRelated, expireReports };
