/* Burraco — Animazioni, statistiche sul dispositivo, effetti (burraco, coriandoli).
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Animazioni ================= */
  function rectOf(el) { return el && el.getBoundingClientRect(); }

  function fly(fromEl, toEl, html, { delay = 0, dur = 420 } = {}) {
    const a = rectOf(fromEl), b = rectOf(toEl);
    if (!a || !b || !a.width || !b.width) return;
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = html;
    document.body.appendChild(el);
    const card = el.firstElementChild;
    const w = card.offsetWidth || 50;
    const sx = a.left + a.width / 2 - w / 2, sy = a.top + a.height / 2 - w * 0.7;
    const ex = b.left + b.width / 2 - w / 2, ey = b.top + b.height / 2 - w * 0.7;
    el.style.transform = `translate(${sx}px, ${sy}px) scale(.8)`;
    el.style.opacity = '0';
    setTimeout(() => {
      el.style.transition = `transform ${dur}ms cubic-bezier(.2,.8,.2,1), opacity 150ms`;
      el.style.opacity = '1';
      el.style.transform = `translate(${ex}px, ${ey}px) scale(1) rotate(${(Math.random() - 0.5) * 16}deg)`;
    }, 20 + delay);
    setTimeout(() => el.remove(), dur + delay + 120);
  }

  /** Distribuzione: qualche carta vola dal tallone a ogni giocatore, la mia mano entra carta per carta */
  function dealAnimation() {
    const g = S.game;
    if (!g || reducedMotion) return;
    const stock = $('.stock');
    if (!stock) return;
    Sound.play('shuffle');
    const seats = [...$$('.seatchip'), $('.handwrap')].filter(Boolean);
    let k = 0;
    for (let round = 0; round < 3; round++) {
      for (const el of seats) {
        const d = 450 + k * 70;
        fly(stock, el, backHTML(), { delay: d, dur: 340 });
        setTimeout(() => Sound.play('deal'), d + 300);
        k++;
      }
    }
    const cards = $$('#hand .card');
    cards.forEach((c, i) => { c.style.animationDelay = `${450 + i * 55}ms`; c.classList.add('dealin'); });
    setTimeout(() => cards.forEach((c) => { c.classList.remove('dealin'); c.style.animationDelay = ''; }), 450 + cards.length * 55 + 500);
  }

  function animateEvent(ev) {
    const g = S.game;
    if (!g) return;
    const mine = ev.seat === g.you;
    const seatEl = mine ? $('#hand') : $(`.seatchip[data-seat="${ev.seat}"]`);
    const stock = $('.stock .deck');
    const pile = $('.pile .pcards');
    if (ev.type === 'draw' && !mine) fly(stock, seatEl, backHTML());
    else if (ev.type === 'draw' && mine) fly(stock, $(`#hand .card.newc`) || seatEl, backHTML());
    else if (ev.type === 'discard' && !mine) {
      const top = $('.pile .card.top');
      const c = g.discard[g.discard.length - 1];
      if (top) top.style.visibility = 'hidden';
      fly(seatEl, top || pile, c ? cardHTML(c) : backHTML(), { dur: 380 });
      setTimeout(() => { if (top) top.style.visibility = ''; }, 420);
    } else if (ev.type === 'pile') {
      for (let i = 0; i < Math.min(ev.count || 1, 5); i++) fly(pile, seatEl, backHTML(), { delay: i * 60 });
    } else if (ev.type === 'pozzetto') {
      for (let i = 0; i < 4; i++) fly($('.pozz .pz') || stock, seatEl, backHTML(), { delay: i * 70 });
    }
  }

  /* ---------- Statistiche personali (salvate sul dispositivo) ---------- */
  const STATS0 = { games: 0, wins: 0, hands: 0, handsWon: 0, burraco: 0, closures: 0, bestHand: null, points: 0 };
  function loadStats() { return { ...STATS0, ...store.get('bur_stats', {}) }; }

  /** Conta ogni fine smazzata / fine partita una sola volta, anche ricaricando la pagina */
  function recordStats(room, game) {
    const hr = game.handResult;
    if (!hr || game.you < 0) return;
    const seen = store.get('bur_stats_seen', []);
    const key = `${room.code}:${game.history.length}:${hr.scores.join(',')}`;
    if (seen.includes(key)) return;
    const st = loadStats();
    const mine = hr.teams.find((t) => t.members.includes(game.you));
    if (mine) {
      st.hands++;
      if (mine.total === Math.max(...hr.teams.map((t) => t.total))) st.handsWon++;
      st.burraco += mine.burraco.length;
      st.points += mine.total;
      st.bestHand = st.bestHand == null ? mine.total : Math.max(st.bestHand, mine.total);
    }
    if (hr.reason === 'close' && hr.closer === game.you) st.closures++;
    if (game.over) { st.games++; if (game.winners.includes(game.you)) st.wins++; }
    store.set('bur_stats', st);
    store.set('bur_stats_seen', seen.concat(key).slice(-100));
  }

  const PRESET_NAMES = { classico: 'Classico', reale: 'Reale', aberto: 'Aberto', fechado: 'Fechado', personalizzate: 'Personalizzate' };
  const fmtDate = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  /** Sfida del giorno: variante di oggi, il mio risultato e la classifica */
  async function dailyModal() {
    const r = await emit('daily');
    if (!r.ok) return;
    S.dailyRules = r.rules;
    const day = new Date(r.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const mine = r.mine
      ? (r.mine.score != null
        ? `<div class="winner">Hai fatto ${signed(r.mine.score)} punti${r.myPos ? ` · ${r.myPos}° posto` : ''}</div><p class="muted" style="text-align:center">Torna domani per una nuova sfida!</p>`
        : '<p class="muted" style="text-align:center">Hai già usato il tentativo di oggi. Torna domani!</p>')
      : '<div class="row"><button class="btn primary grow big" data-act="startDaily">▶ Gioca la sfida</button></div>';
    const rows = r.top.map((x) => `<tr class="${x.me ? 'meRow' : ''}"><td>${['🥇', '🥈', '🥉'][x.pos - 1] || x.pos}</td><td style="text-align:left">${esc(x.name)}${x.me ? ' (tu)' : ''}</td><td><b>${signed(x.score)}</b></td></tr>`).join('');
    openModal('daily', `<div class="result"><h2>📅 Sfida del giorno</h2><p class="muted">${esc(day)}</p>
      <div class="dailycard"><b class="dtitle">${esc(r.title)}</b>
        <p>Una sola smazzata contro il computer <b>difficile</b>, con <b>le stesse carte per tutti</b>. Vince chi fa più punti. Hai un solo tentativo.</p>
        <button class="btn small" data-act="dailyRules">📜 Regole della sfida</button></div>
      ${mine}
      <h3>Classifica di oggi${r.players ? ` · ${r.players} ${r.players === 1 ? 'giocatore' : 'giocatori'}` : ''}</h3>
      ${rows ? `<table>${rows}</table>` : '<p class="muted">Nessuno ha ancora finito la sfida di oggi: sii il primo!</p>'}</div>`);
  }

  /** Bacheca dei trofei: sbloccati a colori, gli altri in grigio con l'avanzamento */
  function trophiesHTML(list) {
    const got = list.filter((t) => t.at).length;
    return `<h3>🏆 Trofei <span class="muted small">${got} su ${list.length}</span></h3><div class="trophies">${list.map((t) => `
      <div class="trophy ${t.at ? 'got' : ''}" title="${esc(t.desc)}"><i>${esc(t.e)}</i><b>${esc(t.name)}</b><span>${esc(t.desc)}</span>
        ${t.progress ? `<em class="tprog"><u style="width:${Math.round((t.progress.now / t.progress.goal) * 100)}%"></u></em><span class="tnum">${t.progress.now}/${t.progress.goal}</span>` : ''}
        ${t.at ? `<span class="tdate">${new Date(t.at).toLocaleDateString('it-IT')}</span>` : ''}</div>`).join('')}</div>`;
  }

  function statsTable(st, gid) {
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const row = (l, v) => `<tr><td>${l}</td><td><b>${v}</b></td></tr>`;
    if (gid === 'scala40') {
      return `<table>
      ${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
      ${row('Smazzate giocate', st.hands)}${row('Chiusure', `${st.closures} (${pct(st.closures, st.hands)})`)}
      ${row('Penalità media a smazzata', st.avgHand == null ? '—' : -st.avgHand)}
    </table>`;
    }
    return `<table>
      ${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
      ${row('Smazzate giocate', st.hands)}${row('Smazzate vinte', `${st.handsWon} (${pct(st.handsWon, st.hands)})`)}
      ${row('Burraco fatti', st.burraco)}${row('Chiusure', st.closures)}
      ${row('Miglior smazzata', st.bestHand == null ? '—' : st.bestHand)}${row('Media punti a smazzata', st.avgHand == null ? '—' : st.avgHand)}
    </table>`;
  }

  function historyHTML(list) {
    if (!list.length) return '<p class="muted">Nessuna partita completata.</p>';
    return list.map((h) => `<div class="hist ${h.won ? 'won' : 'lost'}">
      <span class="hres">${h.won ? '🏆' : '—'}</span>
      <span class="grow"><b>${h.won ? 'Vinta' : 'Persa'}</b> · ${fmtDate(h.at)} · ${h.game === 'scala40' ? 'Scala 40' : PRESET_NAMES[h.preset] || h.preset}${h.hands ? ` · ${h.hands} smazzate` : ''}<br>
      <span class="muted small">${h.teams.map((t) => `${t.mine ? '<b>' : ''}${t.names.map(esc).join(' & ')} ${t.score}${t.mine ? '</b>' : ''}`).join(' · ')}</span></span></div>`).join('');
  }

  /** Statistiche divise per gioco (una tabella per gioco giocato) */
  function byGameHTML(byGame, total) {
    const games = Object.entries(byGame || {});
    if (!games.length) return total ? statsTable(total) : '<p class="muted">Gioca la tua prima smazzata per vedere le statistiche.</p>';
    return games.map(([gid, st]) => `<h3>${gid === 'scala40' ? '🂡 Scala 40' : '🃏 Burraco'}</h3>${statsTable(st, gid)}`).join('');
  }

  async function statsModal() {
    if (OFFLINE || !S.social || !S.social.nick) { localStatsModal(); return; }
    const r = await emit('myStats');
    if (!r.ok) return;
    openModal('stats', `<div class="result"><h2>📊 Le tue statistiche</h2>
      ${r.level ? `<div class="lvlbox">${lvlHTML(r.level.level)}<div><b>Livello ${r.level.level}</b>
        <em class="xpbar"><u style="width:${Math.round((r.level.into / r.level.need) * 100)}%"></u></em>
        <span class="muted small">${r.level.into}/${r.level.need} punti esperienza al livello ${r.level.level + 1} · partite, vittorie, burraco, chiusure e trofei fanno salire</span></div></div>` : ''}
      ${byGameHTML(r.byGame, r.stats)}
      ${r.trophies ? trophiesHTML(r.trophies) : ''}
      <h3>Ultime partite</h3>${historyHTML(r.history)}
      <p class="muted small">Le statistiche sono salvate sul server: ti seguono anche se cambi dispositivo.</p></div>`);
  }

  function localStatsModal() {
    const st = loadStats();
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const row = (l, v) => `<tr><td>${l}</td><td><b>${v}</b></td></tr>`;
    openModal('stats', `<div class="result"><h2>📊 Le tue statistiche</h2>
      ${st.hands ? `<table>
        ${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
        ${row('Smazzate giocate', st.hands)}${row('Smazzate vinte', `${st.handsWon} (${pct(st.handsWon, st.hands)})`)}
        ${row('Burraco fatti', st.burraco)}${row('Chiusure', st.closures)}
        ${row('Miglior smazzata', st.bestHand)}${row('Media punti a smazzata', Math.round(st.points / st.hands))}
      </table>` : '<p class="muted">Gioca la tua prima smazzata per vedere le statistiche.</p>'}
      <p class="muted small">Le statistiche sono salvate solo su questo dispositivo.</p>
      ${st.hands ? '<button class="btn small danger" data-act="resetStats">Azzera statistiche</button>' : ''}</div>`);
  }

  /* ---------- Effetti: burraco e coriandoli ---------- */
  const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burracoFx(fx) {
    const el = $(`.meld[data-mid="${fx.meldId}"]`);
    if (el) { el.classList.add('shine'); setTimeout(() => el.classList.remove('shine'), 2600); }
    const b = document.createElement('div');
    b.className = 'bigtoast' + (fx.mine ? ' mine' : '');
    b.innerHTML = `<b>${esc(fx.label.toUpperCase())}!</b><span>+${fx.bonus}</span>`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2300);
    if (fx.mine) confetti(60, 1600);
  }

  function confetti(count = 160, duration = 3200) {
    if (reducedMotion) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    const colors = ['#f2c14e', '#e53935', '#43a047', '#1e88e5', '#ffffff', '#8e63d6'];
    const ps = Array.from({ length: count }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / duration;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.7) / 0.3);
      for (const p of ps) {
        p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore();
      }
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }
