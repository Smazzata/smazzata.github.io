'use strict';

module.exports = function privacyTests() {
  const assert = require('assert');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const P = require('./privacy');
  const B = require('../scripts/backup');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smazzata-privacy-'));
  const now = Date.now(), day = 86400000;
  const oldPass = process.env.BACKUP_PASSPHRASE;
  try {
    fs.mkdirSync(path.join(dir, 'backups'));
    for (const name of ['prima-del-reset-progressi-123.json', 'stato.json.importato', 'backups/backup-2026-01-01.json']) {
      fs.writeFileSync(path.join(dir, name), 'segreto');
      fs.utimesSync(path.join(dir, name), new Date(now - 8 * day), new Date(now - 8 * day));
    }
    fs.writeFileSync(path.join(dir, 'admin-key.txt'), 'non toccare');
    fs.writeFileSync(path.join(dir, 'backups/backup-2099-01-01.json'), 'copia recente');
    P.cleanCopies(dir, { now });
    assert.strictEqual(P.privateCopies(dir).length, 1, 'scadenza per età reale, non per numero o nome file');
    assert(fs.existsSync(path.join(dir, 'admin-key.txt')), 'pulizia limitata alle copie riconosciute');

    const token = 'account-da-eliminare';
    const E = require('./engine'), Bot = require('./bot');
    const game = E.createGame({ players: [{ name: 'Tempo' }, { name: 'Anna' }, { name: 'B' }, { name: 'C' }] });
    const room = { code: 'ABC', seats: [{ token, name: 'Tempo', avatar: { e: '😀' } }, { token: 'other', name: 'Anna' }, { isBot: true, name: 'B' }, { isBot: true, name: 'C' }],
      game, spectators: [token], hostToken: token, botMemo: {}, chatLog: [{ name: 'Tempo', text: 'Ciao' }], music: { by: 'Tempo', url: 'https://open.spotify.com/playlist/x' } };
    const league = { id: 'L', owner: token, members: [token, 'other'], standings: { [token]: { name: 'Tempo' } }, past: [{ winners: ['Tempo', 'Anna'] }] };
    const ctx = { sessions: new Map([[token, { nick: 'Tempo', name: 'Tempo' }]]),
      leaderboard: new Map([[token, { games: 10 }], ['other', { games: 4, history: [{ tokens: [token, 'other'], teams: [{ names: ['Tempo', 'Anna'] }] }], timeline: [{ o: ['Tempo'] }] }]]),
      daily: new Map([['2026-10-21', { [token]: { name: 'Tempo' }, other: { name: 'Anna' } }]]),
      leagues: new Map([['L', league]]), tournaments: new Map([['T', { owner: token, players: [{ token, name: 'Tempo' }, { token: 'other', name: 'Anna' }], rounds: [{ a: 0, b: 1 }] }]]),
      rooms: new Map([['ABC', room]]), reports: [{ at: now, nick: 'Anna', text: 'Problema' }, { at: now, nick: 'Tempo', text: 'Errore' }, { at: now, nick: 'Anna', target: 'Tempo', chat: ['Tempo: ciao'] }], broadcast() {},
    };
    ctx.League = require('./leagues')({ leagues: ctx.leagues, nickOf: (t) => t === token ? 'Tempo' : 'Anna' });
    P.eraseRelated(ctx, token, dir);
    assert.strictEqual(P.privateCopies(dir).length, 0, 'eliminazione anche delle copie non ancora scadute');
    assert(!ctx.leaderboard.has(token));
    assert.strictEqual(ctx.leaderboard.get('other').games, 4, 'risultati numerici altrui preservati');
    for (const collection of [ctx.leaderboard, ctx.daily, ctx.leagues, ctx.tournaments, ctx.rooms]) {
      const text = JSON.stringify([...collection]);
      assert(!text.includes(token) && !text.includes('Tempo'), 'nessun riferimento al profilo nelle collezioni condivise');
    }
    assert.strictEqual(ctx.reports.length, 1);
    assert(room.seats[0].isBot && !room.seats[0].avatar && room.hostToken === 'other');
    // La trasformazione del posto non rompe il motore né gli indici delle carte/moviole.
    for (let i = 0; i < 15 && game.phase !== 'handEnd'; i++) E.apply(game, game.turn, Bot.nextAction(game, game.turn, {}));
    assert(E.viewFor(game, 1).players.length === 4);
    assert.deepStrictEqual(P.scrub([null, 'x', null], token, ['Tempo']), [null, 'x', null], 'posizioni nulle negli array preservate');

    ctx.reports.push({ at: now - 91 * day, nick: 'Anna' });
    ctx.daily.set('2000-01-01', { other: { score: 1 } });
    assert(P.expireReports(ctx, now));
    assert.strictEqual(ctx.reports.length, 1);
    assert(!ctx.daily.has('2000-01-01'));

    fs.writeFileSync(path.join(dir, 'stato.json'), JSON.stringify({ savedAt: now, accountsEpoch: 3, sessions: [], rooms: [] }));
    process.env.BACKUP_PASSPHRASE = 'frase privata solo per il test';
    assert(B.localBackup(dir, now).created, 'copia privata creata senza token GitHub');
    const file = P.privateCopies(dir)[0];
    assert(!fs.readFileSync(file, 'utf8').includes('sessions'), 'contenuto non in chiaro');
    assert.strictEqual(JSON.parse(B.decrypt(fs.readFileSync(file, 'utf8'), process.env.BACKUP_PASSPHRASE)).savedAt, now);
    assert.throws(() => B.decrypt(fs.readFileSync(file, 'utf8'), 'frase sbagliata'));
    assert.strictEqual(B.localBackup(dir, now + 60000).created, false, 'nessuna copia ogni ora se non sono passate 6 ore');
    const refused = spawnSync(process.execPath, [path.join(__dirname, '../scripts/backup.js'), 'crea', path.join(dir, 'stato.json'), path.join(dir, 'pubblico.json')], { encoding: 'utf8' });
    assert.strictEqual(refused.status, 1, 'il vecchio ciclo shell non può più esportare copie per GitHub');
    assert(!fs.existsSync(path.join(dir, 'pubblico.json')));
    console.log('privacy: cancellazione riferimenti e copie, continuità partita, scadenze reali, backup cifrati privati OK');
  } finally {
    if (oldPass === undefined) delete process.env.BACKUP_PASSPHRASE; else process.env.BACKUP_PASSPHRASE = oldPass;
    fs.rmSync(dir, { recursive: true, force: true });
  }
};
