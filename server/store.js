'use strict';
/*
 * Archivio dei dati del server.
 *   - Con SQLite (incluso in Node 22.13+ e 24, nessuna dipendenza): data/burraco.db, una riga per voce
 *     (sessione, statistiche, tavolo…). A ogni salvataggio si scrivono SOLO le voci cambiate, in una transazione.
 *   - Senza SQLite (Node vecchio): il file data/stato.json di sempre, riscritto per intero.
 * Il formato dei dati è lo stesso (quello di stato.json): il backup esporta da qui e un ripristino scrive
 * stato.json, che al riavvio viene importato nel database (se è più recente).
 */
const fs = require('fs');
const path = require('path');

function openSqlite(file) {
  // SQLite di Node è ancora "sperimentale": niente avviso a ogni avvio
  const emit = process.emitWarning;
  process.emitWarning = (w, ...rest) => { if (!/SQLite/i.test(String(w && w.message ? w.message : w))) emit.call(process, w, ...rest); };
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA secure_delete = ON;');
    db.exec('CREATE TABLE IF NOT EXISTS kv (coll TEXT NOT NULL, key TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (coll, key))');
    return db;
  } catch (e) {
    return null;
  } finally {
    process.emitWarning = emit;
  }
}

/** Dati (formato stato.json) -> righe { coll, key, json } */
function toRows(data) {
  const rows = [];
  for (const [k, v] of data.sessions || []) rows.push(['sessions', k, v]);
  for (const [k, v] of data.leaderboard || []) rows.push(['leaderboard', k, v]);
  for (const r of data.rooms || []) rows.push(['rooms', r.code, r]);
  for (const lg of data.leagues || []) rows.push(['leagues', lg.id, lg]);
  for (const t of data.tournaments || []) rows.push(['tournaments', t.id, t]);
  for (const [d, m] of data.daily || []) rows.push(['daily', d, m]);
  rows.push(['meta', 'reports', data.reports || []]);
  rows.push(['meta', 'deliveries', data.deliveries || []]);
  const ranked = data.ranked || require('./ranked').empty();
  for (const [token, ranks] of Object.entries(ranked.players)) rows.push(['rankedPlayers', token, ranks]);
  for (const [id, match] of Object.entries(ranked.matches)) rows.push(['rankedMatches', id, match]);
  rows.push(['meta', 'rankedMeta', { version: ranked.version, legends: ranked.legends, legendAt: ranked.legendAt }]);
  rows.push(['meta', 'accountsEpoch', data.accountsEpoch || 1]);
  rows.push(['meta', 'progressEpoch', data.progressEpoch || 0]);
  rows.push(['meta', 'savedAt', data.savedAt || Date.now()]);
  return rows.map(([coll, key, v]) => ({ coll, key: String(key), json: JSON.stringify(v) }));
}

/** Righe -> dati (formato stato.json) */
function fromRows(rows) {
  const data = { sessions: [], leaderboard: [], rooms: [], leagues: [], tournaments: [], daily: [], reports: [], savedAt: 0 };
  data.ranked = require('./ranked').empty();
  for (const { coll, key, json } of rows) {
    const v = JSON.parse(json);
    if (coll === 'sessions' || coll === 'leaderboard' || coll === 'daily') data[coll].push([key, v]);
    else if (coll === 'rooms' || coll === 'leagues' || coll === 'tournaments') data[coll].push(v);
    else if (coll === 'meta' && key === 'reports') data.reports = v;
    else if (coll === 'meta' && key === 'deliveries') data.deliveries = v;
    else if (coll === 'meta' && key === 'ranked') data.ranked = v;
    else if (coll === 'rankedPlayers') data.ranked.players[key] = v;
    else if (coll === 'rankedMatches') data.ranked.matches[key] = v;
    else if (coll === 'meta' && key === 'rankedMeta') Object.assign(data.ranked, v);
    else if (coll === 'meta' && key === 'savedAt') data.savedAt = v;
    else if (coll === 'meta' && key === 'accountsEpoch') data.accountsEpoch = v;
    else if (coll === 'meta' && key === 'progressEpoch') data.progressEpoch = v;
  }
  return data;
}

function openStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const jsonFile = path.join(dataDir, 'stato.json');
  const db = openSqlite(path.join(dataDir, 'burraco.db'));
  const saved = new Map(); // "coll\0key" -> json già scritto (per scrivere solo ciò che cambia)

  if (!db) {
    return {
      kind: 'json',
      load() { return fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : null; },
      save(data) {
        fs.writeFileSync(jsonFile + '.tmp', JSON.stringify(data), { mode: 0o600 });
        fs.renameSync(jsonFile + '.tmp', jsonFile);
        return { written: 1 };
      },
    };
  }

  const upsert = db.prepare('INSERT INTO kv (coll, key, json) VALUES (?, ?, ?) ON CONFLICT (coll, key) DO UPDATE SET json = excluded.json');
  const del = db.prepare('DELETE FROM kv WHERE coll = ? AND key = ?');

  function writeAll(data) {
    const rows = toRows(data);
    const seen = new Set();
    let written = 0;
    db.exec('BEGIN');
    try {
      for (const r of rows) {
        const id = r.coll + '\0' + r.key;
        seen.add(id);
        if (r.coll === 'meta' && r.key === 'savedAt') continue; // si aggiorna solo se è cambiato qualcosa
        if (saved.get(id) === r.json) continue;
        upsert.run(r.coll, r.key, r.json);
        saved.set(id, r.json);
        written++;
      }
      for (const id of [...saved.keys()]) {
        if (seen.has(id)) continue;
        const [coll, key] = id.split('\0');
        del.run(coll, key);
        saved.delete(id);
        written++;
      }
      if (written) {
        const t = JSON.stringify(data.savedAt || Date.now());
        upsert.run('meta', 'savedAt', t);
        saved.set('meta\0savedAt', t);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      saved.clear(); // al prossimo giro si riscrive tutto
      throw e;
    }
    return { written };
  }

  return {
    kind: 'sqlite',
    load() {
      const data = fromRows(db.prepare('SELECT coll, key, json FROM kv').all());
      for (const r of db.prepare('SELECT coll, key, json FROM kv').all()) saved.set(r.coll + '\0' + r.key, r.json);
      // stato.json più recente del database (primo avvio o ripristino da backup): si importa
      if (fs.existsSync(jsonFile)) {
        const fromFile = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        const fileTime = Math.max(fromFile.savedAt || 0, fs.statSync(jsonFile).mtimeMs);
        if (!data.savedAt || fileTime > data.savedAt) {
          writeAll({ ...fromFile, savedAt: Date.now() });
          fs.renameSync(jsonFile, jsonFile + '.importato');
          console.log('Dati importati da stato.json nel database');
          return fromFile;
        }
      }
      return data.savedAt ? data : null;
    },
    save: writeAll,
    purgeResiduals() {
      const checkpoint = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
      if (checkpoint.busy) throw new Error('Archivio occupato: ripetere la cancellazione');
      if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile);
    },
  };
}

/** Per il backup: tutti i dati (dal database se c'è, altrimenti da stato.json) */
function exportData(dataDir) {
  const dbFile = path.join(dataDir, 'burraco.db');
  if (fs.existsSync(dbFile)) {
    const db = openSqlite(dbFile);
    if (db) {
      const data = fromRows(db.prepare('SELECT coll, key, json FROM kv').all());
      db.close();
      return data;
    }
  }
  return JSON.parse(fs.readFileSync(path.join(dataDir, 'stato.json'), 'utf8'));
}

module.exports = { openStore, exportData, toRows, fromRows };
