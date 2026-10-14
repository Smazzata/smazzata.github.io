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

  function tutorialModal(i = 0) {
    const sl = TUTORIAL[i];
    openModal('tutorial', `<div class="tutorial">
      <div class="tutdots">${TUTORIAL.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <h2>${i + 1}. ${sl.t}</h2>${sl.h}
      <div class="row" style="margin-top:14px">
        ${i ? `<button class="btn" data-act="tutStep" data-i="${i - 1}">← Indietro</button>` : ''}
        ${i < TUTORIAL.length - 1 ? `<button class="btn primary grow" data-act="tutStep" data-i="${i + 1}">Avanti →</button>`
          : '<button class="btn primary grow big" data-act="practice">🎓 Allenamento a Burraco</button>'}
      </div>${i === TUTORIAL.length - 1 ? `<div class="row" style="margin-top:8px"><button class="btn grow" data-act="practice" data-game="scala40">🂡 Allenamento a Scala 40</button></div>
        <p class="muted small">La Scala 40: ognuno per sé, apri con almeno 40 punti, poi attacca ai giochi di tutti; chi resta senza carte chiude.</p>` : ''}</div>`);
  }

  /** Consiglio dell'allenatore durante la partita di allenamento */
  function coachTip(g) {
    if (isS40Game()) return coachTipS40(g);
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
