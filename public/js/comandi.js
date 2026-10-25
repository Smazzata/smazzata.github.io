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

  let cardPeekTimer=null;
  function cancelCardPeek(){clearTimeout(cardPeekTimer);cardPeekTimer=null;document.querySelector('.card-lens')?.remove();}
  function showCardPeek(d){
    if(S.drag!==d||d.started||d.peekContext!==tableSignalContext(S.room,S.game)||S.modalKind||document.hidden||S.actionPending||!d.el.isConnected)return;
    const card=S.game?.hand.find(c=>c.id===Number(d.el.dataset.card));if(!card)return;
    d.peeked=true;const lens=document.createElement('div');lens.className='card-lens';lens.setAttribute('role','img');lens.setAttribute('aria-label',t('Anteprima della carta')+': '+d.el.getAttribute('aria-label'));
    lens.innerHTML=cardHTML(card)+'<small>'+t('Rilascia per chiudere')+'</small>';document.body.append(lens);
    const r=d.el.getBoundingClientRect();lens.style.left=Math.max(8,Math.min(innerWidth-lens.offsetWidth-8,r.x+r.width/2-lens.offsetWidth/2))+'px';lens.style.top=Math.max(8,Math.min(innerHeight-lens.offsetHeight-8,r.top-lens.offsetHeight-18))+'px';
  }
  window.addEventListener('resize',cancelCardPeek);
  document.addEventListener('contextmenu',e=>{if(e.target.closest('#hand .card'))e.preventDefault();});
  document.addEventListener('pointerdown', (e) => {
    Sound.unlock();cancelCardPeek();
    if (S.modalKind)return;
    if (e.button !== 0 || S.screen !== 'game' || !S.game) return;
    const card = e.target.closest('#hand .card');
    const dragEl = card || e.target.closest('[data-drag]');
    if (!dragEl) return;
    S.drag = { src: card ? 'hand' : dragEl.dataset.drag, el: dragEl, sx: e.clientX, sy: e.clientY, peekContext:tableSignalContext(S.room,S.game), started: false, ids: [], hover: null };
    if(card){const d=S.drag;cardPeekTimer=setTimeout(()=>showCardPeek(d),480);}
  });
  document.addEventListener('pointermove', (e) => {
    const d = S.drag;
    if (!d) return;
    if(d.peeked){e.preventDefault();return;}
    if (!d.started) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 9) return;
      cancelCardPeek();startDrag(d);
    }
    e.preventDefault();
    moveDrag(d, e.clientX, e.clientY);
  }, { passive: false });
  const finish = () => {
    cancelCardPeek();const d = S.drag;
    if(d?.peeked){S.justDragged=Date.now();S.drag=null;if(S.pendingRender)render();return;}
    if (!d) return;
    if (d.started) endDrag(d); else S.drag = null;
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', () => {
    cancelCardPeek();const d = S.drag;
    if(d?.peeked){S.justDragged=Date.now();S.drag=null;return;}
    if (d && d.started) { d.hover = null; endDrag(d); } else S.drag = null;
  });

  /* ================= Click / tap ================= */
  document.addEventListener('click', (e) => {
    if (Date.now() - S.justDragged < 350) return;
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act && handlers[a.dataset.act]) {
      if (a.disabled) return;
      if(!S.modalKind)rememberModalOpener(a);
      const wasDisabled=a.disabled;const result=handlers[a.dataset.act](a,e);
      if(result&&typeof result.then==='function'){
        a.setAttribute('aria-busy','true');a.disabled=true;
        Promise.resolve(result).catch(err=>{console.error(err);toast(t('Operazione non riuscita. Riprova.'),true);}).finally(()=>{a.removeAttribute('aria-busy');if(a.isConnected)a.disabled=wasDisabled;});
      }
      return;
    }
    const g = S.game;
    const card = e.target.closest('#hand [data-card]');
    if (card && g && g.presa) {
      if (g.turn === g.you && g.phase !== 'handEnd') presaPlay(Number(card.dataset.card));
      return;
    }
    if (card && g) {
      const keyboardFocus=document.activeElement===card;
      const id = Number(card.dataset.card);
      if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
      S.toggledCard = id;
      S.hint = null;
      Sound.play('select');
      // Sound.play applica anche la vibrazione scelta nelle preferenze.
      render();
      if(keyboardFocus)document.querySelector('#hand [data-card="'+id+'"]')?.focus({preventScroll:true});
      return;
    }
    const meld = e.target.closest('[data-mid]');
    if (meld && g) {
      const meldId = Number(meld.dataset.mid);
      const mine = meld.hasAttribute('data-meld');
      const myTurn = g.turn === g.you;
      // con carte selezionate nel proprio turno si attacca; altrimenti si mostrano tutte le carte del gioco
      const inZoom = !!meld.closest('.zoomview');
      if (mine && myTurn && g.phase === 'play' && S.selected.size) { if (inZoom) closeModal(); act('add', { meldId, cardIds: selectedIds() }); }
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
      : `${isS40Game() && m.length === 4 ? 'Poker' : 'Tris'} di ${nat ? rankName(nat.r) : ''}`;
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
    if(e.target.id==='musicVolume'){
      Music.setVolume(e.target.value);store.set('bur_prefs',S.prefs);
      const output=$('#musicVolumeValue');if(output)output.textContent=Music.volume()+'%';
    }
    if (e.target.id === 'reportin') store.set('smazzata_report_draft',e.target.value.slice(0,1000));
    if (e.target.id === 'nick') { S.nickDraft = e.target.value; checkNickLive(e.target.value, '#nickStatus'); }
    if (e.target.id === 'nickpw') S.pwDraft = e.target.value;
    if (e.target.id === 'nickage') S.ageOk = e.target.checked;
    if (e.target.id === 'nickmail') S.mailDraft = e.target.value;
    if (e.target.id === 'nickEdit') checkNickLive(e.target.value, '#nickStatusEdit');
    if (e.target.id === 'rpRange') replayGo(e.target.value);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.rule) {
      const target = S.modalKind === 'editRules' ? 'edit' : 'setup';
      const value = el.type === 'checkbox' ? el.checked : el.value;
      setRule(target, el.dataset.rule, value);
      if (el.closest('.choice-menu')) {
        const control = document.getElementById('rule-' + el.dataset.rule)?.closest('.choice-control');
        const menu = control?.querySelector('details');
        if (menu) { menu.open = true; [...menu.querySelectorAll('input')].find(input => input.value === value)?.focus({ preventScroll: true }); }
      }
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
      signupform: async () => {
        const r = await emit('finishSignup', { code: $('#sucode').value });
        if (r.ok) { S.signup = null; S.nickDraft = null; S.nickCheck = null; S.pwDraft = null; S.mailDraft = null; render(); recoveryCodeModal(r.nick, r.code); }
      },
      gatemailform: async () => {
        const email = $('#gatemail').value.trim();
        const r = await emit('setEmail', { email });
        if (r.ok) { S.gatePending = r.pending; toast('Codice inviato'); render(); }
      },
      verifyform: async () => {
        const r = await emit('verifyEmail', { code: $('#vcode').value });
        if (r.ok) { toast('Email confermata'); if (S.modalKind === 'profile') profileModal(); else { const b = $('.mailbox'); if (b) b.innerHTML = `<p>📧 Email confermata ✓</p>`; } }
      },
      emailform: async () => { const r = await emit('setEmail', { email: $('#emailin').value }); if (r.ok) profileModal(); },
      forgotmailform: async () => { const email = $('#fmail').value.trim(); const r = await emit('forgotPassword', { email }); if (r.ok) forgotModal(email); },
      mailresetform: async (f) => {
        const r = await emit('resetWithEmail', { email: f.dataset.email, code: $('#mrcode').value, password: $('#mrpw').value });
        if (r.ok) { toast('Password cambiata'); adoptProfile(r.token, r.nick); }
      },
      forgotform: async () => { const r = await emit('resetPassword', { nick: $('#fnick').value.trim(), code: $('#fcode').value, password: $('#fpw').value }); if (r.ok) { toast('Password cambiata'); adoptProfile(r.token, r.nick); } },
      tourform: async () => {
        if ($('#tourname').value.trim().length < 3) { fieldError($('#tourname'), 'Dai un nome al torneo (almeno 3 caratteri)'); return; }
        const r = await emit('tournamentCreate', { name: $('#tourname').value, game: $('#tourform input[name="tourgame"]:checked').value, size: Number($('#tourform input[name="toursize"]:checked').value) });
        if (r.ok) { toast('Torneo creato: invita gli amici a iscriversi!'); tournamentsModal(r.id); }
      },
      reportPlayerForm: async (form) => {
        const per = document.querySelector('input[name=rpreason]:checked');
        const r = await emit('reportPlayer', { nick: (form || $('#reportPlayerForm')).dataset.nick, reason: per ? per.value : 'altro', text: $('#rptext').value });
        if (r.ok) { closeModal(); toast('Grazie, segnalazione inviata '); }
      },
      leagueform: async () => {
        if ($('#lgname').value.trim().length < 3) { fieldError($('#lgname'), 'Dai un nome al campionato (almeno 3 caratteri)'); return; }
        const per = document.querySelector('input[name=lgperiod]:checked');
        const r = await emit('leagueCreate', { name: $('#lgname').value, period: per ? per.value : 'settimana' });
        if (r.ok) { toast('Campionato creato: aggiungi i tuoi amici!'); leaguesModal(r.id); }
      },
      reportform: async () => {
        const text = $('#reportin').value.trim();
        if (text.length < 5) { fieldError($('#reportin'), 'Descrivi il problema in qualche parola'); return; }
        const r = await emit('report', { text, screen: S.screen, build: CLIENT_BUILD,
          context: {game:S.game?.game || S.room?.rules?.game || homeGame(),code:S.room?.code,gameSeq:S.room?.gameSeq,hand:S.game?.handNo,phase:S.game?.phase,local:!!(S.localGame || OFFLINE),connected:S.connected},
          device: `${navigator.userAgent.slice(0, 120)} · ${innerWidth}x${innerHeight}` });
        if (r.ok) store.set('smazzata_report_draft','');
        if (r.ok) { closeModal(); toast('Grazie! Segnalazione inviata '); }
      },
      friendform: async () => { const n = $('#friendin').value.trim(); if (!n) return; const r = await emit('friendRequest', { nick: n }); if (r.ok) toast(`Richiesta inviata a ${n}`); },
    };
    if (forms[e.target.id]) { e.preventDefault(); forms[e.target.id](e.target); return; }
    if (e.target.id === 'musicform') {
      e.preventDefault();
      const url = $('#musicin').value.trim();
      if (url) emit('setMusic', { url }).then((r) => { if (r.ok) { toast('Musica condivisa con il tavolo'); musicModal(); } });
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
    if(e.key==='Escape'&&document.querySelector('.card-lens')){cancelCardPeek();return;}
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('#hand .card[role=button]')){e.preventDefault();e.target.click();return;}
    if(e.key==='Tab'&&S.modalKind){const list=modalFocusables(),first=list[0],last=list.at(-1);if(!list.includes(document.activeElement)||(e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last)){e.preventDefault();(e.shiftKey?last:first)?.focus();}return;}
    if (S.modalKind === 'homeGamePicker') {
      if(e.key==='Escape') { e.preventDefault();closeModal();$('#homeGame')?.focus();return; }

    }
    if (e.key === 'Escape' && S.modalKind) closeModal();
    if (e.key === 'Enter' && e.target.id === 'joinCode') handlers.join();
  });

  setInterval(() => {
    for (const el of $$('[data-wait-since]')) {
      const secs = Math.max(0, Math.floor((Date.now() - Number(el.dataset.waitSince)) / 1000));
      el.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2,'0');
    }
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

  // La tastiera virtuale riduce il viewport visibile, senza sempre ridimensionare la pagina.
  function mobileViewport() {
    const v = window.visualViewport;
    document.documentElement.style.setProperty('--visible-height', `${v ? v.height : innerHeight}px`);
    document.documentElement.style.setProperty('--visible-top', `${v ? v.offsetTop : 0}px`);
    const field = document.activeElement;
    if (field?.matches('input, textarea') && field.closest('#modal')) field.scrollIntoView({block:'nearest'});
  }
  window.visualViewport?.addEventListener('resize', mobileViewport);
  window.visualViewport?.addEventListener('scroll', mobileViewport);
  window.addEventListener('pageshow', mobileViewport);
  mobileViewport();

  function mobileBack() {
    if(document.querySelector('.card-lens')){cancelCardPeek();if(S.drag)S.drag.peeked=true;return true;}
    if (document.activeElement?.matches('input, textarea')) { document.activeElement.blur(); return true; }
    if (S.chestBusy || S.collectionBusy) return true;
    if(S.modalKind==='journey'&&S.journeyTab==='memories'){handlers.journeyTab({dataset:{tab:S.journeyPreviousTab||'today'}});return true;}
    if(S.modalKind==='settings'&&S.settingsSection){handlers.settingsBack();return true;}
    if(['activities','helpMenu'].includes(S.modalKind)){handlers.more();return true;}
    if (S.modalKind === 'collectionTable') { handlers.collectionPreviewBack(); return true; }
    if (S.modalKind === 'collectionLook') { renderCollection(); return true; }
    if (S.modalKind === 'cosmetics' && S.collectionInspect) { handlers.collectionBack(); return true; }
    if (['firstChest','chestReward'].includes(S.modalKind)) { handlers.chests(); return true; }
    if (S.modalKind === 'avatarDetail') { handlers.avatarCatalog(); return true; }
    if (S.modalKind) { closeModal(); return true; }
    if (S.screen === 'rankedLobby') { handlers.goHome(); return true; }
    if (S.screen === 'game' || S.screen === 'lobby') { handlers.leave(); return true; }
    if (S.screen !== 'home') { handlers.leagueBack(); return true; }
    return false;
  }
  // Chiamato dal guscio Android anche quando il gioco arriva dal server remoto.
  // Non tocca la cronologia: il percorso popstate resta riservato al browser.
  window.smazzataBack = mobileBack;
  // Un solo gradino nella cronologia: Indietro chiude prima il pannello, poi torna alla home.
  // Alla home il secondo Indietro mantiene il comportamento del browser/Android.
  try { history.pushState({smazzata:true}, '', location.href); } catch (e) { /* WebView senza cronologia */ }
  window.addEventListener('popstate', () => {
    if (mobileBack()) history.pushState({smazzata:true}, '', location.href);
    else history.back();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    cancelCardPeek();
    const d = S.drag;
    if (d?.started) { d.hover = null; endDrag(d); } else S.drag = null;
  });

  render();
  // tutto è caricato: adesso ci si collega al server (prima i messaggi arriverebbero a un'interfaccia incompleta)
  socket.connect();
  // c'è un APK più nuovo di quello installato?
  setTimeout(checkAppUpdate, 1500);
