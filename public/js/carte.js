/* Burraco — Carte: disegno, ordinamento della mano.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Carte ================= */
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rankName = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
  const isWild = (c) => c.r === 0 || c.r === 2;

  const SUIT_NAME = { S: 'picche', H: 'cuori', D: 'quadri', C: 'fiori' };
  function cardHTML(c, cls = '', attrs = '') {
    if (c.r === 0) {
      return `<div class="card joker ${cls}" data-card="${c.id}" aria-label="Jolly" ${attrs}><span class="ix">J<br>O<br>L<br>L<br>Y</span><span class="jk">★</span></div>`;
    }
    const red = c.s === 'H' || c.s === 'D';
    const face = c.r >= 11 ? `<span class="face">${rankName(c.r)}<i>${SUIT[c.s]}</i></span>` : `<span class="pip">${SUIT[c.s]}</span>`;
    return `<div class="card ${red ? 'red' : 'black'} ${c.r === 2 ? 'two' : ''} ${cls}" data-card="${c.id}" aria-label="${rankName(c.r)} di ${SUIT_NAME[c.s]}" ${attrs}>
      <span class="ix">${rankName(c.r)}<i>${SUIT[c.s]}</i></span>${face}<span class="ix br">${rankName(c.r)}<i>${SUIT[c.s]}</i></span></div>`;
  }
  const backHTML = (cls = '', attrs = '') => `<div class="card back ${cls}" ${attrs}></div>`;

  /**
   * Ordinamento "Giochi": combinazioni pronte (3+), poi quasi pronte (coppie, scale con un buco),
   * poi carte sciolte, matte in fondo. Scelta golosa: prima i gruppi più lunghi.
   */
  function smartSort(cards) {
    const allowSets = !S.game || S.game.cfg.rules.allowSets;
    const nat = cards.filter((c) => !isWild(c));
    const wilds = sortCards(cards.filter(isWild), 'suit');
    const groups = [];
    // scale: carte consecutive dello stesso seme (l'Asso vale sia 1 sia 14)
    for (const s of ['S', 'H', 'C', 'D']) {
      const bySlot = new Map();
      for (const c of nat.filter((x) => x.s === s)) for (const p of c.r === 1 ? [1, 14] : [c.r]) if (!bySlot.has(p)) bySlot.set(p, c);
      let run = [];
      for (let p = 1; p <= 15; p++) {
        const c = bySlot.get(p);
        if (c && !run.includes(c)) run.push(c);
        else { if (run.length >= 2) groups.push({ cards: run.slice(), gap: false }); run = c ? [c] : []; }
      }
      // quasi-scale con un buco (es. 5 e 7)
      for (let p = 1; p <= 12; p++) {
        const a = bySlot.get(p), b = bySlot.get(p + 2);
        if (a && b && a !== b && !bySlot.has(p + 1)) groups.push({ cards: [a, b], gap: true });
      }
    }
    if (allowSets) {
      const byRank = new Map();
      for (const c of nat) { if (!byRank.has(c.r)) byRank.set(c.r, []); byRank.get(c.r).push(c); }
      for (const list of byRank.values()) if (list.length >= 2) groups.push({ cards: list, gap: false });
    }
    // i gruppi completi prima, poi i più lunghi; le quasi-scale per ultime
    groups.sort((x, y) => (y.cards.length >= 3) - (x.cards.length >= 3) || x.gap - y.gap || y.cards.length - x.cards.length);
    const used = new Set();
    const out = [];
    for (const gr of groups) {
      if (gr.cards.some((c) => used.has(c.id))) continue;
      gr.cards.forEach((c) => used.add(c.id));
      out.push(...gr.cards);
    }
    const loose = sortCards(nat.filter((c) => !used.has(c.id)), 'suit');
    return [...out, ...loose, ...wilds];
  }

  function sortCards(cards, mode) {
    if (mode === 'smart') return smartSort(cards);
    const suitOrder = { S: 0, H: 1, C: 2, D: 3 };
    const rk = (c) => (c.r === 1 ? 14 : c.r);
    return cards.slice().sort((a, b) => {
      const wa = isWild(a), wb = isWild(b);
      if (wa !== wb) return wa ? 1 : -1;
      if (wa && wb) return a.r - b.r || (suitOrder[a.s] || 0) - (suitOrder[b.s] || 0);
      if (mode === 'rank') return rk(a) - rk(b) || suitOrder[a.s] - suitOrder[b.s];
      return suitOrder[a.s] - suitOrder[b.s] || rk(a) - rk(b);
    });
  }

  function syncHandOrder(game, sameHand) {
    const ids = game.hand.map((c) => c.id);
    const kept = sameHand ? S.handOrder.filter((id) => ids.includes(id)) : [];
    if (S.sortMode !== 'manual' || kept.length === 0) {
      S.handOrder = sortCards(game.hand, ['rank', 'smart'].includes(S.sortMode) ? S.sortMode : 'suit').map((c) => c.id);
      if (S.sortMode === 'manual' && !sameHand) S.sortMode = 'suit';
      return;
    }
    S.handOrder = kept.concat(ids.filter((id) => !kept.includes(id)));
  }

  function orderedHand() {
    const g = S.game;
    const byId = new Map(g.hand.map((c) => [c.id, c]));
    return S.handOrder.map((id) => byId.get(id)).filter(Boolean);
  }
