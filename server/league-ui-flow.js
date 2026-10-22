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
    if (!document.querySelector('.league-hero h2').textContent.includes('Non classificato')) throw new Error('lega assegnata prima dei piazzamenti');
    if (document.querySelector('.ranked-placement progress').max !== 10) throw new Error('contatore piazzamenti errato');
    S.leagueData.mine = {...S.leagueData.mine, games:9, placements:9, provisional:true, tier:2, league:'Oro', division:'I'};
    render();
    if (document.querySelector('.league-hero').innerText.includes('Oro') || document.querySelector('.league-hero').innerText.includes(' LP')) throw new Error('grado o LP interni esposti');
    if (document.querySelector('.ranked-placement progress').value !== 9) throw new Error('progresso piazzamenti assente');
    showRankTransition('burraco', {tier:0,provisional:true}, S.leagueData.mine);
    if (document.querySelector('.rank-transition')) throw new Error('promozione durante i piazzamenti');
    S.prefs.anim = false;
    showRankTransition('burraco', {tier:0,league:'Bronzo',division:'IV',provisional:true}, {tier:0,league:'Bronzo',division:'IV',provisional:false});
    if (!document.querySelector('#rank-transition-title').textContent.includes('Piazzamenti completati')) throw new Error('rivelazione Bronzo IV mancante');
    if (!document.querySelector('.rank-old[src*="unranked"]')) throw new Error('insegna neutra mancante');
  `);
  await shot('ranked-placement-reveal');
  await cdp.run(`__tap('[data-rank-continue]'); S.prefs.anim = true; await openLeaguePage();`);
  await cdp.run(`
    for (const rank of PLAYER_RANKS) {
      handlers.leaguePreview({ dataset: { rank: rank.id } });
      if (!document.querySelector('.league-hero h2').textContent.includes(rank.name)) throw new Error('anteprima lega errata');
      const image = document.querySelector('.league-hero-emblem');
      await image.decode();
      if (!image.naturalWidth) throw new Error('insegna non caricata');
    }
    handlers.leaguePreview({ dataset: {} });
    // Fixture esclusivamente visuale: il backend resta verificato separatamente via socket.
    S.leagueData.list = Array.from({length: 5}, (_, i) => ({ name: i ? 'Giocatore lungo ' + i : 'Robot_UI', position: i + 1, tier: 8-i, league: PLAYER_RANKS[8-i].name, id: PLAYER_RANKS[8-i].id, division: i ? 'I' : null, lp: 40, wins: 4-i, games: 30, me: !i }));
    S.leagueData.mine = { ...S.leagueData.mine, tier:8, league:'Leggenda', id:'legend', division:null, position:1, wins:20, games:30, provisional:false, rating:2700 };
    render();
    await __W(500);
    if (document.documentElement.scrollWidth > innerWidth) throw new Error('classifica popolata fuori schermo');
    if (/RD|volatility/.test(document.querySelector('.league-page').innerText)) throw new Error('incertezza interna visibile');
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
    __tap('[data-act="rankedSearch"]');
    await __W(500);
    if (!S.rankedSearching || S.modalKind !== 'rankedSearch') throw new Error('ricerca Ranked non avviata');
    await emit('rankedCancel');
    await openLeaguePage({dataset:{game:'burraco',n:'3',queue:'solo'}});
    if ([...document.querySelectorAll('.ranked-formats [data-n]')].map(e=>e.dataset.n).join(',') !== '2,3,4') throw new Error('formati Solo non ordinati');
    __tap('.ranked-queues [data-queue="duo"]'); await __W(600);
    if (S.leagueData.queue !== 'duo' || S.leagueData.n !== 4 || document.querySelector('.ranked-solo-formats')) throw new Error('Duo non forza quattro giocatori');
    __tap('.ranked-queues [data-queue="solo"]'); await __W(600);
    if (S.leagueData.n !== 3 || S.leagueData.queue !== 'solo') throw new Error('formato Solo perso tornando dalla Duo');
    await openLeaguePage({dataset:{game:'scala40'}});
    if (document.querySelector('.ranked-queues [data-queue="duo"]')) throw new Error('Duo mostrata per un gioco non supportato');
    await openLeaguePage({dataset:{game:'burraco',n:'4',queue:'duo'}});
    if (S.leagueData.queue !== 'duo') throw new Error('coda Duo persa');
    __tap('[data-act="rankedSearch"]'); await __W(100);
    if (!document.querySelector('#rankedFriend')) throw new Error('invito Duo mancante');
    closeModal();
    await openLeaguePage({dataset:{game:'burraco',n:'2',queue:'solo'}});
    S.leagueData.mine={...S.leagueData.mine,tier:2,league:'Oro',id:'gold',division:'I',lp:100,provisional:false,promo:{results:[1,0],target:3}};
    render();
    if (document.querySelectorAll('.ranked-promo span').length!==3) throw new Error('BO3 mancante');
    await __W(600);
  `);
  await shot('ranked-04-bo3');
  for (const lang of ['en', 'es', 'pt']) {
    await cdp.run(`store.set('bur_prefs', {...S.prefs,lang:'${lang}'}); return true;`);
    await open(URL);
    await cdp.run(`await openLeaguePage({dataset:{game:'burraco',n:'4',queue:'duo'}}); await __W(300); if(document.documentElement.scrollWidth>innerWidth)throw Error('overflow ${lang}'); if(LANG!=='${lang}')throw Error('lingua non caricata');`);
    await shot('ranked-' + lang);
  }
  await cdp.run(`store.set('bur_prefs', {...S.prefs,lang:'it'}); return true;`);
  await open(URL);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1050, deviceScaleFactor: 1, mobile: false });
  await cdp.run(`document.body.innerHTML='<main style="padding:28px;background:#101c2d;color:#f8f2e6;min-height:100vh;font-family:Nunito,sans-serif"><h1>SMAZZATA · Ranked</h1><p>33 insegne originali · IV → III → II → I</p><div style="display:grid;grid-template-columns:repeat(9,1fr);gap:8px">'+PLAYER_RANKS.map(r=>'<div style="text-align:center"><h3 style="font-size:12px">'+r.name+'</h3>'+ (r.id==='legend'?['']:['IV','III','II','I']).map(d=>'<img style="display:block;width:100%;margin-top:18px" src="art/ranked/'+r.id+(d?'-'+d:'')+'.svg"><small>'+d+'</small>').join('')+'</div>').join('')+'</div></main>'; await Promise.all([...document.images].map(i=>i.decode()));`);
  await shot('ranked-emblems');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await open(URL);
  step('Ranked: nove insegne, formati, Solo/Duo, ricerca reale, BO3 e transizioni accessibili OK');
};
