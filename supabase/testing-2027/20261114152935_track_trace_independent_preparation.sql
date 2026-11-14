-- Incremental testing-only extension: NULL setup prepares owned circuit history.
-- Patch the installed body rather than replacing its authorization/archive guards.
begin;
do $$
declare definition text; anchor text := '  select * into setup from public.race_setups where id=p_setup_id and user_id=auth.uid() for update;';
begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then
    raise exception 'ISOLATED_2027_TEST_DATABASE_REQUIRED';
  end if;
  definition:=pg_get_functiondef('public.create_track_trace_session(uuid,text,uuid)'::regprocedure);
  if position(anchor in definition)=0 or position('if p_setup_id is null then' in definition)>0 then
    raise exception 'TRACK_TRACE_PREPARATION_SOURCE_DRIFT';
  end if;
  definition:=replace(definition,anchor,$extension$  -- No setup, link, lap, start timestamp or location sample is manufactured.
  -- Existing caller authorization and timing-session RLS still apply.
  if p_setup_id is null then
    insert into public.onlylaps_timing_sessions(user_id,name,session_name,session_type,track_map_id)
      values(auth.uid(),btrim(p_name),btrim(p_name),'practice',p_track_map_id) returning id into sid;
    return sid;
  end if;
$extension$ || anchor);
  execute definition;
end $$;
notify pgrst,'reload schema';
commit;
