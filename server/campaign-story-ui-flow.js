'use strict';
module.exports = async function campaignStoryUI({cdp,shot,step,errors,DPR}) {
  await cdp.run(`
    handlers.campaign();S.campaignSession=Campaign.progress(null);S.campaignStarsSession={};S.campaignAttemptsSession={};campaignPersist(CAMPAIGN_ATTEMPTS_KEY,{});S.campaignWalletSession=Campaign.wallet(null);handlers.campaignPath({dataset:{id:'burraco'}});
    for(const name of ['garden','rosa','bruno','barone','boosters']) {
      const image=new Image();image.src=CAMPAIGN_ART+name+'.webp';await image.decode();
      if(!image.naturalWidth)throw Error('Illustrazione non caricata: '+name);
    }
    if(!document.querySelector('.cad-painted-map'))throw Error('Mappa illustrata assente');
  `);
  await shot('campagna-arte-01-giardino');
  await cdp.run(`
    handlers.campaignPreview({dataset:{i:0}});await __W(110);
    const el=document.querySelector('#modal [data-story-text]');
    if(!el||!el.textContent.length||el.textContent.length>=el.dataset.storyText.length)throw Error('Battuta non progressiva');
    __tap('#modal [data-act="campaignStoryReveal"]');
    if(el.textContent!==el.dataset.storyText)throw Error('Salto della scrittura non disponibile');
    const old=el.textContent;render();await __W(60);
    if(document.querySelector('#modal [data-story-text]').textContent!==old)throw Error('Battuta riparte al render');
    const actor=document.querySelector('#modal .cad-rendered-character');
    if(!actor||!getComputedStyle(actor).backgroundImage.includes('rosa.webp'))throw Error('Rosa illustrata assente');
    // Terminare o saltare la battuta non deve riavviare l'ingresso del ritratto.
    for(let n=0;n<12;n++){
      if(Number(getComputedStyle(actor).opacity)<.99||actor.getAnimations().some(a=>a.animationName==='cad-actor-enter'))throw Error('Personaggio lampeggia alla fine della battuta');
      await __W(35);
    }
  `);
  await cdp.run('await __W(450);');
  await shot('campagna-arte-02-rosa');
  await cdp.run(`
    __tap('#modal [data-act="campaignStoryNext"]');await __W(100);campaignStoryComplete();
    if(S.campaignConversation.at!==1||!document.querySelector('#modal .cad-speech strong').textContent.includes('Bruno'))throw Error('Cambio interlocutore fallito');
    if(!getComputedStyle(document.querySelector('#modal .cad-rendered-character')).backgroundImage.includes('bruno.webp'))throw Error('Rivale illustrato assente');
    const box=document.querySelector('#modal .modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('Dialogo fuoriesce dalla finestra');
  `);
  await cdp.run('await __W(450);');
  await shot('campagna-arte-03-bruno');
  await cdp.run(`
    __tap('#modal [data-act="campaignStoryNext"]');campaignStoryComplete();
    if(S.campaignConversation.at!==2)throw Error('Risposta non avanza la conversazione');
    __tap('#modal .cad-story-reply');
    for(let n=0;n<100&&!S.campaignActive;n++)await __W(30);
    if(!S.campaignActive)throw Error('Conversazione non avvia il tavolo');
    await __W(1900);
    const text=document.querySelector('#app [data-story-text]');
    __tap('.stock');await __W(100);
    const next=document.querySelector('#app [data-story-text]');
    if(next.dataset.storyText===text.dataset.storyText||!next.dataset.storyText.includes('nuova carta'))throw Error('Guida non reagisce alla pesca');
    const felt=document.querySelector('#felt'),height=felt.clientHeight;await __W(800);
    if(felt.clientHeight!==height)throw Error('Scrittura progressiva sposta il tavolo');
    campaignStoryComplete();
  `);
  await shot('campagna-arte-04-tavolo');
  await cdp.run(`
    const before=S.campaignMatch.remainingMs;
    handlers.campaignPower({dataset:{power:'time'}});
    if(!document.querySelector('.cad-power-flight')||!document.querySelector('.cad-power-effect'))throw Error('Attivazione visiva assente');
    if(S.campaignMatch.remainingMs<before+29000)throw Error('Potenziamento visivo senza effetto reale');
    await __W(500);
  `);
  await shot('campagna-arte-05-potenziamento');
  await cdp.run(`await __W(1300);handlers.campaignShop();`);
  await shot('campagna-arte-06-bottega');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:DPR,mobile:true});
  await cdp.run(`
    handlers.campaignContinue();await __W(250);campaignStoryComplete();
    if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Overflow della guida a 320px');
    const felt=document.querySelector('#felt');if(felt.scrollHeight>felt.clientHeight+3)throw Error('Tavolo non adattato a 320px: '+felt.scrollHeight+'/'+felt.clientHeight);
    const dock=document.querySelector('.cad-table-dock'),controls=[...dock.children].map(el=>el.getBoundingClientRect());
    if(controls.some(r=>r.left<0||r.right>innerWidth+1)||Math.max(...controls.map(r=>r.top))-Math.min(...controls.map(r=>r.top))>8)throw Error('Controlli campagna non allineati a 320px');
    const clock=document.querySelector('[data-cad-clock]'),range=document.createRange();range.selectNodeContents(clock);
    const digits=range.getBoundingClientRect(),frame=clock.closest('.cad-timepiece').getBoundingClientRect();
    if(digits.left<frame.left+3||digits.right>frame.right-3||clock.scrollWidth>clock.clientWidth+1)throw Error('Timer tagliato');
    const hints=campaignWallet().hint;__tap('.cad-table-dock [data-act="hint"]');await __W(200);
    if(S.campaignMatch.revealUntil<=Date.now()||campaignWallet().hint!==hints)throw Error('Suggerimento gratuito non disponibile dalla plancia');
  `);
  await shot('campagna-arte-07-mobile');
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await cdp.run(`
    handlers.campaignMap();handlers.campaignPreview({dataset:{i:0}});
    const el=document.querySelector('#modal [data-story-text]');
    if(el.textContent!==el.dataset.storyText)throw Error('Preferenza movimento ridotto ignorata');
    const actor=document.querySelector('#modal .cad-rendered-character');
    if(getComputedStyle(actor).animationName!=='none')throw Error('Personaggio animato con movimento ridotto');
    handlers.campaignMap();
    const cache=await caches.open('campaign-art-ui-test');
    const names=[...new Set(Object.values(CAMPAIGN_WORLD_ART).flatMap(art=>[art.background,art.boosters,...art.characters]))];
    const assets=['campaign-story.css','js/campaign-story.js',...names.map(n=>'art/campaign/'+n+'.webp')];
    await cache.addAll(assets);
    for(const file of assets)if(!(await cache.match(file)))throw Error('Elemento grafico non salvabile offline: '+file);
    await caches.delete('campaign-art-ui-test');
  `);
  await cdp.send('Emulation.setEmulatedMedia',{features:[]});
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:DPR,mobile:true});
  for(const game of ['scala40','ramino']) {
    await cdp.run(`
      handlers.campaignPaths();handlers.campaignPath({dataset:{id:'${game}'}});
      const art=CAMPAIGN_WORLD_ART['${game}'];
      for(const name of [art.background,art.boosters,...art.characters]) {
        const image=new Image();image.src=CAMPAIGN_ART+name+'.webp';await image.decode();
        if(!image.naturalWidth)throw Error('Illustrazione assente: '+name);
      }
      if(!getComputedStyle(document.querySelector('.cad-map-paint')).backgroundImage.includes(art.background+'.webp'))throw Error('Mondo illustrato errato');
      if(document.querySelectorAll('.cad-painted-map [data-act="campaignPreview"]:disabled').length!==9)throw Error('Sblocchi della nuova mappa errati');
    `);
    await shot('campagna-arte-'+game+'-mappa');
    await cdp.run(`
      handlers.campaignPreview({dataset:{i:0}});campaignStoryComplete();await __W(450);
      if(!getComputedStyle(document.querySelector('#modal .cad-rendered-character')).backgroundImage.includes(CAMPAIGN_WORLD_ART['${game}'].characters[0]+'.webp'))throw Error('Guida del nuovo mondo assente');
      if(document.querySelectorAll('#modal .cad-conversation-stage .cad-portrait').length!==1)throw Error('Personaggio duplicato');
      handlers.campaignStoryNext();campaignStoryComplete();await __W(450);
      if(!getComputedStyle(document.querySelector('#modal .cad-rendered-character')).backgroundImage.includes(CAMPAIGN_WORLD_ART['${game}'].characters[1]+'.webp'))throw Error('Rivale del nuovo mondo assente');
    `);
    await shot('campagna-arte-'+game+'-dialogo');
    await cdp.run(`
      __tap('#modal [data-act="campaignLevel"]');
      for(let n=0;n<100&&!S.campaignActive;n++)await __W(30);
      await __W(1900);campaignStoryComplete();
      if(!S.campaignActive||!getComputedStyle(document.querySelector('.cad-game')).backgroundImage.includes(CAMPAIGN_WORLD_ART['${game}'].background+'.webp'))throw Error('Tavolo senza ambientazione');
      if(!getComputedStyle(document.querySelector('[data-power="coach"] .cad-item-render')).backgroundImage.includes(CAMPAIGN_WORLD_ART['${game}'].boosters+'.webp'))throw Error('Medaglione della guida errato');
    `);
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:DPR,mobile:true});
    await cdp.run(`
      await __W(300);const felt=document.querySelector('#felt');
      if(document.documentElement.scrollWidth>innerWidth+1||felt.scrollHeight>felt.clientHeight+3)throw Error('Nuovo mondo non adattato a 320px');
      const rects=[...document.querySelector('.cad-table-dock').children].map(e=>e.getBoundingClientRect());
      if(rects.some(r=>r.right>innerWidth+1))throw Error('Aiuti fuori schermo');
    `);
    await shot('campagna-arte-'+game+'-tavolo-mobile');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:DPR,mobile:true});
    for(const boss of [24,49]) {
      await cdp.run(`
        handlers.campaignMap();const p=campaignPath(),progress=campaignCurrentProgress();
        for(const l of p.levels.slice(0,${boss}))progress[p.id][l.id]=l.steps.length;
        S.campaignSession=progress;handlers.campaignChapter({dataset:{i:Math.floor(${boss}/10)}});
        handlers.campaignPreview({dataset:{i:${boss}}});campaignStoryComplete();await __W(450);
        const expected=CAMPAIGN_WORLD_ART[p.id].characters[${boss===49?2:1}];
        if(!getComputedStyle(document.querySelector('#modal .cad-rendered-character')).backgroundImage.includes(expected+'.webp'))throw Error('Personaggio boss errato');
        if(p.id!=='burraco'&&document.querySelector('#modal [data-story-text]').dataset.storyText.includes('castello'))throw Error('Dialogo boss non coerente con il mondo');
      `);
      await shot('campagna-arte-'+game+'-boss-'+(boss+1));
    }
    await cdp.run('handlers.campaignMap();');
    step('campagna illustrata '+game+': mappa, personaggi, aiuti, boss 25/50 e tavolo mobile OK');
  }
  const real=errors.filter(e=>!/vibrate|Failed to load resource|favicon|speechSynthesis/.test(e));
  if(real.length)throw Error(real.join('\n'));
  step('campagna illustrata: conversazione, reazioni, potenziamenti, 320px, movimento ridotto e risorse offline OK');
};
