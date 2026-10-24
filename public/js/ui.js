/* Burraco — Interfaccia di base: disegno delle schermate, finestre, avvisi.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= UI di base ================= */
  // Piccole illustrazioni originali: panno verde, carta avorio e dettagli d'oro.
  function uiIcon(name) {
    const paths = {
      sun: '<circle cx="20" cy="20" r="8" fill="#edbd4e"/><path d="M20 2v5m0 26v5M2 20h5m26 0h5M7 7l4 4m18 18 4 4M7 33l4-4m18-18 4-4" stroke="#b18b44" stroke-width="3"/>',
      moon: '<path d="M30 31A16 16 0 0 1 12 5c-2 14 7 22 18 26Z" fill="#edbd4e"/><path d="m29 7 2 4 4 1-4 2-2 4-1-4-4-2 4-1Z" fill="#6cabc0"/>',
      mail: '<rect x="4" y="8" width="32" height="24" rx="4" fill="#fff1cd"/><path d="m5 10 15 12 15-12" stroke="#398566"/>',
      refresh: '<path d="M32 16A13 13 0 1 0 32 27M32 6v10H22" stroke="#398566" stroke-width="3"/>',
      home: '<path d="m4 19 16-14 16 14M9 16v19h22V16" fill="#fff1cd"/><path d="M16 35V23h8v12" fill="#398566"/>',
      exit: '<path d="M19 5H6v30h13M17 20h19m-7-7 7 7-7 7" stroke="#398566" stroke-width="3"/>',
      eye: '<path d="M3 20S10 8 20 8s17 12 17 12-7 12-17 12S3 20 3 20Z" fill="#fff1cd"/><circle cx="20" cy="20" r="6" fill="#398566"/>',
      check: '<circle cx="20" cy="20" r="16" fill="#398566"/><path d="m11 20 6 6 12-13" stroke="#fff1cd" stroke-width="3"/>',
      music: '<path d="M15 28V9l18-4v19M15 15l18-4" stroke="#398566" stroke-width="3"/><ellipse cx="10" cy="30" rx="6" ry="4" fill="#edbd4e"/><ellipse cx="28" cy="26" rx="6" ry="4" fill="#edbd4e"/>',
      chat: '<path d="M4 6h32v23H18L8 36v-7H4Z" fill="#fff1cd"/><path d="M11 14h18M11 21h12" stroke="#398566"/>',
      bell: '<path d="M7 29h26l-4-7v-8a9 9 0 0 0-18 0v8ZM16 34h8" fill="#edbd4e"/>',
      play: '<circle cx="20" cy="20" r="16" fill="#398566"/><path d="m16 11 13 9-13 9Z" fill="#fff1cd"/>',
      clock: '<circle cx="20" cy="21" r="15" fill="#fff1cd"/><path d="M20 11v10l8 4M15 2h10" stroke="#398566" stroke-width="3"/>',
      friends: '<path d="M23 24c7-2 13 3 13 10H20" fill="#68a6bd"/><circle cx="27" cy="15" r="6" fill="#f6cb91"/><path d="M4 35v-3c0-6 5-10 11-10s11 4 11 10v3Z" fill="#3f9470"/><circle cx="15" cy="13" r="7" fill="#f6d6a6"/><path d="M9 10c1-6 11-7 13 0-5 1-8-1-9-3" fill="#775440"/><path d="m30 4 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#f0bc45" stroke="none"/><path d="m11 27 4 4 4-4" stroke="#c7ead0"/>',
      trophy: '<path d="M11 9H5v5c0 5 4 8 9 8m15-13h6v5c0 5-4 8-9 8" fill="#efb642" stroke="#8a601c"/><path d="M10 5h20v9c0 7-4 11-10 11s-10-4-10-11Z" fill="#f5c454" stroke="#8a601c"/><path d="M13 8v6c0 3 1 5 3 6" stroke="#ffedb9" stroke-width="3"/><path d="M20 25v7m-7 0h14v4H13Z" fill="#d29a36" stroke="#8a601c"/><path d="m20 10 4 6-4 6-4-6Z" fill="#287a55" stroke="none"/>',
      medal: '<path d="m12 20-4 16 9-4 4 5 3-16" fill="#d96d54"/><path d="m24 20 7 16-8-4-5 4-1-15" fill="#72a7ba"/><circle cx="20" cy="15" r="12" fill="#f1bd46" stroke="#986b24"/><circle cx="20" cy="15" r="8" fill="#fff2c7" stroke="#c99737"/><path d="M20 9c-2 3-6 5-6 8 0 3 4 4 6 1 2 3 6 2 6-1 0-3-4-5-6-8Zm0 9-2 5h4Z" fill="#287a55" stroke="none"/>',
      calendar: '<rect x="5" y="7" width="30" height="29" rx="5" fill="#fff7df"/><path d="M5 16v-4a5 5 0 0 1 5-5h20a5 5 0 0 1 5 5v4Z" fill="#d76f57"/><path d="M12 4v7m16-7v7" stroke="#315b47" stroke-width="3"/><path d="m22 20 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z" fill="#edbd4e" stroke="#a67b2b"/><path d="M10 22h2m-2 6h2" stroke="#7b9d88" stroke-width="2"/>',
      book: '<path d="M3 10c6-3 12-3 17 1 5-4 11-4 17-1v24c-6-3-12-3-17 1-5-4-11-4-17-1Z" fill="#327451"/><path d="M5 6c5-2 10-2 15 2 5-4 10-4 15-2v24c-5-2-10-2-15 2-5-4-10-4-15-2Z" fill="#fff4d5"/><path d="M20 8v24" stroke="#c39a42"/><path d="M26 6v11l3-2 3 2V6" fill="#d76f57" stroke="none"/><path d="m9 13 7 1m-7 4 7 1m-7 4 7 1m8-1 7-1" stroke="#a6af92"/>',
      menu: '<rect x="5" y="5" width="12" height="12" rx="3" fill="#edbd4e"/><rect x="23" y="5" width="12" height="12" rx="3" fill="#6cabc0"/><rect x="5" y="23" width="12" height="12" rx="3" fill="#d87962"/><rect x="23" y="23" width="12" height="12" rx="3" fill="#66a780"/><path d="m11 8 3 3-3 3-3-3Zm18 18v6m-3-3h6" stroke="#fff5dd" stroke-width="2"/>',
      cards: '<rect x="5" y="8" width="21" height="28" rx="3" fill="#398566" transform="rotate(-9 15 22)"/><path d="m9 15 12 16m-13-8 10-10" stroke="#98c7a4"/><rect x="15" y="4" width="21" height="29" rx="3" fill="#fff5da" stroke="#9b783b" transform="rotate(7 25 18)"/><path d="M25 14c-5-6-10 2 0 9 10-7 5-15 0-9Z" fill="#d56651" stroke="none"/><path d="m20 9 2 1m7 18 2 1" stroke="#d56651" stroke-width="2"/>',
      run: '<rect x="3" y="17" width="15" height="20" rx="3" fill="#fff1cd" stroke="#ae8b41"/><rect x="13" y="10" width="15" height="20" rx="3" fill="#86b9c9"/><rect x="23" y="3" width="15" height="20" rx="3" fill="#fff1cd" stroke="#ae8b41"/><path d="m10 23 4 5-4 5-4-5Zm10-7 4 5-4 5-4-5Zm10-7 4 5-4 5-4-5Z" fill="#3b8061" stroke="none"/><path d="m6 10 4-5 5 1" stroke="#d47056" stroke-width="2"/>',
      fan: '<rect x="5" y="7" width="17" height="28" rx="3" fill="#d98169" transform="rotate(-15 14 21)"/><rect x="13" y="5" width="17" height="29" rx="3" fill="#e9c261"/><rect x="21" y="7" width="17" height="28" rx="3" fill="#fff1cd" stroke="#a18041" transform="rotate(12 29 21)"/><path d="M28 16c-4-5-8 1 0 7 8-6 4-12 0-7Z" fill="#c96c55" stroke="none"/><path d="m11 13-2 6 4-2m5-6v8" stroke="#fff1cd" stroke-width="2"/>',
      basket: '<rect x="10" y="3" width="13" height="21" rx="2" fill="#fff1cd" transform="rotate(-12 16 14)"/><rect x="20" y="5" width="13" height="21" rx="2" fill="#78afbd" transform="rotate(12 26 16)"/><path d="M17 9c-3-4-6 1 0 5 6-4 3-9 0-5Z" fill="#cb6b53" stroke="none"/><path d="M7 20h28l-4 15H11Z" fill="#e5b14e" stroke="#9d7632"/><path d="m15 22 2 11m9-11-2 11M10 25h22m-21 5h20" stroke="#bd8b38"/><path d="M6 19h30v4H6Z" fill="#3b8061"/>',
      bot: '<path d="M7 37v-5c0-5 5-8 11-8s11 3 11 8v5" fill="#398566"/><path d="M18 4v4"/><circle cx="18" cy="3" r="2" fill="#efbd52"/><path d="M6 14H3v8h4m22-8h3v8h-4" fill="#7daebf"/><rect x="6" y="8" width="24" height="19" rx="8" fill="#fff0cb"/><path d="M10 10c3-4 12-4 16 0" stroke="#e5b54f" stroke-width="2"/><circle cx="13" cy="17" r="2" fill="#294c3d" stroke="none"/><circle cx="23" cy="17" r="2" fill="#294c3d" stroke="none"/><path d="M14 22c3 2 5 2 8 0" stroke="#c38b3a"/><path d="m18 30-5-3v6l5-3 5 3v-6Z" fill="#d7775e"/><rect x="26" y="25" width="9" height="13" rx="1.5" fill="#edc35e" transform="rotate(-16 30 32)"/><rect x="29" y="24" width="9" height="13" rx="1.5" fill="#fff3d6" transform="rotate(7 33 30)"/><path d="M33 28c-2-2-4 1 0 4 4-3 2-6 0-4Z" fill="#cf6d56" stroke="none"/>',
      settings: '<path d="m16 4 1 4 6 1 3-3 5 4-2 4 3 5 4 1-1 7-4 1-4 4v4l-7 1-2-4-5-2-4 2-4-5 3-3-1-6-4-1 2-7 4 1 5-3V5Z" fill="#74ac96"/><circle cx="20" cy="21" r="9" fill="#fff0c7"/><circle cx="20" cy="21" r="4" fill="#e8b445" stroke="#986f2b"/>',
      profile: '<rect x="5" y="4" width="30" height="32" rx="9" fill="#f4c65e" stroke="#9b7935"/><path d="M10 34v-3c0-6 4-10 10-10s10 4 10 10v3" fill="#3b8764"/><circle cx="20" cy="15" r="7" fill="#fff0cb"/><path d="M14 12c2-6 10-5 12 0" fill="#775440"/>',
      stats: '<path d="M5 7v28h31" stroke="#6b927a" stroke-width="2"/><rect x="10" y="23" width="6" height="9" rx="2" fill="#6cabc0"/><rect x="20" y="16" width="6" height="16" rx="2" fill="#65a781"/><rect x="30" y="8" width="6" height="24" rx="2" fill="#edbd4e"/><path d="m9 17 10-8 7 1 7-6m-5 0h5v5" stroke="#cf6d54" stroke-width="2"/>',
      help: '<path d="M31 30c4-4 6-9 4-15C32 3 17 1 9 8 2 14 3 26 10 31l-1 6 8-3c5 1 10 0 14-4Z" fill="#fff1cd" stroke="#af8740"/><path d="M15 15c0-6 11-6 11 0 0 4-6 4-6 8" stroke="#398566" stroke-width="3"/><circle cx="20" cy="28" r="2" fill="#d66e56" stroke="none"/>',
      report: '<path d="M20 5 37 32a3 3 0 0 1-3 4H6a3 3 0 0 1-3-4L17 5a2 2 0 0 1 3 0Z" fill="#efbd52" stroke="#a4782c"/><path d="M19 14v10" stroke="#75502c" stroke-width="3"/><circle cx="19" cy="30" r="2" fill="#b95343" stroke="none"/>',
      rules: '<path d="M10 4h21v28a4 4 0 0 1-4 4H10Z" fill="#fff1cd" stroke="#b18b44"/><path d="M6 4h5v26H6a3 3 0 0 0 0 6h21" fill="#e9c875" stroke="#b18b44"/><path d="m15 12 2 2 4-5m-6 13 2 2 4-5m3-6h3m-3 10h3" stroke="#398566" stroke-width="2"/>',
      privacy: '<path d="M11 17V12a9 9 0 0 1 18 0v5" stroke="#b28b40" stroke-width="4"/><rect x="6" y="16" width="28" height="21" rx="5" fill="#398566"/><path d="M10 21v11" stroke="#86bca1" stroke-width="2"/><circle cx="20" cy="25" r="3" fill="#f4cb67" stroke="none"/><path d="M20 27v4" stroke="#f4cb67" stroke-width="3"/>'
    };
    return `<svg class="ui-icon" viewBox="0 0 40 40" fill="none" stroke="#294c3d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.cards}</svg>`;
  }

  // Simboli condivisi: solo pittogrammi scritti dall’app, mai i messaggi dei giocatori.
  const uiSymbols = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  uiSymbols.setAttribute('aria-hidden', 'true');
  uiSymbols.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  uiSymbols.innerHTML = '<defs>' + ["friends","trophy","medal","calendar","book","bot","settings","profile","stats","help","report","rules","privacy","mail","music","refresh","home","exit","eye","check","cards","chat","bell","play","clock"].map(name => '<symbol id="ui-' + name + '" viewBox="0 0 40 40">' + uiIcon(name).replace(/^.*?>|<\/svg>$/g, '') + '</symbol>').join('') + '</defs>';
  document.body.prepend(uiSymbols);

  function gameIcon(game) {
    return uiIcon(({ burraco: 'cards', scala40: 'run', ramino: 'fan', canasta: 'basket' })[game] || 'cards');
  }

  // Da usare soltanto per etichette statiche dell'app, mai per nickname, chat o nomi dei tornei.
  function uiLabel(label) {
    const symbols = {'🤖':'bot','⚙️':'settings','🏆':'trophy','🏟️':'trophy','👥':'friends','👤':'profile','📊':'stats','📖':'book','📜':'rules','💡':'help','⚠️':'report','🔒':'privacy','🔔':'bell','🔕':'bell','🔊':'music','🔇':'music','🎵':'music','▶':'play','▶️':'play','↩':'refresh','🔄':'refresh','⏱️':'clock','🐢':'clock','👁':'eye','👁️':'eye'};
    Object.assign(symbols, {'🙂':'profile','🧩':'menu','✨':'check','🔈':'music','🗣️':'chat','📳':'bell','🧠':'help','🎓':'book','🌐':'help','☀️':'sun','🌙':'moon','⬇️':'run','➡️':'run','⚡':'play','🚪':'exit','🎒':'basket','🎯':'cards'});
    return String(label).replace(/(?:\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)?|[\u{1F1E6}-\u{1F1FF}]{2})/gu, e => uiIcon(symbols[e] || 'cards'));
  }

  function emptyStateHTML(icon, title, description, action, label, target = '') {
    return `<section class="empty-state"><div class="empty-art" aria-hidden="true"><svg viewBox="0 0 240 120" focusable="false"><ellipse cx="120" cy="101" rx="94" ry="10" fill="#398566" opacity=".15"/><rect x="52" y="24" width="54" height="72" rx="7" fill="#398566" transform="rotate(-16 79 60)"/><path d="m68 49 14-9 12 17-14 9Z" fill="#f4cb67"/><rect x="139" y="25" width="48" height="68" rx="7" fill="#fff1cd" stroke="#b18b44" transform="rotate(14 163 59)"/><path d="m159 42 7 10-7 10-7-10Z" fill="#cf6d56"/><path d="m32 34 4 7 8 2-8 3-4 7-3-7-8-3 8-2ZM204 66l3 5 6 2-6 2-3 6-2-6-6-2 6-2Z" fill="#edbd4e"/></svg>${uiIcon(icon)}</div><h3>${esc(t(title))}</h3><p>${esc(t(description))}</p><button class="btn small" data-act="${action}" ${target ? `data-target="${target}"` : ''}>${esc(t(label))}</button></section>`;
  }

  function choiceMenuHTML(id, choices, value, label, rule = '', disabled = false) {
    const selected = choices.find(([v]) => String(v) === String(value)) || choices[0];
    return `<div class="choice-control"><input type="hidden" id="${esc(id)}" value="${esc(selected[0])}">
      ${disabled ? `<span class="choice-disabled">${esc(selected[1])}</span>` : `<details class="choice-menu"><summary><span class="sr-only">${esc(label)}: </span><span class="choice-value">${esc(selected[1])}</span><span aria-hidden="true">⌄</span></summary>
      <div class="choice-list" role="group" aria-label="${esc(label)}">${choices.map(([v, text]) => `<label><input type="radio" name="choice-${esc(id)}" value="${esc(v)}" ${rule ? `data-rule="${esc(rule)}"` : ''} ${String(v) === String(selected[0]) ? 'checked' : ''}><span>${esc(text)}</span></label>`).join('')}</div></details>`}</div>`;
  }

  function fieldError(field, message) {
    if (!field) { toast(message, true); return; }
    const id = field.id + '-error';
    let note = document.getElementById(id);
    if (!note) {
      note = document.createElement('p'); note.id = id; note.className = 'field-error'; note.setAttribute('role', 'alert');
      const anchor = field.closest('.field, .agecheck') || field;
      anchor.insertAdjacentElement('afterend', note);
    }
    note.textContent = t(message);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [...new Set((field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean).concat(id))].join(' '));
    field.focus();
  }

  document.addEventListener('input', (e) => {
    const field = e.target;
    if (field.getAttribute('aria-invalid') !== 'true') return;
    const id = field.id + '-error';
    document.getElementById(id)?.remove();
    field.removeAttribute('aria-invalid');
    const remaining = (field.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== id).join(' ');
    if (remaining) field.setAttribute('aria-describedby', remaining); else field.removeAttribute('aria-describedby');
  });

  document.addEventListener('change', (e) => {
    const menu = e.target.closest('.choice-menu');
    if (!menu) return;
    menu.closest('.choice-control').querySelector('input[type=hidden]').value = e.target.value;
    menu.querySelector('.choice-value').textContent = e.target.nextElementSibling.textContent;
    // Lascia aperto il gruppo durante la navigazione con le frecce.
  });
  document.addEventListener('keydown', (e) => {
    const menu = e.target instanceof Element ? e.target.closest('.choice-menu') : null;
    if (menu && menu.open && (e.key === 'Escape' || e.key === 'Enter' && e.target.matches('input'))) {
      e.preventDefault(); e.stopImmediatePropagation(); menu.open = false; menu.querySelector('summary').focus();
    }
  });
  let toastTimer = null;
  function toast(msg, error = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (error ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), error ? 3200 : 2200);
  }

  let modalTimer = null;
  function openModal(kind, html) {
    const m = $('#modal');
    const already = !m.classList.contains('hidden') && !m.classList.contains('closing');
    clearTimeout(modalTimer);
    S.modalKind = kind;
    Music.sync();
    $('#modal .modal-content').innerHTML = html;
    m.classList.remove('hidden', 'closing');
    $('#modal .modal-box').style.transform = '';
    // da una finestra all'altra: niente nuova salita, solo il contenuto che cambia
    m.classList.toggle('swap', already);
  }
  function closeModal() {
    S.modalKind = null;
    Music.sync();
    const m = $('#modal');
    if (m.classList.contains('hidden')) return;
    m.classList.add('closing');
    clearTimeout(modalTimer);
    modalTimer = setTimeout(() => { m.classList.add('hidden'); m.classList.remove('closing'); }, S.prefs.anim === false ? 0 : 200);
  }
  // trascinare giù la finestra (dalla maniglia in alto) la chiude
  (() => {
    const box = $('#modal .modal-box');
    let y0 = null, dy = 0;
    box.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.sheet-handle') && box.scrollTop > 0) return;
      if (!e.target.closest('.sheet-handle') && e.clientY - box.getBoundingClientRect().top > 60) return;
      y0 = e.clientY; dy = 0; box.style.transition = 'none';
    });
    window.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); box.style.transform = `translateY(${dy}px)`; });
    window.addEventListener('pointerup', () => {
      if (y0 == null) return;
      box.style.transition = '';
      if (dy > 90) closeModal(); else box.style.transform = '';
      y0 = null;
    });
  })();
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
      ${uiLabel(RX.describe(rules))}
      ${HOW_TO}
      ${RX.isOther(rules) ? '' : R.OTHER_VARIANTS}
    </div>`);
  }

  const HOW_TO = `
<h3>Come si gioca nell'app</h3>
<ul>
<li><b>Pescare</b>: tocca il tallone, oppure trascinalo nella tua mano. Per raccogliere gli scarti tocca il monte o trascinalo nella mano.</li>
<li><b>Selezionare</b>: tocca le carte della mano (si alzano).</li>
<li><b>Calare</b>: trascina le carte selezionate nella zona <i>“＋ Nuova combinazione”</i> del tuo tavolo, oppure premi <i>Cala</i>.</li>
<li><b>Attaccare</b>: trascina le carte su una tua combinazione, oppure selezionale e tocca la combinazione.</li>
<li><b>Scartare</b>: seleziona una carta e tocca il monte degli scarti, oppure trascinala sul monte.</li>
<li><b>Riordinare la mano</b>: trascina una carta in un altro punto della mano. Il pulsante ⇅ riordina per seme o per valore.</li>
<li>Puoi calare <b>più combinazioni insieme</b>: selezionale tutte e tocca ＋. Le giocate fatte non si possono annullare.</li>
<li>Da <svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-settings /></svg> puoi cambiare colore del tavolo, dorso delle carte, dimensione e suoni. Giocando da solo contro il computer puoi attivare i <b>suggerimenti <svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-help /></svg></b>.</li>
</ul>`;

  function rulesFormHTML(rules) {
    let html = '<div class="rules-form">';
    let group = null;
    for (const f of RX.schema(rules)) {
      if (f.group !== group) { group = f.group; html += `<h4>${uiLabel(esc(group))}</h4>`; }
      const disabled = f.requires && !rules[f.requires];
      let input;
      if (f.type === 'bool') input = `<input type="checkbox" data-rule="${f.key}" ${rules[f.key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
      else if (f.type === 'number') input = `<input type="number" data-rule="${f.key}" value="${rules[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}">`;
      else input = choiceMenuHTML('rule-' + f.key, f.choices, rules[f.key], f.label, f.key, disabled);
      const tag = f.type === 'bool' || f.type === 'number' ? 'label' : 'div';
      html += `<${tag} class="opt ${disabled ? 'disabled' : ''}"><span>${uiLabel(esc(f.label))}${f.hint ? `<br><span class="hint">${esc(f.hint)}</span>` : ''}</span>${input}</${tag}>`;
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
    const opt = (key, val, label, extra = '') => `<button class="swatch ${S.prefs[key] === val ? 'on' : ''}" data-act="pref" data-key="${key}" data-val="${val}" ${extra}>${uiLabel(label)}</button>`;
    openModal('settings', `<h2>Impostazioni</h2>
      <h4>Schermate</h4>
      <div class="row">${opt('ui', 'semplice', '🙂 Semplici')}${opt('ui', 'completa', '🧩 Complete (tutte le opzioni)')}</div>
      <h4>Leggibilità</h4>
      <div class="row">${opt('text', 'normale', 'Testo normale')}${opt('text', 'grande', 'Testo grande')}${opt('text', 'enorme', 'Testo molto grande')}</div>
      <div class="row" style="margin-top:6px">${opt('contrast', false, 'Contrasto normale')}${opt('contrast', true, '◐ Alto contrasto')}</div>
      <div class="row" style="margin-top:6px">${opt('anim', true, '✨ Animazioni')}${opt('anim', false, 'Senza animazioni')}</div>
      ${'speechSynthesis' in window ? `<div class="row" style="margin-top:6px">${opt('speak', false, '🔈 Mosse in silenzio')}${opt('speak', true, '🗣️ Leggi le mosse ad alta voce')}</div>` : ''}
      ${navigator.vibrate ? `<h4>Vibrazioni</h4>
      <div class="row">${opt('haptic', true, '📳 Sì')}${opt('haptic', false, 'No')}</div>` : ''}
      <h4>Bravura del computer nelle nuove partite</h4>
      <div class="row">${opt('botLevel', 'auto', '✨ Automatica')}${opt('botLevel', 'facile', '🙂 Facile')}${opt('botLevel', 'normale', 'Normale')}${opt('botLevel', 'difficile', '🧠 Difficile')}${opt('botLevel', 'esperto', '🎓 Esperto')}</div>
      <p class="muted small">Automatica: il computer si adatta a come giochi, per ogni gioco (più bravo se vinci spesso, più facile se perdi).</p>
      ${OFFLINE ? '' : `<h4>Promemoria</h4>
      <div class="row">${opt('remind', true, '🔔 Sì, ricordamelo')}${opt('remind', false, '🔕 No')}</div>
      <p class="muted small">Una notifica gentile se la tua serie di giorni sta per finire, se non giochi da qualche giorno o se i tuoi amici iniziano una partita. Servono le notifiche attive.</p>`}
      <h4>Lingua · Language</h4>
      <div class="row">${opt('lang', 'auto', '🌐 Automatica')}${Object.entries(LANGS).map(([id, name]) => opt('lang', id, name)).join('')}</div>
      <h4>Tema</h4>
      <div class="row">${opt('theme', 'chiaro', '☀️ Chiaro')}${opt('theme', 'scuro', '🌙 Scuro')}</div>
      <h4>Colore del tavolo</h4>
      <div class="row">${opt('felt', 'verde', '<i class="sw felt-verde"></i>Verde')}${opt('felt', 'blu', '<i class="sw felt-blu"></i>Blu')}${opt('felt', 'bordeaux', '<i class="sw felt-bordeaux"></i>Bordeaux')}${opt('felt', 'antracite', '<i class="sw felt-antracite"></i>Antracite')}</div>
      <h4>Dorso delle carte</h4>
      <div class="row">${opt('back', 'rosso', '<i class="sw back-rosso"></i>Rosso')}${opt('back', 'blu', '<i class="sw back-blu"></i>Blu')}${opt('back', 'verde', '<i class="sw back-verde"></i>Verde')}${opt('back', 'nero', '<i class="sw back-nero"></i>Nero')}${[['oro', 'b_oro', 'Oro'], ['notte', 'b_notte', 'Notte stellata'], ['smeraldo', 'b_smeraldo', 'Smeraldo']].map(([id, pid, label]) => {
        const free = ((S.progress && S.progress.unlocks) || []).includes(pid);
        return free ? opt('back', id, `<i class="sw back-${id}"></i>${label}`)
          : `<button class="swatch locked" disabled title="${esc(window.BurracoPremi.howTo(window.BurracoPremi.BY_ID[pid]))}"><i class="sw back-${id}"></i><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-privacy /></svg> ${label}</button>`;
      }).join('')}</div>
      <h4>Stile delle carte</h4>
      <div class="row">${DECKS.map(([id, label]) => opt('deck', id, `<span class="deckprev" data-deck="${id}">${cardHTML({ r: 13, s: 'H', id: -80 }, 'withpips')}${cardHTML({ r: ['americane', 'francesi', 'italiane'].includes(id) ? 3 : 7, s: 'D', id: -81 }, 'withpips')}${cardHTML({ r: 1, s: 'C', id: -82 }, 'withpips')}</span>${label}`)).join('')}</div>
      <h4>Carte</h4>
      <div class="row">${opt('big', false, 'Normali')}${opt('big', true, 'Grandi')}</div>
      <h4>Giochi calati sul tavolo</h4>
      <div class="row">${opt('melds', 'colonna', '⬇️ In colonna')}${opt('melds', 'fila', '➡️ In fila')}</div>
      <p class="muted small">In colonna le carte stanno una sotto l'altra: sul telefono restano più grandi anche con tanti giochi.</p>
      <h4>Notifiche "tocca a te"</h4>
      ${canNotify ? `<div class="row">${opt('notify', true, '🔔 Attive')}${opt('notify', false, '🔕 Disattivate')}</div>
        <p class="muted small">Arrivano quando il gioco è aperto in secondo piano.${typeof Notification !== 'undefined' && Notification.permission === 'denied' ? ' <b>Il browser le ha bloccate: riattivale dalle impostazioni del sito.</b>' : ''}</p>`
        : '<p class="muted small">Su questo dispositivo o browser le notifiche non sono disponibili.</p>'}
      <h4>${t('Musica di sottofondo')}</h4><div class="row">${opt('music', true, 'Attiva musica')}${opt('music', false, 'Disattiva musica')}</div><label class="music-volume" for="musicVolume"><span>${t('Volume musica')} <output id="musicVolumeValue" for="musicVolume">${Music.volume()}%</output></span><input id="musicVolume" type="range" min="0" max="100" step="5" value="${Music.volume()}" aria-label="${t('Volume musica')}"></label><p class="muted small">${t('Temi dedicati a menu, giochi e ricompense. La scelta resta salvata su questo dispositivo; gli effetti sonori sono indipendenti.')}</p>
      <h4>Suoni</h4>
      <div class="row">${opt('sound', true, '🔊 Attivi')}${opt('sound', false, '🔇 Disattivati')}</div>
      ${S.room && S.room.slow && S.game && !S.game.over && S.game.you >= 0 ? '<h4>Partita con calma</h4><button class="btn small danger" data-act="abandon"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> Abbandona la partita</button>' : ''}
      ${S.game && !S.game.over && S.game.you >= 0 ? `<h4>Fine della partita</h4><div class="row">
        <button class="btn small danger" data-act="surrender"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> ${partnerIsHuman() ? 'Proponi la resa al compagno' : 'Arrenditi'}</button>
        ${S.room.isHost && !S.room.daily ? '<button class="btn small" data-act="endGame"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> Termina la partita</button>' : ''}
        ${S.room.isHost ? '<button class="btn small" data-act="closeTable"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> Chiudi il tavolo</button>' : ''}</div>
        <p class="muted small">Arrendersi fa vincere gli avversari. «Termina» chiude la partita senza vincitori e riporta tutti in sala d'attesa; «Chiudi il tavolo» manda tutti alla schermata iniziale.</p>` : ''}
      ${IN_APP ? `<h4>App</h4><p class="muted small">Versione ${APP_VERSION || 'vecchia'}${S.appUpdate ? ` · <b>disponibile la ${S.appUpdate.n}</b>` : ' · aggiornata'}</p>
        ${S.appUpdate ? `<a class="btn small primary" href="${APK_URL}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-home /></svg> Scarica l'aggiornamento</a>` : ''}` : ''}
      <h4>Qualcosa non va?</h4><button class="btn small" data-act="report"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> Segnala un problema</button>
      ${S.room && S.room.isHost && (!S.game || S.game.over) ? `<h4>Torneo (si imposta tra una partita e l'altra)</h4>${seriesPickHTML(S.room.series && S.room.series.bestOf)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Aiuto: dove attaccare le carte</h4>${aidsHTML(S.room.aids !== false)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Tempo per turno</h4>${turnTimeHTML(S.room.turnTime)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Bravura del computer</h4>${botLevelHTML(S.room.botLevel)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Velocità del computer</h4>${botSpeedHTML(S.room.botSpeed)}` : ''}
      ${S.room && S.room.isHost && S.room.humans <= 1 ? `<h4>Suggerimenti <svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-help /></svg> (solo contro il computer)</h4>
        <div class="row"><button class="swatch ${S.room.hints ? 'on' : ''}" data-act="setHints" data-val="1">Attivi</button><button class="swatch ${S.room.hints ? '' : 'on'}" data-act="setHints" data-val="0">Disattivati</button></div>` : ''}`);
  }

  function aidsHTML(on) {
    return `<div class="row"><button class="swatch ${on ? 'on' : ''}" data-act="setAids" data-val="1">Attivi</button><button class="swatch ${on ? '' : 'on'}" data-act="setAids" data-val="0">Disattivati</button></div>
      <p class="muted small">Selezionando delle carte si illuminano le combinazioni a cui si possono attaccare e si vede se la nuova calata è valida.</p>`;
  }

  function turnTimeHTML(cur) {
    return `<div class="row">${[[0, 'Nessun limite'], [30, '30 s'], [60, '60 s'], [90, '90 s']]
      .map(([v, l]) => `<button class="swatch ${Number(cur || 0) === v ? 'on' : ''}" data-act="turnTime" data-val="${v}">${uiLabel(l)}</button>`).join('')}</div>`;
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
    openModal('music', `<h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-music /></svg> Musica del tavolo</h2>
      ${mu ? `<p>${esc(mu.by)} ha condiviso ${isJam ? 'una <b>Jam</b> di Spotify: entrando ascoltate tutti la stessa musica, sincronizzata.' : 'questa musica:'}</p>
        <a class="btn primary big" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="${esc(mu.url)}" target="_blank" rel="noopener noreferrer">${isJam ? '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Unisciti alla Jam su Spotify' : '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Apri in Spotify'}</a>`
        : '<p class="muted">Nessuna musica condivisa per ora.</p>'}
      ${r.isHost ? `<h4>${mu ? 'Cambia musica' : 'Condividi la musica con il tavolo'}</h4>
        <p class="muted small">Su Spotify avvia una <b>Jam</b> (dal brano in riproduzione: icona dei dispositivi → <i>Avvia una Jam</i>) e copia il link d'invito, oppure copia il link di una playlist. Poi incollalo qui.</p>
        <form id="musicform" class="row"><input id="musicin" class="grow" placeholder="https://open.spotify.com/…" autocomplete="off"><button class="btn primary">Condividi</button></form>
        ${mu ? '<button class="btn small danger" style="margin-top:8px" data-act="musicStop">Smetti di condividere</button>' : ''}` : ''}
      <p class="muted small" style="margin-top:12px">Ognuno ascolta dal proprio Spotify: per le Jam di solito serve Spotify Premium a chi la avvia.</p>`);
  }
