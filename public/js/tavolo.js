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
    if (isS40Game()) return selectionPreviewS40(g, myTeam, out);
    if (isCanastaGame()) return selectionPreviewCanasta(g, myTeam, out);
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

  /** Scala 40: si attacca a tutti i giochi (dopo aver aperto), un jolly si può sostituire, l'apertura vuole 40 punti */
  function selectionPreviewS40(g, myTeam, out) {
    const cfg = g.cfg.rules;
    const sel = orderedHand().filter((c) => S.selected.has(c.id));
    const top = g.discard[g.discard.length - 1];
    const openDraw = g.phase === 'draw' && !myTeam.opened && cfg.pileNeedsOpen && top;
    if (g.phase !== 'play' && !openDraw) return out;
    if (!sel.length) return out;
    const cards = openDraw ? [top, ...sel] : sel;
    if (myTeam.opened && g.phase === 'play') {
      for (const m of g.teams.flatMap((t) => t.melds)) {
        if (S40R.analyzeMeld(m.cards.concat(cards), cfg, m.type)) out.canAdd.add(m.id);
        else if (cards.length === 1 && cards[0].r !== 0 && cfg.swapJoker && m.cards.some((c, i) => m.wild[i] && S40R.analyzeMeld(m.cards.map((x, k) => (k === i ? cards[0] : x)), cfg, m.type))) out.canAdd.add(m.id);
      }
    }
    if (cards.length >= 3) {
      const groups = S40R.partitionMelds(cards, cfg);
      let ok = !!groups;
      let label = groups ? (groups.length > 1 ? `${groups.length} giochi` : groups[0].type === 'seq' ? 'scala' : 'tris') : '';
      if (ok && !myTeam.opened) {
        const pts = groups.reduce((s, an) => s + an.points, 0);
        if (pts < cfg.opening) { ok = false; label = `${pts}/${cfg.opening} punti`; } else label += ` (${pts} punti)`;
      }
      out.newMeld = { ok, label };
    }
    return out;
  }

  /** Canasta: carte dello stesso valore; per prendere il monte la carta in cima va usata; apertura minima */
  function selectionPreviewCanasta(g, myTeam, out) {
    const cfg = g.cfg.rules;
    const sel = orderedHand().filter((c) => S.selected.has(c.id));
    const top = g.discard[g.discard.length - 1];
    const pileDraw = g.phase === 'draw' && top && !g.pileBlocked;
    if (g.phase !== 'play' && !pileDraw) return out;
    if (!sel.length) return out;
    const cards = pileDraw ? [top, ...sel] : sel;
    for (const m of myTeam.melds) if (CANR.analyzeMeld(m.cards.concat(cards), cfg)) out.canAdd.add(m.id);
    if (cards.length >= 3) {
      const groups = CANR.partitionMelds(cards, cfg);
      let ok = !!groups;
      let label = groups ? (groups.length > 1 ? `${groups.length} giochi` : `gioco di ${rankName(groups[0].rank)}`) : '';
      if (ok && !myTeam.melds.length) {
        const pts = groups.reduce((s, an) => s + an.points, 0);
        if (pts < myTeam.minimum) { ok = false; label = `${pts}/${myTeam.minimum} punti`; } else label += ` (${pts} punti)`;
      }
      if (ok && groups.some((an) => myTeam.melds.some((m) => m.rank === an.rank))) { ok = false; label = 'attacca al gioco che hai'; }
      out.newMeld = { ok, label };
    }
    return out;
  }

  /** Punteggio provvisorio della smazzata in corso (combinazioni calate), piccolo accanto al totale */
  function liveHTML(g, t) {
    if (!t || t.live == null || !t.live || g.phase === 'handEnd') return '';
    return `<i class="live" title="Punti provvisori di questa smazzata: combinazioni calate">${t.live > 0 ? '+' : '−'}${Math.abs(t.live)}</i>`;
  }

  /** Centro del tavolo per Scopa e Briscola */
  function presaCenterHTML(g) {
    const name = (s) => (s === g.you ? 'Tu' : g.players[s].name);
    const teamLbl = (t) => esc(t.members.map(name).join(' & '));
    if (g.game === 'scopa') {
      const fresh = new Set(g.lastTake ? g.lastTake.cardIds : []);
      return `<div class="presa">
        <div class="ptable">${g.table.length ? g.table.map((c) => cardHTML(c, fresh.has(c.id) ? 'fresh' : '')).join('') : '<span class="empty">Tavolo vuoto</span>'}</div>
        <div class="pinfo">${g.cfg.rules.deal && g.cfg.rules.deal !== 3 ? '' : `<span>Mazzo <b>${g.stockCount}</b></span>`}${g.teams.map((t) => `<span>${teamLbl(t)}: <b>${t.taken}</b> carte${t.scope ? ` · <b>${t.scope}</b> ${t.scope === 1 ? 'scopa' : 'scope'} 🧹` : ''}</span>`).join('')}</div>
      </div>`;
    }
    if (g.game === 'briscola5') {
      const B = window.BurracoBriscola5;
      const b = g.b5;
      const SUITN = { d: 'denari', c: 'coppe', s: 'spade', b: 'bastoni' };
      const mine = g.turn === g.you;
      if (g.phase === 'bid') {
        const cur = b.auction.level;
        const opts = [];
        for (let l = cur + 1; l <= Math.min(B.MAX_LEVEL, cur + 4); l++) opts.push(l);
        return `<div class="presa b5">
          <div class="ptrump">Asta · ${cur >= 0 ? `ultima chiamata: <b>${esc(B.bidLabel(cur))}</b> di ${esc(name(b.auction.bidder))}` : 'nessuna chiamata'}</div>
          <div class="b5who">${g.players.map((p) => `<span class="${b.auction.passed[p.seat] ? 'out' : ''} ${p.seat === g.turn ? 'turn' : ''}">${esc(name(p.seat))}${b.auction.passed[p.seat] ? ' · passa' : p.seat === b.auction.bidder ? ' · ' + esc(B.bidLabel(cur)) : ''}</span>`).join('')}</div>
          ${mine ? `<div class="b5bids">${opts.map((l) => `<button class="swatch" data-act="b5Bid" data-l="${l}">${esc(B.bidLabel(l))}</button>`).join('')}<button class="swatch" data-act="b5Pass">Passo</button></div>
            <p class="muted small">Più bassa è la carta chiamata, più è difficile: chiami se pensi di fare almeno 61 punti con il tuo socio.</p>` : ''}
        </div>`;
      }
      if (g.phase === 'call') {
        const rank = B.rankName(B.bidOf(b.auction.level).rank);
        return `<div class="presa b5"><div class="ptrump">${esc(name(b.caller))} ha vinto l'asta (${esc(B.bidLabel(b.auction.level))})</div>
          ${mine ? `<p>Scegli la briscola: chiami il <b>${esc(rank)}</b> di quel seme.</p><div class="b5bids">${['d', 'c', 's', 'b'].map((s) => `<button class="swatch" data-act="b5Call" data-s="${s}">${cardHTML({ id: -500 - 'dcsb'.indexOf(s), r: B.bidOf(b.auction.level).rank, s }, 'mini')} ${SUITN[s]}</button>`).join('')}</div>` : '<p class="muted">Sta scegliendo la briscola…</p>'}</div>`;
      }
      const trick5 = g.trick.length ? g.trick : (g.lastTrick ? g.lastTrick.cards : []);
      const win5 = !g.trick.length && g.lastTrick ? g.lastTrick.winner : null;
      return `<div class="presa">
        <div class="ptrump">Briscola ${SUITN[b.trump] || ''} · chiamato ${b.called ? cardHTML({ id: -510, ...b.called }, 'mini') : ''} · ${b.partner != null ? (b.partner === b.caller ? `${esc(name(b.caller))} gioca da solo` : `socio: <b>${esc(name(b.partner))}</b>`) : 'socio segreto'}${b.iAmPartner && !b.partnerKnown ? ' (sei tu, in segreto!)' : ''}</div>
        <div class="ptrick">${trick5.length ? trick5.map((x) => `<span class="tc ${x.seat === win5 ? 'win' : ''}">${cardHTML(x.card)}<span>${esc(name(x.seat))}</span></span>`).join('') : '<span class="empty">Tocca a chi apre il giro</span>'}</div>
        <div class="pinfo"><span>📣 ${esc(name(b.caller))} deve fare <b>${b.target}</b></span></div>
      </div>`;
    }
    if (g.game === 'rubamazzetto') {
      const fresh = new Set(g.lastTake && g.lastTake.cardIds ? g.lastTake.cardIds : []);
      return `<div class="presa">
        <div class="ptable">${g.table.length ? g.table.map((c) => cardHTML(c, fresh.has(c.id) ? 'fresh' : '')).join('') : '<span class="empty">Tavolo vuoto</span>'}</div>
        <div class="ppiles">${g.teams.map((t) => `<span class="ppile ${t.id === g.you ? 'mine' : ''} ${g.lastTake && g.lastTake.from === t.id ? 'robbed' : ''}">
          ${t.top ? cardHTML(t.top) : '<span class="card slot"></span>'}<span>${esc(name(t.id))}<br><b>${t.taken}</b> ${t.taken === 1 ? 'carta' : 'carte'}</span></span>`).join('')}</div>
        <div class="pinfo"><span>Mazzo <b>${g.stockCount}</b></span></div>
      </div>`;
    }
    const trick = g.trick.length ? g.trick : (g.lastTrick ? g.lastTrick.cards : []);
    if (g.game === 'tressette') {
      const win = !g.trick.length && g.lastTrick ? g.lastTrick.winner : null;
      const SUITN = { d: 'denari', c: 'coppe', s: 'spade', b: 'bastoni' };
      return `<div class="presa">
        <div class="ptrump">${g.stockCount ? `Mazzo <b>${g.stockCount}</b> · ` : ''}${g.trick.length ? `si risponde a <b>${SUITN[g.trick[0].card.s]}</b>` : 'nessuna briscola: si risponde al seme'}</div>
        <div class="ptrick">${trick.length ? trick.map((x) => `<span class="tc ${x.seat === win ? 'win' : ''}">${cardHTML(x.card)}<span>${esc(name(x.seat))}</span></span>`).join('') : '<span class="empty">Tocca a chi apre il giro</span>'}</div>
        ${!g.trick.length && g.lastTrick ? `<div class="pinfo"><span>Ha preso <b>${esc(name(g.lastTrick.winner))}</b></span></div>` : ''}
        <div class="pinfo">${g.teams.map((t) => `<span>${teamLbl(t)}: <b>${t.points}</b> ${t.points === 1 ? 'punto' : 'punti'}${t.accusi && t.accusi.length ? ` · accusi ${t.accusi.reduce((a, x) => a + x.points, 0)}` : ''}</span>`).join('')}</div>
      </div>`;
    }
    // briscola
    const winner = !g.trick.length && g.lastTrick ? g.lastTrick.winner : null;
    return `<div class="presa">
      <div class="ptrump">${g.stockCount ? `Mazzo <b>${g.stockCount}</b>` : 'Mazzo finito'} · briscola ${cardHTML(g.trump, g.stockCount ? '' : 'mini')}</div>
      <div class="ptrick">${trick.length ? trick.map((x) => `<span class="tc ${x.seat === winner ? 'win' : ''}">${cardHTML(x.card)}<span>${esc(name(x.seat))}</span></span>`).join('') : '<span class="empty">Tocca a chi apre il giro</span>'}</div>
      ${!g.trick.length && g.lastTrick ? `<div class="pinfo"><span>Ha preso <b>${esc(name(g.lastTrick.winner))}</b>${g.lastTrick.points ? ` · ${g.lastTrick.points} punti` : ''}</span></div>` : ''}
      <div class="pinfo">${g.teams.map((t) => `<span>${teamLbl(t)}: <b>${t.taken}</b> carte prese${t.points != null ? ` · <b>${t.points}</b> punti` : ''}</span>`).join('')}</div>
    </div>`;
  }

  function meldHTML(m, mine, preview) {
    const short = { clean: 'Pulito', dirty: 'Sporco', semi: 'Semi', real13: '+500', real14: '+1000' }[m.kind] || '';
    const attrs = `data-mid="${m.id}"` + (mine ? ` data-meld="${m.id}" data-drop="meld"` : '');
    const can = preview && preview.canAdd.has(m.id) ? 'can-add' : '';
    const hint = S.hint && S.hint.meldId === m.id ? 'hinted' : '';
    const fr = S.freshCards || new Set();
    // Scala 40: un poker è completo (non si attacca più): mazzetto coperto unico; toccandolo si vedono le carte
    if (isS40Game() && m.type === 'set' && m.length === 4) {
      const nat = m.cards.find((c) => c.r !== 0);
      const fresh = m.cards.some((c) => fr.has(c.id)) ? 'fresh' : '';
      return `<div class="meld poker ${S.flashMeld === m.id ? 'flash' : ''} ${can} ${hint}" ${attrs} title="Poker${nat ? ' di ' + rankName(nat.r) : ''}: tocca per vedere le carte">
        <span class="pstack ${fresh}">${backHTML('mini', 'style="--l:2"')}${backHTML('mini', 'style="--l:1"')}${backHTML('mini', 'style="--l:0"')}<b>${nat ? rankName(nat.r) : ''}</b></span>
        <span class="tag">Poker${m.wild.some(Boolean) ? ' ★' : ''}</span></div>`;
    }
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
    if (g.phase === 'handEnd') return g.over ? 'Partita finita: tocca <b>Risultati</b> per la rivincita o per uscire' : 'Smazzata finita: tocca <b>Risultati</b>';
    const cur = g.players[g.turn];
    if (g.turn !== me) return `Aspetta: gioca <b>${esc(cur.name)}</b>${g.lastTurn ? ' · <b>ultimo giro</b>' : ''}`;
    if (g.game === 'briscola5' && g.phase === 'bid') return 'Tocca a te: chiama una carta o passa';
    if (g.game === 'briscola5' && g.phase === 'call') return 'Tocca a te: scegli il seme di briscola';
    if (g.presa) return 'Tocca a te: tocca la carta che vuoi giocare';
    if (g.phase === 'draw') {
      if (g.mustDraw) return 'Tocca a te: pesca una carta dal <b>tallone</b>';
      if (isCanastaGame() && g.discardCount) return g.pileBlocked ? 'Tocca a te: pesca dal <b>tallone</b> (il monte è bloccato)' : `Tocca a te: pesca dal <b>tallone</b>, oppure seleziona ${g.pileFrozen ? 'due carte uguali' : 'le carte da usare'} con quella in cima e tocca il <b>monte</b>`;
      if (g.cfg.pile === 'closed' && g.discardCount) return 'Tocca a te: pesca dal <b>tallone</b>, oppure seleziona carte da combinare con la cima e tocca gli <b>scarti</b>';
      return 'Tocca a te: pesca dal <b>tallone</b>, oppure prendi gli <b>scarti</b>';
    }
    const myTeam = g.teams.find((t) => t.members.includes(me));
    const sel = S.selected.size;
    const nm = sel >= 2 ? selectionPreview(g, myTeam).newMeld : null;
    let tip = sel === 1 ? 'Ora tocca gli <b>scarti</b> per scartarla (o un tuo gioco per attaccarla)'
      : sel >= 2 ? (nm && nm.ok ? 'Tocca <b>✓ Cala</b> per calare queste carte' : nm ? 'Queste carte non formano un gioco: aggiungine o togline' : 'Tocca un tuo gioco per attaccare queste carte')
        : 'Tocca le carte da calare, oppure la carta da <b>scartare</b>';
    if (myTeam && myTeam.canClose) tip = 'Puoi <b>chiudere</b>: cala tutto e scarta l\'ultima carta';
    else if (g.hand.length <= 3 && myTeam && myTeam.pozzettoTaken) tip += ` · per chiudere serve ${g.cfg.closeNeeds === 'clean' ? `una ${g.cfg.burracoName} pulita` : `un ${g.cfg.burracoName}`}`;
    if (g.lastTurn) tip += ' · <b>ultimo turno!</b>';
    return tip;
  }

  /** I passi del mio turno: ① Pesca ② Cala ③ Scarta (giochi in cui si pesca e si scarta) */
  function stepsHTML(g) {
    if (g.presa || g.turn !== g.you || (g.phase !== 'draw' && g.phase !== 'play')) return '';
    const draw = g.phase === 'draw';
    const st = (n, label, cls) => `<i class="${cls}">${n} ${label}</i>`;
    return `<span class="steps">${st(draw ? '①' : '✓', 'Pesca', draw ? 'now' : 'done')}${st('②', 'Cala', draw ? '' : 'now opt')}${st('③', 'Scarta', draw ? '' : 'now')}</span>`;
  }

  /** Avviso di fine tallone: quanti giri restano prima che la smazzata finisca */
  function stockWarning(g) {
    if (g.phase === 'handEnd' || isS40Game()) return null; // nella Scala 40 il tallone si rimescola
    if (g.game === 'scopa' && g.cfg.rules.deal && g.cfg.rules.deal !== 3) return null; // Scopone: niente mazzo da cui pescare
    if (g.game === 'tressette' && !g.stockCount) return null; // Tressette in quattro: niente mazzo
    if (g.game === 'briscola5') return null; // in cinque non c'è mazzo
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
    if (g.n === 5) return [[rel(1), 'left'], [rel(2), 'top'], [rel(3), 'top'], [rel(4), 'right']];
    return [[rel(1), 'top']];
  }

  function seatHTML(g, seat, pos, myTeam) {
    const p = g.players[seat];
    const partner = myTeam && myTeam.members.includes(seat);
    const turn = g.turn === seat && g.phase !== 'handEnd';
    const fan = Array.from({ length: Math.min(p.handCount, 7) }, (_, i) => backHTML('tiny', `style="--i:${i}"`)).join('');
    const rs = S.room && S.room.seats[seat];
    const off = rs && !rs.isBot && !rs.connected;
    return `<div class="seatchip pos-${pos} ${turn ? 'turn' : ''} ${partner ? 'partner' : ''} ${off ? 'offline' : ''}" data-seat="${seat}">
      ${S.room?.campaign && p.isBot ? campaignPortrait(campaignPath().levels[S.campaignLevel].opponent, true) : avatarHTML(p.name, seat, p.isBot, rs && rs.avatar)}
      <div class="sinfo"><b ${rs && !rs.isBot && !p.isBot ? `data-act="playerMenu" data-nick="${esc(p.name)}"` : ''}>${esc(p.name)} ${lvlHTML(rs && rs.level)}</b>
        ${rs && rs.avatar && rs.avatar.t ? `<span class="stitle">${esc(rs.avatar.t)}</span>` : ''}
        <span class="smeta">${p.out ? '❌ eliminato · ' : ''}${off ? '📴 ' : ''}${partner ? '<span title="compagno">🤝</span> ' : ''}${p.handCount} carte</span></div>
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
    if (isS40Game()) scores = g.players.map((p) => `<span class="sc ${p.seat === me ? 'me' : ''} ${p.out ? 'out' : ''}" title="Penalità (eliminato a ${g.cfg.target})">${p.out ? '❌ ' : ''}${esc(p.seat === me ? 'Tu' : p.name)} <b>${-g.scores[p.seat]}</b></span>`).join('');
    else if (g.n === 3) scores = g.players.map((p) => `<span class="sc ${p.seat === me ? 'me' : ''}">${esc(p.seat === me ? 'Tu' : p.name)} <b>${g.scores[p.seat]}</b>${liveHTML(g, g.teams.find((t) => t.members.includes(p.seat)))}</span>`).join('');
    else scores = g.teams.map((t) => `<span class="sc ${t === myTeam ? 'me' : ''}">${esc(teamName(g, t))} <b>${g.scores[t.members[0]]}</b>${liveHTML(g, t)}</span>`).join('');

    const seats = seatPositions(g).map(([s, pos]) => seatHTML(g, s, pos, myTeam)).join('');

    // pozzetti: piccoli, in alto a destra (nella riga dei punteggi), così il tavolo resta alle combinazioni
    const pozz = g.pozzetti.length ? `<span class="pozz" title="${P === 'morto' ? 'Morti' : 'Pozzetti'} da prendere: ${g.pozzetti.length}"><span class="pz">${g.pozzetti.map(() => backHTML('tiny')).join('')}</span></span>` : '';

    // centro: tallone e scarti
    const pileAll = g.cfg.pile === 'open' ? g.discard : g.discard.slice(-1);
    const pileCards = pileAll.map((c, i) => {
      const top = i === pileAll.length - 1;
      return cardHTML(c, `${top ? 'top' : ''} ${top && S.animEvent && S.animEvent.type === 'discard' ? 'landed' : ''}`, top && canDraw && !g.mustDraw ? 'data-drag="pile"' : '');
    }).join('');
    const stockLayers = Math.min(3, Math.ceil(g.stockCount / 15));
    const center = `<div class="center">
      <div class="stock ${canDraw && (g.stockCount || g.pozzetti.length) ? 'active' : ''} ${S.hint && S.hint.type === 'draw' ? 'hinted' : ''}" ${canDraw ? 'data-act="draw" data-drag="stock"' : ''}>
        <div class="deck">${g.stockCount ? Array.from({ length: stockLayers }, (_, i) => backHTML('', `style="--l:${i}"`)).join('') : '<div class="card slot"></div>'}</div>
        <span class="lbl ${stockWarning(g) ? 'lowstock' : ''}">${canDraw && g.stockCount ? '<b class="here">👆 Pesca qui</b>' : `Tallone · ${g.stockCount}`}</span>
      </div>
      <div class="pile ${(canDraw && g.discardCount && !g.mustDraw) || (playing && S.selected.size === 1) ? 'active' : ''} ${g.cfg.pile} ${S.hint && (S.hint.type === 'takePile' || S.hint.type === 'discard') ? 'hinted' : ''}" data-drop="discard" ${canDraw && !g.mustDraw ? 'data-act="takePile"' : playing ? 'data-act="discardSel"' : ''}>
        <div class="pcards">${pileCards || '<div class="card slot"></div>'}</div>
        <span class="lbl">${playing && S.selected.size === 1 ? '<b class="here">👆 Scarta qui</b>' : isCanastaGame() ? `Monte${g.discardCount ? ' · ' + g.discardCount : ''}${g.pileBlocked ? ' 🔒' : g.pileFrozen ? ' ❄️' : ''}` : `Scarti${g.discardCount ? ' · ' + g.discardCount : ''}${g.cfg.pile === 'closed' ? ' (chiusi)' : ''}`}</span>
      </div>
    </div>`;

    // giochi delle squadre
    const preview = selectionPreview(g, myTeam);
    const nm = preview.newMeld;
    const newSlotText = nm ? (nm.ok ? `✓ Cala<br>${nm.label}` : nm.label.includes('punti') ? `✗ Servono<br>${nm.label}` : '✗ Non<br>valida') : '＋ Nuova<br>combinazione';
    const zone = (t) => {
      const mine = t === myTeam;
      const label = mine ? (t.members.length > 1 ? `Noi · ${esc(teamName(g, t))}` : 'I tuoi giochi') : esc(teamName(g, t));
      const flags = isS40Game()
        ? [g.players[t.members[0]].out ? 'eliminato' : t.opened ? 'ha aperto' : `deve aprire (${g.cfg.opening})`]
        : isCanastaGame()
          ? [t.opened ? 'ha aperto' : `apertura: ${t.minimum} punti`, ...(t.red3 ? [`🔴3 ×${t.red3}`] : [])]
          : [t.pozzettoTaken ? `${P} preso` : `${P} da prendere`];
      if (t.canClose) flags.push('può chiudere');
      // nella Scala 40, dopo l'apertura, si attacca anche ai giochi degli altri
      const s40open = isS40Game() && myTeam && myTeam.opened && playing;
      const targetable = (mine && (playing || (canDraw && g.cfg.pile === 'closed'))) || s40open;
      const newSlot = mine && (playing || (canDraw && g.cfg.pile === 'closed'))
        ? `<div class="meld newmeld ${nm ? (nm.ok ? 'ok' : 'bad') : ''} ${S.hint && S.hint.type === 'meld' ? 'hinted' : ''}" data-drop="newmeld" ${playing ? 'data-act="meld"' : ''}><span>${newSlotText}</span></div>` : '';
      return `<div class="teamzone ${mine ? 'mine' : 'theirs'}">
        <div class="hdr" data-act="zoomTeam" data-team="${g.teams.indexOf(t)}" title="Tocca per vedere i giochi in grande"><b>${label} <i class="zoomi">🔍</i></b><span>${flags.join(' · ')}</span></div>
        <div class="melds ${targetable ? 'targetable' : ''}">${t.melds.map((m) => meldHTML(m, mine || s40open, mine || s40open ? preview : null)).join('')}${newSlot}${!t.melds.length && !newSlot ? '<span class="empty">Nessuna combinazione</span>' : ''}</div>
      </div>`;
    };
    const others = g.teams.filter((t) => t !== myTeam).map(zone).join('');
    const mineZone = myTeam ? zone(myTeam) : '';

    // niente fasce di testo sul tavolo: piccole icone che galleggiano sopra la mano, così le carte hanno più spazio.
    // ❓ dice cosa fare (si apre al tocco e sparisce da sola); 🕘 in alto apre lo storico dei turni
    const sel = S.selected.size;
    let actions = '';
    if (myTurn && r.hints) actions += `<button class="ico ${r.campaign ? 'cad-hint-button' : ''}" data-act="hint" title="Suggerimento" aria-label="Suggerimento">${r.campaign ? campaignPowerIcon('hint') : '💡'}</button>`;
    if (g.you >= 0 && !r.campaign) actions = '<button class="ico" data-act="reactPicker" title="Reazioni">😊</button>' + actions;
    if (sel) actions += '<button class="ico" data-act="clearSel" title="Deseleziona">✕</button>';
    const sortLbl = { rank: '⇅ Valore', suit: '⇅ Seme', smart: '⇅ Giochi' }[S.sortMode] || '⇅ Ordina';
    if (g.you >= 0) actions += `<button class="ico wideico" data-act="sort" title="Riordina la mano">${sortLbl}</button>`;
    const left = g.phase === 'handEnd'
      ? '<button class="btn primary small" data-act="result">🏆 Risultati</button>'
      : `<button class="ico helpico ${myTurn ? 'pulse' : ''}" data-act="turnHelp" title="Cosa devo fare?">❓</button>${S.turnEnd && myTurn ? '<b class="cd chip" data-cd></b>' : ''}`;

    return `<div class="game ${myTurn ? 'myturn' : ''} ${r.campaign ? 'cad-game cad-world-' + campaignPath().id : ''}">
      <div class="topbar">
        <span class="title">${(r.spectators || []).length ? `<span title="${esc(r.spectators.join(', '))}">👁 ${r.spectators.length}</span> · ` : ''}${r.offline ? '<span title="Partita senza internet">📴</span>' : r.daily ? '<b>📅 Sfida</b>' : r.tournament ? '<b>🏆 Torneo</b>' : `${r.ranked ? `<span class="rankbadge" title="${RANKED_TIP}">🏅</span> ` : ''}<b>${r.slow ? '🐢 ' : ''}${esc(r.code)}</b>`} · <span title="Smazzata ${g.handNo}, ${isS40Game() ? `eliminato a ${g.cfg.target}` : `si vince a ${g.cfg.target}`}">${g.game && g.game !== 'burraco' ? `${RX.gameName(g.cfg.rules)} · ` : ''}smazzata ${g.handNo}</span></span>
        ${FULL() ? `<button class="iconbtn" data-act="gameRules" title="Regole">📜</button>
        ${OFFLINE || r.campaign ? '' : `<button class="iconbtn ${r.music ? 'musicon' : ''}" data-act="music" title="Musica del tavolo">🎵${S.musicUnseen ? '<sup>•</sup>' : ''}</button>`}` : ''}
        <button class="iconbtn" data-act="turnLog" title="Storico dei turni">🕘</button>
        ${r.campaign ? '' : `<button class="iconbtn" data-act="log" title="Chat">💬${S.unread ? `<sup>${S.unread}</sup>` : ''}</button>`}
        ${FULL() ? `<button class="iconbtn" data-act="scores" title="Punteggi">🏆</button>
        <button class="iconbtn" data-act="settings" title="Aspetto e suoni">⚙️</button>
        <button class="iconbtn" data-act="leave" title="Esci">⏏</button>`
        : `<button class="iconbtn menuico" data-act="tableMenu" title="Menu">☰${S.musicUnseen ? '<sup>•</sup>' : ''}</button>`}
      </div>
      <div class="scorebar">${r.series ? `<span class="sc series">${seriesHTML(r, g)}</span>` : ''}${scores}${pozz}</div>
      <div class="seats-row n${g.n} ${g.you < 0 ? 'spect' : ''}">${seats}</div>
      ${surrenderBarHTML(g, r)}
      <div class="felt" id="felt">${g.presa ? presaCenterHTML(g) : others + center + mineZone}</div>
      ${r.campaign ? campaignCoachHTML() : r.tutorial && !S.coachOff ? `<div class="coach">🎓 ${coachTip(g)} <button class="ico" data-act="coachOff" title="Nascondi">✕</button></div>` : ''}
      <div class="sr-only" id="turnmsg" aria-live="polite">${statusText(g).replace(/<[^>]+>/g, '')}</div>
      <div class="floatbar"><span class="fl">${left}</span><span class="fr">${actions}</span></div>
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
      // Tressette: le carte che non rispondono al seme non si possono giocare
      const off = g.playable && !g.playable.includes(c.id);
      return cardHTML(c, `${sel ? 'sel' : ''} ${S.newIds.has(c.id) ? 'newc' : ''} ${off ? 'unplayable' : ''}`);
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
    const root = felt.parentElement;
    const theirs = [...felt.querySelectorAll('.teamzone.theirs')];
    felt.classList.remove('compact');
    root.classList.remove('tight1', 'tight2');
    for (const el of [felt, ...theirs]) { el.style.removeProperty('--mw'); el.style.removeProperty('--pw'); }
    const fits = () => felt.scrollHeight <= felt.clientHeight + 1;
    if (fits()) {
      // c'è spazio libero: carte delle combinazioni e del tallone più grandi (fino a un limite)
      const cs0 = getComputedStyle(felt);
      const mw0 = parseFloat(cs0.getPropertyValue('--mw')) || 30;
      const pw0 = parseFloat(cs0.getPropertyValue('--pw')) || 36;
      const maxPw = pw0 + 4; // tallone e scarti crescono poco: lo spazio libero va alle combinazioni
      // in colonna lo spazio in larghezza basta più a lungo: le carte possono crescere di più
      const maxMw = mw0 * (document.body.classList.contains('vmelds') ? 1.9 : 1.45);
      // Ogni fits() forza il layout: cerca lo stesso passo da 2px con una ricerca
      // binaria, invece di ricalcolare tutto il tavolo per ogni dimensione intermedia.
      const size = (step) => {
        felt.style.setProperty('--mw', `${mw0 + step * 2}px`);
        felt.style.setProperty('--pw', `${Math.min(pw0 + step * 2, maxPw)}px`);
      };
      const max = Math.floor((maxMw - mw0) / 2);
      let lo = 0, hi = max;
      // I piccoli aggiustamenti sono frequenti: controlliamo prima i primi quattro passi.
      for (let step = 1; step <= Math.min(4, max); step++) {
        size(step);
        if (!fits()) { hi = step - 1; break; }
        lo = step;
      }
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        size(mid);
        if (fits()) lo = mid; else hi = mid - 1;
      }
      if (lo) size(lo);
      else { felt.style.removeProperty('--mw'); felt.style.removeProperty('--pw'); }
      return;
    }
    /*
     * Non ci sta: si recupera spazio un passo alla volta, tenendo grandi il più possibile le MIE carte.
     * 1) tutte le combinazioni un po' più piccole; 2) righe sopra il tavolo più strette (riepilogo su una riga,
     * posti degli avversari compatti); 3) solo le combinazioni degli avversari più piccole; 4) niente riepilogo;
     * 5) le mie fino a un minimo leggibile; 6) ultima risorsa: combinazioni compattate (si tocca per vederle tutte).
     */
    const cs = getComputedStyle(felt);
    let mw = parseFloat(cs.getPropertyValue('--mw')) || 30;
    let pw = parseFloat(cs.getPropertyValue('--pw')) || 36;
    let tw = mw; // carte degli avversari
    const setAll = () => {
      felt.style.setProperty('--mw', `${mw}px`);
      felt.style.setProperty('--pw', `${pw}px`);
      for (const z of theirs) z.style.setProperty('--mw', `${Math.min(tw, mw)}px`);
    };
    const shrink = (steps, apply) => {
      if (fits() || steps <= 0) return;
      let lo = 1, hi = steps;
      for (let step = 1; step <= Math.min(4, steps); step++) {
        apply(step);
        if (fits()) return;
        if (step === steps) return;
        lo = step + 1;
      }
      apply(steps);
      if (!fits()) return;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        apply(mid);
        if (fits()) hi = mid; else lo = mid + 1;
      }
      apply(lo);
    };
    const shrinkAll = (min) => {
      const startMw = mw, startTw = tw, startPw = pw;
      shrink(Math.ceil((mw - min) / 2), (step) => {
        mw = startMw - step * 2;
        tw = Math.min(startTw, mw);
        pw = Math.max(30, startPw - step * 2);
        setAll();
      });
    };
    const shrinkTheirs = (min) => {
      const start = tw;
      shrink(Math.ceil((tw - min) / 2), (step) => { tw = start - step * 2; setAll(); });
    };
    shrinkAll(26);
    if (fits()) return;
    root.classList.add('tight1');
    if (fits()) return;
    if (theirs.length) { shrinkTheirs(20); if (fits()) return; }
    root.classList.add('tight2');
    if (fits()) return;
    shrinkAll(22);
    if (fits()) return;
    felt.classList.add('compact');
    shrinkAll(17);
  }

  /** Proposta di resa nella mia squadra: il compagno accetta o rifiuta, chi propone può annullare */
  function surrenderBarHTML(g, r) {
    const votes = r.surrender;
    if (!votes || g.you < 0 || g.over) return '';
    const team = g.teams.find((t) => t.members.includes(g.you));
    const mine = votes.filter((x) => team && team.members.includes(x));
    if (!mine.length) return '';
    if (mine.includes(g.you)) return '<div class="surrbar">🏳️ Hai proposto la resa: aspetta che il compagno accetti. <button class="btn small" data-act="surrenderCancel">Annulla</button></div>';
    return `<div class="surrbar">🏳️ <b>${esc(g.players[mine[0]].name)}</b> propone di arrendersi.
      <button class="btn small danger" data-act="surrender" data-ok="1">Accetta</button><button class="btn small" data-act="surrenderCancel">No, giochiamo</button></div>`;
  }

  /** Vista ingrandita dei giochi di una squadra (toccando il nome della squadra sul tavolo) */
  function zoomModal() {
    const g = S.game;
    const t = g && g.teams[S.zoomTeam];
    if (!t) { closeModal(); return; }
    const myTeam = g.teams.find((x) => x.members.includes(g.you));
    const mine = t === myTeam;
    const playing = g.turn === g.you && g.phase === 'play';
    const s40open = isS40Game() && myTeam && myTeam.opened && playing;
    const canAttach = (mine || s40open) && playing && S.selected.size;
    openModal('zoom', `<div class="zoomview"><h3>${mine ? 'I tuoi giochi' : esc(teamName(g, t))}</h3>
      <p class="muted small">${canAttach ? 'Tocca un gioco per attaccare le carte selezionate' : 'Tocca un gioco per vederlo intero'}</p>
      <div class="melds ${canAttach ? 'targetable' : ''}">${t.melds.map((m) => meldHTML(m, mine || s40open, null)).join('') || '<span class="empty">Nessuna combinazione</span>'}</div></div>`);
  }

  /** posizione attuale delle carte (mano e tavolo), per farle scivolare dopo il ridisegno */
  function cardRects() {
    if (S.prefs.anim === false || (S.drag && S.drag.started)) return null;
    const m = new Map();
    for (const el of document.querySelectorAll('#hand .card[data-card], #felt .card[data-card]')) {
      const r = el.getBoundingClientRect();
      const inHand = !!el.closest('#hand');
      if (r.width) m.set(inHand ? 'h' + el.dataset.card : 'f' + el.dataset.card, { r, html: inHand ? null : el.outerHTML });
    }
    return m;
  }
  /** le carte che si sono spostate partono dalla vecchia posizione e arrivano con una molla nella nuova */
  function flipCards(from) {
    if (!from || !from.size) return;
    const moved = [];
    for (const el of document.querySelectorAll('#hand .card[data-card], #felt .card[data-card]')) {
      const key = (el.closest('#hand') ? 'h' : 'f') + el.dataset.card;
      const a = from.get(key) && from.get(key).r;
      if (!a || el.style.visibility === 'hidden') continue;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) continue;
      moved.push([el, dx, dy]);
    }
    sweepTaken(from);
    if (!moved.length) return;
    for (const [el, dx, dy] of moved) {
      el.style.transition = 'none';
      el.style.translate = `${dx}px ${dy}px`;
    }
    void document.body.offsetWidth;
    for (const [el] of moved) {
      el.style.transition = 'translate .42s var(--spring), transform .22s var(--spring), box-shadow .2s';
      el.style.translate = '0px 0px';
    }
    setTimeout(() => { for (const [el] of moved) { el.style.transition = ''; el.style.translate = ''; } }, 460);
  }

  /*
   * Giochi a prese: le carte che spariscono dal tavolo (una presa, il giro della Briscola) volano verso chi le
   * ha prese, rimpicciolendo, invece di sparire di colpo.
   */
  function sweepTaken(from) {
    const g = S.game;
    if (!g || !g.presa || S.sweepTo == null || S.prefs.anim === false) return;
    const now = new Set([...document.querySelectorAll('#felt .card[data-card]')].map((el) => el.dataset.card));
    const gone = [...from].filter(([k, v]) => k[0] === 'f' && !now.has(k.slice(1)) && v.html).slice(0, 10);
    const target = S.sweepTo === g.you ? $('#hand') : $(`.seatchip[data-seat="${S.sweepTo}"]`);
    S.sweepTo = null;
    if (!gone.length || !target) return;
    const t = target.getBoundingClientRect();
    gone.forEach(([, v], i) => {
      const el = document.createElement('div');
      el.className = 'flyer';
      el.innerHTML = v.html;
      document.body.appendChild(el);
      const c = el.firstElementChild;
      c.classList.remove('fresh');
      const w = c.offsetWidth || 40, sc = v.r.width / w;
      el.style.transform = `translate(${v.r.left}px, ${v.r.top}px) scale(${sc})`;
      setTimeout(() => {
        el.style.transition = 'transform .5s cubic-bezier(.5,0,.75,0), opacity .5s ease-in';
        el.style.transform = `translate(${t.left + t.width / 2 - w * 0.2}px, ${t.top + t.height / 2 - w * 0.3}px) scale(${sc * 0.4}) rotate(${(i % 2 ? 1 : -1) * 12}deg)`;
        el.style.opacity = '0';
      }, 30 + i * 45);
      setTimeout(() => el.remove(), 620 + i * 45);
    });
  }

  function afterGameRender() {
    if (S.modalKind === 'zoom') zoomModal();
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
    reattachDiscardFlights();
    flipCards(S.flipFrom);
    S.flipFrom = null;
    const ev = S.animEvent;
    if (ev && (ev.type === 'meld' || ev.type === 'add') && S.prefs.anim !== false) {
      for (const id of ev.cardIds || []) { const c = $(`#felt .card[data-card="${id}"]`); if (c) c.classList.add('snap'); }
    }
    if (S.animEvent) { animateEvent(S.animEvent); S.animEvent = null; }
    const g0 = S.game, w = g0 && stockWarning(g0);
    const wkey = w ? `${g0.handNo}:${w.level}` : null;
    if (wkey && S.stockWarnKey !== wkey) toast(w.text);
    S.stockWarnKey = wkey;
    landAnticipated();
    if (S.burracoFx) { burracoFx(S.burracoFx); S.burracoFx = null; }
  }
