/* Burraco — Trascinamento, tocchi, tastiera e avvio.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Trascinamento (mouse e touch) ================= */
  function dropTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest('[data-drop]');
  }

  function dropAllowed(d, target) {
    if (!target) return false;
    const g = S.game;
    const kind = target.dataset.drop;
    const myTurn = g.turn === g.you;
    if (d.src === 'hand') {
      if (kind === 'hand') return true;
      if (!myTurn || g.phase !== 'play') return false;
      if (kind === 'discard') return d.ids.length === 1;
      return kind === 'meld' || kind === 'newmeld';
    }
    // tallone o scarti verso la mano / i giochi
    if (!myTurn || g.phase !== 'draw') return false;
    if (kind === 'hand') return true;
    return d.src === 'pile' && g.cfg.pile === 'closed' && (kind === 'meld' || kind === 'newmeld');
  }

  function startDrag(d) {
    const g = S.game;
    d.started = true;
    let html;
    if (d.src === 'hand') {
      const id = Number(d.el.dataset.card);
      d.ids = S.selected.has(id) ? selectedIds() : [id];
      const byId = new Map(g.hand.map((c) => [c.id, c]));
      html = d.ids.map((cid, i) => cardHTML(byId.get(cid), '', `style="--i:${i}"`)).join('');
      d.ids.forEach((cid) => { const el = $(`#hand [data-card="${cid}"]`); if (el) el.classList.add('ghosted'); });
    } else if (d.src === 'stock') html = backHTML();
    else {
      const top = g.discard[g.discard.length - 1];
      html = cardHTML(top) + (g.discardCount > 1 ? backHTML('', 'style="--i:1"') : '');
    }
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = html;
    document.body.appendChild(ghost);
    d.ghost = ghost;
    document.body.classList.add('dragging', `drag-${d.src}`);
    Sound.play('select');
  }

  function moveDrag(d, x, y) {
    d.x = x; d.y = y;
    const w = d.ghost.firstElementChild.offsetWidth;
    d.ghost.style.transform = `translate(${x - w / 2}px, ${y - w * 1.1}px) rotate(-4deg)`;
    const t = dropTargetAt(x, y);
    const ok = dropAllowed(d, t) ? t : null;
    if (ok !== d.hover) {
      if (d.hover) d.hover.classList.remove('drop-hover');
      if (ok) ok.classList.add('drop-hover');
      d.hover = ok;
    }
    if (d.src === 'hand' && ok && ok.dataset.drop === 'hand') showInsertMarker(d, x, y);
    else hideInsertMarker();
  }

  function insertIndex(d, x, y) {
    const cards = $$('#hand .card').filter((c) => !d.ids.includes(Number(c.dataset.card)));
    let best = null, bestDist = Infinity;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dist = Math.abs(cx - x) + Math.abs(cy - y) * 2;
      if (dist < bestDist) { bestDist = dist; best = { c, after: x > cx }; }
    }
    if (!best) return { id: null, after: true };
    return { id: Number(best.c.dataset.card), after: best.after, el: best.c };
  }

  function showInsertMarker(d, x, y) {
    const ins = insertIndex(d, x, y);
    let m = $('#insmark');
    if (!m) { m = document.createElement('div'); m.id = 'insmark'; document.body.appendChild(m); }
    if (!ins.el) { m.style.display = 'none'; return; }
    const r = ins.el.getBoundingClientRect();
    m.style.display = 'block';
    m.style.left = `${(ins.after ? r.right : r.left) - 2}px`;
    m.style.top = `${r.top}px`;
    m.style.height = `${r.height}px`;
  }
  function hideInsertMarker() { const m = $('#insmark'); if (m) m.style.display = 'none'; }

  function endDrag(d) {
    hideInsertMarker();
    if (d.ghost) d.ghost.remove();
    document.body.classList.remove('dragging', 'drag-hand', 'drag-stock', 'drag-pile');
    $$('.ghosted').forEach((e) => e.classList.remove('ghosted'));
    const target = d.hover;
    if (target) target.classList.remove('drop-hover');
    S.justDragged = Date.now();
    S.drag = null;
    if (!target) { if (S.pendingRender) render(); return; }
    const kind = target.dataset.drop;
    if (d.src === 'hand') {
      if (kind === 'hand') {
        const ins = insertIndex(d, d.x, d.y);
        const rest = S.handOrder.filter((id) => !d.ids.includes(id));
        let at = ins.id == null ? rest.length : rest.indexOf(ins.id) + (ins.after ? 1 : 0);
        rest.splice(at, 0, ...d.ids);
        S.handOrder = rest;
        S.sortMode = 'manual';
        Sound.play('select');
        render();
        return;
      }
      if (S.pendingRender) render();
      if (kind === 'discard') act('discard', { cardId: d.ids[0] });
      else if (kind === 'meld') act('add', { meldId: Number(target.dataset.meld), cardIds: d.ids });
      else if (kind === 'newmeld') {
        if (d.ids.length < 3) { toast('Per calare servono almeno 3 carte: selezionale e trascinale insieme'); return; }
        act('meld', { cardIds: d.ids });
      }
      return;
    }
    if (S.pendingRender) render();
    if (d.src === 'stock') act('draw');
    else if (kind === 'hand') handlers.takePile();
    else if (kind === 'meld') act('takePile', { meldId: Number(target.dataset.meld), cardIds: selectedIds() });
    else if (kind === 'newmeld') act('takePile', { cardIds: selectedIds() });
  }

  document.addEventListener('pointerdown', (e) => {
    Sound.unlock();
    if (e.button !== 0 || S.screen !== 'game' || !S.game) return;
    const card = e.target.closest('#hand .card');
    const dragEl = card || e.target.closest('[data-drag]');
    if (!dragEl) return;
    S.drag = { src: card ? 'hand' : dragEl.dataset.drag, el: dragEl, sx: e.clientX, sy: e.clientY, started: false, ids: [], hover: null };
  });
  document.addEventListener('pointermove', (e) => {
    const d = S.drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 9) return;
      startDrag(d);
    }
    e.preventDefault();
    moveDrag(d, e.clientX, e.clientY);
  }, { passive: false });
  const finish = () => {
    const d = S.drag;
    if (!d) return;
    if (d.started) endDrag(d); else S.drag = null;
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', () => {
    const d = S.drag;
    if (d && d.started) { d.hover = null; endDrag(d); } else S.drag = null;
  });

  /* ================= Click / tap ================= */
  document.addEventListener('click', (e) => {
    if (Date.now() - S.justDragged < 350) return;
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act && handlers[a.dataset.act]) {
      if (a.disabled) return;
      handlers[a.dataset.act](a, e);
      return;
    }
    const g = S.game;
    const card = e.target.closest('#hand [data-card]');
    if (card && g) {
      const id = Number(card.dataset.card);
      const now = Date.now();
      if (S.lastTap.id === id && now - S.lastTap.t < 350 && g.turn === g.you && g.phase === 'play') {
        S.lastTap = { id: null, t: 0 };
        act('discard', { cardId: id });
        return;
      }
      S.lastTap = { id, t: now };
      if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
      S.toggledCard = id;
      S.hint = null;
      Sound.play('select');
      if (navigator.vibrate) navigator.vibrate(8);
      render();
      return;
    }
    const meld = e.target.closest('[data-mid]');
    if (meld && g) {
      const meldId = Number(meld.dataset.mid);
      const mine = meld.hasAttribute('data-meld');
      const myTurn = g.turn === g.you;
      // con carte selezionate nel proprio turno si attacca; altrimenti si mostrano tutte le carte del gioco
      if (mine && myTurn && g.phase === 'play' && S.selected.size) act('add', { meldId, cardIds: selectedIds() });
      else if (mine && myTurn && g.phase === 'draw' && g.cfg.pile === 'closed') act('takePile', { meldId, cardIds: selectedIds() });
      else showMeld(meldId);
    }
  });

  /** Riquadro con tutte le carte di una combinazione (utile quando il tavolo è compattato) */
  function showMeld(meldId) {
    const g = S.game;
    const team = g.teams.find((t) => t.melds.some((m) => m.id === meldId));
    if (!team) return;
    const m = team.melds.find((x) => x.id === meldId);
    const nat = m.cards.find((c) => !M.isWild(c));
    const what = m.type === 'seq'
      ? `Scala di ${nat ? SUIT[nat.s] : ''}`
      : `Tris di ${nat ? rankName(nat.r) : ''}`;
    const owner = team.members.includes(g.you) ? 'La tua squadra' : esc(teamName(g, team));
    openModal('meld', `<div class="meldview">
      <h3>${what} · ${m.length} carte</h3>
      <p class="muted">${owner}${m.kind ? ` · <b>${esc(m.label)}</b>` : ''}${m.wild.some(Boolean) ? ' · bordo viola = matta' : ''}</p>
      <div class="mvcards">${m.cards.map((c, i) => cardHTML(c, m.wild[i] ? 'wildmark' : 'natural')).join('')}</div>
    </div>`);
  }

  document.addEventListener('scroll', (e) => {
    if (e.target && e.target.id === 'felt') S.feltScroll = e.target.scrollTop;
  }, true);

  document.addEventListener('input', (e) => {
    if (e.target.id === 'nick') { S.nickDraft = e.target.value; checkNickLive(e.target.value, '#nickStatus'); }
    if (e.target.id === 'nickEdit') checkNickLive(e.target.value, '#nickStatusEdit');
    if (e.target.id === 'rpRange') replayGo(e.target.value);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.rule) {
      const target = S.modalKind === 'editRules' ? 'edit' : 'setup';
      const value = el.type === 'checkbox' ? el.checked : el.value;
      setRule(target, el.dataset.rule, value);
    }
    if (el.id === 'name') {
      S.name = el.value.trim();
      store.set('bur_name', S.name);
      if (S.name) socket.emit('setName', { name: S.name });
    }
  });

  document.addEventListener('toggle', (e) => {
    if (e.target.matches && e.target.matches('details.custom')) S.customOpen = e.target.open;
  }, true);

  document.addEventListener('submit', (e) => {
    const forms = {
      nickform: async () => { const r = await emit('setNick', { nick: $('#nickEdit').value.trim() }); if (r.ok) { toast('Nickname aggiornato'); profileModal(); } },
      pwform: async () => { const r = await emit('setPassword', { password: $('#pwin').value }); if (r.ok) { toast('Password salvata'); profileModal(); } },
      codeform: async () => { const r = await emit('importProfile', { code: $('#codein').value }); if (r.ok) adoptProfile(r.token, r.nick); },
      loginform: async () => { const r = await emit('login', { nick: $('#lnick').value, password: $('#lpw').value }); if (r.ok) adoptProfile(r.token, r.nick); },
      leagueform: async () => {
        const per = document.querySelector('input[name=lgperiod]:checked');
        const r = await emit('leagueCreate', { name: $('#lgname').value, period: per ? per.value : 'settimana' });
        if (r.ok) { toast('Campionato creato: aggiungi i tuoi amici!'); leaguesModal(r.id); }
      },
      reportform: async () => {
        const r = await emit('report', { text: $('#reportin').value, screen: S.screen, device: `${navigator.userAgent.slice(0, 120)} · ${innerWidth}x${innerHeight}` });
        if (r.ok) { closeModal(); toast('Grazie! Segnalazione inviata 🙏'); }
      },
      friendform: async () => { const n = $('#friendin').value.trim(); if (!n) return; const r = await emit('friendRequest', { nick: n }); if (r.ok) toast(`Richiesta inviata a ${n}`); },
    };
    if (forms[e.target.id]) { e.preventDefault(); forms[e.target.id](); return; }
    if (e.target.id === 'musicform') {
      e.preventDefault();
      const url = $('#musicin').value.trim();
      if (url) emit('setMusic', { url }).then((r) => { if (r.ok) { toast('🎵 Musica condivisa con il tavolo'); musicModal(); } });
      return;
    }
    if (e.target.id === 'chatform') {
      e.preventDefault();
      const inp = $('#chatin');
      if (inp.value.trim()) emit('chat', { text: inp.value });
      inp.value = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.modalKind) closeModal();
    if (e.key === 'Enter' && e.target.id === 'joinCode') handlers.join();
  });

  setInterval(() => {
    if (!S.turnEnd) return;
    const left = Math.max(0, Math.ceil((S.turnEnd - Date.now()) / 1000));
    for (const el of $$('[data-cd]')) {
      el.textContent = `⏱ ${left}s`;
      el.classList.toggle('low', left <= 10);
    }
    const g = S.game;
    if (g && g.turn === g.you && left <= 10 && left > 0 && !S.warned10) {
      S.warned10 = true;
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
      Sound.play('turn');
    }
  }, 500);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (S.screen === 'game') { layoutHand(); fitTable(); } }, 120);
  });

  render();
  // tutto è caricato: adesso ci si collega al server (prima i messaggi arriverebbero a un'interfaccia incompleta)
  socket.connect();
