/* Burraco — Animazioni, statistiche sul dispositivo, effetti (burraco, coriandoli).
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Animazioni ================= */
  function rectOf(el) { return el && el.getBoundingClientRect(); }
  const discardFlights = new Map();

  function fly(fromEl, toEl, html, { delay = 0, dur = 420, hold = false } = {}) {
    if (S.prefs.anim === false) return null; // animazioni disattivate (accessibilità)
    const a = rectOf(fromEl), b = rectOf(toEl);
    if (!a || !b || !a.width || !b.width) return null;
    const el = document.createElement('div');
    el.className = 'flyer';
    el.flightEnd = performance.now() + 20 + delay + dur;
    // stessa misura delle carte sul tavolo (il tavolo la adatta allo schermo in #felt)
    const felt = $('#felt');
    if (felt && felt.style.getPropertyValue('--pw')) el.style.setProperty('--pw', felt.style.getPropertyValue('--pw'));
    el.innerHTML = html;
    document.body.appendChild(el);
    const card = el.firstElementChild;
    const w = card.offsetWidth || 50, h = card.offsetHeight || 70;
    // parte grande come la carta di partenza e arriva grande come quella d'arrivo (se sono carte)
    const isCard = (x) => x && x.classList && x.classList.contains('card');
    const s0 = isCard(fromEl) ? a.width / w : 0.8, s1 = isCard(toEl) ? b.width / w : 1;
    // .flyer ruota e scala dall'angolo in alto a sinistra: si centra la carta sul riquadro
    const pos = (r, sc) => `translate(${r.left + r.width / 2 - (w * sc) / 2}px, ${r.top + r.height / 2 - (h * sc) / 2}px) scale(${sc})`;
    el.style.transform = pos(a, s0);
    el.style.opacity = isCard(fromEl) ? '1' : '0';
    setTimeout(() => {
      if (el.dataset.landed) return; // già fatta atterrare
      el.style.transition = `transform ${dur}ms cubic-bezier(.2,.8,.2,1), opacity 150ms`;
      el.style.opacity = '1';
      el.style.transform = pos(b, s1) + (hold ? '' : ` rotate(${(Math.random() - 0.5) * 16}deg)`);
    }, 20 + delay);
    if (!hold) setTimeout(() => el.remove(), dur + delay + 120);
    return el;
  }

  /**
   * fn quando la corsa (transform) di el è davvero finita. La corsa parte al fotogramma dopo il cambio di stile:
   * con un tempo fisso, sui dispositivi lenti la carta sparirebbe prima di arrivare (piccolo salto). Il tempo
   * di riserva serve se la corsa non parte o viene interrotta.
   */
  function afterMove(el, ms, fn) {
    let done = false;
    const cancel = () => { done = true; clearTimeout(timer); el.removeEventListener('transitionend', onEnd); };
    const end = () => { if (done) return; cancel(); fn(); };
    const onEnd = (e) => { if (e.target === el && e.propertyName === 'transform') end(); };
    el.addEventListener('transitionend', onEnd);
    const timer = setTimeout(end, ms + 400);
    return cancel;
  }

  /**
   * Fa atterrare una carta in volo esattamente sopra la carta vera (target), da dove si trova adesso.
   * faceHTML: la carta si gira a metà strada (la pescata parte coperta e arriva scoperta).
   */
  function landFlyer(el, target, faceHTML) {
    if (!el || !el.isConnected) return;
    if (el.cancelLanding) el.cancelLanding();
    el.dataset.landed = '1';
    const card = el.firstElementChild;
    const w = card.offsetWidth || 50;
    // la carta vera non fa la sua animazione d'arrivo (salto, ingrandimento): ci arriva volando.
    // Va fermata prima di misurarla, altrimenti si misura la carta già alzata o ingrandita
    target.classList.remove('newc', 'dealin', 'landed');
    target.style.animation = 'none';
    void target.offsetWidth;
    // il riquadro della carta adesso (in volo, già trasformato) e quello della carta vera
    const cur = card.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const sc = t.width / w;
    // .flyer ha transform-origin in alto a sinistra: si posiziona l'angolo e si scala; sx < 1 stringe la carta
    // attorno al suo centro (per girarla)
    const at = (r, scale, sx = 1) => `translate(${r.left + (r.width * (1 - sx)) / 2}px, ${r.top}px) scale(${scale * sx}, ${scale})`;
    // ferma il volo dov'è adesso, poi riparte verso il posto giusto
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.transform = at(cur, cur.width / w);
    void el.offsetWidth;
    target.style.visibility = 'hidden';
    const finish = () => { discardFlights.delete(el); target.style.visibility = ''; target.style.animation = ''; el.remove(); };
    if (faceHTML) {
      // girata: si stringe, cambia faccia, si riapre arrivando
      const mid = { left: (cur.left + t.left) / 2, top: (cur.top + t.top) / 2, width: (cur.width + t.width) / 2, height: (cur.height + t.height) / 2 };
      el.style.transition = 'transform 100ms ease-in';
      el.style.transform = at(mid, mid.width / w, 0.05);
      afterMove(el, 100, () => {
        if (!el.isConnected) return;
        el.innerHTML = faceHTML;
        el.style.transition = 'transform 150ms ease-out';
        el.style.transform = at(t, sc);
        afterMove(el, 150, finish);
      });
    } else {
      const discard = !!target.closest('.pile');
      if (discard) {
        // Una conferma immediata non deve comprimere l'intero scarto in 170ms.
        // Mantiene inoltre la stessa scadenza se il tavolo viene ridisegnato in volo.
        if (!discardFlights.has(el)) el.flightEnd = Math.max(el.flightEnd || 0, performance.now() + 170);
        discardFlights.set(el, target);
      }
      const duration = discard ? Math.max(1, el.flightEnd - performance.now()) : 170;
      el.style.transition = `transform ${duration}ms ease-out`;
      el.style.transform = at(t, sc);
      el.cancelLanding = afterMove(el, duration, finish);
    }
  }

  // Un aggiornamento del turno può sostituire la pila prima dell'atterraggio.
  // Nasconde anche la nuova carta e prosegue dal punto attuale verso il nuovo posto.
  function reattachDiscardFlights() {
    for (const [el, target] of discardFlights) {
      if (!el.isConnected) { discardFlights.delete(el); continue; }
      if (target.isConnected) continue;
      const next = $(`.pile .card[data-card="${target.dataset.card}"]`);
      if (next) landFlyer(el, next);
      else fadeFlyers([el]);
    }
  }

  /** carte in volo che non trovano un posto (es. la carta presa nella Scopa): si dissolvono */
  function fadeFlyers(list) {
    for (const el of list) {
      if (!el || !el.isConnected) continue;
      if (el.cancelLanding) el.cancelLanding();
      discardFlights.delete(el);
      el.dataset.landed = '1';
      el.style.transition = 'opacity 180ms';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }
  }

  /** Distribuzione: qualche carta vola dal tallone a ogni giocatore, la mia mano entra carta per carta */
  function dealAnimation() {
    const g = S.game;
    if (!g || reducedMotion) return;
    const stock = $('.stock');
    if (!stock) return;
    Sound.play('shuffle');
    const seats = [...$$('.seatchip'), $('.handwrap')].filter(Boolean);
    let k = 0;
    for (let round = 0; round < 3; round++) {
      for (const el of seats) {
        const d = 450 + k * 70;
        fly(stock, el, backHTML(), { delay: d, dur: 340 });
        setTimeout(() => Sound.play('deal'), d + 300);
        k++;
      }
    }
    const cards = $$('#hand .card');
    cards.forEach((c, i) => { c.style.animationDelay = `${450 + i * 55}ms`; c.classList.add('dealin'); });
    setTimeout(() => cards.forEach((c) => { c.classList.remove('dealin'); c.style.animationDelay = ''; }), 450 + cards.length * 55 + 500);
  }

  /**
   * Mossa anticipata: al tocco la carta parte subito verso la sua destinazione, mentre la mossa viaggia fino al
   * server (con il server sul telefono servono 0,1-0,3 secondi). Le carte che lasciano la mano si nascondono
   * subito; se il server rifiuta la mossa, il tavolo si ridisegna com'era. Dopo un trascinamento la carta è già
   * arrivata col dito: niente volo, si nasconde soltanto.
   */
  function anticipate(type, extra = {}) {
    const g = S.game;
    if (!g || g.you < 0 || g.turn !== g.you) return;
    // niente anticipo se la mossa è di sicuro fuori fase (es. scartare prima di pescare)
    if (type === 'draw' ? g.phase !== 'draw' : !g.presa && g.phase !== 'play') return;
    // si anticipa solo ciò che di sicuro è valido: il server potrebbe rifiutare il resto
    const ok = anticipateSafe(g, type, extra);
    if (!ok) return;
    clearAnticipated();
    const dragged = S.justDragged && Date.now() - S.justDragged < 400;
    const anim = S.prefs.anim !== false && !reducedMotion;
    const flyers = [];
    const handCard = (id) => $(`#hand .card[data-card="${id}"]`);
    const leave = (ids, target) => {
      ids.forEach((id, i) => {
        const el = handCard(id);
        const c = g.hand.find((x) => x.id === id);
        if (!el) return;
        if (anim && !dragged && target && c) flyers.push(fly(el, target, cardHTML(c), { dur: 320, delay: i * 45, hold: true }));
        el.style.visibility = 'hidden';
      });
    };
    let ids = [];
    S.antic = { type, at: Date.now() };
    if (type === 'draw') {
      if (anim && !dragged) flyers.push(fly($('.stock .deck') || $('.stock'), $('#hand'), backHTML(), { dur: 320, hold: true }));
      Sound.play('card');
    } else if (type === 'discard') {
      ids = [extra.cardId];
      leave(ids, $('.pile .card.top') || $('.pile .pcards') || $('.pile'));
      Sound.play('card');
    } else if (type === 'meld') {
      ids = extra.cardIds || [];
      leave(ids, $('.newmeld') || $('#felt'));
    } else if (type === 'add' || type === 'swap') {
      ids = extra.cardIds || (extra.cardId != null ? [extra.cardId] : []);
      leave(ids, $(`[data-meld="${extra.meldId}"]`) || $('#felt'));
    } else if (type === 'play') {
      ids = [extra.cardId];
      leave(ids, $('.ptrick') || $('.ptable') || $('#felt'));
      Sound.play('card');
    } else { S.antic = null; return; }
    const list = flyers.filter(Boolean);
    list.forEach((el) => el.classList.add('antic')); // le carte delle mosse anticipate (per le prove)
    if (!list.length) return;
    S.anticFly = { type, ids, flyers: list, hand: g.hand.length, at: Date.now() };
    // se la risposta non arriva, le carte in volo non restano appese
    setTimeout(() => { if (S.anticFly && S.anticFly.flyers === list) clearAnticipated(); }, 2500);
  }

  /**
   * La mossa è di sicuro valida? (altrimenti niente anticipo: la carta non deve partire e poi tornare indietro)
   * - pescare dal mazzo: basta che ci siano carte
   * - scartare: non la carta appena presa dagli scarti, non l'ultima carta (chiudere ha le sue regole)
   * - calare / attaccare: solo se l'anteprima del tavolo dice che il gioco è valido
   * - raccogliere gli scarti: mai (le regole cambiano molto da gioco a gioco)
   * - giochi a prese: la carta deve essere giocabile
   */
  function anticipateSafe(g, type, extra) {
    if (type === 'draw') return !!(g.stockCount || (g.pozzetti && g.pozzetti.length));
    if (type === 'play') return !g.playable || g.playable.includes(extra.cardId);
    if (type === 'discard') return extra.cardId !== S.tookTopId && g.hand.length > 2;
    if (type !== 'meld' && type !== 'add' && type !== 'swap') return false;
    const myTeam = g.teams && g.teams.find((t) => t.members.includes(g.you));
    if (!myTeam) return false;
    const ids = extra.cardIds || (extra.cardId != null ? [extra.cardId] : []);
    if (!ids.length || g.hand.length - ids.length < 1) return false;
    const keep = S.selected;
    S.selected = new Set(ids);
    let p;
    try { p = selectionPreview(g, myTeam); } finally { S.selected = keep; }
    return type === 'meld' ? !!(p.newMeld && p.newMeld.ok) : p.canAdd.has(extra.meldId);
  }

  function clearAnticipated() {
    if (S.anticFly) fadeFlyers(S.anticFly.flyers);
    S.anticFly = null;
  }

  /**
   * Dopo ogni disegno del tavolo: se è arrivata la risposta alla mossa anticipata, le carte in volo atterrano
   * sopra le carte vere (la pescata nel suo posto nella mano, lo scarto in cima agli scarti, i giochi calati…).
   */
  function landAnticipated() {
    const a = S.anticFly, g = S.game;
    if (!a || !g) return;
    let targets;
    if (a.type === 'draw') {
      if (g.hand.length <= a.hand) return; // risposta non ancora arrivata
      targets = $$('#hand .card.newc');
    } else {
      if (a.ids.some((id) => g.hand.some((c) => c.id === id))) return; // le carte sono ancora in mano: si aspetta
      targets = a.ids.map((id) => $(`#felt .card[data-card="${id}"]`));
    }
    S.anticFly = null;
    a.flyers.forEach((el, i) => {
      const t = targets[i];
      if (!t) { fadeFlyers([el]); return; }
      const c = a.type === 'draw' ? g.hand.find((x) => String(x.id) === t.dataset.card) : null;
      landFlyer(el, t, c ? cardHTML(c) : null);
    });
  }

  function animateEvent(ev) {
    const g = S.game;
    if (!g) return;
    const mine = ev.seat === g.you;
    // la mia pescata è già volata al tocco (mossa anticipata): non si ripete
    if (mine && S.antic && Date.now() - S.antic.at < 4000
      && ((ev.type === 'draw' && S.antic.type === 'draw') || (ev.type === 'pile' && S.antic.type === 'takePile'))) { S.antic = null; return; }
    const seatEl = mine ? $('#hand') : $(`.seatchip[data-seat="${ev.seat}"]`);
    const stock = $('.stock .deck');
    const pile = $('.pile .pcards');
    if (ev.type === 'draw' && !mine) fly(stock, seatEl, backHTML());
    else if (ev.type === 'draw' && mine) fly(stock, $(`#hand .card.newc`) || seatEl, backHTML());
    else if (ev.type === 'discard' && !mine) {
      const top = $('.pile .card.top');
      const c = g.discard[g.discard.length - 1];
      // Misura il posto definitivo: .landed sposta e ingrandisce temporaneamente
      // la carta, quindi il volo punterebbe fuori dalla pila. Niente rotazione
      // casuale alla fine: la copia deve coincidere con la carta che sostituisce.
      if (top) { top.classList.remove('landed'); top.style.visibility = 'hidden'; }
      const flyer = fly(seatEl, top || pile, c ? cardHTML(c) : backHTML(), { dur: 380, hold: true });
      if (flyer && top) landFlyer(flyer, top);
      else if (flyer) afterMove(flyer, 400, () => flyer.remove());
      else if (top) top.style.visibility = '';
    } else if (ev.type === 'pile') {
      for (let i = 0; i < Math.min(ev.count || 1, 5); i++) fly(pile, seatEl, backHTML(), { delay: i * 60 });
    } else if (ev.type === 'pozzetto') {
      for (let i = 0; i < 4; i++) fly($('.pozz .pz') || stock, seatEl, backHTML(), { delay: i * 70 });
    }
  }

  /* ---------- Statistiche personali (salvate sul dispositivo) ---------- */
  const STATS0 = { games: 0, wins: 0, hands: 0, handsWon: 0, burraco: 0, closures: 0, bestHand: null, points: 0 };
  function loadStats() { return { ...STATS0, ...store.get('bur_stats', {}) }; }

  /** Conta ogni fine smazzata / fine partita una sola volta, anche ricaricando la pagina */
  function recordStats(room, game) {
    if (!room || room.offline || room.onDevice || room.tutorial || room.progressEligible === false
      || (room.progressEligible !== true && (room.seats || []).some((s) => s && s.isBot))) return;
    const hr = game.handResult;
    if (!hr || game.you < 0) return;
    const seen = store.get('bur_stats_seen', []);
    const key = `${room.code}:${game.history.length}:${hr.scores.join(',')}`;
    if (seen.includes(key)) return;
    const st = loadStats();
    const mine = hr.teams.find((t) => t.members.includes(game.you));
    if (mine) {
      st.hands++;
      if (mine.total === Math.max(...hr.teams.map((t) => t.total))) st.handsWon++;
      st.burraco += mine.burraco.length;
      st.points += mine.total;
      st.bestHand = st.bestHand == null ? mine.total : Math.max(st.bestHand, mine.total);
    }
    if (hr.reason === 'close' && hr.closer === game.you) st.closures++;
    if (game.over) { st.games++; if (game.winners.includes(game.you)) st.wins++; }
    store.set('bur_stats', st);
    store.set('bur_stats_seen', seen.concat(key).slice(-100));
  }

  const PRESET_NAMES = { classico: 'Classico', reale: 'Reale', aberto: 'Aberto', fechado: 'Fechado', personalizzate: 'Personalizzate' };
  const fmtDate = (t) => new Date(t).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });

  /** Sfida del giorno: variante di oggi, il mio risultato e la classifica */
  async function dailyModal() {
    const r = await emit('daily');
    if (!r.ok) return;
    S.dailyRules = r.rules;
    const day = new Date(r.date + 'T12:00:00').toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
    const mine = r.mine
      ? (r.mine.score != null
        ? `<div class="winner">Hai fatto ${signed(r.mine.score)} punti${r.myPos ? ` · ${r.myPos}° posto` : ''}</div><p class="muted" style="text-align:center">Torna domani per una nuova sfida!</p>`
        : '<p class="muted" style="text-align:center">Hai già usato il tentativo di oggi. Torna domani!</p>')
      : '<div class="row"><button class="btn primary grow big" data-act="startDaily">▶ Gioca la sfida</button></div>';
    const rows = r.top.map((x) => `<tr class="${x.me ? 'meRow' : ''}"><td>${['🥇', '🥈', '🥉'][x.pos - 1] || x.pos}</td><td style="text-align:left">${esc(x.name)}${x.me ? ' (tu)' : ''}</td><td><b>${signed(x.score)}</b></td></tr>`).join('');
    openModal('daily', `<div class="result"><h2>📅 Sfida del giorno</h2><p class="muted">${esc(day)}</p>
      <div class="dailycard"><b class="dtitle">${esc(r.title)}</b>
        <p>Una sola smazzata contro il computer <b>difficile</b>, con <b>le stesse carte per tutti</b>. ${r.game === 'scala40' ? 'Vince chi resta con meno penalità in mano.' : 'Vince chi fa più punti.'} Hai un solo tentativo.</p>
        <button class="btn small" data-act="dailyRules">📜 Regole della sfida</button></div>
      ${mine}
      <h3>Classifica di oggi${r.players ? ` · ${r.players} ${r.players === 1 ? 'giocatore' : 'giocatori'}` : ''}</h3>
      ${rows ? `<table>${rows}</table>` : '<p class="muted">Nessuno ha ancora finito la sfida di oggi: sii il primo!</p>'}</div>`);
  }

  /** Bacheca dei trofei: sbloccati a colori, gli altri in grigio con l'avanzamento */
  function trophiesHTML(list) {
    const got = list.filter((t) => t.at).length;
    return `<h3>🏆 Trofei <span class="muted small">${got} su ${list.length}</span></h3><div class="trophies">${list.map((t) => `
      <div class="trophy ${t.at ? 'got' : ''}" title="${esc(t.desc)}"><i>${esc(t.e)}</i><b>${esc(t.name)}</b><span>${esc(t.desc)}</span>
        ${t.progress ? `<em class="tprog"><u style="width:${Math.round((t.progress.now / t.progress.goal) * 100)}%"></u></em><span class="tnum">${t.progress.now}/${t.progress.goal}</span>` : ''}
        ${t.at ? `<span class="tdate">${new Date(t.at).toLocaleDateString(LOCALE)}</span>` : ''}</div>`).join('')}</div>`;
  }

  function statsTable(st, gid) {
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const row = (l, v) => `<tr><td>${l}</td><td><b>${v}</b></td></tr>`;
    if (['scopa', 'briscola', 'briscola5', 'tressette', 'rubamazzetto'].includes(gid)) {
      return `<table>
      ${st.elo ? row('Grado', rankHTML(st.elo)) + (playerRank(st.eloMax).min > playerRank(st.elo).min ? row('Grado migliore', rankHTML(st.eloMax)) : '') : ''}${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
      ${row('Smazzate giocate', st.hands)}${row('Smazzate vinte', `${st.handsWon} (${pct(st.handsWon, st.hands)})`)}
    </table>`;
    }
    if (gid === 'scala40') {
      return `<table>
      ${st.elo ? row('Grado', rankHTML(st.elo)) + (playerRank(st.eloMax).min > playerRank(st.elo).min ? row('Grado migliore', rankHTML(st.eloMax)) : '') : ''}${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
      ${row('Smazzate giocate', st.hands)}${row('Chiusure', `${st.closures} (${pct(st.closures, st.hands)})`)}
      ${row('Penalità media a smazzata', st.avgHand == null ? '—' : -st.avgHand)}
    </table>`;
    }
    return `<table>
      ${st.elo ? row('Grado', rankHTML(st.elo)) + (playerRank(st.eloMax).min > playerRank(st.elo).min ? row('Grado migliore', rankHTML(st.eloMax)) : '') : ''}${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
      ${row('Smazzate giocate', st.hands)}${row('Smazzate vinte', `${st.handsWon} (${pct(st.handsWon, st.hands)})`)}
      ${row(gid === 'canasta' ? 'Canaste fatte' : 'Burraco fatti', st.burraco)}${row('Chiusure', st.closures)}
      ${row('Miglior smazzata', st.bestHand == null ? '—' : st.bestHand)}${row('Media punti a smazzata', st.avgHand == null ? '—' : st.avgHand)}
    </table>`;
  }

  function historyHTML(list) {
    list = list.filter((h) => AvailableGames.enabled(h.game || 'burraco'));
    if (!list.length) return '<p class="muted">Nessuna partita completata.</p>';
    return list.map((h) => `<div class="hist ${h.won ? 'won' : 'lost'}">
      <span class="hres">${h.won ? '🏆' : '—'}</span>
      <span class="grow"><b>${h.won ? 'Vinta' : 'Persa'}</b> · ${fmtDate(h.at)} · ${({ scala40: 'Scala 40', ramino: 'Ramino', canasta: 'Canasta', scopa: 'Scopa', briscola: 'Briscola', tressette: 'Tressette', rubamazzetto: 'Rubamazzetto', briscola5: 'Briscola in 5' })[h.game] || PRESET_NAMES[h.preset] || h.preset}${h.hands ? ` · ${h.hands} smazzate` : ''}<br>
      <span class="muted small">${h.teams.map((t) => `${t.mine ? '<b>' : ''}${t.names.map(esc).join(' & ')} ${t.score}${t.mine ? '</b>' : ''}`).join(' · ')}</span></span></div>`).join('');
  }

  /** Grafici delle statistiche: andamento delle vittorie, vittorie per gioco, avversari */
  function chartsHTML(tl) {
    tl = tl.filter((h) => AvailableGames.enabled(h.g || 'burraco'));
    if (tl.length < 2) return '';
    const last = tl.slice(-40);
    // andamento: percentuale di vittorie cumulata, partita dopo partita
    const W = 320, H = 120, P = 18;
    let won = tl.length - last.length ? tl.slice(0, tl.length - last.length).filter((x) => x.w).length : 0;
    let played = tl.length - last.length;
    const pts = last.map((x, i) => { played++; won += x.w; return { x: P + (i * (W - 2 * P)) / Math.max(1, last.length - 1), y: H - P - ((won / played) * (H - 2 * P)), w: x.w }; });
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const pct = Math.round((won / played) * 100);
    const line = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento delle vittorie: ${pct}%">
      ${[0, 50, 100].map((v) => { const y = H - P - (v / 100) * (H - 2 * P); return `<line x1="${P}" x2="${W - P}" y1="${y}" y2="${y}" class="grid"/><text x="2" y="${y + 3}" class="lbl">${v}%</text>`; }).join('')}
      <path d="${path}" class="trend"/>
      ${pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" class="${p.w ? 'win' : 'loss'}"/>`).join('')}</svg>`;
    // vittorie per gioco
    const names = { burraco: '🃏 Burraco', scala40: '🂡 Scala 40', ramino: '🧩 Ramino', canasta: '🎴 Canasta', scopa: '🧹 Scopa', briscola: '🍷 Briscola', tressette: '🂱 Tressette', rubamazzetto: '🃁 Rubamazzetto', briscola5: '🍷 Briscola in 5' };
    const per = {};
    for (const x of tl) { per[x.g] = per[x.g] || { n: 0, w: 0 }; per[x.g].n++; per[x.g].w += x.w; }
    const maxN = Math.max(...Object.values(per).map((v) => v.n));
    const bars = Object.entries(per).sort((a, b) => b[1].n - a[1].n).map(([gid, v]) => `<div class="cbar"><span class="cname">${names[gid] || gid}</span>
      <span class="ctrack"><i class="cn" style="width:${(v.n / maxN) * 100}%"></i><i class="cw" style="width:${(v.w / maxN) * 100}%"></i></span><span class="cval">${v.w}/${v.n}</span></div>`).join('');
    // avversari più frequenti
    const opp = {};
    for (const x of tl) for (const o of x.o || []) { opp[o] = opp[o] || { n: 0, w: 0 }; opp[o].n++; opp[o].w += x.w; }
    const rows = Object.entries(opp).sort((a, b) => b[1].n - a[1].n).slice(0, 6)
      .map(([o, v]) => `<tr><td style="text-align:left">${esc(o)}</td><td>${v.n}</td><td><b>${Math.round((v.w / v.n) * 100)}%</b></td></tr>`).join('');
    return `<h3>📈 Andamento <span class="muted small">ultime ${last.length} partite · ${pct}% vinte in tutto</span></h3>${line}
      <p class="muted small"><span class="dot win"></span> vinta <span class="dot loss"></span> persa · la linea è la percentuale di vittorie</p>
      <h3>🎮 Per gioco <span class="muted small">vinte / giocate</span></h3><div class="cbars">${bars}</div>
      ${rows ? `<h3>⚔️ Contro chi</h3><table><tr><th style="text-align:left">Avversario</th><th>Partite</th><th>Le vinci</th></tr>${rows}</table>` : ''}`;
  }

  /** Statistiche divise per gioco (una tabella per gioco giocato) */
  function byGameHTML(byGame, total) {
    const games = Object.entries(byGame || {}).filter(([id]) => AvailableGames.enabled(id));
    if (!games.length) return total ? statsTable(total) : '<p class="muted">Gioca la tua prima smazzata per vedere le statistiche.</p>';
    const names = { burraco: '🃏 Burraco', scala40: '🂡 Scala 40', ramino: '🧩 Ramino', canasta: '🎴 Canasta', scopa: '🧹 Scopa', briscola: '🍷 Briscola', tressette: '🂱 Tressette', rubamazzetto: '🃁 Rubamazzetto', briscola5: '🍷 Briscola in 5' };
    return games.map(([gid, st]) => `<h3>${names[gid] || gid}</h3>${statsTable(st, gid)}`).join('');
  }

  async function statsModal() {
    if (OFFLINE || !S.social || !S.social.nick) { localStatsModal(); return; }
    const r = await emit('myStats');
    if (!r.ok) return;
    openModal('stats', `<div class="result"><h2>📊 Le tue statistiche</h2>
      <button class="btn small" data-act="rankedProfile">Profilo competitivo</button>
      ${r.level ? `<div class="lvlbox">${lvlHTML(r.level.level)}<div><b>Livello ${r.level.level}</b>
        <em class="xpbar"><u style="width:${Math.round((r.level.into / r.level.need) * 100)}%"></u></em>
        <span class="muted small">${r.level.into}/${r.level.need} punti esperienza al livello ${r.level.level + 1} · partite, vittorie, burraco, chiusure e trofei fanno salire</span></div></div>` : ''}
      ${chartsHTML(r.timeline || [])}
      ${byGameHTML(r.byGame, r.stats)}
      ${r.trophies ? trophiesHTML(r.trophies) : ''}
      <h3>Ultime partite</h3>${historyHTML(r.history)}
      <p class="muted small">Le statistiche sono salvate sul server: ti seguono anche se cambi dispositivo.</p></div>`);
  }

  function localStatsModal() {
    const st = loadStats();
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const row = (l, v) => `<tr><td>${l}</td><td><b>${v}</b></td></tr>`;
    openModal('stats', `<div class="result"><h2>📊 Le tue statistiche</h2>
      ${st.hands ? `<table>
        ${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
        ${row('Smazzate giocate', st.hands)}${row('Smazzate vinte', `${st.handsWon} (${pct(st.handsWon, st.hands)})`)}
        ${row('Burraco fatti', st.burraco)}${row('Chiusure', st.closures)}
        ${row('Miglior smazzata', st.bestHand)}${row('Media punti a smazzata', Math.round(st.points / st.hands))}
      </table>` : '<p class="muted">Gioca la tua prima smazzata per vedere le statistiche.</p>'}
      <p class="muted small">Le statistiche sono salvate solo su questo dispositivo.</p>
      ${st.hands ? '<button class="btn small danger" data-act="resetStats">Azzera statistiche</button>' : ''}</div>`);
  }

  /* ---------- Effetti: burraco e coriandoli ---------- */
  const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burracoFx(fx) {
    const el = $(`.meld[data-mid="${fx.meldId}"]`);
    if (el) { el.classList.add('shine'); setTimeout(() => el.classList.remove('shine'), 2600); }
    const b = document.createElement('div');
    b.className = 'bigtoast' + (fx.mine ? ' mine' : '');
    b.innerHTML = `<b>${esc(fx.label.toUpperCase())}!</b><span>+${fx.bonus}</span>`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2300);
    if (fx.mine) confetti(60, 1600);
  }

  /**
   * Coriandoli di festa: due «cannoni» dagli angoli in basso, pezzi di forme diverse (strisce, cerchi e piccoli
   * semi delle carte dorati) che ondeggiano in 3D, scintille; disegnati nitidi anche sugli schermi ad alta densità.
   */
  function confetti(count = 160, duration = 3200) {
    if (reducedMotion || S.prefs.anim === false) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    const colors = ['#f2c14e', '#ffd86b', '#e53935', '#43a047', '#1e88e5', '#ffffff', '#8e63d6', '#ff8a65'];
    const suits = ['♠', '♥', '♦', '♣'];
    const ps = Array.from({ length: count }, (_, i) => {
      const left = i % 2 === 0;
      const ang = (left ? -1 : 1) * (Math.PI / 2 - (0.25 + Math.random() * 0.55)); // verso l'alto e il centro
      const sp = 11 + Math.random() * 9;
      const kind = Math.random() < 0.12 ? 'suit' : Math.random() < 0.3 ? 'dot' : 'strip';
      return {
        x: left ? -10 : W + 10, y: H * 0.92, vx: Math.sin(ang) * sp * -1 * (left ? -1 : 1) * (left ? 1 : -1), vy: -Math.cos(ang) * sp,
        r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.35, flip: Math.random() * Math.PI * 2, vf: 0.12 + Math.random() * 0.2,
        w: 6 + Math.random() * 6, h: 9 + Math.random() * 9, c: kind === 'suit' ? '#f2c14e' : colors[i % colors.length], kind,
        s: suits[i % 4], delay: Math.random() * 260,
      };
    });
    // spinta: in alto fino a sopra il titolo e verso il centro dello schermo
    for (const p of ps) { p.vy = -(Math.sqrt(H) * 0.62 + Math.random() * 9); p.vx = (p.x < 0 ? 1 : -1) * (2.5 + Math.random() * W / 70); }
    const sparks = Array.from({ length: 26 }, () => ({ x: W * (0.2 + Math.random() * 0.6), y: H * (0.15 + Math.random() * 0.4), t: Math.random() * 900 }));
    const t0 = performance.now();
    (function frame(t) {
      const el = t - t0, k = el / duration;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.72) / 0.28);
      for (const p of ps) {
        if (el < p.delay) continue;
        p.vy += 0.3; p.vx *= 0.988; p.vy *= 0.994; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.flip += p.vf;
        if (p.vy > 2.2) { p.vy = 2.2 + (p.vy - 2.2) * 0.9; p.x += Math.sin(p.flip) * 0.8; } // cadono ondeggiando
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        const fs = Math.cos(p.flip); // rotazione in 3D: la faccia si stringe e si allarga
        ctx.fillStyle = p.c;
        if (p.kind === 'strip') { ctx.scale(1, fs); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        else if (p.kind === 'dot') { ctx.scale(fs, 1); ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.scale(fs, 1); ctx.font = `bold ${p.h + 6}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.s, 0, 0); }
        ctx.restore();
      }
      // scintille dorate che brillano qua e là
      for (const sp of sparks) {
        const a = Math.sin(Math.max(0, el - sp.t) / 140);
        if (el < sp.t || a <= 0) continue;
        ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = `rgba(255,236,170,${a})`;
        ctx.fillRect(-1, -7 * a, 2, 14 * a); ctx.fillRect(-7 * a, -1, 14 * a, 2); ctx.restore();
      }
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

