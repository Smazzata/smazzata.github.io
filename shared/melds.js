/*
 * Analisi delle combinazioni (scale e tris), condivisa tra server e browser:
 * il server la usa per validare le mosse, il client per l'anteprima.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoMelds = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const isJoker = (c) => c.r === 0;
  const isTwo = (c) => c.r === 2;
  const isWild = (c) => isJoker(c) || isTwo(c);

  function longestRun(flags) {
    let best = 0, cur = 0;
    for (const f of flags) { cur = f ? cur + 1 : 0; best = Math.max(best, cur); }
    return best;
  }

  function analyzeSequence(cards, cfg) {
    if (cards.length < 3) return null;
    const others = cards.filter((c) => !isWild(c));
    if (!others.length) return null;
    const suit = others[0].s;
    if (others.some((c) => c.s !== suit)) return null;
    const jokers = cards.filter(isJoker);
    const suitedTwos = cards.filter((c) => isTwo(c) && c.s === suit);
    const otherTwos = cards.filter((c) => isTwo(c) && c.s !== suit);
    const aces = others.filter((c) => c.r === 1);
    const nonAce = others.filter((c) => c.r !== 1);
    if (aces.length > 2) return null;
    const aceOptions = aces.length === 0 ? [[]] : aces.length === 1 ? [[1], [14]] : (cfg.aceBothEnds ? [[1, 14]] : []);

    let best = null;
    for (let mask = 0; mask < (1 << suitedTwos.length); mask++) {
      const natTwos = suitedTwos.filter((_, i) => mask & (1 << i));
      const wildTwos = suitedTwos.filter((_, i) => !(mask & (1 << i)));
      const wilds = [...jokers, ...otherTwos, ...wildTwos];
      if (wilds.length > cfg.maxWild) continue;
      if (best && wilds.length >= best.wildCount) continue;
      for (const ap of aceOptions) {
        const nat = nonAce.map((c) => ({ c, p: c.r }))
          .concat(natTwos.map((c) => ({ c, p: 2 })))
          .concat(aces.map((c, i) => ({ c, p: ap[i] })));
        const ps = nat.map((x) => x.p);
        if (new Set(ps).size !== ps.length) continue;
        const mn = Math.min(...ps), mx = Math.max(...ps);
        const gaps = mx - mn + 1 - nat.length;
        if (gaps > wilds.length) continue;
        let lo = mn, hi = mx, ok = true;
        for (let e = 0; e < wilds.length - gaps; e++) {
          if (lo > 1) lo--; else if (hi < 14) hi++; else { ok = false; break; }
        }
        if (!ok) continue;
        const byPos = new Map(nat.map((x) => [x.p, x.c]));
        const ordered = [], wildFlags = [];
        const wq = wilds.slice();
        for (let p = lo; p <= hi; p++) {
          if (byPos.has(p)) { ordered.push(byPos.get(p)); wildFlags.push(false); }
          else { ordered.push(wq.shift()); wildFlags.push(true); }
        }
        best = {
          type: 'seq', suit, cards: ordered, wild: wildFlags,
          wildCount: wilds.length, length: ordered.length,
          naturalRun: longestRun(wildFlags.map((w) => !w)), lo, hi,
        };
        break;
      }
    }
    return best;
  }

  function analyzeSet(cards, cfg) {
    if (!cfg.allowSets || cards.length < 3) return null;
    const nat = cards.filter((c) => !isWild(c));
    const wilds = cards.filter(isWild);
    if (nat.length < 2 || wilds.length > cfg.maxWild || nat.length > 8) return null;
    const rank = nat[0].r;
    if (nat.some((c) => c.r !== rank)) return null;
    const order = { S: 0, H: 1, D: 2, C: 3 };
    const ordered = nat.slice().sort((a, b) => order[a.s] - order[b.s]).concat(wilds);
    return {
      type: 'set', rank, cards: ordered, wild: ordered.map(isWild),
      wildCount: wilds.length, length: ordered.length, naturalRun: nat.length,
    };
  }

  function analyzeMeld(cards, cfg, forcedType) {
    if (forcedType === 'seq') return analyzeSequence(cards, cfg);
    if (forcedType === 'set') return analyzeSet(cards, cfg);
    return analyzeSequence(cards, cfg) || analyzeSet(cards, cfg);
  }

  return { isJoker, isTwo, isWild, analyzeSequence, analyzeSet, analyzeMeld };
});
