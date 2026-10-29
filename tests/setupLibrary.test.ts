import assert from 'node:assert/strict';
import * as classIcons from '../src/lib/classIcons.ts';
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
import * as pavementValues from '../src/lib/pavementSetupValues.ts';
import { ROAD_RACING_CLASSES, ROAD_RACING_CLASS_CONFIGS } from '../src/lib/roadRacingSetupSchemas.ts';
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
  assert.equal(library.EXPANDED_CAR_CLASSES.length, 48);
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

test('all configured sheets are released while experimental account privileges remain gated', () => {
  for (const tier of ['rookie', 'pro', 'team', 'admin']) {
    const snapshot = { ...CLOSED_BETA_ACCESS, tier };
    assert.deepEqual(access.getSelectableSetupClasses(snapshot), [...configs.CAR_CLASSES, ...library.EXPANDED_CAR_CLASSES]);
    for (const name of library.EXPANDED_CAR_CLASSES) assert.equal(access.canAccessSetupClass(name, snapshot), true);
  }
  for (const snapshot of [CLOSED_BETA_ACCESS, { ...experimentalAccess, testerKind: 'personal' as const },
    { ...experimentalAccess, betaFeaturesEnabled: false }, { ...experimentalAccess, isBetaTester: false }, { ...experimentalAccess, enabledFeatures: [] }]) {
    assert.equal(access.canAccessSetupLibrary(snapshot), false);
  }
  assert.equal(access.getSelectableSetupClasses(experimentalAccess).length, 59);
  for (const category of Object.keys(library.SETUP_CATEGORY_LABELS)) {
    const classes = access.getDisciplineSetupClasses(category as library.SetupCategory, experimentalAccess);
    for (const name of classes.filter(library.isDevelopmentClass)) assert.equal(library.EXPANDED_CLASS_CONFIGS[name].category, category);
  }
  clearCachedBetaAccess();
  assert.equal(saveBase(populatedLibraryState('GT3')).race_class, 'GT3');
  assert.equal(saveRace(populatedLibraryState('GT3'), 'base').race_class, 'GT3');
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
  const localRequire = (id: string) => id === '@/lib/classConfigs' ? configs : id === '@/lib/setupLibraryAccess' ? access : id === '@/lib/pavementSetupValues' ? pavementValues : id === '@/hooks/useBetaFeatures' ? { useBetaFeatures: () => betaAccess } : require(id);
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return renderToStaticMarkup(React.createElement(mod.exports.default, { raceClass, data: {}, customFields: [], onChange: () => {} }));
}
test('real form renders existing sheets for normal accounts and keeps class architecture appropriate', () => {
  for (const name of library.EXPANDED_CAR_CLASSES) {
    const html = renderForm(name);
    for (const f of library.EXPANDED_CLASS_CONFIGS[name].extraSections.flatMap(s => s.fields)) assert.ok(html.includes(`-${f.key}"`), `${name}: ${f.key}`);
    const released = renderForm(name, CLOSED_BETA_ACCESS);
    assert.match(released, /<input/);
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
    if (id === '@/lib/classIcons') return classIcons;
    if (id === '@/lib/setupLibrary') return library;
    if (id === '@/lib/setupLibraryAccess') return access;
    if (id === '@/lib/setupLibraryStorage') return storage;
    if (id === '@/lib/customCar') return custom;
    if (id === '@/hooks/useBetaFeatures') return { useBetaFeatures: () => betaAccess };
    if (id === '@/lib/paymentVisibility') return { isMedianIOSApp: false };
    if (id === './PlanSelection') return { default: () => null };
    if (id === './RookieAdSlot') return { __esModule: true, default: () => null };
    if (id === './OnboardingFlow') return { disciplines: Object.entries(library.SETUP_CATEGORY_LABELS).map(([key, name]) => ({ key, name })) };
    if (id === '@/lib/activeClass') return { sameClass: componentFunction('../lib/activeClass.ts', 'sameClass') };
    if (id.startsWith('@/')) return {};
    return require(id);
  };
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return mod.exports;
}

test('actual onboarding and class-change selectors filter by discipline for every production tier', () => {
  for (const tier of ['rookie', 'pro', 'team', 'admin']) {
    const modal = loadUI('components/ClassChangeModal.tsx', CLOSED_BETA_ACCESS, ['selector', 'GT3', 'road_course', null, '', false, true, true]).default;
    const html = renderToStaticMarkup(React.createElement(modal, { isOpen: true, currentClass: 'Dwarf Cars', tier }));
    assert.match(html, /Go-Karts|GT3/);
    assert.doesNotMatch(html, /<option value="Legends"|RC 1\/8 Buggy|Superbike/);
  }
  const onboarding = loadUI('components/OnboardingFlow.tsx', CLOSED_BETA_ACCESS, [3, 'Dirt Track Oval']).default;
  const normal = renderToStaticMarkup(React.createElement(onboarding, { onComplete: () => {} }));
  assert.doesNotMatch(normal, /Shifter Kart|Clutch Kart|GT3|Legends|Superbike/);
  const testOnboarding = loadUI('components/OnboardingFlow.tsx', experimentalAccess, [3, 'Road Racing']).default;
  const expanded = renderToStaticMarkup(React.createElement(testOnboarding, { onComplete: () => {} }));
  assert.match(expanded, /GT3|Formula Ford/);
  assert.match(expanded, /Go-Karts/);
  assert.match(expanded, /Mazda MX-5/);
  assert.doesNotMatch(expanded, /Dwarf Cars|RC 1\/8 Buggy|Superbike/);
});

test('Road Racing releases exactly ten stable IDs, blank sheets and isolated values', () => {
  const names = ['Mazda MX-5 / Spec Miata', 'GT3', 'GT4', 'Prototypes', 'Winged Open-Wheel Formula',
    'Non-Winged Open-Wheel Formula', 'Go-Karts', 'Road Course Legends Car', 'Touring Car / TCR', 'Trans-Am / TA2'];
  const counts = [76, 84, 57, 51, 44, 48, 31, 52, 45, 47];
  assert.deepEqual(access.getDisciplineSetupClasses('road_course', CLOSED_BETA_ACCESS), ROAD_RACING_CLASSES);
  assert.deepEqual(ROAD_RACING_CLASSES.map(id => library.setupClassLabel(id)), names);
  ROAD_RACING_CLASSES.forEach((id, i) => {
    assert.match(id, /^road_[a-z_0-9]+$/);
    const config = configs.getClassConfig(id);
    assert.equal(config, ROAD_RACING_CLASS_CONFIGS[id]);
    const fields = config.extraSections.flatMap(section => section.fields);
    assert.equal(fields.length, counts[i]);
    const blank = storage.buildLibraryCustomFields(id, {})[storage.SETUP_LIBRARY_KEY] as any;
    assert.ok(Object.values(blank.values).every(value => value === ''));
    const html = renderForm(id, CLOSED_BETA_ACCESS);
    assert.doesNotMatch(html, /value="[^\"]+"[^>]*type="text"/);
    for (const field of fields) if (field.type === 'select') assert.equal(field.options?.[0].value, '');
    if (id === 'road_karts') assert.doesNotMatch(html, /Four Corners|spring rate|damper/i);
    else assert.match(html, /grid-cols-1 md:grid-cols-2/);
    for (const otherId of ROAD_RACING_CLASSES.filter(other => other !== id)) {
      assert.deepEqual(storage.libraryFieldsFromRow({ race_class: otherId, custom_fields: { [storage.SETUP_LIBRARY_KEY]: blank } }), {});
      assert.equal(library.areSetupSheetsCompatible(id, otherId), false);
    }
  });
  assert.match(renderForm('road_tcr'), /Left Front \(LF - Drive Axle\)/);
});

test('discipline cards badge only Road Racing and Pavement Oval and Road Racing has no coming-soon state', () => {
  const Onboarding = loadUI('components/OnboardingFlow.tsx', CLOSED_BETA_ACCESS).default;
  const html = renderToStaticMarkup(React.createElement(Onboarding, { onComplete: () => {} }));
  const cards = [...html.matchAll(/<button[^>]*aria-label="([^\"]*)"[^>]*>([\s\S]*?)<\/button>/g)];
  for (const name of ['Road Racing', 'Pavement Oval', 'Dirt Track Oval']) {
    const card = cards.find(([, label]) => label.startsWith(name + ' -'));
    assert.ok(card, `${name} is selectable`);
    if (name === 'Dirt Track Oval') assert.doesNotMatch(card[2], />BETA</);
    else assert.match(card[2], />BETA</);
    if (name === 'Road Racing') assert.doesNotMatch(card[0], /disabled|Coming Soon/);
  }
  assert.equal((html.match(/>BETA</g) || []).length, 2);
});

test('onboarding uses the exact motto/descriptions and locks RC/Motorcycle for ordinary and flagged accounts', () => {
  const descriptions = [
    'Master changing surfaces, find your grip, and dial in your setup for every lap.',
    'Fine-tune handling, balance, and speed to maximize performance on paved ovals.',
    'Perfect your setup for braking, cornering, and acceleration across technical road courses.',
    'Dial in suspension, gearing, and handling to get the most from your RC racer.',
    'Optimize suspension, traction, and handling for peak performance on two wheels.',
  ];
  for (const snapshot of [CLOSED_BETA_ACCESS, experimentalAccess]) {
    const Onboarding = loadUI('components/OnboardingFlow.tsx', snapshot).default;
    const html = renderToStaticMarkup(React.createElement(Onboarding, { onComplete: () => assert.fail('Unavailable discipline completed') }));
    assert.match(html, /Race Smarter\. Finish Faster\./);
    assert.doesNotMatch(html, /Your Smart Setup Solutions?/);
    for (const description of descriptions) assert.ok(html.includes(description), description);
    for (const name of ['RC Racing', 'Motorcycle Racing']) {
      assert.ok(html.includes(`aria-disabled="true" aria-label="${name} - Coming Soon"`));
      assert.ok(![...html.matchAll(/<button[^>]*aria-label="([^\"]*)"/g)].some(([, label]) => label.startsWith(name + ' -')));
    }
    assert.equal((html.match(/>COMING SOON</g) || []).length, 2);
    const pavement = html.match(/<button[^>]*aria-label="Pavement Oval[^\"]*"[\s\S]*?<\/button>/)![0];
    const road = html.match(/<button[^>]*aria-label="Road Racing[^\"]*"[\s\S]*?<\/button>/)![0];
    assert.match(pavement, /<ellipse[^>]*stroke="#00A8E8"/);
    assert.match(road, /<path[^>]*stroke="#00A8E8"[^>]*stroke-width="3"/);
    assert.doesNotMatch(road, /<ellipse/);
  }
});

test('unavailable restored onboarding selections always return to discipline selection', () => {
  const Onboarding = loadUI('components/OnboardingFlow.tsx').default;
  for (const initialDiscipline of ['rc', 'RC', 'RC Racing', 'motorcycle', 'Motorcycle', 'Motorcycle Racing']) {
    for (const initialStep of ['vehicle', 'plan']) {
      const html = renderToStaticMarkup(React.createElement(Onboarding, { initialStep, initialDiscipline,
        initialClass: initialDiscipline.startsWith('RC') || initialDiscipline === 'rc' ? 'RC 1/8 Buggy' : 'Supersport', onComplete: () => assert.fail('Unavailable class completed') }));
      assert.match(html, /Select Your Discipline/);
      assert.doesNotMatch(html, /Car class options|Choose Your Plan/);
    }
  }
  const classOnly = renderToStaticMarkup(React.createElement(Onboarding, { initialStep: 'plan', initialClass: 'Supersport', onComplete: () => {} }));
  assert.match(classOnly, /Select Your Discipline/);
});

test('class-change dropdown disables RC/Motorcycle and retains the supported disciplines', () => {
  const Modal = loadUI('components/ClassChangeModal.tsx', CLOSED_BETA_ACCESS, ['selector', '', 'dirt_oval', null, '', false, true, true]).default;
  const html = renderToStaticMarkup(React.createElement(Modal, { isOpen: true, currentClass: 'Dwarf Cars', tier: 'rookie' }));
  assert.match(html, /<option value="rc" disabled="">RC Racing — COMING SOON<\/option>/);
  assert.match(html, /<option value="motorcycle" disabled="">Motorcycle Racing — COMING SOON<\/option>/);
  for (const value of ['dirt_oval', 'pavement_oval', 'road_course']) assert.doesNotMatch(html, new RegExp(`<option value="${value}" disabled`));
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
    assert.match(pdf.buildSetupPdfHtml(first), /Rear wing angle/);
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
