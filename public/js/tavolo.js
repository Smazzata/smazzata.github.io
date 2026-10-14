/* Burraco — Tavolo di gioco: giochi, mano, anteprima delle mosse, riepiloghi.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Tavolo di gioco ================= */
  function teamName(g, t) {
    return t.members.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & ');
  }

  /* ---------- Anteprima delle mosse (stessa logica del server) ---------- */
  const M = window.BurracoMelds;
  function meldCfg(g) {
    const r = g.cfg.rules;
    return { allowSets: r.allowSets, maxWild: r.maxWild, aceBothEnds: r.aceBothEnds };
  }

  /** Cosa si può fare con le carte selezionate: giochi a cui attaccarle e validità di una nuova calata */
  function selectionPreview(g, myTeam) {
    const out = { canAdd: new Set(), newMeld: null };
    if (!myTeam || g.turn !== g.you) return out;
    if (S.room && S.room.aids === false) return out; // aiuti visivi disattivati dall'host
    const sel = orderedHand().filter((c) => S.selected.has(c.id));
    const closedDraw = g.phase === 'draw' && g.cfg.pile === 'closed' && g.discard.length;
    if (g.phase !== 'play' && !closedDraw) return out;
    const cards = closedDraw ? [g.discard[g.discard.length - 1], ...sel] : sel;
    if (!sel.length) return out;
    const cfg = meldCfg(g);
    for (const m of myTeam.melds) if (M.analyzeMeld(m.cards.concat(cards), cfg, m.type)) out.canAdd.add(m.id);
    if (cards.length >= 3) {
      const groups = M.partitionMelds(cards, cfg);
      let ok = !!groups;
      if (groups && g.cfg.rules.noDuplicateSets) {
        const ranks = myTeam.melds.filter((m) => m.type === 'set').map((m) => m.cards.find((c) => !M.isWild(c)).r);
        for (const an of groups.filter((x) => x.type === 'set')) { if (ranks.includes(an.rank)) ok = false; ranks.push(an.rank); }
      }
      let label = groups ? (groups.length > 1 ? `${groups.length} giochi` : groups[0].type === 'seq' ? 'scala' : 'tris') : '';
      // da vulnerabili, senza giochi calati, servono abbastanza punti già in questa calata
      const vul = g.cfg.vulnerability;
      const myScore = g.scores[g.you];
      if (ok && vul && !myTeam.melds.length && myScore >= g.cfg.target * vul.ratio) {
        const v = g.cfg.values;
        const pts = cards.reduce((sum, c) => sum + (c.r === 0 ? v.joker : c.r === 2 ? v.two : c.r === 1 ? v.ace : c.r >= 8 ? v.high : v.low), 0);
        if (pts < vul.min) { ok = false; label = `${pts}/${vul.min} punti`; }
      }
      out.newMeld = { ok, label };
    }
    return out;
  }

  function meldHTML(m, mine, preview) {
    const short = { clean: 'Pulito', dirty: 'Sporco', semi: 'Semi', real13: '+500', real14: '+1000' }[m.kind] || '';
    const attrs = `data-mid="${m.id}"` + (mine ? ` data-meld="${m.id}" data-drop="meld"` : '');
    const can = preview && preview.canAdd.has(m.id) ? 'can-add' : '';
    const hint = S.hint && S.hint.meldId === m.id ? 'hinted' : '';
    const fr = S.freshCards || new Set();
    return `<div class="meld ${m.kind ? 'burraco ' + m.kind : ''} ${S.flashMeld === m.id ? 'flash' : ''} ${m.type === 'set' ? 'set' : ''} ${can} ${hint}" ${attrs} title="${esc(m.label || '')}">
      ${m.cards.map((c, i) => {
        // in modalità compatta si vedono solo le prime 2 carte e l'ultima
        const mid = m.cards.length >= 5 && i >= 2 && i < m.cards.length - 1;
        const hiddenFresh = mid && i === 2 && m.cards.slice(2, -1).some((x) => fr.has(x.id));
        const more = mid && i === 2 ? `<span class="more ${hiddenFresh ? 'fresh' : ''}">+${m.cards.length - 3}</span>` : '';
        return more + cardHTML(c, `mini ${m.wild[i] ? 'wildmark' : 'natural'} ${mid ? 'mid' : ''} ${fr.has(c.id) ? 'fresh' : ''}`);
      }).join('')}
      ${m.kind ? `<span class="tag">${short}</span>` : `<span class="cnt">${m.length}</span>`}</div>`;
  }

  function statusText(g) {
    const me = g.you;
    if (g.phase === 'handEnd') return g.over ? 'Partita terminata' : 'Smazzata terminata';
    const cur = g.players[g.turn];
    if (g.turn !== me) return `Turno di <b>${esc(cur.name)}</b>${g.lastTurn ? ' · <b>ultimo giro</b>' : ''}`;
    if (g.phase === 'draw') {
      if (g.mustDraw) return 'Tocca a te: tocca il <b>tallone</b> per pescare';
      if (g.cfg.pile === 'closed' && g.discardCount) return 'Tocca il <b>tallone</b>, oppure seleziona carte da combinare con la cima e tocca gli <b>scarti</b>';
      return 'Tocca a te: tocca il <b>tallone</b> o gli <b>scarti</b>';
    }
    const myTeam = g.teams.find((t) => t.members.includes(me));
    const sel = S.selected.size;
    let tip = sel === 1 ? 'Tocca gli <b>scarti</b> per scartare, o un tuo gioco per attaccare'
      : sel >= 2 ? 'Tocca <b>＋</b> per calare o un tuo gioco per attaccare'
        : 'Seleziona le carte: cala, attacca e poi <b>scarta</b>';
    if (myTeam && myTeam.canClose) tip = 'Puoi <b>chiudere</b>: cala tutto e scarta l\'ultima carta';
    else if (g.hand.length <= 3 && myTeam && myTeam.pozzettoTaken) tip += ` · per chiudere serve ${g.cfg.closeNeeds === 'clean' ? `una ${g.cfg.burracoName} pulita` : `un ${g.cfg.burracoName}`}`;
    if (g.lastTurn) tip += ' · <b>ultimo turno!</b>';
    return tip;
  }

  /** Avviso di fine tallone: quanti giri restano prima che la smazzata finisca */
  function stockWarning(g) {
    if (g.phase === 'handEnd') return null;
    if (g.lastTurn) return { level: 3, text: '🔔 Ultimo turno della smazzata!' };
    const r = g.cfg.rules;
    if (r.stockEnd === 'mortoToStock' && g.pozzetti.length) return null; // un pozzetto ricaricherà il tallone
    const draws = r.stockEnd === 'twoLeft' ? g.stockCount - 2 : g.stockCount;
    const rounds = Math.ceil(draws / g.n);
    if (rounds <= 1) return { level: 2, text: `⚠️ Ultimo giro: ${draws === 1 ? 'resta 1 pescata' : `restano ${draws} pescate`}` };
    if (rounds <= 2) return { level: 1, text: `⚠️ Tallone quasi finito: ~${rounds} giri` };
    return null;
  }

  /** ultima riga significativa della cronaca */
  /** Mosse degli altri dopo la mia ultima giocata (per evidenziarle e riassumerle) */
  function freshEvents(g) {
    if (g.you < 0 || !g.events) return [];
    let myLast = 0;
    for (const e of g.events) if (e.seat === g.you) myLast = e.n;
    return g.events.filter((e) => e.seat !== g.you && e.n > myLast);
  }

  /** Riassunto, una riga per giocatore: "Gegè: raccoglie 3 scarti · cala 4 · scarta K♦" */
  function recapHTML(g, fresh) {
    const bySeat = new Map();
    for (const e of fresh) {
      if (!bySeat.has(e.seat)) bySeat.set(e.seat, []);
      const parts = bySeat.get(e.seat);
      const k = (e.cardIds || []).length;
      const prevPart = parts[parts.length - 1];
      if (e.type === 'pile') parts.push(e.count === 1 ? 'raccoglie lo scarto' : `raccoglie <b>${e.count}</b> scarti`);
      else if (e.type === 'meld') {
        const ids = e.meldIds || [e.meldId];
        if (prevPart && prevPart.melds) prevPart.melds.push(...ids); else parts.push({ melds: ids.slice() });
      } else if (e.type === 'add') {
        if (prevPart && prevPart.k != null) prevPart.k += k; else parts.push({ k });
      } else if (e.type === 'pozzetto') parts.push(`prende il ${esc(g.cfg.pozzettoName)}`);
      else if (e.type === 'discard' && e.card) {
        const red = e.card.s === 'H' || e.card.s === 'D';
        parts.push(`scarta <span class="${red ? 'rs' : ''}">${e.card.r === 0 ? 'Jolly' : rankName(e.card.r) + SUIT[e.card.s]}</span>`);
      }
    }
    const allMelds = g.teams.flatMap((t) => t.melds);
    const say = (x) => {
      if (typeof x === 'string') return x;
      if (x.k != null) return `attacca <b>${x.k}</b> ${x.k === 1 ? 'carta' : 'carte'}`;
      if (x.melds.length > 1) return `cala <b>${x.melds.length}</b> giochi`;
      const m = allMelds.find((mm) => mm.id === x.melds[0]);
      return `cala ${m && m.type === 'set' ? 'un <b>tris</b>' : 'una <b>scala</b>'}`;
    };
    const lines = [...bySeat].filter(([, parts]) => parts.length)
      .map(([seat, parts]) => `<div><b>${esc(g.players[seat].name)}</b>: ${parts.map(say).join(' · ')}</div>`);
    return lines.length ? `<div class="recap" data-act="log" title="Cosa hanno fatto gli altri (tocca per la cronaca)">${lines.join('')}</div>` : '';
  }

  function lastMove(g) {
    for (let i = g.log.length - 1; i >= 0; i--) {
      if (!g.log[i].startsWith('—')) return g.log[i];
    }
    return 'La smazzata è iniziata: buon divertimento!';
  }

  /** posizione al tavolo degli altri giocatori rispetto a me */
  function seatPositions(g) {
    if (g.you < 0) return g.players.map((p) => [p.seat, 'top']);
    const me = g.you;
    const rel = (k) => (me + k) % g.n;
    if (g.n === 4) return [[rel(1), 'left'], [rel(2), 'top'], [rel(3), 'right']];
    if (g.n === 3) return [[rel(1), 'left'], [rel(2), 'right']];
    return [[rel(1), 'top']];
  }

  function seatHTML(g, seat, pos, myTeam) {
    const p = g.players[seat];
    const t = g.teams.find((x) => x.members.includes(seat));
    const partner = myTeam && myTeam.members.includes(seat);
    const turn = g.turn === seat && g.phase !== 'handEnd';
    const fan = Array.from({ length: Math.min(p.handCount, 7) }, (_, i) => backHTML('tiny', `style="--i:${i}"`)).join('');
    const rs = S.room && S.room.seats[seat];
    const off = rs && !rs.isBot && !rs.connected;
    return `<div class="seatchip pos-${pos} ${turn ? 'turn' : ''} ${partner ? 'partner' : ''} ${off ? 'offline' : ''}" data-seat="${seat}">
      ${avatarHTML(p.name, seat, p.isBot, rs && rs.avatar)}
      <div class="sinfo"><b>${esc(p.name)} ${lvlHTML(rs && rs.level)}</b>
        <span class="smeta">${off ? '📴 ' : ''}${partner ? '<span title="compagno">🤝</span> ' : ''}${p.handCount} carte${t && t.pozzettoTaken ? ` <span class="pz-ok" title="${g.cfg.pozzettoName} preso">✓ ${g.cfg.pozzettoName}</span>` : ''}</span></div>
      <div class="minifan">${fan}</div>
      ${turn ? (S.turnEnd ? '<span class="thinking cdchip" data-cd></span>' : '<span class="thinking"><i></i><i></i><i></i></span>') : ''}
    </div>`;
  }

  function gameHTML() {
    const g = S.game;
    const r = S.room;
    const me = g.you;
    const myTurn = g.turn === me && g.phase !== 'handEnd';
    const myTeam = g.teams.find((t) => t.members.includes(me));
    const P = g.cfg.pozzettoName;
    const canDraw = myTurn && g.phase === 'draw';
    const playing = myTurn && g.phase === 'play';
    // carte giocate dagli altri dopo la mia ultima mossa: restano evidenziate finché non gioco
    const fresh = freshEvents(g);
    S.freshCards = new Set(fresh.flatMap((e) => e.cardIds || []));

    // punteggi
    let scores;
    if (g.n === 3) scores = g.players.map((p) => `<span class="sc ${p.seat === me ? 'me' : ''}">${esc(p.seat === me ? 'Tu' : p.name)} <b>${g.scores[p.seat]}</b></span>`).join('');
    else scores = g.teams.map((t) => `<span class="sc ${t === myTeam ? 'me' : ''}">${esc(teamName(g, t))} <b>${g.scores[t.members[0]]}</b></span>`).join('');

    const seats = seatPositions(g).map(([s, pos]) => seatHTML(g, s, pos, myTeam)).join('');

    // centro: tallone, pozzetti, scarti
    const pileAll = g.cfg.pile === 'open' ? g.discard : g.discard.slice(-1);
    const pileCards = pileAll.map((c, i) => {
      const top = i === pileAll.length - 1;
      return cardHTML(c, `${top ? 'top' : ''} ${top && S.animEvent && S.animEvent.type === 'discard' ? 'landed' : ''}`, top && canDraw && !g.mustDraw ? 'data-drag="pile"' : '');
    }).join('');
    const stockLayers = Math.min(3, Math.ceil(g.stockCount / 15));
    const center = `<div class="center">
      <div class="stock ${canDraw && (g.stockCount || g.pozzetti.length) ? 'active' : ''} ${S.hint && S.hint.type === 'draw' ? 'hinted' : ''}" ${canDraw ? 'data-act="draw" data-drag="stock"' : ''}>
        <div class="deck">${g.stockCount ? Array.from({ length: stockLayers }, (_, i) => backHTML('', `style="--l:${i}"`)).join('') : '<div class="card slot"></div>'}</div>
        <span class="lbl ${stockWarning(g) ? 'lowstock' : ''}">Tallone · ${g.stockCount}</span>
      </div>
      ${g.pozzetti.length ? `<div class="pozz"><div class="pz">${g.pozzetti.map((n, i) => backHTML('', `style="--l:${i}"`)).join('')}</div><span class="lbl">${g.pozzetti.length === 1 ? cap(P) : (P === 'morto' ? 'Morti' : 'Pozzetti')}</span></div>` : ''}
      <div class="pile ${(canDraw && g.discardCount && !g.mustDraw) || (playing && S.selected.size === 1) ? 'active' : ''} ${g.cfg.pile} ${S.hint && (S.hint.type === 'takePile' || S.hint.type === 'discard') ? 'hinted' : ''}" data-drop="discard" ${canDraw && !g.mustDraw ? 'data-act="takePile"' : playing ? 'data-act="discardSel"' : ''}>
        <div class="pcards">${pileCards || '<div class="card slot"></div>'}</div>
        <span class="lbl">Scarti${g.discardCount ? ' · ' + g.discardCount : ''}${g.cfg.pile === 'closed' ? ' (chiusi)' : ''}</span>
      </div>
    </div>`;

    // giochi delle squadre
    const preview = selectionPreview(g, myTeam);
    const nm = preview.newMeld;
    const newSlotText = nm ? (nm.ok ? `✓ Cala<br>${nm.label}` : nm.label.includes('punti') ? `✗ Servono<br>${nm.label}` : '✗ Non<br>valida') : '＋ Nuova<br>combinazione';
    const zone = (t) => {
      const mine = t === myTeam;
      const label = mine ? (t.members.length > 1 ? `Noi · ${esc(teamName(g, t))}` : 'I tuoi giochi') : esc(teamName(g, t));
      const flags = [t.pozzettoTaken ? `${P} preso` : `${P} da prendere`];
      if (t.canClose) flags.push('può chiudere');
      const targetable = mine && (playing || (canDraw && g.cfg.pile === 'closed'));
      const newSlot = mine && (playing || (canDraw && g.cfg.pile === 'closed'))
        ? `<div class="meld newmeld ${nm ? (nm.ok ? 'ok' : 'bad') : ''} ${S.hint && S.hint.type === 'meld' ? 'hinted' : ''}" data-drop="newmeld" ${playing ? 'data-act="meld"' : ''}><span>${newSlotText}</span></div>` : '';
      return `<div class="teamzone ${mine ? 'mine' : 'theirs'}">
        <div class="hdr"><b>${label}</b><span>${flags.join(' · ')}</span></div>
        <div class="melds ${targetable ? 'targetable' : ''}">${t.melds.map((m) => meldHTML(m, mine, mine ? preview : null)).join('')}${newSlot}${!t.melds.length && !newSlot ? '<span class="empty">Nessuna combinazione</span>' : ''}</div>
      </div>`;
    };
    const others = g.teams.filter((t) => t !== myTeam).map(zone).join('');
    const mineZone = myTeam ? zone(myTeam) : '';

    // niente pulsanti grandi: si gioca toccando/trascinando sul tavolo; restano piccole icone
    const sel = S.selected.size;
    let actions = '';
    if (g.phase === 'handEnd') actions = '<button class="btn primary small" data-act="result">Risultati</button>';
    if (myTurn && r.hints) actions += '<button class="ico" data-act="hint" title="Suggerimento">💡</button>';
    if (g.you >= 0) actions = '<button class="ico" data-act="reactPicker" title="Reazioni">😊</button>' + actions;
    if (sel) actions += '<button class="ico" data-act="clearSel" title="Deseleziona">✕</button>';
    const sortLbl = { rank: '⇅ Valore', suit: '⇅ Seme', smart: '⇅ Giochi' }[S.sortMode] || '⇅ Ordina';
    if (g.you >= 0) actions += `<button class="ico wideico" data-act="sort" title="Riordina la mano">${sortLbl}</button>`;

    return `<div class="game ${myTurn ? 'myturn' : ''}">
      <div class="topbar">
        <span class="title">${(r.spectators || []).length ? `<span title="${esc(r.spectators.join(', '))}">👁 ${r.spectators.length}</span> · ` : ''}${r.offline ? '<span title="Partita senza internet">📴</span>' : r.daily ? '<b>📅 Sfida</b>' : `<b>${r.slow ? '🐢 ' : ''}${esc(r.code)}</b>`} · <span title="Smazzata ${g.handNo}, si vince a ${g.cfg.target}">smazzata ${g.handNo}</span></span>
        <button class="iconbtn" data-act="gameRules" title="Regole">📜</button>
        ${OFFLINE ? '' : `<button class="iconbtn ${r.music ? 'musicon' : ''}" data-act="music" title="Musica del tavolo">🎵${S.musicUnseen ? '<sup>•</sup>' : ''}</button>`}
        <button class="iconbtn" data-act="log" title="Chat">💬${S.unread ? `<sup>${S.unread}</sup>` : ''}</button>
        <button class="iconbtn" data-act="scores" title="Punteggi">🏆</button>
        <button class="iconbtn" data-act="settings" title="Aspetto e suoni">⚙️</button>
        <button class="iconbtn" data-act="leave" title="Esci">⏏</button>
      </div>
      <div class="scorebar">${r.series ? `<span class="sc series">${seriesHTML(r, g)}</span>` : ''}${scores}</div>
      <div class="seats-row n${g.n} ${g.you < 0 ? 'spect' : ''}">${seats}</div>
      ${(() => {
        const w = stockWarning(g);
        const recap = canDraw ? recapHTML(g, fresh) : '';
        return (w ? `<div class="ticker warn w${w.level}">${w.text}</div>` : recap ? '' : `<div class="ticker" data-act="log" title="Ultima mossa (tocca per la cronaca)">${esc(lastMove(g))}</div>`) + recap;
      })()}
      <div class="felt" id="felt">${others}${center}${mineZone}</div>
      ${r.tutorial && !S.coachOff ? `<div class="coach">🎓 ${coachTip(g)} <button class="ico" data-act="coachOff" title="Nascondi">✕</button></div>` : ''}
      <div class="statusbar ${myTurn ? 'on' : ''}">
        <span class="msg">${S.turnEnd && g.phase !== 'handEnd' && myTurn ? '<b class="cd" data-cd></b> ' : ''}${statusText(g)}</span>
        <div class="btns">${actions}</div>
      </div>
      ${S.reactOpen ? `<div class="reactbar">${['👏', '😂', '😱', '🔥', '👍', '😡', '🙏', '😍'].map((e) => `<button data-act="react" data-e="${e}">${e}</button>`).join('')}</div>` : ''}
      ${g.you < 0 ? `<div class="watching">👁 Stai guardando la partita · le carte in mano non sono visibili <button class="btn small" data-act="leave">Esci</button></div>`
        : `<div class="handwrap" data-drop="hand"><div class="hand" id="hand">${handHTML(g)}</div></div>`}
    </div>`;
  }

  function handHTML(g) {
    const cards = orderedHand();
    if (!cards.length) return '<span class="empty">Nessuna carta</span>';
    const toggled = S.toggledCard;
    return cards.map((c) => {
      const sel = S.selected.has(c.id) !== (c.id === toggled); // la carta appena toccata cambia stato dopo
      return cardHTML(c, `${sel ? 'sel' : ''} ${S.newIds.has(c.id) ? 'newc' : ''}`);
    }).join('');
  }

  /** dispone la mano a ventaglio su una o due file, in base alla larghezza */
  function layoutHand() {
    const hand = $('#hand');
    if (!hand) return;
    const cards = $$('.card', hand);
    if (!cards.length) return;
    hand.classList.add('placing');
    const W = hand.clientWidth - 8;
    const cw = cards[0].offsetWidth;
    const rows = cards.length * cw * 0.42 + cw > W && cards.length > 8 ? 2 : 1;
    const perRow = Math.ceil(cards.length / rows);
    const step = Math.min(cw * 0.78, (W - cw) / Math.max(1, perRow - 1));
    hand.style.setProperty('--step', `${step}px`);
    hand.classList.toggle('two-rows', rows === 2);
    cards.forEach((c, i) => {
      const row = rows === 2 && i >= perRow ? 1 : 0;
      const idx = row ? i - perRow : i;
      const n = row ? cards.length - perRow : perRow;
      const offset = (W - (cw + step * (n - 1))) / 2;
      const mid = (n - 1) / 2;
      const rot = n > 1 ? ((idx - mid) / mid) * Math.min(6, n * 0.6) : 0;
      const lift = n > 1 ? Math.abs((idx - mid) / mid) ** 2 * 6 : 0;
      c.style.left = `${offset + idx * step + 4}px`;
      c.style.top = `${row * (cw * 1.05) + lift}px`;
      c.style.setProperty('--rot', `${rot}deg`);
      c.style.zIndex = String(i + 1);
    });
    hand.style.height = `${(rows === 2 ? cw * 1.05 : 0) + cw * 1.45 + 14}px`;
  }

  /** Adatta il tavolo allo schermo: rimpicciolisce i giochi e, se serve, compatta le combinazioni lunghe */
  function fitTable() {
    const felt = $('#felt');
    if (!felt) return;
    felt.classList.remove('compact');
    felt.style.removeProperty('--mw');
    felt.style.removeProperty('--pw');
    const fits = () => felt.scrollHeight <= felt.clientHeight + 1;
    if (fits()) {
      // c'è spazio libero: carte delle combinazioni e del tallone più grandi (fino a un limite)
      const cs0 = getComputedStyle(felt);
      let mw0 = parseFloat(cs0.getPropertyValue('--mw')) || 30;
      let pw0 = parseFloat(cs0.getPropertyValue('--pw')) || 42;
      const maxMw = mw0 * 1.45;
      while (mw0 + 2 <= maxMw) {
        felt.style.setProperty('--mw', `${mw0 + 2}px`);
        felt.style.setProperty('--pw', `${Math.min(pw0 + 2, 72)}px`);
        if (!fits()) { felt.style.setProperty('--mw', `${mw0}px`); felt.style.setProperty('--pw', `${pw0}px`); break; }
        mw0 += 2; pw0 = Math.min(pw0 + 2, 72);
      }
      return;
    }
    const cs = getComputedStyle(felt);
    let mw = parseFloat(cs.getPropertyValue('--mw')) || 30;
    let pw = parseFloat(cs.getPropertyValue('--pw')) || 42;
    const shrink = (min) => {
      while (!fits() && mw > min) {
        mw -= 2;
        pw = Math.max(32, pw - 2);
        felt.style.setProperty('--mw', `${mw}px`);
        felt.style.setProperty('--pw', `${pw}px`);
      }
    };
    shrink(24);
    if (fits()) return;
    felt.classList.add('compact');
    shrink(17);
  }

  function afterGameRender() {
    layoutHand();
    if (S.dealAnim) { S.dealAnim = false; dealAnimation(); }
    const hand = $('#hand');
    if (hand) {
      void hand.offsetWidth; // applica le posizioni senza animazioni
      hand.classList.remove('placing');
      // solo la carta appena toccata si alza o si abbassa con l'animazione
      const id = S.toggledCard;
      S.toggledCard = null;
      if (id != null) {
        const el = $(`#hand .card[data-card="${id}"]`);
        if (el) { void el.offsetWidth; el.classList.toggle('sel', S.selected.has(id)); }
      }
    }
    // l'animazione d'arrivo delle carte nuove si vede una volta sola
    S.newIds = new Set();
    fitTable();
    const felt = $('#felt');
    if (felt && S.feltScroll != null) felt.scrollTop = S.feltScroll;
    const pc = $('.pile .pcards');
    if (pc) pc.scrollLeft = pc.scrollWidth;
    if (S.animEvent) { animateEvent(S.animEvent); S.animEvent = null; }
    if (S.burracoFx) { burracoFx(S.burracoFx); S.burracoFx = null; }
  }
