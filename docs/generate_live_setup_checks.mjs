// Generates SQL from the actual existing application base-setup serializer.
// This script writes a local SQL file only; it never contacts a database.
import { writeFileSync } from 'node:fs';
import { componentFunction } from '../tests/setupLibraryHarness.ts';
import { buildBetaAccessSnapshot, setCachedBetaAccess } from '../src/lib/betaFeatures.ts';
const id = '4b9864ff-2195-4be0-83a4-39308446577e';
setCachedBetaAccess(buildBetaAccessSnapshot({ user_id:id, is_test_account:true, beta_features_enabled:true, tester_kind:'experimental' }, [{ feature_key:'test_account_full_access', enabled:true }]));
const save = componentFunction('CreateBaseSetupView.tsx','buildPayload',{user:{id}});
const names = ['Winged Sprint Cars','Legends','GT3','Road Racing / Superbike','RC Touring Car'];
const payloads = names.map(name => save({ raceClass:name, setup_name:`LIVE QA - ${name} - 20261001`,
  trackName:'LIVE QA circuit', raceDate:'2026-10-01', session_track:'LIVE QA circuit', session_weather:'Dry',
  ambient_temperature:'82.5', fuel_load:'10.25', fork_height:'3.5', front_ride_height:'5.0', front_camber:'-1.25' }));
const columns = Object.keys(payloads[0]);
if (!columns.every(c => /^[a-z_]+$/.test(c))) throw new Error('Unexpected serializer column');
const sql = `-- Creates six clearly named LIVE QA base setups using actual app payloads.
-- Uses authenticated RLS and RPCs, restores the existing active class, preserves
-- original setup rows, and does not touch Auth/onboarding/feature flags.
begin;
select set_config('request.jwt.claim.sub','${id}',true);
select set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true);
set local role authenticated;
create temporary table onlyfast_live_qa_result(report jsonb) on commit drop;
do $checks$
declare
 payload jsonb; original_class text; original_rows jsonb; restored_rows jsonb;
 original_gt3 uuid; copied_gt3 uuid; expected jsonb; actual jsonb; setup_id uuid;
begin
 if auth.uid() <> '${id}'::uuid or not public.onlyfast_can_use_setup_library() then raise exception 'Wrong user or missing test access'; end if;
 select public.get_active_race_class_state()->>'active_class' into original_class;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into original_rows from public.race_setups r where r.user_id=auth.uid();
 if exists(select 1 from public.race_setups where user_id=auth.uid() and setup_name like 'LIVE QA - % - 20261001') then raise exception 'QA names already exist; inspect existing rows instead of overwriting'; end if;
 for payload in select value from jsonb_array_elements($payload$${JSON.stringify(payloads)}$payload$::jsonb) loop
   perform public.change_active_race_class(payload->>'race_class');
   insert into public.race_setups (${columns.join(',')})
   select ${columns.map(c=>`r.${c}`).join(',')} from jsonb_populate_record(null::public.race_setups,payload) r returning id into setup_id;
   select custom_fields into actual from public.race_setups where id=setup_id;
   if actual is distinct from payload->'custom_fields' then raise exception 'Reopen mismatch for %',payload->>'race_class'; end if;
   if payload->>'race_class'='GT3' then original_gt3:=setup_id; expected:=actual; end if;
 end loop;
 update public.race_setups set setup_name='LIVE QA - GT3 - RENAMED - 20261001' where id=original_gt3;
 if not exists(select 1 from public.race_setups where id=original_gt3 and setup_name='LIVE QA - GT3 - RENAMED - 20261001' and custom_fields=expected) then raise exception 'Rename/reopen failed'; end if;
 perform public.change_active_race_class('GT3');
 insert into public.race_setups (${columns.join(',')})
 select ${columns.map(c=>c==='setup_name'?"'LIVE QA - GT3 - COPY - 20261001'":`r.${c}`).join(',')} from public.race_setups r where r.id=original_gt3 returning id into copied_gt3;
 select custom_fields into actual from public.race_setups where id=copied_gt3;
 if actual is distinct from expected then raise exception 'Copy mismatch'; end if;
 update public.race_setups set custom_fields=jsonb_set(custom_fields,'{onlyfast_setup_library_v1,values,ambient_temperature}','"90.0"'::jsonb) where id=copied_gt3;
 if not exists(select 1 from public.race_setups where id=copied_gt3 and custom_fields#>>'{onlyfast_setup_library_v1,values,ambient_temperature}'='90.0') then raise exception 'Copy edit/reopen failed'; end if;
 select custom_fields into actual from public.race_setups where id=original_gt3;
 if actual is distinct from expected then raise exception 'Original changed when editing copy'; end if;
 perform public.change_active_race_class(original_class);
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into restored_rows from public.race_setups r where r.id in (select (value->>'id')::uuid from jsonb_array_elements(original_rows));
 if original_rows is distinct from restored_rows then raise exception 'Pre-existing setup data changed'; end if;
 if public.get_active_race_class_state()->>'active_class' is distinct from original_class then raise exception 'Original class was not restored'; end if;
 insert into onlyfast_live_qa_result values(jsonb_build_object('existing_setups_unchanged',jsonb_array_length(original_rows),
   'active_class_restored',original_class,'gt3_original_id',original_gt3,'gt3_copy_id',copied_gt3,
   'rename_copy_edit_original_unchanged',true,'repeated_class_switches',7,'new_qa_setups',6));
end;
$checks$;
select report || jsonb_build_object('saved_rows',(select jsonb_agg(jsonb_build_object('id',r.id,'name',r.setup_name,'class',r.race_class,
 'values',(select jsonb_object_agg(key,value) from jsonb_each(r.custom_fields#>'{onlyfast_setup_library_v1,values}') where value<>'""'::jsonb)) order by r.setup_name)
 from public.race_setups r where r.user_id=auth.uid() and r.setup_name like 'LIVE QA - % - 20261001')) as verification from onlyfast_live_qa_result;
commit;
`;
writeFileSync(new URL('./live_setup_library_setup_checks.sql',import.meta.url),sql);
