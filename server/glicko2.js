'use strict';
// Algoritmo di Glickman (revisione 2022), scala pubblica r/RD e volatilità sigma.
const SCALE = 173.7178;
const DEFAULTS = { rating: 1500, rd: 350, volatility: 0.06, tau: 0.5, epsilon: 1e-6, maxRD: 350 };
function inactive(p, periods = 1, config = {}) {
  const c = { ...DEFAULTS, ...config };
  return { ...p, rd: Math.min(c.maxRD, Math.sqrt(p.rd ** 2 + Math.max(0, periods) * (SCALE * p.volatility) ** 2)) };
}
function update(p, results, config = {}) {
  const c = { ...DEFAULTS, ...config };
  if (![p.rating, p.rd, p.volatility, c.tau].every(Number.isFinite) || p.rd <= 0 || p.volatility <= 0 || c.tau <= 0) throw new Error('Parametri Glicko-2 non validi');
  if (!results.length) return inactive(p, 1, c);
  const mu = (p.rating - 1500) / SCALE, phi = p.rd / SCALE;
  let information = 0, gradient = 0;
  for (const r of results) {
    if (![r.rating, r.rd, r.score].every(Number.isFinite) || r.rd < 0 || r.score < 0 || r.score > 1) throw new Error('Risultato Glicko-2 non valido');
    const g = 1 / Math.sqrt(1 + 3 * (r.rd / SCALE) ** 2 / Math.PI ** 2);
    const e = Math.max(1e-12, Math.min(1 - 1e-12, 1 / (1 + Math.exp(-g * (mu - (r.rating - 1500) / SCALE)))));
    const weight = r.weight ?? 1;
    information += weight * g * g * e * (1 - e);
    gradient += weight * g * (r.score - e);
  }
  const v = 1 / information, delta = v * gradient, a = Math.log(p.volatility ** 2);
  const f = (x) => Math.exp(x) * (delta ** 2 - phi ** 2 - v - Math.exp(x)) / (2 * (phi ** 2 + v + Math.exp(x)) ** 2) - (x - a) / c.tau ** 2;
  let A = a, B;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else { let k = 1; while (f(a - k * c.tau) < 0 && k < 10000) k++; B = a - k * c.tau; }
  let fA = f(A), fB = f(B), iterations = 0;
  while (Math.abs(B - A) > c.epsilon) {
    if (++iterations > 1000) throw new Error('Glicko-2: convergenza non raggiunta');
    const C = A + (A - B) * fA / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const volatility = Math.exp(A / 2), pre = Math.sqrt(phi ** 2 + volatility ** 2);
  const rd = 1 / Math.sqrt(1 / pre ** 2 + 1 / v);
  return { ...p, rating: 1500 + SCALE * (mu + rd ** 2 * gradient), rd: Math.min(c.maxRD, SCALE * rd), volatility };
}
// Una sola osservazione per squadra avversaria. La media di n abilità indipendenti
// ha varianza sum(RD²)/n²; il cambiamento collettivo si distribuisce per varianza.
function teamUpdate(teams, scores, config = {}) {
  const aggregate = teams.map((team) => ({ rating: team.reduce((s, p) => s + p.rating, 0) / team.length,
    rd: Math.sqrt(team.reduce((s, p) => s + p.rd ** 2, 0)) / team.length,
    volatility: Math.sqrt(team.reduce((s, p) => s + p.volatility ** 2, 0)) / team.length }));
  return teams.map((team, i) => {
    const a = aggregate[i];
    const next = update(a, aggregate.flatMap((b, j) => i === j ? [] : [{ ...b, score: scores[i] === scores[j] ? 0.5 : scores[i] > scores[j] ? 1 : 0, weight: 1 / (teams.length - 1) }]), config);
    const variance = team.reduce((s, p) => s + p.rd ** 2, 0);
    return team.map((p) => ({ ...p,
      rating: p.rating + (next.rating - a.rating) * team.length * p.rd ** 2 / variance,
      rd: Math.min((config.maxRD || DEFAULTS.maxRD), Math.sqrt(Math.max(1, p.rd ** 2 + (next.rd ** 2 - a.rd ** 2) * team.length ** 2 * (p.rd ** 2 / variance) ** 2))),
      volatility: Math.max(0.001, Math.min(0.5, p.volatility * next.volatility / a.volatility)) }));
  });
}
module.exports = { DEFAULTS, SCALE, update, inactive, teamUpdate };
