-- Non-persistent verification against the live backend: roles/claims are local
-- to this transaction and all state is rolled back. No RLS bypass is used.
begin;
create temporary table onlyfast_qa_results(name text,value jsonb) on commit drop;
grant select,insert on onlyfast_qa_results to authenticated;
select set_config('request.jwt.claim.sub','4b9864ff-2195-4be0-83a4-39308446577e',true);
select set_config('request.jwt.claims','{"sub":"4b9864ff-2195-4be0-83a4-39308446577e","role":"authenticated"}',true);
set local role authenticated;

insert into onlyfast_qa_results values('test_account',jsonb_build_object('user_id',auth.uid(),
  'allowed',public.onlyfast_can_use_setup_library(),'class_state',public.get_active_race_class_state()));

with classes(name) as (values
 ('Legends'),('Pavement Late Model'),('Pavement Modified'),('Stock Car / ARCA'),('Street Stock / Sportsman'),('Mini Stock / Compact'),
 ('GT3'),('GT4'),('Prototype'),('Radical / Sports Racer'),('Touring Car'),('Production Track Car'),('Time Attack'),
 ('Formula Ford 1600 / FF1600'),('Formula Ford 2000 / FF2000'),('Formula Continental'),('F2000'),('Formula Mazda'),('Formula Vee'),('Formula Atlantic'),('Formula 4'),('Junior Formula'),
 ('Road Racing / Superbike'),('Supersport'),('Track Day Motorcycle'),('Supermoto'),('Flat Track'),('Mini Moto'),('Motocross'),
 ('RC 1/8 Buggy'),('RC 1/10 Buggy'),('RC 1/10 4WD Buggy'),('RC Short Course'),('RC Touring Car'),('RC Oval'),('Winged Sprint Cars'))
insert into onlyfast_qa_results select 'test_classes',jsonb_build_object('total',count(*),
 'accepted',count(*) filter(where public.onlyfast_canonical_race_class(name)=name))
from classes;

reset role;
-- This actual non-test Rookie/Pro account was selected by the read-only preflight.
select set_config('request.jwt.claim.sub','c436626d-5de8-46a8-b5b3-ca7af7dde549',true);
select set_config('request.jwt.claims','{"sub":"c436626d-5de8-46a8-b5b3-ca7af7dde549","role":"authenticated"}',true);
set local role authenticated;
insert into onlyfast_qa_results values('normal_account',jsonb_build_object('user_id',auth.uid(),
 'allowed',public.onlyfast_can_use_setup_library(),'gt3',public.onlyfast_canonical_race_class('GT3'),
 'dwarf',public.onlyfast_canonical_race_class('Dwarf Cars'),'visible_development_setups',
 (select count(*) from public.race_setups where public.onlyfast_is_development_setup_class(race_class))));

with classes(name) as (values
 ('Legends'),('Pavement Late Model'),('Pavement Modified'),('Stock Car / ARCA'),('Street Stock / Sportsman'),('Mini Stock / Compact'),
 ('GT3'),('GT4'),('Prototype'),('Radical / Sports Racer'),('Touring Car'),('Production Track Car'),('Time Attack'),
 ('Formula Ford 1600 / FF1600'),('Formula Ford 2000 / FF2000'),('Formula Continental'),('F2000'),('Formula Mazda'),('Formula Vee'),('Formula Atlantic'),('Formula 4'),('Junior Formula'),
 ('Road Racing / Superbike'),('Supersport'),('Track Day Motorcycle'),('Supermoto'),('Flat Track'),('Mini Moto'),('Motocross'),
 ('RC 1/8 Buggy'),('RC 1/10 Buggy'),('RC 1/10 4WD Buggy'),('RC Short Course'),('RC Touring Car'),('RC Oval'),('Winged Sprint Cars'))
insert into onlyfast_qa_results select 'normal_classes',jsonb_build_object('blocked',count(*) filter(where public.onlyfast_canonical_race_class(name) is null)) from classes;

do $$
declare name text;
begin
  foreach name in array array['Winged Sprint Cars','Legends','GT3','Road Racing / Superbike','RC Touring Car'] loop
    begin
      perform public.initialize_active_race_class(name);
      raise exception 'FAIL: normal initialization accepted %',name;
    exception when others then
      if sqlerrm <> 'CLASS_INVALID' then raise; end if;
    end;
    begin
      perform public.change_active_race_class(name);
      raise exception 'FAIL: normal class change accepted %',name;
    exception when others then
      if sqlerrm <> 'CLASS_INVALID' then raise; end if;
    end;
    begin
      insert into public.race_setups(user_id,race_class,setup_type,setup_name,custom_fields)
      values(auth.uid(),name,'base','REJECTED LIVE QA',jsonb_build_object('onlyfast_setup_library_v1',jsonb_build_object('version',1,'race_class',name,'values','{}'::jsonb)));
      raise exception 'FAIL: normal write accepted %',name;
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
insert into onlyfast_qa_results values('enforcement','"PASS: normal account initialize/change/write rejected in all five disciplines"'::jsonb);
reset role;
select jsonb_object_agg(name,value) as verification from onlyfast_qa_results;
rollback;
