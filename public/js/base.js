/* Burraco — Basi: utilità, memoria del dispositivo, modalità offline, stato, suoni, preferenze grafiche.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  const R = window.BurracoRules;
  const CLIENT_BUILD = '2026.10.24.6';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } },
  };

  // spiegazione dell'etichetta 🏅 delle partite classificate (le sole che cambiano l'Elo)
  const PROGRESS_EPOCH = 1;
  function resetDeviceProgress(epoch = PROGRESS_EPOCH) {
    if (store.get('bur_progress_epoch', 0) >= epoch) return false;
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('smazzata_campaign_') || k.startsWith('bur_rank_')
        || ['bur_stats', 'bur_stats_seen', 'bur_local_results', 'bur_auto_level', 'bur_offline_room', 'bur_lastroom'].includes(k));
      for (const key of keys) localStorage.removeItem(key);
      const prefs = store.get('bur_prefs', {});
      if (['oro', 'notte', 'smeraldo'].includes(prefs.back)) store.set('bur_prefs', { ...prefs, back: 'rosso' });
      store.set('bur_progress_epoch', epoch);
      return true;
    } catch (e) { return false; }
  }
  resetDeviceProgress();
  const RANKED_TIP = 'Partita classificata: contribuisce al tuo grado';
  // Soglie dei gradi per gioco. Il punteggio numerico resta usato per gli abbinamenti.
  const PLAYER_RANKS = [
    { min: 0, name: 'Bronzo', id: 'bronze' },
    { min: 1100, name: 'Argento', id: 'silver' },
    { min: 1250, name: 'Oro', id: 'gold' },
    { min: 1400, name: 'Platino', id: 'platinum' },
    { min: 1600, name: 'Diamante', id: 'diamond' },
    { min: 1800, name: 'Maestro', id: 'master' },
    { min: 2000, name: 'Gran Maestro', id: 'grandmaster' },
    { min: 2200, name: 'Campione', id: 'champion' },
    { min: 2600, name: 'Leggenda', id: 'legend' },
  ];
  function playerRank(rating) {
    if (rating?.provisional) return { ...rating, min: -1, tier: -1, id: 'unranked', name: 'Non classificato', division: null };
    if (rating && typeof rating === 'object') return { ...PLAYER_RANKS[rating.tier || 0], ...rating, name: rating.league || PLAYER_RANKS[rating.tier || 0].name };
    const value = Number.isFinite(Number(rating)) ? Number(rating) : 1000;
    return [...PLAYER_RANKS].reverse().find((rank) => value >= rank.min) || PLAYER_RANKS[0];
  }
  function rankHTML(rating) {
    const rank = playerRank(rating);
    return `<span class="player-rank rank-${rank.id}"><span aria-hidden="true">◆</span> ${esc(t(rank.name))}</span>`;
  }
  // Avventura sospesa durante la preparazione della pubblicazione sul Play Store.
  // Livelli e salvataggi restano disponibili per riprendere lo sviluppo.
  const CAMPAIGN_VISIBLE = false;

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
  const OTHER = { scala40: S40R, ramino: window.BurracoRamino, canasta: CANR, scopa: window.BurracoScopa, briscola: window.BurracoBriscola, tressette: window.BurracoTressette, rubamazzetto: window.BurracoRubamazzetto, briscola5: window.BurracoBriscola5 };
  const otherOf = (r) => (r && OTHER[r.game]) || null;
  const RX = {
    isS40: (r) => !!r && (r.game === 'scala40' || r.game === 'ramino'),
    isOther: (r) => !!otherOf(r),
    normalize: (r) => (otherOf(r) ? otherOf(r).normalize(r) : R.normalize(r)),
    schema: (r) => (otherOf(r) ? otherOf(r).SCHEMA : R.SCHEMA),
    presets: (r) => (otherOf(r) ? otherOf(r).PRESETS || [otherOf(r).PRESET] : R.PRESETS),
    matchPreset: (r) => (otherOf(r) ? (otherOf(r).presetOf ? otherOf(r).presetOf(r) : r.game) : R.matchPreset(r)),
    describe: (r) => (otherOf(r) ? otherOf(r).describe(r) : R.describe(r)),
    presetById: (id) => (OTHER[id] ? OTHER[id].PRESET : id === 'scopone' ? OTHER.scopa.PRESETS[1] : R.PRESETS.find((p) => p.id === id)),
    gameName: (r) => (r && r.game === 'scopa' && r.deal && r.deal !== 3 ? 'Scopone' : { scala40: 'Scala 40', ramino: 'Ramino', canasta: 'Canasta', scopa: 'Scopa', briscola: 'Briscola', tressette: 'Tressette', rubamazzetto: 'Rubamazzetto', briscola5: 'Briscola in 5' }[r && r.game] || 'Burraco'),
  };
  /** la partita in corso è di Scala 40? di Canasta? */
  /** gioco delle regole (come Games.idOf sul server; lo Scopone è una Scopa) */
  const Games2 = { idOf: (r) => (r && r.game && (OTHER[r.game] || r.game === 'scala40') ? r.game : 'burraco') };
  const isS40Game = () => !!(S.game && S.game.game === 'scala40');
  const isCanastaGame = () => !!(S.game && S.game.game === 'canasta');
  /** giochi a prese (carte italiane): Scopa e Briscola */
  const isPresaGame = () => !!(S.game && S.game.presa);

  const DEFAULT_PREFS = { felt: 'verde', back: 'rosso', sound: true, music: false, big: false, theme: 'chiaro', deck: 'classiche', melds: 'colonna', lang: 'auto', text: 'normale', contrast: false, anim: true, speak: false, ui: 'semplice', botLevel: 'auto', remind: true, haptic: true };
  const S = {
    token: store.get('bur_token', null),
    name: store.get('bur_name', ''),
    rules: RX.normalize(AvailableGames.enabled(store.get('bur_rules', {})) ? store.get('bur_rules', R.PRESETS[0].rules) : R.PRESETS[0].rules),
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

  /* ================= Suoni (sintetizzati, nessun file) =================
   * Imitano suoni veri: lo schiocco della carta (fruscio che scende di tono + piccolo colpo sul tavolo, ogni
   * volta un po' diverso), la sfogliata del mazzo, note morbide tipo marimba per «tocca a te» e le feste.
   * Tutto passa da un leggero riverbero e da un limitatore, così niente è secco o troppo forte. */
  const Sound = {
    ctx: null, out: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; return; }
      const c = this.ctx;
      // uscita: limitatore (niente picchi) + un po' di riverbero (stanza piccola)
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      comp.connect(c.destination);
      const dry = c.createGain(); dry.gain.value = 0.9; dry.connect(comp);
      const rev = c.createConvolver();
      const len = Math.floor(c.sampleRate * 0.9), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
      rev.buffer = ir;
      const wet = c.createGain(); wet.gain.value = 0.16;
      rev.connect(wet).connect(comp);
      this.out = c.createGain();
      this.out.connect(dry); this.out.connect(rev);
      // fruscio bianco riutilizzato da tutti i suoni di carta
      const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
    },
    /** inviluppo morbido: sale in fretta (senza «clic») e si spegne */
    env(g, t, vol, attack, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    },
    /** nota tipo marimba / campanello: fondamentale + armoniche che si spengono prima */
    note(freq, delay = 0, vol = 0.09, decay = 0.6) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      [[1, 1, decay], [4, 0.25, decay * 0.25], [2.76, 0.12, decay * 0.4]].forEach(([mul, v, d]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(freq * mul, t);
        this.env(g, t, vol * v, 0.006, d);
        o.connect(g).connect(this.out);
        o.start(t); o.stop(t + d + 0.05);
      });
    },
    /** schiocco di una carta: fruscio che scende di tono, più un piccolo colpo sul tavolo */
    flick(delay = 0, vol = 0.5, bright = 1) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const v = 0.85 + Math.random() * 0.3; // ogni carta un po' diversa
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(5200 * bright * v, t);
      bp.frequency.exponentialRampToValueAtTime(1500 * bright, t + 0.05);
      const g = c.createGain(); this.env(g, t, vol * v, 0.003, 0.06);
      src.connect(hp).connect(bp).connect(g).connect(this.out);
      src.start(t, Math.random() * 0.5, 0.1);
      // il «tac» della carta che tocca il tavolo
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(190 * v, t + 0.012); o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
      this.env(og, t + 0.012, vol * 0.35, 0.002, 0.06);
      o.connect(og).connect(this.out); o.start(t + 0.012); o.stop(t + 0.1);
    },
    /** colpo sordo (errore): nota bassa che scende, discreta */
    thud(delay = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.14);
      this.env(g, t, 0.32, 0.005, 0.16);
      o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.2);
    },
    play(kind) {
      Haptic.forSound(kind); // ogni suono ha la sua vibrazione (anche a suoni spenti)
      if (!S.prefs.sound || !this.ctx) return;
      switch (kind) {
        case 'select': this.flick(0, 0.3, 1.4); break; // carta sollevata: un fruscio leggero
        case 'card': this.flick(0, 1.1); break;
        case 'deal': this.flick(0, 0.7, 1.1); break;
        case 'pile': for (let i = 0; i < 4; i++) this.flick(i * 0.045, 0.75 - i * 0.1); break;
        case 'meld': this.flick(0, 0.9); this.flick(0.07, 0.8); this.flick(0.14, 0.7); break;
        case 'turn': this.note(659.25, 0, 0.08, 0.7); this.note(987.77, 0.13, 0.07, 0.9); break; // mi - si
        case 'burraco': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.note(f, i * 0.09, 0.08, 0.9)); this.note(1567.98, 0.4, 0.04, 1.2); break;
        case 'win': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.note(f, i * 0.11, 0.08, 1)); [523.25, 659.25, 783.99].forEach((f) => this.note(f, 0.62, 0.06, 1.6)); break;
        case 'error': this.thud(); break;
        // mescolata: le carte si intrecciano sempre più fitte, poi il mazzo si ricompatta
        case 'shuffle': {
          let t = 0;
          for (let i = 0; i < 22; i++) { this.flick(t, 0.35 + Math.random() * 0.15, 1.2); t += 0.045 - i * 0.0012; }
          this.flick(t + 0.08, 0.9, 0.8);
          break;
        }
      }
    },
  };

  /* ================= Vibrazioni (feedback tattile) =================
   * Brevi e diverse per ogni azione, come nelle app di giochi curate. Il telefono vibra solo dopo il primo tocco
   * dell'utente (regola dei browser); si spengono in Impostazioni. */
  const Haptic = {
    touched: false,
    v(p) { if (S.prefs.haptic === false || !this.touched || !navigator.vibrate) return; try { navigator.vibrate(p); } catch (e) { /* niente */ } },
    tap() { this.v(6); },
    select() { this.v(10); },
    play() { this.v(16); },
    success() { this.v([14, 40, 22]); },
    error() { this.v([28, 45, 28]); },
    turn() { this.v([18, 70, 18]); },
    big() { this.v([24, 50, 24, 50, 60]); },
    forSound(kind) {
      const m = { select: 'select', card: 'play', deal: null, pile: 'play', meld: 'success', turn: 'turn', burraco: 'big', win: 'big', error: 'error', shuffle: null }[kind];
      if (m) this[m]();
    },
  };
  // un tocco leggerissimo su pulsanti e riquadri (il primo tocco abilita anche le vibrazioni)
  document.addEventListener('pointerdown', (e) => {
    Haptic.touched = true;
    if (e.target.closest && e.target.closest('.btn, .ico, .iconbtn, .menuitem, .gtile, .swatch, .preset, .seatchip')) Haptic.tap();
  }, true);

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
