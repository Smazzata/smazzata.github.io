/* Primo mondo: dialoghi, timer del giocatore, cinque vite, aiuti e tentativi locali.
 * Questa modalità non invia partite, statistiche, acquisti o ricompense al server. */
'use strict';
const CAMPAIGN_WALLET_KEY = 'smazzata_campaign_wallet_v1';
const CAMPAIGN_ATTEMPTS_KEY = 'smazzata_campaign_attempts_v1';
const CAMPAIGN_CHAPTERS = {
  burraco: ['Il prato', 'Il frutteto', 'La radura', 'Il ponte', 'Il castello'],
  scala40: ['La piazza', 'Le botteghe', 'La porta', 'Gli ingranaggi', 'La torre'],
  ramino: ['La spiaggia', 'Le conchiglie', 'Il molo', 'La laguna', 'Il faro']
};
function campaignPersist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { S.campaignSaveFailed = true; }
}
function campaignWallet() { return Campaign.wallet(S.campaignWalletSession || store.get(CAMPAIGN_WALLET_KEY, null)); }
function campaignWriteWallet(w) { S.campaignWalletSession = w; campaignPersist(CAMPAIGN_WALLET_KEY, w); }
function campaignAttempts() { const a = S.campaignAttemptsSession || store.get(CAMPAIGN_ATTEMPTS_KEY, {}); return a && typeof a === 'object' && !Array.isArray(a) ? a : {}; }
function campaignWriteAttempt(remove = false) {
  const path = campaignPath(), l = path?.levels[S.campaignLevel], session = S.campaignMatch;
  if (!path || !l || !session) return;
  const a = campaignAttempts();
  if (remove || session.status !== 'playing') delete a[path.id];
  else a[path.id] = { version: 1, level: l.id, session };
  S.campaignAttemptsSession = a; campaignPersist(CAMPAIGN_ATTEMPTS_KEY, a);
}
function campaignClock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function campaignPowerIcon(kind) {
  if (typeof campaignArtPower === 'function') return campaignArtPower(kind);
  const art = {
    hint: '<path d="M23 43c0-7-10-10-10-21a19 19 0 0 1 38 0c0 11-10 14-10 21Z" fill="#ffe995"/><path d="m26 30 6 7 7-10M32 37v9" fill="none" stroke="#da8b29" stroke-width="3"/><path d="M24 47h16v8H24z" fill="#f4c254"/><path d="M27 57h10" stroke="#fff4c6" stroke-width="4"/><path d="M5 9 1 4m58 5 4-5M6 28H0m58 0h6" stroke="#fff7cb" stroke-width="3"/>',
    time: '<circle cx="32" cy="35" r="25" fill="#c9fcff"/><circle cx="32" cy="35" r="19" fill="#287aab"/><path d="M32 22v14l9 6" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="M25 3h14M32 3v7m19 3 5 5" stroke="#d6fbff" stroke-width="5" stroke-linecap="round"/>',
    coach: '<path d="m2 23 30-15 30 15-30 16Z" fill="#fff2c3"/><path d="M13 30v17q19 17 38 0V30L32 40Z" fill="#c8a0ff"/><path d="M59 25v24" stroke="#ffdf7e" stroke-width="3"/><circle cx="59" cy="51" r="4" fill="#ffdf7e"/><path d="m28 47 4 4 8-9" fill="none" stroke="white" stroke-width="3"/>',
    life: '<path d="M32 57 8 34C-11 13 18-5 32 15 46-5 75 13 56 34Z" fill="#ff9bb8"/><path d="M12 23q0-10 11-9" fill="none" stroke="#ffe5ef" stroke-width="5" stroke-linecap="round"/>'
  };
  return `<span class="cad-power-art cad-power-${kind}" aria-hidden="true"><svg viewBox="-4 -4 72 72">${art[kind] || art.hint}</svg></span>`;
}
function campaignPowerEffect(kind, purchased = false) {
  document.querySelector('.cad-power-effect')?.remove();
  const labels = { hint: 'La prossima mossa si illumina', coach: 'La guida è al tuo fianco', time: '+30 secondi', life: '+1 vita' };
  const fx = document.createElement('div'); fx.className = 'cad-power-effect'; fx.setAttribute('role', 'status');
  fx.innerHTML = `<div class="cad-power-halo"></div>${Array.from({length:12},(_,i)=>`<i style="--a:${i*30}deg;--d:${65+i%3*22}px"></i>`).join('')}<div class="cad-power-reveal">${campaignPowerIcon(kind)}<strong>${purchased ? 'Aggiunto allo zaino' : labels[kind]}</strong></div>`;
  document.body.append(fx); if (!purchased) campaignStoryPowerTravel(kind); setTimeout(() => fx.remove(), 1700);
}
function campaignWalletHTML() {
  const w = campaignWallet();
  return `<div class="cad-wallet"><span class="cad-wallet-stat" data-cad-hearts aria-label="${w.lives} vite su 5"><i class="cad-wallet-heart" aria-hidden="true">♥</i><b data-cad-heart-value>${w.lives}/5</b></span><span class="cad-wallet-stat"><i class="cad-wallet-coin" aria-hidden="true">♦</i><b>${w.coins}</b></span><button class="btn small cad-wallet-bag" data-act="campaignShop">${campaignPowerIcon('coach')}<span>Zaino</span></button><small data-cad-lives>${w.lives < 5 ? 'Prossima vita fra ' + campaignClock(w.nextLife - Date.now()) : 'Vite al completo'}</small></div>`;
}
function campaignPortrait(c, small = false) {
  const art = typeof campaignArtCharacter === 'function' && campaignArtCharacter(c, small);
  if (art) return art;
  if (c.kind === 'crab' || c.kind === 'hedgehog') {
    const crab = c.kind === 'crab';
    const body = crab
      ? '<g fill="none" stroke="#dd7958" stroke-width="7" stroke-linecap="round"><path d="m27 72-14 5-7 12m23-5-13 8m57-20 14 5 7 12m-23-5 13 8M25 62 12 48m63 14 13-14"/></g><g fill="#ed9065" stroke="#913f39" stroke-width="2"><path d="M13 54C-6 50 3 27 10 30l3 12 9-10q14 18-9 22Z"/><path d="M87 54c19-4 10-27 3-24l-3 12-9-10q-14 18 9 22Z"/><ellipse cx="50" cy="73" rx="30" ry="23"/></g><path d="M36 57V42m28 15V42" stroke="#ed9065" stroke-width="8"/><g class="cad-eyes"><circle cx="36" cy="41" r="7" fill="#fff9d8"/><circle cx="64" cy="41" r="7" fill="#fff9d8"/><circle cx="37" cy="42" r="3" fill="#273842"/><circle cx="63" cy="42" r="3" fill="#273842"/></g><path class="cad-mouth" d="M41 77q9 11 18 0" fill="none" stroke="#913f39" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="m12 89-5-19 7-3-5-18 12 1-1-19 13 5 8-19 11 13 15-13 4 18 17-2-5 18 12 8-10 12 6 17Z" fill="#774d38" stroke="#bc8b55" stroke-width="3"/><path d="M23 79q-2-39 27-40 29 1 27 40l-8 16H31Z" fill="#f5d4a3"/><ellipse cx="50" cy="78" rx="12" ry="10" fill="#d9ab7c"/><ellipse cx="50" cy="71" rx="6" ry="4" fill="#46372f"/><g class="cad-eyes" fill="#273842"><ellipse cx="36" cy="59" rx="3" ry="4"/><ellipse cx="64" cy="59" rx="3" ry="4"/></g><path class="cad-mouth" d="M43 84q7 6 14 0" fill="none" stroke="#845344" stroke-width="2.5"/><path d="M28 97q22-10 44 0v13H28Z" fill="#599379"/><path d="m42 93 8 10 8-10" fill="#ffe7a7"/>';
    return `<svg class="cad-portrait ${small?'small':''}" viewBox="0 0 100 110" role="img" aria-label="${esc(c.name)}"><rect x="1" y="1" width="98" height="108" rx="30" fill="${crab?'#245a70':'#3b5948'}"/><circle cx="74" cy="25" r="30" fill="#fff" opacity=".07"/>${body}</svg>`;
  }
  const animal = c.kind === 'hedgehog' || c.kind === 'crab';
  const hat = c.kind === 'baron' || c.kind === 'pirate' ? '<path d="M23 28h54l-9-8V6H32v14Z" fill="#273048"/><path d="M31 19h38v7H31Z" fill="#e4b84f"/>' : c.kind === 'captain' ? '<path d="M20 24Q50-7 80 24L67 32H33Z" fill="#fff7df"/><path d="M32 27h36v9H32Z" fill="#274c69"/>' : c.kind === 'gardener' ? '<ellipse cx="50" cy="30" rx="35" ry="9" fill="#f3ca79"/><path d="M29 29V17Q50-1 71 17v12Z" fill="#e3b466"/><circle cx="68" cy="22" r="7" fill="#dd7791"/>' : '<path d="M25 30Q25-4 70 14l9 16Z" fill="#e9c28c"/>';
  return `<svg class="cad-portrait ${small ? 'small' : ''}" viewBox="0 0 100 110" role="img" aria-label="${esc(c.name)}"><defs><linearGradient id="cad-${c.kind}" x2="1" y2="1"><stop stop-color="${c.color}"/><stop offset="1" stop-color="#182e3a"/></linearGradient></defs><rect x="1" y="1" width="98" height="108" rx="26" fill="url(#cad-${c.kind})"/><path d="M12 110V92Q50 65 88 92v18Z" fill="${c.color}" stroke="#fff4c9" stroke-width="3"/>${animal ? `<path d="M16 50 9 40 24 41 20 25 35 32 42 16 52 30 68 20 70 38 89 32 82 52Z" fill="${c.kind === 'crab' ? '#d67553' : '#805234'}"/><ellipse cx="50" cy="55" rx="30" ry="25" fill="#e9ba85"/>` : `<ellipse cx="50" cy="49" rx="28" ry="30" fill="#f4cba3"/>${hat}`}<g class="cad-eyes"><ellipse cx="39" cy="48" rx="3" ry="4" fill="#22313b"/><ellipse cx="61" cy="48" rx="3" ry="4" fill="#22313b"/><circle cx="40" cy="47" r="1" fill="white"/><circle cx="62" cy="47" r="1" fill="white"/></g><ellipse cx="30" cy="58" rx="6" ry="3" fill="#ed9b89" opacity=".6"/><ellipse cx="70" cy="58" rx="6" ry="3" fill="#ed9b89" opacity=".6"/><path class="cad-mouth" d="M42 63q8 8 16 0" stroke="#784439" stroke-width="3" fill="none" stroke-linecap="round"/>${c.kind === 'clockmaker' || c.kind === 'baron' ? '<g stroke="#8c704d" stroke-width="2" fill="none"><circle cx="38" cy="48" r="9"/><circle cx="62" cy="48" r="9"/><path d="M47 48h6"/></g>' : ''}<text x="50" y="99" text-anchor="middle" font-size="20">${c.icon}</text></svg>`;
}
function campaignDialogue(c, text, compact = false) {
  const art = campaignArtCharacter(c,compact,S.campaignOutcome === 'won' ? 'joy' : 'idle') || campaignPortrait(c,compact);
  return `<div class="cad-dialogue ${compact ? 'compact' : ''}" style="--character-color:${c.color}"><div class="cad-character-stage">${art}<span class="cad-character-spark">✦</span></div><div class="cad-speech"><strong>${esc(c.name)}</strong><small>${esc(c.role)}</small><p>${esc(text)}</p></div></div>`;
}
function campaignSpeak(text, force = false) {
  if (!('speechSynthesis' in window) || (!force && !store.get('cad_voice', false))) return;
  window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text);
  const speaking = active => document.body.classList.toggle('cad-speaking', active);
  utterance.onstart = () => speaking(true);
  utterance.onend = utterance.onerror = () => speaking(false);
  utterance.lang = 'it-IT'; utterance.rate = .95; window.speechSynthesis.speak(utterance);
}
function campaignEngine() { return window.BurracoGames[campaignPath().id]; }
function campaignHint() { const l = campaignPath().levels[S.campaignLevel], x = campaignEngine(); return Campaign.expected(S.campaignMatch, l, x.E, x.Bot); }
function campaignGoalsHTML() {
  const l = campaignPath().levels[S.campaignLevel];
  const states = Campaign.goalState(S.campaignMatch, l), done = states.filter(x => x.done).length;
  return `<button class="cad-goal" data-act="campaignObjectives" aria-label="Obiettivi: ${done} di ${states.length}">🎯 ${done}/${states.length}</button>`;
}
function campaignSyncTable() {
  const path = campaignPath(), session = S.campaignMatch, g = session.g, l = path.levels[S.campaignLevel];
  const room = { code: `${l.boss ? '👑 BOSS' : 'Livello'} ${l.number}`, campaign: true, rules: g.cfg.rules, n: g.n,
    seats: g.players.map((p, i) => ({ name: p.name, isBot: p.isBot, connected: true, avatar: i ? { e: l.opponent.icon, c: l.opponent.color } : null })),
    host: 0, you: 0, isHost: true, started: true, ready: [], spectators: [], hints: true, aids: true, tutorial: true,
    music: null, turnLeft: null, turnTime: 0, botLevel: 'facile', ranked: false, quick: 0 };
  onState(room, JSON.parse(JSON.stringify(campaignEngine().E.viewFor(g, 0))));
}
function campaignCoachHTML() {
  const path = campaignPath(), l = path.levels[S.campaignLevel], session = S.campaignMatch, x = campaignEngine();
  const detailed = l.number <= 10 || session.revealUntil > Date.now() || session.coachTurn === session.turns;
  const line = campaignCoachLine(path,l,session,detailed);
  return `<div class="coach campaign-table-coach cad-coach cad-live-coach"><div class="cad-coach-actor">${campaignArtCharacter(line.c,true,line.pose)||campaignPortrait(line.c,true)}</div><div class="cad-coach-copy"><strong>${esc(line.c.name)}</strong><p><button class="cad-bubble-copy" data-act="campaignStoryReveal" >${campaignStoryText(line.text,line.key)}</button></p><div class="cad-tools"><b data-cad-clock>${campaignClock(session.remainingMs)}</b>${campaignGoalsHTML()}<button data-act="campaignPause" aria-label="Pausa">⏸</button><button data-act="campaignPower" data-power="coach" class="cad-power-button" title="Allenatore per un turno" aria-label="Allenatore per un turno">${campaignPowerIcon("coach")}</button><button data-act="campaignPower" data-power="time" class="cad-power-button" title="Aggiungi 30 secondi" aria-label="Aggiungi 30 secondi">${campaignPowerIcon("time")}<span>+30</span></button><button data-act="campaignVoice" aria-label="Ascolta la guida">🔊</button><button data-act="campaignMap">Mappa</button></div></div></div>`;
}
function campaignDecorateTable() {
  if (!S.campaignActive) return;
  const l = campaignPath().levels[S.campaignLevel], s = S.campaignMatch;
  if (s.status !== 'playing' || s.g.turn !== 0 || !(l.number <= 5 || s.revealUntil > Date.now() || s.coachTurn === s.turns)) return;
  const a = campaignHint(); if (!a) return;
  for (const id of a.cardIds || (a.cardId !== undefined ? [a.cardId] : [])) { const c = $('#hand [data-card="'+id+'"]'); if(c)c.classList.add('campaign-guided-card'); }
  const target = a.type === 'draw' ? $('.stock') : a.type === 'takePile' || a.type === 'discard' ? $('.pile') : a.type === 'meld' ? $('.newmeld') : $('#felt [data-meld="'+a.meldId+'"]');
  if(target)target.classList.add('hinted');
}
function campaignChargeClock() {
  const s = S.campaignMatch, now = Date.now();
  const running = !!(S.campaignActive && s?.status === 'playing' && s.g.turn === 0 && S.screen === 'game' && !document.hidden && !S.modalKind && now >= (S.campaignBusyUntil || 0));
  if (running && S.campaignClockRunning && S.campaignClockAt) s.remainingMs = Math.max(0, s.remainingMs - Math.min(2500, Math.max(0, now - S.campaignClockAt)));
  S.campaignClockAt = now; S.campaignClockRunning = running;
  if (running && s.remainingMs <= 0) { s.status = 'lost'; s.failure = 'Il tempo è finito. Puoi riprovare: la mano iniziale resta la stessa.'; campaignFinish(); }
}
function campaignScheduleBot() {
  const s = S.campaignMatch;
  if (!S.campaignActive || s.status !== 'playing' || s.g.turn === 0 || S.campaignBotTimer) return;
  S.campaignBotTimer = setTimeout(() => {
    S.campaignBotTimer = null;
    if (!S.campaignActive || S.campaignMatch !== s || s.g.turn === 0 || s.status !== 'playing') return;
    if (S.modalKind || document.hidden) { campaignScheduleBot(); return; }
    campaignPerform(campaignHint());
  }, 900);
}
function campaignStopTable() {
  campaignChargeClock(); campaignWriteAttempt();
  S.campaignActive = false; S.campaignClockRunning = false; S.campaignLoadToken = null;
  if(S.campaignBotTimer)clearTimeout(S.campaignBotTimer); S.campaignBotTimer = null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.body.classList.remove('cad-speaking');
  S.burracoFx = null; for (const el of $$('.bigtoast, canvas.confetti')) el.remove();
  if (S.room?.campaign) { S.room = null; S.game = null; }
  S.selected.clear(); S.hint = null; S.antic = null; clearAnticipated();
  S.screen = 'campaign'; document.title = 'Smazzata'; keepScreenOn(false);
}
function campaignFinish() {
  const s = S.campaignMatch, path = campaignPath(), l = path.levels[S.campaignLevel];
  if (!s || s.settled) return; s.settled = true;
  if(s.status === 'won') {
    campaignSave(path,l,l.steps.length);
    const ratio = s.remainingMs / (l.time * 1000);
    S.campaignLastStars = ratio >= .4 && !s.usedHelp ? 3 : ratio >= .15 ? 2 : 1;
    campaignSaveStars(path,l,S.campaignLastStars);
    const before = campaignWallet(); const after = Campaign.reward(before,path,l,Date.now());
    s.rewardCoins = after.coins - before.coins; campaignWriteWallet(after);
  } else if(!s.practice) campaignWriteWallet(Campaign.loseLife(campaignWallet(),Date.now()));
  campaignWriteAttempt(true);
  // Chiudere il tavolo prima che i normali riepiloghi delle partite possano inviare statistiche.
  S.campaignOutcome = s.status; campaignStopTable(); render(); campaignFocus();
  if(s.status === 'won') campaignSpeak(`${path.mentor.name}: Obiettivo completato! ${l.boss ? 'Hai sconfitto ' + l.opponent.name + '.' : 'Un altro passo verso il cuore del mondo.'}`);
}
function campaignPerform(action) {
  const path = campaignPath(), l = path?.levels[S.campaignLevel], s = S.campaignMatch;
  if (!S.campaignActive || !l || !s || s.status !== 'playing') return { ok: false };
  campaignChargeClock(); if(s.status !== 'playing')return {ok:false};
  try {
    if(!Campaign.act(s,l,campaignEngine().E,action)) { S.campaignFeedback = l.guided ? 'Segui la guida: '+Campaign.tip(s,l,campaignEngine().E) : 'Questa mossa non è consentita dalle regole. Controlla la selezione.'; S.campaignErrors++; render(); return {ok:false,error:S.campaignFeedback}; }
    S.campaignFeedback = null; S.campaignStep = s.index; campaignWriteAttempt();
    campaignStoryReact(action,s);
    if(s.status !== 'playing') { campaignFinish(); return {ok:true}; }
    S.campaignBusyUntil = Date.now() + 350;
    campaignSyncTable(); campaignScheduleBot();
    if(s.g.turn === 0) campaignSpeak(Campaign.tip(s,l,campaignEngine().E,campaignEngine().Bot));
    return {ok:true};
  } catch(e) { S.campaignFeedback='La mossa non è disponibile: '+e.message; render();return {ok:false,error:S.campaignFeedback}; }
}
function campaignUsePower(power) {
  const s = S.campaignMatch, l = campaignPath()?.levels[S.campaignLevel];
  if(!S.campaignActive || !s || s.status !== 'playing')return {ok:false};
  if(s.g.turn !== 0)return {ok:false,error:'Aspetta il tuo turno per usare un aiuto.'};
  if(!['hint','coach','time'].includes(power))return {ok:false};
  if(power === 'time' && s.timeBoosts >= 2)return {ok:false,error:'Hai già aggiunto il tempo due volte in questo tentativo.'};
  if(power === 'coach' && s.coachTurn === s.turns)return {ok:false,error:'L’allenatore ti sta già accompagnando in questo turno.'};
  const w = campaignWallet(), free = power === 'hint' && l.number <= 5;
  if(!free && !w[power]) { handlers.campaignShop(); return {ok:false,error:'Puoi ottenere altri aiuti nella bottega.'}; }
  if(!free) { w[power]--; s.usedHelp++; campaignWriteWallet(w); }
  if(power === 'time') { s.remainingMs += 30000; s.timeBoosts++; }
  else if(power === 'coach')s.coachTurn=s.turns;
  else s.revealUntil=Date.now()+20000;
  campaignWriteAttempt(); render(); campaignPowerEffect(power);
  return {ok:true,hint:power==='hint'?campaignHint():null};
}
function campaignEvent(ev,data) {
  if(ev === 'hint')return campaignUsePower('hint');
  if(['leaveRoom','closeTable','surrender','endGame'].includes(ev)){handlers.campaignMap();return {ok:true};}
  if(ev === 'sync'){campaignSyncTable();return {ok:true};}
  if(ev !== 'action')return {ok:false,error:'Questa funzione non è disponibile nella campagna.'};
  if(S.modalKind)return {ok:false,error:'Chiudi la finestra per continuare.'};
  if(S.campaignMatch.g.turn !== 0)return {ok:false,error:'Ora gioca il computer.'};
  // Toccando la scala il client può proporre un attacco anche quando la lezione
  // richiede di sostituire il jolly: entrambe le azioni possono essere legali.
  const hint = campaignHint();
  if(data?.type === 'add' && data.cardIds?.length === 1 && hint?.type === 'swap' && hint.meldId === data.meldId && hint.cardId === data.cardIds[0]) data = hint;
  return campaignPerform(data);
}
function campaignExerciseHTML(path,l,note) {
  const s=S.campaignMatch, won=S.campaignOutcome==='won', lost=S.campaignOutcome==='lost';
  const nav=`<button class="btn ghost small" data-act="campaignMap">← Mappa di ${esc(path.name)}</button>`;
  if(won||lost) return `<main class="page campaign">${nav}${campaignWalletHTML()}<div class="campaign-celebrate">${won?campaignConfetti():''}${campaignDialogue(won?path.mentor:l.opponent,won?(l.number===50?'Il mondo è salvo! Hai raggiunto il cuore dell’avventura.':l.boss?'Hai superato la mia sfida! Il viaggio continua.':'Ottimo lavoro! Ogni carta aveva il suo posto.'):s.failure||'Questa volta non è bastato. Riprova osservando il tavolo e l’obiettivo: puoi farcela.')}<span class="campaign-kicker">${won?'LIVELLO COMPLETATO':'RIPROVIAMO'} · ${l.number}/50</span><h1 tabindex="-1">${esc(l.title)}</h1>${won?campaignStarsHTML(S.campaignLastStars,'big'):''}<p>${esc(l.goalText)}</p>${won?`<p>🪙 +${s.rewardCoins||0} monete${l.number%10===0?' · Bonus di zona: suggerimento e tempo extra':''}</p>`:`<p>${s.practice?'L’allenamento di un livello già completato non consuma vite.':'Hai perso una vita. Una vita si ricarica ogni 30 minuti.'}</p>`}<div class="campaign-end-actions">${won&&l.number<50?`<button class="btn primary big" data-act="campaignLevel" data-i="${l.number}">Prossimo livello →</button>`:''}<button class="btn ${lost?'primary big':''}" data-act="campaignReplay">${lost?'Riprova':'Rigioca'}</button><button class="btn" data-act="campaignMap">Torna alla mappa</button></div></div>${note}</main>`;
  return `<main class="page campaign">${nav}<h1 tabindex="-1">Preparazione del tavolo</h1><p role="status">${esc(S.campaignLoadError||'Caricamento della partita…')}</p><button class="btn" data-act="campaignReplay">Riprova</button></main>`;
}
Object.assign(handlers, {
  campaignChapter(el) { const n=Number(el.dataset.i);if(!Number.isInteger(n)||n<0||n>4)return;S.campaignChapter=n;render();window.scrollTo(0,0);campaignFocus(); },
  campaignPath(el) { const p=Campaign.paths.find(p=>p.id===el.dataset.id);if(!p)return;S.campaignPath=p.id;S.campaignLevel=null;S.campaignChapter=Math.min(4,Math.floor(campaignCompleted(p,campaignCurrentProgress())/10));render();campaignScrollToCurrent();campaignFocus(); },
  campaignPreview(el) {
    const p=campaignPath(),i=Number(el.dataset.i),progress=campaignCurrentProgress(),l=p?.levels[i];
    if(!l||!Number.isInteger(i)||(i>0&&progress[p.id][p.levels[i-1].id]<p.levels[i-1].steps.length))return;
    const pending=campaignAttempts()[p.id], resume=pending?.level===l.id;
    S.campaignConversation={index:i,at:0,resume,lines:campaignConversationLines(p,l)};
    openModal('campaign',campaignConversationHTML(p,l,i,resume));campaignStoryMount();campaignSpeak(S.campaignConversation.lines[0].text);
  },
  async campaignLevel(el) {
    const p=campaignPath(),i=Number(el.dataset.i),progress=campaignCurrentProgress(),l=p?.levels[i];
    if(!l||!Number.isInteger(i)||(i>0&&progress[p.id][p.levels[i-1].id]<p.levels[i-1].steps.length))return;
    const pending=campaignAttempts()[p.id],resume=pending?.version===1&&pending.level===l.id&&pending.session?.status==='playing';
    const practice=progress[p.id][l.id]===l.steps.length;
    if(!resume&&!practice&&campaignWallet().lives===0){handlers.campaignShop();return;}
    closeModal();campaignStopTable();S.campaignReaction=null;S.campaignLevel=i;S.campaignOutcome=null;S.campaignMatch=null;S.campaignLoadError=null;S.campaignStep=0;S.campaignErrors=0;S.campaignLastStars=0;S.campaignFeedback=null;
    const token={};S.campaignLoadToken=token;render();window.scrollTo(0,0);
    try {
      await LocalServer.loadEngine('engine.js');
      if(S.campaignLoadToken!==token||S.screen!=='campaign'||campaignPath()!==p||S.campaignLevel!==i)return;
      let session;
      if(resume) { try { session=JSON.parse(JSON.stringify(pending.session));if(!Array.isArray(session.g.players)||session.g.players.length!==2||!Array.isArray(session.doneSteps)||!Number.isFinite(session.remainingMs)||session.remainingMs<=0)throw Error('Tentativo non valido');campaignEngine().E.viewFor(session.g,0); }catch(e){session=null;} }
      S.campaignMatch=session||Campaign.start(p,l,campaignEngine().E);S.campaignMatch.practice=practice;
      S.campaignMatch.g.players[1].name=l.opponent.name;
      S.campaignStep=S.campaignMatch.index;S.selected.clear();S.handOrder=[];S.game=null;S.coachOff=false;S.campaignActive=true;S.campaignClockAt=Date.now();S.campaignClockRunning=false;S.campaignBusyUntil=Date.now()+1800;
      campaignSyncTable();campaignWriteAttempt();campaignScheduleBot();campaignSpeak(Campaign.tip(S.campaignMatch,l,campaignEngine().E,campaignEngine().Bot));
    }catch(e){if(S.campaignLoadToken!==token)return;S.campaignActive=false;S.room=null;S.game=null;S.screen='campaign';S.campaignLoadError='Il tavolo non è disponibile. Puoi riprovare senza perdere vite.';render();}
  },
  campaignMap() { closeModal();campaignStopTable();const l=campaignPath()?.levels[S.campaignLevel];if(l)S.campaignChapter=l.chapter;S.campaignLevel=null;render();campaignScrollToCurrent();campaignFocus(); },
  campaignPause() { campaignChargeClock();openModal('campaignPause',`<h2>⏸ Partita in pausa</h2><p>Il tavolo ti aspetta e il tempo è fermo.</p><button class="btn primary big" data-act="campaignContinue">Riprendi</button><button class="btn" data-act="campaignMap">Metti da parte e torna alla mappa</button>`);campaignWriteAttempt(); },
  campaignContinue() { closeModal();S.campaignClockAt=Date.now();S.campaignClockRunning=false;if(!S.campaignActive)render();campaignScheduleBot(); },
  campaignObjectives() { const l=campaignPath().levels[S.campaignLevel],states=Campaign.goalState(S.campaignMatch,l),labels={turns:'Turni completati',melds:'Combinazioni sul tavolo',seqs:'Scale',sets:'Tris o poker',adds:'Attacchi eseguiti',wild:'Giochi con una matta',swaps:'Jolly recuperati',pile:'Raccolte dagli scarti',burraco:'Burraco completato',clean:'Scala senza matte',close:'Chiusura della smazzata'};openModal('campaignPause',`<h2>🎯 ${esc(l.title)}</h2><p>${esc(l.goalText)}</p><ul class="cad-objectives">${states.map(x=>`<li>${x.done?'✅':'○'} ${labels[x.key]} <b>${typeof x.target==='boolean'?(x.done?'Completato':'Da completare'):x.value+'/'+x.target}</b></li>`).join('')}</ul><p>Turni completati: ${S.campaignMatch.turns}/${l.maxTurns}. L’obiettivo viene verificato alla fine del tuo turno.</p><button class="btn primary" data-act="campaignContinue">Torna al tavolo</button>`); },
  campaignPower(el) { const r=campaignUsePower(el.dataset.power);if(!r.ok&&r.error)toast(r.error,true); },
  campaignVoice(el) { const intro=el?.dataset.intro!==undefined,p=campaignPath(),l=p?.levels[intro?Number(el.dataset.intro):S.campaignLevel];if(!l)return;if(!intro&&store.get('cad_voice',false)){handlers.campaignMute();return;}store.set('cad_voice',true);campaignSpeak(intro?l.intro:Campaign.tip(S.campaignMatch,l,campaignEngine().E,campaignEngine().Bot),true); },
  campaignMute() { store.set('cad_voice',false);if('speechSynthesis'in window)window.speechSynthesis.cancel();document.body.classList.remove('cad-speaking');toast('Voce disattivata'); },
  campaignShop() {
    campaignChargeClock();const w=campaignWallet();
    const items=[['hint','💡 Suggerimento','Evidenzia una mossa per 20 secondi.',40],['coach','🎓 Allenatore','Guida e carte evidenziate per il turno attuale.',80],['time','⏱ Tempo extra','Aggiunge 30 secondi. Massimo due per tentativo.',30],['life','❤️ Una vita','Recupera una vita senza aspettare.',60]];
    openModal('campaignShop',`<div class="cad-shop"><h2>🎒 La bottega degli aiuti</h2><p>🪙 ${w.coins} monete · ❤️ ${w.lives}/5 vite</p><p>Guadagni 15 monete completando un nuovo livello e 100 per un boss. Ogni dieci livelli ricevi anche due aiuti.</p>${items.map(([id,title,text,cost])=>`<div class="cad-shop-item">${campaignPowerIcon(id)}<div><strong>${title.replace(/^[^ ]+ /, "")}</strong><small>${text}</small><small>${id==='life'?'':`Nello zaino: ${w[id]}`}</small></div><button class="btn" data-act="campaignBuy" data-item="${id}" ${w.coins<cost||(id==='life'&&w.lives>=5)?'disabled':''}>${cost} 🪙</button></div>`).join('')}<p data-cad-lives>${w.lives<5?'Prossima vita fra '+campaignClock(w.nextLife-Date.now()):'Vite al completo'}</p><button class="btn primary" data-act="campaignContinue">${S.campaignActive?'Torna al tavolo':'Continua'}</button></div>`);
  },
  campaignBuy(el) { const costs={hint:40,coach:80,time:30,life:60},id=el.dataset.item,w=campaignWallet();if(!Object.hasOwn(costs,id)||w.coins<costs[id]||id==='life'&&w.lives>=5)return;w.coins-=costs[id];if(id==='life'){w.lives++;if(w.lives===5)w.nextLife=0;}else w[id]++;campaignWriteWallet(w);handlers.campaignShop();campaignPowerEffect(id,true); },
});
// La verifica temporale aggiorna soltanto l’orologio, senza interrompere le animazioni.
setInterval(()=>{
  campaignChargeClock();
  const clock=$('[data-cad-clock]');if(clock&&S.campaignMatch){clock.textContent=campaignClock(S.campaignMatch.remainingMs);clock.classList.toggle('cad-urgent',S.campaignMatch.remainingMs<30000);}
  const lives=$$('[data-cad-lives]');if(lives.length){const w=campaignWallet();for(const el of lives)el.textContent=w.lives<5?'Prossima vita fra '+campaignClock(w.nextLife-Date.now()):'Vite al completo';const hearts=$('[data-cad-hearts]');if(hearts){const value=hearts.querySelector('[data-cad-heart-value]');if(value)value.textContent=w.lives+'/5';hearts.setAttribute('aria-label',w.lives+' vite su 5');}}
  if(S.campaignActive&&Date.now()-(S.campaignLastPersist||0)>5000){campaignWriteAttempt();S.campaignLastPersist=Date.now();}
},250);
document.addEventListener('visibilitychange',()=>{S.campaignClockRunning=false;S.campaignClockAt=Date.now();if(S.campaignActive){campaignWriteAttempt();campaignScheduleBot();}});
window.addEventListener('pagehide',()=>{if(S.campaignActive){campaignChargeClock();campaignWriteAttempt();}});
