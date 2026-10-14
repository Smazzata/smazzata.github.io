'use strict';
/*
 * Prova automatica dell'interfaccia: avvia un server di prova, apre Chrome/Edge senza finestra a misura
 * di telefono (375×812) e gioca toccando i pulsanti come una persona, tramite il protocollo di debug
 * del browser (nessuna dipendenza: WebSocket è incluso in Node 22+).
 *   npm run ui            (browser: CHROME_PATH, oppure Chrome/Edge/Chromium installati)
 * Controlla: nessun errore nella pagina, tavolo che non scorre, partite di Burraco e Scala 40 fino
 * alla fine della smazzata, moviola, impostazioni e stili delle carte, gioco senza internet.
 * Le schermate finiscono in test-output/.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3996;
const DEBUG_PORT = 9333;
const URL = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', 'test-output');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (t) => console.log('✓ ' + t);

function findBrowser() {
  const c = [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const found = c.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Nessun browser trovato: installa Chrome o indica CHROME_PATH');
  return found;
}

/** Collegamento minimo al protocollo di debug (Chrome DevTools Protocol) */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
    else if (msg.method) for (const l of listeners) l(msg);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  /** esegue codice nella pagina (anche async) e restituisce il risultato */
  const run = async (code, timeout = 60000) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true, timeout });
    if (r.exceptionDetails) throw new Error('Nella pagina: ' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text));
    return r.result.value;
  };
  return { ws, send, run, on: (f) => listeners.push(f) };
}

// funzioni di aiuto iniettate nella pagina: tocco "vero" (pointerdown/up + click) e attesa
const HELPERS = `
  window.__W = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__tap = (sel) => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) return false;
    const r = e.getBoundingClientRect(); const o = { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, isPrimary: true };
    e.dispatchEvent(new PointerEvent('pointerdown', o)); document.dispatchEvent(new PointerEvent('pointerup', o)); e.dispatchEvent(new MouseEvent('click', o)); return true; };
  window.__btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
  window.__status = () => (document.querySelector('.statusbar') || {}).textContent || '';
  /** gioca da solo fino alla fine della smazzata: pesca e scarta l'ultima carta; controlla che il tavolo non scorra */
  window.__playHand = async (maxMs) => {
    const end = Date.now() + maxMs; let turns = 0, scroll = 0;
    while (Date.now() < end) {
      if (document.querySelector('#modal:not(.hidden) .result')) { await __W(1500); return { turns, scroll }; } // fine del conteggio animato
      const felt = document.querySelector('#felt');
      if (felt && felt.scrollHeight > felt.clientHeight + 2) scroll++;
      const st = __status();
      if (/tocca il/.test(st)) __tap('.stock');
      else if (/Seleziona le carte|Tocca ＋/.test(st)) {
        const cs = [...document.querySelectorAll('#hand .card')];
        if (cs.length) { __tap(cs[cs.length - 1]); await __W(120); __tap('.pile'); turns++; }
      }
      await __W(250);
    }
    throw new Error('la smazzata non finisce (stato: ' + __status().trim().slice(0, 80) + ')');
  };
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-ui-'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-ui-browser-'));
  const server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, BOT_DELAY: '40' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('ascolto')) res(); }));
  const browser = spawn(findBrowser(), [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, ...(process.env.CI ? ['--no-sandbox'] : []), `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--window-size=375,812', '--force-device-scale-factor=2', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });
  let cdp;
  const errors = [];
  let shot = async () => {};
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) { await wait(200); }
    }
    if (!target) throw new Error('il browser non risponde');
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    cdp.on((m) => {
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    });
    shot = async (name) => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    };
    const open = async (url) => { await cdp.send('Page.navigate', { url }); await wait(1500); await cdp.run(HELPERS); };

    // 1. schermata iniziale e nickname
    await open(URL);
    const nick = await cdp.run(`
      const i = document.querySelector('#nick'); i.value = 'Robot_UI'; i.dispatchEvent(new Event('input', { bubbles: true }));
      await __W(500); __tap('[data-act="claimNick"]'); await __W(800);
      return document.querySelector('.hello') ? document.querySelector('.hello').innerText : null;`);
    if (!nick || !nick.includes('Robot_UI')) throw new Error('nickname non confermato');
    await shot('01-home');
    step('schermata iniziale e nickname');

    // 2. Burraco contro il computer fino alla fine della smazzata
    await cdp.run(`__tap(__btn('Nuova partita')); await __W(400); __tap(__btn('Gioca subito contro')); await __W(1500);`);
    const b = await cdp.run(`
      const hand = document.querySelectorAll('#hand .card').length;
      if (hand !== 11) throw new Error('mano del Burraco: ' + hand + ' carte');
      return __playHand(240000);`, 260000);
    await shot('02-burraco-fine-smazzata');
    if (b.scroll > 3) throw new Error(`il tavolo del Burraco scorre (${b.scroll} volte)`);
    step(`Burraco: smazzata giocata toccando (${b.turns} turni), il tavolo non scorre`);

    // 3. moviola dalla fine della smazzata
    const mv = await cdp.run(`
      __tap('#modal [data-act="replay"]'); await __W(1500);
      const r = document.querySelector('#rpRange'); if (!r) throw new Error('moviola non aperta');
      __tap('[data-act="rpGo"][data-to="last"]'); await __W(300);
      return { frames: Number(r.max) + 1, cap: document.querySelector('.rpcap').innerText };`);
    await shot('03-moviola');
    if (mv.frames < 10) throw new Error('moviola troppo corta');
    step(`moviola: ${mv.frames} fotogrammi`);

    // 4. impostazioni: stili delle carte (anteprime)
    const st = await cdp.run(`
      document.querySelector('.modal-close').click(); await __W(300);
      __tap('[data-act="settings"]'); await __W(500);
      const decks = document.querySelectorAll('#modal .deckprev').length;
      __tap('#modal [data-key="deck"][data-val="francesi"]'); await __W(400);
      const fig = document.querySelectorAll('#hand .card.hasfig, #hand .card.haspips').length;
      __tap('#modal [data-key="deck"][data-val="classiche"]'); await __W(300);
      document.querySelector('.modal-close').click(); await __W(300);
      return { decks, fig, deck: document.body.dataset.deck };`);
    if (st.decks < 8 || st.deck !== 'classiche') throw new Error('stili delle carte: ' + JSON.stringify(st));
    step(`impostazioni: ${st.decks} stili di carte con anteprima`);

    // 5. esco (⏏ → Esci) e gioco a Scala 40
    const s40 = await cdp.run(`
      __tap('[data-act="leave"]'); await __W(400);
      if (document.querySelector('[data-act="leaveNow"]')) { __tap('[data-act="leaveNow"]'); await __W(800); }
      __tap(__btn('Nuova partita')); await __W(400);
      __tap('[data-act="pickGame"][data-game="scala40"]'); await __W(400);
      __tap(__btn('Gioca subito contro')); await __W(1500);
      const title = document.querySelector('.topbar .title').textContent;
      const hand = document.querySelectorAll('#hand .card').length;
      if (!/Scala 40/.test(title) || hand !== 13) throw new Error('Scala 40 non partita: ' + title + ' / ' + hand);
      return __playHand(240000);`, 260000);
    await shot('04-scala40-fine-smazzata');
    if (s40.scroll > 3) throw new Error(`il tavolo della Scala 40 scorre (${s40.scroll} volte)`);
    const twos = await cdp.run(`return document.querySelectorAll('.card.two').length;`);
    if (twos) throw new Error('nella Scala 40 i 2 non devono sembrare pinelle');
    step(`Scala 40: smazzata giocata toccando (${s40.turns} turni)`);

    // 6. gioco senza internet
    const off = await cdp.run(`
      location.href = '/?offline=1'; return true;`).catch(() => true);
    void off;
    await wait(1500);
    await cdp.run(HELPERS);
    const o = await cdp.run(`
      if (!document.querySelector('.offbanner')) throw new Error('niente schermata offline');
      __tap(__btn('Nuova partita')); await __W(400); __tap('[data-act="pickGame"][data-game="burraco"]'); await __W(300);
      __tap(__btn('Gioca contro il computer')); await __W(2500);
      return { hand: document.querySelectorAll('#hand .card').length, title: document.querySelector('.topbar .title').textContent };`);
    await shot('05-offline');
    if (o.hand !== 11 || !o.title.includes('📴')) throw new Error('offline: ' + JSON.stringify(o));
    step('gioco senza internet: partita contro il computer');

    const real = errors.filter((e) => !/vibrate|Failed to load resource|favicon/.test(e));
    if (real.length) throw new Error('errori nella pagina:\n' + real.slice(0, 5).join('\n'));
    step('nessun errore nella pagina');
    console.log(`\nProva dell'interfaccia: tutto OK (schermate in ${path.relative(process.cwd(), OUT)})`);
  } catch (e) {
    // schermata del momento in cui qualcosa non va: test-output/errore.png
    try { await shot('errore'); } catch (e2) { /* niente */ }
    throw e;
  } finally {
    try { if (cdp) cdp.ws.close(); } catch (e) { /* niente */ }
    browser.kill();
    await new Promise((res) => { if (server.exitCode !== null) res(); else { server.once('exit', res); server.kill(); } });
    await wait(300);
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (e) { /* il browser può tenere aperti dei file */ }
  }
})().catch((e) => { console.error('✗', e.message); process.exitCode = 1; setTimeout(() => process.exit(1), 300); });
