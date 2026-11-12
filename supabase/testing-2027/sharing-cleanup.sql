-- Fresh testing bootstrap only. The historical production M3 correction checks
-- exact production catalog hashes, so it is not an empty-schema bootstrap step.
-- Owner policies and the code-redemption RPC already exist at this point.
begin;
drop policy if exists race_setups_select_via_share on public.race_setups;
drop policy if exists race_setups_select_via_unexpired_public_share on public.race_setups;
commit;
