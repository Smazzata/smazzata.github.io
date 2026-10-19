'use strict';
// npm run anim -- --perf
// PERF_BASELINE=path/to/old/tavolo.js confronta anche geometria e costo con la versione precedente.
const fs = require('fs');
const assert = require('assert/strict');

module.exports = async (cdp) => {
  let baseline = 'null';
  if (process.env.PERF_BASELINE) {
    const source = fs.readFileSync(process.env.PERF_BASELINE, 'utf8');
    baseline = source.slice(source.indexOf('function fitTable()'), source.indexOf('/** Proposta di resa'));
    assert.ok(baseline.startsWith('function fitTable()'), 'Baseline fitTable mancante');
  }
  await cdp.run(`await emit('createRoom', { rules: { ...R.PRESETS[0].rules, players: 2 }, vsBots: true });
    for (let i = 0; i < 100 && !S.game; i++) await __W(100);
    if (!S.game) throw new Error('Partita non avviata');
    await __W(2000); return true;`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const results = [];
  try {
    for (const [width, height] of [[375, 812], [812, 375], [1280, 900]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
      const rows = await cdp.run(`
        const oldFit = (${baseline});
        const saved = S.game;
        S.game = structuredClone(saved);
        const scrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight').get;
        const results = [];
        try {
          for (const vertical of [false, true]) for (const big of [false, true]) for (const count of [0, 4, 12]) {
            document.body.classList.toggle('vmelds', vertical);
            document.body.classList.toggle('bigcards', big);
            for (const [ti, team] of S.game.teams.entries()) team.melds = Array.from({ length: count }, (_, mi) => ({
              id: ti * 100 + mi, type: 'seq', length: 7, kind: 'clean', wild: Array(7).fill(false),
              cards: Array.from({ length: 7 }, (_, i) => ({ id: 1000 + ti * 1000 + mi * 10 + i, s: 'H', r: i + 3 }))
            }));
            const html = gameHTML();
            const measure = (fit) => {
              const samples = [];
              let geometry, reads;
              for (let i = 0; i < 5; i++) {
                $('#app').innerHTML = html;
                layoutHand();
                const felt = $('#felt');
                reads = 0;
                Object.defineProperty(felt, 'scrollHeight', { get() { reads++; return scrollHeight.call(this); } });
                const start = performance.now();
                fit();
                void felt.clientHeight;
                samples.push(performance.now() - start);
                geometry = [...document.querySelectorAll('#felt, #felt .card')].map(el => {
                  const r = el.getBoundingClientRect();
                  return [r.x, r.y, r.width, r.height].map(x => Math.round(x * 100) / 100);
                });
              }
              samples.sort((a, b) => a - b);
              return { ms: +samples[2].toFixed(2), reads, geometry };
            };
            const before = oldFit && measure(oldFit);
            const after = measure(fitTable);
            results.push({ vertical, big, count, before: before && { ms: before.ms, reads: before.reads },
              after: { ms: after.ms, reads: after.reads }, same: !before || JSON.stringify(before.geometry) === JSON.stringify(after.geometry) });
          }
        } finally { S.game = saved; }
        return results;
      `);
      results.push(...rows.map(row => ({ width, height, ...row })));
    }
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  console.table(results);
  fs.writeFileSync('test-output/render-perf.json', JSON.stringify(results, null, 2));
  assert.ok(results.every(row => row.same), 'Il ridimensionamento ha cambiato la geometria del tavolo');
  console.log('Performance: 36 scenari, CPU rallentata 4x; geometria verificata quando PERF_BASELINE è impostato.');
};
