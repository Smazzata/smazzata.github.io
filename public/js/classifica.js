'use strict';

const LEAGUE_GAMES = [['burraco', 'Burraco'], ['scala40', 'Scala 40'], ['ramino', 'Ramino'], ['canasta', 'Canasta'], ['scopa', 'Scopa'], ['briscola', 'Briscola'], ['briscola5', 'Briscola in 5'], ['tressette', 'Tressette'], ['rubamazzetto', 'Rubamazzetto']];
function leagueEmblem(rank, cls = '') {
  return `<img class="league-emblem ${cls}" src="${rank.id === 'unranked' ? 'art/leagues/unranked.webp' : `art/ranked/${rank.id}${rank.id === 'legend' ? '' : '-' + (rank.division || 'IV')}.svg`}" alt="${esc(t(rank.name))}" width="256" height="256" draggable="false">`;
}

// Le viste Ranked sono definite nel modulo successivo, prima del primo render.
let openLeaguePage, leadersHTML;

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
  if (after?.provisional) return;
  if (playerRank(before).id === playerRank(after).id && before?.division === after?.division) return;
  rankTransitions.push({ game, before, after });
  playRankTransition();
}
function playRankTransition() {
  if (rankTransitionActive || !rankTransitions.length) return;
  rankTransitionActive = true;
  const { game, before, after } = rankTransitions.shift();
  const previous = playerRank(before), next = playerRank(after), promotion = next.min > previous.min || (next.min === previous.min && ['IV', 'III', 'II', 'I'].indexOf(next.division) > ['IV', 'III', 'II', 'I'].indexOf(previous.division));
  const placement = !!before?.provisional && !after?.provisional;
  const quiet = S.prefs.anim === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const focus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = `rank-transition theme-${next.id} ${promotion ? 'promotion' : 'demotion'} ${quiet ? 'quiet' : ''}`;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'rank-transition-title');
  const particles = promotion && !quiet ? Array.from({ length: 24 }, (_, i) => `<i aria-hidden="true" style="--x:${Math.round(Math.cos(i * Math.PI / 12) * (105 + i % 4 * 16))}px;--y:${Math.round(Math.sin(i * Math.PI / 12) * (130 + i % 3 * 20))}px;--delay:${i % 6 * 60}ms">${'♠♥♦♣'[i % 4]}</i>`).join('') : '';
  overlay.innerHTML = `<div class="rank-transition-card"><small>${esc(RX.gameName({ game }))}</small><h2 id="rank-transition-title">${promotion ? 'Nuova lega!' : 'Cambio di lega'}</h2><div class="rank-transition-stage"><div class="rank-transition-glow"></div>${leagueEmblem(previous, 'rank-old')}${leagueEmblem(next, 'rank-new')}<div class="rank-particles">${particles}</div></div><p class="rank-transition-route">${t(previous.name)} ${previous.division || ''} <span aria-hidden="true">→</span> <b>${t(next.name)} ${next.division || ''}</b></p><h3>${t(next.name)}</h3><p>${promotion ? 'Le tue scelte al tavolo ti hanno portato più in alto.' : 'Ogni partita è una nuova occasione per risalire.'}</p><button class="btn primary" data-rank-continue>Continua</button></div>`;
  document.body.appendChild(overlay);
  if (placement) {
    overlay.querySelector('#rank-transition-title').textContent = t('Piazzamenti completati!');
    overlay.querySelector('.rank-transition-card > p:last-of-type').textContent = t('Il tuo grado iniziale è stato assegnato.');
  }
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
