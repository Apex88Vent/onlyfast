import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { create, act } from 'react-test-renderer';
import ts from 'typescript';
import { loadMembershipPolicy } from '../scripts/prepare-2027-testing-policy.mjs';
import { resolveAuthorizedMembership } from '../src/lib/trustedMembership.ts';

const membership = await loadMembershipPolicy();
const { tierLimits, checkSavePermission, getSetupPermissions, checkSetupAssistPermission } = membership;
const context = { tier: 'sportsman', kind: 'race_weekend', isExistingSave: false,
  existingRaceWeekendCount: 0, existingBaseSetupCount: 0, existingCarTypes: ['Dwarf Cars'],
  activeCarType: 'Dwarf Cars', newCarType: 'Dwarf Cars' };

test('2027 tiers preserve legacy quotas, classes, ads, AI limits and future integration flags', () => {
  for (const [tier, base, regular, cars, ads] of [
    ['sportsman', 2, 5, 1, false], ['pro', 'unlimited', 'unlimited', 1, false],
    ['factory', 'unlimited', 'unlimited', 'unlimited', false],
    ['rookie', 1, 2, 1, true], ['team', 'unlimited', 'unlimited', 'unlimited', false],
  ]) {
    const limits = tierLimits[tier];
    assert.equal(limits.maxBaseSetups, base); assert.equal(limits.maxRaceWeekendSetups, regular);
    assert.equal(limits.maxCars, cars); assert.equal(limits.adsEnabled, ads);
    assert.equal(limits.onlyLapsEnabled, !['rookie', 'sportsman'].includes(tier));
    assert.equal(limits.telemetryEnabled, limits.onlyLapsEnabled);
    assert.equal(limits.telemetrySetupAssistEnabled, limits.onlyLapsEnabled);
  }
  assert.equal(tierLimits.sportsman.timingUploadsPerMonth, null);
  assert.equal(tierLimits.sportsman.timingUploadsPerRaceWeekend, 2);
  assert.equal(tierLimits.rookie.timingUploadsPerMonth, 2);
  assert.equal(checkSetupAssistPermission('sportsman', 1).allowed, false);
  assert.equal(checkSetupAssistPermission('factory', 1000).allowed, true);
});

test('Sportsman counts all retained regular setups and enforces both quota boundaries', () => {
  for (let count = 0; count < 7; count++) {
    assert.equal(checkSavePermission({ ...context, existingRaceWeekendCount: count }).allowed, count < 5);
    assert.equal(checkSavePermission({ ...context, kind: 'base_template', existingBaseSetupCount: count }).allowed, count < 2);
  }
  assert.equal(checkSavePermission({ ...context, existingRaceWeekendCount: 5, isExistingSave: true }).allowed, true);
  assert.equal(checkSavePermission({ ...context, tier: 'pro', newCarType: 'Modified' }).allowed, false);
  assert.equal(checkSavePermission({ ...context, tier: 'factory', newCarType: 'Modified' }).allowed, true);
});

test('48-hour boundary locks edits but never values, notes or results; base templates do not lock', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  for (const age of [0, 48 * 3600000 - 1, 48 * 3600000, 100 * 3600000]) {
    const timestamp = new Date(now - age).toISOString();
    const result = getSetupPermissions('sportsman', timestamp, false, now);
    assert.equal(result.canView, true); assert.equal(result.canEdit, age < 48 * 3600000);
    assert.equal(getSetupPermissions('sportsman', timestamp, true, now).canEdit, true);
    for (const tier of ['pro', 'factory', 'team']) assert.equal(getSetupPermissions(tier, timestamp, false, now).canEdit, true);
  }
});

test('legacy paid rows are never renamed; new tiers require an authoritative explicit test override', () => {
  for (const [plan, expected] of [['free', 'rookie'], ['pro', 'pro'], ['teams', 'team']]) {
    const row = { plan, status: 'active', subscription_source: 'stripe' };
    assert.equal(resolveAuthorizedMembership(row).membership_tier, expected);
    for (const tier of ['sportsman', 'pro', 'factory'] as const) {
      assert.equal(resolveAuthorizedMembership(row, {}, Date.now(), tier).membership_tier, tier);
    }
  }
});

test('mounted preview inspects permissions without auth, network, purchases or membership assignment', async () => {
  const require = createRequire(import.meta.url);
  const cache = new Map<string, any>();
  function load(file: string): any {
    if (file === 'lib/membership.ts') return membership;
    if (cache.has(file)) return cache.get(file);
    const js = ts.transpileModule(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', js)((name: string) => {
      if (name.endsWith('.css')) return {};
      if (name.startsWith('@/')) return load(name.slice(2) + (name.includes('/components/') ? '.tsx' : '.ts'));
      if (name === './membership') return membership;
      return require(name);
    }, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  }
  const Preview = load('pages/Phase2027Preview.tsx').default;
  let view: any;
  const text = () => JSON.stringify(view.toJSON());
  await act(async () => { view = create(React.createElement(Preview)); });
  try {
    assert.match(text(), /4.99/); assert.match(text(), /7.99/); assert.match(text(), /14.99/); assert.match(text(), /60\/year/);
    assert.equal(view.root.findByType('textarea').props.readOnly, true);
    assert.match(text(), /250 lb\/in/); assert.match(text(), /15.482s/);
    await act(async () => view.root.findByProps({ 'aria-label': 'Setup age in hours' }).props.onChange({ target: { value: '47' } }));
    assert.equal(view.root.findByType('textarea').props.readOnly, false);
    for (const label of ['Pro', 'Factory', 'Sportsman']) {
      const button = view.root.findAllByType('button').find((button: any) => button.children.join('') === 'Inspect ' + label + ' permissions');
      await act(async () => button.props.onClick());
      assert.equal(button.props['aria-pressed'], true);
    }
    assert.doesNotMatch(text(), /purchase successful|subscription activated/i);
  } finally { await act(async () => view.unmount()); }
});
