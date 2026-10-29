import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as library from '../src/lib/setupLibrary.ts';
import * as sessions from '../src/lib/raceWeekendSessions.ts';
import * as schedule from '../src/lib/scheduleSelection.ts';
import * as custom from '../src/lib/customCar.ts';
import * as storage from '../src/lib/setupLibraryStorage.ts';

const require = createRequire(import.meta.url);
const user = { id: 'rookie-fixture', user_metadata: {} };
const raceClass = Object.keys(library.EXPANDED_CLASS_CONFIGS)[0];
const component = (defaultComponent: unknown) => ({ __esModule: true, default: defaultComponent });

// Render real page JSX with seeded UI data. Auth/network/effects and unrelated
// feature widgets are isolated; actual card/list boundaries and counts are kept.
function renderPage(file: string, states: Record<string, unknown> = {}, props = {}, eligible = true) {
  const source = readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), 'utf8');
  const seedStates: ts.TransformerFactory<ts.SourceFile> = context => root => {
    const visit: ts.Visitor = node => {
      if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer &&
          ts.isCallExpression(node.initializer) && node.initializer.expression.getText().endsWith('useState')) {
        const call = node.initializer;
        const seed = ts.factory.createCallExpression(ts.factory.createIdentifier('__seed'), undefined,
          [ts.factory.createStringLiteral(node.name.elements[0].name!.getText()), ...call.arguments]);
        return ts.factory.updateVariableDeclaration(node, node.name, node.exclamationToken, node.type,
          ts.factory.updateCallExpression(call, call.expression, call.typeArguments, [seed]));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(root, visit) as ts.SourceFile;
  };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    transformers: { before: [seedStates] } }).outputText;
  const fakeReact = { ...React, useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect() {}, useLayoutEffect() {}, useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
    useRef: (current: unknown) => ({ current }), useId: () => 'fixture' };
  const modules: Record<string, unknown> = {
    react: fakeReact, '@/lib/supabase': { supabase: {} }, '@/lib/setupLibrary': library,
    '@/lib/setupLibraryStorage': storage, '@/lib/customCar': custom,
    '@/lib/raceWeekendSessions': sessions, '@/lib/scheduleSelection': schedule,
    '@/lib/classIcons': { getClassIcon: () => null },
    '@/lib/setupLibraryAccess': { canAccessSetupClass: () => true },
    '@/lib/paymentVisibility': { isMedianIOSApp: false },
    '@/lib/membership': { getEffectiveTier: () => eligible ? 'rookie' : 'pro', readMembership: () => ({}) },
    './RookieAdSlot': component(({ user, container, colSpan }: { user?: unknown; container?: string; colSpan?: number }) => {
      if (!eligible || !user) return null;
      const ad = React.createElement('aside', { 'data-house-ad': true }, 'Existing house ad');
      return container === 'li' ? React.createElement('li', {}, ad) : container === 'tr'
        ? React.createElement('tr', {}, React.createElement('td', { colSpan }, ad)) : ad;
    }),
    './RaceScheduleForm': component(() => null), './RaceScheduleExport': component(() => null),
    './LockedFeatureNotice': component(() => null),
    './CustomCarSheet': { ...component(() => React.createElement('section', {}, 'Custom car fields')), useCustomCarTemplate: () => ({ template: null }) },
    './ChassisSetupForm': component(() => React.createElement('section', { 'data-fixture-chassis': true }, 'Complete chassis form')),
    './CustomFieldManager': component(() => React.createElement('section', {}, 'Custom fields')),
  };
  const output = { exports: {} as { default: React.ComponentType<Record<string, unknown>> } };
  new Function('require', 'module', 'exports', '__seed', js)((id: string) => {
    if (id in modules) return modules[id];
    if (id === 'lucide-react') return require(id);
    throw Error(`Unstubbed page boundary ${file}: ${id}`);
  }, output, output.exports, (key: string, initial: unknown) => Object.hasOwn(states, key) ? states[key] : initial);
  return renderToStaticMarkup(React.createElement(output.exports.default, { user, selectedCar: raceClass, customFields: [],
    onSignInClick() {}, onLoad() {}, onLoadBaseSetup() {}, onUpgrade() {}, onCustomFieldsChange() {},
    classLocksEnabled: false, activeClass: raceClass, refreshTrigger: 0, ...props }));
}

const count = (html: string) => (html.match(/data-house-ad="true"/g) || []).length;
const savedRows = (n: number) => Array.from({ length: n }, (_, index) => ({ id: `row-${index}`, setup_type: 'base_template',
  setup_name: `[BASE TEMPLATE] Row ${index}`, race_class: raceClass, race_date: '2026-10-28', created_at: '2026-10-28' }));

test('schedule, saved setups and parts keep exactly one inline ad as lists load, filter and grow', () => {
  for (const size of [0, 1, 2, 7, 12]) {
    const races = Array.from({ length: size }, (_, index) => ({ id: `race-${index}`, track: `Track ${index}`, race_date: '2026-10-28' }));
    assert.equal(count(renderPage('RaceSchedule', { races })), 1, `schedule ${size}`);
    assert.equal(count(renderPage('SavedSetups', { setups: savedRows(size), loading: false })), 1, `saved ${size}`);
    const rows = Array.from({ length: size }, (_, index) => ({ id: `part-${index}`, part_type: `Part ${index}`, cost: 1, notes: '' }));
    assert.equal(count(renderPage('PartsReference', { rows })), 1, `parts ${size}`);
  }
  for (const file of ['RaceSchedule', 'SavedSetups', 'PartsReference']) {
    assert.equal(count(renderPage(file, { loading: true })), 1, `${file} loading`);
    assert.equal(count(renderPage(file, {}, {}, false)), 0, `${file} paid`);
    assert.equal(count(renderPage(file, {}, { user: null })), 0, `${file} logged out`);
  }
});

test('long lists put the ad between complete records, not in a form or inside one record', () => {
  const races = Array.from({ length: 6 }, (_, index) => ({ id: `race-${index}`, track: `Track ${index}`, race_date: '2026-10-28' }));
  const html = renderPage('RaceSchedule', { races });
  assert.ok(html.indexOf('Track 2') < html.indexOf('data-house-ad'));
  assert.ok(html.indexOf('data-house-ad') < html.indexOf('Track 3'));
  assert.doesNotMatch(html.slice(html.indexOf('data-house-ad') - 15, html.indexOf('data-house-ad')), /fixed|sticky/);
});

test('To Do page has one ad between complete sections; embedded panels have none', () => {
  const html = renderPage('TodoList', {}, { variant: 'page' });
  assert.equal(count(html), 1);
  assert.equal(count(renderPage('TodoList', {}, { variant: 'panel' })), 0);
  assert.equal(count(renderPage('TodoList', {}, { variant: 'page' }, false)), 0);
});

test('base setup and comparison have one central ad without splitting chassis fields', () => {
  const base = renderPage('CreateBaseSetupView', { loaded: true });
  assert.equal(count(base), 1); assert.ok(base.indexOf('Complete chassis form') < base.indexOf('data-house-ad'));
  assert.ok(base.indexOf('data-house-ad') < base.indexOf('Baseline philosophy'));
  assert.equal(count(renderPage('SetupComparison', { loading: false })), 1);
  assert.equal(count(renderPage('SetupComparison', { loading: false }, {}, false)), 0);
});

test('landing has one scrolling house slot and adapts its boundary to short and long content', () => {
  const middleSlot = React.createElement('aside', { 'data-house-ad': true }, 'Existing house ad');
  const short = renderPage('HomeLanding', {}, { middleSlot, onAction() {} });
  assert.equal(count(short), 1);
  assert.ok(short.indexOf('data-house-ad') < short.indexOf('Home actions'));
  const long = renderPage('HomeLanding', {}, { middleSlot, onAction() {},
    currentWeekend: { trackName: 'Current Weekend Fixture', date: '2026-10-28', sessions: [] },
    performanceStats: [{ label: 'Wins', value: 1 }], upcomingEvents: [{ track: 'Next Track', date: '2026-10-30' }],
  });
  assert.equal(count(long), 1);
  assert.ok(long.indexOf('Home actions') < long.indexOf('data-house-ad'));
  assert.ok(long.indexOf('data-house-ad') < long.indexOf('Current Weekend Fixture'));
});
