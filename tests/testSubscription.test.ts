import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { create, act } from 'react-test-renderer';
import ts from 'typescript';
import * as trusted from '../src/lib/trustedMembership.ts';

const require = createRequire(import.meta.url);
const text = (node: any): string => typeof node === 'string' ? node : (node.children || []).map(text).join('');
function fixture() {
  const state = { id: 'tester', allowed: true, selected: 'team', writes: [] as any[], events: 0,
    rpcError: false as boolean | { code: string; message: string }, readGate: null as Promise<void> | null };
  const row = { user_id: 'tester', plan: 'teams', status: 'active', subscription_source: 'revenuecat', revenuecat_expires_at: '2035-01-01' };
  const client = { auth: {
    getSession: async () => ({ data: { session: state.id ? { user: { id: state.id }, access_token: 'jwt-' + state.id } : null } }),
    getUser: async () => ({ data: { user: { id: state.id, app_metadata: {} } }, error: null }),
  }, from: () => ({ select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: async () => ({ data: { ...row, user_id: id }, error: null }) }) }) }),
    rpc: async (name: string) => {
      assert.equal(name, 'get_onlyfast_test_tier', 'only a read of own test authorization is made');
      const data = state.allowed ? state.selected : null;
      const gate = state.readGate; state.readGate = null;
      if (gate) await gate;
      return { data, error: typeof state.rpcError === 'object' ? state.rpcError : state.rpcError ? new Error('unavailable') : null };
    } };
  const cache = new Map<string, any>();
  function load(file: string): any {
    if (cache.has(file)) return cache.get(file);
    const js = ts.transpileModule(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    cache.set(file, module.exports);
    new Function('require', 'module', 'exports', js)((name: string) => {
      if (name === './supabase' || name === '@/lib/supabase') return { supabase: client, supabaseUrl: 'https://local.example.invalid', supabaseKey: 'public-key' };
      if (name.includes('trustedMembership')) return trusted;
      if (name.startsWith('@/hooks/')) return load('hooks/' + name.slice('@/hooks/'.length) + '.ts');
      if (name.startsWith('@/lib/')) return load('lib/' + name.slice('@/lib/'.length) + '.ts');
      if (name.startsWith('./')) return load((file.startsWith('lib/') ? 'lib/' : 'components/') + name.slice(2) + (file.startsWith('lib/') ? '.ts' : '.tsx'));
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  globalThis.window = new EventTarget() as any;
  window.addEventListener('membership-updated', () => state.events++);
  trusted.clearTrustedMembership();
  return { state, load, row };
}

test('mounted selector switches every tier repeatedly, refreshes all gates, and persists across remount/login', async () => {
  const originalFetch = globalThis.fetch;
  const { state, load } = fixture();
  globalThis.fetch = async (_url, options) => {
    const tier = JSON.parse(String(options?.body)).p_tier;
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer jwt-tester');
    state.writes.push(tier); state.selected = tier;
    return new Response(JSON.stringify(tier));
  };
  const Gate = load('components/TestSubscriptionGate.tsx').default;
  const membership = load('lib/membership.ts');
  const subscription = load('lib/subscription.ts');
  const ads = load('lib/ads.ts');
  let view: any;
  const mount = async () => act(async () => { view = create(React.createElement(Gate, { userId: 'tester', onContinue() {} }, React.createElement('div', {}, 'Normal checkout'))); });
  try {
    await mount();
    for (const tier of ['rookie', 'pro', 'team', 'rookie', 'pro', 'team', 'rookie']) {
      const label = tier === 'rookie' ? 'Rookie' : tier === 'pro' ? 'Pro' : 'Team';
      const button = view.root.findAllByType('button').find((b: any) => text(b).startsWith(label));
      await act(async () => { await button.props.onClick(); });
      assert.match(text(view.root), new RegExp('Current test tier: ' + label));
      assert.doesNotMatch(text(view.root), /Normal checkout/);
      const access = membership.getUserAccess(membership.readMembership());
      assert.equal(access.tier, tier);
      assert.equal(access.limits.maxCars, tier === 'team' ? 'unlimited' : 1);
      assert.equal(membership.hasFeatureAccess(membership.readMembership(), 'setupExport'), tier !== 'rookie');
      assert.equal(ads.shouldShowAds({ id: 'tester' }), tier === 'rookie');
      assert.equal(subscription.deriveAccountStatus(null).testTier, tier);
    }
    assert.equal(state.writes.length, 7);
    assert.ok(state.events >= 8, 'existing live feature gates are notified');
    await act(async () => view.unmount());
    trusted.clearTrustedMembership();
    await mount();
    assert.match(text(view.root), /Current test tier: Rookie/);
    state.id = ''; trusted.clearTrustedMembership();
    assert.equal(trusted.getTrustedMembership(), null);
    await act(async () => view.unmount());
    state.id = 'tester'; await mount();
    assert.match(text(view.root), /Current test tier: Rookie/);
  } finally { await act(async () => view?.unmount()); globalThis.fetch = originalFetch; }
});

test('normal accounts keep the existing checkout and authorization failures expose no checkout', async () => {
  for (const fail of [false, true]) {
    const { state, load } = fixture(); state.allowed = false; state.rpcError = fail;
    const Gate = load('components/TestSubscriptionGate.tsx').default;
    let view: any;
    await act(async () => { view = create(React.createElement(Gate, { userId: 'tester', onContinue() {} }, React.createElement('div', {}, 'Existing checkout'))); });
    assert.equal(text(view.root).includes('Existing checkout'), !fail);
    assert.doesNotMatch(text(view.root), /Current test tier/);
    await act(async () => view.unmount());
  }
});

test('tier writes stay bound to the initiating JWT and cannot grant the next account access', async () => {
  const originalFetch = globalThis.fetch;
  const { state, load } = fixture();
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  const request = new Promise<void>(done => { started = done; });
  globalThis.fetch = async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer jwt-tester');
    started(); await gate; return new Response('"rookie"');
  };
  try {
    const promise = load('lib/testSubscription.ts').selectTestTier('tester', 'rookie');
    await request; state.id = 'normal'; trusted.clearTrustedMembership('normal'); release();
    await assert.rejects(promise, /account changed/);
    assert.equal(trusted.getTrustedMembership('normal'), null);
    await assert.rejects(load('lib/testSubscription.ts').selectTestTier('tester', 'team'), /account changed/);
  } finally { globalThis.fetch = originalFetch; }
});

test('an older in-flight read cannot overwrite a newly selected test tier', async () => {
  const { state, load } = fixture();
  let release!: () => void;
  state.readGate = new Promise<void>(done => { release = done; });
  const subscription = load('lib/subscription.ts');
  const old = subscription.syncMembershipFromSubscription();
  await new Promise(resolve => setTimeout(resolve, 0));
  state.selected = 'rookie'; subscription.invalidatePendingMembershipRefresh();
  await subscription.syncMembershipFromSubscription();
  release(); await old;
  assert.equal(trusted.getTrustedTestTier(), 'rookie');
});

test('missing test-tier migration is explicit and cannot silently retain a cached Team override', async () => {
  const { state, load } = fixture();
  const client = load('lib/subscription.ts');
  await client.syncMembershipFromSubscription();
  assert.equal(trusted.getTrustedTestTier(), 'team');
  for (const code of ['PGRST202', '42883', '42703']) {
    assert.match(client.testTierServiceError({ code }).message, /required server update has not been applied/);
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 'PGRST202' }), { status: 404 });
  try {
    await assert.rejects(load('lib/testSubscription.ts').selectTestTier('tester', 'rookie'), /required server update has not been applied/);
    assert.equal(state.selected, 'team', 'no success or optimistic Rookie when a write fails');
    state.rpcError = { code: 'PGRST202', message: 'Function not found' };
    await assert.rejects(client.syncMembershipFromSubscription(), /required server update has not been applied/);
    assert.equal(trusted.getTrustedTestTier(), null, 'an incompatible backend cannot confirm cached Team');
    const Gate = load('components/TestSubscriptionGate.tsx').default;
    let view: any;
    await act(async () => { view = create(React.createElement(Gate, { userId: 'tester', onContinue() {} }, 'Normal checkout')); });
    assert.match(text(view.root), /required server update has not been applied/);
    assert.doesNotMatch(text(view.root), /Normal checkout|Current test tier/);
    await act(async () => view.unmount());
    state.rpcError = false;
    globalThis.fetch = async () => new Response('"rookie"');
    await assert.rejects(load('lib/testSubscription.ts').selectTestTier('tester', 'rookie'), /could not be confirmed/);
    assert.equal(trusted.getTrustedTestTier(), 'team', 'a successful HTTP response cannot substitute for authoritative readback');
  } finally { globalThis.fetch = originalFetch; }
});
