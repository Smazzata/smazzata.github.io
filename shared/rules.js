/*
 * Regole configurabili del Burraco: schema delle opzioni, preset di partenza
 * e generatore della spiegazione testuale delle regole della partita.
 * Condiviso tra server (CommonJS) e browser (window.BurracoRules).
 *
 * Fonti: regolamento FIBUR come riportato da pagat.com/rummy/burraco.html;
 * pagat.com/rummy/buraco.html (Buraco aberto/fechado); burraconline.com (Reale, varianti locali).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurracoRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  /* ---------- Schema delle regole modificabili ---------- */
  const SCHEMA = [
    { group: 'Tavolo', key: 'players', label: 'Giocatori', type: 'select',
      choices: [[4, '4 giocatori (2 coppie)'], [2, '2 giocatori'], [3, '3 giocatori (squadre in partita)']] },
    { group: 'Tavolo', key: 'target', label: 'Punteggio per vincere', type: 'number', min: 100, max: 20000, step: 5,
      hint: 'Valori tipici: 505, 1005, 2005 (Italia), 3000 (Brasile)' },
    { group: 'Tavolo', key: 'terms', label: 'Terminologia', type: 'select',
      choices: [['it', 'Italiana (burraco, pozzetto)'], ['br', 'Brasiliana (canastra, morto)']] },

    { group: 'Carte e matte', key: 'jokers', label: 'Jolly nel mazzo', type: 'select',
      choices: [[4, '4 jolly (108 carte)'], [2, '2 jolly (106 carte)'], [0, 'Nessun jolly (104 carte, solo pinelle)']] },
    { group: 'Carte e matte', key: 'maxWild', label: 'Matte per combinazione', type: 'select',
      choices: [[1, 'Al massimo 1'], [2, 'Al massimo 2']] },
    { group: 'Carte e matte', key: 'valJoker', label: 'Valore del jolly', type: 'select', choices: [[30, '30'], [20, '20'], [50, '50']] },
    { group: 'Carte e matte', key: 'valTwo', label: 'Valore della pinella (2)', type: 'select', choices: [[20, '20'], [10, '10']] },

    { group: 'Combinazioni', key: 'allowSets', label: 'Tris ammessi (carte dello stesso valore)', type: 'bool' },
    { group: 'Combinazioni', key: 'noDuplicateSets', label: 'Un solo tris per valore per squadra', type: 'bool', requires: 'allowSets' },
    { group: 'Combinazioni', key: 'aceBothEnds', label: 'Scala da Asso ad Asso (14 carte)', type: 'bool' },

    { group: 'Scarti', key: 'pile', label: 'Monte degli scarti', type: 'select',
      choices: [['open', 'Aperto: si raccoglie sempre tutto'], ['closed', 'Chiuso: si raccoglie solo usando subito la carta in cima']] },
    { group: 'Scarti', key: 'initialDiscard', label: 'Una carta scoperta sugli scarti a inizio smazzata', type: 'bool' },

    { group: 'Pozzetto e chiusura', key: 'closeNeeds', label: 'Per chiudere serve', type: 'select',
      choices: [['any', 'Almeno un burraco (anche sporco)'], ['clean', 'Almeno un burraco pulito']] },
    { group: 'Pozzetto e chiusura', key: 'closeWildForbidden', label: 'Vietato chiudere scartando una matta', type: 'bool' },
    { group: 'Pozzetto e chiusura', key: 'stockEnd', label: 'Quando il tallone finisce', type: 'select',
      choices: [['twoLeft', 'La smazzata finisce quando restano 2 carte'], ['mortoToStock', 'Un pozzetto non preso diventa il nuovo tallone']] },
    { group: 'Pozzetto e chiusura', key: 'vulnerability', label: 'Vulnerabilità: a metà obiettivo la prima calata deve valere ≥ 75', type: 'bool' },

    { group: 'Punteggio', key: 'bonusClean', label: 'Burraco pulito', type: 'select', choices: [[200, '200'], [300, '300']] },
    { group: 'Punteggio', key: 'bonusDirty', label: 'Burraco sporco', type: 'select', choices: [[100, '100'], [150, '150']] },
    { group: 'Punteggio', key: 'bonusSemi', label: 'Burraco semipulito (8+ carte, 7 naturali in fila)', type: 'select', choices: [[0, 'Non previsto'], [150, '150']] },
    { group: 'Punteggio', key: 'bonusSeq13', label: 'Scala pulita di 13 carte', type: 'select', choices: [[0, 'Nessun bonus extra'], [500, '500']] },
    { group: 'Punteggio', key: 'bonusSeq14', label: 'Scala pulita di 14 carte (A-A)', type: 'select', choices: [[0, 'Nessun bonus extra'], [1000, '1000']], requires: 'aceBothEnds' },
    { group: 'Punteggio', key: 'bonusClose', label: 'Bonus chiusura', type: 'select', choices: [[100, '100'], [50, '50'], [0, '0']] },
    { group: 'Punteggio', key: 'penaltyPozzetto', label: 'Penalità pozzetto non preso', type: 'select', choices: [[-100, '−100'], [0, 'Nessuna']] },
    { group: 'Punteggio', key: 'noPenaltyIfNoneTaken', label: 'Niente penalità se nessuno ha preso il pozzetto', type: 'bool' },
  ];

  /* ---------- Preset (le varianti esistenti come punto di partenza) ---------- */
  const BASE_IT = {
    players: 4, target: 2005, terms: 'it',
    jokers: 4, maxWild: 1, valJoker: 30, valTwo: 20,
    allowSets: true, noDuplicateSets: true, aceBothEnds: false,
    pile: 'open', initialDiscard: true,
    closeNeeds: 'any', closeWildForbidden: true, stockEnd: 'twoLeft', vulnerability: false,
    bonusClean: 200, bonusDirty: 100, bonusSemi: 0, bonusSeq13: 0, bonusSeq14: 0,
    bonusClose: 100, penaltyPozzetto: -100, noPenaltyIfNoneTaken: false,
  };
  const BASE_BR = {
    ...BASE_IT, target: 3000, terms: 'br', valJoker: 20, valTwo: 10,
    allowSets: false, noDuplicateSets: false, aceBothEnds: true,
    initialDiscard: false, closeNeeds: 'clean', closeWildForbidden: false,
    stockEnd: 'mortoToStock', vulnerability: true, bonusSeq13: 500, bonusSeq14: 1000, noPenaltyIfNoneTaken: true,
  };

  const PRESETS = [
    {
      id: 'classico', name: 'Burraco Classico (FIBUR)',
      tagline: 'La versione italiana ufficiale da torneo: jolly e pinelle, scale e tris, pozzetti.',
      intro: `<p>La forma più diffusa in Italia, codificata dalla <b>FIBUR</b> (Federazione Italiana Burraco).
        Si gioca di norma in 4 a coppie, ma anche in 2 o in 3. Con la regola opzionale del <b>semipulito</b> (150 punti)
        molti circoli premiano i burraco con una sola matta e almeno 7 carte naturali in fila.</p>`,
      rules: { ...BASE_IT },
    },
    {
      id: 'reale', name: 'Burraco Reale',
      tagline: 'Senza jolly e solo scale: più difficile, con bonus enormi per le scale complete.',
      intro: `<p>Evoluzione più recente del classico: si gioca con <b>104 carte senza jolly</b>, le uniche matte sono le pinelle,
        e si possono calare <b>solo scale</b>. L'Asso può chiudere la scala in alto e in basso: la scala completa
        da Asso ad Asso (14 carte) vale 1000 punti, quella di 13 carte 500. Non ha un regolamento federale unico.</p>`,
      rules: { ...BASE_IT, jokers: 0, allowSets: false, noDuplicateSets: false, aceBothEnds: true, bonusSeq13: 500, bonusSeq14: 1000 },
    },
    {
      id: 'aberto', name: 'Buraco Brasiliano Aberto',
      tagline: 'L\'originale sudamericano “aperto”: solo scale, morti, serve una canastra pulita per battere.',
      intro: `<p>Il Buraco nasce tra <b>Uruguay e Argentina</b> negli anni '40 ed è molto popolare in Brasile
        (anche come Canastra o Biriba): il Burraco italiano ne deriva. Nella versione <b>aberto</b> si calano solo scale,
        il monte degli scarti parte vuoto, i pozzetti si chiamano <b>morti</b> e, se il tallone finisce, un morto non preso
        diventa il nuovo tallone. Le squadre a metà del punteggio sono <b>vulnerabili</b>.</p>`,
      rules: { ...BASE_BR },
    },
    {
      id: 'fechado', name: 'Buraco Brasiliano Fechado',
      tagline: 'Il Buraco “chiuso”: tris ammessi, ma lo scarto si raccoglie solo usando la carta in cima.',
      intro: `<p>Versione <b>fechado</b> (chiusa) del Buraco brasiliano: sono ammessi i tris (<i>lavadeira</i>) e
        degli scarti si vede solo la carta in cima. Il monte si può raccogliere solo usando subito quella carta
        in una combinazione; per battere basta una canastra qualsiasi.</p>`,
      rules: { ...BASE_BR, allowSets: true, pile: 'closed', closeNeeds: 'any' },
    },
  ];

  const OTHER_VARIANTS = `
<h3>Altre varianti esistenti</h3>
<ul>
<li><b>Burraco a 3</b>: si ottiene scegliendo 3 giocatori in qualsiasi preset (pozzetti da 18 e da 11, squadre che si formano in partita).</li>
<li><b>Tarca</b>, <b>Andromeda</b>, <b>Cassiopea</b>: varianti italiane di circolo con obiettivi diversi (es. restare con una sola carta): non giocabili qui.</li>
<li><b>Burako</b>: versione argentina/uruguaiana con tessere al posto delle carte.</li>
<li>Regole “della casa” comuni (impostabili qui sopra): jolly a 50 punti, burraco pulito 300 e sporco 150, obiettivo 3000/3500.</li>
</ul>`;

  const HOW_TO = `
<h3>Come si usa l'app</h3>
<ul>
<li><b>Tocca</b> le carte della mano per selezionarle.</li>
<li><b>Cala</b> crea una nuova combinazione con le carte selezionate.</li>
<li>Per <b>attaccare</b>, seleziona le carte e tocca una combinazione della tua squadra.</li>
<li><b>Scarta</b>: seleziona una carta e tocca il monte degli scarti (o trascinala sul monte).</li>
<li><b>Annulla</b> riporta il turno a subito dopo la pesca.</li>
</ul>`;

  /* ---------- Validazione ---------- */
  function normalize(input) {
    const preset = PRESETS[0].rules;
    const out = {};
    for (const f of SCHEMA) {
      let v = input && input[f.key] !== undefined ? input[f.key] : preset[f.key];
      if (f.type === 'bool') v = v === true || v === 'true' || v === 1 || v === '1';
      else if (f.type === 'number') {
        v = Math.round(Number(v));
        if (!Number.isFinite(v)) v = preset[f.key];
        v = Math.min(f.max, Math.max(f.min, v));
      } else {
        const match = f.choices.find((c) => String(c[0]) === String(v));
        v = match ? match[0] : preset[f.key];
      }
      out[f.key] = v;
    }
    if (!out.allowSets) out.noDuplicateSets = false;
    if (!out.aceBothEnds) out.bonusSeq14 = 0;
    return out;
  }

  function matchPreset(rules) {
    const r = normalize(rules);
    for (const p of PRESETS) {
      const pr = normalize({ ...p.rules, players: r.players, target: r.target });
      if (SCHEMA.every((f) => pr[f.key] === r[f.key])) return p.id;
    }
    return null;
  }

  /* ---------- Spiegazione delle regole generata dalla configurazione ---------- */
  function describe(input) {
    const r = normalize(input);
    const br = r.terms === 'br';
    const B = br ? 'canastra' : 'burraco';
    const P = br ? 'morto' : 'pozzetto';
    const Pp = br ? 'morti' : 'pozzetti';
    const pul = br ? 'limpa' : 'pulito';
    const spo = br ? 'suja' : 'sporco';
    const nCards = 104 + r.jokers;
    const n = r.players;
    const matte = r.jokers ? `i <b>jolly</b> e i <b>2 (pinelle)</b>` : `solo i <b>2 (pinelle)</b>, perché si gioca senza jolly`;
    const h = [];

    h.push(`<h3>Materiale e giocatori</h3>
<p>${n === 4 ? '<b>4 giocatori</b> in due coppie: i compagni siedono uno di fronte all\'altro.' :
      n === 2 ? '<b>2 giocatori</b>, uno contro uno.' : '<b>3 giocatori</b>: all\'inizio ognuno gioca per sé.'}
Due mazzi da 52 carte${r.jokers ? ` più ${r.jokers} jolly` : ''} (<b>${nCards} carte</b>). Si gioca in senso orario.</p>`);

    h.push(`<h3>Distribuzione</h3><ul>
<li>Ogni giocatore riceve <b>11 carte</b>.</li>
<li>${n === 3 ? `Due ${Pp} coperti: uno da <b>18 carte</b> e uno da <b>11 carte</b>.` : `Due ${Pp} coperti da <b>11 carte</b> ciascuno.`}</li>
<li>${r.initialDiscard ? 'Una carta viene girata scoperta per iniziare il monte degli scarti.' : 'Il monte degli scarti parte vuoto.'} Le restanti carte formano il <b>tallone</b>.</li>
<li>Inizia il giocatore alla sinistra di chi distribuisce; il mazziere ruota a ogni smazzata.</li></ul>`);

    if (n === 3) {
      h.push(`<h3>Squadre a 3 giocatori</h3><ul>
<li>Il primo giocatore che finisce le carte prende il ${P} da <b>18</b> e da quel momento gioca <b>da solo</b>.</li>
<li>Gli altri due diventano <b>coppia</b>: i loro giochi si uniscono, possono attaccare l'uno ai giochi dell'altro e prenderanno il ${P} da <b>11</b>.</li>
<li>Il punteggio della coppia va a entrambi. Prima che le squadre si formino conviene calare con prudenza.</li></ul>`);
    }

    const pileTxt = r.pile === 'open'
      ? 'raccogli <b>tutto</b> il monte degli scarti (sempre visibile per intero; non se ne può prendere solo una parte)'
      : 'raccogli il monte degli scarti, di cui si vede <b>solo la carta in cima</b>: è permesso solo se usi <b>subito</b> quella carta in una nuova combinazione con carte della tua mano, oppure attaccandola a un gioco della tua squadra (una matta in cima si può usare solo in una combinazione nuova)';
    h.push(`<h3>Il turno</h3><ol>
<li><b>Pesca</b> la prima carta del tallone <i>oppure</i> ${pileTxt}.</li>
<li>Facoltativamente <b>cala</b> nuove combinazioni o <b>attacca</b> carte ai giochi della tua squadra (mai a quelli avversari).</li>
<li><b>Scarta</b> una carta: il turno finisce sempre con uno scarto.</li></ol>
${r.pile === 'open' ? '<p>Se il monte ha una sola carta e la raccogli, non puoi riscartare la stessa carta nello stesso turno.</p>' : ''}
<p>Dopo 4 raccolte consecutive dello scarto, il giocatore successivo deve pescare dal tallone.</p>`);

    const combos = [];
    combos.push(`<li><b>Scala</b>: almeno 3 carte consecutive dello stesso seme. ${r.aceBothEnds
      ? 'L\'Asso può stare sia sotto il 2 sia sopra il K: è ammessa la scala completa <b>da Asso ad Asso</b> (14 carte).'
      : 'L\'Asso può stare sotto il 2 (A-2-3) o sopra il K (Q-K-A), ma non a entrambe le estremità.'}</li>`);
    if (r.allowSets) combos.push(`<li><b>Tris</b>: almeno 3 carte dello stesso valore, semi qualsiasi (al massimo 8 naturali).${r.noDuplicateSets ? ' Una squadra non può avere due tris dello stesso valore.' : ''}</li>`);
    else combos.push('<li><b>Niente tris</b>: si calano solo scale.</li>');
    combos.push('<li>Non c\'è un punteggio minimo per la prima calata' + (r.vulnerability ? ', salvo la regola della vulnerabilità (vedi sotto).' : '.') + '</li>');
    h.push(`<h3>Combinazioni</h3><ul>${combos.join('')}</ul>`);

    h.push(`<h3>Matte</h3><ul>
<li>Sono matte ${matte}: possono sostituire qualsiasi carta.</li>
<li>Ogni combinazione può contenere <b>al massimo ${r.maxWild === 1 ? 'una matta' : 'due matte'}</b>; non si possono fare combinazioni di sole matte.</li>
<li>Un 2 dello stesso seme della scala, nella sua posizione naturale (A-2-3…), conta come carta <b>naturale</b> e non come matta.</li>
<li>Una matta a un'estremità si colloca in basso; se si aggiunge la carta che sostituiva, la matta scivola in fondo alla scala.</li></ul>`);

    const bon = [`<li><b>${cap(B)} ${pul}</b> (senza matte): <b>+${r.bonusClean}</b></li>`,
      `<li><b>${cap(B)} ${spo}</b> (con matta): <b>+${r.bonusDirty}</b></li>`];
    if (r.bonusSemi) bon.push(`<li><b>Semipulito</b>: almeno 8 carte, di cui 7 naturali consecutive (o 7 uguali), più una matta: <b>+${r.bonusSemi}</b></li>`);
    if (r.bonusSeq13) bon.push(`<li>Scala pulita di <b>13 carte</b>${br ? ' (meia real)' : ''}: <b>+${r.bonusSeq13}</b> al posto del bonus normale</li>`);
    if (r.bonusSeq14) bon.push(`<li>Scala pulita di <b>14 carte</b> da Asso ad Asso${br ? ' (real)' : ''}: <b>+${r.bonusSeq14}</b></li>`);
    h.push(`<h3>${cap(B)}</h3><p>Una combinazione di <b>7 o più carte</b> è ${br ? 'una canastra' : 'un burraco'}:</p><ul>${bon.join('')}</ul>`);

    h.push(`<h3>Il ${P}</h3><ul>
<li>Il primo giocatore di una squadra che resta senza carte prende un ${P} e continua a giocare con quelle carte.</li>
<li><b>Presa diretta</b>: cali tutte le carte, prendi subito il ${P} e continui il turno.</li>
<li><b>Presa con lo scarto</b>: cali tutto tranne una carta, la scarti (può essere anche una matta) e prendi il ${P}, che userai dal turno successivo.</li>
<li>Ogni squadra può prendere un solo ${P}.${r.penaltyPozzetto ? ` Chi non lo prende entro la fine della smazzata: <b>${r.penaltyPozzetto}</b>${r.noPenaltyIfNoneTaken ? ' (ma non se nessuna squadra lo ha preso)' : ''}.` : ''}</li></ul>`);

    h.push(`<h3>Chiusura</h3>
<p>Si può chiudere solo se la squadra <b>ha già preso il ${P}</b> e ha <b>almeno ${r.closeNeeds === 'clean' ? `${br ? 'una canastra limpa' : 'un burraco pulito'}` : `${br ? 'una canastra' : 'un burraco'}`}</b>.
Si chiude calando tutte le carte tranne una e <b>scartando l'ultima</b>${r.closeWildForbidden ? ', che <b>non può essere una matta</b>' : ''}: non si può chiudere calando tutto senza scartare.
Finché la tua squadra non può chiudere, dopo aver calato devi tenere almeno 2 carte in mano.
${r.bonusClose ? `La chiusura vale <b>+${r.bonusClose}</b>.` : 'La chiusura non dà bonus.'}</p>`);

    h.push(`<h3>Fine della smazzata</h3><ul><li>Quando un giocatore chiude, oppure</li>${r.stockEnd === 'twoLeft'
      ? '<li>quando nel tallone restano <b>2 carte</b>: chi ha pescato la terzultima completa il turno e la smazzata finisce senza bonus di chiusura.</li>'
      : `<li>quando il tallone è esaurito: se c'è ancora un ${P} non preso, quello diventa il nuovo tallone; altrimenti chi ha pescato l'ultima carta completa il turno e la smazzata finisce.</li>`}</ul>`);

    if (r.vulnerability) {
      h.push(`<h3>Vulnerabilità</h3><p>Una squadra che ha almeno <b>metà del punteggio obiettivo</b> (${Math.round(r.target / 2)}) è vulnerabile:
la sua prima calata della smazzata deve valere almeno <b>75 punti</b> (somma delle carte calate in quel turno${r.pile === 'closed' ? ', comprese quelle raccolte dallo scarto' : ''}).</p>`);
    }

    h.push(`<h3>Punteggio</h3>
<table class="rules-table"><tr><th>Carta</th><th>Punti</th></tr>
${r.jokers ? `<tr><td>Jolly</td><td>${r.valJoker}</td></tr>` : ''}
<tr><td>2 (pinella)</td><td>${r.valTwo}</td></tr>
<tr><td>Asso</td><td>15</td></tr>
<tr><td>K, Q, J, 10, 9, 8</td><td>10</td></tr>
<tr><td>7, 6, 5, 4, 3</td><td>5</td></tr></table>
<p>A fine smazzata ogni squadra somma il valore delle carte calate, i bonus ${br ? 'delle canastre' : 'dei burraco'} e la chiusura;
sottrae il valore delle carte rimaste in mano${r.penaltyPozzetto ? ` e ${-r.penaltyPozzetto} se non ha preso il ${P}` : ''}. I punteggi possono essere negativi.</p>
<p>Vince chi raggiunge per primo <b>${r.target} punti</b> (se più giocatori li superano nella stessa smazzata, vince chi ha di più).</p>`);

    return h.join('\n');
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  return { SCHEMA, PRESETS, OTHER_VARIANTS, HOW_TO, normalize, describe, matchPreset };
});
