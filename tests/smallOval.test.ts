import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import TestRenderer from 'react-test-renderer';
import ts from 'typescript';
import * as configs from '../src/lib/classConfigs.ts';
import * as access from '../src/lib/setupLibraryAccess.ts';
import * as pavement from '../src/lib/pavementSetupValues.ts';
import { SMALL_OVAL_CLASS_IDS, SMALL_OVAL_CLASS_CONFIGS } from '../src/lib/smallOvalSetupSchemas.ts';
import { CLASS_ICONS, getClassIcon } from '../src/lib/classIcons.ts';
import { setupClassLabel, areSetupSheetsCompatible, type SetupCategory } from '../src/lib/setupLibrary.ts';
import { SETUP_LIBRARY_KEY, buildLibraryCustomFields, libraryFieldsFromRow } from '../src/lib/setupLibraryStorage.ts';
import { CLOSED_BETA_ACCESS, buildBetaAccessSnapshot, setCachedBetaAccess, clearCachedBetaAccess } from '../src/lib/betaFeatures.ts';
import { componentFunction, populatedLibraryState } from './setupLibraryHarness.ts';

const beta = buildBetaAccessSnapshot({ user_id: 'qa', is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' }, [{ feature_key: 'test_account_full_access', enabled: true }]);
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/ChassisSetupForm.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
const mod = { exports: {} as { default: React.ComponentType<{ raceClass: string; data: Record<string, string>; customFields: never[]; onChange: (key: string, value: string) => void }> } };
new Function('require', 'module', 'exports', js)((id: string) => ({
  '@/lib/classConfigs': configs, '@/lib/setupLibraryAccess': access, '@/lib/pavementSetupValues': pavement,
  '@/hooks/useBetaFeatures': { useBetaFeatures: () => beta },
}[id] || require(id)), mod, mod.exports);
const Chassis = mod.exports.default;
const { create, act } = TestRenderer;

test('canonical IDs, per-class release status, discipline membership, icon identity and schema metadata', () => {
  for (const id of SMALL_OVAL_CLASS_IDS) {
    const config = SMALL_OVAL_CLASS_CONFIGS[id];
    assert.equal(config.schemaId, `${id}_v1`);
    assert.equal(config.releaseStatus, id === 'micro_sprint' ? 'production' : 'test');
    assert.equal(setupClassLabel(id), config.name);
    const fields = config.extraSections.flatMap(s => s.fields);
    assert.equal(new Set(fields.map(f => f.key)).size, fields.length);
    for (const f of fields) {
      assert.ok(f.type && f.label && f.section);
      assert.equal(f.applicableClass, id);
      assert.match(f.key, /^[a-z][a-z0-9_]*$/);
    }
    for (const category of config.categories!) assert.ok(access.getDisciplineSetupClasses(category as SetupCategory, beta).includes(id));
    for (const closed of [CLOSED_BETA_ACCESS, { ...beta, testerKind: 'personal' as const }, { ...beta, enabledFeatures: [] }, { ...beta, betaFeaturesEnabled: false }]) {
      assert.equal(access.canAccessSetupClass(id, closed), id === 'micro_sprint');
      assert.equal(access.getSelectableSetupClasses(closed).includes(id), id === 'micro_sprint');
      assert.equal(access.getDisciplineSetupClasses('dirt_oval', closed).includes(id), id === 'micro_sprint');
    }
  }
  assert.equal(access.getDisciplineSetupClasses('pavement_oval', beta).filter(c => c === 'quarter_midget').length, 1);
  assert.equal(access.getSelectableSetupClasses(beta).filter(c => c === 'quarter_midget').length, 1);
  assert.equal(CLASS_ICONS.micro_sprint, CLASS_ICONS['Lightning Sprints']);
  for (const variant of ['blue', 'white'] as const) assert.equal(getClassIcon('micro_sprint', variant), getClassIcon('Lightning Sprints', variant));
  assert.equal(areSetupSheetsCompatible('quarter_midget', 'quarter_midget'), true);
  assert.equal(areSetupSheetsCompatible('mini_dwarf', 'Dwarf Cars'), false);
});

test('required Micro configuration validates independently of wing values', () => {
  for (const micro_configuration of ['', undefined, 'Winged', 'invalid']) assert.throws(() => buildLibraryCustomFields('micro_sprint', { micro_configuration: micro_configuration ?? '' }), /Select Winged or Non-Winged/);
  for (const micro_configuration of ['winged', 'non_winged']) assert.equal(libraryFieldsFromRow({ race_class: 'micro_sprint', custom_fields: buildLibraryCustomFields('micro_sprint', { micro_configuration, wing_angle: '24' }) }).wing_angle, '24');
});

test('requested class-specific chassis inventories remain present without substituting mature Dwarf fields', () => {
  const keys = (id: string) => new Set(SMALL_OVAL_CLASS_CONFIGS[id].extraSections.flatMap(s => s.fields.map(f => f.key)));
  const check = (id: string, expected: string[]) => { for (const key of expected) assert.ok(keys(id).has(key), `${id}: ${key}`); };
  check('micro_sprint', ['micro_configuration', 'front_panhard_height', 'lf_king_pin_angle', 'rf_king_pin_angle', 'lf_toe', 'rf_toe', 'rear_panhard_height', 'jacobs_ladder_height', 'engine_configuration', 'gearing', 'exhaust_configuration', 'injection', 'fuel_pressure', 'fuel_map', 'wing_angle']);
  for (const c of ['lf', 'rf', 'lr', 'rr']) check('micro_sprint', ['spring_bar_rate', 'block_height', 'ride_height', 'corner_weight', 'shock_setting', 'wheel_offset', 'cold_pressure', 'hot_pressure', 'tire_compound', 'tire_circumference'].map(k => `${c}_${k}`));
  check('quarter_midget', ['surface', 'engine_configuration', 'ballast_weight', 'total_weight', 'left_weight', 'left_side_pct', 'rear_weight', 'rear_weight_pct', 'cross_weight', 'front_stagger', 'rear_stagger', 'toe_out', 'lr_axle_lead_lag', 'rr_axle_position', 'clutch_type', 'clutch_engagement_rpm', 'front_sprocket', 'rear_sprocket', 'final_drive', 'chain_slack', 'fuel_type']);
  for (const c of ['lf', 'rf', 'lr', 'rr']) check('quarter_midget', ['torsion_bar', 'compression', 'rebound', 'spring_rate', 'ride_height', 'tire_size', 'tire_compound', 'tire_circumference', 'cold_pressure', 'hot_pressure', 'temperature_inner', 'temperature_middle', 'temperature_outer', 'wheel_offset', 'radius_rod_chassis_hole', 'radius_rod_axle_hole'].map(k => `${c}_${k}`));
  check('junior_sprint', ['ambient_temperature', 'humidity', 'front_ride_height', 'rear_ride_height', 'top_wing_angle', 'top_wing_position', 'nose_wing_angle', 'nose_wing_notch', 'front_axle_width', 'front_axle_offset', 'front_panhard_chassis_height', 'front_panhard_axle_height', 'rear_panhard_chassis_height', 'rear_panhard_axle_height', 'ackermann', 'engine_configuration', 'clutch_type', 'clutch_setting', 'front_sprocket', 'rear_sprocket', 'final_drive', 'chain_size', 'rear_brake_bias']);
  for (const c of ['lf', 'rf']) check('junior_sprint', ['camber', 'caster', 'radius_rod_top_angle', 'radius_rod_bottom_angle'].map(k => `${c}_${k}`));
  for (const c of ['lr', 'rr']) check('junior_sprint', ['torsion_stop', 'axle_spacer', 'birdcage_upper_hole', 'birdcage_lower_hole'].map(k => `${c}_${k}`));
  check('mini_dwarf', ['minimum_class_weight', 'front_weight', 'front_weight_pct', 'right_weight', 'right_weight_pct', 'nose_height', 'tail_height', 'toe_out', 'lf_camber', 'rf_camber', 'lf_caster', 'rf_caster', 'front_track_width', 'steering_arm_hole', 'rear_axle_diameter', 'rear_track_width', 'rear_axle_squareness', 'cassette_position', 'engine_configuration', 'governor_status', 'main_jet', 'pilot_jet', 'air_filter', 'exhaust_configuration', 'clutch_type', 'front_sprocket', 'rear_sprocket', 'final_drive', 'clutch_setting']);
  assert.equal(keys('mini_dwarf').has('third_link'), false);
  assert.equal(keys('mini_dwarf').has('panhard_bar'), false);
  assert.deepEqual(SMALL_OVAL_CLASS_CONFIGS.micro_sprint.extraSections.find(s => s.id === 'micro-wing')!.activeWhen, { key: 'micro_configuration', value: 'winged' });
  assert.deepEqual(SMALL_OVAL_CLASS_CONFIGS.micro_sprint.extraSections.find(s => s.id === 'micro-wing')!.fields.map(f => f.key), ['wing_angle']);
});

test('Micro mounted form switches Winged → Non-Winged → Winged and retains wing data through real base/race serializers', async () => {
  setCachedBetaAccess(beta);
  try {
    const saveBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload');
    const loadBase = componentFunction('CreateBaseSetupView.tsx', 'loadTemplateIntoState');
    const saveRace = componentFunction('SetupDashboard.tsx', 'buildPayload');
    const loadRace = componentFunction('SetupDashboard.tsx', 'loadSetupIntoState');
    let state: Record<string, string> = { ...populatedLibraryState('micro_sprint'), micro_configuration: 'winged', wing_angle: '24' };
    const change = (field: string, value: string) => { state = { ...state, [field]: value }; render(); };
    let view: TestRenderer.ReactTestRenderer;
    const render = () => view.update(React.createElement(Chassis, { raceClass: 'micro_sprint', data: state, customFields: [], onChange: change }));
    await act(async () => { view = create(React.createElement(Chassis, { raceClass: 'micro_sprint', data: state, customFields: [], onChange: change })); });
    const input = (key: string) => view.root.findAllByType('input').find(n => n.props.id.endsWith(`-${key}`))!;
    const mode = () => view.root.findAllByType('select').find(n => n.props.id.endsWith('-micro_configuration'))!;
    const wing = () => {
      let node = input('wing_angle').parent!;
      while (typeof node.props.disabled !== 'boolean') node = node.parent!;
      return node;
    };
    assert.equal(mode().props.required, true);
    assert.equal(wing().props.disabled, false);
    for (const micro_configuration of ['non_winged', 'winged', 'non_winged']) {
      await act(async () => mode().props.onChange({ target: { value: micro_configuration } }));
      assert.equal(wing().type, 'fieldset');
      assert.equal(wing().props.disabled, micro_configuration !== 'winged');
      if (micro_configuration === 'non_winged') assert.match(wing().props.className, /opacity-50/);
      assert.equal(input('wing_angle').props.value, '24');
      const original = JSON.parse(JSON.stringify(saveBase(state)));
      state = loadBase(original);
      const copy = saveBase({ ...state, setup_name: 'Renamed copy' });
      assert.deepEqual(copy.custom_fields, original.custom_fields);
      state = loadRace(JSON.parse(JSON.stringify(saveRace(loadBase(copy), 'heat', 'Race from base'))));
      assert.equal(state.micro_configuration, micro_configuration);
      assert.equal(state.wing_angle, '24');
      await act(async () => render());
      assert.equal(input('wing_angle').props.value, '24');
    }
    await act(async () => view.unmount());
  } finally { clearCachedBetaAccess(); }
});

test('all four mounted sheets render dedicated four-corner sections and preserve manual measured totals', async () => {
  for (const raceClass of SMALL_OVAL_CLASS_IDS) {
    let state = { ...populatedLibraryState(raceClass), lf_corner_weight: '100', rf_corner_weight: '110', lr_corner_weight: '120', rr_corner_weight: '130', total_weight: '470', cross_weight: '49', front_sprocket: '12', rear_sprocket: '60', final_drive: '5.1' };
    let view: TestRenderer.ReactTestRenderer;
    const onChange = (k: string, v: string) => { state = { ...state, [k]: v }; };
    await act(async () => { view = create(React.createElement(Chassis, { raceClass, data: state, customFields: [], onChange })); });
    for (const c of ['lf', 'rf', 'lr', 'rr']) assert.ok(view!.root.findAllByType('input').some(n => n.props.id.endsWith(`-${c}_cold_pressure`)));
    assert.equal(view!.root.findAllByType('input').find(n => n.props.id.endsWith('-total_weight'))!.props.readOnly, false);
    const row = { race_class: raceClass, custom_fields: buildLibraryCustomFields(raceClass, state) };
    assert.equal(libraryFieldsFromRow(row).total_weight, '470');
    assert.equal(libraryFieldsFromRow(row).cross_weight, '49');
    await act(async () => view!.root.findAllByType('button').find(n => n.children.includes('Calculate weights'))!.props.onClick());
    assert.equal(state.total_weight, '460');
    if (raceClass !== 'micro_sprint') {
      await act(async () => view!.root.findAllByType('button').find(n => n.children.includes('Calculate gear ratio'))!.props.onClick());
      assert.equal(state.final_drive, '5');
      for (const invalid of ['', '0', '-1', 'Infinity', 'bad']) {
        await act(async () => view!.update(React.createElement(Chassis, { raceClass, data: { ...state, front_sprocket: invalid }, customFields: [], onChange })));
        assert.equal(view!.root.findAllByType('button').find(n => n.children.includes('Calculate gear ratio'))!.props.disabled, true);
      }
    }
    assert.deepEqual(libraryFieldsFromRow({ race_class: 'Dwarf Cars', custom_fields: row.custom_fields }), {});
    for (const other of SMALL_OVAL_CLASS_IDS.filter(c => c !== raceClass)) assert.deepEqual(libraryFieldsFromRow({ ...row, race_class: other }), {});
    const snapshot = row.custom_fields[SETUP_LIBRARY_KEY] as { race_class: string };
    assert.equal(snapshot.race_class, raceClass);
    await act(async () => view!.unmount());
  }
});
