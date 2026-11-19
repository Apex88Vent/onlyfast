// Disposable PostgreSQL only; no hosted services, credentials or deployment.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { SMALL_OVAL_CLASS_IDS } from '../src/lib/smallOvalSetupSchemas.ts';
import { buildBetaAccessSnapshot, setCachedBetaAccess, clearCachedBetaAccess } from '../src/lib/betaFeatures.ts';
import { SETUP_LIBRARY_KEY } from '../src/lib/setupLibraryStorage.ts';
import { componentFunction, populatedLibraryState } from './setupLibraryHarness.ts';

type SavedRow = Record<string, unknown> & { id: string; race_class: string; custom_fields: Record<string, { version: number; race_class: string; values: Record<string, string> }> };
const migration = 'supabase/migrations/20261119175239_add_small_oval_setup_classes.sql';
for (const legacyGate of [false, true]) test(`small oval PostgreSQL (${legacyGate ? 'live legacy gate' : 'current onboarding'}): registration, normal-user release and unchanged permissions`, async () => {
  const db = new PGlite();
  const ids = Array.from({ length: 9 }, (_, i) => `${String(i + 1).repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);
  const migrate = async (path: string) => db.exec(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const signIn = async (id: string | null, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || '']);
    await db.exec(`set role ${role}`);
  };
  const rpc = async (fn: string, args: unknown[] = []) => (await db.query<{ result: Record<string, unknown> }>(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args)).rows[0].result;
  const insert = async (payload: Record<string, unknown>) => {
    const keys = Object.keys(payload);
    return (await db.query<SavedRow>(`insert into public.race_setups (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`, keys.map(k => typeof payload[k] === 'object' && payload[k] !== null ? JSON.stringify(payload[k]) : payload[k]))).rows[0];
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
      grant usage on schema public, auth to anon, authenticated;`);
    const setup = await readFile(new URL(legacyGate ? '../supabase/staging/20261016230333_staging_baseline.sql' : '../supabase/setup.sql', import.meta.url), 'utf8');
    await db.exec(setup.replace(/create extension if not exists pgcrypto(?: with schema extensions)?;/gi, ''));
    for (const path of ['SUBSCRIPTIONS_RLS.sql', 'supabase/migrations/20260720_enforce_active_race_class.sql',
      'supabase/migrations/20260728_add_account_beta_feature_flags.sql', 'supabase/migrations/20260929_add_custom_car_class.sql',
      'supabase/migrations/20260930_add_development_setup_library.sql', 'supabase/migrations/20261002030004_add_development_kart_classes.sql',
      'supabase/migrations/20260817_link_race_setups_to_schedule.sql', 'supabase/migrations/202610130001_restore_racing_onboarding.sql',
      'supabase/migrations/20261013183621_enable_road_racing.sql', 'supabase/migrations/20260630_prepare_user_subscriptions_for_revenuecat.sql',
      'supabase/migrations/202609240001_revenuecat_subscription_sync.sql', 'supabase/migrations/20261015235847_secure_membership_authorization.sql']) { if (!legacyGate || !/restore_racing_onboarding|enable_road_racing/.test(path)) await migrate(path); }
    if (legacyGate) {
      for (const name of ['20261105090932_phase1_membership_and_sharing.sql', '20261105090937_phase1_setup_and_usage_authorization.sql', '20261105091108_phase1_restrict_legacy_access.sql', '20261110233145_restore_test_subscription_switching.sql']) await migrate('supabase/migrations/'+name);
      // Match the deployed post-correction share-policy state; baseline migration
      // fixtures lack the second historic policy required by that correction.
      await db.exec('drop policy if exists race_setups_select_via_share on public.race_setups; drop policy if exists race_setups_select_via_unexpired_public_share on public.race_setups;');
    }
    for (const [i, id] of ids.entries()) {
      await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [id, `oval${i}@example.invalid`, i === 3 ? '{"has_admin_full_access":true}' : '{}']);
      if (i < 6) await db.query("insert into public.user_subscriptions(user_id,plan,status,stripe_customer_id,active_race_class) values($1,$2,'active',$3,'Dwarf Cars')", [id, ['free', 'pro', 'teams', 'free', 'free', 'free'][i], `cus_preserve_${i}`]);
      if ([0, 4, 6, 7].includes(i)) {
        await db.query('insert into public.beta_tester_accounts(user_id,is_test_account,beta_features_enabled,tester_kind) values($1,true,true,$2)', [id, i === 4 ? 'personal' : 'experimental']);
        await db.query("insert into public.user_feature_flags(user_id,feature_key,enabled) values($1,'test_account_full_access',true)", [id]);
      }
    }
    const legacy = await insert({ user_id: ids[1], race_class: 'Dwarf Cars', setup_type: 'base_template', setup_name: 'Preserved Dwarf', lf_pressure: 12.5, notes: 'keep', custom_fields: { Original: 'keep' } });
    const classFunctionsBefore = (await db.query("select proname, pg_get_functiondef(oid) as definition from pg_proc where oid in ('public.onlyfast_has_unlimited_classes(uuid)'::regprocedure,'public.change_active_race_class(text)'::regprocedure,'public.onlyfast_can_use_setup_library()'::regprocedure) order by proname")).rows;
    const billing = (await db.query("select to_jsonb(s)-array['active_racing_discipline','onboarding_step','onboarding_discipline','onboarding_race_class','onboarding_plan'] as row from public.user_subscriptions s order by user_id")).rows;
    await migrate(migration);
    await migrate(migration);
    assert.deepEqual((await db.query("select proname, pg_get_functiondef(oid) as definition from pg_proc where oid in ('public.onlyfast_has_unlimited_classes(uuid)'::regprocedure,'public.change_active_race_class(text)'::regprocedure,'public.onlyfast_can_use_setup_library()'::regprocedure) order by proname")).rows, classFunctionsBefore);
    assert.deepEqual((await db.query("select to_jsonb(s)-array['active_racing_discipline','onboarding_step','onboarding_discipline','onboarding_race_class','onboarding_plan'] as row from public.user_subscriptions s order by user_id")).rows, billing);
    assert.deepEqual((await db.query('select * from public.race_setups where id=$1', [legacy.id])).rows[0], legacy);
    await db.exec('grant select, insert, update, delete on public.race_setups, public.shared_setups to authenticated; grant select on public.race_setups, public.shared_setups to anon;');
    const beta = buildBetaAccessSnapshot({ user_id: ids[0], is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' }, [{ feature_key: 'test_account_full_access', enabled: true }]);
    setCachedBetaAccess(beta);
    const saveBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload', { user: { id: ids[0] } });
    const loadBase = componentFunction('CreateBaseSetupView.tsx', 'loadTemplateIntoState');
    const saveRace = componentFunction('SetupDashboard.tsx', 'buildPayload', { user: { id: ids[0] } });
    const loadRace = componentFunction('SetupDashboard.tsx', 'loadSetupIntoState');
    await signIn(ids[0]);
    const rows: SavedRow[] = [];
    for (const name of SMALL_OVAL_CLASS_IDS) {
      assert.equal(await rpc('onlyfast_canonical_race_class', [` ${name.toUpperCase()} `]), name);
      await rpc('change_active_race_class', [name]);
      const state = populatedLibraryState(name);
      if (name === 'micro_sprint') Object.assign(state, { micro_configuration: 'winged', wing_angle: '24' });
      const base = await insert(saveBase(state));
      rows.push(base);
      const reopened = (await db.query<SavedRow>('select * from public.race_setups where id=$1', [base.id])).rows[0];
      for (const [key, value] of Object.entries(base.custom_fields[SETUP_LIBRARY_KEY].values)) assert.equal(loadBase(reopened)[key], value, `${name}: ${key}`);
      const edited = await db.query<SavedRow>("update public.race_setups set setup_name='Renamed baseline' where id=$1 returning *", [base.id]);
      const copy = await insert(saveBase({ ...loadBase(edited.rows[0]), setup_name: 'Copied baseline' }));
      assert.deepEqual(copy.custom_fields, base.custom_fields);
      const race = await insert(saveRace(loadBase(copy), 'base', `Race ${name}`));
      const heat = await insert(saveRace(loadRace(race), 'heat', `Race ${name}`));
      assert.deepEqual(heat.custom_fields, base.custom_fields);
      if (name === 'micro_sprint') {
        for (const micro_configuration of ['non_winged', 'winged', 'non_winged']) {
          const payload = saveBase({ ...loadBase(reopened), micro_configuration });
          const saved = (await db.query<SavedRow>('update public.race_setups set custom_fields=$1 where id=$2 returning *', [JSON.stringify(payload.custom_fields), base.id])).rows[0];
          assert.equal(loadBase(saved).micro_configuration, micro_configuration);
          assert.equal(loadBase(saved).wing_angle, '24');
        }
        const forged = structuredClone(base);
        delete forged.id; delete forged.created_at; delete forged.updated_at;
        delete forged.custom_fields[SETUP_LIBRARY_KEY].values.micro_configuration;
        await assert.rejects(insert(forged), /MICRO_CONFIGURATION_REQUIRED/);
      }
    }
    // One canonical setup family works through BOTH complete onboarding paths.
    for (const [id, discipline] of [[ids[6], 'dirt_oval'], [ids[7], 'pavement_oval']]) {
      await signIn(id);
      await rpc('save_racing_onboarding_progress', ['discipline', null, null]);
      await rpc('save_racing_onboarding_progress', ['vehicle', discipline, null]);
      await assert.rejects(rpc('save_racing_onboarding_progress', ['plan', 'road_course', 'quarter_midget']), /CLASS_INVALID/);
      await rpc('save_racing_onboarding_progress', ['plan', discipline, 'quarter_midget']);
      const result = await rpc('complete_racing_onboarding');
      assert.equal(result.active_class, 'quarter_midget');
      assert.equal(result.active_discipline, discipline);
      assert.equal(result.onboarding_step, 'complete');
      const save = componentFunction('CreateBaseSetupView.tsx', 'buildPayload', { user: { id } });
      const row = await insert(save({ ...populatedLibraryState('quarter_midget'), surface: discipline === 'dirt_oval' ? 'dirt' : 'pavement' }));
      assert.equal(row.race_class, 'quarter_midget');
      assert.equal(loadBase(row).surface, discipline === 'dirt_oval' ? 'dirt' : 'pavement');
      assert.equal((await rpc('save_racing_onboarding_progress', ['plan', 'road_course', 'quarter_midget'])).active_class, 'quarter_midget', 'completed onboarding ignores further progress writes');
    }
    // Public sharing and SECURITY DEFINER summaries cannot bypass test gating.
    await signIn(ids[0]);
    await db.query("insert into public.shared_setups(setup_id,shared_by,share_code,is_public) values($1,$2,'OVAL-QA',true)", [rows[0].id, ids[0]]);
    for (const id of [ids[1], ids[2], ids[3], ids[4], ids[5]]) {
      await signIn(id);
      for (const name of SMALL_OVAL_CLASS_IDS) {
        assert.equal(await rpc('onlyfast_canonical_race_class', [name]), null);
        assert.equal(await rpc('onlyfast_small_oval_class_allowed', [name]), false);
      }
      assert.equal(await rpc('onlyfast_canonical_race_class', ['GT3']), legacyGate ? null : 'GT3');
      assert.equal(await rpc('onlyfast_canonical_race_class', ['Lightning Sprints']), 'Lightning Sprints');
      assert.deepEqual((await db.query('select id from public.race_setups where id=$1', [rows[0].id])).rows, []);
      await assert.rejects(insert({ ...saveBase(populatedLibraryState('mini_dwarf')), user_id: id }), /SETUP_LIBRARY_TEST_ACCOUNT_REQUIRED|SETUP_VEHICLE_LOCKED|row-level security/);
      // Even an accidentally privileged caller cannot bypass the narrow trigger.
      await db.exec('reset role');
      await assert.rejects(db.query("update public.user_subscriptions set active_race_class='mini_dwarf' where user_id=$1", [id]), /SETUP_LIBRARY_TEST_ACCOUNT_REQUIRED/);
    }
    await signIn(null, 'anon');
    assert.equal(await rpc('onlyfast_small_oval_class_allowed', ['micro_sprint']), false);
    // Existing production ACLs deny anon execution of the active-vehicle helper.
    await assert.rejects(db.query('select id from public.race_setups where id=$1', [rows[0].id]), /permission denied for function onlyfast_can_access_setup_class/);
    // Revocation hides an owner's own rows and summaries too.
    await db.exec('reset role');
    await db.query('update public.beta_tester_accounts set beta_features_enabled=false where user_id=$1', [ids[0]]);
    await signIn(ids[0]);
    assert.deepEqual(await rpc('list_user_setup_summaries'), []);
    assert.deepEqual((await db.query('select id from public.race_setups where user_id=$1', [ids[0]])).rows, []);
    // Demonstrate independent release: changing Micro never releases its peers.
    await db.exec('reset role');
    await migrate('supabase/migrations/20261119182714_release_micro_sprint_production.sql');
    await migrate('supabase/migrations/20261119182714_release_micro_sprint_production.sql');
    await signIn(ids[1]);
    assert.equal(await rpc('onlyfast_canonical_race_class', ['micro_sprint']), 'micro_sprint');
    for (const name of SMALL_OVAL_CLASS_IDS.filter(c => c !== 'micro_sprint')) assert.equal(await rpc('onlyfast_canonical_race_class', [name]), null);
    await db.exec('reset role');
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from public.race_setups')).rows[0].n, 19, 'release status changes never delete saved setups');
    // Fresh non-beta Rookie initialization uses the normal onboarding RPCs.
    clearCachedBetaAccess();
    await signIn(ids[8]);
    await rpc('save_racing_onboarding_progress', ['discipline', null, null]);
    await rpc('save_racing_onboarding_progress', ['vehicle', 'dirt_oval', null]);
    await rpc('save_racing_onboarding_progress', ['plan', 'dirt_oval', 'micro_sprint']);
    const initialized = await rpc('complete_racing_onboarding');
    assert.equal(initialized.active_class, 'micro_sprint');
    assert.equal(initialized.onboarding_step, 'complete');
    assert.equal(initialized.unlimited, false, 'Micro never grants a subscription bypass');
    for (const name of SMALL_OVAL_CLASS_IDS) assert.equal(await rpc('onlyfast_canonical_race_class', [name]), name === 'micro_sprint' ? name : null);
    const normalBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload', { user: { id: ids[8] } });
    const rookieRow = await insert(normalBase({ ...populatedLibraryState('micro_sprint'), micro_configuration: 'non_winged', wing_angle: '24' }));
    assert.equal(loadBase(rookieRow).wing_angle, '24');
    if (legacyGate) await assert.rejects(insert(normalBase({ ...loadBase(rookieRow), setup_name: 'Quota still applies' })), /ROOKIE_BASE_SETUP_LIMIT/);
    // A normal Pro account can copy without changing membership or feature flags.
    await signIn(ids[1]);
    await rpc('change_active_race_class', ['micro_sprint']);
    await assert.rejects(rpc('change_active_race_class', ['Modified']), /CLASS_CHANGE_COOLDOWN/);
    const proBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload', { user: { id: ids[1] } });
    const proRace = componentFunction('SetupDashboard.tsx', 'buildPayload', { user: { id: ids[1] } });
    const original = await insert(proBase({ ...populatedLibraryState('micro_sprint'), micro_configuration: 'winged', wing_angle: '24' }));
    const copied = await insert(proBase({ ...loadBase(original), setup_name: 'Normal Pro copy', micro_configuration: 'non_winged' }));
    const reopened = loadBase((await db.query<SavedRow>('select * from public.race_setups where id=$1', [copied.id])).rows[0]);
    assert.equal(reopened.micro_configuration, 'non_winged');
    assert.equal(reopened.wing_angle, '24');
    const race = await insert(proRace(reopened, 'heat', 'Normal Micro race'));
    assert.equal(loadRace(race).micro_configuration, 'non_winged');
    for (const denied of SMALL_OVAL_CLASS_IDS.filter(c => c !== 'micro_sprint')) {
      assert.equal(await rpc('onlyfast_canonical_race_class', [denied]), null);
      await assert.rejects(rpc('change_active_race_class', [denied]), /CLASS_INVALID/);
    }
  } finally { clearCachedBetaAccess(); await db.close(); }
});
