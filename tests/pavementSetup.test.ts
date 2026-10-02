import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPANDED_CLASS_CONFIGS } from '../src/lib/setupLibrary.ts';
import { calculatePavementWeights, normalizePavementToe } from '../src/lib/pavementSetupValues.ts';
import { buildLibraryCustomFields, libraryFieldsFromRow, SETUP_LIBRARY_KEY } from '../src/lib/setupLibraryStorage.ts';

const corners = ['lf', 'rf', 'lr', 'rr'];
const commonCorners = ['cold_pressure', 'hot_pressure', 'tire_circumference', 'ride_height', 'corner_weight', 'spring_rate'];
const temperatures = ['temperature_inner', 'temperature_middle', 'temperature_outer'];
const alignment = ['lf_camber', 'rf_camber', 'lf_caster', 'rf_caster', 'front_toe', 'front_toe_direction'];
const weights = ['total_weight', 'cross_weight_lbs', 'cross_weight', 'left_side_pct', 'rear_weight_pct'];
const stagger = ['front_stagger', 'rear_stagger'];
const four = (keys: string[]) => corners.flatMap(c => keys.map(k => `${c}_${k}`));
// Independent inventories transcribed from the user's requirements. These
// catch omissions AND unrequested fields; common Notes remain outside schema.
const expected: Record<string, string[]> = {
  Legends: [...weights, 'engine_rpm', ...stagger, ...four([...commonCorners, 'wheel_offset']), ...alignment,
    'steering_ratio', 'panhard_frame_height', 'panhard_axle_height', 'rear_steer', 'final_drive'],
  'Pavement Late Model': [...weights, 'rear_bite', 'brake_bias', 'rear_brake_bias', 'brake_pad_compound', 'final_drive', 'grille_tape',
    ...four([...commonCorners, ...temperatures, 'spring_free_length', 'compression_low_speed', 'compression_high_speed',
      'rebound_low_speed', 'rebound_high_speed', 'shock_gas_pressure', 'bump_gap', 'bump_stop']), ...alignment,
    'front_sway_bar_diameter', 'front_arb_preload', 'sway_bar_arm_length', 'lf_upper_control_arm_setting', 'rf_upper_control_arm_setting',
    'lf_lower_control_arm_setting', 'rf_lower_control_arm_setting', 'ackermann', 'spindle_height_drop',
    'panhard_left_height', 'panhard_right_height', 'lr_trailing_arm_angle', 'rr_trailing_arm_angle',
    'lr_trailing_arm_length', 'rr_trailing_arm_length', 'lr_trailing_arm_chassis_hole', 'rr_trailing_arm_chassis_hole',
    'third_link_angle', 'third_link_pinion_hole', 'pinion_angle', 'rear_steer'],
  'Pavement Modified': [...weights, 'brake_bias', 'final_drive', ...stagger, ...four([...commonCorners, ...temperatures, 'compression', 'rebound']),
    ...alignment, 'front_sway_bar_diameter', 'front_arb_preload', 'lf_upper_control_arm_mount', 'rf_upper_control_arm_mount',
    'panhard_chassis_height', 'panhard_pinion_height', 'lr_lower_trailing_arm_chassis_hole', 'rr_lower_trailing_arm_chassis_hole',
    'lr_lower_trailing_arm_axle_hole', 'rr_lower_trailing_arm_axle_hole', 'pull_bar_angle', 'pull_bar_rate_durometer', 'pinion_angle'],
  'Mini Stock / Compact': [...weights.filter(k => k !== 'rear_weight_pct'), 'front_weight_pct', 'transmission_gear', 'final_drive',
    ...four([...commonCorners, 'shock_setting']), ...alignment, 'front_sway_bar_diameter',
    'lr_camber', 'rr_camber', 'lr_toe', 'rr_toe', 'rear_sway_bar_diameter', 'track_width_spacers'],
};
expected['Stock Car / ARCA'] = expected['Pavement Late Model'];
expected['Street Stock / Sportsman'] = expected['Pavement Modified'];
for (const [name, keys] of Object.entries(expected)) test(`${name}: exact requested fields, native corner section and stable class metadata`, () => {
  const config = EXPANDED_CLASS_CONFIGS[name];
  assert.equal(config.category, 'pavement_oval');
  assert.equal(config.developmentOnly, true);
  assert.deepEqual(config.extraSections.map(s => s.title), ['General Chassis', 'Four Corners', 'Front', 'Rear-End & Drivetrain']);
  const fields = config.extraSections.flatMap(s => s.fields);
  assert.deepEqual(fields.map(f => f.key).sort(), [...keys].sort());
  assert.equal(config.extraSections.filter(s => s.layout === 'four-corners').length, 1);
  for (const f of fields) {
    assert.equal(f.applicableClass, name);
    assert.equal(f.applicableCategory, 'pavement_oval');
    assert.ok(f.section && f.type && f.label);
  }
  for (const c of corners) {
    assert.equal(fields.find(f => f.key === `${c}_cold_pressure`)!.unit, 'psi');
    assert.equal(fields.find(f => f.key === `${c}_ride_height`)!.unit, 'in');
    assert.equal(fields.find(f => f.key === `${c}_spring_rate`)!.unit, 'lb/in');
  }
});

test('two shared pavement bases retain separate mutable class/field identities', () => {
  for (const [a, b] of [['Pavement Late Model', 'Stock Car / ARCA'], ['Pavement Modified', 'Street Stock / Sportsman']]) {
    const first = EXPANDED_CLASS_CONFIGS[a], second = EXPANDED_CLASS_CONFIGS[b];
    assert.deepEqual(first.fieldGroups, second.fieldGroups);
    assert.notEqual(first.fieldGroups, second.fieldGroups);
    assert.notEqual(first.extraSections, second.extraSections);
    assert.notEqual(first.extraSections[0].fields[0], second.extraSections[0].fields[0]);
    const snapshot = buildLibraryCustomFields(a, { lf_cold_pressure: '17.25' });
    assert.deepEqual(libraryFieldsFromRow({ race_class: b, custom_fields: snapshot }), {});
  }
});

const measured = { lf_corner_weight: '500', rf_corner_weight: '520', lr_corner_weight: '580', rr_corner_weight: '400' };
test('one corner-weight calculation handles RF+LR cross, left, front/rear and LR-RR bite; display values persist', () => {
  const result = calculatePavementWeights(measured);
  assert.deepEqual(result, { total_weight: '2000', cross_weight_lbs: '1100', cross_weight: '55', left_side_pct: '54', rear_weight_pct: '49', front_weight_pct: '51', rear_bite: '180' });
  const saved = buildLibraryCustomFields('Pavement Late Model', { ...measured, total_weight: '999', cross_weight: '99' });
  assert.equal(libraryFieldsFromRow({ race_class: 'Pavement Late Model', custom_fields: saved }).total_weight, '2000');
  assert.equal(libraryFieldsFromRow({ race_class: 'Pavement Late Model', custom_fields: saved }).cross_weight, '55');
  const compact = libraryFieldsFromRow({ race_class: 'Mini Stock / Compact', custom_fields: buildLibraryCustomFields('Mini Stock / Compact', measured) });
  assert.equal(compact.front_weight_pct, '51');
  assert.equal(compact.rear_weight_pct, undefined);
});

test('incomplete/invalid corner weights preserve manual totals; zero and overflow never yield NaN/Infinity', () => {
  for (const change of [{ rr_corner_weight: '' }, { rr_corner_weight: '-1' }, { rr_corner_weight: 'bad' }, { rr_corner_weight: 'Infinity' }]) {
    assert.deepEqual(calculatePavementWeights({ ...measured, ...change }), {});
    const row = { race_class: 'Legends', custom_fields: buildLibraryCustomFields('Legends', { ...measured, ...change, total_weight: '1500', cross_weight: '52.5' }) };
    assert.equal(libraryFieldsFromRow(row).total_weight, '1500');
    assert.equal(libraryFieldsFromRow(row).cross_weight, '52.5');
  }
  assert.deepEqual(calculatePavementWeights(Object.fromEntries(corners.map(c => [`${c}_corner_weight`, '0']))), { total_weight: '0', cross_weight_lbs: '0', rear_bite: '0' });
  assert.deepEqual(calculatePavementWeights(Object.fromEntries(corners.map(c => [`${c}_corner_weight`, '1e308']))), {});
  assert.equal(calculatePavementWeights({ ...measured, lr_corner_weight: '380' }).rear_bite, '-20');
});

test('old pavement snapshots retain removed fields and signed toe semantics through edit/copy; originals stay untouched', () => {
  for (const name of Object.keys(expected)) {
    const snapshot = { version: 1, race_class: name, values: { lf_cold_pressure: '17.25', front_toe: '-0.125', spoiler_angle: '8', gear_stack: 'old stack', future_setting: 'keep' } };
    const row = { race_class: name, custom_fields: { [SETUP_LIBRARY_KEY]: snapshot } };
    const loaded = libraryFieldsFromRow(row);
    assert.equal(loaded.front_toe, '0.125');
    assert.equal(loaded.front_toe_direction, 'in');
    const copied = buildLibraryCustomFields(name, { ...loaded, lf_cold_pressure: '18' });
    const saved = copied[SETUP_LIBRARY_KEY] as typeof snapshot;
    assert.equal(saved.values.spoiler_angle, '8');
    assert.equal(saved.values.gear_stack, 'old stack');
    assert.equal(saved.values.future_setting, 'keep');
    assert.equal(saved.values.lf_cold_pressure, '18');
    assert.equal(snapshot.values.front_toe, '-0.125');
    assert.equal(snapshot.values.lf_cold_pressure, '17.25');
  }
  assert.deepEqual(normalizePavementToe({ front_toe: '0.125' }), { front_toe: '0.125', front_toe_direction: 'out' });
  assert.deepEqual(normalizePavementToe({ front_toe: '1/8', front_toe_direction: 'in' }), {});
});

test('pavement calculations never change road, kart, motorcycle or RC saved values', () => {
  for (const name of ['GT3', 'Shifter Kart', 'Clutch Kart', 'Road Racing / Superbike', 'RC Oval']) {
    const row = { race_class: name, custom_fields: buildLibraryCustomFields(name, { ...measured, total_weight: '999', cross_weight: '99' }) };
    const loaded = libraryFieldsFromRow(row);
    if ('total_weight' in loaded) assert.equal(loaded.total_weight, '999');
    if ('cross_weight' in loaded) assert.equal(loaded.cross_weight, '99');
  }
});
