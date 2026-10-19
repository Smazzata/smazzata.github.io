'use strict';

// I progressi didattici sono locali: nessun Elo, premio o risultato inviato al server.
const CAMPAIGN_KEY = 'smazzata_campaign_world1_v1';
const Campaign = window.CardCampaign;
function campaignProgress() { return Campaign.progress(store.get(CAMPAIGN_KEY, {})); }
function campaignPath() { return Campaign.paths.find((p) => p.id === S.campaignPath); }
function campaignSave(path, level, done) {
  const progress = campaignCurrentProgress();
  progress[path.id][level.id] = Math.max(progress[path.id][level.id], done);
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(progress)); S.campaignSaveFailed = false; }
  catch (e) { S.campaignSaveFailed = true; }
  // Permette di continuare anche se la memoria del browser non è disponibile.
  S.campaignSession = progress;
}
function campaignCurrentProgress() { return S.campaignSession || campaignProgress(); }
function campaignCompleted(path, progress) { return path.levels.filter((l) => progress[path.id][l.id] >= l.steps.length).length; }
function campaignFocus(selector = '.campaign h1') {
  const el = $(selector); if (el) el.focus({ preventScroll: true });
}
function campaignScene() {
  return `<svg class="campaign-scene" viewBox="0 0 700 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <circle cx="565" cy="40" r="27" fill="#ffe7a2"/>
    <path d="M0 100 Q110 15 260 100 Q420 15 700 90 V170 H0Z" fill="#9fca8f"/>
    <path d="M0 130 Q200 60 380 125 Q540 60 700 120 V170 H0Z" fill="#5b9e70"/>
    <path d="M295 170 Q400 125 350 95 Q330 80 395 60" fill="none" stroke="#ead6aa" stroke-width="23"/>
    <g fill="#f7ecd1" stroke="#b69b65" stroke-width="2"><path d="M375 65 V32 H385 V40 H395 V32 H405 V65Z"/><path d="M403 65 V20 H413 V28 H423 V20 H433 V65Z"/></g>
    <path d="M416 20 V2 L441 9 L416 15" fill="#bc5261"/>
    <g fill="#32634a"><path d="M86 145 V82 H92 V145Z"/><circle cx="88" cy="79" r="26"/><path d="M600 160 V107 H606 V160Z"/><circle cx="603" cy="103" r="23"/></g>
  </svg>`;
}
function campaignHTML() {
  const path = campaignPath();
  const progress = campaignCurrentProgress();
  const back = `<button class="btn ghost small" data-act="${path ? 'campaignPaths' : 'goHome'}">← ${path ? 'Tutti i percorsi' : 'Home'}</button>`;
  const note = `<p class="campaign-note">Progressi salvati su questo dispositivo e in questo browser. Nessuna vita, nessun limite di tempo.</p>${S.campaignSaveFailed ? '<p role="alert">Non riesco a salvare sul dispositivo. Puoi continuare, ma chiudendo la pagina perderai questi progressi.</p>' : ''}`;
  if (!path) return `<main class="page campaign">${back}
    <header class="campaign-hero"><span class="campaign-kicker">LA TUA AVVENTURA</span><h1 tabindex="-1">Un gioco, un percorso</h1><p>Scegli cosa vuoi imparare. Ogni avventura comincia da zero e cresce con te.</p>${campaignScene()}</header>
    <div class="campaign-paths">${Campaign.paths.map((p) => { const n = campaignCompleted(p, progress); return `<button class="campaign-path" data-act="campaignPath" data-id="${p.id}"><span class="campaign-path-icon" aria-hidden="true">${p.icon}</span><span><strong>${p.name}</strong><span>${p.subtitle}</span><small>${n === p.levels.length ? 'Primo mondo completato · Rigioca' : n ? `Riprendi · ${n} di ${p.levels.length} livelli` : 'Inizia · 5 livelli guidati'}</small></span><b aria-hidden="true">→</b></button>`; }).join('')}</div>
    ${note}<button class="btn ghost" data-act="tutorial">📖 Preferisci leggere le regole?</button></main>`;
  const current = path.levels[S.campaignLevel];
  if (current) return campaignExerciseHTML(path, current, note);
  const completed = campaignCompleted(path, progress);
  return `<main class="page campaign">${back}<header class="campaign-hero"><span class="campaign-kicker">${esc(path.name)} · MONDO 1</span><h1 tabindex="-1">Il prato delle carte</h1><p>${esc(path.subtitle)}. Piccole prove, una scoperta alla volta.</p>${campaignScene()}</header>
    <div class="campaign-world-progress"><strong>${completed} / ${path.levels.length} livelli</strong><progress value="${completed}" max="${path.levels.length}" aria-label="Livelli completati"></progress></div>
    <ol class="campaign-map">${path.levels.map((l, i) => { const n = progress[path.id][l.id], done = n === l.steps.length, locked = i > 0 && progress[path.id][path.levels[i - 1].id] < path.levels[i - 1].steps.length; return `<li class="${done ? 'done' : locked ? 'locked' : 'current'}"><button class="campaign-node" data-act="campaignLevel" data-i="${i}" ${locked ? 'disabled' : ''} ${!done && !locked ? 'aria-current="step"' : ''}><span class="campaign-node-icon" aria-hidden="true">${locked ? '🔒' : done ? '✓' : l.icon}</span><span><small>LIVELLO ${i + 1} · ${done ? 'Completato · Rigioca' : locked ? 'Completa il livello precedente' : n ? 'Riprendi' : 'Da esplorare'}</small><strong>${esc(l.title)}</strong><span>${esc(l.goal)}</span></span></button></li>`; }).join('')}</ol>
    ${completed === path.levels.length ? `<div class="campaign-celebrate"><span aria-hidden="true">🏰</span><h2>Il primo mondo è tuo!</h2><p>Hai scoperto le basi di ${esc(path.name)}. Puoi rigiocare ogni livello o provarle al tavolo.</p><button class="btn primary" data-act="campaignTrain">Prova contro il computer</button></div>` : ''}
    ${note}<p class="campaign-note">${esc(path.rules)}. Le varianti personalizzate possono avere regole diverse.</p></main>`;
}
function campaignCardName(c) { return c.r === 0 ? 'Jolly' : `${({1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re'})[c.r] || c.r} di ${{H: 'cuori', D: 'quadri', S: 'picche', C: 'fiori'}[c.s]}`; }
function campaignExerciseHTML(path, level, note) {
  const step = level.steps[S.campaignStep];
  const nav = `<button class="btn ghost small" data-act="campaignMap">← Mappa di ${esc(path.name)}</button>`;
  if (!step) return `<main class="page campaign">${nav}<div class="campaign-celebrate"><span aria-hidden="true">${level.icon}</span><span class="campaign-kicker">LIVELLO COMPLETATO</span><h1 tabindex="-1">${esc(level.title)}</h1><p>Hai imparato: ${esc(level.goal.toLowerCase())}.</p>
    <div class="campaign-end-actions">${S.campaignLevel < path.levels.length - 1 ? `<button class="btn primary big" data-act="campaignLevel" data-i="${S.campaignLevel + 1}">Prossimo livello →</button>` : '<button class="btn primary big" data-act="campaignMap">Completa il primo mondo 🏰</button>'}<button class="btn" data-act="campaignTrain">Prova una partita contro il computer</button><button class="btn ghost" data-act="campaignReplay">Rigioca il livello</button></div></div>${note}</main>`;
  const selected = S.campaignSelected || [], feedback = S.campaignFeedback;
  const success = feedback === 'correct';
  return `<main class="page campaign">${nav}<div class="campaign-exercise">
    <div class="campaign-kicker">${esc(path.name)} · LIVELLO ${S.campaignLevel + 1} · PROVA ${S.campaignStep + 1}/${level.steps.length}</div>
    <h1 tabindex="-1">${esc(step.title)}</h1><p class="campaign-lesson">${esc(step.lesson)}</p>
    ${step.table && step.table.length ? `<div class="campaign-table"><p>Sul tavolo</p><div class="campaign-cards">${step.table.map((c) => cardHTML(c)).join('')}</div></div>` : ''}
    <h2>${esc(step.prompt)}</h2>
    ${step.kind === 'cards' ? `<p class="campaign-note">Tocca ${step.rule.count === 1 ? 'una carta' : `${step.rule.count} carte`}, poi conferma. Tocca di nuovo per deselezionare.</p><div class="campaign-cards campaign-hand">${step.hand.map((c, i) => `<button class="campaign-card ${selected.includes(i) ? 'selected' : ''}" data-act="campaignSelect" data-i="${i}" aria-label="${esc(campaignCardName(c))}" aria-pressed="${selected.includes(i)}" ${success ? 'disabled' : ''}>${cardHTML(c)}<span class="campaign-card-check" aria-hidden="true">${selected.includes(i) ? '✓' : '+'}</span></button>`).join('')}</div>`
      : `<div class="campaign-answers">${step.options.map((option, i) => `<button class="btn campaign-answer ${selected.includes(i) ? 'selected' : ''}" data-act="campaignSelect" data-i="${i}" aria-pressed="${selected.includes(i)}" ${success ? 'disabled' : ''}>${esc(option)}</button>`).join('')}</div>`}
    ${feedback ? `<div class="campaign-feedback ${success ? 'correct' : ''}" role="status" tabindex="-1"><strong>${success ? 'Esatto!' : 'Proviamo ancora'}</strong><p>${esc(success ? step.explanation : step.lesson)}</p>${success ? '' : '<small>Puoi cambiare la selezione e riprovare, senza penalità.</small>'}</div>` : ''}
    <button class="btn primary big campaign-confirm" data-act="${success ? 'campaignNext' : 'campaignCheck'}" ${!success && (step.kind === 'cards' ? selected.length !== step.rule.count : selected.length !== 1) ? 'disabled' : ''}>${success ? 'Continua →' : step.kind === 'cards' ? 'Conferma le carte' : 'Conferma la risposta'}</button>
    </div>${note}</main>`;
}
Object.assign(handlers, {
  campaign() { closeModal(); S.campaignPath = null; S.campaignLevel = null; S.screen = 'campaign'; render(); window.scrollTo(0, 0); campaignFocus(); },
  campaignPaths() { S.campaignPath = null; S.campaignLevel = null; render(); window.scrollTo(0, 0); campaignFocus(); },
  campaignPath(el) { if (!Campaign.paths.some((p) => p.id === el.dataset.id)) return; S.campaignPath = el.dataset.id; S.campaignLevel = null; render(); window.scrollTo(0, 0); campaignFocus(); },
  campaignMap() { S.campaignLevel = null; render(); window.scrollTo(0, 0); campaignFocus(); },
  campaignLevel(el) {
    const path = campaignPath(), i = Number(el.dataset.i), progress = campaignCurrentProgress();
    if (!path || !Number.isInteger(i) || !path.levels[i] || (i > 0 && progress[path.id][path.levels[i - 1].id] < path.levels[i - 1].steps.length)) return;
    S.campaignLevel = i;
    const done = progress[path.id][path.levels[i].id];
    S.campaignStep = done === path.levels[i].steps.length ? 0 : done;
    S.campaignSelected = []; S.campaignFeedback = null;
    render(); window.scrollTo(0, 0); campaignFocus();
  },
  campaignReplay() { const i = S.campaignLevel; handlers.campaignLevel({ dataset: { i } }); },
  campaignSelect(el) {
    if (S.campaignFeedback === 'correct') return;
    const path = campaignPath(), step = path && path.levels[S.campaignLevel]?.steps[S.campaignStep], i = Number(el.dataset.i);
    if (!step || !Number.isInteger(i) || i < 0 || i >= (step.kind === 'cards' ? step.hand.length : step.options.length)) return;
    const selected = S.campaignSelected || [];
    S.campaignSelected = step.kind === 'choice' || step.rule.count === 1 ? (selected.includes(i) ? [] : [i]) : selected.includes(i) ? selected.filter((v) => v !== i) : selected.concat(i);
    S.campaignFeedback = null; render(); campaignFocus(`[data-act="campaignSelect"][data-i="${i}"]`);
  },
  campaignCheck() {
    const path = campaignPath(), level = path && path.levels[S.campaignLevel], step = level && level.steps[S.campaignStep];
    if (!step || S.campaignFeedback === 'correct') return;
    const correct = Campaign.check(path, step, S.campaignSelected || []);
    S.campaignFeedback = correct ? 'correct' : 'wrong';
    if (correct) { campaignSave(path, level, S.campaignStep + 1); Sound.play('turn'); }
    render(); campaignFocus('.campaign-feedback');
  },
  campaignNext() { if (S.campaignFeedback !== 'correct') return; S.campaignStep++; S.campaignSelected = []; S.campaignFeedback = null; render(); window.scrollTo(0, 0); campaignFocus(); },
  campaignTrain() {
    const path = campaignPath(); if (!path || !requireName()) return;
    S.playMode = 'bots'; S.screen = 'setup';
    handlers.pickGame({ dataset: { game: path.id } }); window.scrollTo(0, 0);
  }
});
