'use strict';

const PROGRESS_EPOCH = 1;

// Migrazione una sola volta: conserva identità, password, email, dispositivi e amicizie.
function resetProgress(data, now = Date.now()) {
  if (!data || (data.progressEpoch || 0) >= PROGRESS_EPOCH) return data;
  return {
    ...data, progressEpoch: PROGRESS_EPOCH,
    leaderboard: [], daily: [], rooms: [], tournaments: [],
    sessions: (data.sessions || []).map(([token, session]) => {
      const s = { ...session, room: null };
      delete s.localRec;
      if (s.avatar) {
        s.avatar = { ...s.avatar };
        for (const key of ['t', 'tid', 'f']) delete s.avatar[key];
      }
      return [token, s];
    }),
    leagues: (data.leagues || []).map((l) => ({ ...l, standings: {}, past: [], seasonStart: now })),
  };
}

module.exports = { PROGRESS_EPOCH, resetProgress };
