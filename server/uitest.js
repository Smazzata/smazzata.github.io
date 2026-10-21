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

const CAMPAIGN_STORY_ONLY = process.argv.includes('--campaign-story');
const CAMPAIGN_ONLY = process.argv.includes('--campaign') || CAMPAIGN_STORY_ONLY;
const HOME_ONLY = process.argv.includes('--home') || CAMPAIGN_ONLY;
const PORT = HOME_ONLY ? 3995 : 3996;
const DEBUG_PORT = HOME_ONLY ? 9334 : 9333;
const URL = `http://localhost:${PORT}`;
// STORE=1: schermate per il Play Store (1080×1920, formato 9:16) salvate in store/schermate
const STORE = !!process.env.STORE;
const OUT = STORE ? path.join(__dirname, '..', 'store', 'schermate') : path.join(__dirname, '..', 'test-output');
const VW = STORE ? 405 : 375, VH = STORE ? 720 : 812, DPR = STORE ? 1080 / 405 : 2;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (t) => console.log('✓ ' + t);

const { findBrowser, connect } = require('./cdp');

// funzioni di aiuto iniettate nella pagina: tocco "vero" (pointerdown/up + click) e attesa
const HELPERS = `
  window.__W = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__tap = (sel) => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) return false;
    const r = e.getBoundingClientRect(); const o = { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, isPrimary: true };
    e.dispatchEvent(new PointerEvent('pointerdown', o)); document.dispatchEvent(new PointerEvent('pointerup', o)); e.dispatchEvent(new MouseEvent('click', o)); return true; };
  window.__btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
  // le funzioni meno usate stanno nei menu: ☰ al tavolo, «Altro» nella schermata iniziale
  window.__menu = async (act) => {
    if (!document.querySelector('[data-act="' + act + '"]')) {
      __tap(document.querySelector('[data-act="tableMenu"]') || document.querySelector('[data-act="more"]')); await __W(350);
    }
    return __tap('[data-act="' + act + '"]');
  };
  // il messaggio del turno non è più una fascia visibile: sta nascosto per la lettura ad alta voce (#turnmsg)
  window.__status = () => (document.querySelector('#turnmsg') || {}).textContent || '';
  /** gioca da solo fino alla fine della smazzata: pesca e scarta l'ultima carta; controlla che il tavolo non scorra */
  window.__playHand = async (maxMs) => {
    const end = Date.now() + maxMs; let turns = 0, scroll = 0;
    while (Date.now() < end) {
      if (document.querySelector('#modal:not(.hidden) .result')) { await __W(1500); return { turns, scroll }; } // fine del conteggio animato
      const felt = document.querySelector('#felt');
      if (felt && felt.scrollHeight > felt.clientHeight + 2) scroll++;
      const st = __status();
      const myTurn = /Tocca a te/.test(document.title);
      if (/pesca (dal|una)/i.test(st)) __tap('.stock');
      else if (myTurn) {
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
    '--headless=new', '--mute-audio', `--remote-debugging-port=${DEBUG_PORT}`, ...(process.env.CI ? ['--no-sandbox'] : []), `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    `--window-size=${VW},${VH}`, `--force-device-scale-factor=${DPR}`, '--lang=it-IT', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore', env: { ...process.env, LANGUAGE: 'it', LANG: 'it_IT.UTF-8' } });
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true });
    cdp.on((m) => {
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    });
    shot = async (name) => {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
    };
    const open = async (url) => { await cdp.send('Page.navigate', { url }); await wait(1500); await cdp.run(HELPERS); };

    // 1. schermata iniziale e nickname (in italiano anche se il browser è in un'altra lingua)
    await open(URL);
    await cdp.run(`localStorage.setItem('bur_prefs', JSON.stringify({ lang: 'it' })); return true;`);
    await open(URL);
    const nick = await cdp.run(`
      const i = document.querySelector('#nick'); i.value = 'Robot_UI'; i.dispatchEvent(new Event('input', { bubbles: true }));
      const p = document.querySelector('#nickpw'); p.value = 'robot1234'; p.dispatchEvent(new Event('input', { bubbles: true }));
      await __W(500); __tap('[data-act="claimNick"]'); await __W(800);
      if (document.querySelector('[data-act="savedCode"]')) throw new Error('profilo creato senza la spunta dei 14 anni');
      __tap('#nickage'); await __W(200);
      __tap('[data-act="claimNick"]'); await __W(800);
      if (!document.querySelector('[data-act="savedCode"]')) throw new Error('codice di recupero non mostrato');
      __tap('[data-act="savedCode"]'); await __W(300);
      return document.querySelector('.hello') ? document.querySelector('.hello').innerText : null;`);
    if (!nick || !nick.includes('Robot_UI')) throw new Error('nickname non confermato');
    await cdp.run(`
      await __W(2500);
      const choices = [...document.querySelectorAll('.homebtn')];
      if (choices.map((b) => b.dataset.act + ':' + (b.dataset.mode || '')).join(',') !== 'quickMenu:casual,quickMenu:ranked,playFriends:,playBots:') throw new Error('ordine delle modalità nella home');
      if (!choices[0].classList.contains('primary')) throw new Error('amichevole non evidenziata');
      for (const mode of ['casual', 'ranked']) {
        __tap('[data-act="quickMenu"][data-mode="' + mode + '"]'); await __W(200);
        if (document.querySelectorAll('#modal [data-act="quick"][data-mode="' + mode + '"]').length !== 3) throw new Error('scelta formato pubblico');
        if (!document.querySelector('#modal').textContent.includes('Burraco Classico')) throw new Error('variante pubblica non indicata');
        for (const [game] of GAME_TILES) {
          __tap('#modal [data-act="quickMenu"][data-game="' + game + '"]');
          const buttons = [...document.querySelectorAll('#modal [data-act="quick"]')];
          if (!buttons.length || buttons.some((b) => b.dataset.game !== game || b.dataset.mode !== mode)) throw new Error('gioco o modalità persi');
          for (const tile of document.querySelectorAll('#modal .gtile')) {
            const style = getComputedStyle(tile);
            const luminance = (color) => color.match(/[0-9.]+/g).slice(0, 3).map(Number).map((n) => n / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
            const a = luminance(style.color), b = luminance(style.backgroundColor);
            if ((Math.max(a, b) + .05) / (Math.min(a, b) + .05) < 4.5) throw new Error('contrasto insufficiente nel selettore del gioco');
          }
          if (game === 'briscola5' && (buttons.length !== 1 || buttons[0].dataset.n !== '5')) throw new Error('briscola in 5');
          if (game === 'scopone' && (buttons.length !== 1 || buttons[0].dataset.n !== '4')) throw new Error('scopone');
        }
        document.querySelector('.modal-close').click();
      }
      __tap('[data-act="playBots"]'); await __W(100);
      __tap('[data-act="setupBotLevel"][data-val="difficile"]');
      if (S.prefs.botLevel !== 'difficile' || !document.querySelector('[data-act="setupBotLevel"][data-val="difficile"]').classList.contains('on')) throw new Error('selettore difficoltà');
      __tap('[data-act="setupBotLevel"][data-val="auto"]');
      __tap('[data-act="goHome"]');`);
    await shot('01-home');
    step('schermata iniziale e nickname');
    if (CAMPAIGN_ONLY) {
      await require('./campaign-story-ui-flow')({ cdp, shot, open, URL, step, errors, DPR });
      if (CAMPAIGN_STORY_ONLY) return;
      await require('./campaign-ui-flow')({ cdp, shot, open, URL, step, errors, DPR });
      return;
    }
    if (HOME_ONLY) { step('home, formati pubblici e selettore difficoltà: tutto OK'); return; }

    // 2. Burraco contro il computer fino alla fine della smazzata
    await cdp.run(`__tap('[data-act="playBots"]'); await __W(400); __tap('[data-act="createBots"]'); await __W(1500);`);
    const b = await cdp.run(`
      const hand = document.querySelectorAll('#hand .card').length;
      if (hand !== 11) throw new Error('mano del Burraco: ' + hand + ' carte');
      return __playHand(240000);`, 260000);
    await shot('02-burraco-fine-smazzata');
    // la partita contro il computer gira sul telefono; il risultato della smazzata arriva comunque al server
    const onDev = await cdp.run(`
      if (!S.room || !S.room.onDevice) return 'non sul telefono';
      for (let i = 0; i < 40; i++) { const r = await emit('myStats'); if (r.ok && r.stats && r.stats.hands >= 1) return 'ok'; await __W(250); }
      return 'risultato non arrivato al server';`);
    if (onDev !== 'ok') throw new Error('partita sul telefono: ' + onDev);
    if (b.scroll > 3) throw new Error(`il tavolo del Burraco scorre (${b.scroll} volte)`);
    step(`Burraco sul telefono: smazzata giocata toccando (${b.turns} turni), il tavolo non scorre, risultato arrivato al server`);

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
      await __menu('settings'); await __W(500);
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
      await __menu('leave'); await __W(400);
      if (document.querySelector('[data-act="leaveNow"]')) { __tap('[data-act="leaveNow"]'); await __W(800); }
      __tap('[data-act="playBots"]'); await __W(400);
      __tap('[data-act="pickGame"][data-game="scala40"]'); await __W(400);
      __tap('[data-act="createBots"]'); await __W(1500);
      const title = document.querySelector('.topbar .title').textContent;
      const hand = document.querySelectorAll('#hand .card').length;
      if (!/Scala 40/.test(title) || hand !== 13) throw new Error('Scala 40 non partita: ' + title + ' / ' + hand);
      return __playHand(240000);`, 260000);
    await shot('04-scala40-fine-smazzata');
    if (s40.scroll > 3) throw new Error(`il tavolo della Scala 40 scorre (${s40.scroll} volte)`);
    const twos = await cdp.run(`return document.querySelectorAll('.card.two').length;`);
    if (twos) throw new Error('nella Scala 40 i 2 non devono sembrare pinelle');
    step(`Scala 40: smazzata giocata toccando (${s40.turns} turni)`);

    // 5b. Canasta
    const can = await cdp.run(`
      await __menu('leave'); await __W(400);
      if (document.querySelector('[data-act="leaveNow"]')) { __tap('[data-act="leaveNow"]'); await __W(800); }
      if (document.querySelector('#modal:not(.hidden)')) { document.querySelector('.modal-close').click(); await __W(300); await __menu('leave'); await __W(800); }
      __tap('[data-act="playBots"]'); await __W(400);
      __tap('[data-act="pickGame"][data-game="canasta"]'); await __W(400);
      __tap('[data-act="createBots"]'); await __W(1500);
      const t = document.querySelector('.topbar .title').textContent;
      if (!document.querySelectorAll('#hand .card').length) throw new Error('Canasta non partita: ' + t);
      return __playHand(240000);`, 260000);
    await shot('04b-canasta-fine-smazzata');
    step(`Canasta: smazzata giocata toccando (${can.turns} turni)`);

    // 5c. Scopa: si gioca toccando le carte (se servono, si sceglie la presa)
    await cdp.run(`
      await __menu('leave'); await __W(400);
      if (document.querySelector('[data-act="leaveNow"]')) { __tap('[data-act="leaveNow"]'); await __W(800); }
      if (document.querySelector('#modal:not(.hidden)')) { document.querySelector('.modal-close').click(); await __W(300); await __menu('leave'); await __W(800); }
      __tap('[data-act="playBots"]'); await __W(400);
      __tap('[data-act="pickGame"][data-game="scopa"]'); await __W(400);
      __tap('[data-act="createBots"]'); await __W(1500);
      if (document.querySelectorAll('#hand .card.it').length !== 3) throw new Error('Scopa: niente carte italiane in mano');
      return true;`, 30000);
    await shot('04c-scopa-tavolo');
    const sco = await cdp.run(`
      const end = Date.now() + 120000; let plays = 0;
      while (Date.now() < end && !document.querySelector('#modal:not(.hidden) .result')) {
        const opt = document.querySelector('#modal:not(.hidden) .takeopt');
        if (opt) { __tap(opt); plays++; }
        else if (/Tocca a te/.test(__status())) { const c = document.querySelector('#hand .card'); if (c) { __tap(c); plays++; } }
        await __W(300);
      }
      if (!document.querySelector('#modal:not(.hidden) .result')) throw new Error('la smazzata di Scopa non finisce');
      await __W(1500);
      return { plays };`, 150000);
    await shot('04c-scopa-fine-smazzata');
    step(`Scopa: smazzata giocata toccando (${sco.plays} giocate)`);

    // 5d. torneo: creazione, riempimento con il computer, avvio, tabellone con «Vai al tavolo»
    const tour = await cdp.run(`
      await __menu('leave'); await __W(400);
      if (document.querySelector('[data-act="leaveNow"]')) { __tap('[data-act="leaveNow"]'); await __W(800); }
      if (document.querySelector('#modal:not(.hidden)')) { document.querySelector('.modal-close').click(); await __W(300); await __menu('leave'); await __W(800); }
      await __menu('tournaments'); await __W(700);
      document.querySelector('#tourname').value = 'Coppa del robot';
      document.querySelector('#toursize').value = '4';
      document.querySelector('#tourform button').click(); await __W(900);
      const waitFor = async (sel) => { for (let i = 0; i < 40 && !document.querySelector(sel); i++) await __W(150); return document.querySelector(sel); };
      __tap(await waitFor('[data-act="tourFill"]'));
      __tap(await waitFor('[data-act="tourStart"]'));
      // Il pulsante della home arriva prima del tabellone aggiornato nel modale.
      await waitFor('#modal .bracket [data-act="tourPlay"]');
      return { bracket: !!document.querySelector('#modal .bracket'), play: !!document.querySelector('#modal .bracket [data-act="tourPlay"]') };`);
    await shot('05-torneo');
    if (!tour.bracket || !tour.play) throw new Error('torneo: ' + JSON.stringify(tour));
    step('torneo: creato, riempito con il computer, avviato, tabellone con «Vai al tavolo»');
    await cdp.run(`document.querySelector('.modal-close').click(); return true;`);

    // 6. gioco senza internet
    const off = await cdp.run(`
      // senza internet si riprende anche la partita lasciata a metà sul telefono: qui si parte da zero
      localStorage.removeItem('bur_offline_room'); location.href = '/?offline=1'; return true;`).catch(() => true);
    void off;
    await wait(1500);
    await cdp.run(HELPERS);
    const o = await cdp.run(`
      if (!document.querySelector('.offbanner')) throw new Error('niente schermata offline');
      __tap('[data-act="playBots"]'); await __W(400); __tap('[data-act="pickGame"][data-game="burraco"]'); await __W(300);
      __tap('[data-act="createBots"]'); await __W(2500);
      return { hand: document.querySelectorAll('#hand .card').length, title: document.querySelector('.topbar .title').textContent };`);
    await shot('05-offline');
    if (o.hand !== 11 || !o.title.includes('📴')) throw new Error('offline: ' + JSON.stringify(o));
    step('gioco senza internet: partita contro il computer');

    // 7. app Android vecchia (versione 1): compare l'avviso di aggiornamento con il link all'APK
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 BurracoApp/1' });
    await cdp.run(`sessionStorage.clear(); localStorage.clear(); return true;`); // nuova sessione: si parte dalla schermata iniziale
    await open(URL);
    const upd = await cdp.run(`
      for (let i = 0; i < 40 && !document.querySelector('.apkbanner.update'); i++) await __W(250);
      const b = document.querySelector('.apkbanner.update');
      return b ? { text: b.innerText, href: b.querySelector('a').href } : null;`);
    await shot('06-aggiornamento-app');
    if (!upd || !/Burraco\.apk$/.test(upd.href)) throw new Error("niente avviso di aggiornamento dell'app");
    const later = await cdp.run(`__tap('[data-act="appUpdateLater"]'); await __W(300); return !!document.querySelector('.apkbanner.update');`);
    if (later) throw new Error("«Più tardi» non nasconde l'avviso");
    step("app vecchia: avviso di aggiornamento con il link all'APK, «Più tardi» lo nasconde");

    // 7b. app del Play Store (stessa versione vecchia): si aggiorna dallo Store, quindi nessun avviso per l'APK
    await cdp.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 BurracoApp/1 SmazzataLocale SmazzataStore' });
    await cdp.run(`sessionStorage.clear(); localStorage.clear(); localStorage.setItem('bur_apk_latest', JSON.stringify({ n: 999, at: Date.now() })); return true;`);
    await open(URL);
    const storeUpd = await cdp.run(`
      for (let i = 0; i < 40 && !document.querySelector('[data-act="playBots"]'); i++) await __W(250);
      await __W(1500);
      return !!document.querySelector('.apkbanner');`);
    if (storeUpd) throw new Error("versione Play Store: compare l'avviso per scaricare l'APK");
    step("app del Play Store: nessun avviso per scaricare l'APK");

    // 8. lingue: in inglese, spagnolo e portoghese la schermata iniziale e le regole sono tradotte
    const LANG_CHECK = { en: ['Play against the computer', 'Play with friends'], es: ['Jugar contra el ordenador', 'Jugar con amigos'], pt: ['Jogar contra o computador', 'Jogar com amigos'] };
    for (const [lang, words] of Object.entries(LANG_CHECK)) {
      await cdp.run(`localStorage.setItem('bur_prefs', JSON.stringify({ lang: '${lang}' })); return true;`);
      await open(URL);
      const txt = await cdp.run(`
        for (let i = 0; i < 40 && !document.querySelector('[data-act="playBots"]'); i++) await __W(250);
        await __W(300);
        return { lang: document.documentElement.lang, text: document.body.innerText };`);
      if (txt.lang !== lang || words.some((w) => !txt.text.includes(w))) throw new Error(`lingua ${lang}: testi non tradotti`);
      if (lang === 'en') await shot('07-inglese');
    }
    await cdp.run(`localStorage.setItem('bur_prefs', JSON.stringify({ lang: 'it' })); return true;`);
    step('lingue: inglese, spagnolo e portoghese');

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
