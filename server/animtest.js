'use strict';
/*
 * Prova delle animazioni delle carte in tutti i giochi (npm run anim), in Chrome senza finestra a misura di telefono.
 * Simula il ritardo del server sul telefono (0,25 s per mossa) e controlla le «mosse anticipate»:
 *  - al tocco la carta parte subito (prima della risposta del server) solo se la mossa è di sicuro valida;
 *  - una mossa rifiutata non fa volare niente;
 *  - la carta atterra esattamente sopra la carta vera (posizione e misura, pochi pixel di tolleranza);
 *  - nessuna carta resta "appesa" sullo schermo.
 * Salva anche i fotogrammi di alcune mosse in test-output/animazioni/ per guardarli.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { findBrowser, connect } = require('./cdp');

const PORT = 3994;
const DEBUG_PORT = 9334;
const URL = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'test-output', 'animazioni');
const VW = 375, VH = 812, DPR = 2;
const LAG = 250; // ritardo finto del server, come con il telefono e il tunnel
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// iniettato nella pagina: ritardo, registro delle carte in volo e degli atterraggi, una mossa misurata
const PROBE = `
  window.__W = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!window.__probe) {
    window.__probe = 1;
    const o = socket.emit.bind(socket);
    socket.emit = (ev, d, cb) => { setTimeout(() => o(ev, d, cb), ${LAG}); return socket; };
    window.__flyers = [];
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('flyer')) __flyers.push(Date.now()); })))
      .observe(document.body, { childList: true });
    window.__log = [];
    const orig = landFlyer;
    window.landFlyer = function (el, target, face) {
      const rec = { face: !!face };
      orig(el, target, face);
      rec.t = target.getBoundingClientRect(); // misurata dopo: landFlyer ferma l'animazione d'arrivo della carta vera
      const iv = setInterval(() => {
        if (!el.isConnected) { clearInterval(iv); rec.done = true; rec.visible = target.style.visibility !== 'hidden'; return; }
        rec.last = el.firstElementChild.getBoundingClientRect();
      }, 8);
      __log.push(rec);
    };
  }
  window.__chk = (rec) => (rec && rec.last ? {
    dx: Math.round(rec.last.left + rec.last.width / 2 - (rec.t.left + rec.t.width / 2)),
    dy: Math.round(rec.last.top + rec.last.height / 2 - (rec.t.top + rec.t.height / 2)),
    size: +(rec.last.width / rec.t.width).toFixed(2), done: !!rec.done, visible: !!rec.visible, face: rec.face } : null);
  /** una mossa: quante carte partono prima della risposta, com'è l'atterraggio, se resta qualcosa sullo schermo */
  window.__try = async (type, extra = {}) => {
    const t0 = Date.now(), n = __log.length;
    const p = act(type, extra);
    await __W(${LAG - 70});
    const early = __flyers.filter((t) => t >= t0).length;
    const r = await p;
    await __W(1300);
    return { ok: r.ok, err: r.error || null, early, landing: __chk(__log[n]), leftovers: document.querySelectorAll('.flyer.antic').length };
  };
  window.__waitTurn = async (pred, ms = 20000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (S.game && S.room && S.game.turn === S.game.you && pred(S.game)) return true; await __W(60); }
    return false;
  };
`;

const GAMES = [
  ['burraco', '{ ...R.PRESETS[0].rules, players: 2 }'],
  ['scala40', "{ game: 'scala40', players: 2 }"],
  ['canasta', "{ game: 'canasta', players: 2 }"],
  ['scopa', "{ game: 'scopa', players: 2 }"],
  ['scopone', 'OTHER.scopa.PRESETS[1].rules'],
  ['briscola', "{ game: 'briscola', players: 2 }"],
  ['briscola5', "{ game: 'briscola5' }"],
  ['tressette', "{ game: 'tressette', players: 2 }"],
  ['rubamazzetto', "{ game: 'rubamazzetto', players: 2 }"],
];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-anim-'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-anim-browser-'));
  const server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, BOT_DELAY: '250' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('ascolto')) res(); }));
  const browser = spawn(findBrowser(), [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, ...(process.env.CI ? ['--no-sandbox'] : []), `--user-data-dir=${profile}`, '--no-first-run',
    `--window-size=${VW},${VH}`, `--force-device-scale-factor=${DPR}`, '--lang=it-IT', 'about:blank',
  ], { stdio: 'ignore', env: { ...process.env, LANGUAGE: 'it', LANG: 'it_IT.UTF-8' } });
  let cdp;
  const problems = [];
  const errors = [];
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) { await wait(200); }
    }
    if (!target) throw new Error('il browser non risponde');
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true });
    cdp.on((m) => {
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    });
    const shot = async (name) => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
      fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(r.data, 'base64'));
    };
    /** fotogrammi di una mossa: la si lancia e si fotografa lo schermo per ~0,8 s */
    const frames = async (name, code) => {
      await cdp.run(`window.__frameMove = (async () => { ${code} })(); return 1;`);
      const t0 = Date.now();
      for (let i = 0; Date.now() - t0 < 800; i++) await shot(`${name}-${String(i).padStart(2, '0')}-${Date.now() - t0}ms`);
      await cdp.run('await window.__frameMove; await __W(1200); return 1;');
    };

    await cdp.send('Page.navigate', { url: URL });
    await wait(1500);
    await cdp.run(`localStorage.setItem('bur_prefs', JSON.stringify({ lang: 'it' })); return true;`);
    await cdp.send('Page.navigate', { url: URL });
    await wait(2500);
    await cdp.run(`const r = await emit('setNick', { nick: 'Robot_Anim', password: 'robot1234' }); if (!r.ok) throw new Error(r.error); return 1;`);
    await cdp.run(PROBE);

    const check = (game, what, r, { expectEarly, expectLanding = expectEarly, mayFade = false, tol = 4 }) => {
      const line = `${game} · ${what}`;
      if (r.ok === false && expectEarly) { problems.push(`${line}: mossa rifiutata (${r.err})`); return; }
      if (expectEarly && r.early < 1) problems.push(`${line}: la carta non parte al tocco`);
      if (!expectEarly && r.early > 0) problems.push(`${line}: ${r.early} carte volano anche se la mossa non è valida`);
      if (expectLanding) {
        const l = r.landing;
        if (!l) { if (!mayFade) problems.push(`${line}: la carta non atterra al suo posto`); }
        else if (Math.abs(l.dx) > tol || Math.abs(l.dy) > tol || Math.abs(l.size - 1) > 0.05 || !l.done || !l.visible) {
          problems.push(`${line}: atterraggio sbagliato ${JSON.stringify(l)}`);
        }
      }
      if (r.leftovers) problems.push(`${line}: ${r.leftovers} carte rimaste sullo schermo`);
      console.log(`  ${line}: ${r.ok ? 'ok' : 'rifiutata'} · al tocco ${r.early} · atterraggio ${r.landing ? `${r.landing.dx},${r.landing.dy} ×${r.landing.size}` : '—'}`);
    };

    for (const [game, rules] of GAMES) {
      console.log(`▸ ${game}`);
      await cdp.run(`if (S.room) { await emit('leaveRoom', {}); await __W(500); } await emit('createRoom', { rules: ${rules}, vsBots: true }); return 1;`);
      const presa = await cdp.run(`for (let i = 0; i < 100 && !S.game; i++) await __W(100); return !!(S.game && S.game.presa);`);
      if (!presa) {
        if (!(await cdp.run(`return __waitTurn((g) => g.phase === 'draw');`))) { problems.push(`${game}: il mio turno non arriva`); continue; }
        await wait(400);
        // scartare prima di pescare: rifiutata, niente volo
        check(game, 'scarto prima di pescare', await cdp.run(`return __try('discard', { cardId: S.game.hand[0].id });`), { expectEarly: false });
        if (game === 'scala40') check(game, 'scarti senza aver aperto', await cdp.run(`return __try('takePile');`), { expectEarly: false });
        if (game === 'burraco') await frames('burraco-pesca', `await act('draw');`);
        else check(game, 'pesca dal mazzo', await cdp.run(`return __try('draw');`), { expectEarly: true });
        if (!(await cdp.run(`return __waitTurn((g) => g.phase === 'play', 5000);`))) { problems.push(`${game}: dopo la pesca non si gioca`); continue; }
        await wait(300);
        if (game === 'burraco') {
          const r = await cdp.run(`return __chk(__log[__log.length - 1]);`);
          check(game, 'pesca dal mazzo (fotogrammi)', { ok: true, early: 1, landing: r, leftovers: 0 }, { expectEarly: true });
          await frames('burraco-scarto', `await act('discard', { cardId: S.game.hand[0].id });`);
          const r2 = await cdp.run(`return __chk(__log[__log.length - 1]);`);
          check(game, 'scarto (fotogrammi)', { ok: true, early: 1, landing: r2, leftovers: await cdp.run(`return document.querySelectorAll('.flyer.antic').length;`) }, { expectEarly: true });
        } else {
          check(game, 'scarto', await cdp.run(`return __try('discard', { cardId: S.game.hand[S.game.hand.length - 1].id });`), { expectEarly: true });
        }
      } else {
        // giochi a prese (asta della Briscola in 5: si passa o si chiama denari)
        const ready = await cdp.run(`
          const end = Date.now() + 40000;
          while (Date.now() < end) {
            const g = S.game;
            if (g && g.turn === g.you && g.phase === 'bid') { await act('pass'); await __W(400); continue; }
            if (g && g.turn === g.you && g.phase === 'call') { await act('call', { suit: 'd' }); await __W(400); continue; }
            if (g && g.turn === g.you && g.phase !== 'handEnd' && g.phase !== 'bid' && g.phase !== 'call') return true;
            await __W(80);
          }
          return false;`, 45000);
        if (!ready) { problems.push(`${game}: il mio turno non arriva`); continue; }
        await wait(300);
        const bad = await cdp.run(`const g = S.game; const c = g.playable && g.hand.find((x) => !g.playable.includes(x.id)); return c ? c.id : null;`);
        if (bad != null) check(game, 'carta che non risponde al seme', await cdp.run(`return __try('play', { cardId: ${bad} });`), { expectEarly: false });
        if (game === 'briscola') await frames('briscola-gioca', `const g = S.game; await act('play', { cardId: (g.playable ? g.hand.find((x) => g.playable.includes(x.id)) : g.hand[0]).id });`);
        else {
          // come nell'app: nella Scopa una carta con più prese possibili apre la scelta, qui si gioca una carta senza dubbi
          const r = await cdp.run(`const g = S.game;
            const ok = (x) => (!g.playable || g.playable.includes(x.id)) && (g.game !== 'scopa' || window.BurracoScopa.captures(x, g.table, g.cfg.rules).length <= 1);
            const c = g.hand.find(ok) || g.hand[0]; return __try('play', { cardId: c.id });`);
          // nella Scopa e nel Rubamazzetto la carta può essere subito presa: allora si dissolve
          // nei giochi a prese le carte in tavola si risistemano quando ne arriva un'altra: tolleranza più larga
          check(game, 'gioca una carta', r, { expectEarly: true, mayFade: ['scopa', 'scopone', 'rubamazzetto'].includes(game), tol: 10 });
        }
      }
    }
    const real = errors.filter((e) => !/vibrate|Failed to load resource|favicon/.test(e));
    if (real.length) problems.push('errori nella pagina: ' + real.slice(0, 3).join(' | '));
    if (problems.length) throw new Error('problemi nelle animazioni:\n  - ' + problems.join('\n  - '));
    console.log(`\nProva delle animazioni: tutto OK (fotogrammi in ${path.relative(process.cwd(), OUT)})`);
  } finally {
    try { if (cdp) cdp.ws.close(); } catch (e) { /* niente */ }
    browser.kill();
    await new Promise((res) => { if (server.exitCode !== null) res(); else { server.once('exit', res); server.kill(); } });
    await wait(300);
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (e) { /* il browser può tenere aperti dei file */ }
  }
})().catch((e) => { console.error('✗', e.message); process.exitCode = 1; setTimeout(() => process.exit(1), 300); });
