/* Burraco — Interfaccia di base: disegno delle schermate, finestre, avvisi.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= UI di base ================= */
  let toastTimer = null;
  function toast(msg, error = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (error ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), error ? 3200 : 2200);
  }

  function openModal(kind, html) {
    S.modalKind = kind;
    $('#modal .modal-content').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }
  function closeModal() {
    S.modalKind = null;
    $('#modal').classList.add('hidden');
  }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.closest('.modal-close')) closeModal();
  });

  function presetById(id) { return RX.presetById(id); }

  function rulesModal(rules, title, backToEdit = false) {
    const pid = RX.matchPreset(rules);
    const p = pid && presetById(pid);
    openModal('rules', `<div class="rules-text">
      ${backToEdit ? '<button class="btn small" data-act="backEdit">← Torna alla modifica</button>' : ''}
      <h2>${esc(title || (p ? p.name : 'Regole personalizzate'))}</h2>
      ${p ? p.intro : '<p>Regole personalizzate per questa partita. Ecco il riepilogo completo:</p>'}
      ${RX.describe(rules)}
      ${HOW_TO}
      ${RX.isS40(rules) ? '' : R.OTHER_VARIANTS}
    </div>`);
  }

  const HOW_TO = `
<h3>Come si gioca nell'app</h3>
<ul>
<li><b>Pescare</b>: tocca il tallone, oppure trascinalo nella tua mano. Per raccogliere gli scarti tocca il monte o trascinalo nella mano.</li>
<li><b>Selezionare</b>: tocca le carte della mano (si alzano).</li>
<li><b>Calare</b>: trascina le carte selezionate nella zona <i>“＋ Nuova combinazione”</i> del tuo tavolo, oppure premi <i>Cala</i>.</li>
<li><b>Attaccare</b>: trascina le carte su una tua combinazione, oppure selezionale e tocca la combinazione.</li>
<li><b>Scartare</b>: seleziona una carta e tocca il monte degli scarti, oppure trascinala sul monte, oppure fai doppio tocco sulla carta.</li>
<li><b>Riordinare la mano</b>: trascina una carta in un altro punto della mano. Il pulsante ⇅ riordina per seme o per valore.</li>
<li>Puoi calare <b>più combinazioni insieme</b>: selezionale tutte e tocca ＋. Le giocate fatte non si possono annullare.</li>
<li>Da ⚙️ puoi cambiare colore del tavolo, dorso delle carte, dimensione e suoni. Giocando da solo contro il computer puoi attivare i <b>suggerimenti 💡</b>.</li>
</ul>`;

  function rulesFormHTML(rules) {
    let html = '<div class="rules-form">';
    let group = null;
    for (const f of RX.schema(rules)) {
      if (f.group !== group) { group = f.group; html += `<h4>${esc(group)}</h4>`; }
      const disabled = f.requires && !rules[f.requires];
      let input;
      if (f.type === 'bool') input = `<input type="checkbox" data-rule="${f.key}" ${rules[f.key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
      else if (f.type === 'number') input = `<input type="number" data-rule="${f.key}" value="${rules[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}">`;
      else input = `<select data-rule="${f.key}" ${disabled ? 'disabled' : ''}>${f.choices.map(([v, l]) => `<option value="${v}" ${String(v) === String(rules[f.key]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      html += `<label class="opt ${disabled ? 'disabled' : ''}"><span>${esc(f.label)}${f.hint ? `<br><span class="hint">${esc(f.hint)}</span>` : ''}</span>${input}</label>`;
    }
    return html + '</div>';
  }

  function presetsHTML(rules) {
    const cur = RX.matchPreset(rules);
    return `<div class="presets">${RX.presets(rules).map((p) => `
      <button class="preset ${cur === p.id ? 'active' : ''}" data-act="preset" data-id="${p.id}">
        <b>${esc(p.name)}</b><span>${esc(p.tagline)}</span>
      </button>`).join('')}</div>`;
  }

  function rulesStatus(rules) {
    const pid = RX.matchPreset(rules);
    const p = pid && presetById(pid);
    return p ? `<span class="badge gold">${esc(p.name)}</span>` : '<span class="badge gold">Regole personalizzate</span>';
  }

  const DECKS = [['classiche', 'Classiche'], ['moderne', 'Moderne'], ['quattro', 'Quattro colori'], ['grandi', 'Indici grandi'], ['vintage', 'Vintage'], ['americane', 'Americane'], ['francesi', 'Francesi'], ['italiane', 'Italiane']];

  /** Il mio compagno di squadra è una persona? (allora la resa va proposta) */
  function partnerIsHuman() {
    const g = S.game, r = S.room;
    const team = g && g.teams.find((t) => t.members.includes(g.you));
    return !!(team && team.members.some((x) => x !== g.you && r.seats[x] && !r.seats[x].isBot));
  }

  function settingsModal() {
    const opt = (key, val, label, extra = '') => `<button class="swatch ${S.prefs[key] === val ? 'on' : ''}" data-act="pref" data-key="${key}" data-val="${val}" ${extra}>${label}</button>`;
    openModal('settings', `<h2>Aspetto e suoni</h2>
      <h4>Tema</h4>
      <div class="row">${opt('theme', 'chiaro', '☀️ Chiaro')}${opt('theme', 'scuro', '🌙 Scuro')}</div>
      <h4>Colore del tavolo</h4>
      <div class="row">${opt('felt', 'verde', '<i class="sw felt-verde"></i>Verde')}${opt('felt', 'blu', '<i class="sw felt-blu"></i>Blu')}${opt('felt', 'bordeaux', '<i class="sw felt-bordeaux"></i>Bordeaux')}${opt('felt', 'antracite', '<i class="sw felt-antracite"></i>Antracite')}</div>
      <h4>Dorso delle carte</h4>
      <div class="row">${opt('back', 'rosso', '<i class="sw back-rosso"></i>Rosso')}${opt('back', 'blu', '<i class="sw back-blu"></i>Blu')}${opt('back', 'verde', '<i class="sw back-verde"></i>Verde')}${opt('back', 'nero', '<i class="sw back-nero"></i>Nero')}</div>
      <h4>Stile delle carte</h4>
      <div class="row">${DECKS.map(([id, label]) => opt('deck', id, `<span class="deckprev" data-deck="${id}">${cardHTML({ r: 13, s: 'H', id: -80 }, 'withpips')}${cardHTML({ r: ['americane', 'francesi', 'italiane'].includes(id) ? 3 : 7, s: 'D', id: -81 }, 'withpips')}${cardHTML({ r: 1, s: 'C', id: -82 }, 'withpips')}</span>${label}`)).join('')}</div>
      <h4>Carte</h4>
      <div class="row">${opt('big', false, 'Normali')}${opt('big', true, 'Grandi')}</div>
      <h4>Notifiche "tocca a te"</h4>
      ${canNotify ? `<div class="row">${opt('notify', true, '🔔 Attive')}${opt('notify', false, '🔕 Disattivate')}</div>
        <p class="muted small">Arrivano quando il gioco è aperto in secondo piano.${typeof Notification !== 'undefined' && Notification.permission === 'denied' ? ' <b>Il browser le ha bloccate: riattivale dalle impostazioni del sito.</b>' : ''}</p>`
        : '<p class="muted small">Su questo dispositivo o browser le notifiche non sono disponibili.</p>'}
      <h4>Suoni</h4>
      <div class="row">${opt('sound', true, '🔊 Attivi')}${opt('sound', false, '🔇 Disattivati')}</div>
      ${S.room && S.room.slow && S.game && !S.game.over && S.game.you >= 0 ? '<h4>Partita con calma</h4><button class="btn small danger" data-act="abandon">🏳️ Abbandona la partita</button>' : ''}
      ${S.game && !S.game.over && S.game.you >= 0 ? `<h4>Fine della partita</h4><div class="row">
        <button class="btn small danger" data-act="surrender">🏳️ ${partnerIsHuman() ? 'Proponi la resa al compagno' : 'Arrenditi'}</button>
        ${S.room.isHost && !S.room.daily ? '<button class="btn small" data-act="endGame">⛔ Termina la partita</button>' : ''}
        ${S.room.isHost ? '<button class="btn small" data-act="closeTable">🚪 Chiudi il tavolo</button>' : ''}</div>
        <p class="muted small">Arrendersi fa vincere gli avversari. «Termina» chiude la partita senza vincitori e riporta tutti in sala d'attesa; «Chiudi il tavolo» manda tutti alla schermata iniziale.</p>` : ''}
      <h4>Qualcosa non va?</h4><button class="btn small" data-act="report">🐞 Segnala un problema</button>
      ${S.room && S.room.isHost && (!S.game || S.game.over) ? `<h4>Torneo (si imposta tra una partita e l'altra)</h4>${seriesPickHTML(S.room.series && S.room.series.bestOf)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Aiuto: dove attaccare le carte</h4>${aidsHTML(S.room.aids !== false)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Tempo per turno</h4>${turnTimeHTML(S.room.turnTime)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Bravura del computer</h4>${botLevelHTML(S.room.botLevel)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Velocità del computer</h4>${botSpeedHTML(S.room.botSpeed)}` : ''}
      ${S.room && S.room.isHost && S.room.humans <= 1 ? `<h4>Suggerimenti 💡 (solo contro il computer)</h4>
        <div class="row"><button class="swatch ${S.room.hints ? 'on' : ''}" data-act="setHints" data-val="1">Attivi</button><button class="swatch ${S.room.hints ? '' : 'on'}" data-act="setHints" data-val="0">Disattivati</button></div>` : ''}`);
  }

  function aidsHTML(on) {
    return `<div class="row"><button class="swatch ${on ? 'on' : ''}" data-act="setAids" data-val="1">Attivi</button><button class="swatch ${on ? '' : 'on'}" data-act="setAids" data-val="0">Disattivati</button></div>
      <p class="muted small">Selezionando delle carte si illuminano le combinazioni a cui si possono attaccare e si vede se la nuova calata è valida.</p>`;
  }

  function turnTimeHTML(cur) {
    return `<div class="row">${[[0, 'Nessun limite'], [30, '30 s'], [60, '60 s'], [90, '90 s']]
      .map(([v, l]) => `<button class="swatch ${Number(cur || 0) === v ? 'on' : ''}" data-act="turnTime" data-val="${v}">${l}</button>`).join('')}</div>`;
  }

  function botLevelHTML(cur) {
    return `<div class="row">${[['facile', '🙂 Facile'], ['normale', 'Normale'], ['difficile', '🧠 Difficile'], ['esperto', '🎓 Esperto']]
      .map(([v, l]) => `<button class="swatch ${(cur || 'normale') === v ? 'on' : ''}" data-act="botLevel" data-val="${v}">${l}</button>`).join('')}</div>`;
  }

  function botSpeedHTML(cur) {
    return `<div class="row">${[['lenta', '🐢 Lenta'], ['normale', 'Normale'], ['veloce', '⚡ Veloce']]
      .map(([v, l]) => `<button class="swatch ${cur === v ? 'on' : ''}" data-act="botSpeed" data-val="${v}">${l}</button>`).join('')}</div>`;
  }

  /** Link di Spotify → indirizzo del lettore integrato (solo per contenuti pubblici, non per le Jam) */
  function spotifyEmbed(url) {
    const m = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/.exec(url || '');
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  }

  function musicModal() {
    const r = S.room;
    const mu = r.music;
    S.musicUnseen = false;
    const embed = mu && spotifyEmbed(mu.url);
    const isJam = mu && !embed;
    openModal('music', `<h2>🎵 Musica del tavolo</h2>
      ${mu ? `<p>${esc(mu.by)} ha condiviso ${isJam ? 'una <b>Jam</b> di Spotify: entrando ascoltate tutti la stessa musica, sincronizzata.' : 'questa musica:'}</p>
        ${embed ? `<iframe class="spotify" src="${embed}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>` : ''}
        <a class="btn primary big" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="${esc(mu.url)}" target="_blank" rel="noopener">${isJam ? '▶ Unisciti alla Jam su Spotify' : '▶ Apri in Spotify'}</a>`
        : '<p class="muted">Nessuna musica condivisa per ora.</p>'}
      ${r.isHost ? `<h4>${mu ? 'Cambia musica' : 'Condividi la musica con il tavolo'}</h4>
        <p class="muted small">Su Spotify avvia una <b>Jam</b> (dal brano in riproduzione: icona dei dispositivi → <i>Avvia una Jam</i>) e copia il link d'invito, oppure copia il link di una playlist. Poi incollalo qui.</p>
        <form id="musicform" class="row"><input id="musicin" class="grow" placeholder="https://open.spotify.com/…" autocomplete="off"><button class="btn primary">Condividi</button></form>
        ${mu ? '<button class="btn small danger" style="margin-top:8px" data-act="musicStop">Smetti di condividere</button>' : ''}` : ''}
      <p class="muted small" style="margin-top:12px">Ognuno ascolta dal proprio Spotify: per le Jam di solito serve Spotify Premium a chi la avvia.</p>`);
  }
