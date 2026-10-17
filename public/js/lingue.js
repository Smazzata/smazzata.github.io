/* Burraco — Lingue (italiano, inglese, spagnolo, portoghese).
 * L'interfaccia è scritta in italiano; in un'altra lingua questo file carica il dizionario (lingue/xx.js)
 * e traduce i testi che compaiono nella pagina, appena compaiono (MutationObserver): testi, title,
 * placeholder, aria-label, finestre di conferma. I testi con parti variabili usano {0}, {1}…
 * nel dizionario (es. "Tocca a {0}"). Un testo senza traduzione resta in italiano.
 * Caricato per primo tra i file di public/js. */
'use strict';

  const LANGS = { it: '🇮🇹 Italiano', en: '🇬🇧 English', es: '🇪🇸 Español', pt: '🇧🇷 Português' };
  /** lingua scelta nelle impostazioni ('auto' = quella del telefono/browser) */
  const LANG = (() => {
    let l = 'auto';
    try { l = (JSON.parse(localStorage.getItem('bur_prefs') || '{}') || {}).lang || 'auto'; } catch (e) { /* storage non disponibile */ }
    if (l === 'auto') l = String((navigator.languages && navigator.languages[0]) || navigator.language || 'it').slice(0, 2).toLowerCase();
    return LANGS[l] ? l : 'it';
  })();

  /** formato di date e numeri della lingua scelta */
  const LOCALE = { it: 'it-IT', en: 'en-GB', es: 'es-ES', pt: 'pt-BR' }[LANG];

  const I18N = {
    exact: new Map(),
    byFirst: new Map(), // testi con parti variabili, raggruppati per primo carattere fisso
    loose: [], // testi che iniziano con una parte variabile
    missing: new Set(), // testi visti senza traduzione (si leggono da console: [...I18N.missing])
    load(dict) {
      for (const [k, v] of Object.entries(dict)) {
        const key = I18N.norm(k);
        if (!/\{\d+\}/.test(key)) { I18N.exact.set(key, v); continue; }
        const order = [];
        const re = new RegExp('^' + key.split(/(\{\d+\})/).map((p) => {
          const m = /^\{(\d+)\}$/.exec(p);
          if (m) { order.push(m[1]); return '(.+?)'; }
          return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }).join('') + '$');
        const pat = { re, order, out: v };
        if (/^\{\d+\}/.test(key)) I18N.loose.push(pat);
        else { const c = key[0]; if (!I18N.byFirst.has(c)) I18N.byFirst.set(c, []); I18N.byFirst.get(c).push(pat); }
      }
    },
    norm: (s) => String(s).replace(/\s+/g, ' ').trim(),
  };

  /** Traduzione di un testo (null se non c'è) */
  function tr(s, depth = 0) {
    const k = I18N.norm(s);
    if (!k || !/[a-zà-ù]/i.test(k)) return null;
    const e = I18N.exact.get(k);
    if (e != null) return e;
    // i testi che iniziano con una parte variabile (es. "{0} gioca {1}") solo su frasi brevi, come la cronaca
    for (const p of (I18N.byFirst.get(k[0]) || []).concat(k.length <= 200 ? I18N.loose : [])) {
      const m = p.re.exec(k);
      if (!m) continue;
      return p.out.replace(/\{(\d+)\}/g, (_, n) => {
        const v = m[p.order.indexOf(n) + 1] || '';
        return (depth < 2 && tr(v, depth + 1)) || v; // anche le parti variabili possono essere testi da tradurre
      });
    }
    // elenco separato da virgole (es. le carte prese): si traduce pezzo per pezzo
    if (depth > 0 && k.includes(', ')) {
      const parts = k.split(', ').map((x) => tr(x, depth) || x);
      if (parts.join(', ') !== k) return parts.join(', ');
    }
    return null;
  }
  /** Traduce un testo se possibile, altrimenti lo lascia com'è */
  const t = (s) => (LANG === 'it' ? s : tr(s) || s);

  if (LANG !== 'it') {
    document.documentElement.lang = LANG;
    // dizionario della lingua: caricato subito, prima del resto dell'interfaccia
    document.write(`<script src="lingue/${LANG}.js"><\/script>`);
    const done = new WeakMap(); // nodo -> testo già tradotto (per non tradurre due volte)
    const fixText = (n) => {
      if (n.parentNode && n.parentNode.closest && n.parentNode.closest('[translate="no"]')) return; // es. il nome «Smazzata»
      const v = n.nodeValue;
      if (done.get(n) === v) return;
      const r = tr(v);
      if (r == null && /[a-zà-ù]{3}/i.test(v)) I18N.missing.add(I18N.norm(v)); // per trovare i testi ancora da tradurre
      if (r != null) { const out = v.match(/^\s*/)[0] + r + v.match(/\s*$/)[0]; done.set(n, out); if (out !== v) n.nodeValue = out; }
    };
    const ATTRS = ['title', 'placeholder', 'aria-label'];
    const fixAttrs = (el) => {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v) continue;
        const r = tr(v);
        if (r != null && r !== v) el.setAttribute(a, r);
      }
    };
    const walk = (root) => {
      if (root.nodeType === 3) { fixText(root); return; }
      if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
      fixAttrs(root);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeType === 3) { if (n.parentNode && n.parentNode.tagName !== 'SCRIPT' && n.parentNode.tagName !== 'STYLE') fixText(n); }
        else fixAttrs(n);
      }
    };
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttrs(m.target);
        else for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.addEventListener('DOMContentLoaded', () => { walk(document.body); if (document.title !== 'Smazzata') document.title = t(document.title); }); // il nome dell'app non si traduce
    // finestre del browser (conferma, avviso, richiesta)
    for (const fn of ['confirm', 'alert', 'prompt']) {
      const orig = window[fn].bind(window);
      window[fn] = (msg, ...rest) => orig(t(msg), ...rest);
    }
  }
