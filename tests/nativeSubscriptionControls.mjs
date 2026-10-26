// Mounted UI contract tests only; never call a real store or backend.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NativePurchaseError } from '../src/lib/nativePurchaseController.ts';
const require = createRequire(process.env.REACT_TEST_RENDERER_MODULE);
const React = require('react');
const { create, act } = require(process.env.REACT_TEST_RENDERER_MODULE);
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
const free = () => ({ label: 'Free', plan: 'free', isPaid: false, isAdmin: false, row: null });
function setup(status, enabled = false) {
  const f = { status, enabled, storeCalls: [], syncCalls: 0, identity: 'tester', error: null, verified: 0 };
  globalThis.window = new EventTarget();
  const code = ts.transpileModule(readFileSync(new URL('../src/components/NativeSubscriptionControls.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react' || name.startsWith('react/')) return require(name);
    if (name === '@/lib/supabase') return { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: f.identity } } } }) } } };
    if (name === '@/lib/subscription') return { syncMembershipFromSubscription: async () => f.status,
      fetchUserSubscription: async () => f.status.row, deriveAccountStatus: () => f.status };
    if (name === '@/lib/nativePurchaseController') return { NativePurchaseError };
    if (name === '@/lib/nativePurchases') return { nativePurchasesEnabled: enabled,
      nativePurchases: { setUser: async id => { f.storeCalls.push(['identify', id]); }, run: async (id, action) => { f.storeCalls.push([action, id]); if (f.error) throw f.error; } },
      syncNativeSubscription: async () => { f.syncCalls++; if (f.syncError) throw f.syncError; if (f.syncStatus) f.status = f.syncStatus; } };
    throw Error('Unexpected dependency ' + name);
  }, mod, mod.exports);
  return { f, Component: mod.exports.default };
}
const paid = (store, plan = 'pro') => ({ label: plan === 'teams' ? 'Teams' : 'Pro', plan, isPaid: true, isAdmin: false,
  row: { plan, status: 'active', subscription_source: store === 'stripe' ? 'stripe' : 'revenuecat', revenuecat_store: store,
    revenuecat_expires_at: new Date(Date.now() + 60000).toISOString() } });
async function mount(Component, f) { let view; await act(async () => { view = create(React.createElement(Component, { userId: 'tester', onVerified: () => { f.verified++; } })); }); return view; }
async function click(view, label) { const button = view.root.findAllByType('button').find(b => text(b) === label); assert.ok(button); await act(async () => { await button.props.onClick(); }); }

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
        assert.equal(view.root.findByType('a').props.href, status.row.revenuecat_store === 'app_store'
          ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
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
