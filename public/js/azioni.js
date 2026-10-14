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
    if (type === 'add' && isS40Game() && extra.cardIds && extra.cardIds.length === 1) {
      const g = S.game;
      const m = g.teams.flatMap((t) => t.melds).find((x) => x.id === extra.meldId);
      const card = g.hand.find((c) => c.id === extra.cardIds[0]);
      if (m && card && card.r !== 0 && !S40R.analyzeMeld(m.cards.concat([card]), g.cfg.rules, m.type)) {
        // non si attacca: forse prende il posto di un jolly
        const swapped = m.cards.map((c, i) => (m.wild[i] ? card : c));
        if (m.wild.some(Boolean) && m.cards.some((c, i) => m.wild[i] && S40R.analyzeMeld(m.cards.map((x, k) => (k === i ? card : x)), g.cfg.rules, m.type))) {
          type = 'swap';
          extra = { meldId: extra.meldId, cardId: card.id };
        }
        void swapped;
      }
    }
    const r = await emit('action', { type, ...extra });
    if (r.ok && ['meld', 'add', 'swap', 'discard', 'takePile', 'undo'].includes(type)) { S.selected.clear(); render(); }
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
    const n = RX.normalize(obj);
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
      if (S.modalKind === 'editRules') { S.editRules = RX.normalize({ ...p.rules, players: S.editRules.players }); editRulesModal(); return; }
      S.rules = RX.normalize({ ...p.rules, players: S.rules.players });
      store.set('bur_rules', S.rules);
      render();
    },
    previewRules() { rulesModal(S.rules); },
    previewEdit() { rulesModal(S.editRules, null, true); },
    backEdit() { editRulesModal(); },
    create() { emit('createRoom', { rules: S.rules }); },
    createBots() { emit('createRoom', { rules: S.rules, vsBots: true }); },
    leave() {
      // in partita: una finestrella con tutte le scelte (uscire, arrendersi, terminare, chiudere)
      if (S.game && !S.game.over && S.game.you >= 0 && S.modalKind !== 'leave') {
        const slow = S.room.slow;
        openModal('leave', `<h2>Uscire dal tavolo?</h2>
          <div class="leaveopts">
            <button class="btn primary" data-act="leaveNow">${slow ? '🐢 Torna alla schermata iniziale<br><small>la partita ti aspetta</small>' : '⏏ Esci<br><small>il computer gioca al tuo posto, puoi tornare quando vuoi</small>'}</button>
            <button class="btn danger" data-act="surrender">🏳️ ${partnerIsHuman() ? 'Proponi la resa al compagno' : 'Arrenditi'}<br><small>vincono gli avversari</small></button>
            ${S.room.isHost && !S.room.daily ? '<button class="btn" data-act="endGame">⛔ Termina la partita<br><small>nessun vincitore, tutti in sala d’attesa</small></button>' : ''}
            ${S.room.isHost ? '<button class="btn" data-act="closeTable">🚪 Chiudi il tavolo<br><small>tutti alla schermata iniziale</small></button>' : ''}
          </div>`);
        return;
      }
      handlers.leaveNow();
    },
    leaveNow() {
      closeModal();
      if (S.room && S.room.slow && S.game && !S.game.over && S.game.you >= 0) {
        toast('🐢 La partita ti aspetta: la trovi nella schermata iniziale');
      } else if (S.game && !S.game.over && S.game.you >= 0) {
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
    replay() { openReplay(); },
    playerMenu(el) { playerMenu(el.dataset.nick); },
    async addFriendNick(el) {
      const r = await emit('friendRequest', { nick: el.dataset.nick });
      if (r.ok) { toast(`Richiesta inviata a ${el.dataset.nick}`); closeModal(); }
    },
    reportPlayer(el) {
      openModal('reportPlayer', `<h2>⚠️ Segnala ${esc(el.dataset.nick)}</h2>
        <p class="muted small">La segnalazione arriva al gestore insieme agli ultimi messaggi della chat di questo tavolo. Chi segnali non lo saprà.</p>
        <form id="reportPlayerForm" data-nick="${esc(el.dataset.nick)}">
          ${[['offese', 'Offese o linguaggio inappropriato'], ['scorretto', 'Comportamento scorretto'], ['nick', 'Nickname inappropriato'], ['altro', 'Altro']]
            .map(([v, l], i) => `<label class="radio"><input type="radio" name="rpreason" value="${v}" ${i === 0 ? 'checked' : ''}> ${l}</label>`).join('')}
          <textarea id="rptext" rows="3" maxlength="500" placeholder="Vuoi aggiungere qualcosa? (facoltativo)"></textarea>
          <div class="row" style="margin-top:8px"><button class="btn primary grow">Invia segnalazione</button></div></form>`);
    },
    leagues() { leaguesModal(); },
    leagueToggle(el) { leaguesModal(S.leagueOpen === el.dataset.id ? null : el.dataset.id); },
    async leagueAdd(el) {
      const sel = $(`#lgadd-${el.dataset.id}`);
      const r = await emit('leagueAdd', { id: el.dataset.id, nick: sel && sel.value });
      if (r.ok) { toast(`${sel.value} aggiunto al campionato`); leaguesModal(); }
    },
    async leagueKick(el) {
      if (!confirm(`Togliere ${el.dataset.nick} dal campionato?`)) return;
      const r = await emit('leagueRemove', { id: el.dataset.id, nick: el.dataset.nick });
      if (r.ok) leaguesModal();
    },
    async leagueLeave(el) {
      if (!confirm('Uscire dal campionato? I tuoi punti di questa stagione andranno persi.')) return;
      const r = await emit('leagueRemove', { id: el.dataset.id });
      if (r.ok) leaguesModal(null);
    },
    async surrender(el) {
      const accepting = el && el.dataset.ok;
      const text = accepting ? 'Confermi la resa? Vincono gli avversari.'
        : partnerIsHuman() ? 'Proporre la resa al compagno? Se accetta, la partita finisce e vincono gli avversari.'
          : 'Arrendersi? La partita finisce e vincono gli avversari.';
      if (!confirm(text)) return;
      const r = await emit('surrender');
      if (r.ok) { closeModal(); if (!r.done) toast('Proposta inviata al compagno'); }
    },
    surrenderCancel() { emit('surrenderCancel'); },
    async endGame() {
      if (!confirm('Terminare la partita per tutti? Non ci saranno vincitori e non conterà nelle statistiche.')) return;
      const r = await emit('endGame');
      if (r.ok) closeModal();
    },
    async closeTable() {
      if (!confirm('Chiudere il tavolo? Tutti torneranno alla schermata iniziale.')) return;
      const r = await emit('closeTable');
      if (r.ok) { closeModal(); store.set('bur_lastroom', ''); S.screen = 'home'; render(); }
    },
    rpGo(el) { if (RP.timer) { clearInterval(RP.timer); RP.timer = null; } replayGo(el.dataset.to); },
    rpPlay() { replayPlay(); },
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
    editRules() { S.editRules = RX.normalize(S.room.rules); editRulesModal(); },
    pickGame(el) {
      const players = S.rules.players;
      S.rules = el.dataset.game === 'scala40' ? S40R.normalize({ players }) : R.normalize({ ...R.PRESETS[0].rules, players });
      store.set('bur_rules', S.rules);
      render();
    },
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
      const myT = g.teams.find((t) => t.members.includes(g.you));
      if (isS40Game() && !myT.opened && g.cfg.rules.pileNeedsOpen) {
        if (!S.selected.size) return toast(`Non hai ancora aperto: seleziona le carte con cui aprire (almeno ${g.cfg.opening} punti) insieme allo scarto, poi tocca lo scarto`, true);
        act('takePile', { cardIds: selectedIds() });
      } else if (g.cfg.pile === 'closed') {
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
    practice(el) { if (!requireName()) return; closeModal(); emit('createRoom', { tutorial: true, rules: el && el.dataset.game === 'scala40' ? { game: 'scala40' } : undefined }); },
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
        <h3>Statistiche</h3>${r.stats ? byGameHTML(r.byGame, r.stats) : '<p class="muted">Nessuna partita completata.</p>'}
        ${r.trophies && r.trophies.length ? `<h3>🏆 Trofei (${r.trophies.length})</h3><div class="trophyrow">${r.trophies.map((t) => `<span title="${esc(t.name)}">${esc(t.e)}</span>`).join('')}</div>` : ''}
        ${r.nick !== (S.social && S.social.nick) ? `<div class="row" style="margin-top:12px"><button class="btn small danger" data-act="block" data-nick="${esc(r.nick)}">🚫 Rimuovi e blocca</button><button class="btn small" data-act="reportPlayer" data-nick="${esc(r.nick)}">⚠️ Segnala</button></div>` : ''}</div>`);
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
      const d = (el && el.dataset) || {};
      if (d.friends !== undefined) S.lbFriends = d.friends === '1';
      if (d.game) S.lbGame = d.game;
      const friends = !!S.lbFriends, game = S.lbGame || 'burraco';
      const r = await emit('leaderboard', { friends, game });
      if (!r.ok) return;
      const tabs = `<div class="row tabs"><button class="swatch ${game === 'burraco' ? 'on' : ''}" data-act="leaders" data-game="burraco">🃏 Burraco</button><button class="swatch ${game === 'scala40' ? 'on' : ''}" data-act="leaders" data-game="scala40">🂡 Scala 40</button></div>
        <div class="row tabs"><button class="swatch ${friends ? '' : 'on'}" data-act="leaders" data-friends="0">Tutti</button><button class="swatch ${friends ? 'on' : ''}" data-act="leaders" data-friends="1">Solo amici</button></div>`;
      const rows = r.list.map((e, i) => `<tr class="${e.me ? 'meRow' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td style="text-align:left">${esc(e.name)} ${lvlHTML(e.level)}${e.me ? ' (tu)' : ''}</td><td>${e.wins}/${e.games}</td><td>${Math.round((e.wins / e.games) * 100)}%</td><td>${game === 'scala40' ? '' : e.burraco}</td></tr>`).join('');
      openModal('leaders', `<div class="result"><h2>🏆 Classifica</h2>${tabs}
        ${rows ? `<table><tr><th></th><th style="text-align:left">Giocatore</th><th>Vinte</th><th>%</th><th>${game === 'scala40' ? '' : 'Burraco'}</th></tr>${rows}</table>` : '<p class="muted">Ancora nessuna partita completata. La classifica conta le partite finite tra giocatori umani (anche contro il computer).</p>'}
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
