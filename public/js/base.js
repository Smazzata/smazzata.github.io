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

  const DEFAULT_PREFS = { felt: 'verde', back: 'rosso', sound: true, big: false, theme: 'chiaro', deck: 'classiche' };
  const S = {
    token: store.get('bur_token', null),
    name: store.get('bur_name', ''),
    rules: R.normalize(store.get('bur_rules', R.PRESETS[0].rules)),
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
    lastTap: { id: null, t: 0 },
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
    noise(dur = 0.09, vol = 0.18, freq = 2400) {
      const c = this.ctx; if (!c) return;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
      g.gain.value = vol;
      src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
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
    store.set('bur_prefs', S.prefs);
  }
  applyPrefs();
