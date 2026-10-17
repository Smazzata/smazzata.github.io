/*
 * Parole vietate in nickname e chat (italiano, più qualche parola inglese, spagnola e portoghese).
 * Il server rifiuta i nickname volgari e copre con asterischi le parolacce in chat.
 *
 * Regge le varianti semplici: maiuscole, accenti, lettere ripetute («cazzzo»), numeri o simboli al posto
 * delle lettere (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s). Per evitare i falsi positivi le parole sono in tre gruppi:
 *  - OVUNQUE: vietate anche dentro un'altra parola (radici che non compaiono in parole innocue);
 *  - INIZIO:  vietate se la parola comincia così (idiota, idioti…);
 *  - PAROLA:  vietate solo come parola intera («puta» sì, «computadora» o «disputa» no; «culo» sì, «calcolo» no).
 * SALVE sono parole innocue che contengono una radice vietata (cazzuola, puttanesca…): non vengono toccate.
 * «Scopa» e «Scopone» sono giochi: nessuna regola li riguarda.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SmazzataParole = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const OVUNQUE = [
    // italiano
    'cazzo', 'cazzi', 'cazzat', 'cazzon', 'stronz', 'puttan', 'putana', 'putane', 'vaffanc', 'fanculo', 'coglion', 'minchi', 'merda', 'merde', 'merdos',
    'mignott', 'frocio', 'froci', 'ricchion', 'pompin', 'sborr', 'porcodio', 'porcamadonna', 'diocane', 'diomaiale', 'porn',
    'pedofil', 'bastard', 'troione', 'segaiol', 'leccaculo', 'rompicoglion', 'figlioditroia', 'hitler',
    // inglese
    'fuck', 'bitch', 'nigger', 'nigga', 'asshole', 'bullshit', 'pussy', 'whore',
    // spagnolo
    'mierda', 'gilipoll', 'cabron', 'pendej', 'maricon', 'chingad', 'hijodeput',
    // portoghese
    'caralh', 'buceta', 'filhodaput', 'arrombad',
  ];
  const INIZIO = ['idiot', 'imbecill', 'cretin', 'mongoloid', 'cornut', 'fott', 'zoccol', 'sfigat'];
  const PAROLA = [
    'culo', 'culi', 'culone', 'figa', 'fighe', 'fica', 'tette', 'pirla', 'deficiente', 'deficienti', 'troia', 'troie', 'troiona',
    'puta', 'putas', 'puto', 'putos', 'joder', 'porra', 'foda', 'fodase', 'foder', 'viado', 'cunt', 'cunts', 'dick', 'dicks',
    'slut', 'sluts', 'fag', 'fags', 'faggot', 'retard', 'nazi', 'nazis', 'shit', 'shits', 'sex', 'cum',
  ];
  const SALVE = ['cazzuol', 'stronzio', 'puttanesc', 'zoccolo', 'zoccoli'];

  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
  /** minuscolo, senza accenti, con i numeri-lettera tradotti */
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[013457@$]/g, (c) => LEET[c]);
  }
  /** regola per una parola vietata: ogni gruppo di lettere uguali vale «almeno tante» (cazzo → c+a+z{2,}o+) */
  function pattern(w) {
    return norm(w).replace(/(.)\1*/g, (run, c) => (run.length > 1 ? `${c}{${run.length},}` : `${c}+`));
  }
  const reOf = (list, pre, post) => new RegExp(list.map((w) => pre + pattern(w) + post).join('|'));
  const RE_OVUNQUE = reOf(OVUNQUE, '', '');
  const RE_INIZIO = reOf(INIZIO, '^', '');
  const RE_PAROLA = reOf(PAROLA, '^', '$');
  const RE_SALVE = new RegExp(SALVE.map(pattern).join('|'), 'g');

  /** true se la singola parola (già normalizzata) è vietata */
  function cattiva(w) {
    if (RE_PAROLA.test(w)) return true;
    const pulita = w.replace(RE_SALVE, '_');
    return RE_OVUNQUE.test(pulita) || (pulita === w && RE_INIZIO.test(w));
  }

  /** testo di chat con le parole vietate coperte da asterischi (stessa lunghezza) */
  function censura(testo) {
    return String(testo || '').replace(/[\p{L}\p{N}@$]+/gu, (t) => (cattiva(norm(t)) ? '*'.repeat([...t].length) : t));
  }

  /**
   * true se il nickname contiene una parola vietata. Il nickname non ha spazi: si guarda tutto insieme (senza
   * _ . -) e anche a pezzi (separati da _ . - o dalle maiuscole: «CazzoMan», «puta_88»), con o senza le cifre ai lati.
   */
  function nickVietato(nick) {
    nick = String(nick || '');
    if (RE_OVUNQUE.test(norm(nick.replace(/[_.\-]/g, '')).replace(RE_SALVE, '_'))) return true;
    const pezzi = nick.split(/[_.\-]+|(?<=[a-zà-ú])(?=[A-ZÀ-Ú])/).filter(Boolean);
    for (const p of pezzi.concat([nick.replace(/[_.\-]/g, '')])) {
      const senzaCifre = p.replace(/^[0-9]+|[0-9]+$/g, '');
      if (cattiva(norm(p)) || (senzaCifre && cattiva(norm(senzaCifre)))) return true;
    }
    return false;
  }

  return { censura, nickVietato, contiene: (t) => censura(t) !== String(t || ''), norm };
});
