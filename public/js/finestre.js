/* Burraco — Finestre di gioco: fine smazzata, punteggi, cronaca, regole.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /** Spiegazioni basate esclusivamente sulle carte visibili al giocatore. */
  function moveHelpModal() {
    const g = S.game;
    if (!g) return;
    const team = g.teams.find(x=>x.members.includes(g.you));
    const preview = team ? selectionPreview(g,team) : {canAdd:new Set()};
    const message = g.you < 0 ? 'Stai osservando la partita.' : g.phase === 'handEnd' ? 'La smazzata è terminata: guarda il riepilogo.'
      : g.turn !== g.you ? 'Attendi il tuo turno prima di giocare.'
      : g.phase === 'draw' ? 'Prima pesca dal tallone o raccogli gli scarti secondo le regole del tavolo.'
      : !S.selected.size ? 'Seleziona le carte che vuoi calare o attaccare. Per scartare seleziona una sola carta.'
      : S.room?.aids === false ? 'Gli aiuti visivi sono disattivati per questo tavolo: consulta le regole della partita.'
      : preview.newMeld?.ok ? 'Le carte selezionate formano una calata valida: tocca la casella di calata.'
      : preview.canAdd.size ? 'Puoi attaccare le carte selezionate a un gioco evidenziato.'
      : 'Le carte selezionate non formano una calata valida. Controlla combinazione, matte e punti di apertura.';
    const minimum = isS40Game() && !team?.opened ? g.cfg.opening : isCanastaGame() && !team?.melds.length ? team?.minimum : null;
    openModal('moveHelp', `<h2>${uiIcon('help')} ${t('Aiuto per questa mossa')}</h2><p>${t(message)}</p>${preview.newMeld?.label ? '<p>'+esc(t(preview.newMeld.label))+'</p>' : ''}${minimum ? '<p>'+t('Punti minimi per aprire')+': <b>'+minimum+'</b></p>' : ''}<div class="row"><button class="btn" data-act="gameRules">${uiIcon('rules')}${t('Regole del gioco')}</button><button class="btn primary" data-act="closeModal">${t('Torna al tavolo')}</button></div>`);
  }

  /* ================= Modali di gioco ================= */
  function showResult() {
    const g = S.game;
    if (!g || !g.handResult) return;
    const hr = g.handResult;
    const training = S.room.onDevice || S.room.offline || S.room.tutorial || S.room.progressEligible === false;
    const progress = S.handProgress;
    const earned = !training && g.you >= 0 && progress?.earned?.roomCode === S.room.code && progress.earned.gameSeq === S.room.gameSeq && progress.earned.handNo === g.handNo ? progress.earned : null;
    const mode = training ? 'Allenamento' : S.room.daily ? 'Sfida del giorno' : S.room.rankedFormat ? 'Classificata' : 'Amichevole online';
    const outcome = g.over && g.you >= 0 ? g.winners.length === 0 ? 'Pareggio' : g.winners.includes(g.you) ? 'Vittoria' : 'Sconfitta' : 'Fine smazzata';
    const progressHTML = training ? `<p class="result-mode-note">${t('Allenamento: nessun punto classifica, esperienza o trofeo.')}</p>`
      : earned ? `<section class="result-progress"><h3>${uiIcon('stats')} ${t('Progressi confermati')}</h3><p><b>+${earned.xp} ${t('punti esperienza')}</b> · ${t('Livello')} ${progress.level}</p><progress max="${progress.need}" value="${progress.into}" aria-label="${t('Esperienza nel livello')}"></progress>${earned.trophies.map(x=>`<p>${uiIcon('trophy')} ${esc(t(x.name))}</p>`).join('')}${(earned.rewards || []).map(x=>`<p>${uiIcon('check')} ${t('Premio sbloccato')}: ${esc(t(x.name))}</p>`).join('')}</section>` : '';
    const P = g.cfg.pozzettoName;
    const cols = hr.teams.map((t) => `<th>${esc(t.members.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & '))}</th>`).join('');
    const row = (label, fn) => `<tr><td>${label}</td>${hr.teams.map((t) => `<td>${fn(t)}</td>`).join('')}</tr>`;
    const reason = hr.reason === 'tie' ? 'Smazzata pari: 60 a 60.' : hr.reason === 'end' ? 'Smazzata terminata.' : hr.reason === 'surrender'
      ? `<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> <b>${esc(hr.surrendered.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' e '))}</b> ${hr.surrendered.length > 1 ? 'si sono arresi' : (hr.surrendered[0] === g.you ? 'ti sei arreso' : 'si è arreso')}.`
      : hr.reason === 'close' ? `${hr.closer === g.you ? t('Hai chiuso la smazzata') : `<b>${esc(g.players[hr.closer].name)}</b> ha chiuso la smazzata`}${hr.inHand ? ' <b>in mano</b> <svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-profile /></svg>' : ''}.` : 'Il tallone è finito.';
    const humans = S.room.seats.map((s, i) => (s && !s.isBot ? i : -1)).filter((i) => i >= 0);
    const waiting = humans.filter((i) => !S.room.ready.includes(i)).map((i) => S.room.seats[i].name);
    const imReady = S.room.ready.includes(g.you);
    let footer;
    if (S.room.daily && g.you >= 0) {
      const mineT = hr.teams.find((t) => t.members.includes(g.you));
      footer = `<div class="winner"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-calendar /></svg> Sfida completata: ${signed(mineT.total)} punti</div>
        <div class="row"><button class="btn primary grow" data-act="dailyFromResult"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Classifica della sfida</button><button class="btn grow" data-act="leave">Torna alla home</button></div>`;
    } else if (g.you < 0) {
      footer = g.over ? `<div class="winner"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Vince ${esc(g.winners.map((s) => g.players[s].name).join(' & '))}!</div>` : '<p class="muted">Stai guardando: la prossima smazzata parte quando i giocatori sono pronti.</p>';
    } else if (g.over && S.room.series) {
      const sr = S.room.series;
      const champ = sr.champion ? sr.champion.map((x) => (x === g.you ? 'Tu' : g.players[x].name)) : null;
      footer = `<div class="winner">${champ ? `<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Campione del torneo: ${esc([...new Set(champ)].join(' & '))}!` : `Partita ${sr.games} di ${sr.bestOf} vinta da ${esc(g.winners.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' & '))}`}</div>
        <p style="text-align:center">${seriesHTML(S.room, g)}</p>
        <button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Hai votato ✓' : champ ? '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-refresh /></svg> Nuovo torneo' : '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Prossima partita del torneo'}</button>
        ${imReady && waiting.length ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    } else if (g.over && S.room.tournament) {
      footer = `<div class="winner">${g.winners.includes(g.you) ? '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Passi al turno successivo!' : 'Fuori dal torneo, alla prossima!'}</div>
        <div class="row"><button class="btn primary grow" data-act="tourBack" data-id="${esc(S.room.tournament.id)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Torna al tabellone</button></div>`;
    } else if (g.over && S.room.rankedFormat) {
      const result = S.rankedLast?.matchId === S.room.rankedFormat.id ? S.rankedLast : null;
      footer = `
        ${result ? `${rankedCard(result.after)}${result.after.provisional || result.placementMatch ? '' : `<p>${result.delta > 0 ? '+' : ''}${result.delta} LP</p>`}` : ''}
        <div class="endopts"><button class="btn primary" data-act="rankedAgain">${t('Cerca partita')}</button><button class="btn" data-act="leaveNow">${t('Torna alla home')}</button></div>`;
    } else if (g.over) {
      // Due azioni principali, con le opzioni del tavolo raccolte sotto.
      const solo = S.room.onDevice || S.room.offline || humans.length <= 1;
      footer = `<div class="endopts">
        <button class="btn primary big" data-act="ready" ${imReady?'disabled':''}>${imReady?t('Rivincita: hai votato ✓'):solo?t('Gioca ancora'):t('Rivincita')}</button>
        <button class="btn big" data-act="leaveNow">${t('Torna alla home')}</button></div>
        ${imReady&&waiting.length?'<p class="muted">'+t('In attesa di:')+' '+esc(waiting.join(', '))+'</p>':''}
        <details class="result-secondary"><summary>${t('Altre opzioni')}</summary>
        <button class="btn" data-act="${solo?'newFromResult':'backToLobby'}">${t(solo?'Nuova partita':'Torna al tavolo')}</button>
        ${solo?'':'<p>'+t('Rivincita: stessi posti e stesse regole, si riparte quando tutti la premono.')+'</p>'}</details>`;
    } else {
      footer = `<button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Pronto ✓' : 'Prossima smazzata'}</button>
        ${waiting.length && imReady ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    }
    // riepilogo in alto: il TOTALE della partita in grande, sotto i punti di questa smazzata e la barra verso il traguardo
    const best = Math.max(...hr.teams.map((t) => t.total));
    const lead = Math.max(...hr.teams.map((t) => hr.scores[t.members[0]]));
    const pct = (v) => Math.max(0, Math.min(100, (v / g.cfg.target) * 100));
    const summary = hr.teams.map((t) => {
      const tot = hr.scores[t.members[0]];
      const names = t.members.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' & ');
      const s40 = isS40Game();
      return `<div class="rteam ${tot === lead ? 'win' : ''} ${t.members.includes(g.you) ? 'mine' : ''}">
        <div class="rname">${esc(names)}</div>
        <div class="rgrand ${s40 || tot < 0 ? 'neg' : ''}" data-count="${s40 ? -tot : tot}">${s40 ? -tot : tot}</div>
        <div class="rlabel">${s40 ? 'penalità totale' : 'totale partita'}</div>
        <div class="rhand ${t.total < 0 ? 'neg' : 'pos'}">${t.total === best ? '★ ' : ''}smazzata <b data-count="${t.total}" data-sign="1">${signed(t.total)}</b></div>
        ${s40
          ? `<div class="rbar pen"><i style="--from:${pct(t.total - tot)}%;--to:${pct(-tot)}%"></i></div><div class="rtot">eliminato a ${g.cfg.target}</div>`
          : `<div class="rbar"><i style="--from:${pct(tot - t.total)}%;--to:${pct(tot)}%"></i></div><div class="rtot">${g.game === 'briscola' || g.game === 'rubamazzetto' ? `vince chi arriva a ${g.cfg.target} ${g.cfg.target === 1 ? 'smazzata' : 'smazzate'}` : g.game === 'briscola5' ? `punti · smazzata ${g.handNo} di ${g.cfg.target}` : `si vince a ${g.cfg.target}`}</div>`}</div>`;
    }).join('');
    // righe del dettaglio: quelle tutte a zero non servono
    const detail = (label, key, extra) => (hr.teams.some((t) => t[key]) || (key === 'meldPts' && !isS40Game())
      ? `<tr><td>${label}</td>${hr.teams.map((t) => `<td class="${t[key] < 0 ? 'neg' : t[key] > 0 ? 'pos' : ''}">${signed(t[key])}${extra ? extra(t) : ''}</td>`).join('')}</tr>` : '');
    const kindCls = (b) => ({ clean: 'clean', semi: 'semi', dirty: 'dirty' }[b.kind] || 'real');
    // l'animazione si vede solo la prima volta (la finestra si ridisegna a ogni voto "pronto")
    const key = `${S.room.code}:${S.room.gameSeq || ''}:${g.handNo}:${hr.teams.map((t) => t.total).join(',')}`;
    const firstShow = S.resultShown !== key;
    S.resultShown = key;
    openModal('result', `<div class="result ${g.over?'is-final':''} ${firstShow ? 'anim' : ''}">
      <header class="result-heading" data-outcome="${outcome === 'Vittoria' ? 'win' : outcome === 'Sconfitta' ? 'loss' : 'neutral'}"><p>${t(mode)} · ${t('Smazzata')} ${g.handNo}</p>${uiIcon(outcome === 'Vittoria' ? 'trophy' : 'cards')}<h2>${t(outcome)}</h2></header><p class="result-reason">${reason}</p>
      <div class="rsum">${summary}</div>
      ${progressHTML}${typeof resultLootHTML==='function'?resultLootHTML():''}
      <div class="result-actions">${footer}</div>${g.over&&S.room.rankedFormat?`<details class="result-secondary"><summary>${t('Altre opzioni')}</summary><button class="btn" data-act="rankedProfile">${t('Profilo competitivo')}</button></details>`:''}
      ${g.over&&!training&&g.you>=0&&S.social?.nick?`<details class="result-company"><summary>${t('Una bella compagnia?')}</summary><p>${t('Ritrovatevi per la prossima partita.')}</p><div class="row">${humans.filter(i=>i!==g.you&&!(S.social.blocked||[]).includes(S.room.seats[i].name)).map(i=>`<button class="btn small" data-act="playerMenu" data-nick="${esc(S.room.seats[i].name)}">${uiIcon('friends')}${esc(S.room.seats[i].name)}</button>`).join('')}<button class="btn small" data-act="friends">${t('Il mio gruppo')}</button></div></details>`:''}
      <details class="result-details"><summary>${t('Dettaglio del punteggio')}</summary>
      <table><tr><th></th>${cols}</tr>
      ${hr.rows ? hr.rows.map((rw) => `<tr><td>${esc(rw.label)}</td>${rw.values.map((v, i) => `<td class="${rw.plain ? '' : v > 0 ? 'pos' : ''}">${rw.plain ? v : signed(v)}${rw.notes && rw.notes[i] ? `<br><span class="muted small">${esc(rw.notes[i])}</span>` : ''}</td>`).join('')}</tr>`).join('') : ''}
      ${hr.rows ? '' : detail('Carte calate', 'meldPts')}
      ${detail(`Bonus ${g.cfg.burracoName}`, 'bonusPts', (t) => (t.burraco.length ? `<div class="bchips">${t.burraco.map((b) => `<span class="bchip ${kindCls(b)}">${esc(cap(b.label.replace(/^(burraco|canastra) /i, '')))} +${b.bonus}</span>`).join('')}</div>` : ''))}
      ${detail('Chiusura', 'closePts')}
      ${detail(cap(P), 'pozPts')}
      ${detail('Carte in mano', 'handPts')}
      <tr class="tot"><td>Smazzata</td>${hr.teams.map((t) => `<td>${signed(t.total)}</td>`).join('')}</tr>
      <tr class="grand"><td>${isS40Game() ? 'Penalità totale' : 'Totale partita'}</td>${hr.teams.map((t) => `<td>${isS40Game() ? -hr.scores[t.members[0]] : hr.scores[t.members[0]]}</td>`).join('')}</tr>
      </table>
      ${leftoverHTML(g, hr)}
      ${g.hasReplay && !S.room.daily ? '<div class="row" style="justify-content:center;margin:8px 0"><button class="btn small" data-act="replay"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-eye /></svg> Rivedi la smazzata</button></div>' : ''}
      </details></div>`);
    if (firstShow) countUp($$('#modal [data-count]'));
  }

  const signed = (v) => (v > 0 ? `+${v}` : String(v));

  /** I numeri salgono da 0 al valore finale (una volta sola per smazzata) */
  function countUp(els) {
    if (reducedMotion) return;
    const t0 = performance.now(), dur = 900;
    const targets = els.map((el) => ({ el, v: Number(el.dataset.count), sign: !!el.dataset.sign }));
    for (const x of targets) x.el.textContent = '0';
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      for (const x of targets) { const v = Math.round(x.v * e); x.el.textContent = x.sign ? signed(v) : String(v); }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // sicurezza: se l'animazione non parte (pagina in secondo piano) i numeri finali si scrivono comunque
    setTimeout(() => { for (const x of targets) x.el.textContent = x.sign ? signed(x.v) : String(x.v); }, dur + 150);
  }

  function leftoverHTML(g, hr) {
    if (!hr.hands) return '';
    const rows = hr.hands.map((h, seat) => (h.length ? `<div class="leftover"><b>${esc(seat === g.you ? 'Tu' : g.players[seat].name)}</b><div class="lcards">${h.map((c) => cardHTML(c, 'mini')).join('')}</div></div>` : '')).join('');
    return rows ? `<h3>Carte rimaste in mano</h3>${rows}` : '';
  }

  function showScores() {
    const g = S.game;
    const rows = g.history.map((h) => `<tr><td>${h.handNo}</td>${h.teams.map((t) => `<td>${esc(t.members.map((s) => g.players[s].name).join(' & '))}: ${t.total}</td>`).join('')}</tr>`).join('');
    openModal('scores', `<div class="result"><h2>Punteggi</h2>
      <table>${g.players.map((p) => `<tr><td>${esc(p.name)}</td><td><b>${g.scores[p.seat]}</b></td></tr>`).join('')}</table>
      <h3>Smazzate</h3>${rows ? `<table>${rows}</table>` : '<p class="muted">Nessuna smazzata conclusa.</p>'}
      ${g.hasReplay && !S.room.daily ? '<div class="row" style="margin-top:10px"><button class="btn small" data-act="replay"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-eye /></svg> Rivedi l\'ultima smazzata</button></div>' : ''}</div>`);
  }

  function renderLogModal() {
    const g = S.game;
    const chat = S.chat.map((m, i) => `<div class="chat"><b ${S.room && m.seat !== S.room.you && m.seat >= 0 ? `data-act="playerMenu" data-nick="${esc(m.name)}" style="cursor:pointer;text-decoration:underline dotted"` : ''}>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('');
    openModal('log', `<h2>Chat</h2>
      <div class="log" id="chatlog">${chat || '<div class="muted">Nessun messaggio</div>'}</div>
      ${chatBanHTML() || `<form id="chatform" class="row" style="margin:8px 0"><input id="chatin" class="grow" maxlength="140" placeholder="Scrivi un messaggio" autocomplete="off"><button class="btn primary">Invia</button></form>
      <div class="row quick">${['Bella!', 'Tocca a te 😉', 'Che fortuna!', 'Ops…', 'Ben giocato 👏'].map((t) => `<button class="btn small" data-act="quickChat" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>`}
      <h2>Cronaca</h2><div class="log">${g ? g.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join('') : ''}</div>`);
    const cl = $('#chatlog');
    cl.scrollTop = cl.scrollHeight;
    S.unread = 0;
  }

  function editRulesModal() {
    const r = S.editRules;
    openModal('editRules', `<h2>Modifica regole</h2>
      ${presetsHTML(r)}
      <p>${rulesStatus(r)}</p>
      ${rulesFormHTML(r)}
      <div class="row" style="margin-top:12px"><button class="btn ghost dark" data-act="previewEdit"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-rules /></svg> Anteprima regole</button>
      <button class="btn primary grow" data-act="applyRules">Applica</button></div>`);
  }

  /** menu ☰ del tavolo: le funzioni meno usate, con nomi scritti per intero */
  function tableMenuModal() {
    const r=S.room||{},g=S.game;
    if(r.campaign){openModal('tableMenu',menuCardsHTML('Il tuo viaggio',[
      {act:'campaignContinue',icon:'play',name:'Riprendi'},{act:'campaignObjectives',icon:'trophy',name:'Obiettivi del livello'},{act:'campaignShop',icon:'cards',name:'Bottega degli aiuti'},{act:'gameRules',icon:'book',name:'Regole del gioco'},{act:'settings',icon:'settings',name:'Impostazioni'},{act:'campaignMute',icon:'music',name:'Disattiva la voce'},{act:'campaignMap',icon:'home',name:'Torna alla mappa'}],''));return;}
    const html=menuCardsHTML('Menu della partita',[
      {act:'closeModal',icon:'play',name:'Riprendi'},{act:'scores',icon:'trophy',name:'Punteggi'},
      {act:'moveHelp',icon:'help',name:'Aiuto per questa mossa'},
      {act:'settings',icon:'settings',name:'Impostazioni'},
      ...(r.isHost?[{act:'settingsTable',icon:'cards',name:'Impostazioni del tavolo'}]:[]),
      {act:'leave',icon:'exit',name:'Esci dalla partita'}],'');
    openModal('tableMenu',html.replace('</section>',`<details class="menu-details"><summary>${t('Altre opzioni')}</summary><div class="menulist"><button class="menuitem" data-act="gameRules">${uiIcon('book')}${t('Regole del gioco')}</button>${!OFFLINE?`<button class="menuitem" data-act="music">${uiIcon('music')}${t('Musica del tavolo')}</button>`:''}<button class="menuitem" data-act="report">${uiIcon('report')}${t('Segnala un problema')}</button></div>      ${S.room && S.room.slow && S.game && !S.game.over && S.game.you >= 0 ? '<h4>Partita con calma</h4><button class="btn small danger" data-act="abandon"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> Abbandona la partita</button>' : ''}
      ${S.game && !S.game.over && S.game.you >= 0 ? `<h4>Fine della partita</h4><div class="row">
        <button class="btn small danger" data-act="surrender"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> ${partnerIsHuman() ? 'Proponi la resa al compagno' : 'Arrenditi'}</button>
        ${S.room.isHost && !S.room.daily ? '<button class="btn small" data-act="endGame"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> Termina la partita</button>' : ''}
        ${S.room.isHost ? '<button class="btn small" data-act="closeTable"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> Chiudi il tavolo</button>' : ''}</div>
        <p class="muted small">Arrendersi fa vincere gli avversari. «Termina» chiude la partita senza vincitori e riporta tutti in sala d'attesa; «Chiudi il tavolo» manda tutti alla schermata iniziale.</p>` : ''}
</details></section>`));
  }

  /** ❓ al tavolo: cosa fare adesso (passi del turno e suggerimento), in una nuvoletta che sparisce da sola */
  function turnHelp() {
    const g = S.game;
    if (!g) return;
    const old = $('#turnhelp');
    if (old) { old.remove(); return; }
    const b = document.createElement('div');
    b.id = 'turnhelp';
    b.className = 'turnhelp';
    b.innerHTML = `${stepsHTML(g)}<div>${statusText(g)}</div>`;
    document.body.appendChild(b);
    const close = () => { b.classList.add('out'); setTimeout(() => b.remove(), 250); document.removeEventListener('pointerdown', close, true); };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 50);
    setTimeout(close, 5000);
  }

  /** 🕘 storico dei turni: la cronaca della smazzata, dalla mossa più recente */
  function turnLogModal() {
    const g = S.game;
    openModal('turnLog', `<h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-clock /></svg> Storico dei turni</h2><div class="log turnlog">${g && g.log.length ? g.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join('') : '<div class="muted">Ancora nessuna mossa</div>'}</div>`);
  }

