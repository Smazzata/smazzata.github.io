/*
 * Gioco senza internet: un piccolo "server" che gira nel browser, solo per le partite contro il computer.
 * Offre all'interfaccia gli stessi eventi del server vero (come socket.io) e usa lo stesso motore
 * (engine.js, generato da scripts/bundle-engine.js). La partita in corso resta salvata sul dispositivo.
 */
(function () {
  'use strict';
  const SAVE_KEY = 'bur_offline_room';
  const BOT_NAMES = ['Nonna Pina', 'Zio Gino', 'Carmela', 'Totò', 'Rosetta', 'Peppino', 'Ninetta', 'Gegè'];
  const BOT_DELAY = 700;
  const BOT_SPEEDS = { lenta: BOT_DELAY * 1.9, normale: BOT_DELAY, veloce: BOT_DELAY * 0.45 };

  function loadEngine(url) {
    if (self.BurracoEngine) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => (self.BurracoEngine ? res() : rej(new Error('motore non disponibile')));
      s.onerror = () => rej(new Error('motore non disponibile'));
      document.head.appendChild(s);
    });
  }

  function createSocket({ engineUrl, name }) {
    const handlers = {};
    const me = name || 'Tu';
    let room = null;
    let botTimer = null;
    const store = {
      get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } },
      set(v) { try { if (v) localStorage.setItem(SAVE_KEY, JSON.stringify(v)); else localStorage.removeItem(SAVE_KEY); } catch (e) { /* memoria piena o bloccata */ } },
    };
    const fire = (ev, payload) => (handlers[ev] || []).forEach((fn) => fn(payload));

    const sock = {
      id: 'offline', connected: false,
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return sock; },
      connect() { start(); return sock; },
      disconnect() { return sock; },
      emit(ev, data, cb) {
        // risposta asincrona, come in rete
        setTimeout(() => {
          let res;
          try { res = { ok: true, ...(handle(ev, data || {}) || {}) }; } catch (e) { res = { ok: false, error: e.message }; }
          if (typeof cb === 'function') cb(res);
        }, 0);
      },
    };

    const GX = () => self.BurracoGames[room && room.rules && self.BurracoGames[room.rules.game] ? room.rules.game : 'burraco'];
    const E = () => GX().E;
    const Bot = () => GX().Bot;
    const Rules = () => self.BurracoRules;

    /** regole degli altri giochi (non Burraco) */
    function otherRules(r) {
      const m = { canasta: self.BurracoCanasta, scopa: self.BurracoScopa, briscola: self.BurracoBriscola, tressette: self.BurracoTressette, rubamazzetto: self.BurracoRubamazzetto, briscola5: self.BurracoBriscola5 };
      return r && m[r.game];
    }

    function roomInfo() {
      return {
        code: 'OFFLINE', host: 0, rules: room.rules, n: room.n, preset: self.BurracoGames[room.rules.game] && room.rules.game !== 'burraco' ? room.rules.game : Rules().matchPreset(room.rules), game: self.BurracoGames[room.rules.game] ? room.rules.game : 'burraco',
        seats: room.seats.map((s) => ({ name: s.name, isBot: !!s.isBot, connected: true, avatar: null })),
        started: !!room.game, ready: room.ready.slice(), botSpeed: room.botSpeed || 'normale',
        hints: !!room.hints, humans: 1, aids: room.aids !== false, music: null, spectators: [],
        botLevel: room.botLevel || 'normale', turnTime: 0, tutorial: !!room.tutorial, quick: 0, series: null,
        turnLeft: null, you: 0, isHost: true, offline: true,
      };
    }

    function broadcast() {
      const g = room && room.game;
      fire('state', room ? { room: roomInfo(), game: g ? E().viewFor(g, 0) : null } : { room: null, game: null });
      store.set(room);
      scheduleBot();
    }

    function startGame() {
      room.game = E().createGame({ rules: room.rules, players: room.seats.map((s) => ({ name: s.name, isBot: !!s.isBot })) });
      room.ready = [];
      room.turnCounter = 0;
      room.memo = {};
      room.memoTurn = -1;
      room.lastTurnSeat = room.game.turn;
      broadcast();
    }

    function afterAction() {
      const g = room.game;
      if (g.turn !== room.lastTurnSeat) { room.lastTurnSeat = g.turn; room.turnCounter++; }
      if (g.phase === 'handEnd') room.ready = [];
      broadcast();
    }

    function scheduleBot() {
      clearTimeout(botTimer);
      botTimer = null;
      const g = room && room.game;
      if (!g || g.phase === 'handEnd' || !room.seats[g.turn].isBot) return;
      const seat = g.turn;
      if (room.memoTurn !== room.turnCounter) { room.memo = {}; room.memoTurn = room.turnCounter; }
      room.memo.level = room.botLevel || 'normale';
      let planned = null;
      try { planned = Bot().nextAction(g, seat, room.memo); } catch (e) { planned = null; }
      const base = BOT_SPEEDS[room.botSpeed] || BOT_DELAY;
      botTimer = setTimeout(() => {
        botTimer = null;
        if (!room || room.game !== g || g.turn !== seat || g.phase === 'handEnd') return;
        try {
          const a = planned && E().isLegal(g, seat, planned) ? planned : Bot().nextAction(g, seat, room.memo);
          E().apply(g, seat, a);
        } catch (e) {
          // ripiego: pesca o scarta una carta qualsiasi
          if (g.phase === 'draw') E().apply(g, seat, { type: 'draw' });
          else {
            const legal = g.players[seat].hand.map((c) => ({ type: 'discard', cardId: c.id })).find((x) => E().isLegal(g, seat, x));
            if (legal) E().apply(g, seat, legal);
          }
        }
        afterAction();
      }, planned ? Bot().thinkMs(g, seat, planned, base) : base);
    }

    function requireRoom() { if (!room) throw new Error('Nessuna partita in corso'); return room; }

    function handle(ev, d) {
      switch (ev) {
        case 'hello':
          fire('welcome', { token: 'offline', name: me, nick: me });
          fire('social', { nick: me, avatar: null, friends: [], reqIn: [], reqOut: [], blocked: [], offline: true });
          broadcast();
          return {};
        case 'createRoom': {
          const R = Rules();
          const s40 = d.rules && d.rules.game === 'scala40';
          const rules = d.tutorial ? (s40 ? self.BurracoScala40.normalize({ players: 2 }) : R.normalize({ ...R.PRESETS[0].rules, players: 2, target: 505 }))
            : s40 ? self.BurracoScala40.normalize(d.rules) : otherRules(d.rules) ? otherRules(d.rules).normalize(d.rules) : R.normalize(d.rules);
          const free = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
          room = {
            rules, n: rules.players, ready: [], botSpeed: 'normale', botLevel: 'normale', aids: true, hints: false,
            seats: Array.from({ length: rules.players }, (_, i) => (i === 0 ? { name: me } : { name: free[i], isBot: true })),
          };
          if (d.tutorial) Object.assign(room, { tutorial: true, hints: true, botLevel: 'facile', botSpeed: 'lenta' });
          startGame();
          return { code: 'OFFLINE' };
        }
        case 'action':
          E().apply(requireRoom().game, 0, d);
          afterAction();
          return {};
        case 'hint': {
          const g = requireRoom().game;
          if (!room.hints) throw new Error('Attiva i suggerimenti nelle impostazioni');
          if (g.turn !== 0 || g.phase === 'handEnd') throw new Error('Il suggerimento è disponibile solo nel tuo turno');
          return { hint: Bot().nextAction(JSON.parse(JSON.stringify(g)), 0, { level: 'difficile' }) };
        }
        case 'surrender': {
          const g = requireRoom().game;
          if (!g || g.over) throw new Error('Nessuna partita in corso');
          E().surrender(g, 0);
          clearTimeout(botTimer);
          broadcast();
          return { done: true };
        }
        case 'endGame': case 'closeTable':
          clearTimeout(botTimer);
          room = null;
          broadcast();
          return {};
        case 'replay': {
          const g = requireRoom().game;
          if (!g || !g.lastReplay) throw new Error('Nessuna smazzata da rivedere');
          return { replay: g.lastReplay, you: 0 };
        }
        case 'ready': {
          const g = requireRoom().game;
          if (!g || g.phase !== 'handEnd') throw new Error('Nessuna smazzata da chiudere');
          if (g.over) { startGame(); return {}; }
          E().nextHand(g);
          room.ready = [];
          room.turnCounter++;
          broadcast();
          return {};
        }
        case 'leaveRoom':
          clearTimeout(botTimer);
          room = null;
          broadcast();
          return {};
        case 'setBotSpeed': requireRoom().botSpeed = BOT_SPEEDS[d.speed] ? d.speed : 'normale'; broadcast(); return {};
        case 'setBotLevel': requireRoom().botLevel = ['facile', 'normale', 'difficile', 'esperto'].includes(d.level) ? d.level : 'normale'; broadcast(); return {};
        case 'setHints': requireRoom().hints = !!d.on; broadcast(); return {};
        case 'setAids': requireRoom().aids = !!d.on; broadcast(); return {};
        case 'setTurnTime': return {};
        case 'react': fire('reaction', { seat: 0, emoji: d.emoji }); return {};
        case 'chat': fire('chat', { seat: 0, name: me, text: String(d.text || '').slice(0, 140) }); return {};
        case 'setName': case 'checkNick': return { available: true };
        default:
          throw new Error('Disponibile solo con internet');
      }
    }

    room = store.get();
    if (room && room.game) room.memoTurn = -1;
    // il "collegamento" parte quando l'interfaccia è pronta (connect), come per socket.io con autoConnect: false
    let started = false;
    function start() {
      if (started) return;
      started = true;
      loadEngine(engineUrl).then(() => {
        sock.connected = true;
        fire('connect');
      }).catch(() => {
        fire('connect_error', new Error('Motore non disponibile'));
      });
    }
    return sock;
  }

  self.LocalServer = { createSocket, loadEngine };
})();
