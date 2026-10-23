'use strict';

// Controlli responsive e interazioni reali dei menu condivisi prima del lancio.
module.exports = async ({ cdp, shot, errors, step }) => {
  const capture = async (name) => { await cdp.run('await __W(400);'); await shot(name); };
  for (const width of [320, 375, 768]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: true });
    await cdp.run(`
      S.screen = 'home'; render(); closeModal(); await __W(300);
      if (document.documentElement.scrollWidth > innerWidth) throw Error('home fuori schermo');
      if (document.querySelectorAll('.home-shortcut svg').length !== 4) throw Error('icone community mancanti');
    `);
    await capture('polish-home-' + width);
    await cdp.run(`
      __tap('[data-act="playFriends"]');
      if (!document.querySelector('details.custom')) __tap('[data-act="setupAdvanced"]');
      document.querySelector('details.custom').open = true; await __W(100);
      if (document.querySelector('.rules-form select')) throw Error('regole con menu nativi');
      const control = document.querySelector('.rules-form .choice-control');
      const menu = control.querySelector('details'); menu.open = true;
      const option = menu.querySelector('input:not(:checked)');
      const key = option.dataset.rule, value = option.value;
      option.click();
      if (String(S.rules[key]) !== value) throw Error('regola non salvata');
      const current = document.getElementById('rule-' + key).closest('.choice-control');
      if (!current.contains(document.activeElement)) throw Error('focus perso dopo selezione');
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
      if (current.querySelector('details').open || document.activeElement.tagName !== 'SUMMARY') throw Error('chiusura menu con Escape');
      if (document.documentElement.scrollWidth > innerWidth) throw Error('regole fuori schermo');
      __tap('[data-act="goHome"]');
      await leaguesModal();
      if (document.querySelector('#leagueform select')) throw Error('campionato con menu nativi');
      document.querySelector('[name=lgperiod][value=mese]').click();
      if (!document.querySelector('[name=lgperiod][value=mese]').checked) throw Error('durata non selezionata');
      document.querySelector('#leagueform button').click();
      if (!document.querySelector('#lgname-error')) throw Error('errore nome campionato non visibile');
    `);
    await capture('polish-campionato-' + width);
    await cdp.run(`
      closeModal(); await __W(250); await tournamentsModal(null);
      document.querySelector('#tourform button').click();
      if (!document.querySelector('#tourname-error') || document.activeElement.id !== 'tourname') throw Error('errore torneo o focus mancanti');
      const input = document.querySelector('#tourname'); input.value = 'Coppa test'; input.dispatchEvent(new Event('input',{bubbles:true}));
      if (document.querySelector('#tourname-error') || input.hasAttribute('aria-invalid')) throw Error('errore non ripulito');
      if (document.querySelector('.modal-box').scrollWidth > document.querySelector('.modal-box').clientWidth) throw Error('torneo fuori schermo');
    `);
    await capture('polish-torneo-' + width);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await cdp.run(`
    S.prefs.theme = 'scuro'; applyPrefs(); await tournamentsModal(null);
    if (document.body.dataset.theme !== 'notte') throw Error('tema scuro assente');
  `);
  await capture('polish-torneo-notte');
  await cdp.run(`
    const input = document.querySelector('#tourname');
    const luminance = color => color.match(/[0-9.]+/g).slice(0,3).map(Number).map(n => n/255).map(n => n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4).reduce((sum,n,i) => sum+n*[.2126,.7152,.0722][i],0);
    const style = getComputedStyle(input), a = luminance(style.color), b = luminance(style.backgroundColor);
    if ((Math.max(a,b)+.05)/(Math.min(a,b)+.05) < 4.5) throw Error('campo torneo poco leggibile in tema scuro');
  `);
  await cdp.run(`
    openModal('choice-test', choiceMenuHTML('friend-test', [['Ada', 'Ada'], ['Bruno', 'Bruno']], 'Ada', 'Amici'));
    document.querySelector('.choice-menu').open = true;
    document.querySelector('.choice-menu input[value=Bruno]').click();
    if (document.querySelector('#friend-test').value !== 'Bruno' || document.querySelector('.choice-value').textContent !== 'Bruno') throw Error('scelta amico non aggiornata');
    settingsModal();
  `);
  await capture('polish-impostazioni-notte');
  await cdp.run(`
    S.prefs.theme = 'chiaro'; applyPrefs(); closeModal(); await __W(250); await leaguesModal();
    document.querySelector('#lgname').value = 'Lega del test';
    document.querySelector('[name=lgperiod][value=mese]').click();
    document.querySelector('#leagueform button').click(); await __W(600);
    if (!document.querySelector('#modal').textContent.includes('Lega del test') || !document.querySelector('#modal').textContent.includes('mensile')) throw Error('creazione campionato errata');
  `);
  const real = errors.filter(e => !/vibrate|Failed to load resource|favicon/.test(e));
  if (real.length) throw Error(real.join('\n'));
  step('home, regole, campionati, tornei, errori inline, tastiera e tema scuro: OK');
};
