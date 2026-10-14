'use strict';
// Genera le icone PNG dell'app (carta con cuore su panno verde) senza dipendenze esterne.
//   node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inHeart(x, y) {
  const X = x * 1.25, Y = -y * 1.25 + 0.25;
  return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
}

/** Colore di un punto in coordinate 0..1; `full` = sfondo pieno (icone maskable/Android) */
function sample(u, v, full) {
  const bgIn = full || inRoundRect(u, v, 0, 0, 1, 1, 0.2);
  if (!bgIn) return [0, 0, 0, 0];
  const d = Math.hypot(u - 0.5, v - 0.4);
  let col = mix([31, 122, 77], [8, 45, 28], Math.min(1, d * 1.5));
  // carta dietro, ruotata
  const a = -0.22, cu = u - 0.42, cv = v - 0.52;
  const ru = cu * Math.cos(a) - cv * Math.sin(a) + 0.42, rv = cu * Math.sin(a) + cv * Math.cos(a) + 0.52;
  if (inRoundRect(ru, rv, 0.24, 0.22, 0.6, 0.78, 0.05)) col = [176, 38, 58];
  if (inRoundRect(ru, rv, 0.27, 0.25, 0.57, 0.75, 0.03)) col = mix([196, 51, 74], [155, 27, 44], (ru + rv) % 0.06 > 0.03 ? 1 : 0);
  // carta davanti
  if (inRoundRect(u, v, 0.33, 0.2, 0.75, 0.82, 0.055)) col = [214, 207, 188];
  if (inRoundRect(u, v, 0.34, 0.21, 0.74, 0.81, 0.05)) col = [255, 253, 246];
  if (inHeart((u - 0.54) / 0.13, (v - 0.53) / 0.13)) col = [196, 32, 43];
  return [...col, 255];
}

function render(size, full) {
  const S = 3; // supersampling per bordi morbidi
  return png(size, (x, y) => {
    const acc = [0, 0, 0, 0];
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const p = sample((x + (i + 0.5) / S) / size, (y + (j + 0.5) / S) / size, full);
      acc[0] += p[0] * p[3]; acc[1] += p[1] * p[3]; acc[2] += p[2] * p[3]; acc[3] += p[3];
    }
    const a = acc[3] / (S * S);
    return a ? [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], a].map(Math.round) : [0, 0, 0, 0];
  });
}

const root = path.join(__dirname, '..');
const targets = [path.join(root, 'public', 'icons'), path.join(root, 'launcher', 'icons')];
const files = { 'icon-192.png': [192, false], 'icon-512.png': [512, false], 'maskable-512.png': [512, true], 'apple-touch-icon.png': [180, true] };
for (const dir of targets) fs.mkdirSync(dir, { recursive: true });
for (const [name, [size, full]] of Object.entries(files)) {
  const buf = render(size, full);
  for (const dir of targets) fs.writeFileSync(path.join(dir, name), buf);
  console.log(`${name} (${size}px, ${buf.length} byte)`);
}

// icone dell'app Android (densità standard dei launcher)
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, size] of Object.entries(dens)) {
  const dir = path.join(root, 'android-app', 'icons', `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  const buf = render(size, false);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), buf);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), buf);
  console.log(`android ${d} (${size}px)`);
}
