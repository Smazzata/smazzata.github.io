/* Burraco — Carte: disegno, ordinamento della mano.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Carte ================= */
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rankName = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
  // nella Scala 40 le matte sono solo i jolly
  const isWild = (c) => c.r === 0 || (c.r === 2 && !isS40Game());

  const SUIT_NAME = { S: 'picche', H: 'cuori', D: 'quadri', C: 'fiori' };
  /* Stile "Realistiche": i semi disposti come nei mazzi tradizionali (x, y in % della carta) */
  const PIPS = {
    2: [[50, 20], [50, 80]],
    3: [[50, 20], [50, 50], [50, 80]],
    4: [[36, 20], [64, 20], [36, 80], [64, 80]],
    5: [[36, 20], [64, 20], [50, 50], [36, 80], [64, 80]],
    6: [[36, 20], [64, 20], [36, 50], [64, 50], [36, 80], [64, 80]],
    7: [[36, 20], [64, 20], [50, 35], [36, 50], [64, 50], [36, 80], [64, 80]],
    8: [[36, 20], [64, 20], [50, 35], [36, 50], [64, 50], [50, 65], [36, 80], [64, 80]],
    9: [[36, 18], [64, 18], [36, 39], [64, 39], [50, 50], [36, 61], [64, 61], [36, 82], [64, 82]],
    10: [[36, 18], [64, 18], [50, 29], [36, 39], [64, 39], [36, 61], [64, 61], [50, 71], [36, 82], [64, 82]],
  };
  const FIGURES = { 11: '💂', 12: '👸', 13: '🤴' };
  // nomi storici delle figure del mazzo francese (mostrati solo nello stile "Francesi")
  const FIG_NAMES = {
    13: { S: 'David', H: 'Charles', D: 'César', C: 'Alexandre' },
    12: { S: 'Pallas', H: 'Judith', D: 'Rachel', C: 'Argine' },
    11: { S: 'Ogier', H: 'La Hire', D: 'Hector', C: 'Lancelot' },
  };
  const REAL_DECKS = ['americane', 'francesi', 'italiane'];
  // il disegno realistico si aggiunge solo quando serve (stile scelto o anteprima), per non appesantire il tavolo
  const realistic = (cls) => REAL_DECKS.includes(S.prefs.deck) || / withpips /.test(` ${cls} `);
  // indice della carta: le lettere di Asso e figure dipendono dallo stile (A/K/Q/J, R/D/V, R/D/F) e le decide il CSS
  const ixName = (r) => (r === 1 || r >= 11 ? `<span class="rk r${r}"></span>` : String(r));

  function cardHTML(c, cls = '', attrs = '') {
    if (c.r === 0) {
      return `<div class="card joker ${cls}" data-card="${c.id}" aria-label="Jolly" ${attrs}><span class="ix">J<br>O<br>L<br>L<br>Y</span><span class="jk">★</span></div>`;
    }
    const red = c.s === 'H' || c.s === 'D';
    let face = c.r >= 11 ? `<span class="face">${ixName(c.r)}<i>${SUIT[c.s]}</i></span>` : `<span class="pip">${SUIT[c.s]}</span>`;
    let extra = '';
    if (realistic(cls)) {
      if (PIPS[c.r]) {
        face += `<span class="pips">${PIPS[c.r].map(([x, y]) => `<b class="${y > 50 ? 'dn' : ''}" style="left:${x}%;top:${y}%">${SUIT[c.s]}</b>`).join('')}</span>`;
        extra = 'haspips';
      } else if (FIGURES[c.r]) {
        face += `<span class="fig"><em>${FIGURES[c.r]}</em><i>${SUIT[c.s]}</i><small>${FIG_NAMES[c.r][c.s]}</small></span>`;
        extra = 'hasfig';
      }
    }
    return `<div class="card ${red ? 'red' : 'black'} s-${c.s} r${c.r} ${c.r === 2 ? 'two' : ''} ${extra} ${cls}" data-card="${c.id}" aria-label="${rankName(c.r)} di ${SUIT_NAME[c.s]}" ${attrs}>
      <span class="ix">${ixName(c.r)}<i>${SUIT[c.s]}</i></span>${face}<span class="ix br">${ixName(c.r)}<i>${SUIT[c.s]}</i></span></div>`;
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
