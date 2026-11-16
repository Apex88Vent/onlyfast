-- Hosted legacy policies also require map ownership; community timing must use
-- the exact shared map on the user's own session. Existing restrictive paid,
-- history, circuit, session-owner and lifecycle guards continue to AND here.
begin;
do $$ begin
  if public.get_onlyfast_2027_environment()->>'project_ref' is distinct from 'mfzajhnfonrfuiwxgvhe' then raise exception 'TESTING_PROJECT_REQUIRED'; end if;
end $$;
alter policy "Users can create their OnlyLaps lap times" on public.onlylaps_lap_times
with check (
  user_id=(select auth.uid()) and exists(select 1 from public.onlylaps_timing_sessions s where s.id=timing_session_id and s.user_id=(select auth.uid()))
  and (track_map_id is null or exists(select 1 from public.onlylaps_track_maps m where m.id=track_map_id and m.user_id=(select auth.uid()))
    or (onlyfast_private.community_shared_map_read(track_map_id) and exists(select 1 from public.onlylaps_timing_sessions s
      where s.id=timing_session_id and s.user_id=(select auth.uid()) and s.track_map_id=onlylaps_lap_times.track_map_id)))
);
alter policy "Users can update their OnlyLaps lap times" on public.onlylaps_lap_times
using(user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid()) and exists(select 1 from public.onlylaps_timing_sessions s where s.id=timing_session_id and s.user_id=(select auth.uid()))
  and (track_map_id is null or exists(select 1 from public.onlylaps_track_maps m where m.id=track_map_id and m.user_id=(select auth.uid()))
    or (onlyfast_private.community_shared_map_read(track_map_id) and exists(select 1 from public.onlylaps_timing_sessions s
      where s.id=timing_session_id and s.user_id=(select auth.uid()) and s.track_map_id=onlylaps_lap_times.track_map_id)))
);
commit;
