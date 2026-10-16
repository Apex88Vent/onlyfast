import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function renderPlans(native: boolean) {
  const cache = new Map<string, any>();
  function load(file: string): any {
    if (cache.has(file)) return cache.get(file);
    const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', js)((name: string) => {
      if (name === 'react') return { ...React, useEffect: () => {} };
      if (name === '@/lib/paymentVisibility') return { hideExternalPayments: native };
      if (name === '@/lib/nativePurchases') return { nativePurchasesEnabled: false };
      if (name === '@/lib/membership') return load('lib/membership.ts');
      if (name.includes('trustedMembership')) return { getTrustedMembership: () => null };
      if (name.includes('testAccount')) return { isCurrentUserTestAccount: () => false };
      if (name === '@/lib/supabase' || name === '@/lib/subscription') return {};
      if (name === './NativeSubscriptionControls' || name === './StripeBuyButton') return { default: () => { throw new Error('Disabled native plan must not mount purchase controls'); }, __esModule: true };
      if (name.startsWith('./')) return load('components/' + name.slice(2) + '.tsx');
      return require(name);
    }, mod, mod.exports);
    cache.set(file, mod.exports);
    return mod.exports;
  }
  const Plan = load('components/PlanSelection.tsx').default;
  return { html: renderToStaticMarkup(React.createElement(Plan, { userId: 'user', onComplete: () => {} })), limits: load('lib/membership.ts').tierLimits };
}
test('native-disabled membership shows all plans, free continuation, accurate limits, accessible locks', () => {
  const { html, limits } = renderPlans(true);
  assert.match(html, /Choose Your OnlyFast Plan/);
  assert.match(html, /Start racing for free, or unlock more features with Pro and Teams/);
  for (const plan of ['Rookie', 'Pro', 'Teams']) assert.match(html, new RegExp('>' + plan + '<'));
  assert.doesNotMatch(html.match(/<button[^>]*>Continue Free<\/button>/)?.[0] || 'missing', /\sdisabled(?:=|>)/);
  assert.match(html, />Continue Free<\/button>/);
  assert.equal((html.match(/<button[^>]*disabled[^>]*>Coming Soon<\/button>/g) || []).length, 2);
  assert.match(html, /Free Forever/); assert.doesNotMatch(html, /trial/i);
  assert.match(html, /role="table" aria-label="OnlyFast membership features"/);
  assert.match(html, /Locked/); assert.match(html, /Included/);
  assert.equal(limits.rookie.setupAssistsPerRaceWeekend, 1);
  assert.match(html, /1 \/ weekend/);
  assert.equal(limits.rookie.maxRaceWeekendSetups, 2);
  assert.equal(limits.pro.maxCars, 1); assert.equal(limits.team.maxCars, 'unlimited');
});
test('web membership retains separate Pro and Teams checkout choices', () => {
  const { html } = renderPlans(false);
  assert.match(html, /Choose Pro/); assert.match(html, /Choose Teams/);
  assert.doesNotMatch(html, /Coming Soon/);
});
