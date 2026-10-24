'use strict';
// Verifica in un browser reale: pagine legali su telefono, Spotify senza iframe e cancellazione locale.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { findBrowser, connect } = require('./cdp');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smazzata-privacy-ui-'));
  const url = 'http://localhost:3993';
  const server = spawn(process.execPath, [path.join(__dirname, 'index.js')], { env: { ...process.env, PORT: '3993', DATA_DIR: path.join(root, 'data'), BOT_DELAY: '30', MAIL_TEST: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser, cdp;
  try {
    await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('Server privacy non avviato')), 15000);
      server.stdout.on('data', (d) => { if (String(d).includes('ascolto')) { clearTimeout(timer); res(); } });
      server.once('exit', () => { clearTimeout(timer); rej(new Error('Server privacy terminato')); });
    });
    browser = spawn(findBrowser(), ['--headless=new', '--no-first-run', '--no-default-browser-check', ...(process.env.CI ? ['--no-sandbox'] : []), '--remote-debugging-port=9335', `--user-data-dir=${path.join(root, 'browser')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let browserLog = '', connectionError = '';
    browser.stderr.on('data', (data) => { browserLog = (browserLog + data).slice(-6000); });
    browser.on('error', (e) => { browserLog += '\n' + e.message; });
    let tabs;
    for (let i = 0; i < 120; i++) {
      try { tabs = await (await fetch('http://127.0.0.1:9335/json/list')).json(); break; }
      catch (e) { connectionError = String(e.cause || e); if (browser.exitCode !== null) break; await wait(200); }
    }
    assert(tabs, `Browser privacy non avviato (uscita ${browser.exitCode}): ${connectionError}\n${browserLog}`);
    cdp = await connect(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Network.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
    const requests = [];
    cdp.on((m) => {
      if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
      if (m.method === 'Page.javascriptDialogOpening') cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    });
    const open = async (page) => { await cdp.send('Page.navigate', { url: url + page }); await wait(800); };
    for (const page of ['/privacy.html', '/regole.html', '/elimina-profilo.html', '/licenze.html']) {
      await open(page);
      const info = await cdp.run(`return { title: document.title, overflow: document.documentElement.scrollWidth > innerWidth + 1, links: [...document.querySelectorAll('a[href^="mailto:"]')].map(a=>a.getAttribute('href')), text:document.body.innerText };`);
      assert(!info.overflow, page + ' leggibile a 360 px');
      assert(info.title.includes('Smazzata'));
      if (page === '/privacy.html') assert(info.text.includes('Muliello Simone Francesco') && info.text.includes('legittimo interesse') && info.text.includes('I tuoi diritti'));
      if (page === '/elimina-profilo.html') assert(info.links.some((l) => l.includes('muliellostudio@gmail.com')) && info.text.includes('Non serve reinstallare'));
    }
    await open('/');
    await cdp.run(`
      for(let i=0;i<60&&!S.token;i++)await new Promise(r=>setTimeout(r,100));
      const r=await emit('setNick',{nick:'Privacy_UI',password:'test1234',adult:true});if(!r.ok)throw Error(r.error);
      await new Promise(r=>setTimeout(r,200));
      const room=await emit('createRoom',{rules:{players:2},vsBots:true});if(!room.ok)throw Error(room.error);
      await new Promise(r=>setTimeout(r,400));
      const music=await emit('setMusic',{url:'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'});if(!music.ok)throw Error(music.error);
      await new Promise(r=>setTimeout(r,200));musicModal();
      if(document.querySelector('iframe[src*="spotify"]'))throw Error('Spotify caricato senza scelta');
      const a=document.querySelector('#modal a[href^="https://open.spotify.com"]');if(!a||!a.rel.includes('noreferrer'))throw Error('collegamento Spotify mancante');
      return true;
    `);
    assert(!requests.some((r) => /https:\/\/[^/]*spotify/.test(r)), 'nessun invio a Spotify aprendo la finestra musicale');
    const oldKey = await cdp.run(`
      const key=store.get('bur_token');localStorage.setItem('bur_stats',JSON.stringify({test:true}));localStorage.setItem('smazzata_campaign_privacytest','1');localStorage.setItem('bur_chest_cache','{}');localStorage.setItem('bur_chest_request','{}');
      closeModal();await handlers.deleteProfile();return key;
    `);
    let cleared = false;
    for (let i = 0; i < 60; i++) {
      await wait(100);
      try {
        cleared = await cdp.run(`return !localStorage.getItem('bur_stats')&&!localStorage.getItem('bur_chest_cache')&&!localStorage.getItem('bur_chest_request')&&!localStorage.getItem('smazzata_campaign_privacytest')&&document.querySelector('#nick')!==null&&JSON.parse(localStorage.getItem('bur_token')||'null')!==${JSON.stringify(oldKey)};`);
        if (cleared) break;
      } catch (e) { /* cambio documento dopo il logout */ }
    }
    assert(cleared, 'cancellazione da interfaccia: logout, dati locali rimossi e nuovo profilo anonimo');
    console.log('Privacy nel browser: quattro pagine a 360 px, Spotify senza richieste anticipate, cancellazione e dati locali OK');
  } finally {
    if (cdp) cdp.ws.close();
    for (const proc of [browser, server]) if (proc && proc.exitCode === null) {
      await new Promise((res) => { proc.once('exit', res); proc.kill(); });
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
