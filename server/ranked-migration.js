'use strict';
const R = require('./ranked-rules');
const clone = (value) => JSON.parse(JSON.stringify(value));
const ratingKey = (key) => key.endsWith(':solo') ? `${key.split(':')[0]}:solo` : key;
const sum = (profiles, key) => profiles.reduce((total, p) => total + (p[key] || 0), 0);
const max = (profiles, key) => Math.max(0, ...profiles.map((p) => p[key] || 0));
const counters = ['games', 'wins', 'losses', 'draws'];

/** Unisce i vecchi formati Solo una sola volta, conservando gli originali nel profilo. */
function migrate(state, now, config) {
  if (state.version >= 2) return;
  for (const ranks of Object.values(state.players)) {
    const groups = new Map();
    for (const [key, p] of Object.entries(ranks)) {
      if (!key.endsWith(':solo')) continue;
      const target = ratingKey(key);
      if (!groups.has(target)) groups.set(target, []);
      groups.get(target).push([key, p]);
    }
    for (const [target, entries] of groups) {
      const originals = Object.fromEntries(entries.map(([key, p]) => [key, clone(p)]));
      const profiles = entries.map(([key, source]) => {
        const p = R.rollover(clone(source), now, config);
        p.history = p.history.map((h) => ({ ...h, n: h.n || Number(key.split(':')[1]) || undefined }));
        return p;
      });
      const qualified = profiles.filter((p) => p.games >= config.placements);
      const primary = [...(qualified.length ? qualified : profiles)].sort((a, b) => R.rankValue(b) - R.rankValue(a) || b.lastAt - a.lastAt)[0];
      const merged = clone(primary);
      for (const key of counters) merged[key] = sum(profiles, key);
      for (const key of ['best', 'allTimeBest', 'lastAt', 'cooldownUntil']) merged[key] = max(profiles, key);
      merged.abandons = sum(profiles, 'abandons');
      const played = profiles.filter((p) => p.games || p.seasons.length);
      const rated = played.length ? played : profiles;
      const weight = (p) => Math.max(1, p.games + sum(p.seasons, 'games'));
      const total = rated.reduce((n, p) => n + weight(p), 0);
      for (const key of ['rating', 'volatility']) merged[key] = rated.reduce((n, p) => n + p[key] * weight(p), 0) / total;
      // Non fingere maggiore certezza combinando stime nate da tre code diverse.
      merged.rd = Math.max(...rated.map((p) => p.rd));
      merged.history = [...new Map(profiles.flatMap((p) => p.history).sort((a, b) => b.at - a.at)
        .map((h) => [h.id || `${h.at}:${h.score}:${h.n}`, h])).values()].sort((a, b) => b.at - a.at).slice(0, 100);
      merged.recent = profiles.flatMap((p) => p.recent || []).sort((a, b) => b.at - a.at).slice(0, 20);
      merged.winStreak = 0; merged.lossStreak = 0;
      for (const h of merged.history) { if (h.score !== 1) break; merged.winStreak++; }
      for (const h of merged.history) { if (h.score !== 0) break; merged.lossStreak++; }
      const seasons = new Map();
      for (const s of profiles.flatMap((p) => p.seasons)) {
        if (!seasons.has(s.season)) seasons.set(s.season, []);
        seasons.get(s.season).push(s);
      }
      merged.seasons = [...seasons].sort(([a], [b]) => b - a).map(([, old]) => {
        const awarded = old.filter((s) => s.games >= config.placements);
        const best = [...(awarded.length ? awarded : old)].sort((a, b) => b.best - a.best)[0];
        return { ...best, ...Object.fromEntries(counters.map((key) => [key, sum(old, key)])) };
      });
      merged.rewards = [...new Set(profiles.flatMap((p) => p.rewards))];
      if (!qualified.length && merged.games >= config.placements) {
        const cap = merged.seasons.length ? Math.min(31, Math.floor(merged.seasons[0].best / 100)) : config.placementCap;
        const division = Math.max(0, Math.min(cap, Math.floor(R.strength(merged.rating - merged.rd, config) / 100)));
        Object.assign(merged, { tier: Math.floor(division / 4), division: division % 4, lp: 0, promo: null, legend: false });
        merged.best = Math.max(merged.best, division * 100);
        merged.allTimeBest = Math.max(merged.allTimeBest, merged.best);
      }
      merged.legacyFormats = originals;
      for (const [key] of entries) delete ranks[key];
      ranks[target] = merged;
    }
  }
  for (const match of Object.values(state.matches)) match.key = ratingKey(match.key);
  state.legends = {}; state.legendAt = 0; state.version = 2;
}
module.exports = { migrate, ratingKey };
