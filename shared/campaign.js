/* Campagna autonoma: carte reali, situazioni riproducibili e obiettivi verificabili.
 * Le prime cinque lezioni sono guidate; dopo sono ammesse tutte le mosse legali. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules'), require('./ramino'));
  else root.CardCampaign = factory(root.BurracoRules, root.BurracoRamino);
})(typeof self !== 'undefined' ? self : this, function (R, Ramino) {
  'use strict';
  const SUITS = ['H', 'D', 'C', 'S'], names = { H: 'cuori', D: 'quadri', C: 'fiori', S: 'picche' };
  const rank = r => ({ 1: 'Asso', 11: 'Fante', 12: 'Donna', 13: 'Re' })[r] || String(r);
  const code = c => `${c.r}${c.s}`;
  const seq = (a, b, s) => Array.from({ length: b - a + 1 }, (_, i) => `${a + i}${s}`);
  const cardNames = cs => cs.map(c => c === '0J' ? 'Jolly' : `${rank(Number(c.slice(0, -1)))} di ${names[c.slice(-1)]}`).join(', ');
  const person = (name, role, icon, color, kind) => ({ name, role, icon, color, kind });
  const paths = [
    { id: 'burraco', name: 'Burraco', icon: '🃏', rules: 'Burraco Classico', world: 'Il giardino dei quattro semi', subtitle: 'Riapri il giardino dei quattro semi', mentor: person('Nonna Rosa', 'Custode del giardino', '🌹', '#a84365', 'gardener'), rival: person('Bruno il Riccio', 'Guardiano del ponte', '🦔', '#97602f', 'hedgehog'), boss: person('Il Barone di Picche', 'Signore del castello', '🎩', '#514477', 'baron'), story: 'Il Barone ha chiuso i cancelli del giardino. Rosa ti insegnerà a costruire scale, usare le pinelle e conquistare il castello con il tuo primo burraco.' },
    { id: 'scala40', name: 'Scala 40', icon: '🪜', rules: 'Scala 40 · regole base', world: 'Il borgo dei quaranta', subtitle: 'Rimetti in moto l’orologio del borgo', mentor: person('Maestro Arturo', 'Orologiaio del borgo', '🕰️', '#916130', 'clockmaker'), rival: person('Nina degli Ingranaggi', 'Guardiana della porta', '⚙️', '#557479', 'mechanic'), boss: person('Il Conte Quaranta', 'Custode della torre', '🧐', '#614d81', 'baron'), story: 'L’orologio del borgo si è fermato. Arturo ti accompagna tra scale, tris e aperture: ogni sfida recupera un ingranaggio, fino alla torre del Conte Quaranta.' },
    { id: 'ramino', name: 'Ramino', icon: '🧩', rules: 'Ramino · regole base', world: 'La spiaggia delle prime mani', subtitle: 'Riaccendi il faro dei naviganti', mentor: person('Capitana Marina', 'Guida della baia', '⚓', '#26748a', 'captain'), rival: person('Pippo il Granchio', 'Guardiano del molo', '🦀', '#b9563f', 'crab'), boss: person('Capitan Nebbia', 'Rivale del faro', '🏴‍☠️', '#44536f', 'pirate'), story: 'Il faro della baia si è spento. Marina ti insegna a calare senza aspettare quaranta punti e a incastrare le carte: al faro ti attende Capitan Nebbia.' }
  ];
  const titles = ['Il primo turno','La prima scala','Tre carte amiche','La carta magica','Un passo in più','Lo stesso seme','Una fila più lunga','La carta fuori posto','Scegli la tua scala','Una scala senza guida','Stesso valore, semi diversi','Le figure si incontrano','Quattro al tavolo','Il secondo gruppo','Due giochi, un turno','Due strade per cominciare','Un’apertura in due parti','Le carte lavorano insieme','Il turno delle combinazioni','Il primo traguardo','La carta che manca','Una matta al momento giusto','Prepara il turno seguente','La prova del guardiano','BOSS · La porta del mondo','Il tavolo continua','Un attacco dall’alto','Un attacco dal basso','La scala cresce','Sette carte in vista','La carta negli scarti','Raccogli e costruisci','Un monte da sfruttare','Apri con lo scarto','Leggi il tavolo','Ritrova la carta vera','Libera la matta','Una nuova occasione','La matta cambia gioco','Una mossa dopo l’altra','Prepara l’ultima carta','Alleggerisci la mano','La prima chiusura','Chiudi con ordine','Uno scarto per vincere','Verso il castello','Il penultimo ostacolo','La sfida del rivale','La porta del finale','BOSS · Il cuore del mondo'];
  function describeGoal(goal, path) {
    const parts = [];
    if (goal.close) parts.push('Chiudi la smazzata con uno scarto');
    if (goal.burraco) parts.push('completa un burraco');
    if (goal.melds) parts.push(`cala almeno ${goal.melds} combinazioni`);
    if (goal.seqs) parts.push('costruisci una scala');
    if (goal.sets) parts.push(path.id === 'scala40' ? 'apri con un tris o poker valido' : 'cala un tris o poker');
    if (goal.adds) parts.push(`esegui ${goal.adds} attacch${goal.adds === 1 ? 'o' : 'i'}`);
    if (goal.wild) parts.push(path.id === 'burraco' ? 'usa una pinella' : 'usa un jolly');
    if (goal.swaps) parts.push('recupera un jolly con la carta vera');
    if (goal.pile) parts.push('raccogli dagli scarti');
    if (goal.clean) parts.push('mantieni la scala senza matte');
    if (goal.turns) parts.push(`completa ${goal.turns} turni`);
    const text = parts.join(' · '); return text.charAt(0).toUpperCase() + text.slice(1) + '.';
  }
  function createLevel(path, number) {
    const scala = path.id === 'scala40', bur = path.id === 'burraco', v = (number - 1) % 5;
    const suit = SUITS[(number + (scala ? 1 : 0)) % 4], other = SUITS[(SUITS.indexOf(suit) + 1) % 4], wild = bur ? `2${other}` : '0J';
    const boss = number === 25 || number === 50;
    const l = { id: ['turno','scala','tris','matta','attacco'][number - 1] || `tappa-${number}`, number, title: titles[number - 1], icon: boss ? '👑' : ['🌱','🌉','🚪','✨','🏰'][Math.floor((number - 1) / 10)], boss, chapter: Math.floor((number - 1) / 10), guided: number <= 5, time: boss ? 420 : number <= 10 ? 240 : number <= 30 ? 210 : 180, maxTurns: number < 20 ? 5 : 6, hand: [], table: [], pile: ['3C'], draws: [], steps: [], goal: {}, pad: true, opponent: number === 50 ? path.boss : bur || number >= 21 ? path.rival : { ...path.rival, name: ['Lillo','Ada','Tito','Mila','Leo'][v], role: 'Compagno di allenamento' } };
    if (boss) { l.maxTurns = number === 25 ? 2 : 4; l.title = number === 25 ? 'BOSS · ' + ({burraco:'Il ponte del Riccio',scala40:'La porta degli ingranaggi',ramino:'Il guardiano del molo'})[path.id] : 'BOSS · ' + ({burraco:'Il castello di Picche',scala40:'La torre di Quaranta',ramino:'Il faro nella nebbia'})[path.id]; }
    if (number === 46) l.title = 'Verso ' + ({burraco:'il castello',scala40:'la torre',ramino:'il faro'})[path.id];
    let round = 1;
    const m = (type, cards, tip, target = 0) => l.steps.push({ seat: 0, round, type, cards, tip, target });
    const draw = c => { l.draws.push(c); m('draw', [], 'Tocca il tallone coperto per pescare. Prima si pesca, poi si gioca e si scarta.'); };
    const meld = (cs, tip) => m('meld', cs, tip || `Seleziona ${cardNames(cs)} e tocca la casella ＋ sul tavolo per calare.`);
    const add = (cs, target = 0) => m('add', cs, `Seleziona ${cardNames(cs)}, poi tocca la scala sul tavolo per allungarla.`, target);
    const discard = c => m('discard', [c], `Termina il turno: seleziona ${cardNames([c])} e tocca gli scarti.`);
    const bot = () => {
      l.draws.push(['4C','5C','6D','7D'][round - 1]);
      l.steps.push({ seat: 1, round, type: 'draw', cards: [], tip: `${l.opponent.name} pesca. Osserva il suo turno.` });
      if (round === 1) l.steps.push({ seat: 1, round, type: 'meld', cards: seq(10,13,other), tip: `${l.opponent.name} cala una scala di figure.` });
      l.steps.push({ seat: 1, round, type: 'discard', cards: [['3D','6C','5D','4D'][round - 1]], tip: `${l.opponent.name} scarta: torna a te.` }); round++;
    };
    const regular = (cs, extra) => { l.hand = cs.concat(['8C','8D']); draw('6D'); if (cs.length) meld(cs); discard('8C'); bot(); draw(extra || '7D'); if (extra) add([extra]); discard('8D'); };
    const high = seq(10,13,suit), small = seq(4 + v % 3,6 + v % 3,suit);
    if (number === 1) { regular([], null); l.goal = { turns: 2 }; }
    else if (number === 2 || number >= 6 && number <= 10) { regular(scala ? seq(7 + v % 4,v % 4 === 3 ? 13 : 11 + v % 4,suit) : small); l.goal = { seqs: 1, turns: 2 }; }
    else if (number === 3 || number >= 11 && number <= 13) { const r = scala ? 11 + v % 3 : 6 + v; regular(SUITS.slice(0,scala || number === 13 ? 4 : 3).map(s => `${r}${s}`)); l.goal = { sets: 1, turns: 2 }; }
    else if (number === 4 || number >= 21 && number <= 24) { regular(scala ? [`10${suit}`,`11${suit}`,wild,`13${suit}`] : [`5${suit}`,wild,`7${suit}`], number > 21 ? scala ? `9${suit}` : `8${suit}` : null); l.goal = { wild: 1, turns: 2, ...(number > 21 ? { adds: 1 } : {}) }; }
    else if (number === 5) { regular(scala ? seq(9,13,suit) : small, scala ? `8${suit}` : `${7 + v % 3}${suit}`); l.goal = { adds: 1, turns: 2 }; }
    else if (number >= 14 && number <= 20 || number === 25) {
      const first = number === 25 ? scala ? [`10${suit}`,`11${suit}`,wild,`13${suit}`] : [`5${suit}`,wild,`7${suit}`] : scala ? SUITS.slice(0,3).map(s => `13${s}`) : small;
      const second = scala ? seq(4,6,other) : SUITS.slice(0,3).map(s => `9${s}`);
      l.hand = first.concat(second,['8C','8D','12C']); draw('6D');
      meld(first.concat(second), scala ? 'Apri con due giochi insieme: seleziona tutte le carte delle due combinazioni. Il totale deve raggiungere 40 punti.' : 'Puoi calare due combinazioni nello stesso turno: seleziona le carte di entrambi i giochi.');
      discard('8C'); bot(); draw(number === 25 ? scala ? `9${suit}` : `8${suit}` : '7D');
      if (number === 25) add([scala ? `9${suit}` : `8${suit}`]); discard('8D');
      l.goal = { melds: 2, turns: 2, ...(number === 25 ? { wild: 1, adds: 1 } : {}) };
    } else if (number >= 26 && number <= 30) {
      l.table = [scala ? high : seq(4,number === 30 ? 9 : 6,suit)]; l.opened = true;
      const extension = scala ? `9${suit}` : `${number === 30 ? 10 : 7}${suit}`;
      l.hand = [extension,'8C','8D']; draw('6D'); add([extension]); discard('8C'); bot();
      const next = scala ? `8${suit}` : `${number === 30 ? 11 : 8}${suit}`; draw(next); add([next]); discard('8D');
      l.goal = { adds: 2, turns: 2, ...(number === 30 && bur ? { burraco: true } : {}) };
    } else if (number >= 31 && number <= 35) {
      const combo = scala ? high : small, held = combo.slice(0,-1);
      l.hand = held.concat(['8C','8D']); l.pile = [combo[combo.length - 1]];
      if (scala) m('takePile',held,`Seleziona ${cardNames(held)}, poi tocca gli scarti: userai subito la carta in cima per aprire con 40 punti.`);
      else { m('takePile',[],bur ? 'Raccogli gli scarti: nel Burraco prendi tutto il monte. Qui la carta in cima completa la tua scala.' : 'Prendi la carta in cima agli scarti. Nel Ramino puoi farlo anche prima di calare.'); meld(combo); }
      discard('8C'); bot(); draw('7D'); discard('8D'); l.goal = { pile: 1, seqs: 1, turns: 2 };
    } else if (number >= 36 && number <= 40) {
      if (bur) { l.table = [seq(3,6,suit)]; l.hand = [`2${suit}`,'8C','8D']; draw('6D'); add([`2${suit}`]); discard('8C'); bot(); draw(`7${suit}`); add([`7${suit}`]); discard('8D'); l.goal = { adds: 2, clean: true, turns: 2 }; }
      else { l.table = [[`5${suit}`,'0J',`7${suit}`],high]; l.opened = true; l.hand = [`6${suit}`,`9${other}`,`11${other}`,'8C','8D']; draw('6D'); m('swap',[`6${suit}`],`Seleziona ${cardNames([`6${suit}`])} e tocca la scala con il jolly: la carta vera lo sostituisce e il jolly torna in mano.`); meld([`9${other}`,'0J',`11${other}`]); discard('8C'); bot(); draw('7D'); discard('8D'); l.goal = { swaps: 1, wild: 1, turns: 2 }; }
    } else if (number >= 41 && number <= 45) {
      l.pad = false; l.hand = bur ? [`10${suit}`,'8C'] : [`5${suit}`,`6${suit}`,'8C'];
      l.table = bur ? [seq(4,9,suit)] : scala ? [seq(10,13,other)] : []; l.opened = scala; l.pozzettoTaken = bur;
      draw(bur ? `11${suit}` : `4${suit}`); if (bur) add([`10${suit}`,`11${suit}`]); else meld(seq(4,6,suit));
      discard('8C'); l.goal = { close: true, ...(bur ? { burraco: true } : {}) };
    } else {
      const first = scala ? high : seq(4,6,suit), second = SUITS.filter(s => s !== suit).map(s => `9${s}`);
      l.pad = false; l.pozzettoTaken = bur; l.hand = first.concat(second,['8C','8D','10C','12C']);
      draw(scala ? `9${suit}` : `7${suit}`); meld(first.concat([scala ? `9${suit}` : `7${suit}`])); meld(second); discard('8C'); bot();
      for (let i = 0; i < 3; i++) { const c = scala ? `${8-i}${suit}` : bur ? `${8+i}${suit}` : `${3-i}${suit}`; draw(c); add([c]); discard(['8D','10C','12C'][i]); if (i < 2) bot(); }
      l.goal = { close: true, melds: 2, adds: 3, ...(bur ? { burraco: true } : {}) }; l.time = boss ? 480 : 300;
    }
    l.botHand = seq(10,13,other).concat(['3D','6C','5D','4D']);
    l.goalText = describeGoal(l.goal,path);
    l.intro = number === 1 ? path.story : boss ? `${l.opponent.name} ti sfida: ${l.goalText.toLowerCase()} Hai imparato tutto ciò che serve. Osserva la mano prima di cominciare.` : [
      'Ogni carta ha un valore e un seme. Guarda ciò che puoi costruire, poi scegli la prima mossa.',
      scala ? 'L’apertura conta i punti di tutte le combinazioni calate insieme. Una carta isolata non completa i quaranta.' : bur ? 'Una scala ha lo stesso seme; un tris ha lo stesso valore. Conserva sempre una carta per lo scarto.' : 'Non servono quaranta punti per iniziare: una combinazione valida può alleggerire subito la mano.',
      'Le carte del tavolo sono opportunità. Prima di scartare controlla se puoi attaccare.',
      bur ? 'Un 2 del seme della scala può essere naturale. Usato al posto di un’altra carta è una pinella.' : 'Se hai la carta vera, dopo aver aperto puoi recuperare il jolly dal tavolo.',
      'L’obiettivo ti dice cosa ottenere, ma puoi scegliere qualunque mossa consentita dalle regole.'
    ][Math.min(4,Math.floor((number-1)/10))];
    if(!boss&&number>=6) l.intro = number<=10 ? 'Una scala contiene almeno tre carte consecutive dello stesso seme. Cerca la sequenza nella tua mano: le carte di un seme diverso possono distrarti.'
      : number<=13 ? 'Un tris ha lo stesso valore e semi diversi; con quattro semi diventa un poker. Due copie identiche non possono formare insieme lo stesso tris.'
      : number<=20 ? (scala ? 'Un tris di Re vale 30 punti e da solo non apre. Seleziona insieme anche una seconda combinazione valida: l’apertura somma i punti di tutti i giochi calati nello stesso momento.' : 'Cerca due combinazioni indipendenti. Puoi calarle insieme oppure una alla volta nello stesso turno, lasciando una carta da scartare.')
      : number<=24 ? (bur ? 'La pinella può sostituire una carta mancante. Nel Classico ogni combinazione ammette una sola matta: usala per costruire il gioco e cerca come allungarlo al turno seguente.' : scala ? 'Il jolly sostituisce una carta mancante. Controlla il seme e i valori che lo circondano; devi comunque raggiungere 40 punti per aprire.' : 'Il jolly sostituisce una carta mancante. Nel Ramino puoi usarne fino a due in una combinazione e calare senza una soglia di apertura. Controlla sempre il seme e i valori che lo circondano.')
      : number<=30 ? 'Questa partita è già iniziata e sul tavolo ci sono tuoi giochi. Dopo la pesca puoi attaccare carte alle estremità di una scala dello stesso seme: non occorre creare sempre una combinazione nuova.'
      : number<=35 ? (scala ? 'Prima dell’apertura puoi prendere lo scarto soltanto usandolo subito per aprire. Seleziona le carte della mano che, insieme allo scarto, raggiungono 40 punti; poi tocca il monte.' : bur ? 'Nel Burraco raccogli tutto il monte degli scarti. Qui la carta in cima completa una scala: raccogli, cala il gioco e conserva una carta per lo scarto.' : 'Nel Ramino puoi prendere la carta in cima agli scarti anche prima di calare. Guarda se completa una combinazione della tua mano e poi usala sul tavolo.')
      : number<=40 ? (bur ? 'Il 2 dello stesso seme, prima del 3, è una carta naturale. Attaccandolo nella sua posizione mantieni pulita la scala: in questa prova non stai usando una pinella come sostituta.' : 'Hai già aperto. Se possiedi la carta rappresentata da un jolly, selezionala e tocca quella scala: recuperi il jolly e puoi impiegarlo in una nuova combinazione nello stesso turno.')
      : number<=45 ? (bur ? 'Riprendiamo una partita già avviata: il pozzetto è già stato preso e la scala ha sei carte. Allungala fino al burraco e conserva una carta naturale come ultimo scarto per chiudere.' : scala ? 'Hai già aperto e ti restano poche carte. Pesca, cala la scala e scarta l’ultima carta: è così che si chiude, mentre le carte degli avversari diventano penalità.' : 'Puoi calare e chiudere nello stesso turno. Pesca, costruisci la scala e conserva l’ultima carta per lo scarto: nel Ramino non devi aspettare una soglia di apertura.')
      : 'Un finale più lungo: prepara due combinazioni, poi sfrutta le pesche successive per allungare la scala. Scegli gli scarti con ordine: devi finire la mano, non soltanto liberarti delle carte più alte.';
    if(number===25)l.intro=`${l.opponent.name} sorveglia il passaggio: costruisci due combinazioni, usa una matta e attacca una carta entro due turni. ${scala?'Seleziona i due giochi insieme per raggiungere i quaranta punti di apertura.':'Puoi calare i due giochi insieme oppure uno alla volta nello stesso turno.'}`;
    if(number===50)l.intro=`${l.opponent.name} ti aspetta al cuore del mondo. ${bur?'Il pozzetto è già tuo: costruisci un burraco e un secondo gioco.':'Costruisci prima la scala, poi il tris.'} Hai quattro turni per calare, eseguire tre attacchi e chiudere con l’ultimo scarto. Usa il pulsante degli obiettivi per controllare cosa manca.`;
    return l;
  }
  for (const path of paths) path.levels = Array.from({ length: 50 },(_,i) => createLevel(path,i+1));
  function start(path,level,E) {
    const rules = path.id === 'burraco' ? R.PRESETS[0].rules : path.id === 'ramino' ? Ramino.normalize() : { game: 'scala40' };
    const g = E.createGame({ rules, players: [{ name: 'Tu' },{ name: level.opponent.name, isBot: true }], seed: 2718+level.number*73 });
    const deck = g.players.flatMap(p=>p.hand).concat(g.stock,g.discard,...g.pozzetti);
    const take = name => { const i = deck.findIndex(c=>code(c)===name); if (i<0) throw Error(`Carta mancante nel livello ${level.number}: ${name}`); return deck.splice(i,1)[0]; };
    g.players[0].hand = level.hand.map(take); g.players[1].hand = level.botHand.map(take);
    g.teams[0].melds = level.table.map(cs=>{ const an=E.analyzeMeld(cs.map(take),g.cfg); if(!an)throw Error('Tavolo iniziale non valido');return { id:++g.meldSeq,...an }; });
    if(path.id!=='burraco')g.teams[0].opened=!!level.opened; g.teams[0].pozzettoTaken=!!level.pozzettoTaken;
    const draws=level.draws.map(take);g.discard=level.pile.map(take);const size=path.id==='burraco'?11:13;
    if(level.pad)g.players[0].hand.push(...deck.splice(0,Math.max(0,size-g.players[0].hand.length)));
    g.players[1].hand.push(...deck.splice(0,Math.max(0,size-g.players[1].hand.length)));
    g.pozzetti=path.id==='burraco'?Array.from({length:level.pozzettoTaken?1:2},()=>deck.splice(0,11)):[];
    g.stock=deck.concat(draws.reverse());g.turn=0;g.phase='draw';g.turnInfo=null;g.log=[];g.replay=null;
    return {g,index:0,doneSteps:[],turns:0,metrics:{adds:0,swaps:0,pile:0},status:'playing',remainingMs:level.time*1000,usedHelp:0,timeBoosts:0};
  }
  function actionFor(session,step) {
    const hand=session.g.players[step.seat].hand,used=new Set();
    const ids=step.cards.map(name=>{const c=hand.find(c=>code(c)===name&&!used.has(c.id));if(!c)return null;used.add(c.id);return c.id;});
    if(ids.includes(null))return null;const a={type:step.type};
    if(a.type==='discard'||a.type==='swap')a.cardId=ids[0];
    if(['meld','add','takePile'].includes(a.type)&&ids.length)a.cardIds=ids;
    if(a.type==='add'||a.type==='swap')a.meldId=session.g.teams[0].melds[step.target||0]?.id;
    if(a.type==='add') { const c=hand.find(c=>c.id===ids[0]); const sequence=session.g.teams[0].melds.find(m=>m.type==='seq'&&m.cards.some(x=>x.s===c?.s&&x.r>2)); if(sequence)a.meldId=sequence.id; }
    return a;
  }
  function same(a,b) {if(!a||!b||a.type!==b.type||a.cardId!==b.cardId||a.meldId!==b.meldId)return false;const x=a.cardIds||[],y=b.cardIds||[];return x.length===y.length&&new Set(x).size===x.length&&x.every(id=>y.includes(id));}
  function expected(session,level,E,Bot) {
    if(session.status!=='playing')return null;const g=session.g,round=g.turn===0?session.turns+1:session.turns;
    for(let i=0;i<level.steps.length;i++){const step=level.steps[i];if(step.seat!==g.turn||step.round!==round||session.doneSteps.includes(i))continue;const a=actionFor(session,step);if(a&&(!E||E.isLegal(g,g.turn,a)))return a;}
    if(Bot&&E){const a=Bot.nextAction(g,g.turn,{level:'normale'});if(a&&E.isLegal(g,g.turn,a))return a;}
    if(g.phase==='draw')return {type:'draw'};
    const order=g.players[g.turn].hand.filter(c=>c.r!==0&&c.r!==2).concat(g.players[g.turn].hand);
    return order.map(c=>({type:'discard',cardId:c.id})).find(a=>!E||E.isLegal(g,g.turn,a))||null;
  }
  function goalState(session,level) {
    const g=session.g,ms=g.teams[0].melds,m=session.metrics;
    const values={turns:session.turns,melds:ms.length,seqs:ms.filter(x=>x.type==='seq').length,sets:ms.filter(x=>x.type==='set').length,adds:m.adds,swaps:m.swaps,pile:m.pile,wild:ms.filter(x=>x.wildCount>0).length,burraco:ms.some(x=>x.length>=7),clean:ms.every(x=>!x.wildCount),close:g.handResult?.reason==='close'&&g.handResult.closer===0};
    return Object.entries(level.goal).map(([key,target])=>({key,value:values[key],target,done:typeof target==='boolean'?values[key]===target:values[key]>=target}));
  }
  function act(session,level,E,action) {
    if(session.status!=='playing'||!action)return false;const seat=session.g.turn,wanted=expected(session,level,E);
    if(level.guided&&seat===0&&!same(action,wanted))return false;if(!E.isLegal(session.g,seat,action))return false;
    const round=seat===0?session.turns+1:session.turns;
    for(let i=0;i<level.steps.length;i++){const st=level.steps[i];if(st.seat===seat&&st.round===round&&!session.doneSteps.includes(i)&&same(action,actionFor(session,st))){session.doneSteps.push(i);break;}}
    E.apply(session.g,seat,action);
    if(seat===0){if(action.type==='discard')session.turns++;if(action.type==='add')session.metrics.adds++;if(action.type==='swap')session.metrics.swaps++;if(action.type==='takePile')session.metrics.pile++;
      if((action.type==='discard'||session.g.phase==='handEnd')&&goalState(session,level).every(x=>x.done))session.status='won';}
    if(session.status!=='won'&&(session.g.phase==='handEnd'||session.turns>=level.maxTurns))session.status='lost';
    session.index=session.status==='won'?level.steps.length:session.doneSteps.length;return true;
  }
  function tip(session,level,E,Bot) {
    if(session.status==='won')return 'Obiettivo completato!';if(session.g.turn!==0)return `${level.opponent.name} sta giocando. Osserva le combinazioni e lo scarto.`;
    const a=expected(session,level,E,Bot),st=level.steps.find(st=>st.seat===0&&same(a,actionFor(session,st)));
    return st?.tip||(session.g.phase==='draw'?'Pesca dal tallone o raccogli dagli scarti. Valuta quale scelta ti avvicina all’obiettivo.':'Puoi calare, attaccare o scartare. Controlla l’obiettivo prima di terminare il turno.');
  }
  function progress(raw) {const out={};for(const p of paths){out[p.id]={};let unlocked=true;for(const l of p.levels){const done=unlocked&&raw?.[p.id]?.[l.id]===l.steps.length;out[p.id][l.id]=done?l.steps.length:0;unlocked=!!done;}}return out;}
  const LIFE_MS=30*60*1000;
  function wallet(raw,now=Date.now()) {
    const int=(v,fallback,max)=>Number.isInteger(v)&&v>=0?Math.min(max,v):fallback;
    const w={lives:int(raw?.lives,5,5),nextLife:Number.isFinite(raw?.nextLife)&&raw.nextLife>0?raw.nextLife:0,coins:int(raw?.coins,120,1000000),hint:int(raw?.hint,3,999),coach:int(raw?.coach,2,999),time:int(raw?.time,2,999),earned:{}};
    for(const p of paths)for(const l of p.levels)if(raw?.earned?.[p.id+'/'+l.id]===true)w.earned[p.id+'/'+l.id]=true;
    if(w.lives<5){if(!w.nextLife)w.nextLife=now+LIFE_MS;if(w.nextLife<=now){const n=Math.floor((now-w.nextLife)/LIFE_MS)+1;w.lives=Math.min(5,w.lives+n);w.nextLife+=n*LIFE_MS;}}
    if(w.lives===5)w.nextLife=0;return w;
  }
  function loseLife(raw,now=Date.now()) {const w=wallet(raw,now);if(w.lives>0){if(w.lives===5)w.nextLife=now+LIFE_MS;w.lives--;}return w;}
  function reward(raw,path,level,now=Date.now()) {const w=wallet(raw,now),key=path.id+'/'+level.id;if(!w.earned[key]){w.earned[key]=true;w.coins+=level.boss?100:15;if(level.number%10===0){w.hint++;w.time++;}}return w;}
  return {paths,start,expected,act,tip,goalState,progress,wallet,loseLife,reward,LIFE_MS};
});
