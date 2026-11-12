// Schema-only file preparation. No credentials, HTTP, database or CLI calls.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stagingSequence } from './prepare-staging-database.mjs';
import { testing2027Sql } from './prepare-2027-testing-policy.mjs';

export const TESTING_PROJECT_REF = 'mfzajhnfonrfuiwxgvhe';
export const TESTING_ORGANIZATION_ID = 'wxswxtsewczfijycqnwi';
const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
export async function bootstrap2027Sequence(projectRef) {
  if (projectRef !== TESTING_PROJECT_REF) throw new Error('EXACT_TESTING_PROJECT_REQUIRED');
  const sequence = await stagingSequence();
  const entries = sequence.entries.map(entry => ({ source: entry.source, sql: entry.sql.toString('utf8') }));
  for (const file of ['20261105090932_phase1_membership_and_sharing.sql',
    '20261105090937_phase1_setup_and_usage_authorization.sql',
    '20261105091108_phase1_restrict_legacy_access.sql',
    '20261110233145_restore_test_subscription_switching.sql']) {
    entries.push({ source: 'supabase/migrations/' + file, sql: await readFile(path.join(root, 'supabase/migrations', file), 'utf8') });
  }
  entries.push({ source: 'supabase/testing-2027/sharing-cleanup.sql', sql: await readFile(path.join(root, 'supabase/testing-2027/sharing-cleanup.sql'), 'utf8') });
  entries.push({ source: 'scripts/prepare-2027-testing-policy.mjs', sql: (await testing2027Sql())
    .replace('begin;\n', "begin;\nselect set_config('onlyfast.testing_project_ref','" + TESTING_PROJECT_REF + "',true);\n") });
  entries.push({ source: '2027 environment verification RPC', sql: `begin;
create function onlyfast_private.environment_2027()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('project_ref',project_ref,'schema_version','phase1b-v1')
  from onlyfast_private.testing_2027_environment where project_ref='${TESTING_PROJECT_REF}';
$$;
-- Deliberately exposes only a non-secret environment/version marker, no user data.
revoke all on function onlyfast_private.environment_2027() from public;
grant execute on function onlyfast_private.environment_2027() to anon,authenticated;
create function public.get_onlyfast_2027_environment()
returns jsonb language sql stable security invoker set search_path='' as $$
  select onlyfast_private.environment_2027();
$$;
revoke all on function public.get_onlyfast_2027_environment() from public;
grant execute on function public.get_onlyfast_2027_environment() to anon,authenticated;
notify pgrst,'reload schema';
commit;
` });
  return { projectRef, organizationId: TESTING_ORGANIZATION_ID, entries: entries.map((entry, index) => ({
    ...entry, file: String(index + 1).padStart(3, '0') + '_' + path.basename(entry.source, path.extname(entry.source)).replace(/[^a-zA-Z0-9_.-]/g, '_') + '.sql', sha256: sha256(entry.sql),
  })) };
}

export async function prepare2027Bootstrap(output, projectRef) {
  const sequence = await bootstrap2027Sequence(projectRef);
  const target = path.resolve(output);
  if (target === root || target === path.join(root, 'supabase') || target.startsWith(path.join(root, 'supabase/migrations'))) {
    throw new Error('NEVER_WRITE_PRODUCTION_MIGRATION_PATH');
  }
  await mkdir(target); // Refuse existing directories and preserve all previous output.
  for (const entry of sequence.entries) await writeFile(path.join(target, entry.file), entry.sql, { flag: 'wx' });
  const manifest = { purpose: 'EMPTY TESTING PROJECT ONLY; independently verify target before every application.',
    projectRef, organizationId: sequence.organizationId, entries: sequence.entries.map(({ sql, ...entry }) => entry) };
  await writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/prepare-2027-bootstrap.mjs NEW_OUTPUT_DIRECTORY mfzajhnfonrfuiwxgvhe');
  const manifest = await prepare2027Bootstrap(process.argv[2], process.argv[3]);
  console.log('Prepared ' + manifest.entries.length + ' schema-only SQL files. No database was contacted.');
}
