/* Primo mondo: esercizi deterministici, senza partite casuali o premi competitivi.
 * Le combinazioni vengono controllate dagli stessi moduli usati dalle partite. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules'), require('./melds'), require('./scala40'), require('./ramino'));
  else root.CardCampaign = factory(root.BurracoRules, root.BurracoMelds, root.BurracoScala40, root.BurracoRamino);
})(typeof self !== 'undefined' ? self : this, function (R, M, S40, Ramino) {
  'use strict';
  const cards = (text, offset = 0) => text ? text.split(' ').map((code, i) => ({ id: offset + i, r: Number(code.slice(0, -1)), s: code.slice(-1) })) : [];
  const choice = (title, lesson, prompt, options, answer, explanation) => ({ kind: 'choice', title, lesson, prompt, options, answer, explanation });
  const play = (title, lesson, prompt, hand, answer, explanation, rule, table = '') => ({ kind: 'cards', title, lesson, prompt, hand: cards(hand), answer, explanation, rule, table: cards(table, 100) });
  const level = (id, title, icon, goal, steps) => ({ id, title, icon, goal, steps });
  const paths = [
    { id: 'burraco', name: 'Burraco', icon: '🃏', subtitle: 'Dalla prima scala al tuo primo burraco', rules: 'Burraco Classico', levels: [
      level('turno', 'Il sentiero del turno', '🌱', 'Pesca, cala e scarta', [
        choice('Prima una carta', 'Nel tuo turno prima peschi: dal tallone oppure raccogliendo tutto il monte degli scarti. Poi puoi calare e attaccare carte.', 'Il tuo turno è appena iniziato. Cosa fai per prima cosa?', ['Scarto una carta', 'Pesco dal tallone', 'Calo subito un tris'], 1, 'Prima si pesca. Solo dopo si possono calare combinazioni e attaccare carte.'),
        choice('La fine del turno', 'Dopo aver pescato puoi calare, ma non sei obbligato. Per terminare il turno devi scartare una carta.', 'Hai pescato e non vuoi calare. Come passi il turno?', ['Scarto una carta', 'Pesco di nuovo', 'Non faccio nulla'], 0, 'Lo scarto termina il turno. Puoi farlo anche senza aver calato.')
      ]),
      level('combinazioni', 'Il ponte delle scale', '🌉', 'Costruisci una scala e un tris', [
        play('Tre carte in fila', 'Una scala parte da almeno tre carte consecutive dello stesso seme.', 'Seleziona le 3 carte che formano una scala.', '4H 9C 6H 5H', [0, 2, 3], '4, 5 e 6 di cuori sono consecutivi e dello stesso seme.', { type: 'seq', count: 3 }),
        play('Tre dello stesso valore', 'Nel Burraco Classico puoi calare anche tris: almeno tre carte dello stesso valore.', 'Seleziona le 3 carte del tris.', '9H 8S 9D 9C', [0, 2, 3], 'Tre 9 formano un tris. L’8 non appartiene alla combinazione.', { type: 'set', count: 3 })
      ]),
      level('matte', 'La radura delle matte', '✨', 'Scopri pinelle e jolly', [
        play('La pinella ti aiuta', 'I 2 si chiamano pinelle e possono sostituire una carta mancante. Nel Classico ogni combinazione può avere al massimo una matta.', 'Sul tavolo ci sono 5 e 7 di cuori. Scegli la pinella per completare la scala.', '2D 9S 10C', [0], 'Il 2 di denari sostituisce il 6 di cuori: hai completato 5–6–7.', { type: 'seq', count: 1 }, '5H 7H'),
        choice('Una matta alla volta', 'Sia il jolly sia una pinella usata come sostituta sono matte.', 'Una scala ha già un jolly. Puoi aggiungere una pinella come seconda matta?', ['Sì, sempre', 'Solo se è rossa', 'No, nel Classico il limite è una matta'], 2, 'Nel formato Classico una combinazione ammette al massimo una matta. Un 2 del seme giusto nella posizione naturale può invece essere una carta naturale.')
      ]),
      level('burraco', 'La collina delle sette carte', '🌳', 'Completa un burraco pulito', [
        play('La settima carta', 'Una combinazione di almeno sette carte è un burraco. Senza matte è pulito e vale un bonus di 200 punti.', 'Aggiungi una carta per completare questo burraco pulito.', '9D 10H 12S', [1], 'Dal 4 al 10 di cuori sono sette carte senza matte: burraco pulito!', { type: 'seq', count: 1, clean: true }, '4H 5H 6H 7H 8H 9H'),
        choice('Il pozzetto', 'Ogni squadra ha un pozzetto di 11 carte. Lo prende quando uno dei suoi giocatori finisce per la prima volta le carte in mano.', 'Finisci le carte senza scartare e il pozzetto della squadra è ancora disponibile. Cosa succede?', ['La partita finisce', 'Peschi una sola carta', 'Prendi il pozzetto e continui il turno'], 2, 'Senza scarto il pozzetto si prende al volo e puoi continuare. Se finisci scartando, lo giochi dal tuo turno successivo.')
      ]),
      level('chiusura', 'Il castello del Burraco', '🏰', 'Riconosci quando puoi chiudere', [
        choice('Prima di chiudere', 'Nel Classico, per chiudere la squadra deve aver preso il pozzetto e realizzato almeno un burraco.', 'Avete preso il pozzetto, ma nessuna combinazione arriva a sette carte. Puoi chiudere?', ['Sì, basta finire le carte', 'No, serve anche un burraco', 'Sì, se scarto un Asso'], 1, 'Il pozzetto da solo non basta: serve almeno un burraco della squadra.'),
        play('Lo scarto finale', 'Avete preso il pozzetto e fatto un burraco. In questo esercizio rimarrà una sola carta: scegli quale può essere lo scarto finale.', 'Quale di queste carte può essere l’ultima carta da scartare per chiudere?', '0J 7C 2D', [1], 'Il 7 di fiori è una carta naturale. Nel Classico non puoi chiudere scartando un jolly o una pinella.', { exact: true, count: 1 })
      ])
    ] },
    { id: 'scala40', name: 'Scala 40', icon: '🪜', subtitle: 'Impara ad aprire e a liberare la mano', rules: 'Scala 40 · regole base', levels: [
      level('turno', 'Il sentiero del turno', '🌱', 'Impara il ritmo della partita', [
        choice('Da dove si comincia', 'Ogni turno inizia pescando. Dopo puoi calare e attaccare, rispettando l’apertura, poi termini con uno scarto.', 'Non hai ancora aperto e vuoi pescare senza usare subito lo scarto. Cosa scegli?', ['Il tallone coperto', 'Tutto il monte degli scarti', 'Passo senza pescare'], 0, 'Dal tallone puoi pescare normalmente. Nelle regole base, prima di aprire lo scarto si prende per usarlo subito nell’apertura.'),
        choice('L’obiettivo', 'Nella Scala 40 cerchi di restare senza carte. Le carte rimaste in mano alla fine diventano punti di penalità.', 'Qual è l’obiettivo di una smazzata?', ['Tenere più carte degli altri', 'Fare almeno sette carte in ogni scala', 'Liberarsi delle carte e chiudere con uno scarto'], 2, 'Qui non ci sono pozzetti o burraco: devi calare, attaccare e scartare per finire la mano.')
      ]),
      level('combinazioni', 'Il ponte delle combinazioni', '🌉', 'Distingui scale e tris', [
        play('Una scala dello stesso seme', 'Servono almeno tre carte consecutive dello stesso seme. Per ora impariamo la combinazione; l’apertura arriva nella prossima tappa.', 'Seleziona una scala di 3 carte.', '5S 7S 6H 6S', [0, 1, 3], '5, 6 e 7 di picche formano una scala. Il 6 di cuori non può farne parte.', { type: 'seq', count: 3 }),
        play('Un tris di semi diversi', 'Un tris contiene carte dello stesso valore e di semi diversi. Due copie della stessa carta non possono stare nello stesso tris.', 'Hai già due Re. Scegli il Re che completa un tris valido.', '13H 12C 13D', [2], 'Il Re di quadri ha un seme diverso dai Re di cuori e picche già presenti.', { type: 'set', count: 1 }, '13H 13S')
      ]),
      level('apertura', 'La porta dei quaranta', '🚪', 'Raggiungi il minimo per aprire', [
        play('Una prima calata da 40', 'Per aprire devi calare almeno 40 punti nello stesso turno. Le figure valgono 10 punti ciascuna.', 'Seleziona i 4 Re per aprire con un poker da 40 punti.', '13S 8H 13D 13H 13C', [0, 2, 3, 4], 'Quattro Re di semi diversi valgono 10 + 10 + 10 + 10 = 40: puoi aprire.', { type: 'set', count: 4, min: 40 }),
        choice('Un tris non basta sempre', 'Il minimo di 40 riguarda il totale dell’apertura, anche composto da più combinazioni.', 'Un tris di Re vale 30 punti. Da solo basta per aprire?', ['Sì, perché è un tris', 'No, mancano almeno 10 punti in combinazioni valide', 'Solo se sono tutti rossi'], 1, '30 è meno di 40. Puoi aggiungere un’altra combinazione valida all’apertura; una carta isolata da 10 non basta.')
      ]),
      level('jolly', 'Il giardino dei jolly', '✨', 'Usa una matta e attacca una carta', [
        play('Completa il vuoto', 'Nella Scala 40 le matte sono i jolly. I 2 sono carte normali e non sostituiscono altre carte.', 'Completa 5 e 7 di cuori scegliendo la matta.', '2D 0J 9S', [1], 'Il jolly rappresenta il 6 di cuori. Il 2 non è una pinella nella Scala 40.', { type: 'seq', count: 1 }, '5H 7H'),
        play('Dopo l’apertura', 'Dopo aver aperto puoi attaccare carte alle combinazioni di tutti i giocatori.', 'Hai già aperto. Quale carta puoi attaccare a 7–8–9 di quadri?', '10S 10D 12H', [1], 'Il 10 di quadri continua la scala dello stesso seme. Puoi attaccarlo anche se la scala è di un avversario.', { type: 'seq', count: 1 }, '7D 8D 9D')
      ]),
      level('chiusura', 'Il castello della Scala 40', '🏰', 'Chiudi e riconosci le penalità', [
        choice('Conserva lo scarto', 'Per chiudere devi rimanere senza carte scartando l’ultima. Pianifica le calate lasciando una carta per lo scarto.', 'Hai una combinazione da calare e una carta in più. Come chiudi?', ['Calo la combinazione e scarto l’ultima carta', 'Calo tutto senza scartare', 'Pesco due carte'], 0, 'La chiusura termina con lo scarto dell’ultima carta.'),
        choice('Contare ciò che resta', 'A fine smazzata un Re rimasto in mano vale 10 punti di penalità e un 7 ne vale 7. Qui non c’è una chiusura in mano che raddoppia.', 'Ti restano un Re e un 7. Quanti punti di penalità hai?', ['7', '10', '17'], 2, '10 + 7 = 17 punti di penalità. Nelle regole base chi raggiunge 101 viene eliminato.')
      ])
    ] },
    { id: 'ramino', name: 'Ramino', icon: '🧩', subtitle: 'Cala subito, costruisci e chiudi', rules: 'Ramino · regole base', levels: [
      level('turno', 'Il sentiero del turno', '🌱', 'Pesca e scopri lo scarto', [
        choice('Il ritmo del Ramino', 'Anche nel Ramino il turno segue questo ordine: pesca, eventuali calate o attacchi, scarto.', 'È appena iniziato il tuo turno. Qual è la prima azione?', ['Scartare', 'Pescare', 'Calare tutte le carte'], 1, 'Prima peschi. Poi puoi giocare combinazioni e concludere con lo scarto.'),
        choice('Lo scarto è disponibile', 'Nel Ramino di Smazzata puoi prendere lo scarto in cima anche se non hai ancora calato.', 'Non hai ancora calato e ti serve la carta in cima agli scarti. Puoi prenderla?', ['Sì, prendo quella carta', 'No, devo prima arrivare a 40 punti', 'Sì, ma devo prendere tutto il monte'], 0, 'Prendi solo la carta in cima. A differenza della Scala 40, non devi usarla subito per aprire.')
      ]),
      level('combinazioni', 'Il ponte delle combinazioni', '🌉', 'Crea scale e tris', [
        play('La tua prima scala', 'Tre o più carte consecutive dello stesso seme formano una scala.', 'Seleziona le 3 carte della scala.', '8C 9D 10C 9C', [0, 2, 3], '8, 9 e 10 di fiori sono una scala. Il 9 di quadri ha il seme sbagliato.', { type: 'seq', count: 3 }),
        play('Un tris senza doppioni', 'I tris richiedono lo stesso valore e semi diversi, come nella Scala 40.', 'Seleziona le 3 carte che formano un tris.', '6H 7S 6D 6C', [0, 2, 3], 'I tre 6 di cuori, quadri e fiori formano un tris valido.', { type: 'set', count: 3 })
      ]),
      level('apertura', 'La porta già aperta', '🚪', 'Cala senza una soglia di punti', [
        play('Bastano dodici punti', 'Nel Ramino non serve raggiungere 40 punti per la prima calata. Basta una combinazione valida.', 'Seleziona 3–4–5 di cuori: puoi calarli anche come prima combinazione.', '3H 12D 5H 4H', [0, 2, 3], '3 + 4 + 5 = 12. Nel Ramino puoi aprire anche con questa sola scala.', { type: 'seq', count: 3 }),
        choice('Ramino o Scala 40?', 'Le combinazioni sono simili, ma il requisito di apertura cambia.', 'Hai un tris valido da 18 punti. Nel Ramino puoi calarlo come prima combinazione?', ['No, servono 40 punti', 'No, servono sette carte', 'Sì, non c’è un minimo di apertura'], 2, 'Nel Ramino non c’è soglia. Non trasferire qui la regola dei 40 punti della Scala 40.')
      ]),
      level('jolly', 'Il giardino dei jolly', '✨', 'Completa e allunga una scala', [
        play('La carta che manca', 'I jolly possono sostituire una carta. I 2 restano carte naturali, non pinelle.', 'Completa 8 e 10 di picche con una matta.', '2H 12S 0J', [2], 'Il jolly sostituisce il 9 di picche. Nelle regole base del Ramino sono ammessi fino a due jolly per combinazione.', { type: 'seq', count: 1 }, '8S 10S'),
        play('Una carta in meno in mano', 'Dopo la prima calata puoi attaccare alle combinazioni di tutti.', 'Hai già calato. Attacca una carta a 4–5–6 di fiori.', '9D 7C 7H', [1], 'Il 7 di fiori allunga la scala: hai una carta in meno da tenere in mano.', { type: 'seq', count: 1 }, '4C 5C 6C')
      ]),
      level('chiusura', 'Il castello del Ramino', '🏰', 'Finisci la mano con uno scarto', [
        choice('L’ultima carta', 'Per chiudere, dopo calate e attacchi, devi scartare l’ultima carta.', 'Ti resta una sola carta dopo le tue calate. Cosa fai per chiudere?', ['La tengo per il turno dopo', 'La scarto', 'Prendo il pozzetto'], 1, 'Scarta l’ultima carta. Nel Ramino non c’è un pozzetto.'),
        choice('Chiusura in mano', 'Nelle regole base, chi cala tutto nello stesso turno della prima calata e chiude realizza una chiusura in mano.', 'Cosa succede alle penalità degli altri con una chiusura in mano?', ['Raddoppiano', 'Si annullano', 'Diventano tutte 40'], 0, 'Le penalità degli altri raddoppiano. Hai imparato le basi: ora puoi provarle in una partita contro il computer.')
      ])
    ] }
  ];
  function check(path, step, selected) {
    if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length) return false;
    const size = step.kind === 'choice' ? step.options.length : step.hand.length;
    if (selected.some((i) => !Number.isInteger(i) || i < 0 || i >= size)) return false;
    if (step.kind === 'choice') return selected.length === 1 && selected[0] === step.answer;
    if (selected.length !== step.rule.count) return false;
    if (step.rule.exact) return selected.length === step.answer.length && selected.every((i) => step.answer.includes(i));
    const cfg = path.id === 'burraco' ? R.normalize(R.PRESETS[0].rules) : path.id === 'ramino' ? Ramino.normalize() : S40.normalize();
    const analyze = path.id === 'burraco' ? M.analyzeMeld : S40.analyzeMeld;
    const result = analyze(step.table.concat(selected.map((i) => step.hand[i])), cfg, step.rule.type);
    return !!result && (!step.rule.clean || result.wildCount === 0) && (!step.rule.min || result.points >= step.rule.min);
  }
  function progress(raw) {
    const out = {};
    for (const p of paths) {
      out[p.id] = {};
      let unlocked = true;
      for (const l of p.levels) {
        const n = raw && raw[p.id] && raw[p.id][l.id];
        out[p.id][l.id] = unlocked && Number.isInteger(n) ? Math.max(0, Math.min(l.steps.length, n)) : 0;
        unlocked = out[p.id][l.id] === l.steps.length;
      }
    }
    return out;
  }
  return { paths, check, progress };
});
