-- Phase 3B: compare BEFORE/AFTER installation, before fixture mutations. Includes original billing rows.
-- Read-only retention baseline. Run before installation and immediately after,
-- before hosted tests mutate fixtures. Compare every count/hash with timezone UTC.
set time zone 'UTC';
select public.get_onlyfast_2027_environment()->>'project_ref' as project_ref, r.*
from (
  select 'race_setups' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.race_setups t
  union all
  select 'race_schedule' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.race_schedule t
  union all
  select 'shared_setups' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.shared_setups t
  union all
  select 'onlyfast_onlylaps_session_links' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlyfast_onlylaps_session_links t
  union all
  select 'onlylaps_timing_sessions' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_timing_sessions t
  union all
  select 'onlylaps_lap_times' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_lap_times t
  union all
  select 'onlylaps_lap_sector_times' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_lap_sector_times t
  union all
  select 'onlylaps_telemetry_samples' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_telemetry_samples t
  union all
  select 'onlylaps_session_analysis' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_session_analysis t
  union all
  select 'onlylaps_telemetry_shares' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_telemetry_shares t
  union all
  select 'onlylaps_track_maps' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_track_maps t
  union all
  select 'onlylaps_track_sector_defaults' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_track_sector_defaults t
  union all
  select 'onlylaps_user_track_sectors' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_user_track_sectors t
  union all
  select 'onlylaps_my_tracks' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_my_tracks t
  union all
  select 'onlylaps_sensor_calibrations' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.onlylaps_sensor_calibrations t
  union all
  select 'user_subscriptions' as table_name, count(*) as row_count,
    md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as rows_md5
  from public.user_subscriptions t
) r order by table_name;
