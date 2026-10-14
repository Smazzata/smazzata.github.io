/* Burraco — Azioni: cosa fa ogni pulsante (data-act).
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Azioni ================= */
  function requireName() {
    if (OFFLINE || (S.social && S.social.nick)) return true;
    toast('Scegli prima il tuo nickname', true);
    const el = $('#nick');
    if (el) el.focus();
    return false;
  }

  async function joinRoom(code) {
    const r = await emit('joinRoom', { code });
    if (!r.ok) { S.screen = 'home'; render(); }
  }

  async function act(type, extra = {}) {
    const r = await emit('action', { type, ...extra });
    if (r.ok && ['meld', 'add', 'discard', 'takePile', 'undo'].includes(type)) { S.selected.clear(); render(); }
    return r;
  }

  // dietro il tunnel l'indirizzo cambia: gli inviti passano dalla pagina d'ingresso fissa
  const HOME_URL = 'https://simonemuliello010500-web.github.io/BurracoByMSF/';
  function inviteLink() {
    const base = /\.trycloudflare\.com$/.test(location.hostname) ? HOME_URL : `${location.origin}/`;
    return `${base}?t=${S.room.code}`;
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink()); toast('Link copiato'); }
    catch (e) { prompt('Copia il link:', inviteLink()); }
  }

  function setRule(target, key, value) {
    const obj = target === 'edit' ? S.editRules : S.rules;
    obj[key] = value;
    const n = R.normalize(obj);
    if (target === 'edit') { S.editRules = n; editRulesModal(); }
    else { S.rules = n; store.set('bur_rules', n); render(); }
  }

  function selectedIds() {
    return S.handOrder.filter((id) => S.selected.has(id));
  }

  const handlers = {
    goOnline() {
      try { sessionStorage.removeItem('bur_offline'); } catch (e) { /* niente */ }
      // dalla pagina fissa si torna alla pagina d'ingresso, che cerca il server
      location.href = /\/gioca\//.test(location.pathname) ? '../' : location.pathname;
    },
    goSetup() { if (!requireName()) return; S.screen = 'setup'; render(); },
    goHome() { S.screen = 'home'; render(); },
    join() {
      if (!requireName()) return;
      const code = ($('#joinCode').value || '').trim().toUpperCase();
      if (code.length !== 4) return toast('Il codice ha 4 caratteri', true);
      joinRoom(code);
    },
    presetRules(el) { const p = presetById(el.dataset.id); rulesModal(p.rules, p.name); },
    howto() { openModal('rules', `<div class="rules-text">${HOW_TO}${R.OTHER_VARIANTS}</div>`); },
    settings: settingsModal,
    pref(el) {
      const key = el.dataset.key;
      let val = el.dataset.val;
      if (val === 'true') val = true; else if (val === 'false') val = false;
      S.prefs[key] = val;
      applyPrefs();
      settingsModal();
      if (S.screen === 'game') render();
      if (key === 'sound' && val) { Sound.unlock(); Sound.play('turn'); }
      if (key === 'notify' && val && canNotify && Notification.permission !== 'granted') {
        Notification.requestPermission().then((p) => {
          if (p !== 'granted') { S.prefs.notify = false; applyPrefs(); toast('Notifiche non consentite dal browser', true); } else enablePush();
          settingsModal();
        });
      } else if (key === 'notify') { if (val) enablePush(); else disablePush(); }
    },
    preset(el) {
      const p = presetById(el.dataset.id);
      if (S.modalKind === 'editRules') { S.editRules = R.normalize({ ...p.rules, players: S.editRules.players }); editRulesModal(); return; }
      S.rules = R.normalize({ ...p.rules, players: S.rules.players });
      store.set('bur_rules', S.rules);
      render();
    },
    previewRules() { rulesModal(S.rules); },
    previewEdit() { rulesModal(S.editRules, null, true); },
    backEdit() { editRulesModal(); },
    create() { emit('createRoom', { rules: S.rules }); },
    createBots() { emit('createRoom', { rules: S.rules, vsBots: true }); },
    leave() {
      if (S.room && S.room.slow && S.game && !S.game.over && S.game.you >= 0) {
        toast('🐢 La partita ti aspetta: la trovi nella schermata iniziale');
      } else if (S.game && !S.game.over && S.game.you >= 0) {
        if (!confirm('Vuoi davvero uscire? Il computer giocherà al tuo posto: potrai tornare quando vuoi dalla schermata iniziale.')) return;
        store.set('bur_lastroom', S.room.code);
      }
      emit('leaveRoom');
      S.screen = 'home';
    },
    share() {
      if (navigator.share) navigator.share({ title: 'Burraco', text: `Gioca a Burraco con me! Codice tavolo ${S.room.code}`, url: inviteLink() }).catch(() => {});
      else copyLink();
    },
    copy: copyLink,
    sit(el) { emit('sit', { seat: Number(el.dataset.seat) }); },
    addBot(el) { emit('addBot', { seat: Number(el.dataset.seat) }); },
    fillBots() { emit('addBot', {}); },
    removeSeat(el) { emit('removeSeat', { seat: Number(el.dataset.seat) }); },
    start() { emit('start'); },
    roomRules() { rulesModal(S.room.rules); },
    daily() { if (!requireName()) return; dailyModal(); },
    openSlow(el) { joinRoom(el.dataset.code); },
    setSlow(el) { emit('setSlow', { on: el.dataset.val === '1' }); },
    abandon() {
      if (!confirm('Abbandonare la partita? Il computer prenderà il tuo posto.')) return;
      closeModal();
      emit('leaveRoom', { abandon: true });
      S.screen = 'home';
    },
    dailyFromResult() { emit('leaveRoom'); S.screen = 'home'; dailyModal(); },
    dailyRules() { rulesModal(S.dailyRules, 'Regole della sfida di oggi'); },
    async startDaily() {
      if (!requireName()) return;
      if (!confirm('Hai un solo tentativo: se esci prima della fine la sfida conta come giocata. Iniziamo?')) return;
      const r = await emit('startDaily');
      if (r.ok) closeModal();
    },
    editRules() { S.editRules = R.normalize(S.room.rules); editRulesModal(); },
    async applyRules() { const r = await emit('configure', { rules: S.editRules }); if (r.ok) { closeModal(); toast('Regole aggiornate'); } },
    gameRules() { rulesModal(S.game.cfg.rules); },
    log() { renderLogModal(); render(); },
    quickChat(el) { emit('chat', { text: el.dataset.text }); },
    scores: showScores,
    result: showResult,
    ready() { emit('ready'); },
    draw() { act('draw'); },
    takePile() {
      const g = S.game;
      if (g.cfg.pile === 'closed') {
        if (!S.selected.size) return toast('Seleziona le carte della mano da combinare con la carta in cima (oppure tocca una tua combinazione)', true);
        act('takePile', { cardIds: selectedIds() });
      } else act('takePile');
    },
    meld() {
      if (S.selected.size < 3) return toast('Seleziona almeno 3 carte da calare');
      act('meld', { cardIds: selectedIds() });
    },
    discard() { if (S.selected.size === 1) act('discard', { cardId: [...S.selected][0] }); },
    discardSel() {
      if (S.selected.size !== 1) return toast(S.selected.size ? 'Per scartare seleziona una sola carta' : 'Seleziona la carta da scartare, poi tocca gli scarti');
      act('discard', { cardId: [...S.selected][0] });
    },
    undo() { act('undo'); },
    sort() {
      S.sortMode = { suit: 'rank', rank: 'smart' }[S.sortMode] || 'suit';
      store.set('bur_sort', S.sortMode);
      S.handOrder = sortCards(S.game.hand, S.sortMode).map((c) => c.id);
      render();
    },
    clearSel() { S.selected.clear(); S.hint = null; render(); },
    async hint() {
      const r = await emit('hint');
      if (!r.ok || !r.hint) return;
      const h = r.hint;
      const g = S.game;
      const byId = new Map(g.hand.map((c) => [c.id, c]));
      const names = (ids) => (ids || []).map((id) => byId.get(id)).filter(Boolean).map(cardLabel).join(' ');
      S.hint = { type: h.type, meldId: h.meldId };
      let text;
      switch (h.type) {
        case 'draw': text = 'Pesca dal tallone'; break;
        case 'takePile':
          text = h.cardIds && h.cardIds.length ? `Raccogli gli scarti e combina la carta in cima con ${names(h.cardIds)}` : 'Raccogli gli scarti: ti servono';
          if (h.cardIds) S.selected = new Set(h.cardIds);
          break;
        case 'meld': S.selected = new Set(h.cardIds); text = `Cala ${names(h.cardIds)}`; break;
        case 'add': S.selected = new Set(h.cardIds); text = `Attacca ${names(h.cardIds)} al gioco evidenziato`; break;
        case 'discard': S.selected = new Set([h.cardId]); text = `Scarta ${names([h.cardId])}`; break;
        default: text = 'Annulla le calate di questo turno e scarta';
      }
      toast(`💡 ${text}`);
      render();
    },
    music() { musicModal(); render(); },
    stats: statsModal,
    async claimNick() {
      const nick = ($('#nick') || {}).value || '';
      const r = await emit('setNick', { nick: nick.trim() });
      if (r.ok) { S.nickDraft = null; S.nickCheck = null; toast(`Benvenuto, ${r.nick}!`); render(); }
    },
    profile: profileModal,
    tutorial() { tutorialModal(0); },
    report() {
      openModal('report', `<h2>🐞 Segnala un problema</h2>
        <p class="muted small">Descrivi cosa è successo e cosa ti aspettavi. Insieme al messaggio inviamo la situazione del tavolo
          (smazzata, turno, ultime mosse e quante carte hai), senza le carte degli altri giocatori. <a href="privacy.html">Privacy</a></p>
        <form id="reportform"><textarea id="reportin" rows="5" maxlength="1000" placeholder="Es. ho trascinato una carta sugli scarti ma non è stata scartata…"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn primary grow">Invia segnalazione</button></div></form>`);
      setTimeout(() => { const t = $('#reportin'); if (t) t.focus(); }, 50);
    },
    async rejoin() {
      const code = store.get('bur_lastroom', '');
      store.set('bur_lastroom', '');
      const r = await emit('joinRoom', { code });
      if (!r.ok) render();
    },
    tutStep(el) { tutorialModal(Number(el.dataset.i)); },
    practice() { if (!requireName()) return; closeModal(); emit('createRoom', { tutorial: true }); },
    coachOff() { S.coachOff = true; render(); },
    quickMenu() {
      if (!requireName()) return;
      openModal('quick', `<div class="result" style="text-align:center"><h2>⚡ Gioca subito</h2>
        <p>Entri in un tavolo con chi sta cercando una partita adesso. Si parte appena il tavolo è pieno (oppure puoi riempirlo con il computer).</p>
        <div class="row" style="justify-content:center"><button class="btn primary big" data-act="quick" data-n="2">In 2</button><button class="btn primary big" data-act="quick" data-n="4">In 4 (a coppie)</button></div></div>`);
    },
    async quick(el) { const r = await emit('quickPlay', { n: Number(el.dataset.n) }); if (r.ok) closeModal(); },
    series(el) { emit('setSeries', { bestOf: Number(el.dataset.val) }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    async playerCard(el) {
      const r = await emit('playerCard', { nick: el.dataset.nick });
      if (!r.ok) return;
      const t = r.together;
      openModal('card', `<div class="result">
        <button class="btn small" data-act="friends">← Amici</button>
        <div class="cardhead">${avatarHTML(r.nick, 0, false, r.avatar || { e: r.nick.charAt(0).toUpperCase(), c: '#9e9e9e' })}<h2>${esc(r.nick)} ${lvlHTML(r.level)}</h2></div>
        <h3>Insieme</h3>
        ${t.games ? `<p>${t.games} partite insieme: ${t.asPartners} in coppia (${t.winsTogether} vinte), ${t.games - t.asPartners} da avversari (tu ne hai vinte ${t.winsAgainst}).</p>${historyHTML(t.recent.map((h) => ({ ...h, preset: '', hands: 0 })))}` : '<p class="muted">Non avete ancora finito una partita insieme.</p>'}
        <h3>Statistiche</h3>${r.stats ? statsTable(r.stats) : '<p class="muted">Nessuna partita completata.</p>'}
        ${r.trophies && r.trophies.length ? `<h3>🏆 Trofei (${r.trophies.length})</h3><div class="trophyrow">${r.trophies.map((t) => `<span title="${esc(t.name)}">${esc(t.e)}</span>`).join('')}</div>` : ''}
        ${r.nick !== (S.social && S.social.nick) ? `<button class="btn small danger" style="margin-top:12px" data-act="block" data-nick="${esc(r.nick)}">🚫 Rimuovi e blocca</button>` : ''}</div>`);
    },
    async pickAvatar(el) { const r = await emit('setAvatar', { e: el.dataset.e, c: el.dataset.c }); if (r.ok) profileModal(); },
    reactPicker() {
      S.reactOpen = !S.reactOpen;
      render();
    },
    async react(el) {
      S.reactOpen = false;
      render();
      await emit('react', { emoji: el.dataset.e });
    },
    async deleteProfile() {
      if (!confirm('Eliminare definitivamente il profilo? Nickname, amici e classifica andranno persi.')) return;
      const r = await emit('deleteProfile');
      if (r.ok) { closeModal(); S.social = null; toast('Profilo eliminato'); render(); }
    },
    friends: friendsModal,
    recover(el, e) { if (e) e.preventDefault(); recoverModal(); },
    closeModal,
    toggleCode(el) { const c = $('#pcode'); c.classList.toggle('masked'); el.textContent = c.classList.contains('masked') ? 'Mostra' : 'Nascondi'; },
    async copyCode(el) { try { await navigator.clipboard.writeText(el.dataset.code); toast('Codice copiato'); } catch (e) { prompt('Copia il codice:', el.dataset.code); } },
    async regenCode() { if (!confirm('Generare un nuovo codice? Il vecchio codice e il vecchio QR smetteranno di funzionare.')) return; const r = await emit('regenCode'); if (r.ok) profileModal(); },
    async importCode(el) { const r = await emit('importProfile', { code: el.dataset.code }); if (r.ok) adoptProfile(r.token, r.nick); },
    acceptInvite(el) { closeModal(); if (!requireName()) return; joinRoom(el.dataset.code); },
    async invite(el) { const r = await emit('inviteFriend', { nick: el.dataset.nick }); if (r.ok) toast(r.pushed ? `${el.dataset.nick} non è online: gli arriva una notifica` : `Invito inviato a ${el.dataset.nick}`); },
    async block(el) {
      if (!confirm(`Bloccare ${el.dataset.nick}? Non potrà più mandarti richieste né inviti.`)) return;
      const r = await emit('blockPlayer', { nick: el.dataset.nick });
      if (r.ok) { toast(`${el.dataset.nick} bloccato`); friendsModal(); }
    },
    unblock(el) { emit('unblockPlayer', { nick: el.dataset.nick }); },
    watch(el) { closeModal(); joinRoom(el.dataset.code); },
    friendYes(el) { emit('friendRespond', { nick: el.dataset.nick, accept: true }); },
    friendNo(el) { emit('friendRespond', { nick: el.dataset.nick, accept: false }); },
    unfriend(el) { if (confirm(`Rimuovere ${el.dataset.nick}?`)) emit('friendRemove', { nick: el.dataset.nick }); },
    toggleTheme() { S.prefs.theme = S.prefs.theme === 'scuro' ? 'chiaro' : 'scuro'; applyPrefs(); render(); },
    async leaders(el) {
      const friends = !!(el && el.dataset && el.dataset.friends);
      const r = await emit('leaderboard', { friends });
      if (!r.ok) return;
      const tabs = `<div class="row tabs"><button class="swatch ${friends ? '' : 'on'}" data-act="leaders">Tutti</button><button class="swatch ${friends ? 'on' : ''}" data-act="leaders" data-friends="1">Solo amici</button></div>`;
      const rows = r.list.map((e, i) => `<tr class="${e.me ? 'meRow' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td style="text-align:left">${esc(e.name)} ${lvlHTML(e.level)}${e.me ? ' (tu)' : ''}</td><td>${e.wins}/${e.games}</td><td>${Math.round((e.wins / e.games) * 100)}%</td><td>${e.burraco}</td></tr>`).join('');
      openModal('leaders', `<div class="result"><h2>🏆 Classifica</h2>${tabs}
        ${rows ? `<table><tr><th></th><th style="text-align:left">Giocatore</th><th>Vinte</th><th>%</th><th>Burraco</th></tr>${rows}</table>` : '<p class="muted">Ancora nessuna partita completata. La classifica conta le partite finite tra giocatori umani (anche contro il computer).</p>'}
        <p class="muted small">Classifica di tutti i giocatori di questo server.</p></div>`);
    },
    resetStats() { if (confirm('Azzerare le statistiche?')) { store.set('bur_stats', {}); statsModal(); } },
    musicStop() { emit('setMusic', { url: '' }).then(() => musicModal()); },
    botLevel(el) { emit('setBotLevel', { level: el.dataset.val }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    turnTime(el) { emit('setTurnTime', { seconds: Number(el.dataset.val) }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    setAids(el) { emit('setAids', { on: el.dataset.val === '1' }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    setHints(el) { emit('setHints', { on: el.dataset.val === '1' }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    botSpeed(el) { emit('setBotSpeed', { speed: el.dataset.val }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
  };

  function cardLabel(c) {
    return c.r === 0 ? 'Jolly' : rankName(c.r) + SUIT[c.s];
  }
