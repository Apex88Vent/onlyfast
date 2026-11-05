-- REVIEW ONLY. Activation step AFTER the RPC-aware viewer is released.
-- Apply separately after Phase 1 membership/usage migrations and acceptance.
begin;
do $$
begin
  if to_regprocedure('public.redeem_setup_share(text)') is null
    or to_regprocedure('onlyfast_private.membership_tier(uuid)') is null
    or to_regprocedure('public.onlyfast_reserve_usage(uuid,text,uuid,text,uuid,boolean)') is null
    or to_regprocedure('public.onlyfast_finish_usage(uuid,text,uuid,uuid,jsonb)') is null
    or to_regclass('onlyfast_private.setup_weekends') is null then
    raise exception 'PHASE1_EXPANSION_PREREQUISITE_REQUIRED';
  end if;
end;
$$;
-- Restrictive guards also defeat differently named permissive policies on a
-- deployed schema. Owners retain table access, other readers must present a code.
alter table public.shared_setups add column if not exists expires_at timestamptz;
alter table public.shared_setups add column if not exists revoked_at timestamptz;
alter table public.shared_setups enable row level security;
alter table public.race_setups enable row level security;
revoke all on public.shared_setups, public.race_setups from anon, authenticated;
grant select, insert, update, delete on public.shared_setups, public.race_setups to authenticated;
drop policy if exists phase1_share_owner_read on public.shared_setups;
create policy phase1_share_owner_read on public.shared_setups as restrictive for select to authenticated
  using (shared_by = (select auth.uid()));
drop policy if exists phase1_share_owner_write on public.shared_setups;
create policy phase1_share_owner_write on public.shared_setups as restrictive for all to authenticated
  using (shared_by = (select auth.uid()))
  with check (shared_by = (select auth.uid()) and exists (
    select 1 from public.race_setups r where r.id = setup_id and r.user_id = (select auth.uid())));
drop policy if exists phase1_setup_owner_read on public.race_setups;
create policy phase1_setup_owner_read on public.race_setups as restrictive for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists phase1_setup_owner_write on public.race_setups;
create policy phase1_setup_owner_write on public.race_setups as restrictive for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

notify pgrst,'reload schema';
commit;
