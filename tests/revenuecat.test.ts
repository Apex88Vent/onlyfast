import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizationMatches, mapRevenueCatSnapshot, revenueCatConfig, webhookUserIds, type SubscriberResponse } from '../supabase/functions/_shared/revenuecat.ts';
import { NativePurchaseController, NativePurchaseError, type RevenueCatBridge } from '../src/lib/nativePurchaseController.ts';
import { isMedianUserAgent, nativePlatform } from '../src/lib/nativeEnvironment.ts';

const config = { apiKey: 'server-test-key', proEntitlement: 'pro', teamEntitlement: 'team', allowSandbox: false };
const now = Date.parse('2026-09-24T12:00:00Z');
function subscriber(plan = 'pro', changes = {}): SubscriberResponse {
  return { request_date_ms: now, subscriber: {
    entitlements: { [plan]: { product_identifier: plan + '_monthly', expires_date: '2026-10-24T12:00:00Z' } },
    subscriptions: { [plan + '_monthly']: { store: 'app_store', is_sandbox: false, expires_date: '2026-10-24T12:00:00Z', ...changes } },
  } };
}

test('native detection recognizes Median/GoNative and keeps ordinary browsers on web', () => {
  for (const ua of ['MedianIOS/1.0 median', 'GoNativeIOS/1.0 gonative']) {
    assert.equal(isMedianUserAgent(ua), true); assert.equal(nativePlatform(ua), 'ios');
  }
  assert.equal(nativePlatform('MedianAndroid/1.0 median'), 'android');
  assert.equal(isMedianUserAgent('Mozilla/5.0 iPhone Safari'), false);
  assert.equal(isMedianUserAgent('Chrome desktop'), false);
  assert.equal(nativePlatform('Chrome desktop'), null);
});
test('Pro and Team map to the existing plan vocabulary', () => {
  assert.equal(mapRevenueCatSnapshot(subscriber(), config, now).plan, 'pro');
  assert.equal(mapRevenueCatSnapshot(subscriber('team'), config, now).plan, 'teams');
});
test('cancellation and billing issue preserve access until expiration or grace ends', () => {
  for (const changes of [{ unsubscribe_detected_at: '2026-09-23' }, { billing_issues_detected_at: '2026-09-23' }]) {
    assert.equal(mapRevenueCatSnapshot(subscriber('pro', changes), config, now).status, 'active');
  }
  const body = subscriber();
  body.subscriber.entitlements.pro.expires_date = '2026-09-23T12:00:00Z';
  body.subscriber.subscriptions.pro_monthly.grace_period_expires_date = '2026-09-25T12:00:00Z';
  assert.equal(mapRevenueCatSnapshot(body, config, now).status, 'active');
  assert.equal(mapRevenueCatSnapshot(body, config, now + 2 * 86400000).status, 'expired');
});
test('expiration, refund, and missing entitlement cannot grant paid access', () => {
  assert.equal(mapRevenueCatSnapshot(subscriber(), config, now + 40 * 86400000).plan, 'free');
  assert.equal(mapRevenueCatSnapshot(subscriber('pro', { refunded_at: '2026-09-24' }), config, now).plan, 'free');
  assert.equal(mapRevenueCatSnapshot({ request_date_ms: now, subscriber: { entitlements: {}, subscriptions: {} } }, config, now).plan, 'free');
});
test('sandbox and non-native stores are excluded from production access', () => {
  assert.equal(mapRevenueCatSnapshot(subscriber('pro', { is_sandbox: true }), config, now).plan, 'free');
  assert.equal(mapRevenueCatSnapshot(subscriber('pro', { is_sandbox: true }), { ...config, allowSandbox: true }, now).plan, 'pro');
  assert.equal(mapRevenueCatSnapshot(subscriber('pro', { store: 'stripe' }), config, now).plan, 'free');
});
test('malformed responses fail without producing a downgrade snapshot', () => {
  assert.throws(() => mapRevenueCatSnapshot({} as SubscriberResponse, config, now));
  for (const field of ['entitlements', 'subscriptions']) {
    const malformed = subscriber();
    Object.assign(malformed.subscriber, { [field]: [] });
    assert.throws(() => mapRevenueCatSnapshot(malformed, config, now));
  }
  for (const timestamp of [-1, now + 300_001, 1.5]) {
    assert.throws(() => mapRevenueCatSnapshot({ ...subscriber(), request_date_ms: timestamp }, config, now));
  }
  const body = subscriber(); body.subscriber.entitlements.pro.expires_date = 'bad-date';
  assert.throws(() => mapRevenueCatSnapshot(body, config, now));
});

test('7-day store trials grant access without a payment; Android base-plan IDs use entitlements', () => {
  const trial = subscriber('team', { store: 'play_store', period_type: 'trial' });
  trial.subscriber.entitlements.team.product_identifier = 'teams:teams';
  trial.subscriber.entitlements.team.expires_date = new Date(now + 7 * 86400000).toISOString();
  trial.subscriber.subscriptions['teams:teams'] = { ...trial.subscriber.subscriptions.team_monthly,
    expires_date: trial.subscriber.entitlements.team.expires_date };
  assert.equal(mapRevenueCatSnapshot(trial, config, now).plan, 'teams');
  assert.equal(mapRevenueCatSnapshot(trial, config, now + 7 * 86400000).plan, 'free');
});
test('Team wins over Pro, expired Team falls back to active Pro', () => {
  const body = subscriber(); const team = subscriber('team');
  Object.assign(body.subscriber.entitlements, team.subscriber.entitlements);
  Object.assign(body.subscriber.subscriptions, team.subscriber.subscriptions);
  assert.equal(mapRevenueCatSnapshot(body, config, now).plan, 'teams');
  body.subscriber.entitlements.team.expires_date = '2026-09-23T12:00:00Z';
  assert.equal(mapRevenueCatSnapshot(body, config, now).plan, 'pro');
});
test('webhook identity uses UUIDs and reconciles both sides of transfers', () => {
  const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.deepEqual(webhookUserIds({ app_user_id: '$RCAnonymousID:test', aliases: [a, a] }), [a]);
  assert.deepEqual(webhookUserIds({ type: 'TRANSFER', transferred_from: [a], transferred_to: [b] }), [a, b]);
  assert.throws(() => webhookUserIds({ app_user_id: a, aliases: [b] }));
});
test('webhook authorization rejects missing and incorrect secrets', () => {
  assert.equal(authorizationMatches('', ''), false);
  assert.equal(authorizationMatches('Bearer wrong', 'Bearer right'), false);
  assert.equal(authorizationMatches('Bearer right', 'Bearer right'), true);
});

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function harness() {
  const calls: string[] = [];
  const bridge: RevenueCatBridge = {
    async isInitialized() { return { initialized: true, apiKey: 'appl_test' }; },
    async configure({ appUserID }) { calls.push('configure:' + appUserID); return { success: true }; },
    async login({ appUserID }) { calls.push('login:' + appUserID); return { success: true }; },
    async logout() { calls.push('logout'); return { success: true }; },
    async presentPaywall() { calls.push('paywall'); return { success: true }; },
    async restorePurchases() { calls.push('restore'); return { success: true }; },
  };
  const controller = new NativePurchaseController(async () => bridge, () => 'appl_test');
  return { calls, bridge, controller };
}
test('purchase and restore always identify the authenticated account first', async () => {
  const { calls, controller } = harness();
  await assert.rejects(controller.run(A, 'purchase'), /account changed/);
  await controller.setUser(A); await controller.run(A, 'purchase'); await controller.run(A, 'restore');
  assert.deepEqual(calls, ['login:' + A, 'login:' + A, 'paywall', 'login:' + A, 'restore']);
});
test('app restart logs into the current UUID even if the SDK was already initialized', async () => {
  const { controller, calls } = harness(); await controller.setUser(A);
  assert.deepEqual(calls, ['login:' + A]);
});
test('first launch configures the SDK with the Supabase UUID', async () => {
  const { controller, bridge, calls } = harness();
  bridge.isInitialized = async () => ({ initialized: false });
  await controller.setUser(A); assert.deepEqual(calls, ['configure:' + A]);
});
test('logout and switching accounts clear the previous identity before the next purchase', async () => {
  const { controller, calls } = harness();
  await controller.setUser(A); await controller.setUser(null); await controller.setUser(B);
  await assert.rejects(controller.run(A, 'purchase'));
  await controller.run(B, 'restore');
  assert.deepEqual(calls, ['login:' + A, 'logout', 'login:' + B, 'login:' + B, 'restore']);
});
test('a purchase response after account switching is discarded', async () => {
  const { controller, bridge } = harness();
  let finish!: (value: { success: boolean }) => void;
  let opened!: () => void;
  const started = new Promise<void>(resolve => { opened = resolve; });
  bridge.presentPaywall = () => { opened(); return new Promise(resolve => { finish = resolve; }); };
  await controller.setUser(A);
  const purchase = controller.run(A, 'purchase');
  await started;
  const switched = controller.setUser(B);
  finish({ success: true });
  await assert.rejects(purchase, /account changed/); await switched;
});
test('cancellation is separate from purchase failure and neither succeeds', async () => {
  const { controller, bridge } = harness(); await controller.setUser(A);
  bridge.presentPaywall = async () => ({ success: false, error: { code: 'PURCHASE_CANCELLED' } });
  await assert.rejects(controller.run(A, 'purchase'), error => error instanceof NativePurchaseError && error.cancelled);
  bridge.presentPaywall = async () => ({ success: false, error: { code: 'STORE_PROBLEM', message: 'Store unavailable' } });
  await assert.rejects(controller.run(A, 'purchase'), /Store unavailable/);
});
test('identity failures prevent paywall and restore calls', async () => {
  const { controller, bridge, calls } = harness();
  bridge.login = async () => ({ success: false, error: { message: 'Login failed' } });
  await assert.rejects(controller.setUser(A), /Login failed/);
  await assert.rejects(controller.run(A, 'purchase'), /Login failed/);
  await assert.rejects(controller.run(A, 'restore'), /Login failed/);
  assert.deepEqual(calls, []);
});

test('Median rejected response objects retain cancellation and useful error messages', async () => {
  const { controller, bridge } = harness(); await controller.setUser(A);
  bridge.presentPaywall = async () => { throw { success: false, error: { code: '1', message: 'Cancelled by user' } }; };
  await assert.rejects(controller.run(A, 'purchase'), error => error instanceof NativePurchaseError && error.cancelled);
  bridge.restorePurchases = async () => { throw { success: false, error: { code: 'STORE_ERROR', message: 'Store unavailable' } }; };
  await assert.rejects(controller.run(A, 'restore'), /Store unavailable/);
});

test('absent feature flag blocks purchases and restore before any bridge call', async () => {
  let calls = 0;
  const controller = new NativePurchaseController(async () => { calls++; throw new Error('Must not reach bridge'); }, () => 'public-key', () => false);
  await assert.rejects(controller.run('a', 'purchase'), /coming soon/);
  await assert.rejects(controller.run('a', 'restore'), /coming soon/);
  assert.equal(calls, 0);
});

test('store-pending purchases remain pending and never resolve as confirmed access', async () => {
  const { controller, bridge } = harness(); await controller.setUser(A);
  bridge.presentPaywall = async () => ({ success: false, error: { code: 20 } });
  await assert.rejects(controller.run(A, 'purchase'), error => error instanceof NativePurchaseError && error.pending && !error.cancelled && /server confirmation/.test(error.message));
});

test('the stock paywall owns product lookup and selection, with no custom catalog or purchase call', async () => {
  const { controller, bridge, calls } = harness();
  bridge.presentPaywall = async (...args) => {
    assert.equal(args.length, 0, 'no undocumented offering or product arguments');
    calls.push('paywall'); return { success: true };
  };
  await controller.setUser(A); await controller.run(A, 'purchase');
  assert.deepEqual(calls, ['login:' + A, 'login:' + A, 'paywall']);
});

test('Median message-only paywall dismissal is cancellation, including rejected callbacks', async () => {
  const { controller, bridge } = harness(); await controller.setUser(A);
  bridge.presentPaywall = async () => ({ success: false, error: { message: 'User cancelled' } });
  await assert.rejects(controller.run(A, 'purchase'), error => error instanceof NativePurchaseError && error.cancelled);
  bridge.presentPaywall = async () => { throw { success: false, error: { message: 'User cancelled' } }; };
  await assert.rejects(controller.run(A, 'purchase'), error => error instanceof NativePurchaseError && error.cancelled);
});

test('missing and anonymous identities cannot initialize or purchase', async () => {
  for (const id of ['', '$RCAnonymousID:synthetic', 'display-name']) {
    let calls = 0;
    const controller = new NativePurchaseController(async () => { calls++; throw Error('Must not reach bridge'); }, () => 'public-key');
    await assert.rejects(controller.setUser(id), /signed-in OnlyFast/);
    await assert.rejects(controller.run(id, 'purchase'), /signed-in OnlyFast/);
    assert.equal(calls, 0);
  }
});

test('A to B to A cannot accept an earlier paywall completion', async () => {
  const { controller, bridge } = harness();
  let finish!: (value: { success: boolean }) => void;
  let opened!: () => void;
  const started = new Promise<void>(resolve => { opened = resolve; });
  bridge.presentPaywall = () => { opened(); return new Promise(resolve => { finish = resolve; }); };
  await controller.setUser(A);
  const purchase = controller.run(A, 'purchase');
  await started;
  const b = controller.setUser(B); const a = controller.setUser(A);
  finish({ success: true });
  await assert.rejects(purchase, /account changed/);
  await Promise.all([b, a]);
});

test('default entitlements match OnlyFast and Teams wins when both are granted', () => {
  const configured = revenueCatConfig(key => key === 'REVENUECAT_SECRET_API_KEY' ? 'server-test-key' : undefined);
  assert.equal(configured.proEntitlement, 'OnlyFast Pro');
  assert.equal(configured.teamEntitlement, 'OnlyFast Teams');
  const body = subscriber('OnlyFast Pro');
  Object.assign(body.subscriber.entitlements, subscriber('OnlyFast Teams').subscriber.entitlements);
  Object.assign(body.subscriber.subscriptions, subscriber('OnlyFast Teams').subscriber.subscriptions);
  assert.equal(mapRevenueCatSnapshot(body, configured, now).plan, 'teams');
});
