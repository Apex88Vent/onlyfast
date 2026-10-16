import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createPreviewBackend, PREVIEW_USER_ID } from '../src/dev/previewBackend.ts';
import { ROAD_RACING_CLASSES } from '../src/lib/roadRacingSetupSchemas.ts';
import { SETUP_LIBRARY_KEY, libraryFieldsFromRow } from '../src/lib/setupLibraryStorage.ts';
import { componentFunction, populatedLibraryState } from './setupLibraryHarness.ts';

function fixture() {
  const storage = new Map<string, string>();
  const adapter = { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => { storage.set(key, value); } };
  return { backend: createPreviewBackend(adapter), adapter, storage };
}

test('review starts as a fresh Rookie at tutorial; production build never imports the adapter', async () => {
  const { backend } = fixture();
  const { data } = await backend.supabase.rpc('get_active_race_class_state');
  assert.equal(data.onboarding_step, 'tutorial');
  assert.equal(data.active_class, null);
  assert.equal(data.tier, 'rookie');
  assert.equal(data.unlimited, false);
  assert.doesNotMatch(readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8'), /previewBackend|FunctionalReviewPreview|review-preview/);
  assert.doesNotMatch(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /review-preview|FunctionalReviewPreview/);
});

for (const car of ROAD_RACING_CLASSES) test(`functional review ${car}: onboarding, real save/reopen, copy, rename, sessions, delete, reload`, async () => {
  const { backend, adapter } = fixture();
  const db = backend.supabase;
  await db.rpc('save_racing_onboarding_progress', { p_step: 'discipline' });
  await db.rpc('save_racing_onboarding_progress', { p_step: 'vehicle', p_discipline: 'road_course' });
  await db.rpc('save_racing_onboarding_progress', { p_step: 'plan', p_discipline: 'road_course', p_class: car });
  assert.equal((await db.rpc('complete_racing_onboarding')).data.active_class, car);
  const saveBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload', { selectedCar: car });
  const input = populatedLibraryState(car);
  const { data: base } = await db.from('race_setups').insert(saveBase(input)).select().single();
  const { data: loaded } = await db.from('race_setups').select('*').eq('id', base.id).single();
  assert.deepEqual(loaded.custom_fields, base.custom_fields);
  for (const [key, value] of Object.entries(base.custom_fields[SETUP_LIBRARY_KEY].values)) assert.equal(libraryFieldsFromRow(loaded)[key], value);
  const { data: copy } = await db.from('race_setups').insert({ ...saveBase(input), setup_name: '[BASE TEMPLATE] Copy' }).select().single();
  assert.notEqual(copy.id, base.id);
  await db.from('race_setups').update({ setup_name: '[BASE TEMPLATE] Renamed' }).eq('id', copy.id);
  assert.equal((await db.from('race_setups').select().eq('id', copy.id).single()).data.setup_name, '[BASE TEMPLATE] Renamed');
  const saveRace = componentFunction('SetupDashboard.tsx', 'buildPayload', { selectedCar: car });
  for (const slot of ['base', 'heat', 'main']) {
    const { data: row } = await db.from('race_setups').insert(saveRace(input, slot, 'Preview weekend')).select().single();
    assert.equal(row.race_class, car);
    assert.deepEqual(row.custom_fields, base.custom_fields);
  }
  const restored = createPreviewBackend(adapter);
  assert.equal((await restored.supabase.rpc('get_active_race_class_state')).data.active_class, car);
  assert.equal((await restored.supabase.from('race_setups').select().eq('user_id', PREVIEW_USER_ID)).data.length, 5);
  await restored.supabase.from('race_setups').delete().eq('id', copy.id);
  assert.equal((await restored.supabase.from('race_setups').select().eq('id', copy.id).maybeSingle()).data, null);
  assert.equal((await restored.supabase.rpc('list_user_setup_summaries')).data.length, 4);
});

test('local plan simulation preserves vehicle cooldowns; reset restores slide one and empties saves', async () => {
  const { backend } = fixture();
  const db = backend.supabase;
  await db.rpc('initialize_active_race_class', { p_class: 'road_gt3' });
  await db.rpc('change_active_race_class', { p_new_class: 'road_karts' });
  assert.match((await db.rpc('change_active_race_class', { p_new_class: 'road_ta2' })).error!.message, /CLASS_CHANGE_COOLDOWN/);
  backend.setPlan('teams');
  assert.equal((await db.rpc('change_active_race_class', { p_new_class: 'road_ta2' })).data.unlimited, true);
  await db.from('race_setups').insert({ user_id: PREVIEW_USER_ID, race_class: 'road_ta2' });
  backend.reset();
  assert.equal((await db.rpc('get_active_race_class_state')).data.onboarding_step, 'tutorial');
  assert.equal((await db.rpc('list_user_setup_summaries')).data.length, 0);
  assert.equal(backend.getPlan(), 'free');
  assert.ok((await db.functions.invoke()).error);
});
