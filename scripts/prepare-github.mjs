// Prepare a public snapshot in the same repository, without checking out a second copy.
// This command never pushes or deploys anything.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode) || process.argv.length > 3) {
  throw new Error('Usage: node scripts/prepare-github.mjs [--check|--write]');
}
function git(args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
}
if (git(['branch', '--show-current']) !== 'main') throw new Error('Run from the development main branch.');
if (git(['status', '--porcelain'])) throw new Error('Commit or preserve local changes first; only committed source is exported.');
const source = git(['rev-parse', 'HEAD']);
const parent = git(['rev-parse', 'refs/heads/github-public']);
const privateRoot = git(['rev-list', '--max-parents=0', source]).split('\n');
const publicHistory = new Set(git(['rev-list', parent]).split('\n'));
if (privateRoot.some(sha => publicHistory.has(sha))) throw new Error('Public history includes private development history.');

const tracked = git(['ls-tree', '-r', '--name-only', '-z', source]).split('\0').filter(Boolean);
const forbidden = tracked.filter(path => /(^|\/)(\.env[^/]*|\.sites-runtime|\.wrangler|node_modules|outputs|work|\.agents|\.codex)(\/|$)|\.(pem|key|sqlite|sqlite3|db)$/i.test(path));
if (forbidden.length) throw new Error(`Review non-public tracked files before export: ${forbidden.join(', ')}`);
const hosting = JSON.parse(git(['show', `${source}:.openai/hosting.json`]));
const publicHosting = `${JSON.stringify({ d1: hosting.d1 ?? null, r2: hosting.r2 ?? null }, null, 2)}\n`;
const gitDir = git(['rev-parse', '--absolute-git-dir']);
const temp = mkdtempSync(join(gitDir, 'public-export-'));
const env = { ...process.env, GIT_INDEX_FILE: join(temp, 'index') };
try {
  git(['read-tree', source], { env });
  const blob = git(['hash-object', '-w', '--stdin'], { input: publicHosting });
  git(['update-index', '--add', '--cacheinfo', `100644,${blob},.openai/hosting.json`], { env });
  const tree = git(['write-tree'], { env });
  const exported = JSON.parse(git(['show', `${tree}:.openai/hosting.json`]));
  if ('project_id' in exported) throw new Error('Deployment identifier survived export.');
  const changed = tree !== git(['rev-parse', `${parent}^{tree}`]);
  let commit = parent;
  if (mode === '--write' && changed) {
    commit = git(['commit-tree', tree, '-p', parent, '-m', 'Synchronize public source from local development']);
    git(['update-ref', 'refs/heads/github-public', commit, parent]);
  }
  console.log(JSON.stringify({ mode, changed, publicTree: tree, publicCommit: commit, projectIdRemoved: true, pushed: false }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
