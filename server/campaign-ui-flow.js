'use strict';
module.exports = async function campaignUI({ cdp, shot, open, URL, step, errors, DPR }) {
  const helpers = `
    window.__campaignStart = async (i) => {
      if (S.campaignActive) handlers.campaignMap();
      const p=campaignPath(); const progress=campaignCurrentProgress();
      for(const l of p.levels.slice(0,i)) progress[p.id][l.id]=l.steps.length;
      S.campaignSession=progress; campaignPersist(CAMPAIGN_KEY,progress);
      handlers.campaignChapter({dataset:{i:Math.floor(i/10)}});
      __tap('[data-act="campaignPreview"][data-i="'+i+'"]');
      if(!document.querySelector('.cad-dialogue')) throw Error('personaggio introduttivo assente');
      __tap('#modal [data-act="campaignLevel"]');
      for(let n=0;n<100&&!S.campaignActive;n++) await __W(30);
      if(!S.campaignActive) throw Error('tavolo non caricato: '+S.campaignLoadError);
      await __W(1700);
      if(S.screen!=='game'||!document.querySelector('#felt')||!document.querySelector('#hand .card'))throw Error('tavolo normale mancante');
      if(!document.querySelector('.cad-portrait')||!document.querySelector('[data-cad-clock]'))throw Error('guida o timer mancanti');
      onState(null,null);if(S.screen!=='game')throw Error('stato remoto interrompe il livello');
    };
    window.__campaignPlay = async () => {
      const p=campaignPath(),l=p.levels[S.campaignLevel],engine=campaignEngine();
      const deadline=Date.now()+25000;
      while(S.campaignActive&&S.campaignMatch.status==='playing') {
        if(Date.now()>deadline)throw Error('livello bloccato '+p.id+'/'+l.number);
        if(S.campaignMatch.g.turn===1){await __W(30);continue;}
        const action=Campaign.expected(S.campaignMatch,l,engine.E);
        if(!action)throw Error('suggerimento assente');
        if(S.selected.size)handlers.clearSel();
        for(const id of action.cardIds||(action.cardId!==undefined?[action.cardId]:[]))
          if(!__tap('#hand [data-card="'+id+'"]'))throw Error('carta assente '+id);
        const target=action.type==='draw'?'.stock':action.type==='discard'||action.type==='takePile'?'.pile':action.type==='meld'?'.newmeld':'#felt [data-meld="'+action.meldId+'"]';
        if(!__tap(target))throw Error('controllo assente '+target);
        await __W(150);
        if(S.campaignFeedback)throw Error(p.id+'/'+l.number+': '+S.campaignFeedback);
        if(document.documentElement.scrollWidth>innerWidth+1)throw Error('overflow orizzontale');
        if(S.campaignActive){const felt=document.querySelector('#felt');if(felt.scrollHeight>felt.clientHeight+3)throw Error('tavolo non adattato');}
      }
      if(S.campaignOutcome!=='won'||!document.querySelector('.campaign-celebrate')||S.room||S.game)throw Error('obiettivo o uscita falliti '+p.id+'/'+l.number);
      if(!Campaign.goalState(S.campaignMatch,l).every(x=>x.done))throw Error('vittoria senza obiettivo');
      if(campaignProgress()[p.id][l.id]!==l.steps.length)throw Error('progresso non salvato');
    };
    // Accelera soltanto l'attesa dei bot nel browser di prova; le animazioni restano reali.
    if(!window.__cadTimeout){window.__cadTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>__cadTimeout(fn,ms===900?30:ms,...args);}
  `;
  await cdp.run(`for(const key of [CAMPAIGN_KEY,CAMPAIGN_STARS_KEY,CAMPAIGN_WALLET_KEY,CAMPAIGN_ATTEMPTS_KEY])localStorage.removeItem(key);S.campaignSession=null;S.campaignStarsSession=null;S.campaignWalletSession=null;S.campaignAttemptsSession=null;handlers.campaign();`);
  await cdp.run(helpers);
  await shot('campagna-01-percorsi');
  await cdp.run(`handlers.campaignPath({dataset:{id:'burraco'}});if(document.querySelectorAll('[data-act="campaignPreview"]:disabled').length!==9)throw Error('sblocco iniziale errato');if(Campaign.paths.some(p=>p.levels.length!==50))throw Error('50 livelli mancanti');await __campaignStart(0);await act('meld',{cardIds:[]});if(!S.campaignFeedback)throw Error('mossa illegale accettata');S.campaignFeedback=null;`);
  await cdp.run(`
    const ms=S.campaignMatch.remainingMs;handlers.campaignPause();await __W(700);
    if(Math.abs(S.campaignMatch.remainingMs-ms)>300)throw Error('timer prosegue in pausa');
    handlers.campaignContinue();S.campaignMatch.remainingMs=20;S.campaignClockRunning=true;S.campaignClockAt=Date.now()-100;campaignChargeClock();
    if(S.campaignOutcome!=='lost'||campaignWallet().lives!==4||campaignProgress().burraco.turno!==0)throw Error('sconfitta o vita errate');
    campaignFinish();if(campaignWallet().lives!==4)throw Error('doppio addebito vita');
    handlers.campaignMap();await __campaignStart(0);__tap('.stock');await __W(180);campaignWriteAttempt();
  `);
  await open(URL);
  await cdp.run(helpers);
  await cdp.run(`handlers.campaign();handlers.campaignPath({dataset:{id:'burraco'}});await __campaignStart(0);if(S.campaignMatch.g.phase!=='play')throw Error('tentativo non ripreso dopo reload');await __campaignPlay();`);
  await cdp.run(`
    const balance=campaignWallet().coins;handlers.campaignMap();await __campaignStart(0);await __campaignPlay();if(campaignWallet().coins!==balance)throw Error('ricompensa ripetuta');
    handlers.campaignMap();await __campaignStart(1);const s=S.campaignMatch,w=campaignWallet(),before=s.remainingMs;
    handlers.campaignPower({dataset:{power:'time'}});if(s.remainingMs<before+29500||campaignWallet().time!==w.time-1)throw Error('tempo extra non applicato');
    handlers.campaignPower({dataset:{power:'coach'}});if(s.coachTurn!==s.turns)throw Error('allenatore non applicato');
    const coins=campaignWallet().coins,hints=campaignWallet().hint;handlers.campaignShop();handlers.campaignBuy({dataset:{item:'hint'}});if(campaignWallet().coins!==coins-40||campaignWallet().hint!==hints+1)throw Error('bottega errata');
    handlers.campaignContinue();await __campaignPlay();handlers.campaignMap();
  `);
  step('campagna: timer, pausa, sconfitta, vite, ricarica, ripresa dopo reload, bottega e aiuti OK');
  const sample=[0,4,5,15,24,25,30,35,40,49];
  for(const game of ['burraco','scala40','ramino']) {
    await cdp.run(`handlers.campaignPaths();handlers.campaignPath({dataset:{id:'${game}'}});`);
    for(const i of sample) {
      await cdp.run(`await __campaignStart(${i});`);
      if(i===24||i===49)await shot('campagna-'+game+'-boss-'+(i+1));
      await cdp.run(`await __campaignPlay();handlers.campaignMap();`);
    }
    await shot('campagna-'+game+'-mondo-completato');
    step('campagna '+game+': turni, combinazioni, boss 25/50, attacchi, scarti, matte e chiusure nel tavolo normale');
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:DPR,mobile:true});
  await cdp.run(`await __campaignStart(49);if(document.documentElement.scrollWidth>innerWidth+1)throw Error('overflow a 320px');`);
  await shot('campagna-03-carte');
  await cdp.run(`handlers.campaignMap();socket.disconnect();await __campaignStart(40);await __campaignPlay();`);
  const real=errors.filter(e=>!/vibrate|Failed to load resource|favicon|speechSynthesis/.test(e));
  if(real.length)throw Error(real.join('\n'));
  step('campagna: tre mondi da 50 livelli, personaggi, 30 situazioni UI, offline e schermo 320px OK');
};
