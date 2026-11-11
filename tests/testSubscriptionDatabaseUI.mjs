// Actual client/selector/Header/Settings against the disposable PostgreSQL RPCs.
// Only the HTTP/Auth transport and unrelated UI widgets are substituted.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { create, act } from 'react-test-renderer';
import ts from 'typescript';
import * as trusted from '../src/lib/trustedMembership.ts';

const require = createRequire(import.meta.url);
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
const component = value => ({ __esModule: true, default: value });

export async function verifyDatabaseSubscriptionUI(db, role, userId, normalId) {
  const names = ['window', 'document', 'localStorage', 'fetch'];
  const original = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const user = { id: userId, email: 'test@test.com', user_metadata: { nickname: 'Tester', membership_tier: 'team' } };
  let identity = userId;
  let queue = Promise.resolve();
  let requests = 0;
  const query = callback => {
    requests++;
    const caller = identity;
    const result = queue.then(async () => {
      await role(caller ? 'authenticated' : 'anon', caller);
      try { return { data: await callback(), error: null }; }
      catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
      finally { await role('postgres'); }
    });
    queue = result.then(() => {});
    return result;
  };
  const rpc = (name, args = {}) => query(async () => {
    assert.ok(['get_onlyfast_test_tier', 'set_onlyfast_test_tier'].includes(name));
    const params = Object.values(args);
    return (await db.query('select public.' + name + '(' + params.map((_, i) => '$' + (i + 1)).join(',') + ') result', params)).rows[0].result;
  });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: identity ? { user: { ...user, id: identity }, access_token: 'local-' + identity } : null } }),
      getUser: async () => ({ data: { user: identity ? { ...user, id: identity, app_metadata: {} } : null }, error: null }),
    }, rpc,
    from: name => ({ select: () => ({ eq: (key, id) => ({ maybeSingle: () => query(async () => {
      assert.equal(name, 'user_subscriptions'); assert.equal(key, 'user_id');
      return (await db.query('select * from public.user_subscriptions where user_id=$1', [id])).rows[0] || null;
    }) }) }) }),
  };
  const doc = new EventTarget(); doc.body = { style: {} };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => key === 'onlyfast_membership' ? '{"membership_tier":"team"}' : null } });
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://local.example.invalid/rest/v1/rpc/set_onlyfast_test_tier');
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer local-' + identity);
    const result = await rpc('set_onlyfast_test_tier', JSON.parse(options.body));
    return new Response(JSON.stringify(result.error || result.data), { status: result.error ? 403 : 200 });
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} }; cache.set(file, module.exports);
    const js = ts.transpileModule(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', js)(name => {
      if (name === './supabase' || name === '@/lib/supabase') return { supabase: client, supabaseUrl: 'https://local.example.invalid', supabaseKey: 'public' };
      if (name.includes('trustedMembership')) return trusted;
      if (name === '@/lib/nativeAds') return { nativeAds: { suspend: () => () => {}, canViewDiagnostics: () => false }, NATIVE_ADS_ROLLOUT_USER_ID: 'different-user' };
      if (name === '@/lib/paymentVisibility') return { hideExternalPayments: false, isMedianIOSApp: false };
      if (name === '@/hooks/useBetaFeatures') return { useBetaFeatures: () => ({ hasBetaFeature: () => true, testerKind: 'experimental', loading: false }) };
      if (name === '@/lib/setupLibrary') return { setupClassLabel: value => value };
      if (name === '@/lib/testAccount') return { resetTestAccountData: async () => false };
      if (['./SettingsModal', './AppMenu', '@/components/NativeSubscriptionControls'].includes(name)) return component(() => null);
      if (name === 'react-router-dom') return { useNavigate: () => () => {}, Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) };
      if (name === 'lucide-react') return { Check: () => null, Lock: () => null, ArrowUpRight: () => null };
      if (name.startsWith('@/lib/')) return load('lib/' + name.slice(6) + '.ts');
      if (name.startsWith('@/hooks/')) return load('hooks/' + name.slice(8) + '.ts');
      if (name.startsWith('./')) return load((file.startsWith('lib/') ? 'lib/' : 'components/') + name.slice(2) + (file.startsWith('lib/') ? '.ts' : '.tsx'));
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  const Gate = load('components/TestSubscriptionGate.tsx').default;
  const Header = load('components/Header.tsx').default;
  const Settings = load('components/SettingsModal.tsx').default;
  const subscription = load('lib/subscription.ts');
  const membership = load('lib/membership.ts');
  const ads = load('lib/ads.ts');
  let view;
  const settle = async () => {
    for (let i = 0; i < 6; i++) await act(async () => { await queue; await new Promise(resolve => setTimeout(resolve, 0)); });
  };
  const mount = async () => {
    await act(async () => { view = create(React.createElement(React.Fragment, null,
      React.createElement(Header, { user, selectedCar: '', onSignInClick() {} }),
      React.createElement(Settings, { isOpen: true, user, onClose() {} }),
      React.createElement(Gate, { userId, onContinue() {} }, 'Normal checkout'))); });
    await settle();
  };
  const assertTier = tier => {
    const label = tier === 'rookie' ? 'Rookie' : tier === 'pro' ? 'Pro' : 'Team';
    assert.match(text(view.root), new RegExp('Current test tier: ' + label));
    assert.equal(view.root.findAllByProps({ 'aria-label': 'Account type: ' + label }).length, 1, 'dashboard/header renders the saved tier');
    const settings = view.root.findByType(Settings);
    assert.match(text(settings), tier === 'rookie' ? /free Rookie plan/ : tier === 'pro' ? /Pro membership is active/ : /Teams membership is active/);
    assert.equal(trusted.getTrustedTestTier(userId), tier);
    assert.equal(membership.getEffectiveTier(membership.readMembership(user.user_metadata)), tier);
    assert.equal(ads.shouldShowAds(user), tier === 'rookie');
  };
  try {
    trusted.clearTrustedMembership(); await mount(); assertTier('team');
    for (const tier of ['rookie', 'team', 'pro', 'rookie', 'pro']) {
      const label = tier === 'rookie' ? 'Rookie' : tier === 'pro' ? 'Pro' : 'Team';
      const button = view.root.findAllByType('button').find(node => text(node).startsWith(label));
      assert.ok(button);
      await act(async () => { await button.props.onClick(); }); await settle();
      assertTier(tier);
      assert.equal((await db.query('select test_subscription_tier from public.beta_tester_accounts where user_id=$1', [userId])).rows[0].test_subscription_tier, tier);
      assert.equal((await db.query('select onlyfast_private.membership_tier($1) tier', [userId])).rows[0].tier, tier);
      // New component instance plus an empty authorization cache simulates a new tab/reload.
      await act(async () => view.unmount()); trusted.clearTrustedMembership();
      await mount(); assertTier(tier);
      identity = ''; trusted.clearTrustedMembership();
      await act(async () => view.unmount());
      identity = userId; await mount(); assertTier(tier);
    }
    // A different tab saves Rookie; the app-wide lifecycle reads it on focus.
    await rpc('set_onlyfast_test_tier', { p_tier: 'rookie' });
    await act(async () => { await subscription.syncMembershipFromSubscription(); }); await settle();
    assertTier('rookie');
    assert.ok(requests > 20, 'real database save/read paths were exercised');
    identity = normalId;
    const denied = await rpc('set_onlyfast_test_tier', { p_tier: 'team' });
    assert.match(denied.error.message, /TEST_ACCOUNT_REQUIRED/);
  } finally {
    if (view) await act(async () => view.unmount());
    await queue; await role('postgres'); trusted.clearTrustedMembership();
    for (const [name, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    }
  }
}
