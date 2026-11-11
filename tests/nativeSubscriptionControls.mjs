// Mounted UI contract tests only; never call a real store or backend.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NativePurchaseError, NativeOfferingError, NATIVE_MONTHLY_PACKAGES } from '../src/lib/nativePurchaseController.ts';
import { nativeSubscriptionManagementUrl } from '../src/lib/nativeEnvironment.ts';
const require = createRequire(process.env.REACT_TEST_RENDERER_MODULE);
const React = require('react');
const { create, act } = require(process.env.REACT_TEST_RENDERER_MODULE);
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
const free = () => ({ label: 'Free', plan: 'free', isPaid: false, isAdmin: false, row: null });
function setup(status, enabled = false, platform = 'android') {
  const f = { status, enabled, platform, storeCalls: [], syncCalls: 0, identity: 'tester', error: null, verified: 0 };
  globalThis.window = new EventTarget();
  function compile(file) {
    const code = ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
    }).outputText;
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', code)(resolve, mod, mod.exports);
    return mod.exports;
  }
  function resolve(name) {
    if (name === 'react' || name.startsWith('react/')) return require(name);
    if (name === '@/hooks/useNativeSubscription') return compile('hooks/useNativeSubscription.ts');
    if (name === '@/lib/supabase') return { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: f.identity } } } }) } } };
    if (name === '@/lib/subscription') return { syncMembershipFromSubscription: async () => f.status,
      fetchUserSubscription: async () => f.status.row, deriveAccountStatus: () => f.status };
    if (name === '@/lib/nativePurchaseController') return { NativePurchaseError, NativeOfferingError, NATIVE_MONTHLY_PACKAGES };
    if (name === '@/lib/nativeEnvironment') return { nativePlatform: () => f.platform, nativeSubscriptionManagementUrl };
    if (name === '@/lib/nativePurchases') return { nativePurchasesEnabled: enabled,
      nativePurchases: { setUser: async id => { f.storeCalls.push(['identify', id]); },
        checkOffering: async (id, identifier) => { (f.offeringCalls ||= []).push([id, identifier]); if (f.offeringError) throw f.offeringError; },
        run: async (id, action, identifier) => { f.storeCalls.push([action, id]); f.selectedPackage = identifier; if (f.error) throw f.error; } },
      syncNativeSubscription: async () => { f.syncCalls++; if (f.syncError) throw f.syncError; if (f.syncStatus) f.status = f.syncStatus; } };
    throw Error('Unexpected dependency ' + name);
  }
  return { f, Component: compile('components/NativeSubscriptionControls.tsx').default };
}
const paid = (store, plan = 'pro') => ({ label: plan === 'teams' ? 'Teams' : 'Pro', plan, isPaid: true, isAdmin: false,
  row: { plan, status: 'active', subscription_source: store === 'stripe' ? 'stripe' : 'revenuecat', revenuecat_store: store,
    revenuecat_expires_at: new Date(Date.now() + 60000).toISOString() } });
async function mount(Component, f, props = {}) { let view; await act(async () => { view = create(React.createElement(Component, { userId: 'tester', onVerified: () => { f.verified++; }, ...props })); }); return view; }
async function click(view, label) { const button = view.root.findAllByType('button').find(b => text(b) === label); assert.ok(button); await act(async () => { await button.props.onClick(); }); }

for (const platform of ['android', 'ios', null]) for (const store of ['app_store', 'play_store']) {
  test(`${platform || 'unknown'} device management ignores the ${store} entitlement, including on paid cards`, async () => {
    const { f, Component } = setup(paid(store), false, platform);
    const view = await mount(Component, f, { purchaseOnly: true, planTier: 'team' });
    try {
      const links = view.root.findAllByType('a');
      if (platform) {
        assert.equal(links.length, 1);
        assert.equal(links[0].props.href, nativeSubscriptionManagementUrl(platform));
        assert.equal(links[0].props['data-plan-action'], true);
      } else {
        assert.equal(links.length, 0);
        assert.match(text(view.root), /Could not identify this device/);
      }
      assert.deepEqual(f.storeCalls, []);
      assert.equal(f.syncCalls, 0);
      assert.deepEqual(f.offeringCalls || [], []);
    } finally { await act(async () => view.unmount()); }
  });
}

for (const tier of ['pro', 'team']) test(`plan card ${tier} checks its product, retries failures and opens the stock paywall`, async () => {
  const { f, Component } = setup(free(), true);
  f.offeringError = Error('Store plans could not be loaded. Please retry.');
  const label = `View ${tier === 'team' ? 'Teams' : 'Pro'} store price`;
  const view = await mount(Component, f, { purchaseOnly: true, planTier: tier, purchaseLabel: label });
  try {
    assert.match(text(view.root), /Store plans could not be loaded/);
    assert.equal(view.root.findAllByType('button').find(b => b.props['data-plan-action']).props.disabled, true);
    f.offeringError = null;
    await click(view, 'Retry loading plans');
    const button = view.root.findAllByType('button').find(b => text(b) === label);
    assert.equal(button.props.disabled, false);
    assert.equal(button.props['data-plan-action'], true);
    await click(view, label);
    assert.equal(f.selectedPackage, NATIVE_MONTHLY_PACKAGES[tier]);
    assert.equal(f.storeCalls.filter(c => c[0] === 'purchase').length, 1);
    assert.equal(f.syncCalls, 1);
    assert.equal(f.verified, 0, 'Opening/completing a paywall alone cannot grant access');
  } finally { await act(async () => view.unmount()); }
});

for (const platform of ['android', 'ios']) for (const tier of ['rookie', 'pro', 'team']) test(`Median ${platform} ${tier} test override never loads offerings, purchases, restores, or syncs RevenueCat`, async () => {
  const status = { ...free(), testTier: tier, isPaid: tier !== 'rookie',
    label: tier === 'team' ? 'Teams' : tier === 'pro' ? 'Pro' : 'Free' };
  for (const onboardingTier of [undefined, 'pro', 'team']) {
    const { f, Component } = setup(status, true, platform);
    const view = await mount(Component, f, { onboardingTier });
    try {
      assert.match(text(view.root), /Current test tier/);
      assert.equal(view.root.findByType('a').props.href, '/pricing');
      assert.equal(view.root.findAllByType('button').length, 0);
      assert.deepEqual(f.storeCalls, []);
      assert.deepEqual(f.offeringCalls || [], []);
      assert.equal(f.syncCalls, 0);
    } finally { await act(async () => view.unmount()); }
  }
});

for (const status of [free(), paid('stripe'), paid('play_store'), paid('app_store', 'teams')]) {
  test(`purchase hold preserves ${status.label}/${status.row?.revenuecat_store || 'free'} display, management and refresh without native calls`, async () => {
    const { f, Component } = setup(status); const view = await mount(Component, f);
    try {
      assert.match(text(view.root), new RegExp('Current plan: ' + (status.label === 'Free' ? 'Rookie' : status.label)));
      const restore = view.root.findAllByType('button').find(b => text(b) === 'Restore Purchases');
      assert.equal(restore.props.disabled, true);
      await click(view, 'Refresh subscription');
      assert.deepEqual(f.storeCalls, []);
      assert.equal(f.syncCalls, status.row?.subscription_source === 'revenuecat' ? 1 : 0);
      if (status.row?.subscription_source === 'revenuecat') {
        assert.equal(view.root.findByType('a').props.href, 'https://play.google.com/store/account/subscriptions');
      }
    } finally { await act(async () => view.unmount()); }
  });
}
test('failed store synchronization keeps Rookie and displays the error without granting access', async () => {
  const { f, Component } = setup({ ...free(), row: { subscription_source: 'revenuecat', status: 'expired', plan: 'free' } });
  f.syncError = Error('Offline: access cannot be confirmed yet.');
  const view = await mount(Component, f);
  try { await click(view, 'Refresh subscription'); assert.match(text(view.root), /Current plan: Rookie/); assert.match(text(view.root), /Offline/); assert.equal(f.verified, 0); }
  finally { await act(async () => view.unmount()); }
});
test('restore completion alone cannot unlock content, while pending/cancellation remain non-success outcomes', async () => {
  for (const error of [null, new NativePurchaseError('Purchase cancelled.', true), new NativePurchaseError('Payment pending; server confirmation required.', false, true)]) {
    const { f, Component } = setup(free(), true); f.error = error;
    const view = await mount(Component, f);
    try {
      await click(view, 'Restore Purchases');
      assert.equal(f.verified, 0); assert.match(text(view.root), /Current plan: Rookie/);
      if (error) assert.match(text(view.root), new RegExp(error.pending ? 'pending' : 'cancelled'));
    } finally { await act(async () => view.unmount()); }
  }
});

test('paywall success refreshes the server but cannot itself grant Pro or Teams', async () => {
  for (const serverStatus of [free(), paid('play_store'), paid('app_store', 'teams')]) {
    const { f, Component } = setup(free(), true);
    f.syncStatus = serverStatus;
    const view = await mount(Component, f);
    try {
      await click(view, 'View Pro and Teams subscriptions');
      assert.deepEqual(f.storeCalls, [['identify', 'tester'], ['purchase', 'tester']]);
      assert.equal(f.syncCalls, 1);
      assert.equal(f.verified, serverStatus.isPaid ? 1 : 0);
      assert.match(text(view.root), new RegExp('Current plan: ' + (serverStatus.isPaid ? serverStatus.label : 'Rookie')));
    } finally { await act(async () => view.unmount()); }
  }
});

test('canceled, pending and failed paywalls do not confirm or synchronize a purchase', async () => {
  for (const error of [new NativePurchaseError('Purchase cancelled.', true),
    new NativePurchaseError('Payment pending; server confirmation required.', false, true), Error('Store offline')]) {
    const { f, Component } = setup(free(), true); f.error = error;
    const view = await mount(Component, f);
    try {
      await click(view, 'View Pro and Teams subscriptions');
      assert.equal(f.syncCalls, 0); assert.equal(f.verified, 0);
      assert.match(text(view.root), /Current plan: Rookie/);
      assert.match(text(view.root), new RegExp(error.message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    } finally { await act(async () => view.unmount()); }
  }
});

test('an existing paid account cannot open another paywall even when activation is mocked on', async () => {
  const { f, Component } = setup(free(), true);
  const view = await mount(Component, f);
  try {
    // The provider becomes active after the initial screen load. The action must
    // recheck authoritative membership before invoking any native billing method.
    f.status = paid('stripe');
    await click(view, 'View Pro and Teams subscriptions');
    assert.deepEqual(f.storeCalls, []); assert.equal(f.syncCalls, 0);
    assert.match(text(view.root), /paid membership is already active/);
  } finally { await act(async () => view.unmount()); }
});

for (const tier of ['pro', 'team']) {
  test(`onboarding ${tier}: offering check, stock paywall and server-confirmed completion`, async () => {
    const { f, Component } = setup(free(), true);
    f.syncStatus = paid(tier === 'pro' ? 'play_store' : 'app_store', tier === 'pro' ? 'pro' : 'teams');
    const label = `Choose ${tier === 'pro' ? 'Pro' : 'Teams'}`;
    const view = await mount(Component, f, { onboardingTier: tier, purchaseLabel: label });
    try {
      assert.doesNotMatch(text(view.root), /Coming Soon/);
      assert.deepEqual(f.offeringCalls, [['tester', NATIVE_MONTHLY_PACKAGES[tier]]]);
      const button = view.root.findAllByType('button').find(b => text(b) === label);
      assert.equal(button.props.disabled, false);
      await click(view, label);
      assert.equal(f.selectedPackage, NATIVE_MONTHLY_PACKAGES[tier]);
      assert.equal(f.verified, 1); assert.equal(f.syncCalls, 1);
    } finally { await act(async () => view.unmount()); }
  });
}

test('onboarding missing offering disables checkout, retry loads it, and restore stays available', async () => {
  const { f, Component } = setup(free(), true); f.offeringError = Error('Monthly product unavailable');
  const view = await mount(Component, f, { onboardingTier: 'team', purchaseLabel: 'Choose Teams' });
  try {
    assert.match(text(view.root), /Monthly product unavailable/);
    assert.equal(view.root.findAllByType('button').find(b => text(b) === 'Subscription unavailable').props.disabled, true);
    assert.equal(f.storeCalls.filter(c => c[0] === 'purchase').length, 0);
    f.offeringError = null;
    await click(view, 'Retry loading plans');
    assert.equal(view.root.findAllByType('button').find(b => text(b) === 'Choose Teams').props.disabled, false);
    f.syncStatus = paid('app_store', 'teams');
    await click(view, 'Restore Purchases');
    assert.equal(f.verified, 1); assert.equal(f.syncCalls, 1);
  } finally { await act(async () => view.unmount()); }
});

test('onboarding paid continuation rechecks access without store calls, including when purchases are held', async () => {
  for (const status of [paid('stripe'), paid('play_store'), paid('app_store', 'teams')]) {
    const { f, Component } = setup(status, false);
    const view = await mount(Component, f, { onboardingTier: 'pro' });
    try {
      await click(view, 'Continue with current membership');
      assert.equal(f.verified, 1); assert.deepEqual(f.storeCalls, []); assert.equal(f.syncCalls, 0);
    } finally { await act(async () => view.unmount()); }
  }
});

test('onboarding expired or switched account cannot use a stale paid continue button', async () => {
  for (const switchAccount of [false, true]) {
    const { f, Component } = setup(paid('app_store'), true);
    const view = await mount(Component, f, { onboardingTier: 'pro' });
    try {
      if (switchAccount) f.identity = 'someone-else'; else f.status = free();
      await click(view, 'Continue with current membership');
      assert.equal(f.verified, 0); assert.deepEqual(f.storeCalls.filter(c => c[0] === 'purchase'), []);
      assert.match(text(view.root), switchAccount ? /account changed/ : /No active paid membership/);
    } finally { await act(async () => view.unmount()); }
  }
});

test('onboarding canceled, pending, failed and unconfirmed purchases preserve the plan step', async () => {
  for (const error of [new NativePurchaseError('Purchase cancelled.', true), new NativePurchaseError('Payment pending', false, true), Error('Store offline'), null]) {
    const { f, Component } = setup(free(), true); f.error = error;
    const view = await mount(Component, f, { onboardingTier: 'pro', purchaseLabel: 'Choose Pro' });
    try {
      await click(view, 'Choose Pro');
      assert.equal(f.verified, 0);
      assert.equal(view.root.findAllByType('button').find(b => text(b) === 'Choose Pro').props.disabled, false);
      assert.match(text(view.root), error ? /cancelled|pending|offline/ : /No active subscription is confirmed/);
      f.error = null; f.syncStatus = paid('play_store');
      await click(view, 'Refresh subscription');
      assert.equal(f.verified, 1, 'Delayed verified access can complete without another purchase');
      assert.equal(f.storeCalls.filter(c => c[0] === 'purchase').length, 1);
    } finally { await act(async () => view.unmount()); }
  }
});

test('onboarding completion failure remains retryable without charging again', async () => {
  const { f, Component } = setup(free(), true); f.syncStatus = paid('app_store');
  let fail = true;
  const view = await mount(Component, f, { onboardingTier: 'pro', purchaseLabel: 'Choose Pro', onVerified: async () => { if (fail) throw Error('Profile save failed'); f.verified++; } });
  try {
    await click(view, 'Choose Pro'); assert.match(text(view.root), /Profile save failed/);
    fail = false;
    await click(view, 'Continue with current membership');
    assert.equal(f.verified, 1); assert.equal(f.storeCalls.filter(c => c[0] === 'purchase').length, 1);
  } finally { await act(async () => view.unmount()); }
});

test('a product withdrawn after initial loading disables checkout until offerings are retried', async () => {
  const { f, Component } = setup(free(), true);
  const view = await mount(Component, f, { onboardingTier: 'pro', purchaseLabel: 'Choose Pro' });
  try {
    f.error = new NativeOfferingError('Monthly plan was withdrawn. Retry loading plans.');
    await click(view, 'Choose Pro');
    assert.equal(f.verified, 0);
    assert.equal(view.root.findAllByType('button').find(b => text(b) === 'Subscription unavailable').props.disabled, true);
    f.error = null;
    await click(view, 'Retry loading plans');
    assert.equal(view.root.findAllByType('button').find(b => text(b) === 'Choose Pro').props.disabled, false);
  } finally { await act(async () => view.unmount()); }
});
