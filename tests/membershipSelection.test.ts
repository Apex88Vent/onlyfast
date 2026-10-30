import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function renderPlans(native: boolean, allowWebCheckout = false, enabled = false) {
  const cache = new Map<string, any>();
  function load(file: string): any {
    if (cache.has(file)) return cache.get(file);
    const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', js)((name: string) => {
      if (name === 'react') return { ...React, useEffect: () => {} };
      if (name === '@/lib/paymentVisibility') return { hideExternalPayments: native };
      if (name === '@/lib/nativePurchases') return { nativePurchasesEnabled: enabled };
      if (name === '@/lib/membership') return load('lib/membership.ts');
      if (name.includes('trustedMembership')) return { getTrustedMembership: () => null };
      if (name.includes('testAccount')) return { isCurrentUserTestAccount: () => false };
      if (name === '@/lib/supabase' || name === '@/lib/subscription') return {};
      if (name === './NativeSubscriptionControls' || name === './StripeBuyButton') return { default: () => {
        assert.ok(enabled, 'Disabled native plan must not mount purchase controls');
        assert.equal(name, './NativeSubscriptionControls', 'Native plans must use the stock paywall');
        return React.createElement('button', {}, 'View Pro and Teams subscriptions');
      }, __esModule: true };
      if (name.startsWith('./')) return load('components/' + name.slice(2) + '.tsx');
      return require(name);
    }, mod, mod.exports);
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const Plan = load('components/PlanSelection.tsx').default;
  return { html: renderToStaticMarkup(React.createElement(Plan, { userId: 'user', onComplete: () => {}, allowWebCheckout })), limits: load('lib/membership.ts').tierLimits };
}
test('native-disabled membership shows all plans, free continuation, accurate limits, accessible locks', () => {
  const { html, limits } = renderPlans(true);
  assert.match(html, /Choose Your OnlyFast Plan/);
  assert.match(html, /Start racing for free, or unlock more features with Pro and Teams/);
  for (const plan of ['Rookie', 'Pro', 'Teams']) assert.match(html, new RegExp('>' + plan + '<'));
  assert.doesNotMatch(html.match(/<button[^>]*>Continue Free<\/button>/)?.[0] || 'missing', /\sdisabled(?:=|>)/);
  assert.match(html, />Continue Free<\/button>/);
  assert.equal((html.match(/<button[^>]*disabled[^>]*>Coming Soon<\/button>/g) || []).length, 2);
  assert.match(html, /Free Forever/); assert.match(html, /Localized store prices, subscription terms and any eligible introductory offer/);
  assert.match(html, /role="table" aria-label="OnlyFast membership features"/);
  assert.match(html, /Locked/); assert.match(html, /Included/);
  assert.equal(limits.rookie.setupAssistsPerRaceWeekend, 1);
  assert.match(html, /1 \/ weekend/);
  assert.equal(limits.rookie.maxRaceWeekendSetups, 2);
  assert.equal(limits.pro.maxCars, 1); assert.equal(limits.team.maxCars, 'unlimited');
  assert.doesNotMatch(html, /\$5|\$8/);
  assert.match(html, /Store pricing/);
});

test('reviewed activation removes native Coming Soon and uses the stock paywall for both paid plans', () => {
  const { html } = renderPlans(true, false, true);
  assert.doesNotMatch(html, /Coming Soon|\$5|\$8/);
  assert.equal((html.match(/View Pro and Teams subscriptions/g) || []).length, 2);
  assert.match(html, />Continue Free<\/button>/);
});
test('web membership retains separate Pro and Teams checkout choices', () => {
  const { html } = renderPlans(false, true);
  assert.match(html, /Choose Pro/); assert.match(html, /Choose Teams/);
  assert.doesNotMatch(html, /Coming Soon/);
  assert.match(html, /\$5/); assert.match(html, /\$8/);
});
test('web onboarding keeps paid plans held without changing the existing web upgrade checkout', () => {
  const { html } = renderPlans(false);
  assert.equal((html.match(/<button[^>]*disabled[^>]*>Coming Soon<\/button>/g) || []).length, 2);
  assert.doesNotMatch(html, />Choose Pro<|>Choose Teams</);
  assert.match(html, />Continue Free<\/button>/);
});
