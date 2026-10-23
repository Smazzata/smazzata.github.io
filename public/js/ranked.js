'use strict';
// Viste collegate esclusivamente alle risposte autorevoli rankedBoard/rankedProfile.
const RANKED_TEAMS = ['burraco', 'reale', 'aberto', 'fechado', 'canasta', 'scopa', 'scopone', 'briscola', 'tressette'];
LEAGUE_GAMES.push(['reale', 'Burraco Reale'], ['aberto', 'Buraco Aberto'], ['fechado', 'Buraco Fechado']);
function rankedSummaryHTML(ranks) {
  return `<h3>${t('Profilo competitivo')}</h3>${Object.entries(ranks).filter(([key]) => AvailableGames.enabled(key.split(':')[0]) || ['reale','aberto','fechado'].includes(key.split(':')[0])).map(([key,p]) => `<div class="ranked-profile">${leagueEmblem(playerRank(p),'league-row-emblem')}<b>${esc(key.split(':').join(' · '))}</b>${rankedCard(p)}</div>`).join('')}`;
}
function rankedFormats(game) {
  const base = game === 'burraco' ? R.PRESETS[0].rules : RX.presetById(game).rules;
  const rules = RX.normalize(base);
  return (RX.schema(rules).find((f) => f.key === 'players')?.choices || [[rules.players, String(rules.players)]])
    .filter(([n]) => RX.normalize({ ...base, players: n }).players === n).sort((a, b) => a[0] - b[0]);
}
function rankedSelectionHTML(game) {
  const duo = S.rankedQueue === 'duo', canDuo = RANKED_TEAMS.includes(game) && rankedFormats(game).some(([n]) => n === 4);
  return `<section class="ranked-selection" aria-label="${t('Come vuoi giocare?')}"><fieldset><legend>${t('Come vuoi giocare?')}</legend><div class="ranked-queues">
    <button class="ranked-choice ${!duo ? 'selected' : ''}" data-act="leaders" data-queue="solo" aria-pressed="${!duo}"><b>${t('Coda singola')}</b><small>${t('Entra da solo')}</small></button>
    ${canDuo ? `<button class="ranked-choice ${duo ? 'selected' : ''}" data-act="leaders" data-queue="duo" aria-pressed="${duo}"><b>${t('Coda Duo')}</b><small>${t('Gioca con un amico')}</small></button>` : ''}</div></fieldset>
    ${duo ? `<p class="ranked-format-note"><b>${t('4 giocatori · 2 coppie')}</b><br>${t('Tu e il tuo amico contro un’altra coppia.')}</p>` : `<fieldset class="ranked-solo-formats"><legend>${t('Giocatori al tavolo')}</legend><div class="ranked-formats">${rankedFormats(game).map(([n]) => `<button class="ranked-choice ${n === S.rankedN ? 'selected' : ''}" data-act="leaders" data-n="${n}" aria-pressed="${n === S.rankedN}"><b>${n}</b><small>${t('Giocatori')}</small></button>`).join('')}</div>${S.rankedN === 4 && canDuo ? `<p class="ranked-format-note">${t('Il compagno viene scelto dal matchmaking.')}</p>` : ''}</fieldset>`}</section>`;
}
function rankedCard(p) {
  if (!p) return '';
  if (p.provisional) return `<div class="ranked-progress ranked-placement"><strong>${t('Non classificato')}</strong><p>${t('Piazzamenti')}: ${p.placements}/${p.placementTotal || 10}</p><progress max="${p.placementTotal || 10}" value="${p.placements}" aria-label="${t('Piazzamenti')}"></progress><p>${t('Completa i piazzamenti per ottenere un grado.')}</p><p>${t('Vittorie')}: ${p.wins} · ${t('Sconfitte')}: ${p.losses}</p></div>`;
  const promo = p.promo;
  return `<div class="ranked-progress"><strong>${esc(t(p.league))} ${p.division || ''}</strong>
    <p>${p.tier === 8 ? `${t('Rating competitivo')}: ${p.rating}` : p.provisional ? `${t('Piazzamenti')}: ${p.placements}/10 · ${t('Grado provvisorio')}` : `${p.lp}/100 LP`}</p>
    ${p.tier === 8 ? '' : `<progress max="100" value="${p.lp}" aria-label="LP"></progress>`}
    ${promo ? `<div class="ranked-promo"><b>${t('Promozione BO3')} · ${t(PLAYER_RANKS[promo.target].name)}</b><div>${[0, 1, 2].map((i) => `<span class="${promo.results[i] === 1 ? 'win' : promo.results[i] === 0 ? 'loss' : ''}">${promo.results[i] === 1 ? t('Vittoria') : promo.results[i] === 0 ? t('Sconfitta') : '—'}</span>`).join('')}</div><p>${t('Partite rimanenti')}: ${3 - promo.results.length}</p></div>` : ''}
    <p>${t('Vittorie')}: ${p.wins} · ${t('Sconfitte')}: ${p.losses}</p></div>`;
}
openLeaguePage = async function(el) {
  const d = el?.dataset || {};
  S.rankedSoloFormats ||= {};
  if (S.rankedQueue === 'solo' && S.rankedN) S.rankedSoloFormats[S.lbGame || 'burraco'] = S.rankedN;
  S.lbGame = homeGame();
  const game = S.lbGame || 'burraco', formats = rankedFormats(game);
  S.rankedQueue = d.queue || S.rankedQueue || 'solo';
  if (!RANKED_TEAMS.includes(game) || !formats.some(([n]) => n === 4)) S.rankedQueue = 'solo';
  S.rankedN = S.rankedQueue === 'duo' ? 4 : Number(d.n || S.rankedSoloFormats[game] || formats[0][0]);
  if (!formats.some(([n]) => n === S.rankedN)) S.rankedN = formats[0][0];
  if (d.friends !== undefined) S.lbFriends = d.friends === '1';
  if (d.season !== undefined) S.rankedSeason = Number(d.season);
  const request = S.leagueRequest = (S.leagueRequest || 0) + 1;
  closeModal(); S.screen = 'leaders'; S.leagueData = null; S.leagueError = false; S.rankPreview = null; render();
  const r = await emit('rankedBoard', { game, n: S.rankedN, queue: S.rankedQueue, friends: !!S.lbFriends, season: S.rankedSeason });
  if (request !== S.leagueRequest || S.screen !== 'leaders') return;
  if (r.ok) S.leagueData = r; else S.leagueError = true;
  render();
};
leadersHTML = function() {
  const data = S.leagueData, game = S.lbGame || 'burraco';
  const p = data?.mine, current = playerRank(p || { provisional: true }), preview = PLAYER_RANKS.find((r) => r.id === S.rankPreview) || current;
  const legend = data?.legend;
  return `<main class="page league-page theme-${preview.id}"><header class="league-header"><button class="league-back" data-act="leagueBack" aria-label="${t('Torna alla home')}">←</button><div><small>SMAZZATA RANKED</small><h1>${t('Classifica')}</h1></div></header>
    <p class="ranked-format-note">${esc(LEAGUE_GAMES.find(([id]) => id === game)?.[1] || game)}</p>
    ${rankedSelectionHTML(game)}
    ${!data ? `<p role="status">${t(S.leagueError ? 'Classifica non disponibile' : 'Caricamento classifica…')}</p>` : `
    <section class="league-hero"><div class="league-halo" aria-hidden="true"></div>${leagueEmblem(preview, 'league-hero-emblem')}<h2>${t(preview.name)} ${preview.division || ''}</h2>${!S.rankPreview || preview.id === current.id ? rankedCard(p) : ''}
    <button class="btn primary" data-act="rankedSearch">${t(S.rankedQueue === 'duo' ? 'Crea tavolo Duo' : 'Cerca partita')}</button><button class="btn small" data-act="rankedProfile">${t('Profilo competitivo')}</button>
    <p>${t('Stagione')} ${data.season + 1} · ${t('Fine stagione')}: ${new Date(data.ends).toLocaleDateString()}</p></section>
    <section class="league-journey"><h2>${t('Il percorso delle leghe')}</h2><div class="league-path">${PLAYER_RANKS.map((rank) => `<button class="league-step ${rank.id === preview.id ? 'selected' : ''}" data-act="leaguePreview" data-rank="${rank.id}">${leagueEmblem(rank)}<b>${t(rank.name)}</b></button>`).join('')}</div></section>
    <section class="ranked-legend" ${data.archived ? 'hidden' : ''}><h2>${t('Leggenda')} · Top 1%</h2><p>${t('Giocatori idonei')}: ${legend.eligible} · ${t('Posti disponibili')}: ${legend.slots}</p>
    <p>${t('Posizione mondiale')}: ${legend.position || '—'} · ${t('Percentile')}: ${legend.percentile == null ? '—' : legend.percentile.toFixed(2) + '%'}</p>
    ${p.rating ? `<p>${t('Rating competitivo')}: ${p.rating}</p>` : ''}<p>${t('Distanza dalla soglia')}: ${legend.distance} · ${t('Partite richieste')}: ${legend.minimumGames}</p><p>${t('Leggenda viene aggiornata ogni 24 ore.')}</p></section>
    <section class="league-standings"><div class="ranked-controls">${data.seasons.map((season) => `<button class="btn small ${season === data.season ? 'primary' : ''}" data-act="leaders" data-season="${season}">${t('Stagione')} ${season + 1}</button>`).join('')}</div><div class="league-board-title"><h2>${t('Classifica stagionale')}</h2><button class="btn small" data-act="leaders" data-friends="${S.lbFriends ? '0' : '1'}">${t(S.lbFriends ? 'Tutti' : 'Solo amici')}</button></div>
    ${data.list.length ? `<ol class="league-board">${data.list.map((e) => `<li class="league-player ${e.me ? 'is-me' : ''}"><span class="league-position">${e.position}</span><div class="league-player-name"><b>${esc(e.name)}</b><span>${t('Vittorie')}: ${e.wins} · ${t('Partite')}: ${e.games}</span></div>${leagueEmblem(playerRank(e), 'league-row-emblem')}<span>${e.provisional ? `${t('Non classificato')}<br>${t('Piazzamenti')}: ${e.placements}/${e.placementTotal || 10}` : `${t(e.league)} ${e.division || ''}<br>${e.lp} LP`}</span></li>`).join('')}</ol>` : `<p class="league-empty">${t('Il tavolo dei campioni ti aspetta')}</p>`}</section>`}
    <aside class="league-note"><p>${t('Solo e Duo hanno progressi separati. Le partite contro il computer non contano.')}</p><p>${t('Turni di 60 secondi. Hai 120 secondi per riconnetterti; abbandoni e inattività comportano sconfitta e pausa Ranked.')}</p></aside></main>`;
};
function searchModal() {
  openModal('rankedSearch', `<div class="result"><h2>${t('Ricerca Ranked')}</h2><p role="status">${t('Ricerca di avversari in corso…')}</p><p>${t('La ricerca amplia gradualmente il rating senza mescolare Solo e Duo.')}</p><button class="btn" data-act="rankedCancel">${t('Annulla ricerca')}</button></div>`);
}
Object.assign(handlers, {
  async rankedAgain() {
    const [game, n, queue] = S.room.rankedFormat.key.split(':');
    const r = await emit('leaveRoom'); if (r.ok) { await openLeaguePage({ dataset: { game, n, queue } }); await handlers.rankedSearch(); }
  },
  async rankedSearch(el) {
    const game = el?.dataset.game || S.lbGame || 'burraco', n = Number(el?.dataset.n || S.rankedN || 2), queue = el?.dataset.queue || S.rankedQueue || 'solo';
    if (queue === 'duo' && !el?.dataset.friend) {
      if (S.rankedParty?.game === game) { S.screen='rankedLobby'; closeModal(); render(); return; }
      const r=await emit('rankedPartyCreate',{game}); if(r.ok) rankedPartyState(r.party); return;
    }
    const r = await emit('rankedJoin', { game, n, queue, friend: el?.dataset.friend });
    if (r.ok && r.invited) openModal('rankedWaiting', `<div class="result"><p>${t('In attesa del tuo amico…')}</p><button class="btn" data-act="rankedCancel">${t('Annulla ricerca')}</button></div>`);
  },
  rankedPartyInvite(el) { return emit('rankedPartyInvite',{nick:el.dataset.nick}); },
  async rankedPartyAccept(el) { const r=await emit('rankedPartyAccept',{id:el.dataset.id}); if(r.ok) rankedPartyState(r.party); },
  rankedPartyReady() { return emit('rankedPartyReady'); },
  async rankedPartyLeave() { const r=await emit('rankedPartyLeave'); if(r.ok) {S.screen='home';render();} },
  rankedPartyOpen() { if(S.rankedParty) {S.screen='rankedLobby';render();} },
  async rankedAccept(el) { await emit('rankedAccept', { id: el.dataset.id }); },
  async rankedCancel() { const r = await emit('rankedCancel'); if (r.ok) closeModal(); },
  async rankedProfile() {
    const r = await emit('rankedProfile'); if (!r.ok) return;
    const label = (value) => `${t(PLAYER_RANKS[value >= 3300 ? 8 : Math.min(7, Math.floor(value / 400))].name)} ${value >= 3300 ? '' : ['IV', 'III', 'II', 'I'][Math.min(31, Math.floor(value / 100)) % 4]}`;
    openModal('rankedProfile', `<div class="result"><h2>${t('Profilo competitivo')}</h2>${Object.entries(r.ranks).filter(([key]) => AvailableGames.enabled(key.split(':')[0]) || ['reale','aberto','fechado'].includes(key.split(':')[0])).map(([key, p]) => `<section class="ranked-profile"><h3>${esc(key.split(':').join(' · '))}</h3>${leagueEmblem(playerRank(p), 'league-row-emblem')}${rankedCard(p)}<p>${t('Miglior grado stagionale')}: ${p.provisional ? t('Non classificato') : label(p.best)}<br>${t('Miglior grado storico')}: ${p.provisional && !p.seasons.some(s => s.games >= (p.placementTotal || 10)) ? t('Non classificato') : label(p.allTimeBest)}</p>
      <details><summary>${t('Storico competitivo')}</summary>${p.history.map((h) => `<p>${new Date(h.at).toLocaleDateString()} · ${t(h.score === 1 ? 'Vittoria' : h.score === 0 ? 'Sconfitta' : 'Pareggio')} · ${h.placementMatch ? t('Piazzamenti') : `${h.delta > 0 ? '+' : ''}${h.delta} LP`}</p>`).join('')}</details>
      <details><summary>${t('Stagioni e ricompense')}</summary>${p.seasons.map((s) => `<p>${t('Stagione')} ${s.season + 1} · ${label(s.best)} · ${s.wins}/${s.games} <span class="ranked-reward">${t('Insegna stagionale')} ${s.season + 1}${leagueEmblem(PLAYER_RANKS[s.best >= 3300 ? 8 : Math.min(7, Math.floor(s.best / 400))], 'league-row-emblem')}</span></p>`).join('')}</details></section>`).join('') || `<p>${t('Completa i piazzamenti per ottenere un grado.')}</p>`}</div>`);
  },
  leaguePlay() { return handlers.rankedSearch(); },
});
const originalQuickMenu = handlers.quickMenu;
handlers.quickMenu = function(el) { if (el?.dataset.mode === 'ranked') return openLeaguePage({dataset:{...el.dataset,game:el.dataset.game || homeGame()}}); return originalQuickMenu(el); };
function rankedQueueState(r) {
  S.rankedSearching = r.searching;
  document.getElementById('rankedQueueStatus')?.remove();
  if (r.searching) {
    const indicator = document.createElement('button'); indicator.id = 'rankedQueueStatus'; indicator.className = 'btn small'; indicator.dataset.act = 'rankedCancel';
    indicator.textContent = `${t('Ricerca Ranked')} · ${t('Annulla ricerca')}`; document.body.appendChild(indicator); searchModal();
  } else if (['rankedSearch', 'rankedWaiting', 'rankedInvite'].includes(S.modalKind)) closeModal();
}
socket.on('rankedQueue', rankedQueueState);
socket.on('disconnect', () => { S.rankedSearching = false; document.getElementById('rankedQueueStatus')?.remove(); });
socket.on('welcome', async () => { if (OFFLINE) return; const r = await emit('rankedProfile'); if (r.party) rankedPartyState(r.party); if (r.queue) rankedQueueState(r.queue); });
for (const name of ['playBots', 'playFriends', 'goSetup']) {
  const previous = handlers[name];
  handlers[name] = async function(...args) {
    if (S.rankedParty) { const r=await emit('rankedPartyLeave'); if(!r.ok) return; }
    else if (S.rankedSearching) { const r=await emit('rankedCancel'); if(!r.ok) return; }
    return previous(...args);
  };
}
socket.on('rankedInvite', (r) => openModal('rankedInvite', `<div class="result"><h2>Ranked Duo</h2><p>${esc(r.from)} · ${esc(r.game)}</p><button class="btn primary" data-act="rankedAccept" data-id="${esc(r.id)}">${t('Accetta ricerca')}</button><button class="btn" data-act="rankedCancel">${t('Annulla ricerca')}</button></div>`));
socket.on('rankedResult', (r) => {
  S.rankedLast = r;
  setTimeout(() => { toast(r.after.provisional ? `${t('Piazzamenti')}: ${r.after.placements}/${r.after.placementTotal || 10}` : r.placementMatch ? `${t('Piazzamenti completati!')} · ${t(r.after.league)} ${r.after.division || ''}` : `${t(r.after.league)} ${r.after.division || ''} · ${r.delta > 0 ? '+' : ''}${r.delta} LP · ${r.after.lp}/100 LP`); showRankTransition(r.key.split(':')[0], r.before, r.after); }, 1800);
});
socket.on('rankedRankChange', (r) => showRankTransition(r.key.split(':')[0], r.before, r.after));
socket.on('state', async (st) => {
  const f = st.room?.rankedFormat;
  if (!f || !st.game?.over || S.rankedLast?.matchId === f.id) return;
  const response = await emit('rankedProfile');
  const p = response.ranks?.[f.key], h = p?.history.find((x) => x.id === f.id);
  if (h && S.room?.rankedFormat?.id === f.id) {
    S.rankedLast = { matchId: f.id, key: f.key, after: p, delta: h.delta, placementMatch: h.placementMatch };
    if (S.modalKind === 'result') showResult();
  }
});

function rankedLobbyHTML() {
  const p=S.rankedParty;
  if(!p) return '<main class="page"></main>';
  const me=p.members.find(m=>m.me), friends=(S.social?.friends||[]).filter(f=>f.online&&!p.members.some(m=>m.name===f.nick));
  const game=LEAGUE_GAMES.find(([id])=>id===p.game)?.[1] || p.game;
  return `<main class="page ranked-party"><header class="league-header"><button class="league-back" data-act="goHome" aria-label="${t('Torna alla home')}">←</button><div><small>RANKED DUO · ${esc(game)}</small><h1>${t('Il tuo tavolo')}</h1></div></header>
    <section class="panel"><h2>${t('La tua coppia')}</h2><div class="ranked-party-seats">${[0,1].map(i=>{const m=p.members[i];return `<div class="ranked-party-seat">${m?avatarHTML(m.name,0,false):'<span class="ranked-empty-seat">+</span>'}<b>${m?esc(m.name):t('Posto per un amico')}</b><small>${m?t(m.online?(m.ready?'Pronto':'Non pronto'):'offline'):t('Invita un amico dalla lista')}</small></div>`;}).join('')}</div><p class="ranked-format-note">${t('Gli avversari vengono scelti dal matchmaking.')}</p>
    ${p.searching?`<p role="status">${t('Ricerca di avversari in corso…')}</p><button class="btn" data-act="rankedCancel">${t('Annulla ricerca')}</button>`:`<button class="btn primary" data-act="rankedPartyReady" ${p.members.length<2?'disabled':''}>${t(me?.ready?'Non sono pronto':'Sono pronto')}</button><p>${t('La ricerca parte quando entrambi siete pronti.')}</p>`}</section>
    ${p.host&&p.members.length<2?`<section class="panel"><h2>${t('Invita un amico')}</h2>${p.invited?`<p role="status">${t('Invito in attesa')}: ${esc(p.invited)}</p>`:''}${friends.map(f=>`<div class="friend">${avatarHTML(f.nick,0,false,f.avatar)}<b class="grow">${esc(f.nick)}</b><button class="btn small" data-act="rankedPartyInvite" data-nick="${esc(f.nick)}">${t('Invita')}</button></div>`).join('')||`<p>${t('Nessun amico online. Aggiungi un amico o attendi che si colleghi.')}</p>`}<button class="btn small" data-act="friends">${t('Amici')}</button></section>`:''}
    <button class="btn" data-act="rankedPartyLeave">${t(p.host?'Chiudi il tavolo':'Esci dal tavolo')}</button></main>`;
}
function rankedPartyState(p) {
  S.rankedParty=p;
  if(p) { closeModal(); S.screen='rankedLobby'; render(); }
  else if(S.screen==='rankedLobby') {closeModal(); S.screen='home';render();}
  else if(S.screen==='home') render();
}
socket.on('rankedParty',rankedPartyState);
socket.on('rankedPartyInvite',r=>openModal('rankedPartyInvite',`<div class="result"><h2>${t('Invito al tavolo Duo')}</h2><p>${esc(r.from)} · ${esc(LEAGUE_GAMES.find(([id])=>id===r.game)?.[1]||r.game)}</p><p>${t('Entra nel tavolo e conferma quando sei pronto.')}</p><button class="btn primary" data-act="rankedPartyAccept" data-id="${esc(r.id)}">${t('Entra al tavolo')}</button><button class="btn" data-act="closeModal">${t('No grazie')}</button></div>`));
