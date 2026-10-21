'use strict';
const assert = require('assert/strict');

module.exports = async (cdp) => {
  await cdp.run(`if (S.room) await emit('leaveRoom', {});
    await emit('createRoom', { rules: { ...R.PRESETS[0].rules, players: 2 }, vsBots: true });
    for (let i = 0; i < 100 && !S.game; i++) await __W(100);
    if (!S.game) throw new Error('Partita non avviata');
    socket.off('state');
    await __W(2000);
    return true;`);
  const results = [];
  for (const rate of [1, 4]) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    results.push(await cdp.run(`
      clearAnticipated();
      document.querySelectorAll('.flyer').forEach(el => el.remove());
      const top = $('.pile .card.top');
      top.classList.remove('landed');
      void top.offsetWidth;
      top.classList.add('landed');
      const originalRandom = Math.random;
      Math.random = () => 0.9;
      try { animateEvent({ type: 'discard', seat: S.game.you === 0 ? 1 : 0 }); }
      finally { Math.random = originalRandom; }
      const flyer = document.querySelector('.flyer');
      if (!flyer) throw new Error('Volo dello scarto mancante');
      let last, overlap = false, frames = 0;
      const remove = flyer.remove.bind(flyer);
      flyer.remove = () => { last = flyer.firstElementChild.getBoundingClientRect().toJSON(); remove(); };
      const end = performance.now() + 2000;
      while (flyer.isConnected && performance.now() < end) {
        await new Promise(requestAnimationFrame);
        if (flyer.isConnected) {
          frames++;
          if (top.style.visibility !== 'hidden') overlap = true;
        }
      }
      const target = top.getBoundingClientRect();
      return { kind: 'avversario', rate: ${rate}, frames, overlap, removed: !flyer.isConnected, visible: top.style.visibility !== 'hidden',
        error: last ? Math.max(...['left', 'top', 'width', 'height'].map(k => Math.abs(last[k] - target[k]))) : null };
    `));
    for (const delay of [0, 80, 250, 500, -1]) results.push(await cdp.run(`
      const oldTop = $('.pile .card.top');
      const from = $('#hand .card');
      const html = cardHTML(S.game.hand.find(c => String(c.id) === from.dataset.card));
      S.game.discard.push(S.game.hand.find(c => String(c.id) === from.dataset.card));
      const flyer = fly(from, oldTop, html, { dur: 320, hold: true });
      await __W(${delay});
      const pile = $('.pile .pcards');
      oldTop.classList.remove('top');
      pile.insertAdjacentHTML('beforeend', html);
      const top = pile.lastElementChild;
      top.classList.add('top', 'landed');
      fitTable();
      pile.scrollLeft = pile.scrollWidth;
      const before = flyer.firstElementChild.getBoundingClientRect();
      landFlyer(flyer, top);
      const after = flyer.firstElementChild.getBoundingClientRect();
      const jump = Math.max(Math.abs(before.left - after.left), Math.abs(before.top - after.top));
      if (${delay} === -1) setTimeout(() => {
        render();
      }, 70);
      let last, overlap = false, frames = 0;
      const remove = flyer.remove.bind(flyer);
      flyer.remove = () => { last = flyer.firstElementChild.getBoundingClientRect().toJSON(); remove(); };
      const end = performance.now() + 2000;
      while (flyer.isConnected && performance.now() < end) {
        await new Promise(requestAnimationFrame);
        if (flyer.isConnected) { frames++; if ($('.pile .card.top').style.visibility !== 'hidden') overlap = true; }
      }
      const liveTop = $('.pile .card.top');
      const target = liveTop.getBoundingClientRect();
      const result = { kind: ${delay} === -1 ? 'mio-ridisegno' : 'mio-' + ${delay}, rate: ${rate}, frames, overlap, jump,
        removed: !flyer.isConnected, visible: liveTop.style.visibility !== 'hidden',
        error: last ? Math.max(...['left', 'top', 'width', 'height'].map(k => Math.abs(last[k] - target[k]))) : null };
      S.game.discard.pop(); render();
      return result;
    `));
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Regressione: una presa confermata può rimuovere la destinazione durante il volo.
  // La scomparsa senza presa, invece, non deve essere scambiata per un atterraggio valido.
  const captures = await cdp.run(`
    const saved = S.game, results = [];
    try {
      for (const confirmed of [true, false]) {
        const target = $('.pile .card.top').cloneNode(true);
        target.dataset.card = 'landing-capture-fixture';
        target.style.visibility = '';
        $('#felt').appendChild(target);
        S.game = { ...saved, presa: true, events: confirmed ? [{ type: 'take', cardIds: [target.dataset.card] }] : [] };
        const flyer = fly($('.stock .deck'), target, target.outerHTML, { hold: true });
        const n = __log.length;
        landFlyer(flyer, target);
        target.remove();
        await __W(800);
        results.push(__chk(__log[n]));
      }
    } finally { S.game = saved; }
    return results;
  `);
  assert.ok(captures[0]?.done && !captures[0].visible && captures[0].captured, 'Presa confermata durante il volo non riconosciuta');
  assert.ok(captures[1]?.done && !captures[1].visible && !captures[1].captured, 'Carta scomparsa senza una presa accettata dal controllo');
  console.table(results);
  for (const r of results) {
    assert.ok(r.removed && r.visible && r.frames > 2, 'Lo scarto deve completare un volo visibile');
    assert.ok(!r.overlap, 'La carta vera compare prima della fine del volo');
    assert.ok(r.error !== null && r.error < 2, 'Salto tra carta in volo e carta sulla pila');
    assert.ok(r.jump == null || r.jump < 2, 'Salto quando arriva la conferma dello scarto');
  }
};
