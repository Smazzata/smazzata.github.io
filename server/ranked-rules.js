'use strict';
const Glicko = require('./glicko2');
const DAY = 86400000;
const CONFIG = { ...Glicko.DEFAULTS, periodMs: DAY, seasonMs: 90 * DAY, epoch: Date.UTC(2026, 9, 21), placements: 10,
  minLegendGames: 30, activeMs: 30 * DAY, legendRating: 2600, legendFraction: 0.01,
  ratingFloor: 1000, ratingStep: 50, placementCap: 11, baseLP: 24, lpCorrection: 0.12,
  minLP: 5, maxLP: 40, failedPromoLP: 75, promotedLP: 0, duoGap: 400,
  initialWindow: 100, middleWindow: 150, maxWindow: 250, rematchMs: 15 * 60000, abandonMs: 15 * 60000, disconnectGraceMs: 120000, turnSeconds: 60 };
const LEAGUES = ['Bronzo', 'Argento', 'Oro', 'Platino', 'Diamante', 'Maestro', 'Gran Maestro', 'Campione', 'Leggenda'];
const IDS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion', 'legend'];
const seasonOf = (now, c = CONFIG) => Math.max(0, Math.floor((now - c.epoch) / c.seasonMs));
const strength = (rating, c = CONFIG) => (rating - c.ratingFloor) / c.ratingStep * 100;
const rankValue = (p) => p.legend ? 3300 : p.tier * 400 + p.division * 100 + p.lp;
const achievement = (p) => p.legend ? 3300 : p.tier * 400 + p.division * 100 + Math.min(99, p.lp);
function fresh(now, c = CONFIG) {
  return { rating: c.rating, rd: c.rd, volatility: c.volatility, season: seasonOf(now, c), games: 0, wins: 0, losses: 0, draws: 0,
    winStreak: 0, lossStreak: 0, tier: 0, division: 0, lp: 0, promo: null, legend: false, best: 0, allTimeBest: 0, lastAt: now, history: [], seasons: [], rewards: [] };
}
function rollover(p, now, c = CONFIG) {
  const season = seasonOf(now, c);
  if (p.season === season) return p;
  const reward = `ranked-season-${p.season}-${p.best >= 3300 ? 8 : Math.min(7, Math.floor(p.best / 400))}`;
  if (p.games) {
    p.seasons.unshift({ season: p.season, games: p.games, wins: p.wins, losses: p.losses, draws: p.draws, best: p.best, rating: p.rating, tier: p.tier, division: p.division, lp: p.lp, legend: p.legend, reward });
    p.rewards.push(reward);
  }
  const visible = Math.max(0, Math.min(31, Math.floor(Math.min(rankValue(p) * 0.85, strength(p.rating, c)) / 100)));
  Object.assign(p, { season, games: 0, wins: 0, losses: 0, draws: 0, winStreak: 0, lossStreak: 0, tier: Math.floor(visible / 4), division: visible % 4, lp: 0, promo: null, legend: false, best: visible * 100 });
  return p;
}
function progress(p, score, c = CONFIG) {
  const before = rankValue(p);
  p.games++; p.wins += score === 1 ? 1 : 0; p.losses += score === 0 ? 1 : 0; p.draws += score === 0.5 ? 1 : 0;
  p.winStreak = score === 1 ? p.winStreak + 1 : 0; p.lossStreak = score === 0 ? p.lossStreak + 1 : 0;
  if (p.games <= c.placements) {
    const cap = p.seasons.length ? Math.min(31, Math.floor(p.seasons[0].best / 100)) : c.placementCap;
    const calibrated = Math.max(0, Math.min(cap, Math.floor(strength(p.rating - p.rd, c) / 100)));
    p.tier = Math.floor(calibrated / 4); p.division = calibrated % 4; p.lp = 0; p.promo = null;
  } else if (p.promo) {
    // Il pareggio non consuma una partita della serie BO3.
    if (score !== 0.5) p.promo.results.push(score);
    if (p.promo.results.filter((s) => s === 1).length === 2) { p.tier++; p.division = 0; p.lp = c.promotedLP; p.promo = null; }
    else if (p.promo.results.filter((s) => s === 0).length === 2) { p.lp = c.failedPromoLP; p.promo = null; }
  } else if (!p.legend && score !== 0.5) {
    const correction = c.lpCorrection * (strength(p.rating, c) - before);
    const amount = Math.round(Math.max(c.minLP, Math.min(c.maxLP, c.baseLP + (score === 1 ? correction : -correction))));
    p.lp += score === 1 ? amount : -amount;
    if (p.lp >= 100) {
      if (p.division < 3) { p.division++; p.lp -= 100; }
      else { p.lp = 100; if (p.tier < 7) p.promo = { results: [], target: p.tier + 1 }; }
    }
    if (p.lp < 0) {
      if (p.division > 0) { p.division--; p.lp += 100; }
      else if (p.tier > 0) { p.tier--; p.division = 3; p.lp += 100; }
      else p.lp = 0;
    }
  }
  p.best = Math.max(p.best, achievement(p)); p.allTimeBest = Math.max(p.allTimeBest, p.best);
  return rankValue(p) - before;
}
function view(p, c = CONFIG) {
  const tier = p.legend ? 8 : p.tier;
  return { league: LEAGUES[tier], id: IDS[tier], tier, division: p.legend ? null : ['IV', 'III', 'II', 'I'][p.division], lp: p.lp,
    provisional: p.games < c.placements, placements: Math.min(p.games, c.placements), placementTotal: c.placements, games: p.games, wins: p.wins, losses: p.losses, draws: p.draws,
    winStreak: p.winStreak, lossStreak: p.lossStreak, promo: p.promo, best: p.best, allTimeBest: p.allTimeBest, season: p.season, seasons: p.seasons, rewards: p.rewards,
    history: p.history, rating: p.legend ? Math.round(p.rating) : undefined };
}
module.exports = { CONFIG, DAY, LEAGUES, IDS, seasonOf, strength, rankValue, fresh, rollover, progress, view };
