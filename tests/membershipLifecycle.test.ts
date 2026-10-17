import assert from 'node:assert/strict';
import test from 'node:test';
import { watchMembershipLifecycle, type MembershipLifecycleSource } from '../src/lib/membershipLifecycle.ts';
import { clearTrustedMembership, setTrustedAuthorization, getTrustedMembership, getMembershipExpiration, notifyMembershipExpiration, getMembershipRevision } from '../src/lib/trustedMembership.ts';

const tick = () => new Promise(resolve => setTimeout(resolve, 12));
function setup(overrides: Partial<MembershipLifecycleSource> = {}) {
  const host = new EventTarget();
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let auth: (id: string | null) => void = () => {};
  const refreshed: string[] = [];
  const cleared: (string | null)[] = [];
  let unsubscribed = false;
  const stop = watchMembershipLifecycle({
    session: async () => 'user-a',
    onAuthChange: listener => { auth = listener; return () => { unsubscribed = true; }; },
    clear: id => { cleared.push(id); },
    refresh: async id => { refreshed.push(id); },
    expiresAt: () => null,
    onExpiration: () => {},
    ...overrides,
  }, host as unknown as Window, page as unknown as Document);
  return { host, page, stop, refreshed, cleared, auth: (id: string | null) => auth(id), unsubscribed: () => unsubscribed };
}

test('membership refresh works on login, resume, network recovery and subscription changes while purchasing is held', async () => {
  const f = setup();
  try {
    await tick(); assert.deepEqual(f.refreshed, ['user-a']);
    for (const event of ['focus', 'online', 'subscription-updated']) {
      f.host.dispatchEvent(new Event(event)); await tick();
    }
    f.page.dispatchEvent(new Event('visibilitychange')); await tick();
    assert.equal(f.refreshed.length, 5);
    f.page.visibilityState = 'hidden';
    f.host.dispatchEvent(new Event('focus')); await tick();
    assert.equal(f.refreshed.length, 5);
    f.auth(null); assert.equal(f.cleared.at(-1), null);
    f.host.dispatchEvent(new Event('online')); await tick();
    assert.equal(f.refreshed.length, 5);
  } finally { f.stop(); }
  f.host.dispatchEvent(new Event('focus')); await tick();
  assert.equal(f.refreshed.length, 5); assert.equal(f.unsubscribed(), true);
});

test('late initial session cannot restore the previous account after a newer login', async () => {
  let finish!: (id: string) => void;
  const f = setup({ session: () => new Promise(resolve => { finish = resolve; }) });
  try {
    f.auth('user-b'); finish('user-a'); await tick();
    assert.deepEqual(f.refreshed, ['user-b']);
    assert.deepEqual(f.cleared, ['user-b']);
  } finally { f.stop(); }
});

test('simultaneous resume events coalesce and account switching refreshes only the latest identity next', async () => {
  let release!: () => void;
  const calls: string[] = [];
  const f = setup({ refresh: async id => { calls.push(id); if (id === 'user-a') await new Promise<void>(resolve => { release = resolve; }); } });
  try {
    await tick(); f.host.dispatchEvent(new Event('focus')); f.host.dispatchEvent(new Event('online'));
    f.auth('user-b'); await tick(); release(); await tick();
    assert.deepEqual(calls, ['user-a', 'user-b']);
    assert.equal(f.cleared.at(-1), 'user-b');
  } finally { f.stop(); }
});

test('expiration removes native access on time even if the subsequent server refresh is offline', async () => {
  clearTrustedMembership();
  const expires = new Date(Date.now() + 65).toISOString();
  setTrustedAuthorization('user-a', { plan: 'pro', status: 'active', subscription_source: 'revenuecat', revenuecat_expires_at: expires }, {});
  let notifications = 0;
  const f = setup({ clear: id => clearTrustedMembership(id), refresh: async () => { throw Error('Offline'); },
    expiresAt: getMembershipExpiration, onExpiration: () => { notifications++; notifyMembershipExpiration(); } });
  const before = getMembershipRevision();
  try {
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(notifications, 1);
    assert.equal(getTrustedMembership()?.membership_tier, 'rookie');
    assert.ok(getMembershipRevision() > before);
  } finally { f.stop(); }
});

test('Stripe access and trusted promotions retain independent expiration rules', () => {
  clearTrustedMembership();
  setTrustedAuthorization('stripe', { plan: 'teams', status: 'active', subscription_source: 'stripe' }, {});
  assert.equal(getTrustedMembership()?.membership_tier, 'team'); assert.equal(getMembershipExpiration(), null);
  setTrustedAuthorization('stripe', { plan: 'pro', status: 'active', subscription_source: 'stripe' }, { promo_access_level: 'teams', promo_access_expires_at: new Date(Date.now() + 60000).toISOString() });
  assert.equal(getTrustedMembership()?.membership_tier, 'team'); assert.ok(getMembershipExpiration()! > Date.now());
  clearTrustedMembership();
});
