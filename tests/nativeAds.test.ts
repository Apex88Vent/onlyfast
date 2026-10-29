import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as trusted from '../src/lib/trustedMembership.ts';
import * as environment from '../src/lib/nativeEnvironment.ts';

// Execute real application modules with isolated browser/network boundaries.
function loadModule<T>(path: string, dependencies: Record<string, unknown>, env = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replaceAll('import.meta.env', 'testEnvironment');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function('require', 'exports', 'testEnvironment', js)((name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports, env);
  return exports as T;
}
const membership = loadModule<typeof import('../src/lib/membership.ts')>('../src/lib/membership.ts', {
  '@/lib/supabase': { supabase: {} }, './trustedMembership': trusted,
  '@/lib/testAccount': { isCurrentUserTestAccount: () => false },
});
const ads = loadModule<typeof import('../src/lib/ads.ts')>('../src/lib/ads.ts', { '@/lib/membership': membership, '@/lib/trustedMembership': trusted });
const native = loadModule<typeof import('../src/lib/nativeAds.ts')>('../src/lib/nativeAds.ts', {
  './ads': ads, './nativeEnvironment': environment, './trustedMembership': trusted,
}, { VITE_MEDIAN_ADMOB_ENABLED: 'true' });

const paid = (plan: string) => ({ plan, status: 'active', subscription_source: 'stripe' });
test('advertising requires resolved, current-user evidence; editable metadata cannot establish eligibility', async () => {
  trusted.clearTrustedMembership();
  assert.equal(ads.shouldShowAds(null), false);
  assert.equal(ads.shouldShowAds({ id: 'a', user_metadata: { membership_tier: 'rookie' } }), false);
  trusted.setTrustedAuthorization('a', null, {});
  assert.equal(ads.shouldShowAds({ id: 'a' }), true);
  assert.equal(ads.shouldShowAds({ id: 'b' }), false);
  trusted.clearTrustedMembership('b');
  assert.equal(ads.shouldShowAds({ id: 'b' }), false);
  assert.equal(ads.shouldShowAds({ id: 'a' }), false);
});
for (const [label, row, grants] of [
  ['Pro', paid('pro'), {}], ['Teams', paid('teams'), {}],
  ['Admin', null, { has_admin_full_access: true }],
  ['ambassador', null, { promo_access_level: 'ambassador' }],
  ['promotional', null, { promo_access_level: 'pro' }],
  ['ad-free', null, { promo_access_level: 'ad_free' }],
] as const) test(`${label} authorized accounts never see ads`, async () => {
  trusted.setTrustedAuthorization('a', row, grants);
  assert.equal(ads.shouldShowAds({ id: 'a', user_metadata: { membership_tier: 'rookie' } }), false);
});
test('ad-only invalidation and freshness expiry preserve existing subscription entitlements', async () => {
  trusted.setTrustedAuthorization('a', paid('pro'), {});
  trusted.invalidateAdvertisingMembership('a');
  assert.equal(ads.shouldShowAds({ id: 'a' }), false);
  assert.equal(trusted.getTrustedMembership()?.membership_tier, 'pro');
  trusted.setTrustedAuthorization('a', null, {});
  const expires = trusted.getAdvertisingAuthorizationExpiry()!;
  assert.ok(trusted.getTrustedAdvertisingMembership('a', expires - 1));
  assert.equal(trusted.getTrustedAdvertisingMembership('a', expires), null);
  assert.equal(trusted.getTrustedAdvertisingMembership('a', expires - trusted.AD_AUTHORIZATION_MAX_AGE_MS - 1), null);
  trusted.invalidateAdvertisingMembership('a');
  assert.equal(ads.shouldShowAds({ id: 'a' }), false);
  assert.equal(trusted.getTrustedMembership()?.membership_tier, 'rookie');
});
test('unknown subscription plans are ambiguous for advertising without changing entitlement resolution', async () => {
  trusted.setTrustedAuthorization('a', paid('unknown'), {});
  assert.equal(ads.shouldShowAds({ id: 'a' }), false);
  assert.equal(trusted.getTrustedMembership()?.membership_tier, 'rookie');
});

async function fixture(storage = new Map<string, string>(), useTrustedMembership = false,
  initial: Partial<{ enabled: boolean; completeConsent: boolean; eligible: boolean; touch: number; ua: string }> = {}) {
  const calls: string[] = [];
  const state = { enabled: true, completeConsent: true, eligible: true, touch: 0, ua: 'MedianAndroid/1.0 Android', now: 1_000_000, ...initial };
  const bridge = {
    banner: { enable: () => { calls.push('enable'); }, disable: () => { calls.push('disable'); } },
    showInterstitialIfReady: () => { calls.push('interstitial'); },
    request: (state.completeConsent && state.enabled ? { consent: async () => ({ result: true }),
      tracking: async () => ({ status: 'denied' }) } : undefined) as
      { consent: () => Promise<unknown>; tracking?: () => Promise<unknown> } | undefined,
  };
  const host = { bridge: bridge as typeof bridge | undefined };
  const controller = new native.NativeAdsController({
    enabled: () => state.enabled,
    eligible: (id: string) => state.eligible && (!useTrustedMembership || ads.shouldShowAds({ id })), userAgent: () => state.ua,
    bridge: () => host.bridge, now: () => state.now,
    maxTouchPoints: () => state.touch,
    storage: () => ({ getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); } }),
  });
  controller.setUser('a'); controller.setForeground(true); controller.setRouteSupported(true);
  controller.setPlacement('a', 'home');
  if (controller.getConsentStatus().status === 'pending') await controller.requestConsent();
  return { controller, calls, state, host, bridge, storage };
}
const complete = (f: Awaited<ReturnType<typeof fixture>>, overrides = {}) => f.controller.completeManualSave(
  f.controller.beginManualSave('a'), { persisted: true, queued: false, editing: false, ...overrides });

test('both production platforms sequence native consent before Rookie banners and post-save interstitials', async () => {
  for (const ua of ['MedianAndroid/1.0 Android', 'MedianIOS/1.0 iPhone', 'GoNativeIOS/1.0', 'Mozilla/5.0 Macintosh Median/1.0']) {
    trusted.setTrustedAuthorization('a', null, {});
    const f = await fixture(new Map(), true, { ua, touch: 5 });
    assert.ok(f.calls.includes('enable'), ua);
    assert.equal(complete(f), 'requested', ua);
    assert.equal(complete(f), 'suppressed', '600-second cooldown still applies');
    f.controller.setPlacement('a', 'scan');
    assert.equal(f.calls.at(-1), 'disable');
    trusted.clearTrustedMembership();
  }
});

test('native consent never overrides verified paid, admin, promotional or logged-out ad restrictions on either platform', async () => {
  for (const ua of ['MedianAndroid/1.0 Android', 'MedianIOS/1.0']) {
    for (const [row, grants] of [[paid('pro'), {}], [paid('teams'), {}], [null, { has_admin_full_access: true }],
      [null, { promo_access_level: 'ambassador' }], [null, { promo_access_level: 'ad_free' }], [null, { promo_access_level: 'pro' }]] as const) {
      trusted.setTrustedAuthorization('a', row, grants);
      const f = await fixture(new Map(), true, { ua });
      assert.ok(!f.calls.includes('enable'));
      assert.equal(complete(f), 'suppressed');
      f.controller.setUser(null); f.controller.refresh();
      assert.ok(!f.calls.includes('interstitial'));
      trusted.clearTrustedMembership();
    }
  }
});

test('iOS ATT precedes UMP; tracking denial does not fabricate an ad permission decision', async () => {
  for (const status of ['authorized', 'denied', 'restricted']) {
    const f = await fixture(new Map(), false, { ua: 'MedianIOS/1.0', completeConsent: false });
    const events: string[] = [];
    f.bridge.request = {
      tracking: async () => { events.push('tracking'); return { status }; },
      consent: async () => { events.push('consent'); return { result: false }; },
    };
    assert.equal(await f.controller.requestConsent(), 'unverified');
    assert.deepEqual(events, ['tracking', 'consent']);
    assert.deepEqual(f.controller.getConsentStatus().trackingResponse, { status });
    assert.equal(complete(f), 'requested');
  }
});


test('iOS cannot skip ATT or call UMP after leaving the foreground', async () => {
  const missing = await fixture(new Map(), false, { ua: 'MedianIOS/1.0', completeConsent: false });
  missing.bridge.request = { consent: async () => { assert.fail('ATT bridge unavailable'); } };
  assert.equal(await missing.controller.requestConsent(), 'unavailable');
  assert.equal(complete(missing), 'suppressed');
  const f = await fixture(new Map(), false, { ua: 'MedianIOS/1.0', completeConsent: false });
  let finish!: (value: unknown) => void;
  f.bridge.request = {
    tracking: () => new Promise(resolve => { finish = resolve; }),
    consent: async () => { assert.fail('background app must not open UMP'); },
  };
  const pending = f.controller.requestConsent();
  f.controller.setForeground(false);
  finish({ status: 'denied' });
  assert.equal(await pending, 'error');
  f.controller.setForeground(true);
  assert.equal(complete(f), 'suppressed');
});

test('a replacement native bridge must complete its own consent flow before ad commands', async () => {
  const f = await fixture();
  let finish!: (value: unknown) => void;
  f.calls.length = 0;
  f.host.bridge = { ...f.bridge, request: { consent: () => new Promise(resolve => { finish = resolve; }) } };
  f.controller.refresh();
  assert.equal(complete(f), 'suppressed');
  assert.ok(!f.calls.includes('enable'));
  finish({ result: true });
  await f.controller.requestConsent();
  assert.ok(f.calls.includes('enable'));
});

test('iOS banners follow the existing placements and modal/editor exclusions', async () => {
  const f = await fixture(new Map(), false, { ua: 'MedianIOS/1.0' });
  for (const view of ['home', 'schedule', 'saved']) {
    f.controller.setPlacement('a', view); assert.equal(f.calls.at(-1), 'enable');
    const resume = f.controller.suspend(); assert.equal(f.calls.at(-1), 'disable'); resume();
  }
  for (const view of ['setup', 'scan', 'onboarding', 'account', 'pricing']) {
    f.controller.setPlacement('a', view); assert.equal(f.calls.at(-1), 'disable');
  }
  f.controller.setForeground(false); assert.equal(complete(f), 'suppressed');
});

test('one banner follows only home, schedule and saved; unsupported screens and stale cleanup hide it', async () => {
  const f = await fixture();
  assert.equal(f.calls.filter(c => c === 'enable').length, 1);
  f.controller.refresh(); assert.equal(f.calls.filter(c => c === 'enable').length, 1);
  f.controller.setPlacement('a', 'schedule'); f.controller.setPlacement('a', 'saved');
  assert.equal(f.calls.filter(c => c === 'enable').length, 1);
  for (const view of ['setup', 'scan', 'onboarding', 'account', 'pricing', 'todo', 'parts']) {
    f.controller.setPlacement('a', 'home'); f.controller.setPlacement('a', view);
    assert.equal(f.calls.at(-1), 'disable');
  }
  const releaseOld = f.controller.setPlacement('a', 'schedule');
  const releaseNew = f.controller.setPlacement('a', 'saved');
  releaseOld(); assert.equal(f.calls.at(-1), 'enable');
  releaseNew(); assert.equal(f.calls.at(-1), 'disable');
});
test('eligibility loss, account switches, logout, background and account routes immediately hide banners', async () => {
  const f = await fixture();
  f.state.eligible = false; f.controller.refresh(); assert.equal(f.calls.at(-1), 'disable');
  f.state.eligible = true; f.controller.refresh(); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setUser('b'); assert.equal(f.calls.at(-1), 'disable');
  f.controller.setPlacement('b', 'home'); await f.controller.requestConsent(); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setForeground(false); assert.equal(f.calls.at(-1), 'disable');
  f.controller.setForeground(true); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setRouteSupported(false); assert.equal(f.calls.at(-1), 'disable');
  f.controller.setRouteSupported(true);
  const release = f.controller.suspend(); assert.equal(f.calls.at(-1), 'disable');
  release(); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setUser(null); assert.equal(f.calls.at(-1), 'disable');
});
test('browser, unknown native platform, missing bridge/methods and disabled flag do not enable native advertising', async () => {
  for (const ua of ['Mozilla/5.0 Android Chrome', 'MedianUnknown/1.0']) {
    const f = await fixture(); f.calls.length = 0; f.state.ua = ua; f.controller.refresh();
    assert.equal(complete(f), 'house'); assert.ok(!f.calls.includes('enable') && !f.calls.includes('interstitial'));
  }
  const f = await fixture(); f.host.bridge = undefined; f.controller.refresh();
  assert.equal(complete(f), 'house');
  f.host.bridge = {} as typeof f.bridge; f.controller.refresh(); assert.equal(complete(f), 'house');
  f.host.bridge = f.bridge; f.state.enabled = false; f.controller.refresh();
  assert.equal(f.calls.at(-1), 'disable'); assert.equal(complete(f), 'house');
  for (const value of [undefined, false, true, '', 'false', 'TRUE']) assert.equal(native.nativeAdsFeatureEnabled(value), false);
  assert.equal(native.nativeAdsFeatureEnabled('true'), true);
});
test('missing native consent capability suppresses both native formats without consuming cooldown', async () => {
  const f = await fixture(new Map(), false, { completeConsent: false }); f.controller.refresh();
  f.calls.length = 0;
  assert.equal(complete(f), 'suppressed');
  f.controller.setPlacement('a', 'saved');
  assert.ok(!f.calls.includes('enable') && !f.calls.includes('interstitial'));
  assert.equal(f.storage.size, 0, 'blocked requests must not consume cooldown');
});

test('native consent runs once before ads at an eligible screen, coalesces requests and preserves the actual response', async () => {
  const f = await fixture(new Map(), false, { completeConsent: false });
  let finish!: (response: unknown) => void;
  let requests = 0;
  f.bridge.request = { consent: () => {
    requests++; f.calls.push('consent');
    return new Promise(resolve => { finish = resolve; });
  } };
  f.calls.length = 0;
  f.controller.refresh();
  const first = f.controller.requestConsent();
  assert.equal(f.controller.requestConsent(), first);
  assert.equal(requests, 1);
  assert.equal(complete(f), 'suppressed');
  assert.equal(f.controller.getConsentStatus().status, 'pending');
  const response = { result: true };
  finish(response);
  assert.equal(await first, 'unverified');
  assert.equal(f.controller.getConsentStatus().response, response);
  f.controller.refresh(); assert.equal(requests, 1, 'an ambiguous response must not trigger a consent prompt loop');
  assert.ok(f.calls.includes('enable'));
  assert.ok(!f.calls.includes('interstitial'));
  const releaseSettings = f.controller.suspend();
  const retry = f.controller.requestConsent();
  assert.equal(requests, 2, 'Settings can explicitly re-request the supported consent flow');
  finish({ success: true }); await retry; releaseSettings();
  assert.equal(complete(f), 'requested');
});

test('native completion dispatches only native commands; response fields never become JS permission or personalization', async () => {
  for (const response of [{ success: true }, { result: true }, { success: false }, { result: false }, undefined, { canRequestAds: true }]) {
    const f = await fixture(new Map(), false, { completeConsent: false });
    f.bridge.request = { consent: async () => response };
    assert.equal(await f.controller.requestConsent(), 'unverified');
    assert.equal(f.controller.getConsentStatus().response, response);
    assert.equal(complete(f), 'requested');
    assert.deepEqual(f.calls.filter(c => c === 'interstitial'), ['interstitial']);
    assert.equal('canRequestAds' in f.controller.getConsentStatus(), false);
  }
});

test('manual Settings consent works with ads disabled without automatic prompts or native ad display', async () => {
  for (const eligible of [true, false]) {
    const f = await fixture(new Map(), false, { enabled: false, eligible });
    let requests = 0;
    f.bridge.request = { consent: async () => { requests++; return { success: true }; } };
    assert.equal(f.controller.canRequestConsent(), true, 'privacy access does not require ad eligibility');
    f.controller.refresh();
    f.controller.setPlacement('a', 'schedule');
    f.controller.setForeground(false); f.controller.setForeground(true);
    assert.equal(requests, 0, 'ads off must not cause automatic consent prompts');
    const releaseSettings = f.controller.suspend();
    assert.equal(await f.controller.requestConsent(), 'unverified');
    assert.equal(requests, 1);
    releaseSettings();
    f.controller.refresh();
    complete(f);
    assert.equal(requests, 1);
    assert.ok(!f.calls.includes('enable') && !f.calls.includes('interstitial'));
    assert.equal(f.storage.size, 0, 'privacy access must not consume the interstitial cooldown');
  }
});

test('consent requests still require foreground authentication, a supported native platform and a matching bridge', async () => {
  for (const ua of ['Chrome Android', 'MedianUnknown/1.0']) {
    const f = await fixture(new Map(), false, { enabled: false }); f.state.ua = ua;
    f.bridge.request = { consent: async () => { assert.fail('unsupported platform'); } };
    assert.equal(f.controller.canRequestConsent(), false);
    assert.equal(await f.controller.requestConsent(), 'unavailable');
  }
  const f = await fixture(new Map(), false, { enabled: false });
  assert.equal(f.controller.canRequestConsent(), false);
  assert.equal(await f.controller.requestConsent(), 'unavailable');
  f.bridge.request = { consent: async () => { assert.fail('unavailable privacy request must not call native'); } };
  f.host.bridge = undefined;
  assert.equal(f.controller.canRequestConsent(), false);
  assert.equal(await f.controller.requestConsent(), 'unavailable');
  f.host.bridge = f.bridge;
  f.controller.setUser(null);
  assert.equal(f.controller.canRequestConsent(), false);
  assert.equal(await f.controller.requestConsent(), 'unavailable');
  f.controller.setUser('a'); f.controller.setForeground(false);
  assert.equal(f.controller.canRequestConsent(), false);
  assert.equal(await f.controller.requestConsent(), 'unavailable');
});

test('consent errors, callback-only bridges and late responses after account switching cannot release ads', async () => {
  const failed = await fixture(new Map(), false, { completeConsent: false });
  failed.bridge.request = { consent: async () => { throw Error('native failure'); } };
  assert.equal(await failed.controller.requestConsent(), 'error');
  assert.equal(complete(failed), 'suppressed');
  const legacy = await fixture(new Map(), false, { completeConsent: false });
  legacy.bridge.request = { consent: (() => undefined) as unknown as () => Promise<unknown> };
  assert.equal(await legacy.controller.requestConsent(), 'error');
  const switched = await fixture(new Map(), false, { completeConsent: false });
  let finish!: (result: unknown) => void;
  switched.bridge.request = { consent: () => new Promise(resolve => { finish = resolve; }) };
  const pending = switched.controller.requestConsent();
  switched.controller.setUser('b');
  finish({ success: true });
  assert.equal(await pending, 'unavailable');
  assert.equal(switched.controller.getConsentStatus().response, undefined);
  assert.equal(switched.controller.getConsentStatus().status, 'idle');
});

test('a consent timeout releases the UI but cannot stack another still-pending native dialog', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = await fixture(new Map(), false, { completeConsent: false });
  let finish!: (response: unknown) => void;
  let requests = 0;
  f.bridge.request = { consent: () => { requests++; return new Promise(resolve => { finish = resolve; }); } };
  const pending = f.controller.requestConsent();
  t.mock.timers.tick(15_000);
  assert.equal(await pending, 'error');
  assert.equal(await f.controller.requestConsent(), 'error');
  assert.equal(requests, 1);
  finish({ success: true });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.controller.getConsentStatus().response, undefined, 'late completion after timeout grants nothing');
  assert.equal(complete(f), 'suppressed');
});
test('successful manual save requests once, consumes its ticket, and persists a 600-second account cooldown', async () => {
  const f = await fixture(); f.controller.setPlacement('a', 'setup');
  const ticket = f.controller.beginManualSave('a');
  assert.equal(f.controller.completeManualSave(ticket, { persisted: true, queued: false, editing: false }), 'requested');
  assert.equal(f.controller.completeManualSave(ticket, { persisted: true, queued: false, editing: false }), 'suppressed');
  assert.equal(complete(f), 'suppressed');
  const reloaded = await fixture(f.storage);
  assert.equal(complete(reloaded), 'suppressed');
  reloaded.state.now += native.INTERSTITIAL_COOLDOWN_MS - 1;
  assert.equal(complete(reloaded), 'suppressed');
  reloaded.state.now++;
  assert.equal(complete(reloaded), 'requested');
  assert.equal(reloaded.calls.filter(c => c === 'interstitial').length, 1);
  reloaded.controller.setUser('b');
  await reloaded.controller.requestConsent();
  const b = reloaded.controller.beginManualSave('b');
  assert.equal(reloaded.controller.completeManualSave(b, { persisted: true, queued: false, editing: false }), 'requested');
});
test('failed/queued/no-write saves and active editing cannot request ads', async () => {
  for (const outcome of [{ persisted: false }, { queued: true }, { editing: true }]) {
    const f = await fixture(); assert.equal(complete(f, outcome), 'suppressed'); assert.equal(f.storage.size, 0);
  }
});
test('intervening input, navigation, suspension, account changes and loss of eligibility cancel save opportunities', async () => {
  for (const cancel of [
    (f: Awaited<ReturnType<typeof fixture>>) => f.controller.noteActivity(),
    (f: Awaited<ReturnType<typeof fixture>>) => f.controller.setPlacement('a', 'setup'),
    (f: Awaited<ReturnType<typeof fixture>>) => f.controller.suspend(),
    (f: Awaited<ReturnType<typeof fixture>>) => f.controller.setUser('b'),
    (f: Awaited<ReturnType<typeof fixture>>) => { f.state.eligible = false; },
  ]) {
    const f = await fixture(); const ticket = f.controller.beginManualSave('a'); cancel(f);
    assert.equal(f.controller.completeManualSave(ticket, { persisted: true, queued: false, editing: false }), 'suppressed');
    assert.equal(f.storage.size, 0);
  }
});
test('overlapping saves and reentrant bridge callbacks cannot dispatch duplicate requests', async () => {
  const f = await fixture(); const first = f.controller.beginManualSave('a');
  const second = f.controller.beginManualSave('a');
  assert.equal(f.controller.completeManualSave(first, { persisted: true, queued: false, editing: false }), 'suppressed');
  f.bridge.showInterstitialIfReady = () => { f.calls.push('interstitial'); assert.equal(complete(f), 'suppressed'); };
  assert.equal(f.controller.completeManualSave(second, { persisted: true, queued: false, editing: false }), 'requested');
  assert.equal(f.calls.filter(c => c === 'interstitial').length, 1);
});
test('bridge exceptions/no-fill and unusable storage never fall back to an immediate house modal', async () => {
  const f = await fixture();
  f.bridge.showInterstitialIfReady = () => { throw Error('native unavailable'); };
  assert.equal(complete(f), 'suppressed');
  assert.equal(complete(f), 'suppressed');
  const noFill = await fixture(); assert.equal(complete(noFill), 'requested'); // void means requested, not displayed.
  for (const raw of ['bad', '', '-10', String(2_000_000)]) {
    const invalid = await fixture(new Map([['onlyfast_admob_interstitial_v1:a', raw]]));
    assert.equal(complete(invalid), 'suppressed');
  }
  const storage = new Map<string, string>(); storage.set = () => { throw Error('storage denied'); };
  assert.equal(complete(await fixture(storage)), 'suppressed');
});

test('lifecycle handles late bridge injection, preserves readiness callbacks, background/resume and cleanup', async () => {
  const f = await fixture(); f.host.bridge = undefined; f.controller.refresh();
  const host = Object.assign(new EventTarget(), { median_library_ready: () => { callbacks++; } });
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let callbacks = 0; const previous = host.median_library_ready;
  let authChanged = (_id: string | null) => {};
  let finish!: (id: string) => void;
  const stop = native.watchNativeAds(f.controller, {
    session: () => new Promise<string>(resolve => { finish = resolve; }),
    onAuthChange: (listener: typeof authChanged) => { authChanged = listener; return () => { authChanged = () => {}; }; },
  }, host, page);
  try {
    authChanged('b'); finish('a'); await Promise.resolve();
    f.controller.setPlacement('b', 'home'); f.host.bridge = f.bridge;
    host.median_library_ready(); await f.controller.requestConsent(); assert.equal(callbacks, 1); assert.equal(f.calls.at(-1), 'enable');
    page.visibilityState = 'hidden'; page.dispatchEvent(new Event('visibilitychange'));
    assert.equal(f.calls.at(-1), 'disable');
    page.visibilityState = 'visible'; page.dispatchEvent(new Event('visibilitychange'));
    assert.equal(f.calls.at(-1), 'enable');
    const ticket = f.controller.beginManualSave('b'); page.dispatchEvent(new Event('input'));
    assert.equal(f.controller.completeManualSave(ticket, { persisted: true, queued: false, editing: false }), 'suppressed');
  } finally { stop(); }
  assert.equal(host.median_library_ready, previous);
  const count = f.calls.length; host.dispatchEvent(new Event('focus')); assert.equal(f.calls.length, count);
});

test('real membership invalidation prevents resume advertising until current-account verification succeeds again', async () => {
  trusted.setTrustedAuthorization('a', null, {});
  const f = await fixture(new Map(), true);
  const host = new EventTarget();
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let authChanged = (_id: string | null) => {};
  const stop = native.watchNativeAds(f.controller, {
    session: async () => 'a', onAuthChange: (listener: typeof authChanged) => { authChanged = listener; return () => {}; },
  }, host, page);
  try {
    await Promise.resolve();
    assert.equal(ads.shouldShowAds({ id: 'a' }), true, 'initial identity read preserves already-verified evidence');
    authChanged('a');
    assert.equal(ads.shouldShowAds({ id: 'a' }), false);
    assert.equal(f.calls.at(-1), 'disable');
    trusted.setTrustedAuthorization('a', null, {}); host.dispatchEvent(new Event('membership-updated'));
    assert.equal(f.calls.at(-1), 'enable');
    host.dispatchEvent(new Event('blur'));
    assert.equal(f.calls.at(-1), 'disable');
    host.dispatchEvent(new Event('focus'));
    assert.equal(ads.shouldShowAds({ id: 'a' }), false);
    assert.equal(f.calls.at(-1), 'disable');
    trusted.setTrustedAuthorization('a', null, {}); host.dispatchEvent(new Event('membership-updated'));
    assert.equal(f.calls.at(-1), 'enable');
  } finally { stop(); trusted.clearTrustedMembership(); }
});

const dashboardSource = readFileSync(new URL('../src/components/SetupDashboard.tsx', import.meta.url), 'utf8');
function dashboardFunction(name: string, bindings: Record<string, unknown>) {
  const ast = ts.createSourceFile('dashboard.tsx', dashboardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(declaration);
  const js = ts.transpileModule(`const ${declaration.getText(ast)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), `${js}; return ${name}`)(...Object.values(bindings));
}

test('actual save routine distinguishes persisted, queued, failed and empty saves without changing queued success', async () => {
  for (const mode of ['persisted', 'queued', 'failed', 'empty']) {
    const queued: unknown[] = []; const noop = () => {};
    const save = dashboardFunction('performSave', {
      user: { id: 'a' }, effectiveTier: 'team', setSaving: noop, setSaveMessage: noop,
      savedMeta: { ids: {} }, ALL_SLOTS: mode === 'empty' ? [] : ['base'], deletedSessionSlots: {},
      isRealSession: () => true, tabHasData: () => true, setups: { base: {} }, activeTab: 'base',
      buildPayload: () => ({}), dbInsert: async () => {
        if (mode === 'queued' || mode === 'failed') throw Error(mode);
        return { id: 'saved-row' };
      },
      isNetworkError: (error: Error) => error.message === 'queued', enqueuePending: (item: unknown) => queued.push(item),
      setSavedMeta: noop, lastOpenedSetupKey: () => 'last', localStorage: { setItem: noop },
      setSetups: noop, setRefreshTrigger: noop, setPendingCount: noop, readPendingQueue: () => queued,
    });
    const result = await save('Race', true); // Autosave path must never invoke the native controller.
    if (mode === 'failed') assert.equal(result, null);
    else assert.deepEqual(result, { persisted: mode === 'persisted', queued: mode === 'queued' });
    assert.equal(queued.length, mode === 'queued' ? 1 : 0);
  }
});

test('actual manual-save hook preserves web fallback and avoids native/house stacking and late editing interruptions', async () => {
  for (const mode of ['native', 'browser', 'flag-off', 'consent', 'failed', 'queued', 'editing', 'activity', 'switched']) {
    const f = await fixture(); f.controller.setPlacement('a', 'setup');
    if (mode === 'browser') f.state.ua = 'Chrome';
    if (mode === 'flag-off') f.state.enabled = false;
    if (mode === 'consent') { f.bridge.request = { consent: async () => { throw Error('native failure'); } }; await f.controller.requestConsent(); }
    let house = false; const noop = () => {};
    const submit = dashboardFunction('handleSaveModalSubmit', {
      user: { id: 'a' }, nativeAds: f.controller,
      performSave: async () => {
        if (mode === 'activity') f.controller.noteActivity();
        if (mode === 'switched') f.controller.setUser('b');
        return mode === 'failed' ? null : { persisted: mode !== 'queued', queued: mode === 'queued' };
      },
      setSaveModalOpen: noop, saveThenClear: false, doClearAllTabs: noop,
      saveAdContext: { current: { userId: 'a', activeView: 'setup', saveModalOpen: mode !== 'editing' } },
      setShowPostSaveAd: (value: boolean) => { house = value; },
    });
    await submit('Race');
    assert.equal(f.calls.filter(c => c === 'interstitial').length, mode === 'native' ? 1 : 0, mode);
    assert.equal(house, mode === 'browser' || mode === 'flag-off', mode);
  }
});
