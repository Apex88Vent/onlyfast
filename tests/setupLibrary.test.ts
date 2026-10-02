import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as configs from '../src/lib/classConfigs.ts';
import * as library from '../src/lib/setupLibrary.ts';
import * as access from '../src/lib/setupLibraryAccess.ts';
import * as storage from '../src/lib/setupLibraryStorage.ts';
import * as custom from '../src/lib/customCar.ts';
import { buildBetaAccessSnapshot, CLOSED_BETA_ACCESS, setCachedBetaAccess, clearCachedBetaAccess } from '../src/lib/betaFeatures.ts';
import { componentFunction, populatedLibraryState } from './setupLibraryHarness.ts';

export const experimentalAccess = buildBetaAccessSnapshot({ user_id: 'qa', is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' }, [{ feature_key: 'test_account_full_access', enabled: true }]);
const saveBase = componentFunction('CreateBaseSetupView.tsx', 'buildPayload');
const loadBase = componentFunction('CreateBaseSetupView.tsx', 'loadTemplateIntoState');
const saveRace = componentFunction('SetupDashboard.tsx', 'buildPayload');
const loadRace = componentFunction('SetupDashboard.tsx', 'loadSetupIntoState');

test('production registries remain unchanged and all new class IDs are development-only', () => {
  assert.deepEqual(configs.AVAILABLE_CAR_CLASSES, ['Custom Car', 'Dwarf Cars', 'Modified', 'Sport Mod', 'Lightning Sprints', 'Pro Stock', 'Pure Stock']);
  assert.equal(configs.CAR_CLASSES.length, 11);
  assert.equal(library.EXPANDED_CAR_CLASSES.length, 38);
  for (const [name, config] of Object.entries(library.EXPANDED_CLASS_CONFIGS)) {
    assert.equal(config.developmentOnly, true);
    assert.equal(configs.CLASS_CONFIGS[name], undefined);
    const fields = config.extraSections.flatMap(s => s.fields);
    assert.equal(new Set(fields.map(f => f.key)).size, fields.length, name);
    for (const f of fields) {
      assert.match(f.key, /^[a-z][a-z0-9_]*$/);
      assert.equal(f.applicableClass, name);
      assert.equal(f.applicableCategory, config.category);
      assert.ok(f.section && f.type && f.label);
    }
  }
});

test('normal Rookie/Pro/Team/admin, personal beta, disabled switches and missing flags fail closed', () => {
  for (const tier of ['rookie', 'pro', 'team', 'admin']) {
    const snapshot = { ...CLOSED_BETA_ACCESS, tier };
    assert.deepEqual(access.getSelectableSetupClasses(snapshot), configs.AVAILABLE_CAR_CLASSES);
    for (const name of library.EXPANDED_CAR_CLASSES) assert.equal(access.canAccessSetupClass(name, snapshot), false);
  }
  for (const snapshot of [CLOSED_BETA_ACCESS, { ...experimentalAccess, testerKind: 'personal' as const },
    { ...experimentalAccess, betaFeaturesEnabled: false }, { ...experimentalAccess, isBetaTester: false }, { ...experimentalAccess, enabledFeatures: [] }]) {
    assert.equal(access.canAccessSetupLibrary(snapshot), false);
  }
  assert.equal(access.getSelectableSetupClasses(experimentalAccess).length, 49);
  for (const category of Object.keys(library.SETUP_CATEGORY_LABELS)) {
    const classes = access.getDisciplineSetupClasses(category as library.SetupCategory, experimentalAccess);
    for (const name of classes.filter(library.isDevelopmentClass)) assert.equal(library.EXPANDED_CLASS_CONFIGS[name].category, category);
  }
  clearCachedBetaAccess();
  assert.throws(() => saveBase(populatedLibraryState('GT3')), /test account/);
  assert.throws(() => saveRace(populatedLibraryState('GT3'), 'base'), /test account/);
});

for (const name of library.EXPANDED_CAR_CLASSES) test(`${name}: actual base/race serializers preserve all fields through save, reopen, edit, copy and rename`, () => {
  setCachedBetaAccess(experimentalAccess);
  try {
    const state = populatedLibraryState(name);
    const payload = saveBase(state);
    const row = JSON.parse(JSON.stringify(payload));
    const loaded = loadBase(row);
    for (const section of library.EXPANDED_CLASS_CONFIGS[name].extraSections) for (const f of section.fields) assert.equal(loaded[f.key], state[f.key], f.key);
    const copied = { ...loaded, setup_name: 'Copied baseline' };
    const copyRow = JSON.parse(JSON.stringify(saveBase(copied)));
    assert.deepEqual(copyRow.custom_fields, row.custom_fields);
    const renamed = { ...copyRow, setup_name: 'Renamed baseline' };
    assert.deepEqual(loadBase(renamed)[storage.SETUP_LIBRARY_KEY], loaded[storage.SETUP_LIBRARY_KEY]);
    const race = saveRace({ ...loadBase(renamed), raceClass: name }, 'base', 'Race QA');
    const reopenedRace = loadRace(JSON.parse(JSON.stringify(race)));
    const heat = saveRace({ ...reopenedRace }, 'heat', 'Race QA');
    assert.deepEqual(heat.custom_fields, row.custom_fields);
    const first = library.EXPANDED_CLASS_CONFIGS[name].extraSections[0].fields[0].key;
    reopenedRace[first] = 'edited';
    assert.equal(storage.libraryFieldsFromRow(saveRace(reopenedRace, 'main'))[first], 'edited');
    assert.equal(loaded[first], state[first], 'copies do not mutate source');
    assert.equal(storage.rowWithLibraryFields(race)[first], state[first], 'comparison/export hydration');
  } finally { clearCachedBetaAccess(); }
});

test('future fields survive edits, malformed snapshots fail closed, and legacy rows do not acquire new fields', () => {
  const cf = storage.buildLibraryCustomFields('GT3', populatedLibraryState('GT3'));
  (cf[storage.SETUP_LIBRARY_KEY] as any).values.future_adjuster = 'retain me';
  (cf[storage.SETUP_LIBRARY_KEY] as any).values.user_id = 'forged';
  const loaded = storage.libraryFieldsFromRow({ race_class: 'GT3', custom_fields: cf });
  assert.equal(loaded.user_id, undefined);
  const saved = storage.buildLibraryCustomFields('GT3', loaded);
  assert.equal((saved[storage.SETUP_LIBRARY_KEY] as any).values.future_adjuster, 'retain me');
  for (const race_class of configs.CAR_CLASSES) {
    const row = { race_class, lf_pressure: 12.5, notes: 'Legacy', custom_fields: cf };
    assert.deepEqual(storage.rowWithLibraryFields(row), row);
  }
  assert.deepEqual(storage.libraryFieldsFromRow({ race_class: 'GT4', custom_fields: cf }), {});
  assert.equal(storage.readLibrarySnapshot({ version: 2, race_class: 'GT3', values: {} }, 'GT3'), null);
  assert.equal(storage.readLibrarySnapshot({ version: 1, race_class: 'GT3', values: { value: 4 } }, 'GT3'), null);
  assert.equal(library.areSetupSheetsCompatible('GT3', 'GT4'), false);
  assert.equal(library.areSetupSheetsCompatible('GT3', 'GT3'), true);
  assert.equal(library.areSetupSheetsCompatible('Modified', 'Sport Mod'), true);
});

const require = createRequire(import.meta.url);
function renderForm(raceClass: string, betaAccess = experimentalAccess) {
  const source = readFileSync(new URL('../src/components/ChassisSetupForm.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const mod = { exports: {} as { default: React.ComponentType<any> } };
  const localRequire = (id: string) => id === '@/lib/classConfigs' ? configs : id === '@/lib/setupLibraryAccess' ? access : id === '@/hooks/useBetaFeatures' ? { useBetaFeatures: () => betaAccess } : require(id);
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return renderToStaticMarkup(React.createElement(mod.exports.default, { raceClass, data: {}, customFields: [], onChange: () => {} }));
}
test('real form renders all new sheets natively, blocks normal accounts, and keeps class architecture appropriate', () => {
  for (const name of library.EXPANDED_CAR_CLASSES) {
    const html = renderForm(name);
    for (const f of library.EXPANDED_CLASS_CONFIGS[name].extraSections.flatMap(s => s.fields)) assert.ok(html.includes(`-${f.key}"`), `${name}: ${f.key}`);
    const denied = renderForm(name, CLOSED_BETA_ACCESS);
    assert.match(denied, /available only to the OnlyFast test account/);
    assert.doesNotMatch(denied, /<input/);
  }
  assert.doesNotMatch(renderForm('Formula Ford 1600 / FF1600'), /wing|Aero/i);
  assert.match(renderForm('Formula Continental'), /Front wing/);
  assert.match(renderForm('Formula Vee'), /Front Torsion Beam/);
  for (const name of library.EXPANDED_CAR_CLASSES.filter(n => library.EXPANDED_CLASS_CONFIGS[n].category === 'motorcycle')) assert.doesNotMatch(renderForm(name), /Cross weight|Four Corners|LF /i);
  assert.doesNotMatch(renderForm('RC 1/10 Buggy'), /Front diff oil|Center diff oil/);
  assert.match(renderForm('RC 1/10 4WD Buggy'), /Front diff oil/);
  for (const name of configs.CAR_CLASSES.filter(n => n !== 'Custom Car')) assert.match(renderForm(name, CLOSED_BETA_ACCESS), /General Chassis/);
});

function loadUI(file: string, betaAccess = experimentalAccess, states: unknown[] = []) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const mod = { exports: {} as any };
  let stateIndex = 0;
  const localRequire = (id: string) => {
    if (id === 'react' && states.length) return { ...React, useState: (initial: unknown) => [stateIndex < states.length ? states[stateIndex++] : initial, () => {}], useEffect: () => {} };
    if (id === '@/lib/classConfigs') return configs;
    if (id === '@/lib/setupLibrary') return library;
    if (id === '@/lib/setupLibraryAccess') return access;
    if (id === '@/lib/setupLibraryStorage') return storage;
    if (id === '@/lib/customCar') return custom;
    if (id === '@/hooks/useBetaFeatures') return { useBetaFeatures: () => betaAccess };
    if (id === '@/lib/paymentVisibility') return { isMedianIOSApp: false };
    if (id === '@/lib/activeClass') return { sameClass: componentFunction('../lib/activeClass.ts', 'sameClass') };
    if (id.startsWith('@/')) return {};
    return require(id);
  };
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return mod.exports;
}

test('actual onboarding and class-change selectors hide additions from every production tier', () => {
  for (const tier of ['rookie', 'pro', 'team', 'admin']) {
    const modal = loadUI('components/ClassChangeModal.tsx', CLOSED_BETA_ACCESS, ['selector', 'Dwarf Cars', null, '', false, true]).default;
    const html = renderToStaticMarkup(React.createElement(modal, { isOpen: true, currentClass: 'Dwarf Cars', tier }));
    assert.doesNotMatch(html, /Shifter Kart|Clutch Kart|GT3|Legends|RC 1\/8 Buggy|Superbike/);
  }
  const onboarding = loadUI('components/OnboardingFlow.tsx', CLOSED_BETA_ACCESS, [3, 'Dirt Track Oval']).default;
  const normal = renderToStaticMarkup(React.createElement(onboarding, { onComplete: () => {} }));
  assert.doesNotMatch(normal, /Shifter Kart|Clutch Kart|GT3|Legends|Superbike/);
  const testOnboarding = loadUI('components/OnboardingFlow.tsx', experimentalAccess, [3, 'Road Course']).default;
  const expanded = renderToStaticMarkup(React.createElement(testOnboarding, { onComplete: () => {} }));
  assert.match(expanded, /GT3|Formula Ford 1600/);
  assert.match(expanded, /Shifter Kart/);
  assert.match(expanded, /Clutch Kart/);
  assert.doesNotMatch(expanded, /Dwarf Cars|RC 1\/8 Buggy|Superbike/);
});

test('actual comparison and PDF display JSON values with schema labels instead of reserved storage blobs', () => {
  setCachedBetaAccess(experimentalAccess);
  try {
    const pdf = loadUI('lib/setupPdf.ts');
    for (const name of library.EXPANDED_CAR_CLASSES) {
      const row = saveBase(populatedLibraryState(name));
      const html = pdf.buildSetupPdfHtml(row);
      for (const section of library.EXPANDED_CLASS_CONFIGS[name].extraSections) {
        const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        for (const f of section.fields) if (row.custom_fields[storage.SETUP_LIBRARY_KEY].values[f.key]) assert.ok(html.includes(escape(f.label)), `${name}: ${f.label}`);
      }
      assert.doesNotMatch(html, /onlyfast_setup_library_v1|\[object Object\]/);
    }
    const first = { id: 'one', ...storage.rowWithLibraryFields(saveBase(populatedLibraryState('GT3'))) };
    const second = { id: 'two', ...storage.rowWithLibraryFields(saveBase({ ...populatedLibraryState('GT3'), rear_wing_angle: '9' })) };
    const Compare = loadUI('components/SetupComparison.tsx', experimentalAccess, [[first, second], ['one', 'two'], false, false, 'all']).default;
    const html = renderToStaticMarkup(React.createElement(Compare, { user: { id: 'qa' } }));
    assert.match(html, /Rear wing angle \(deg\)/);
    assert.match(html, />9</);
    assert.match(html, /High speed compression/);
    assert.doesNotMatch(html, /onlyfast_setup_library_v1/);
    clearCachedBetaAccess();
    assert.throws(() => pdf.buildSetupPdfHtml(first), /test account/);
  } finally { clearCachedBetaAccess(); }
});

test('dedicated kart sheets share flex/axle geometry, use Road Course and differentiate brakes/drive', () => {
  for (const name of ['Shifter Kart', 'Clutch Kart']) {
    const config = library.EXPANDED_CLASS_CONFIGS[name];
    assert.equal(config.category, 'road_course');
    assert.equal(config.family, 'kart');
    const html = renderForm(name);
    assert.doesNotMatch(html, /spring|shock|anti-roll|differential|wing angle/i);
    for (const label of ['Rear axle', 'Seat', 'Ackerman', 'Front / drive sprocket', 'Rear sprocket']) assert.ok(html.includes(label), name + ': ' + label);
    for (const corner of ['lf', 'rf', 'lr', 'rr']) assert.ok(config.extraSections.flatMap(s => s.fields).some(f => f.key === corner + '_cold_pressure'));
  }
  assert.match(renderForm('Shifter Kart'), /Front brake configuration|Front brake balance/);
  assert.doesNotMatch(renderForm('Shifter Kart'), /Clutch engagement|Individual transmission/);
  assert.match(renderForm('Clutch Kart'), /Rear brake \/ pad configuration|Clutch engagement/);
  assert.doesNotMatch(renderForm('Clutch Kart'), /Front brake|brake balance/i);
});
