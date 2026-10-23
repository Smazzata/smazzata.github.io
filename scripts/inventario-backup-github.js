'use strict';
// Sola lettura: API pubbliche, metadati Git; non scarica blob o credenziali.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const API = 'https://api.github.com/repos/Smazzata/smazzata.github.io';
async function get(route) {
  const r = await fetch(API + route, { headers: { 'User-Agent': 'Smazzata-backup-inventory', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`API ${r.status}: ${route}`);
  return r.json();
}
async function pages(route) {
  const out = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await get(`${route}${route.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
  throw new Error('Limite pagine raggiunto: inventario incompleto');
}
async function main() {
  const repo = await get('');
  const branches = await pages('/branches');
  const backup = branches.find(b => b.name === 'backup');
  if (!backup) throw new Error('Ramo backup assente: non equivale a bonifica degli oggetti storici');
  const commits = await pages(`/commits?sha=${backup.commit.sha}`);
  const trees = new Map();
  for (const c of commits) {
    const sha = c.commit.tree.sha;
    if (trees.has(sha)) continue;
    const tree = await get(`/git/trees/${sha}?recursive=1`);
    if (tree.truncated) throw new Error('Albero troncato: inventario incompleto');
    trees.set(sha, tree.tree.filter(f => f.type === 'blob').map(({ path, sha, size }) => ({ path, sha, size })));
  }
  const objects = new Map();
  for (const files of trees.values()) for (const f of files) {
    if (!/^backup-.*\.json$/.test(f.path)) continue;
    if (!objects.has(f.sha)) objects.set(f.sha, { sha: f.sha, size: f.size, paths: [] });
    const item = objects.get(f.sha);
    if (!item.paths.includes(f.path)) item.paths.push(f.path);
  }
  const localRefs = execFileSync('git', ['for-each-ref', '--format=%(refname) %(objectname)'], { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/);
  const headAfter = await get('/branches/backup');
  if (headAfter.commit.sha !== backup.commit.sha) throw new Error('Ramo cambiato durante la lettura: ripetere inventario');
  const report = {
    verified_at: new Date().toISOString(), repository: repo.full_name, visibility: repo.visibility,
    forks_count: repo.forks_count, backup_head: backup.commit.sha,
    remote_branches: branches.map(b => ({ name: b.name, sha: b.commit.sha })), local_refs: localRefs,
    commits: commits.map(c => ({ sha: c.sha, tree: c.commit.tree.sha, date: c.commit.committer.date })),
    current_files: trees.get(commits[0].commit.tree.sha), backup_blobs: [...objects.values()],
    limits: 'Soli metadati del ramo backup e riferimenti elencati. Non prova assenza di altri oggetti, cache, fork eliminati, cloni o esportazioni. Nessun blob scaricato; nessuna bonifica eseguita.'
  };
  const dest = path.join(ROOT, 'test-output', 'inventario-backup-completo.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: dest, commits: commits.length, backup_blobs: objects.size, current_files: report.current_files.length, last_commit: report.commits[0].date }));
}
main().catch(() => { console.error('Inventario non completato. Controllare rete, limite API e presenza del ramo; un eventuale report precedente non è aggiornato.'); process.exitCode = 1; });
