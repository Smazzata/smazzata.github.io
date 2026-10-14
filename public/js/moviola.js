/* Burraco — Moviola: rivedi l'ultima smazzata mossa per mossa, con le carte di tutti scoperte.
 * Il server manda la situazione dopo la distribuzione e l'elenco delle mosse; il browser la rigioca
 * con lo stesso motore (engine.js) e ne ricava un fotogramma per mossa. */
'use strict';

  const RP = { frames: [], i: 0, timer: null, handNo: 0, you: 0 };

  async function openReplay() {
    const r = await emit('replay');
    if (!r.ok) return;
    try { await LocalServer.loadEngine('engine.js'); } catch (e) { toast('Moviola non disponibile in questo momento', true); return; }
    const E = (self.BurracoGames[r.replay.start.game] || self.BurracoGames.burraco).E;
    const g = JSON.parse(JSON.stringify(r.replay.start));
    Object.assign(g, { log: [], events: [], history: [] });
    const frames = [replayFrame(E, g, null, 0)];
    for (const x of r.replay.actions) {
      const logLen = g.log.length;
      const handsBefore = g.players.map((p) => p.hand.map((c) => c.id));
      try { E.apply(g, x.s, x.a); } catch (e) { break; }
      frames.push(replayFrame(E, g, x, logLen, handsBefore));
    }
    clearInterval(RP.timer);
    Object.assign(RP, { frames, i: 0, timer: null, handNo: r.replay.handNo, you: r.you });
    openModal('replay', `<div class="replay"><h2>🎬 Moviola · smazzata ${RP.handNo}</h2>
      <div id="rpbody"></div>
      <div class="rpctl">
        <button class="btn small" data-act="rpGo" data-to="first" title="Inizio">⏮</button>
        <button class="btn small" data-act="rpGo" data-to="prev" title="Indietro">◀</button>
        <button class="btn small primary" data-act="rpPlay" id="rpPlay" title="Avvia">▶</button>
        <button class="btn small" data-act="rpGo" data-to="next" title="Avanti">▶❘</button>
        <button class="btn small" data-act="rpGo" data-to="last" title="Fine">⏭</button>
      </div>
      <input type="range" id="rpRange" min="0" max="${frames.length - 1}" value="0"></div>`);
    renderReplay();
  }

  /** Fotogramma: mani di tutti, giochi, scarti e la mossa appena fatta (con le carte coinvolte) */
  function replayFrame(E, g, x, logLen, handsBefore) {
    const hot = new Set();
    const ev = g.lastEvent;
    if (x && ev) {
      for (const id of ev.cardIds || []) hot.add(id);
      if (ev.cardId != null) hot.add(ev.cardId);
      if (ev.type === 'draw' || ev.type === 'pile' || ev.type === 'pozzetto') {
        const before = new Set(handsBefore[x.s]);
        for (const c of g.players[x.s].hand) if (!before.has(c.id)) hot.add(c.id);
      }
    }
    return {
      seat: x ? x.s : null,
      text: x ? g.log.slice(logLen).filter((l) => !l.startsWith('—')).join(' · ') : 'Carte appena distribuite',
      hands: g.players.map((p) => ({ name: p.name, cards: sortCards(p.hand, 'suit') })),
      teams: g.teams.map((t) => ({ members: t.members, melds: t.melds.map((m) => ({ ...m, ...E.meldKind(m, g.cfg) })) })),
      discard: g.discard.slice(-1)[0] || null, discardCount: g.discard.length, stock: g.stock.length,
      hot,
    };
  }

  function renderReplay() {
    const f = RP.frames[RP.i];
    const body = $('#rpbody');
    if (!f || !body) return;
    const n = f.hands.length;
    const order = Array.from({ length: n }, (_, k) => (Math.max(0, RP.you) + k) % n);
    const keep = S.freshCards;
    S.freshCards = f.hot; // le carte della mossa si illuminano come quelle "nuove"
    const meldsOf = (t) => (t.melds.length ? t.melds.map((m) => meldHTML(m, false, null)).join('') : '<span class="muted small">Nessun gioco</span>');
    body.innerHTML = `
      <div class="rpcap"><b>${RP.i}/${RP.frames.length - 1}</b> · ${esc(f.text || (f.seat != null ? `${f.hands[f.seat].name} gioca` : '…'))}</div>
      <div class="rpmid">${f.discard ? cardHTML(f.discard, `mini ${f.hot.has(f.discard.id) ? 'fresh' : ''}`) : '<span class="muted small">nessuno scarto</span>'}
        <span class="muted small">Scarti ${f.discardCount} · Tallone ${f.stock}</span></div>
      ${order.map((s) => `<div class="rpp ${f.seat === s ? 'on' : ''}"><b>${esc(f.hands[s].name)}${s === RP.you ? ' (tu)' : ''}</b> <span class="muted small">${f.hands[s].cards.length} carte</span>
        <div class="rphand">${f.hands[s].cards.map((c) => cardHTML(c, `mini ${f.hot.has(c.id) ? 'fresh' : ''}`)).join('')}</div></div>`).join('')}
      ${f.teams.map((t) => `<div class="rpteam"><b>${esc(t.members.map((s) => f.hands[s].name).join(' & '))}</b><div class="melds">${meldsOf(t)}</div></div>`).join('')}`;
    S.freshCards = keep;
    const range = $('#rpRange');
    if (range) range.value = String(RP.i);
    const play = $('#rpPlay');
    if (play) play.textContent = RP.timer ? '⏸' : '▶';
  }

  function replayGo(to) {
    const last = RP.frames.length - 1;
    RP.i = to === 'first' ? 0 : to === 'last' ? last : to === 'prev' ? Math.max(0, RP.i - 1) : to === 'next' ? Math.min(last, RP.i + 1) : Math.max(0, Math.min(last, Number(to) || 0));
    renderReplay();
  }

  function replayPlay() {
    if (RP.timer) { clearInterval(RP.timer); RP.timer = null; renderReplay(); return; }
    if (RP.i >= RP.frames.length - 1) RP.i = 0;
    RP.timer = setInterval(() => {
      if (S.modalKind !== 'replay' || RP.i >= RP.frames.length - 1) { clearInterval(RP.timer); RP.timer = null; renderReplay(); return; }
      replayGo('next');
    }, 900);
    renderReplay();
  }
