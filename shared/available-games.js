/* Giochi disponibili al lancio, condivisi da server, web e modalità offline. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AvailableGames = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ids = Object.freeze(['burraco', 'scala40', 'ramino', 'canasta']);
  function enabled(value) {
    const id = typeof value === 'string' ? value : (value?.rules || value)?.game || 'burraco';
    return ids.includes(id);
  }
  function assertEnabled(value) {
    if (!enabled(value)) throw new Error('Gioco non disponibile');
  }
  return Object.freeze({ ids, enabled, assertEnabled });
});
