import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizationMatches, mapRevenueCatSnapshot, revenueCatConfig, webhookUserIds, type SubscriberResponse } from '../supabase/functions/_shared/revenuecat.ts';
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

// Versioned native purchase coverage lives in releaseNativeBilling.test.ts.

test('default entitlements match OnlyFast and Teams wins when both are granted', () => {
  const configured = revenueCatConfig(key => key === 'REVENUECAT_SECRET_API_KEY' ? 'server-test-key' : undefined);
  assert.equal(configured.proEntitlement, 'OnlyFast Pro');
  assert.equal(configured.teamEntitlement, 'OnlyFast Teams');
  const body = subscriber('OnlyFast Pro');
  Object.assign(body.subscriber.entitlements, subscriber('OnlyFast Teams').subscriber.entitlements);
  Object.assign(body.subscriber.subscriptions, subscriber('OnlyFast Teams').subscriber.subscriptions);
  assert.equal(mapRevenueCatSnapshot(body, configured, now).plan, 'teams');
});
