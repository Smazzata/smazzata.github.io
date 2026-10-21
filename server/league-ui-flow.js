'use strict';
module.exports = async function leagueFlow({ cdp, shot, open, URL, step }) {
  await cdp.run(`
    store.set('bur_stats', { games: 90 });
    store.set('bur_auto_level', { burraco: { level: 'esperto' } });
    store.set('smazzata_campaign_world1_matches_v2', { burraco: { completed: [1,2,3] } });
    store.set('bur_progress_epoch', 0);
    store.set('bur_prefs', { ...S.prefs, felt: 'blu' });
    return true;
  `);
  await open(URL);
  await cdp.run(`
    await __W(800);
    if (!S.social?.nick || S.social.nick !== 'Robot_UI') throw new Error('il reset ha eliminato il profilo');
    if (store.get('bur_stats', null) || store.get('bur_auto_level', null) || store.get('smazzata_campaign_world1_matches_v2', null)) throw new Error('progressi locali non azzerati');
    if (S.prefs.felt !== 'blu' || store.get('bur_progress_epoch', 0) !== PROGRESS_EPOCH) throw new Error('preferenze o epoca reset errate');
    store.set('bur_stats', { games: 1 });
    if (resetDeviceProgress() || loadStats().games !== 1) throw new Error('il reset cancella i nuovi progressi');
    store.set('bur_stats', {});
    await openLeaguePage();
    if (!S.leagueData || !document.querySelector('.league-empty')) throw new Error('stato iniziale classifica mancante');
  `);
  await shot('leghe-01-bronzo');
  await cdp.run(`
    for (const rank of PLAYER_RANKS) {
      handlers.leaguePreview({ dataset: { rank: rank.id } });
      if (!document.querySelector('.league-hero h2').textContent.includes(rank.name)) throw new Error('anteprima lega errata');
      const image = document.querySelector('.league-hero-emblem');
      await image.decode();
      if (!image.naturalWidth) throw new Error('insegna non caricata');
    }
    handlers.leaguePreview({ dataset: {} });
    S.leagueData.list = Array.from({length: 5}, (_, i) => ({ name: i ? 'Giocatore dal nome molto lungo ' + i : 'Robot_UI', position: i + 1, elo: [2000,1800,1600,1250,1000][i], wins: 4-i, games: 6, me: !i }));
    S.leagueData.mine = { ...S.leagueData.mine, elo: 2000, position: 1, wins: 4, games: 6, rankedGames: 6 };
    render();
    await __W(500);
    if (document.documentElement.scrollWidth > innerWidth) throw new Error('classifica popolata fuori schermo');
    if (/Elo|2000|1800|1600|1250|1000/.test(document.querySelector('.league-page').innerText)) throw new Error('punteggio interno visibile');
  `);
  await shot('leghe-02-leggenda');
  await cdp.run(`showRankTransition('burraco', 1249, 1252); await __W(1500); return true;`);
  await shot('leghe-03-promozione');
  await cdp.run(`
    if (!document.querySelector('.rank-transition.promotion .rank-new[src*="gold"]')) throw new Error('promozione non visibile');
    __tap('[data-rank-continue]');
    S.prefs.anim = false;
    showRankTransition('ramino', 1401, 1390);
    if (!document.querySelector('.rank-transition.demotion.quiet')) throw new Error('retrocessione senza animazioni non rispettata');
    if (document.querySelector('.rank-particles i')) throw new Error('particelle con animazioni disattivate');
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    if (document.querySelector('.rank-transition') || document.querySelector('#app').inert) throw new Error('focus bloccato dopo la chiusura');
    S.prefs.anim = true;
    await openLeaguePage({dataset:{game:'scala40',friends:'1'}});
    if (S.leagueData.game !== 'scala40' || !S.lbFriends) throw new Error('gioco o filtro amici persi');
    __tap('[data-act="leaguePlay"]');
    if (!document.querySelector('#modal [data-act="quick"][data-mode="ranked"][data-game="scala40"]')) throw new Error('CTA non mantiene il gioco');
    __tap('#modal [data-act="quick"][data-mode="ranked"][data-game="scala40"][data-n="2"]');
    await __W(500);
    if (S.screen !== 'lobby' || S.room?.rules.game !== 'scala40') throw new Error('la classifica non lascia aprire il nuovo tavolo');
    await emit('leaveRoom'); closeModal(); S.screen = 'home'; render();
  `);
  step('leghe: reset locale una sola volta, pagina, sette insegne, filtri, promozione e retrocessione accessibili OK');
};
