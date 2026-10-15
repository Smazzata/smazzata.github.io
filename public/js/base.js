/* Burraco — Basi: utilità, memoria del dispositivo, modalità offline, stato, suoni, preferenze grafiche.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  const R = window.BurracoRules;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } },
  };

  // Senza internet (o aprendo la pagina con ?offline=1) si gioca contro il computer con il server locale
  const OFFLINE = (() => {
    try {
      if (/[?&]offline=1/.test(location.search)) sessionStorage.setItem('bur_offline', '1');
      return typeof io === 'undefined' || sessionStorage.getItem('bur_offline') === '1';
    } catch (e) { return typeof io === 'undefined'; }
  })();

  /* Regole del gioco scelto: Burraco (shared/rules.js) o Scala 40 (shared/scala40.js) */
  const S40R = window.BurracoScala40;
  const CANR = window.BurracoCanasta;
  // regole degli altri giochi (oltre al Burraco): stesso "contratto" (normalize, SCHEMA, PRESET, describe)
  const OTHER = { scala40: S40R, canasta: CANR, scopa: window.BurracoScopa, briscola: window.BurracoBriscola, tressette: window.BurracoTressette, rubamazzetto: window.BurracoRubamazzetto, briscola5: window.BurracoBriscola5 };
  const otherOf = (r) => (r && OTHER[r.game]) || null;
  const RX = {
    isS40: (r) => !!r && r.game === 'scala40',
    isOther: (r) => !!otherOf(r),
    normalize: (r) => (otherOf(r) ? otherOf(r).normalize(r) : R.normalize(r)),
    schema: (r) => (otherOf(r) ? otherOf(r).SCHEMA : R.SCHEMA),
    presets: (r) => (otherOf(r) ? otherOf(r).PRESETS || [otherOf(r).PRESET] : R.PRESETS),
    matchPreset: (r) => (otherOf(r) ? (otherOf(r).presetOf ? otherOf(r).presetOf(r) : r.game) : R.matchPreset(r)),
    describe: (r) => (otherOf(r) ? otherOf(r).describe(r) : R.describe(r)),
    presetById: (id) => (OTHER[id] ? OTHER[id].PRESET : id === 'scopone' ? OTHER.scopa.PRESETS[1] : R.PRESETS.find((p) => p.id === id)),
    gameName: (r) => (r && r.game === 'scopa' && r.deal && r.deal !== 3 ? 'Scopone' : { scala40: 'Scala 40', canasta: 'Canasta', scopa: 'Scopa', briscola: 'Briscola', tressette: 'Tressette', rubamazzetto: 'Rubamazzetto', briscola5: 'Briscola in 5' }[r && r.game] || 'Burraco'),
  };
  /** la partita in corso è di Scala 40? di Canasta? */
  const isS40Game = () => !!(S.game && S.game.game === 'scala40');
  const isCanastaGame = () => !!(S.game && S.game.game === 'canasta');
  /** giochi a prese (carte italiane): Scopa e Briscola */
  const isPresaGame = () => !!(S.game && S.game.presa);

  const DEFAULT_PREFS = { felt: 'verde', back: 'rosso', sound: true, big: false, theme: 'chiaro', deck: 'classiche', melds: 'colonna', lang: 'auto', text: 'normale', contrast: false, anim: true, speak: false, voice: true };
  const S = {
    token: store.get('bur_token', null),
    name: store.get('bur_name', ''),
    rules: RX.normalize(store.get('bur_rules', R.PRESETS[0].rules)),
    prefs: (() => {
      const p = { ...DEFAULT_PREFS, ...store.get('bur_prefs', {}) };
      // vecchie scelte (automatico/giorno/notte) → chiaro/scuro
      if (!['chiaro', 'scuro'].includes(p.theme)) p.theme = p.theme === 'notte' ? 'scuro' : 'chiaro';
      return p;
    })(),
    editRules: null,
    screen: 'home',
    room: null,
    game: null,
    selected: new Set(),
    sortMode: store.get('bur_sort', 'suit'), // suit | rank | manual
    handOrder: [],
    chat: [],
    unread: 0,
    connected: false,
    pendingJoin: (new URLSearchParams(location.search).get('t') || '').toUpperCase(),
    pendingProfile: new URLSearchParams(location.search).get('profilo') || '',
    social: null,
    nickCheck: null,
    customOpen: false,
    modalKind: null,
    newIds: new Set(),
    flashMeld: null,
    drag: null,
    pendingRender: false,
    justDragged: 0,
  };

  /* ================= Suoni (sintetizzati, nessun file) ================= */
  const Sound = {
    ctx: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    },
    tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur = 0.09, vol = 0.18, freq = 2400, delay = 0) {
      const c = this.ctx; if (!c) return;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
      g.gain.value = vol;
      src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start(c.currentTime + delay);
    },
    play(kind) {
      if (!S.prefs.sound || !this.ctx) return;
      switch (kind) {
        case 'select': this.tone(1500, 0.04, 'triangle', 0.05); break;
        case 'card': this.noise(0.08, 0.22, 2600); break;
        case 'meld': this.noise(0.06, 0.18, 1800); this.noise(0.06, 0.15, 2200); break;
        case 'turn': this.tone(660, 0.18, 'sine', 0.1); this.tone(880, 0.25, 'sine', 0.1, 0.12); break;
        case 'burraco': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, i * 0.09)); break;
        case 'error': this.tone(180, 0.18, 'square', 0.05); break;
        // mescolata: una raffica di fruscii (come le carte che si intrecciano)
        case 'shuffle': for (let i = 0; i < 16; i++) this.noise(0.035, 0.1 + Math.random() * 0.06, 3200 + Math.random() * 1500, i * 0.035 + Math.random() * 0.01); break;
        case 'deal': this.noise(0.05, 0.14, 2900); break;
        case 'pile': this.noise(0.14, 0.26, 1500); this.noise(0.1, 0.18, 2400, 0.06); break;
        case 'win': [523, 659, 784, 659, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, i * 0.12)); break;
      }
    },
  };

  /* ================= Preferenze grafiche ================= */
  function applyPrefs() {
    const night = S.prefs.theme === 'scuro';
    document.body.dataset.theme = night ? 'notte' : 'giorno';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = night ? '#06180f' : '#0f5132';
    document.body.dataset.felt = S.prefs.felt;
    document.body.dataset.back = S.prefs.back;
    document.body.dataset.deck = S.prefs.deck || 'classiche';
    document.body.classList.toggle('bigcards', !!S.prefs.big);
    // giochi calati in colonna (carte una sotto l'altra): più grandi sul telefono
    document.body.classList.toggle('vmelds', (S.prefs.melds || 'colonna') === 'colonna');
    // accessibilità: testo più grande, alto contrasto, niente animazioni
    document.body.dataset.text = S.prefs.text || 'normale';
    document.body.classList.toggle('contrast', !!S.prefs.contrast);
    document.body.classList.toggle('noanim', S.prefs.anim === false);
    store.set('bur_prefs', S.prefs);
  }
  applyPrefs();
