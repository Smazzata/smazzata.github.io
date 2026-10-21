'use strict';

const LEAGUE_GAMES = [['burraco', 'Burraco'], ['scala40', 'Scala 40'], ['ramino', 'Ramino'], ['canasta', 'Canasta'], ['scopa', 'Scopa'], ['briscola', 'Briscola'], ['briscola5', 'Briscola in 5'], ['tressette', 'Tressette'], ['rubamazzetto', 'Rubamazzetto']];
const LEAGUE_COPY = {
  bronze: ['Il primo seme', 'Ogni campione comincia da una prima mano.'],
  silver: ['Il gioco prende forma', 'Costanza, lettura del tavolo e scelte sempre più sicure.'],
  gold: ['Il valore delle tue scelte', 'La strategia brilla quando ogni carta ha uno scopo.'],
  platinum: ['Oltre le abitudini', 'Anticipa gli avversari e cambia il ritmo della partita.'],
  diamond: ['Precisione cristallina', 'Sangue freddo e visione del gioco fanno la differenza.'],
  master: ['Il tavolo ti riconosce', 'Esperienza e intuizione, una mano dopo l’altra.'],
  legend: ['Lascia il tuo segno', 'Il traguardo più prestigioso delle leghe di Smazzata.'],
};

function leagueEmblem(rank, cls = '') {
  return `<img class="league-emblem ${cls}" src="art/leagues/${rank.id}.webp" alt="${esc(t(rank.name))}" width="256" height="256" draggable="false">`;
}

async function openLeaguePage(el) {
  const d = el?.dataset || {};
  if (d.game && LEAGUE_GAMES.some(([id]) => id === d.game)) S.lbGame = d.game;
  if (d.friends !== undefined) S.lbFriends = d.friends === '1';
  const game = S.lbGame || 'burraco', friends = !!S.lbFriends;
  const request = S.leagueRequest = (S.leagueRequest || 0) + 1;
  closeModal();
  S.screen = 'leaders';
  S.leagueData = null;
  S.leagueError = false;
  S.rankPreview = null;
  render();
  window.scrollTo(0, 0);
  const r = await emit('leaderboard', { game, friends });
  if (S.leagueRequest !== request || S.screen !== 'leaders') return;
  if (r?.ok) S.leagueData = r;
  else S.leagueError = true;
  render();
}

function leadersHTML() {
  const data = S.leagueData, game = S.lbGame || 'burraco';
  const current = playerRank(data?.mine?.elo ?? 1000);
  const preview = PLAYER_RANKS.find((rank) => rank.id === S.rankPreview) || current;
  const mine = !!data && preview.id === current.id;
  const copy = LEAGUE_COPY[preview.id];
  const next = PLAYER_RANKS[PLAYER_RANKS.findIndex((rank) => rank.id === current.id) + 1];
  const tabs = LEAGUE_GAMES.map(([id, name]) => `<button class="league-game ${id === game ? 'on' : ''}" data-act="leaders" data-game="${id}" aria-pressed="${id === game}">${esc(name)}</button>`).join('');
  const row = (entry, podium = false) => `<li class="league-player ${entry.me ? 'is-me' : ''} ${podium ? 'is-podium' : ''}">
    <span class="league-position">${entry.position <= 3 ? ['🥇', '🥈', '🥉'][entry.position - 1] : entry.position}</span>
    ${avatarHTML(entry.name, 0, false, entry.avatar || { e: entry.name.charAt(0).toUpperCase(), c: '#f2c14e' })}
    <div class="league-player-name"><b>${esc(entry.name)}${entry.me ? ` <small>(${t('Tu')})</small>` : ''}</b><span>${t('Vittorie')}: ${entry.wins} · ${t('Partite')}: ${entry.games}</span></div>
    ${leagueEmblem(playerRank(entry.elo), 'league-row-emblem')}
    <span class="league-row-name">${t(playerRank(entry.elo).name)}</span></li>`;
  const board = !data ? (S.leagueError ? `<div class="league-empty"><h3>Classifica non disponibile</h3><p>Controlla la connessione e riprova.</p><button class="btn" data-act="leaders">Riprova</button></div>` : '<div class="league-loading" role="status"><span class="spin"></span> Caricamento classifica…</div>')
    : data.list.length ? `<ol class="league-board">${data.list.map((entry) => row(entry, entry.position <= 3)).join('')}</ol>`
      : `<div class="league-empty"><span aria-hidden="true">♠ ♥ ♦ ♣</span><h3>Il tavolo dei campioni ti aspetta</h3><p>${S.lbFriends ? 'Le partite completate dai tuoi amici appariranno qui.' : 'Completa una partita tra persone per entrare in classifica.'}</p><button class="btn primary" data-act="leaguePlay">Gioca una classificata</button></div>`;
  return `<main class="page league-page theme-${preview.id}">
    <header class="league-header"><button class="league-back" data-act="leagueBack" aria-label="Torna alla home">←</button><div><small>SMAZZATA</small><h1>Classifica</h1></div><span aria-hidden="true">♠</span></header>
    <nav class="league-games" aria-label="Scegli il gioco">${tabs}</nav>
    <section class="league-hero" aria-label="${esc(t('La tua lega'))}">
      <div class="league-halo" aria-hidden="true"></div><span class="league-kicker">${mine ? 'La tua lega' : 'Esplora le leghe'}</span>
      ${leagueEmblem(preview, 'league-hero-emblem')}<h2>${t(preview.name)}</h2><h3>${t(copy[0])}</h3><p>${t(copy[1])}</p>
      ${mine && data ? `<div class="league-personal"><span><b>${data.mine.position ? '#' + data.mine.position : '—'}</b>Posizione</span><span><b>${data.mine.wins}</b>Vittorie</span><span><b>${data.mine.games}</b>Partite</span></div>
        <p class="league-next">${!data.mine.rankedGames ? t('La tua prima classificata è l’inizio del percorso.') : next ? `${t('Prossima lega')}: <b>${t(next.name)}</b>` : t('Hai raggiunto la lega più prestigiosa.')}</p>` : ''}
      ${!mine ? '<button class="league-return" data-act="leaguePreview">Torna alla tua lega</button>' : ''}
    </section>
    <section class="league-journey"><h2>Il percorso delle leghe</h2><p>Tocca un’insegna per scoprirla.</p><div class="league-path">${PLAYER_RANKS.map((rank) => `<button class="league-step ${data && rank.id === current.id ? 'current' : ''} ${rank.id === preview.id ? 'selected' : ''}" data-act="leaguePreview" data-rank="${rank.id}" aria-pressed="${rank.id === preview.id}">${leagueEmblem(rank)}<b>${t(rank.name)}</b>${data && rank.id === current.id ? '<small>La tua lega</small>' : ''}</button>`).join('')}</div></section>
    <section class="league-standings"><div class="league-board-title"><h2>${S.lbFriends ? 'Tra amici' : 'La classifica'}</h2><div class="league-filters" aria-label="Filtra classifica"><button class="${S.lbFriends ? '' : 'on'}" data-act="leaders" data-friends="0" aria-pressed="${!S.lbFriends}">Tutti</button><button class="${S.lbFriends ? 'on' : ''}" data-act="leaders" data-friends="1" aria-pressed="${!!S.lbFriends}">Solo amici</button></div></div>${board}</section>
    <aside class="league-note"><b>Una lega per ogni gioco</b><p>Le classificate fanno evolvere la tua lega. Le amichevoli tra persone contano per statistiche e livello. Contro il computer è solo allenamento.</p></aside>
  </main>`;
}

function afterLeaguesRender() {
  for (const [container, selected] of [['.league-games', '.on'], ['.league-path', '.selected']]) {
    const nav = $(container), item = nav?.querySelector(selected);
    if (nav && item) {
      const a = nav.getBoundingClientRect(), b = item.getBoundingClientRect();
      nav.scrollLeft += b.left - a.left - (a.width - b.width) / 2;
    }
  }
}

Object.assign(handlers, {
  leaguePreview(el) { S.rankPreview = el?.dataset.rank || null; render(); },
  leagueBack() { S.leagueRequest = (S.leagueRequest || 0) + 1; S.screen = S.room ? (S.game ? 'game' : 'lobby') : 'home'; render(); window.scrollTo(0, 0); },
  leaguePlay() { handlers.quickMenu({ dataset: { game: S.lbGame || 'burraco', mode: 'ranked' } }); },
});

const rankTransitions = [];
let rankTransitionActive = false;
function showRankTransition(game, before, after) {
  if (playerRank(before).id === playerRank(after).id) return;
  rankTransitions.push({ game, before, after });
  playRankTransition();
}
function playRankTransition() {
  if (rankTransitionActive || !rankTransitions.length) return;
  rankTransitionActive = true;
  const { game, before, after } = rankTransitions.shift();
  const previous = playerRank(before), next = playerRank(after), promotion = next.min > previous.min;
  const quiet = S.prefs.anim === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const focus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = `rank-transition theme-${next.id} ${promotion ? 'promotion' : 'demotion'} ${quiet ? 'quiet' : ''}`;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'rank-transition-title');
  const particles = promotion && !quiet ? Array.from({ length: 24 }, (_, i) => `<i aria-hidden="true" style="--x:${Math.round(Math.cos(i * Math.PI / 12) * (105 + i % 4 * 16))}px;--y:${Math.round(Math.sin(i * Math.PI / 12) * (130 + i % 3 * 20))}px;--delay:${i % 6 * 60}ms">${'♠♥♦♣'[i % 4]}</i>`).join('') : '';
  overlay.innerHTML = `<div class="rank-transition-card"><small>${esc(RX.gameName({ game }))}</small><h2 id="rank-transition-title">${promotion ? 'Nuova lega!' : 'Cambio di lega'}</h2><div class="rank-transition-stage"><div class="rank-transition-glow"></div>${leagueEmblem(previous, 'rank-old')}${leagueEmblem(next, 'rank-new')}<div class="rank-particles">${particles}</div></div><p class="rank-transition-route">${t(previous.name)} <span aria-hidden="true">→</span> <b>${t(next.name)}</b></p><h3>${t(next.name)}</h3><p>${promotion ? 'Le tue scelte al tavolo ti hanno portato più in alto.' : 'Ogni partita è una nuova occasione per risalire.'}</p><button class="btn primary" data-rank-continue>Continua</button></div>`;
  document.body.appendChild(overlay);
  const content = $('#app'), modal = $('#modal');
  const wasInert = content.inert, modalWasInert = modal.inert;
  content.inert = true; modal.inert = true;
  const button = overlay.querySelector('button');
  const close = () => {
    overlay.remove(); content.inert = wasInert; modal.inert = modalWasInert;
    document.removeEventListener('keydown', key, true);
    rankTransitionActive = false;
    if (focus?.isConnected) focus.focus();
    if (S.screen === 'leaders') openLeaguePage();
    playRankTransition();
  };
  const key = (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); } else if (event.key === 'Tab') { event.preventDefault(); button.focus(); } };
  document.addEventListener('keydown', key, true);
  button.addEventListener('click', close, { once: true });
  button.focus();
}
