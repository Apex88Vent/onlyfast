-- Forward activation only. Preserve the original registration migration and
-- independent per-class gates. No data, subscription or older library change.
begin;
do $$
begin
  if to_regprocedure('public.onlyfast_small_oval_release_status(text)') is null then
    raise exception 'Apply 20261119175239_add_small_oval_setup_classes first';
  end if;
end;
$$;
create or replace function public.onlyfast_small_oval_release_status(p_class text)
returns text language sql immutable set search_path = '' as $$
  select case lower(trim(coalesce(p_class, '')))
    when 'micro_sprint' then 'production'
    when 'quarter_midget' then 'test'
    when 'junior_sprint' then 'test'
    when 'mini_dwarf' then 'test'
    else null end;
$$;
notify pgrst, 'reload schema';
commit;
