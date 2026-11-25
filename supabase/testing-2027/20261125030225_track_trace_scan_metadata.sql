-- Retain original scan metadata with the existing validated private scan save.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then raise exception 'TESTING_PROJECT_REQUIRED'; end if;
end $$;
create function public.save_track_trace_scan_details(p_scan_id uuid,p_scan jsonb,p_sectors jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; existing boolean;
begin
  perform onlyfast_private.require_track_trace();perform onlyfast_private.require_track_trace_write_2027();
  if length(coalesce(p_scan->>'notes',''))>2000 or length(coalesce(p_scan->>'track_length',''))>80 then raise exception 'SCAN_METADATA_TOO_LONG'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('scan:'||p_scan_id::text,0));
  select exists(select 1 from public.onlylaps_track_maps where id=p_scan_id and user_id=auth.uid()) into existing;
  result:=public.save_track_trace_scan(p_scan_id,p_scan,p_sectors);
  -- Lost-response retries return the first saved scan; they never replace it.
  if not existing and result->>'saved'='true' then
    update public.onlylaps_track_maps set notes=nullif(p_scan->>'notes',''),track_length=nullif(p_scan->>'track_length','')
      where id=p_scan_id and user_id=auth.uid() and publication_status='private';
  end if;
  return result;
end $$;
revoke all on function public.save_track_trace_scan_details(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_track_trace_scan_details(uuid,jsonb,jsonb) to authenticated;
commit;
