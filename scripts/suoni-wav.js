'use strict';
/*
 * Genera i suoni del gioco in file .wav (test-output/suoni/) per ascoltarli e controllarli senza giocare:
 * apre la pagina in Chrome senza finestra, fa suonare ogni effetto in un AudioContext "offline" e salva il
 * risultato. Controlla anche che nessun suono sia muto o saturi.   node scripts/suoni-wav.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { findBrowser, connect } = require('../server/cdp');

const PORT = 3993, DEBUG_PORT = 9335;
const OUT = path.join(__dirname, '..', 'test-output', 'suoni');
const KINDS = ['select', 'card', 'deal', 'pile', 'meld', 'turn', 'burraco', 'win', 'error', 'shuffle'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function wav(channels, rate) {
  const n = channels[0].length, data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (let ch = 0; ch < 2; ch++) data.writeInt16LE(Math.max(-1, Math.min(1, channels[ch][i])) * 32767 | 0, 44 + i * 4 + ch * 2);
  return data;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-suoni-'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'burraco-suoni-browser-'));
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('ascolto')) res(); }));
  const browser = spawn(findBrowser(), ['--headless=new', '--mute-audio', `--remote-debugging-port=${DEBUG_PORT}`, ...(process.env.CI ? ['--no-sandbox'] : []), `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let cdp;
  const problems = [];
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) { await wait(200); } }
    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}` });
    await wait(2500);
    for (const kind of KINDS) {
      const r = await cdp.run(`
        const rate = 44100;
        const off = new OfflineAudioContext(2, rate * 3, rate);
        const keep = { ctx: Sound.ctx, out: Sound.out, AC: window.AudioContext };
        window.AudioContext = function () { return off; };
        Sound.ctx = null; Sound.unlock();
        const was = S.prefs.sound; S.prefs.sound = true;
        Sound.play(${JSON.stringify(kind)});
        S.prefs.sound = was;
        window.AudioContext = keep.AC; Sound.ctx = keep.ctx; Sound.out = keep.out;
        const buf = await off.startRendering();
        const ch = [Array.from(buf.getChannelData(0)), Array.from(buf.getChannelData(1))];
        // si taglia il silenzio finale
        let end = ch[0].length; while (end > 0 && Math.abs(ch[0][end - 1]) < 0.0005 && Math.abs(ch[1][end - 1]) < 0.0005) end--;
        let peak = 0; for (const c of ch) for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(c[i]));
        return { ch: ch.map((c) => c.slice(0, Math.min(ch[0].length, end + 2205))), peak, secs: end / rate, nan: ch[0].some((x) => Number.isNaN(x)) };`, 30000);
      fs.writeFileSync(path.join(OUT, `${kind}.wav`), wav(r.ch, 44100));
      console.log(`  ${kind.padEnd(8)} durata ${r.secs.toFixed(2)} s · picco ${r.peak.toFixed(2)}`);
      if (r.nan) problems.push(`${kind}: valori non validi`);
      if (r.peak < 0.02) problems.push(`${kind}: quasi muto (picco ${r.peak.toFixed(3)})`);
      if (r.peak > 0.99) problems.push(`${kind}: satura (picco ${r.peak.toFixed(2)})`);
    }
    if (problems.length) throw new Error('suoni da sistemare:\n  - ' + problems.join('\n  - '));
    console.log(`\nSuoni: tutto OK (file in ${path.relative(process.cwd(), OUT)})`);
  } finally {
    try { if (cdp) cdp.ws.close(); } catch (e) { /* niente */ }
    browser.kill();
    await new Promise((res) => { if (server.exitCode !== null) res(); else { server.once('exit', res); server.kill(); } });
    await wait(300);
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (e) { /* niente */ }
  }
})().catch((e) => { console.error('✗', e.message); process.exitCode = 1; setTimeout(() => process.exit(1), 300); });
