'use strict';
/*
 * Genera tutte le icone di Smazzata (PNG) dal disegno in scripts/icona.js, facendole "fotografare" a Chrome/Edge
 * senza finestra. Serve un browser installato (lo stesso della prova dell'interfaccia).
 *   node scripts/make-icons.js
 * Scrive: public/icon.svg, public/icons e launcher/icons (web), android-app/icons (app Android), store/ (Play Store).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { svg } = require('./icona');

const root = path.join(__dirname, '..');

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smazzata-icone-'));
const browser = findBrowser();

/** "Fotografa" un pezzo di HTML grande w×h e lo salva in PNG (sfondo trasparente) */
function shoot(html, w, h, out) {
  const page = path.join(tmp, 'p.html');
  fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}</style>${html}`);
  const shot = path.join(tmp, 'shot.png');
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', `--window-size=${w},${h}`, `--user-data-dir=${path.join(tmp, 'profilo')}`,
    `--screenshot=${shot}`, 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(shot, out);
  console.log(`${path.relative(root, out)} (${w}×${h})`);
}
const icon = (size, opts, out) => shoot(svg(opts).replace('width="512" height="512"', `width="${size}" height="${size}"`), size, size, out);

// web: icona normale (angoli arrotondati), "maskable" (sfondo pieno, il telefono la ritaglia), Apple (sfondo pieno)
for (const dir of ['public/icons', 'launcher/icons']) {
  icon(192, { shape: 'round' }, path.join(root, dir, 'icon-192.png'));
  icon(512, { shape: 'round' }, path.join(root, dir, 'icon-512.png'));
  icon(512, { shape: 'full', scale: 0.78 }, path.join(root, dir, 'maskable-512.png'));
  icon(180, { shape: 'full', scale: 0.9 }, path.join(root, dir, 'apple-touch-icon.png'));
}
fs.writeFileSync(path.join(root, 'public', 'icon.svg'), svg({ shape: 'round' }));

// app Android: icona quadrata arrotondata e rotonda, nelle densità dei launcher
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, size] of Object.entries(dens)) {
  icon(size, { shape: 'round', scale: 0.9 }, path.join(root, 'android-app', 'icons', `mipmap-${d}`, 'ic_launcher.png'));
  icon(size, { shape: 'circle', scale: 0.82 }, path.join(root, 'android-app', 'icons', `mipmap-${d}`, 'ic_launcher_round.png'));
}

// Play Store: icona 512×512 (sfondo pieno, Google arrotonda da sé) e immagine in evidenza 1024×500
icon(512, { shape: 'full', scale: 0.9 }, path.join(root, 'store', 'icona-512.png'));
shoot(`<div style="width:1024px;height:500px;display:flex;align-items:center;gap:36px;padding:0 70px;box-sizing:border-box;
  background:radial-gradient(ellipse at 30% 40%,#26905e,#0f5132 55%,#052014);font-family:Georgia,'Times New Roman',serif">
  <div style="width:340px;height:340px;flex:none">${svg({ shape: 'full', scale: 1.15 }).replace('width="512" height="512"', 'width="340" height="340"').replace(/<rect width="512" height="512" rx="0" fill="url\(#felt\)"\/>/, '')}</div>
  <div><div style="font-size:96px;font-weight:700;background:linear-gradient(90deg,#f2c14e,#fff6d5,#f2c14e);-webkit-background-clip:text;color:transparent">Smazzata</div>
  <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#d8eadf;font-size:25px;margin-top:6px;white-space:nowrap">Burraco · Scala 40 · Canasta · Scopa · Briscola</div>
  <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;color:#f2c14e;font-size:26px;margin-top:18px">Gioca con gli amici o contro il computer</div></div></div>`,
1024, 500, path.join(root, 'store', 'immagine-in-evidenza.png'));

fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
