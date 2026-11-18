import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mapRevenueCat2027, registryProduct, type RegistryProduct } from '../supabase/functions/_shared/subscription-catalog-2027.ts';
import { sandboxTrialFixture2027 } from './helpers/revenuecatSandbox2027.ts';

// Real audited catalog identifiers; all subscriber bodies below are synthetic.
const plan = JSON.parse(readFileSync(new URL('../supabase/testing-2027/phase3d-revenuecat-products.plan.json', import.meta.url), 'utf8'));
const now = Date.parse('2027-01-02T08:00:00Z'), day = 86400000;
const rows: RegistryProduct[] = plan.plans.flatMap((p: any) => p.products.map((s: any) => ({
  id: s.revenuecat_id, provider: 'revenuecat', environment: 'sandbox', app_id: s.app_id,
  store: s.store, product_id: s.product_id, base_plan: s.base_plan, interval: p.interval,
  tier: p.tier, entitlement: p.entitlement, legacy: false, enabled: true,
  intro_days: p.intro_days, duration_verified: true,
})));
function snapshot(p: RegistryProduct, trial = false, overrides: Record<string, unknown> = {}) {
  const end = new Date(now + (trial ? 14 : p.interval === 'year' ? 365 : 30) * day).toISOString();
  return { request_date_ms: now, subscriber: {
    entitlements: { [p.entitlement!]: { product_identifier: p.product_id, expires_date: end } },
    subscriptions: { [p.product_id]: { store: p.store, is_sandbox: true, period_type: trial ? 'trial' : 'normal',
      purchase_date: new Date(now).toISOString(), original_purchase_date: new Date(now).toISOString(),
      expires_date: end, ...overrides } },
  } };
}
for (const p of rows) test(`audited ${p.product_id}: access, restore, cancellation and expiry`, () => {
  assert.equal(registryProduct(rows, p).tier, p.tier);
  const body = snapshot(p), mapped = mapRevenueCat2027(body, rows, now);
  assert.equal(mapped.subscriptions[0].status, 'active');
  assert.equal(mapped.subscriptions[0].registry_id, p.id);
  assert.deepEqual(mapRevenueCat2027(body, rows, now), mapped, 'Restore never extends the verified term');
  const canceled = mapRevenueCat2027(snapshot(p, false, { unsubscribe_detected_at: new Date(now).toISOString() }), rows, now);
  assert.equal(canceled.subscriptions[0].status, 'active');
  assert.equal(canceled.subscriptions[0].will_renew, false);
  const expiry = Date.parse(mapped.subscriptions[0].expires_at);
  assert.equal(mapRevenueCat2027({ ...body, request_date_ms: expiry }, rows, expiry).subscriptions[0].status, 'expired');
  assert.throws(() => mapRevenueCat2027(snapshot(p, false, { is_sandbox: false }), rows, now), /ENVIRONMENT/);
  const missing = snapshot(p); missing.subscriber.entitlements = {};
  assert.equal(mapRevenueCat2027(missing, rows, now).subscriptions[0].status, 'expired');
});
for (const p of rows.filter(p => p.tier === 'pro')) test(`audited ${p.product_id}: synthetic eligible 14-day trial and canceled expiry`, () => {
  const fixture=sandboxTrialFixture2027(p,now,14*day),body=fixture.body;
  Object.assign(body.subscriber.subscriptions[p.product_id],{unsubscribe_detected_at:new Date(now).toISOString()});
  const active = mapRevenueCat2027(body, rows, now,fixture.context).subscriptions[0];
  assert.equal(active.status, 'trialing'); assert.equal(active.will_renew, false);
  assert.equal(Date.parse(active.trial_ends_at!) - now, 14 * day);
  const end = Date.parse(active.expires_at);
  assert.equal(mapRevenueCat2027({ ...body, request_date_ms: end }, rows, end,fixture.context).subscriptions[0].status, 'expired');
});
test('Sportsman requires its distinct entitlement; wrong base plan and uninstalled IDs fail closed', () => {
  for (const p of rows.filter(p => p.tier === 'sportsman')) {
    const body = snapshot(p); body.subscriber.entitlements = { 'OnlyFast Pro': { product_identifier: p.product_id, expires_date: new Date(now + day).toISOString() } };
    assert.equal(mapRevenueCat2027(body, rows, now).subscriptions[0].status, 'expired');
    assert.throws(() => registryProduct([{ ...p, entitlement: 'OnlyFast Pro' }], p), /UNVERIFIED/);
    assert.throws(() => mapRevenueCat2027(snapshot(p), [], now), /UNKNOWN/);
  }
  const google = rows.find(p => p.store === 'play_store')!;
  assert.throws(() => registryProduct(rows, { ...google, base_plan: 'unapproved' }), /UNKNOWN/);
});
test('accelerated Pro trial without authenticated provider evidence remains denied', () => {
  const p = rows.find(p => p.tier === 'pro')!;
  assert.throws(() => mapRevenueCat2027(snapshot(p, true, { expires_date: new Date(now + 5 * 60000).toISOString() }), rows, now), /SANDBOX_TRIAL/);
});
