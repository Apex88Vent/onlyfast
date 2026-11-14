import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { bootstrap2027Sequence, TESTING_PROJECT_REF } from '../../scripts/prepare-2027-bootstrap.mjs';
import { archiveAuthFixture, archiveDatabase } from './archive2027.mjs';

export const phase2bSql = () => readFile(new URL('../../supabase/testing-2027/20261114144200_track_trace_phase2b.sql',import.meta.url),'utf8');
export async function phase2bDatabase(withArchives=false) {
  if(withArchives)return archiveDatabase({trackTrace:true});
  const db=new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(archiveAuthFixture);
  for(const e of (await bootstrap2027Sequence(TESTING_PROJECT_REF)).entries)await db.exec(e.sql
    .replace(/^create extension if not exists pgcrypto(?: with schema extensions)?;\r?$/gmi,'')
    .replace(/^create extension if not exists pg_cron with schema pg_catalog;\r?$/gmi,''));
  for(const file of ['phase1c-api-hardening.sql','track-trace.sql'])await db.exec(await readFile(new URL('../../supabase/testing-2027/'+file,import.meta.url),'utf8'));
  return db;
}
