import { readFile } from 'node:fs/promises';
import { phase2bDatabase, phase2bSql } from './trackTracePhase2b.mjs';
export async function billingDatabase({beforeInstall}={}) {
  const db=await phase2bDatabase();
  await db.exec(await phase2bSql());
  await db.exec(await readFile(new URL('../../supabase/testing-2027/phase2-archives-install.sql',import.meta.url),'utf8'));
  await db.exec("alter table auth.users add column created_at timestamptz not null default '2026-12-01T00:00:00Z'");
  if(beforeInstall)await beforeInstall(db);
  try {await db.exec(await readFile(new URL('../../supabase/testing-2027/phase3b-subscriptions-install.sql',import.meta.url),'utf8'));}
  catch(error){await db.close();throw error;}
  await db.exec(await readFile(new URL('../../supabase/testing-2027/phase3b-account-access-compatibility.sql',import.meta.url),'utf8'));
  return db;
}
export async function billingClock(db,time) {
  if(!Number.isFinite(Date.parse(time)))throw new Error('Invalid fixture clock');
  await db.exec(`create or replace function onlyfast_private.billing2027_now() returns timestamptz language sql stable set search_path='' as $$ select '${new Date(time).toISOString()}'::timestamptz $$`);
}
export const billingRpc=async(db,name,args=[]) => (await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') r',args)).rows[0].r;
