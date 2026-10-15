/* Burraco — Messaggi vocali al tavolo.
 * Si tiene premuta l'icona 🎤 (al tavolo o nella chat): si registra finché il dito resta giù (max 15 s),
 * lasciando il messaggio parte verso gli altri giocatori. Chi lo riceve lo sente subito (se i suoni sono
 * attivi) e lo ritrova nella chat. Nelle impostazioni si possono spegnere i vocali; al tavolo si può silenziare
 * un giocatore (dal menu sul suo nome). Il server lo inoltra soltanto, non lo salva.
 * File caricato in ordine da index.html insieme agli altri di public/js. */
'use strict';

  const VOICE_MAX_MS = 15000;
  const Voice = { rec: null, stream: null, chunks: [], start: 0, held: false, cancel: false, timer: null, tick: null };

  /** prima versione dell'app Android con il permesso del microfono */
  const APP_MIC_VERSION = 5;

  /**
   * Il 🎤 compare solo se ho i vocali attivi e al tavolo c'è almeno un'altra persona collegata che li ascolta:
   * così non si mandano vocali al nulla.
   */
  function voiceAvailable() {
    const r = S.room;
    if (!r || r.you < 0 || S.prefs.voice === false) return false;
    return r.seats.some((x, i) => x && !x.isBot && i !== r.you && x.connected && x.voice);
  }

  /** spiega come dare il permesso del microfono (app vecchia, permesso negato, nessun microfono) */
  function micHelp(err) {
    const name = err && err.name;
    let body;
    if (IN_APP && APP_VERSION < APP_MIC_VERSION) {
      body = `<p>La versione dell'app che hai non può usare il microfono. Scarica quella nuova e installala sopra: profilo e partite restano.</p>
        <div class="row"><a class="btn primary" href="${APK_URL}">📲 Scarica l'app nuova</a></div>`;
    } else if (name === 'NotFoundError' || name === 'NotReadableError') {
      body = "<p>Il microfono non risponde: forse è usato da un'altra app (una chiamata?). Riprova tra poco.</p>";
    } else if (IN_APP) {
      body = `<p>Il telefono ha bloccato il microfono per Smazzata. Per sbloccarlo:</p>
        <ol><li>apri le Impostazioni del telefono</li><li>App → Smazzata</li><li>Autorizzazioni → Microfono → Consenti</li></ol>
        <p class="muted small">Poi torna qui e tieni premuto 🎤.</p>`;
    } else {
      body = "<p>Il browser ha bloccato il microfono. Tocca il lucchetto 🔒 accanto all'indirizzo, poi Autorizzazioni → Microfono → Consenti, e ricarica la pagina.</p>";
    }
    openModal('micHelp', `<h2>🎤 Microfono</h2>${body}`);
  }

  /** chiede subito il permesso (quando si attivano i vocali nelle impostazioni), senza registrare */
  async function voiceAskPermission() {
    if (!voiceSupported()) return;
    if (IN_APP && APP_VERSION < APP_MIC_VERSION) { micHelp(); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const tr of st.getTracks()) tr.stop();
    } catch (e) { micHelp(e); }
  }

  const voiceSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== 'undefined');

  function voiceIndicator(on) {
    let el = $('#voicerec');
    if (!on) { if (el) el.remove(); clearInterval(Voice.tick); return; }
    if (!el) { el = document.createElement('div'); el.id = 'voicerec'; el.className = 'voicerec'; document.body.appendChild(el); }
    const draw = () => {
      const s = Math.floor((Date.now() - Voice.start) / 1000);
      el.textContent = `🔴 0:${String(s).padStart(2, '0')} · ${t('lascia per inviare')}`;
    };
    draw();
    clearInterval(Voice.tick);
    Voice.tick = setInterval(draw, 250);
  }

  function stopStream() {
    if (Voice.stream) for (const tr of Voice.stream.getTracks()) tr.stop();
    Voice.stream = null;
  }

  async function voiceStart() {
    if (Voice.rec) return;
    if (!voiceSupported()) { toast('Su questo dispositivo i messaggi vocali non sono disponibili', true); return; }
    if (IN_APP && APP_VERSION < APP_MIC_VERSION) { Voice.held = false; micHelp(); return; }
    try {
      Voice.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      Voice.held = false;
      micHelp(e);
      return;
    }
    // il dito si è già alzato mentre il telefono chiedeva il permesso: niente registrazione
    if (!Voice.held) { stopStream(); toast('Tieni premuto 🎤 mentre parli'); return; }
    const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
    const mime = types.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    let rec;
    try { rec = new MediaRecorder(Voice.stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined); } catch (e) { stopStream(); toast('Registrazione non riuscita', true); return; }
    Voice.chunks = [];
    Voice.cancel = false;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) Voice.chunks.push(e.data); };
    rec.onstop = async () => {
      const ms = Math.min(VOICE_MAX_MS, Date.now() - Voice.start);
      stopStream();
      if (Voice.cancel) return;
      if (ms < 700) { toast('Tieni premuto 🎤 mentre parli'); return; }
      const type = (rec.mimeType || mime || 'audio/webm');
      const blob = new Blob(Voice.chunks, { type });
      const r = await emit('voice', { audio: await blob.arrayBuffer(), mime: type, ms });
      if (!r.ok) return;
      S.chat.push({ name: S.room && S.room.seats[S.room.you] ? S.room.seats[S.room.you].name : '', seat: S.room ? S.room.you : -1, voice: URL.createObjectURL(blob), ms });
      trimChat();
      if (S.modalKind === 'log') renderLogModal();
      toast('🎤 Messaggio inviato');
    };
    Voice.rec = rec;
    Voice.start = Date.now();
    rec.start();
    voiceIndicator(true);
    if (navigator.vibrate) navigator.vibrate(30);
    Voice.timer = setTimeout(() => voiceStop(false), VOICE_MAX_MS);
  }

  function voiceStop(cancel) {
    Voice.held = false;
    if (!Voice.rec) return;
    Voice.cancel = !!cancel;
    clearTimeout(Voice.timer);
    voiceIndicator(false);
    try { Voice.rec.stop(); } catch (e) { stopStream(); }
    Voice.rec = null;
  }

  /** la chat tiene gli ultimi 100 messaggi: i vocali più vecchi liberano la memoria */
  function trimChat() {
    while (S.chat.length > 100) {
      const old = S.chat.shift();
      if (old && old.voice) URL.revokeObjectURL(old.voice);
    }
  }

  let voicePlaying = null;
  function playVoice(url) {
    if (voicePlaying) voicePlaying.pause();
    voicePlaying = new Audio(url);
    voicePlaying.play().catch(() => toast('Tocca 💬 per ascoltare il messaggio'));
  }

  // tenere premuto per parlare: giù = registra, su = invia; se il gesto viene interrotto si annulla
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('[data-voice]');
    if (!b) return;
    e.preventDefault();
    Voice.held = true;
    voiceStart();
  });
  document.addEventListener('pointerup', () => { if (Voice.held || Voice.rec) voiceStop(false); });
  document.addEventListener('pointercancel', () => { if (Voice.held || Voice.rec) voiceStop(true); });
  document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-voice]')) e.preventDefault(); });

  socket.on('voice', ({ seat, name, audio, mime, ms }) => {
    if (S.prefs.voice === false || (S.room && (S.room.muted || []).includes(seat))) return;
    const url = URL.createObjectURL(new Blob([audio], { type: mime }));
    S.chat.push({ name, seat, voice: url, ms });
    trimChat();
    showSeatBubble(seat, '🎤');
    if (S.prefs.sound) playVoice(url);
    if (S.modalKind === 'log') renderLogModal();
    else { S.unread++; toast(`🎤 ${name}`); render(); }
  });
