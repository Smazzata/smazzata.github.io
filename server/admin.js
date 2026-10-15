'use strict';
/*
 * Controllo del server: ultimi errori, uso del processore e ritardo, pagina di stato protetta
 * da chiave (/stato?k=…) e /health per la pagina d'ingresso.
 */
const Games = require('./games');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');
const ctx = require('./contesto');
const { io, sessions, rooms } = ctx;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const isConnected = (...a) => ctx.isConnected(...a);

/* ---------- Ultimi errori (per la pagina di stato) ---------- */
const recentErrors = [];
const origError = console.error.bind(console);
console.error = (...args) => {
  recentErrors.push({ at: Date.now(), text: args.map((a) => (a && a.stack) || String(a)).join(' ').slice(0, 500) });
  if (recentErrors.length > 30) recentErrors.shift();
  origError(...args);
};
const startedAt = Date.now();

/* ritardo del server (event loop) e uso del processore, per la pagina di stato */
const { monitorEventLoopDelay } = require('perf_hooks');
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();
let cpuMark = { t: Date.now(), u: process.cpuUsage() };
let cpuPct = 0;
setInterval(() => {
  const now = Date.now(), u = process.cpuUsage();
  cpuPct = Math.round(((u.user - cpuMark.u.user + u.system - cpuMark.u.system) / 1000 / (now - cpuMark.t)) * 100);
  cpuMark = { t: now, u };
}, 5000).unref();

/* chiave della pagina di stato: generata al primo avvio e salvata accanto ai dati */
function adminKey() {
  const f = path.join(DATA_DIR, 'admin-key.txt');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { /* da creare */ }
  const k = crypto.randomBytes(9).toString('base64url');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(f, k);
  return k;
}
const ADMIN_KEY = process.env.ADMIN_KEY || adminKey();

function gitVersion() {
  try {
    const head = fs.readFileSync(path.join(__dirname, '..', '.git', 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref:') ? fs.readFileSync(path.join(__dirname, '..', '.git', head.slice(5).trim()), 'utf8').trim() : head;
    return ref.slice(0, 7);
  } catch (e) { return 'sconosciuta'; }
}

/** Indirizzi di controllo: /health (pubblico), /stato e /stato.json (con la chiave) */
function setup(app) {
  app.get('/health', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, tavoli: rooms.size });
  });
}

/* ---------- Pagina di stato (solo con la chiave) ---------- */
function statusData() {
  const online = new Set([...io.sockets.sockets.values()].map((so) => so.data.token).filter(Boolean));
  return {
    acceso_da_min: Math.round((Date.now() - startedAt) / 60000),
    versione: gitVersion(),
    memoria_mb: Math.round(process.memoryUsage().rss / 1048576),
    cpu_percento: cpuPct,
    ritardo_ms: { medio: Math.round(loopDelay.mean / 1e5) / 10, p99: Math.round(loopDelay.percentile(99) / 1e5) / 10, massimo: Math.round(loopDelay.max / 1e5) / 10 },
    connessi: online.size,
    profili: [...sessions.values()].filter((x) => x.nick).length,
    tavoli: [...rooms.values()].map((r) => ({
      codice: r.code,
      regole: Games.of(r).presetOf(r.rules) || 'personalizzate',
      giocatori: r.seats.map((x) => (x ? `${x.name}${x.isBot ? ' 🤖' : isConnected(x.token) ? ' 🟢' : ' ⚪'}` : '—')),
      fase: !r.game ? 'in attesa' : r.game.over ? 'partita finita' : r.game.phase === 'handEnd' ? `fine smazzata ${r.game.handNo}` : `smazzata ${r.game.handNo}`,
      punteggi: r.game ? r.game.scores : null,
    })),
    segnalazioni: ctx.reports.slice(0, 30).map((r) => ({ ...r, quando: new Date(r.at).toLocaleString('it-IT') })),
    errori: recentErrors.slice().reverse().map((e) => ({ quando: new Date(e.at).toLocaleString('it-IT'), testo: e.text })),
  };
}

function setupStatus(app) {
  app.get('/stato.json', (req, res) => {
    if (req.query.k !== ADMIN_KEY) return res.status(403).json({ errore: 'chiave mancante o sbagliata' });
    res.set('Cache-Control', 'no-store').json(statusData());
  });

  // Un amico ha perso password e codice di recupero: il gestore gli genera un codice nuovo e glielo manda
  app.post('/stato/recupero', (req, res) => {
    if (req.query.k !== ADMIN_KEY) return res.status(403).send('Accesso negato');
    const nick = String(req.query.nick || '');
    const code = ctx.social.adminNewCode(nick);
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    ctx.scheduleSave();
    res.set('Cache-Control', 'no-store').send(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Codice di recupero</title>
  <style>body{font-family:system-ui,sans-serif;background:#0f5132;color:#fff;margin:0;padding:16px}b.c{display:block;font-size:22px;color:#f2c14e;margin:12px 0;user-select:all}a{color:#f2c14e}</style></head><body>
  ${code ? `<h2>Nuovo codice di recupero per ${esc(nick)}</h2><b class="c">${esc(code)}</b>
  <p>Mandalo a ${esc(nick)}: nell'app, «Hai già un profilo? Recuperalo» → «Password dimenticata?», con nickname, questo codice e una password nuova.
  Il codice vecchio non vale più.</p>` : `<h2>Nickname «${esc(nick)}» non trovato</h2>`}
  <p><a href="/stato?k=${encodeURIComponent(req.query.k)}">← Torna alla pagina di stato</a></p></body></html>`);
  });

  app.get('/stato', (req, res) => {
    if (req.query.k !== ADMIN_KEY) return res.status(403).send('Accesso negato');
    const d = statusData();
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    res.set('Cache-Control', 'no-store').send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><title>Stato Burraco</title>
  <style>body{font-family:system-ui,sans-serif;background:#0f5132;color:#fff;margin:0;padding:16px}h1{margin:0 0 12px}
  .box{background:rgba(0,0,0,.25);border-radius:12px;padding:12px;margin:10px 0}.k{display:inline-block;margin:4px 14px 4px 0}
  .k b{display:block;font-size:22px;color:#f2c14e}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:5px;border-bottom:1px solid rgba(255,255,255,.15)}
  pre{white-space:pre-wrap;font-size:12px;margin:4px 0;color:#ffd7d7}.m{color:#bcd6c8;font-size:12px}</style></head><body>
  <h1>🃏 Stato del server</h1>
  <div class="box"><span class="k">Acceso da<b>${d.acceso_da_min} min</b></span><span class="k">Connessi<b>${d.connessi}</b></span>
  <span class="k">Profili<b>${d.profili}</b></span><span class="k">Tavoli<b>${d.tavoli.length}</b></span><span class="k">Memoria<b>${d.memoria_mb} MB</b></span>
  <span class="k">Versione<b>${esc(d.versione)}</b></span>
  <span class="k">CPU<b>${d.cpu_percento}%</b></span><span class="k">Ritardo (99%)<b>${d.ritardo_ms.p99} ms</b></span></div>
  <div class="box"><b>Tavoli</b>${d.tavoli.length ? `<table><tr><th>Codice</th><th>Fase</th><th>Giocatori</th><th>Regole</th></tr>${d.tavoli.map((t) => `<tr><td>${esc(t.codice)}</td><td>${esc(t.fase)}</td><td>${t.giocatori.map(esc).join(', ')}</td><td>${esc(t.regole)}</td></tr>`).join('')}</table>` : '<p class="m">Nessun tavolo aperto.</p>'}</div>
  <div class="box"><b>Segnalazioni dei giocatori</b>${d.segnalazioni.length ? d.segnalazioni.map((r) => `<div style="border-bottom:1px solid rgba(255,255,255,.15);padding:6px 0">
  ${r.kind === 'player' ? `<span style="color:#ffb4a8">⚠️ <b>${esc(r.nick)}</b> segnala <b>${esc(r.target)}</b>: ${esc(r.reason)}</span><br>` : ''}<b>${esc(r.nick)}</b> <span class="m">${esc(r.quando)} · ${esc(r.screen)}${r.table ? ` · tavolo ${esc(r.table.code)} (${esc(r.table.rules)})` : ''}</span><br>${esc(r.text)}
  ${r.chat && r.chat.length ? `<pre style="color:#ffe">${r.chat.map(esc).join('\n')}</pre>` : ''}
  ${r.table && r.table.game ? `<pre style="color:#cfe">smazzata ${r.table.game.hand} · fase ${esc(r.table.game.phase)} · turno ${r.table.game.turn} · posto ${r.table.seat} · tallone ${r.table.game.stock} · scarti ${r.table.game.discard} · carte in mano ${r.table.game.myCards}
  ${r.table.game.log.map(esc).join('\n')}</pre>` : ''}<span class="m">${esc(r.device)}</span></div>`).join('') : '<p class="m">Nessuna segnalazione.</p>'}</div>
  <div class="box"><b>Profili</b> <span class="m">· «Codice» genera un nuovo codice di recupero da mandare a chi ha perso password e codice</span>
  ${ctx.social.nicks().map((n) => `<form method="post" action="/stato/recupero?k=${encodeURIComponent(req.query.k)}&nick=${encodeURIComponent(n)}" style="display:inline-block;margin:4px 8px 4px 0"
  onsubmit="return confirm('Nuovo codice di recupero per ${esc(n)}?')"><span>${esc(n)}</span> <button>Codice</button></form>`).join('') || '<p class="m">Nessun profilo.</p>'}</div>
  <div class="box"><b>Ultimi errori</b>${d.errori.length ? d.errori.map((e) => `<pre>${esc(e.quando)} — ${esc(e.testo)}</pre>`).join('') : '<p class="m">Nessun errore 🎉</p>'}</div>
  <p class="m">Ricarica la pagina per aggiornarla. 🟢 online · ⚪ offline · 🤖 computer</p></body></html>`);
  });
}

module.exports = { setup, setupStatus, ADMIN_KEY };
