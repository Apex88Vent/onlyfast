alter table public.race_schedule
  add column if not exists race_end_date date;

alter table public.race_schedule
  drop constraint if exists race_schedule_end_on_or_after_start;

alter table public.race_schedule
  add constraint race_schedule_end_on_or_after_start
  check (race_end_date is null or race_end_date >= race_date);
