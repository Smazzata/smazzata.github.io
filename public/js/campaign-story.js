/* Regia della campagna: i personaggi reagiscono al tavolo, senza bloccare le mosse. */
'use strict';
const CAMPAIGN_ART = 'art/campaign/';
const CAMPAIGN_WORLD_ART = {
  burraco: { background:'garden', boosters:'boosters', characters:['rosa','bruno','barone'], greeting:'Il giardino ti aspetta!', guide:'Nonna Rosa', destination:'castello', spots:[[52,94],[49,87],[65,80],[57,73],[46,66],[67,59],[61,52],[58,45],[73,38],[79,31]] },
  scala40: { background:'clockwork', boosters:'boosters-scala40', characters:['arturo','nina','conte'], greeting:'Il borgo torna a vivere!', guide:'Maestro Arturo', destination:'torre dell’orologio', spots:[[49,94],[55,87],[64,80],[55,73],[43,66],[62,59],[67,52],[59,45],[70,38],[65,31]] },
  ramino: { background:'bay', boosters:'boosters-ramino', characters:['marina','pippo','nebbia'], greeting:'La baia chiama!', guide:'Capitana Marina', destination:'faro', spots:[[50,94],[50,87],[53,80],[57,73],[52,66],[63,59],[55,52],[48,45],[69,38],[58,31]] }
};
let campaignStoryFrame = 0;
let campaignStoryLine = { key: '', text: '', shown: 0, at: 0 };

function campaignArtCharacter(c, small = false, pose = 'idle') {
  const names={gardener:'rosa',hedgehog:'bruno',clockmaker:'arturo',mechanic:'nina',captain:'marina',crab:'pippo',pirate:'nebbia'};
  const name = c.kind==='baron' ? (c.name==='Il Conte Quaranta'?'conte':'barone') : names[c.kind];
  if (!name) return null;
  return `<span class="cad-portrait cad-rendered-character ${small ? 'small' : ''} cad-pose-${pose}" role="img" aria-label="${esc(c.name)}" style="--character-sheet:url('${CAMPAIGN_ART}${name}.webp')"></span>`;
}
function campaignArtPower(kind) {
  const index = { hint: 0, time: 1, coach: 2, life: 3 }[kind];
  const world=CAMPAIGN_WORLD_ART[campaignPath()?.id]||CAMPAIGN_WORLD_ART.burraco;
  return index === undefined ? '' : `<span class="cad-power-art cad-item-render cad-item-${kind}" aria-hidden="true" style="--item-x:${index / 3 * 100}%;--item-sheet:url('${CAMPAIGN_ART}${world.boosters}.webp')"></span>`;
}
function campaignStoryText(text, key) {
  return `<span class="cad-story-copy"><span class="cad-story-text" data-story-text="${esc(text)}" data-story-key="${esc(key)}" aria-hidden="true">${esc(text)}</span><span class="cad-story-measure" aria-hidden="true">${esc(text)}</span></span><span class="sr-only">${esc(text)}</span>`;
}
function campaignStoryMount() {
  cancelAnimationFrame(campaignStoryFrame);
  const el = document.querySelector('#modal:not(.hidden):not(.closing) [data-story-text]') || document.querySelector('#app [data-story-text]');
  if (!el) return;
  const text = el.dataset.storyText, key = el.dataset.storyKey;
  const reduced = S.prefs.anim === false || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (campaignStoryLine.key !== key || campaignStoryLine.text !== text) {
    campaignStoryLine = { key, text, shown: reduced ? text.length : 0, at: performance.now() };
  }
  const line = campaignStoryLine;
  const tick = now => {
    if (!el.isConnected || campaignStoryLine !== line) return;
    line.shown = reduced ? text.length : Math.min(text.length, Math.max(line.shown, Math.floor((now - line.at) / 17)));
    el.textContent = text.slice(0, line.shown);
    el.closest('.cad-conversation, .cad-coach')?.classList.toggle('cad-is-talking', line.shown < text.length);
    if (line.shown < text.length) campaignStoryFrame = requestAnimationFrame(tick);
  };
  tick(performance.now());
}
function campaignStoryComplete() {
  const line = campaignStoryLine;
  if (line.shown >= line.text.length) return false;
  line.shown = line.text.length;
  for (const el of document.querySelectorAll('[data-story-text]')) if (el.dataset.storyKey === line.key) {
    el.textContent = line.text; el.closest('.cad-conversation, .cad-coach')?.classList.remove('cad-is-talking');
  }
  cancelAnimationFrame(campaignStoryFrame); return true;
}
function campaignConversationLines(p, l) {
  const first = l.number === 1;
  const welcome = p.id === 'burraco' ? 'Benvenuto nel giardino dei quattro semi! Siediti: giochiamo una mano insieme.' : p.id === 'scala40' ? 'Benvenuto nel borgo! Le carte giuste rimetteranno in moto il nostro orologio.' : 'Benvenuto nella baia! Vieni al tavolo: insieme riaccenderemo il faro.';
  const chapterLines={
    burraco:['Il sentiero comincia da queste carte.','Nel frutteto ogni seme trova il suo posto.','Tra gli alberi spuntano carte magiche.','Il ponte di Bruno è sempre più vicino.','Le porte del castello sono davanti a noi.'],
    scala40:['La piazza aspetta il primo rintocco.','Nelle botteghe ogni carta mette in moto un ingranaggio.','Nina custodisce la porta: prepariamo le nostre combinazioni.','Un attacco ben fatto rimette in moto il meccanismo.','La torre è vicina. Facciamo ripartire il grande orologio!'],
    ramino:['La marea ci porta le prime carte.','Tra le conchiglie si nascondono i semi giusti.','Pippo ci aspetta al molo. Giochiamo con attenzione!','Attraversiamo la laguna, una combinazione alla volta.','Il faro emerge dalla nebbia. L’ultima mano ci aspetta!']
  };
  const finalChallenge={burraco:'Sei arrivato al mio castello. Questa volta dovrai giocare tutte le tue carte!',scala40:'La torre è mia! Vediamo se sai far ripartire il mio orologio con le tue carte.',ramino:'Il faro è avvolto nella mia nebbia! Per riaccenderlo dovrai vincere questa mano.'};
  return [
    { c: l.boss ? l.opponent : p.mentor, text: l.boss ? (l.number === 50 ? finalChallenge[p.id] : 'Fin qui te la sei cavata. Ora vediamo come giochi contro di me!') : first ? welcome : chapterLines[p.id][l.chapter], pose: 'talk', reply: first ? 'Mi siedo al tavolo!' : 'Accetto la sfida!' },
    { c: l.boss ? p.mentor : p.rival, text: l.boss ? 'Ci sono io al tuo fianco. Guarda il tavolo e affronta una mossa alla volta.' : first ? 'Io non ti renderò le cose troppo facili… ma per la prima mano ti lascio cominciare!' : p.id==='scala40'?'Le carte sono gli ingranaggi di questa sfida. Sta a te metterle insieme!':p.id==='ramino'?'Le carte sono pronte sul molo. Non lasciare che sia la corrente a decidere per te!':'Le carte sono pronte. Vediamo chi farà la mossa migliore!', pose: 'talk', reply: 'Vediamo le carte' },
    { c: p.mentor, text: first ? 'Prima pesca una carta dal mazzo. Poi ti mostrerò come continuare. Tocca le carte: ti accompagno io.' : l.goalText, pose: 'talk', reply: 'Giochiamo!' }
  ];
}
function campaignConversationHTML(p, l, index, resume) {
  const story = S.campaignConversation, line = story.lines[story.at], last = story.at === story.lines.length - 1;
  const art = campaignArtCharacter(line.c, false, line.pose) || campaignPortrait(line.c);
  return `<section class="cad-brief cad-conversation cad-painted-scene cad-scene-${p.id}" style="--world-art:url('${CAMPAIGN_ART}${CAMPAIGN_WORLD_ART[p.id].background}.webp')">
    <div class="cad-scene-top"><span>${l.boss ? 'SFIDA BOSS' : 'LIVELLO ' + l.number} · ${esc(p.name)}</span><button class="cad-scene-skip" data-act="campaignLevel" data-i="${index}">${resume ? 'Riprendi' : 'Vai al tavolo'} ↗</button></div>
    <h2>${esc(l.title)}</h2>
    <div class="cad-conversation-stage" aria-hidden="true"><div class="cad-scene-glow"></div>${art}<span class="cad-floating-suit suit-one">♥</span><span class="cad-floating-suit suit-two">♣</span></div>
    <div class="cad-dialogue cad-live-bubble"><div class="cad-speech"><strong>${esc(line.c.name)}</strong><button class="cad-bubble-copy" data-act="campaignStoryReveal" >${campaignStoryText(line.text, `intro/${p.id}/${l.id}/${story.at}`)}</button></div></div>
    <div class="cad-conversation-footer"><span class="cad-dialogue-dots" aria-label="Battuta ${story.at + 1} di ${story.lines.length}">${story.lines.map((_,i)=>`<i class="${i === story.at ? 'on' : ''}"></i>`).join('')}</span><button class="cad-scene-voice" data-act="campaignStoryVoice" aria-label="Ascolta questa battuta">♫ Voce</button></div>
    <button class="btn primary big cad-story-reply" data-act="${last ? 'campaignLevel' : 'campaignStoryNext'}" data-i="${index}">${resume && last ? 'Riprendi la partita' : esc(line.reply)} <span aria-hidden="true">→</span></button>
    <div class="cad-scene-mission"><span>${campaignClock(l.time*1000)}</span><span>${l.maxTurns} ${l.maxTurns === 1 ? 'turno' : 'turni'}</span><button data-act="campaignStoryMission" aria-expanded="false">La missione ⓘ</button></div><div class="cad-scene-objective" hidden><strong>${esc(l.goalText)}</strong><p>${esc(l.intro)}</p><small>Il tempo si ferma durante il turno del computer e nelle pause.</small></div>
  </section>`;
}
function campaignCoachLine(p, l, session, detailed) {
  const x = campaignEngine(), bot = session.g.turn !== 0;
  const hint = Campaign.tip(session, l, x.E, x.Bot);
  const reaction = S.campaignReaction;
  const fresh = reaction && reaction.turn === session.turns && reaction.index === session.index && Date.now() < reaction.until;
  const text = S.campaignFeedback || (bot ? 'Ora tocca a me. Guarda quali carte metto sul tavolo…' : `${fresh ? reaction.text + ' ' : ''}${detailed ? hint : l.goalText}`);
  const c = bot ? l.opponent : p.mentor;
  const pose = bot ? 'talk' : fresh ? 'joy' : 'talk';
  return { text, c, pose, key: `table/${p.id}/${l.id}/${session.turns}/${session.index}/${session.g.turn}/${S.campaignFeedback || ''}/${fresh ? reaction.text : ''}` };
}
function campaignStoryReact(action, s) {
  if (s.g.turn !== 0) return;
  const reactions = { draw: 'Ecco la nuova carta!', takePile: 'Ottima raccolta!', meld: 'Ben fatto! La combinazione è sul tavolo.', add: 'Perfetto: hai allungato il gioco!', swap: 'Il jolly è di nuovo tuo!' };
  if (reactions[action.type]) S.campaignReaction = { text: reactions[action.type], turn: s.turns, index: s.index, until: Date.now() + 9000 };
}
function campaignGardenMap(path, progress, stars) {
  const art=CAMPAIGN_WORLD_ART[path.id],spots=art.spots;
  const full = Campaign.paths.find(p=>p.id === path.id);
  const chapter = Math.floor((path.levels[0].number - 1) / 10);
  return `<div class="cmap cad-painted-map cad-map-${path.id} cad-zone-${chapter}" style="--world-art:url('${CAMPAIGN_ART}${art.background}.webp')" aria-label="Mappa di ${esc(path.world)}"><div class="cad-map-paint"></div><div class="cad-map-shimmer" aria-hidden="true"></div><div class="cad-map-plaque">${esc(CAMPAIGN_CHAPTERS[path.id][chapter])}<small>♣ ♦ ♥ ♠</small></div>${path.levels.map((l,i)=>{
    const done=progress[path.id][l.id]>=l.steps.length,previous=full.levels[l.number-2];
    const locked=previous&&progress[path.id][previous.id]<previous.steps.length,here=!done&&!locked,st=campaignLevelStars(path,l,progress,stars);
    return `<div class="cmap-spot ${done?'done':locked?'locked':'current'}" style="left:${spots[i][0]}%;top:${spots[i][1]}%">${here?'<span class="cmap-rays" aria-hidden="true"></span><i class="cmap-spark" aria-hidden="true"></i>':done?campaignStarsHTML(st):''}<button class="cmap-node ${l.boss?'cad-boss-node':''}" data-act="campaignPreview" data-i="${l.number-1}" ${locked?'disabled':''} ${here?'aria-current="step"':''} aria-label="Livello ${l.number}: ${esc(l.title)}. ${locked?'Bloccato':done?'Completato':'Da giocare'}"><b>${l.boss?'♛':l.number}</b>${locked?'<span class="cmap-lock" aria-hidden="true">◆</span>':''}</button><span class="cmap-title" aria-hidden="true">${esc(l.title)}</span></div>`;
  }).join('')}</div>`;
}
function campaignWorldGreeting(path) {
  const art=CAMPAIGN_WORLD_ART[path.id];
  return `<div class="cad-world-greeting cad-greeting-${path.id}">${campaignArtCharacter(path.mentor,false,'talk')}<div><strong>${art.greeting}</strong><p>Scegli una tappa. Ti accompagno io, una carta alla volta.</p><span>La tua guida · ${esc(art.guide)}</span></div></div>`;
}
function campaignStoryPowerTravel(kind) {
  const selector = kind === 'time' ? '[data-cad-clock]' : kind === 'hint' ? '#hand .campaign-guided-card, .stock.hinted, .pile.hinted' : '.cad-coach .cad-portrait';
  const target = document.querySelector(selector);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const fly = document.createElement('div'); fly.className = 'cad-power-flight';
  fly.style.setProperty('--fly-x', (rect.x + rect.width / 2 - innerWidth / 2) + 'px');
  fly.style.setProperty('--fly-y', (rect.y + rect.height / 2 - innerHeight / 2) + 'px');
  fly.innerHTML = campaignArtPower(kind); document.body.append(fly);
  setTimeout(()=>{fly.remove();if(target.isConnected){target.classList.add('cad-power-arrived');setTimeout(()=>target.classList.remove('cad-power-arrived'),1000);}},1600);
}
Object.assign(handlers, {
  campaignStoryReveal() { campaignStoryComplete(); },
  campaignStoryNext() {
    const story=S.campaignConversation,p=campaignPath(),l=p?.levels[story?.index];
    if(!story||!l)return;
    campaignStoryComplete();
    story.at=Math.min(story.at+1,story.lines.length-1);
    openModal('campaign',campaignConversationHTML(p,l,story.index,story.resume));
    campaignStoryMount();campaignSpeak(story.lines[story.at].text);
  },
  campaignStoryVoice() { const story=S.campaignConversation;if(story){store.set('cad_voice',true);campaignSpeak(story.lines[story.at].text,true);} },
  campaignStoryMission(el) { const panel=document.querySelector('.cad-scene-objective');if(panel){panel.hidden=!panel.hidden;el.setAttribute('aria-expanded',String(!panel.hidden));} }
});
