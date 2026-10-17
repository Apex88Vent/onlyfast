// Offline file preparation only: no database clients, credentials, subprocesses or network.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const resourceRoot = path.join(repoRoot, 'supabase', 'staging');
const sha256 = data => createHash('sha256').update(data).digest('hex');

export async function stagingSequence() {
  const plan = JSON.parse(await readFile(path.join(resourceRoot, 'plan.json'), 'utf8'));
  const canonical = (await readdir(path.join(repoRoot, 'supabase', 'migrations'))).filter(f => f.endsWith('.sql')).sort();
  const covered = [...plan.migrations, ...Object.keys(plan.excluded)].sort();
  if (JSON.stringify(canonical) !== JSON.stringify(covered) || new Set(covered).size !== covered.length) {
    throw new Error('Staging plan must explicitly cover every canonical migration exactly once. Review plan.json.');
  }
  const names = [plan.baseline, ...plan.migrations];
  const baselineVersion = plan.baseline.match(/^(\d{14})_/)[1];
  const baseDate = Date.UTC(...[
    +baselineVersion.slice(0, 4), +baselineVersion.slice(4, 6) - 1, +baselineVersion.slice(6, 8),
    +baselineVersion.slice(8, 10), +baselineVersion.slice(10, 12), +baselineVersion.slice(12, 14),
  ]);
  const entries = await Promise.all(names.map(async (name, index) => {
    const source = index === 0 ? path.join(resourceRoot, name) : path.join(repoRoot, 'supabase', 'migrations', name);
    const sql = await readFile(source); // Exact bytes: never rewrite billing or historical SQL.
    const version = new Date(baseDate + index * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
    return { source: path.relative(repoRoot, source).replaceAll('\\', '/'),
      file: version + '_' + name.replace(/^\d+_/, ''), sha256: sha256(sql), sql };
  }));
  return { entries, excluded: plan.excluded };
}

export async function prepareStagingDatabase(output) {
  const sequence = await stagingSequence();
  const target = path.resolve(output);
  // mkdir without recursive refuses any existing folder, including linked workspaces.
  // Never copy .temp, remotes, secrets, Auth rows, seeds, or Edge Functions.
  await mkdir(target);
  const supabase = path.join(target, 'supabase');
  await mkdir(path.join(supabase, 'migrations'), { recursive: true });
  for (const entry of sequence.entries) await writeFile(path.join(supabase, 'migrations', entry.file), entry.sql, { flag: 'wx' });
  await writeFile(path.join(supabase, 'config.toml'), `# STAGING ONLY. No remote project and no automatic function deployments.\nproject_id = "onlyfast-disposable-staging"\n[api]\nenabled = true\nschemas = ["public", "graphql_public"]\nextra_search_path = ["public", "extensions"]\n[db]\nmajor_version = 17\n[db.migrations]\nenabled = true\n[db.seed]\nenabled = false\nsql_paths = []\n[auth]\nsite_url = "http://127.0.0.1:3000"\n`, { flag: 'wx' });
  const manifest = { purpose: 'EMPTY STAGING DATABASE ONLY. Never merge this independent history into production.',
    entries: sequence.entries.map(({ sql, ...entry }) => entry), excluded: sequence.excluded };
  await writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await writeFile(path.join(target, 'README.md'), '# OnlyFast disposable staging database\n\nGenerated offline from reviewed schema-only resources. This is an independent migration history for a new empty database, not production migrations. No customer rows, credentials, seeds or Edge Functions are included. Read docs/STAGING_DATABASE_REBUILD.md in the source repository before using.\n', { flag: 'wx' });
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error('Usage: node scripts/prepare-staging-database.mjs [new-output-directory]');
  const output = path.resolve(process.argv[2] || path.join(repoRoot, 'tmp', 'staging-database'));
  const manifest = await prepareStagingDatabase(output);
  console.log(`Prepared ${manifest.entries.length} staging migrations in ${output}. No database was contacted.`);
}
