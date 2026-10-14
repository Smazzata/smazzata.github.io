/* Burraco — Impara a giocare.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Impara a giocare ================= */
  const mini = (r, s) => cardHTML({ id: -100 - r * 4 - 'SHDCJ'.indexOf(s), r, s }, 'tut');
  const TUTORIAL = [
    { t: 'Lo scopo', h: `<p>Si gioca in coppia (o da soli) con due mazzi e i jolly. Lo scopo è <b>calare combinazioni</b>,
       fare dei <b>burraco</b> (combinazioni di almeno 7 carte), prendere il <b>pozzetto</b> e <b>chiudere</b> prima degli avversari.</p>
       <div class="tutcards">${mini(7, 'H')}${mini(8, 'H')}${mini(9, 'H')}${mini(10, 'H')}${mini(11, 'H')}${mini(12, 'H')}${mini(13, 'H')}</div><p class="muted small">Un burraco: 7 carte in scala.</p>` },
    { t: 'Il tuo turno', h: `<ol><li><b>Pesca</b>: tocca il tallone, oppure tocca gli scarti per prenderli <i>tutti</i>.</li>
       <li><b>Cala</b>: seleziona le carte toccandole e tocca <b>＋</b> sul tavolo (oppure trascinale lì).</li>
       <li><b>Scarta</b>: seleziona una carta e tocca gli scarti. Il turno finisce sempre con uno scarto.</li></ol>` },
    { t: 'Le combinazioni', h: `<p><b>Scala</b>: almeno 3 carte in fila dello stesso seme.</p><div class="tutcards">${mini(4, 'S')}${mini(5, 'S')}${mini(6, 'S')}</div>
       <p><b>Tris</b>: almeno 3 carte uguali.</p><div class="tutcards">${mini(9, 'H')}${mini(9, 'S')}${mini(9, 'D')}</div>
       <p class="muted small">Puoi attaccare carte alle tue combinazioni in qualsiasi turno.</p>` },
    { t: 'Le matte', h: `<p>Il <b>jolly</b> e i <b>2 (pinelle)</b> sostituiscono qualsiasi carta, ma al massimo <b>una per combinazione</b>.</p>
       <div class="tutcards">${mini(5, 'C')}${cardHTML({ id: -199, r: 0, s: 'J' }, 'tut')}${mini(7, 'C')}</div>
       <p>Un burraco senza matte è <b>pulito</b> (+200), con una matta è <b>sporco</b> (+100).</p>` },
    { t: 'Il pozzetto', h: `<p>Quando finisci le carte prendi un <b>pozzetto</b>: 11 carte nuove con cui continuare. Ogni coppia ne prende uno.</p>
       <p>Se a fine smazzata non l'hai preso: <b>−100 punti</b>.</p>` },
    { t: 'Chiudere e vincere', h: `<p>Per <b>chiudere</b> devi aver preso il pozzetto, avere almeno un burraco e scartare l'ultima carta (non una matta): <b>+100</b>.</p>
       <p>Contano le carte calate e i bonus; le carte rimaste in mano si sottraggono. Vince chi arriva per primo al punteggio stabilito.</p>
       <p>Ora prova una partita di allenamento: il computer gioca piano e il pulsante 💡 ti suggerisce la mossa.</p>` },
  ];

  const it = (r, s) => italianCardHTML({ id: -300 - r * 4 - 'dcsb'.indexOf(s), r, s }, 'tut', '');
  /** le lezioni di tutti i giochi (quella del Burraco è TUTORIAL qui sopra) */
  const LESSONS = {
    burraco: { name: '🃏 Burraco', slides: TUTORIAL },
    scala40: { name: '🂡 Scala 40', slides: [
      { t: 'Lo scopo', h: `<p>Ognuno gioca per sé con due mazzi e i jolly. Si cerca di <b>restare senza carte</b>: quelle che ti restano in mano sono punti di penalità. Chi arriva a <b>101</b> è eliminato; vince l'ultimo rimasto.</p>
         <div class="tutcards">${mini(5, 'S')}${mini(6, 'S')}${mini(7, 'S')}${mini(8, 'S')}</div>` },
      { t: 'Aprire', h: `<p>Per calare la prima volta devi <b>aprire</b> con almeno <b>40 punti</b>, anche con più giochi insieme (Asso 11, figure 10, le altre il loro valore).</p>
         <div class="tutcards">${mini(13, 'H')}${mini(13, 'S')}${mini(13, 'C')}${mini(10, 'D')}${mini(11, 'D')}${mini(12, 'D')}</div><p class="muted small">30 + 30 = 60 punti: puoi aprire.</p>` },
      { t: 'Il turno', h: `<ol><li><b>Pesca</b> dal tallone (lo scarto si prende solo se lo usi subito).</li><li>Dopo aver aperto puoi <b>attaccare</b> ai giochi di tutti.</li><li><b>Scarta</b> una carta.</li></ol>
         <p>Se un gioco ha un jolly e tu hai la carta che sostituisce, puoi <b>prenderti il jolly</b>.</p>` },
    ] },
    canasta: { name: '🎴 Canasta', slides: [
      { t: 'Lo scopo', h: `<p>Due mazzi e i jolly. Si calano <b>tris</b> di carte uguali (non scale!) e si cerca di fare <b>canaste</b>: giochi di almeno 7 carte. Pulita (senza matte) <b>+500</b>, sporca <b>+300</b>.</p>
         <div class="tutcards">${mini(9, 'H')}${mini(9, 'S')}${mini(9, 'D')}${mini(9, 'C')}${mini(9, 'H')}${mini(9, 'S')}${mini(9, 'D')}</div>` },
      { t: 'Le carte speciali', h: `<p><b>Jolly</b> e <b>2</b> sono matte, ma in un gioco devono essere meno delle carte vere.</p>
         <p>I <b>3 rossi</b> vanno subito in tavola (+100 l'uno, 800 se li hai tutti e 4); i <b>3 neri</b> scartati bloccano gli scarti.</p>
         <div class="tutcards">${mini(3, 'H')}${mini(3, 'D')}${cardHTML({ id: -299, r: 0, s: 'J' }, 'tut')}${mini(2, 'C')}</div>` },
      { t: 'Il turno e la chiusura', h: `<ol><li><b>Pesca</b> dal tallone, oppure prendi <i>tutti</i> gli scarti se usi subito la carta in cima.</li><li><b>Cala</b> e attacca ai tuoi giochi.</li><li><b>Scarta</b> una carta.</li></ol>
         <p>Il primo gioco deve valere un minimo di punti che cresce col punteggio. Per <b>chiudere</b> serve almeno una canasta.</p>` },
    ] },
    scopa: { name: '🧹 Scopa', slides: [
      { t: 'Lo scopo', h: `<p>Carte italiane da 40. Ricevi 3 carte, in tavola ce ne sono 4. A turno giochi una carta per <b>prendere</b> carte dal tavolo.</p>
         <div class="tutcards">${it(1, 'd')}${it(7, 'c')}${it(8, 's')}${it(10, 'b')}</div><p class="muted small">Fante 8, Cavallo 9, Re 10.</p>` },
      { t: 'Prendere', h: `<p>Prendi la carta <b>dello stesso valore</b>, oppure <b>più carte che sommano</b> al valore della tua. Se c'è la carta uguale devi prendere quella.</p>
         <div class="tutcards">${it(7, 'b')}<span style="align-self:center">➜</span>${it(3, 'c')}${it(4, 's')}</div>
         <p>Se pulisci il tavolo fai <b>scopa</b>: un punto!</p>` },
      { t: 'I punti', h: `<p>A fine smazzata: un punto a chi ha più <b>carte</b>, più <b>denari</b>, il <b>settebello</b> e la <b>primiera</b> (i 7 e i 6 contano di più), più le scope.</p>
         <div class="tutcards">${it(7, 'd')}</div><p class="muted small">Il settebello: tienilo d'occhio!</p>` },
    ] },
    briscola: { name: '🍷 Briscola', slides: [
      { t: 'Lo scopo', h: `<p>Carte italiane da 40, 3 carte a testa. La carta scoperta sotto il mazzo è la <b>briscola</b>: il suo seme batte tutti gli altri. Servono <b>più di 60 punti</b> su 120.</p>
         <div class="tutcards">${it(1, 'c')}${it(3, 'c')}${it(10, 'c')}${it(9, 'c')}${it(8, 'c')}</div><p class="muted small">Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2; le altre 0.</p>` },
      { t: 'La presa', h: `<p>Chi apre gioca una carta, l'altro risponde con <b>quella che vuole</b> (non c'è obbligo di seme). Vince la carta più alta del seme di apertura, a meno che qualcuno giochi una <b>briscola</b>.</p>
         <p>Chi prende pesca per primo e apre il giro dopo.</p>` },
      { t: 'Consigli', h: `<p>Non sprecare le briscole per prese senza punti; se l'avversario apre con un carico (Asso o Tre) e hai una briscola piccola, prendilo!</p>` },
    ] },
    tressette: { name: '🂱 Tressette', slides: [
      { t: 'Lo scopo', h: `<p>Carte italiane da 40, di solito in quattro a coppie: 10 carte a testa. Si fanno prese per raccogliere <b>Assi, Due, Tre e figure</b>.</p>
         <div class="tutcards">${it(3, 'c')}${it(2, 'c')}${it(1, 'c')}${it(10, 'c')}</div><p class="muted small">Le più forti: Tre, Due, Asso, poi Re, Cavallo, Fante.</p>` },
      { t: 'Rispondere al seme', h: `<p>Chi apre gioca una carta; gli altri <b>devono rispondere al seme</b>, se possono. Non ci sono briscole: prende la carta più forte del seme di uscita.</p>
         <p class="muted small">Le carte che non puoi giocare si spengono nella tua mano.</p>` },
      { t: 'I punti', h: `<p>L'<b>Asso</b> vale 1 punto, <b>Tre, Due e figure</b> 1/3 di punto, l'<b>ultima presa</b> 1 punto: 11 punti a smazzata.</p>
         <p>Con gli <b>accusi</b>: napoletana (Asso, Due, Tre dello stesso seme) o tre/quattro Assi, Due o Tre danno punti in più.</p>` },
    ] },
    briscola5: { name: '🍷 Briscola in 5', slides: [
      { t: 'Lo scopo', h: `<p>In cinque, 8 carte a testa, punti e forza come nella Briscola. Chi vince l'<b>asta</b> chiama una carta e sceglie la briscola: chi ha quella carta è il suo <b>socio segreto</b>.</p>
         <div class="tutcards">${it(1, 'd')}${it(3, 'd')}${it(10, 'd')}</div>` },
      { t: "L'asta", h: `<p>A turno si chiama una carta sempre più bassa (Asso, Tre, Re… Due) o si passa. Più bassa è la carta, più si rischia. Sul Due si rilancia il punteggio: 62, 63…</p>
         <p class="muted small">Chiamante e socio devono fare almeno 61 punti (o quelli dell'asta). Gli altri tre giocano insieme contro di loro.</p>` },
      { t: 'Il socio', h: `<p>Nessuno sa chi è il socio finché non gioca la carta chiamata. Se sei tu, aiuta il chiamante senza farti scoprire troppo presto!</p>` },
    ] },
    rubamazzetto: { name: '🃁 Rubamazzetto', slides: [
      { t: 'Lo scopo', h: `<p>Carte italiane da 40, ognuno per sé: 3 carte a testa e 4 in tavola. Vince chi alla fine ha il <b>mazzetto più alto</b>.</p>
         <div class="tutcards">${it(5, 'c')}<span style="align-self:center">➜</span>${it(5, 'b')}</div><p class="muted small">Con un 5 prendi il 5 in tavola.</p>` },
      { t: 'Rubare il mazzetto', h: `<p>La carta in cima al mazzetto di ognuno si vede. Se hai una carta <b>dello stesso valore</b>, giocala e <b>rubi tutto il mazzetto</b>!</p>
         <p class="muted small">Attento alla carta che lasci in cima al tuo: gli altri possono fare lo stesso.</p>` },
    ] },
    settemezzo: { name: '🎲 Sette e mezzo', slides: [
      { t: 'Lo scopo', h: `<p>Avvicinati a <b>7 e mezzo</b> senza superarlo. Dall'Asso al 7 le carte valgono il loro numero, le figure mezzo punto.</p>
         <div class="tutcards">${it(7, 'c')}${it(10, 's')}</div><p class="muted small">7 + ½ = 7 e mezzo!</p>` },
      { t: 'Il turno', h: `<p>Hai una carta coperta. Tocca il <b>mazzo</b> per chiederne un'altra, oppure ✋ per fermarti. Se superi 7 e mezzo <b>sballi</b>.</p>
         <p>Alla fine gioca il <b>banco</b> (passa a turno): chi ha più del banco vince una fiche. Si gioca con fiches finte.</p>` },
    ] },
  };

  function tutorialModal(i = 0, game) {
    if (game) S.tutGame = game;
    const gid = LESSONS[S.tutGame] ? S.tutGame : 'burraco';
    const slides = LESSONS[gid].slides;
    const sl = slides[i];
    const last = i === slides.length - 1;
    openModal('tutorial', `<div class="tutorial">
      <div class="row tutgames">${Object.entries(LESSONS).map(([id, l]) => `<button class="swatch ${id === gid ? 'on' : ''}" data-act="tutStep" data-i="0" data-game="${id}">${l.name}</button>`).join('')}</div>
      <div class="tutdots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <h2>${i + 1}. ${sl.t}</h2>${sl.h}
      <div class="row" style="margin-top:14px">
        ${i ? `<button class="btn" data-act="tutStep" data-i="${i - 1}">← Indietro</button>` : ''}
        ${!last ? `<button class="btn primary grow" data-act="tutStep" data-i="${i + 1}">Avanti →</button>`
          : `<button class="btn primary grow big" data-act="practice" data-game="${gid}">🎓 Allenamento a ${LESSONS[gid].name.slice(LESSONS[gid].name.indexOf(' ') + 1)}</button>`}
      </div></div>`);
  }

  /** Consiglio dell'allenatore durante la partita di allenamento */
  function coachTip(g) {
    if (isS40Game()) return coachTipS40(g);
    if (isPresaGame()) return coachTipPresa(g);
    if (isCanastaGame()) return coachTipCanasta(g);
    if (g.phase === 'handEnd') return 'Guarda il riepilogo: le carte calate e i burraco danno punti, quelle in mano li tolgono.';
    if (g.turn !== g.you) return 'Ora gioca il computer: osserva cosa cala e cosa scarta.';
    const myTeam = g.teams.find((t) => t.members.includes(g.you));
    if (g.phase === 'draw') return g.discardCount > 1 ? 'Pesca dal tallone, oppure prendi tutti gli scarti se ti servono per una combinazione.' : 'Tocca il tallone per pescare una carta.';
    const sel = S.selected.size;
    if (myTeam && myTeam.canClose) return 'Puoi chiudere! Cala tutto quello che puoi e scarta l\'ultima carta.';
    if (sel >= 3) return 'Se la casella ＋ dice "✓ Cala", toccala per calare queste carte.';
    if (sel === 1) return 'Tocca gli scarti per scartare questa carta, oppure un tuo gioco per attaccarla.';
    return 'Cerca 3 carte in scala dello stesso seme o 3 uguali e selezionale. Non sai cosa fare? Tocca 💡.';
  }

  /** Allenatore di Scopa e Briscola */
  function coachTipPresa(g) {
    if (g.game === 'rubamazzetto') {
      if (g.phase === 'handEnd') return 'Vince chi ha il mazzetto più alto.';
      if (g.turn !== g.you) return 'Ora gioca il computer: guarda se riesce a rubare un mazzetto.';
      return 'Se hai una carta uguale alla cima di un altro mazzetto, giocala per rubarlo! Altrimenti prendi la carta uguale in tavola.';
    }
    if (g.game === 'settemezzo') {
      if (g.phase === 'handEnd') return 'Chi ha più del banco vince, a parità vince il banco.';
      if (g.turn !== g.you) return 'Ora gioca un altro: guarda le carte scoperte.';
      return 'Sotto i 5 conviene chiedere carta (tocca il mazzo); da 5 in su di solito è meglio fermarsi con ✋.';
    }
    if (g.game === 'tressette') {
      if (g.phase === 'handEnd') return 'Asso 1 punto, Tre, Due e figure 1/3, l\'ultima presa 1 punto.';
      if (g.turn !== g.you) return 'Ora gioca il computer: guarda a che seme risponde.';
      return g.trick && g.trick.length ? 'Rispondi al seme (le altre carte sono spente): se puoi prendere una presa che vale, fallo con la carta più bassa che basta.'
        : 'Apri dal seme in cui hai più carte, con una carta che vale poco: tieni Tre e Due per prendere gli Assi.';
    }
    const scopa = g.game === 'scopa';
    if (g.phase === 'handEnd') return scopa ? 'Si contano carte, denari, settebello, primiera e scope.' : 'Si contano i punti delle carte prese: servono più di 60.';
    if (g.turn !== g.you) return 'Ora gioca il computer: guarda cosa sceglie.';
    if (scopa) return 'Tocca una carta e poi il tavolo: se c\'è una carta uguale o una somma giusta, la prendi. Attento a non lasciare una scopa facile!';
    return g.trick && g.trick.length ? 'Rispondi: con una carta più alta dello stesso seme o con una briscola prendi; altrimenti gioca una carta senza punti.'
      : 'Apri il giro con una carta che vale poco: tieni Assi, Tre e briscole per dopo.';
  }

  /** Allenatore della Canasta */
  function coachTipCanasta(g) {
    if (g.phase === 'handEnd') return 'Canaste e carte calate danno punti, le carte in mano li tolgono.';
    if (g.turn !== g.you) return 'Ora gioca il computer: osserva cosa cala e cosa scarta.';
    if (g.phase === 'draw') return 'Tocca il tallone per pescare, oppure gli scarti se puoi usare subito la carta in cima.';
    const sel = S.selected.size;
    if (sel >= 3) return 'Se la casella ＋ dice "✓ Cala", toccala per calare queste carte.';
    if (sel === 1) return 'Tocca gli scarti per scartare questa carta, oppure un tuo gioco per attaccarla.';
    return 'Cerca 3 carte uguali (anche con una matta) e selezionale. Non sai cosa fare? Tocca 💡.';
  }

  /** Allenatore della Scala 40 */
  function coachTipS40(g) {
    if (g.phase === 'handEnd') return 'Le carte rimaste in mano sono penalità (jolly 25, Asso 11, figure 10): chi arriva a 101 è fuori.';
    if (g.turn !== g.you) return 'Ora gioca il computer: guarda come apre e cosa scarta.';
    const me = g.teams.find((t) => t.members.includes(g.you));
    if (g.phase === 'draw') return me.opened ? 'Pesca dal tallone, oppure prendi lo scarto in cima se ti serve.' : 'Tocca il tallone per pescare. Lo scarto si può prendere solo per aprire subito con esso.';
    const sel = S.selected.size;
    if (!me.opened) {
      if (sel >= 3) return `La casella ＋ ti dice quanti punti fai: ne servono almeno ${g.cfg.opening} per aprire (anche con più giochi insieme).`;
      return `Per aprire servono ${g.cfg.opening} punti: cerca scale dello stesso seme e tris di semi diversi (Asso 11, figure 10). Non sai cosa fare? Tocca 💡.`;
    }
    if (sel === 1) return 'Tocca un gioco (anche degli altri) per attaccare la carta, o gli scarti per scartarla. Se un gioco ha un jolly, la carta giusta lo sostituisce e il jolly è tuo!';
    return 'Hai aperto: ora puoi attaccare ai giochi di tutti. Liberati delle carte che valgono di più!';
  }

  function seriesHTML(r, g) {
    const sr = r.series;
    if (!sr) return '';
    const label = (i) => (g && g.players[i] ? (i === g.you ? 'Tu' : g.players[i].name) : r.seats[i] ? r.seats[i].name : '?');
    const groups = r.n === 4 ? [[0, 2], [1, 3]] : Array.from({ length: r.n }, (_, i) => [i]);
    return `🏆 ${groups.map((gr) => `${gr.map(label).map(esc).join(' & ')} <b>${sr.wins[gr[0]]}</b>`).join(' · ')} <span class="muted small">(al meglio di ${sr.bestOf})</span>`;
  }

  function seriesPickHTML(cur) {
    return `<div class="row">${[[1, 'Partita singola'], [3, 'Al meglio di 3'], [5, 'Al meglio di 5']]
      .map(([v, l]) => `<button class="swatch ${(cur || 1) === v ? 'on' : ''}" data-act="series" data-val="${v}">${l}</button>`).join('')}</div>`;
  }
