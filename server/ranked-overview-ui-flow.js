'use strict';
module.exports = async function overviewFlow({ cdp, shot, step }) {
  await cdp.run(`
    await handlers.goHome();
    store.set('smazzata_home_game','burraco');
    await handlers.leaders();
    if (S.screen !== 'rankedOverview' || !S.overviewData) throw Error('resoconto reale assente');
    if (document.querySelector('.ranked-season-report')) throw Error('storico mostrato nella prima stagione');
    if (document.querySelector('[data-act="rankedSearch"]')) throw Error('ricerca nel resoconto');
    if (!document.querySelector('.empty-state [data-act="leaguePlay"]')) throw Error('primo accesso senza invito a giocare');
    if (document.querySelector('.ranked-queue-report') || document.querySelector('.ranked-report-total')) throw Error('risultati assegnati prima di giocare');
  `);
  await shot('ranked-resoconto-iniziale');
  await cdp.run(`
    // Dati visuali: risultati e persistenza reali sono coperti dai test socket.
    const profile = {tier:2,division:'II',league:'Oro',lp:45,provisional:false,placements:10,placementTotal:10,games:20,wins:12,losses:7,draws:1,seasons:[],history:[]};
    const now=Date.now();
    S.overviewData={currentSeason:1,ends:now+86400000,ranks:{
      'burraco:solo':{...profile,games:30,wins:18,losses:11,seasons:[{season:0,games:20,wins:14,losses:6,draws:0,best:900}],history:[{at:now,score:1,delta:24}]},
      'burraco:4:duo':{...profile,tier:0,league:'Bronzo',games:12,wins:5,losses:7,draws:0,seasons:[{season:0,games:3,wins:1,losses:2,best:1100}]},
      'ramino:solo':{...profile,games:10,wins:8,losses:2,draws:0}
    }};
    render();
    const values=selector=>[...document.querySelectorAll(selector+' .ranked-record dd')].map(e=>e.textContent).join(',');
    if(values('.ranked-report-total')!=='31,20,60%') throw Error('totali globali errati');
    const game=document.querySelector('.ranked-game-report');
    if(game.querySelector('h2').textContent!=='Burraco') throw Error('gioco Home non prioritario');
    if(values('section.ranked-game-report [data-report-queue="solo"]')!=='18,11,60%') throw Error('totali Solo errati');
    if(values('section.ranked-game-report [data-report-queue="duo"]')!=='5,7,42%') throw Error('totali Duo errati');
    if(game.querySelector('[data-report-queue="solo"] strong').textContent!=='Oro II') throw Error('miglior lega attuale errata');
    if(game.querySelector('.ranked-format-report')) throw Error('tre ranking ancora presenti');
    document.querySelector('.ranked-season-report details').open=true;
    const history=document.querySelector('.ranked-season-report').innerText;
    if(!history.includes('Oro III') || !history.includes('Non classificato')) throw Error('leghe storiche o piazzamenti errati');
    if(document.documentElement.scrollWidth>innerWidth) throw Error('resoconto fuori schermo');
  `);
  await shot('ranked-resoconto-stagioni');
  await cdp.run(`document.querySelector('.ranked-season-report').scrollIntoView(); await __W(200);`);
  await shot('ranked-resoconto-storico');
  await cdp.run(`
    S.overviewData.ranks['burraco:solo']={...S.overviewData.ranks['burraco:solo'],tier:8,league:'Leggenda',division:null};
    render();
    if(document.querySelector('section.ranked-game-report [data-report-queue="solo"] strong').textContent!=='Leggenda') throw Error('Leggenda non riconosciuta come lega più alta');
    // Il grado interno non deve comparire prima dei dieci piazzamenti.
    S.overviewData.ranks={'burraco:solo':{tier:2,league:'Oro',division:'I',lp:0,provisional:true,placements:4,placementTotal:10,games:4,wins:3,losses:1,seasons:[],history:[]}};
    render();
    if(document.querySelector('.ranked-game-report').textContent.includes('Oro')) throw Error('lega provvisoria esposta');
    if(!document.querySelector('.ranked-placement').textContent.includes('4/10')) throw Error('progresso piazzamenti assente');
    await handlers.goHome();
    store.set('smazzata_home_game','ramino');
    await handlers.leaders();
    if(homeGame()!=='ramino' || !document.querySelector('.empty-state [data-act="leaguePlay"]')) throw Error('primo accesso Ramino errato');
    if(document.querySelector('section.ranked-game-report [data-report-queue="duo"]')) throw Error('Duo per Ramino');
    await handlers.goHome();
    store.set('smazzata_home_game','burraco'); applyHomeGame(); render();
    await handlers.quickMenu({dataset:{mode:'ranked'}});
    if(S.screen!=='leaders' || !document.querySelector('.ranked-selection') || !document.querySelector('[data-act="rankedSearch"]')) throw Error('avvio Ranked non separato');
    await handlers.goHome();
  `);
  step('Classifica personale: code, formati, piazzamenti, stagioni e avvio Ranked separati OK');
};
