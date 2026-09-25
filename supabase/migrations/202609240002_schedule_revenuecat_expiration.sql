-- Supabase pg_cron: keep existing plan/status consumers safe if webhooks fail.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'onlyfast-expire-revenuecat',
  '* * * * *',
  'select public.onlyfast_expire_revenuecat()'
);
