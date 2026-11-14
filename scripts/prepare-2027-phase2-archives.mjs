// Packages existing reviewed SQL only. Never connects to a database or deploys.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = new URL('../supabase/testing-2027/', import.meta.url);
export const phase2ArchiveSources = [
  ['phase2-archives.sql', 'F1374C37D76728469C3ACF5EC5CE352E44442B8862499682C4429A2C75393598'],
  ['track-trace-history-access.sql', '6751213223C5AF524BE57D1DA578AE77C405E7152517FB9F7E8CBE197692386A'],
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();

export async function preparePhase2ArchiveInstall() {
  const sections = [];
  for (const [file, fingerprint] of phase2ArchiveSources) {
    const bytes = await readFile(new URL(file, directory));
    assert.equal(sha256(bytes), fingerprint, 'Reviewed SQL fingerprint changed: ' + file);
    const source = bytes.toString('utf8').replaceAll('\r\n', '\n');
    assert.equal((source.match(/^begin;$/gm) || []).length, 1, file + ': transaction start');
    assert.equal((source.match(/^commit;$/gm) || []).length, 1, file + ': transaction end');
    assert.match(source, /\ncommit;\s*$/);
    const body = source.replace(/^begin;\n/m, '').replace(/\ncommit;\s*$/, '').trimEnd();
    sections.push('-- Source: ' + file + '\n-- SHA-256: ' + fingerprint + '\n' + body);
  }
  const sql = `-- OnlyFast 2027 testing installation artifact. Never production/root migrations.
-- Existing order: Phase 1C + API hardening -> Track Trace foundation -> Phase 2B.
-- One transaction installs archives, then historical-read/write separation.
-- Do not install the two component files again after applying this artifact.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
  if to_regprocedure('onlyfast_private.track_trace_enabled()') is null
    or to_regprocedure('onlyfast_private.track_trace_setup_writable(uuid)') is null
    or to_regprocedure('public.list_track_trace_link_candidates(uuid,integer)') is null
    or to_regprocedure('public.set_track_trace_session_link(uuid,uuid,uuid)') is null
    or to_regprocedure('public.list_track_trace_tracks(integer)') is null then
    raise exception 'INSTALLED_TRACK_TRACE_FOUNDATION_AND_PHASE2B_REQUIRED';
  end if;
  if to_regclass('onlyfast_private.setup_archives') is not null
    or to_regprocedure('onlyfast_private.require_track_trace_history()') is not null then
    raise exception 'PHASE2_ARCHIVES_OR_HISTORY_ALREADY_INSTALLED';
  end if;
end $$;

${sections.join('\n\n')}

commit;
`;
  return {
    sql,
    manifest: {
      project_ref: 'mfzajhnfonrfuiwxgvhe',
      organization_id: 'wxswxtsewczfijycqnwi',
      migration_name: 'onlyfast_2027_phase2_archives_history_testing',
      artifact: 'phase2-archives-install.sql',
      sha256: sha256(sql),
      prerequisite_order: ['23 Phase 1C bootstrap migrations', 'onlyfast_2027_phase1c_api_hardening', 'track_trace_foundation_testing', 'track_trace_phase2b'],
      component_order: phase2ArchiveSources.map(([file, sha256]) => ({ file, sha256 })),
      transaction: 'single; component transaction wrappers removed without changing their SQL bodies',
    },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { sql, manifest } = await preparePhase2ArchiveInstall();
  await writeFile(new URL(manifest.artifact, directory), sql);
  await writeFile(new URL('phase2-archives-install.manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ path: fileURLToPath(new URL(manifest.artifact, directory)), sha256: manifest.sha256 }));
}
