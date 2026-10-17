// Offline preparation of the web build only. Never starts Docker, links a
// project, changes secrets, installs dependencies or calls RevenueCat.
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, stagingSequence } from './prepare-staging-database.mjs';
import { assertLocalSandboxConfiguration } from '../src/lib/nativeSandboxPolicy.ts';

export async function prepareNativeSandbox(workspace, apiUrl = 'http://127.0.0.1:54321', output = path.join(repoRoot, '.env.native-sandbox.local')) {
  const root = path.resolve(workspace);
  const config = await readFile(path.join(root, 'supabase/config.toml'), 'utf8');
  assert.match(config, /^project_id = "onlyfast-disposable-staging"$/m);
  assert.doesNotMatch(config, /\[remotes/);
  await assert.rejects(access(path.join(root, 'supabase/.temp/project-ref')), { code: 'ENOENT' });
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const sequence = await stagingSequence();
  assert.deepEqual(manifest.entries, sequence.entries.map(({ sql, ...e }) => e));
  for (const entry of sequence.entries) {
    assert.deepEqual(await readFile(path.join(root, 'supabase/migrations', entry.file)), entry.sql,
      `Staging migration drift: ${entry.file}`);
  }
  const status = JSON.parse(await readFile(path.join(root, 'local-status.json'), 'utf8'));
  assert.equal(new URL(status.API_URL).origin, 'http://127.0.0.1:54321');
  assert.equal(new URL(status.DB_URL).hostname, '127.0.0.1');
  assertLocalSandboxConfiguration('native-sandbox', apiUrl, status.ANON_KEY);
  // Configuration is public, but still refuse replacement of an existing file.
  await writeFile(output, `# LOCAL ONLY. Do not deploy this build to Vercel or a public host.
VITE_SUPABASE_URL=${apiUrl}
VITE_SUPABASE_ANON_KEY=${status.ANON_KEY}
VITE_HIDE_EXTERNAL_PAYMENTS=true
VITE_REVENUECAT_ENABLED=false
`, { flag: 'wx' });
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 4) throw new Error('Usage: node --experimental-strip-types scripts/prepare-native-sandbox.mjs [local-workspace] [local-api-url]');
  const output = await prepareNativeSandbox(process.argv[2] || path.join(repoRoot, 'tmp/staging-database'), process.argv[3]);
  console.log(`Prepared ${output}. Purchases remain blocked. No services were contacted.`);
}
