import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as trusted from '../src/lib/trustedMembership.ts';
import * as environment from '../src/lib/nativeEnvironment.ts';

// Execute real application modules with isolated browser/network boundaries.
function loadModule(path: string, dependencies: Record<string, unknown>, env = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replaceAll('import.meta.env.VITE_MEDIAN_ADMOB_ENABLED', 'testEnvironment.VITE_MEDIAN_ADMOB_ENABLED');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  new Function('require', 'exports', 'testEnvironment', js)((name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports, env);
  return exports;
}
const membership = loadModule('../src/lib/membership.ts', {
  '@/lib/supabase': { supabase: {} }, './trustedMembership': trusted,
  '@/lib/testAccount': { isCurrentUserTestAccount: () => false },
});
const ads = loadModule('../src/lib/ads.ts', { '@/lib/membership': membership, '@/lib/trustedMembership': trusted });
const native = loadModule('../src/lib/nativeAds.ts', {
  './ads': ads, './nativeEnvironment': environment, './trustedMembership': trusted,
}, { VITE_MEDIAN_ADMOB_ENABLED: 'true' });

const paid = (plan: string) => ({ plan, status: 'active', subscription_source: 'stripe' });
test('advertising requires resolved, current-user evidence; editable metadata cannot establish eligibility', () => {
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
] as const) test(`${label} authorized accounts never see ads`, () => {
  trusted.setTrustedAuthorization('a', row, grants);
  assert.equal(ads.shouldShowAds({ id: 'a', user_metadata: { membership_tier: 'rookie' } }), false);
});
test('ad-only invalidation and freshness expiry preserve existing subscription entitlements', () => {
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
test('unknown subscription plans are ambiguous for advertising without changing entitlement resolution', () => {
  trusted.setTrustedAuthorization('a', paid('unknown'), {});
  assert.equal(ads.shouldShowAds({ id: 'a' }), false);
  assert.equal(trusted.getTrustedMembership()?.membership_tier, 'rookie');
});

function fixture(storage = new Map<string, string>(), useTrustedMembership = false) {
  const calls: string[] = [];
  const state = { enabled: true, consent: true, eligible: true, ua: 'MedianAndroid/1.0 Android', now: 1_000_000 };
  const bridge = {
    banner: { enable: () => { calls.push('enable'); }, disable: () => { calls.push('disable'); } },
    showInterstitialIfReady: () => { calls.push('interstitial'); },
    request: undefined as { consent: () => Promise<unknown> } | undefined,
  };
  const host = { bridge: bridge as typeof bridge | undefined };
  const controller = new native.NativeAdsController({
    enabled: () => state.enabled, consentReady: () => state.consent,
    eligible: (id: string) => state.eligible && (!useTrustedMembership || ads.shouldShowAds({ id })), userAgent: () => state.ua,
    bridge: () => host.bridge, now: () => state.now,
    storage: () => ({ getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); } }),
  });
  controller.setUser('a'); controller.setForeground(true); controller.setRouteSupported(true);
  controller.setPlacement('a', 'home');
  return { controller, calls, state, host, bridge, storage };
}
const complete = (f: ReturnType<typeof fixture>, overrides = {}) => f.controller.completeManualSave(
  f.controller.beginManualSave('a'), { persisted: true, queued: false, editing: false, ...overrides });

test('one banner follows only home, schedule and saved; unsupported screens and stale cleanup hide it', () => {
  const f = fixture();
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
test('eligibility loss, account switches, logout, background and account routes immediately hide banners', () => {
  const f = fixture();
  f.state.eligible = false; f.controller.refresh(); assert.equal(f.calls.at(-1), 'disable');
  f.state.eligible = true; f.controller.refresh(); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setUser('b'); assert.equal(f.calls.at(-1), 'disable');
  f.controller.setPlacement('b', 'home'); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setForeground(false); assert.equal(f.calls.at(-1), 'disable');
  f.controller.setForeground(true); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setRouteSupported(false); assert.equal(f.calls.at(-1), 'disable');
  f.controller.setRouteSupported(true);
  const release = f.controller.suspend(); assert.equal(f.calls.at(-1), 'disable');
  release(); assert.equal(f.calls.at(-1), 'enable');
  f.controller.setUser(null); assert.equal(f.calls.at(-1), 'disable');
});
test('browser, iOS, missing bridge/methods and disabled flag do not enable native advertising', () => {
  for (const ua of ['Mozilla/5.0 Android Chrome', 'MedianIOS/1.0 iPhone']) {
    const f = fixture(); f.calls.length = 0; f.state.ua = ua; f.controller.refresh();
    assert.equal(complete(f), 'house'); assert.ok(!f.calls.includes('enable') && !f.calls.includes('interstitial'));
  }
  const f = fixture(); f.host.bridge = undefined; f.controller.refresh();
  assert.equal(complete(f), 'house');
  f.host.bridge = {} as any; f.controller.refresh(); assert.equal(complete(f), 'house');
  f.host.bridge = f.bridge; f.state.enabled = false; f.controller.refresh();
  assert.equal(f.calls.at(-1), 'disable'); assert.equal(complete(f), 'house');
  for (const value of [undefined, false, true, '', 'false', 'TRUE']) assert.equal(native.nativeAdsFeatureEnabled(value), false);
  assert.equal(native.nativeAdsFeatureEnabled('true'), true);
});
test('consent unavailable/denied and the production consent hold suppress both native formats', () => {
  assert.equal(native.NATIVE_ADS_CONSENT_VERIFIED, false);
  const f = fixture(); f.state.consent = false; f.controller.refresh();
  f.calls.length = 0;
  assert.equal(complete(f), 'suppressed');
  f.controller.setPlacement('a', 'saved');
  assert.ok(!f.calls.includes('enable') && !f.calls.includes('interstitial'));
  assert.equal(f.storage.size, 0, 'blocked requests must not consume cooldown');
});

test('native consent runs once before ads at an eligible screen, coalesces requests and preserves the actual response', async () => {
  const f = fixture(); f.state.consent = false;
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
  assert.ok(!f.calls.includes('enable') && !f.calls.includes('interstitial'));
  const releaseSettings = f.controller.suspend();
  const retry = f.controller.requestConsent();
  assert.equal(requests, 2, 'Settings can explicitly re-request the supported consent flow');
  finish({ success: true }); await retry; releaseSettings();
  assert.equal(complete(f), 'suppressed');
});

test('neither documented boolean nor an unknown permission-shaped response authorizes advertising', async () => {
  for (const response of [{ success: true }, { result: true }, { success: false }, { result: false }, undefined, { canRequestAds: true }]) {
    const f = fixture(); f.state.consent = false;
    f.bridge.request = { consent: async () => response };
    assert.equal(await f.controller.requestConsent(), 'unverified');
    assert.equal(complete(f), 'suppressed');
    assert.equal(f.storage.size, 0);
  }
});

test('consent requests are Android-only, master-flag controlled and unavailable without a matching bridge', async () => {
  for (const ua of ['Chrome Android', 'MedianIOS/1.0 iPhone']) {
    const f = fixture(); f.state.ua = ua;
    f.bridge.request = { consent: async () => { assert.fail('unsupported platform'); } };
    assert.equal(await f.controller.requestConsent(), 'unavailable');
  }
  const f = fixture();
  assert.equal(await f.controller.requestConsent(), 'unavailable');
  f.bridge.request = { consent: async () => { assert.fail('master flag disabled'); } };
  f.state.enabled = false;
  assert.equal(await f.controller.requestConsent(), 'unavailable');
});

test('consent errors, callback-only bridges and late responses after account switching cannot release ads', async () => {
  const failed = fixture(); failed.state.consent = false;
  failed.bridge.request = { consent: async () => { throw Error('native failure'); } };
  assert.equal(await failed.controller.requestConsent(), 'error');
  assert.equal(complete(failed), 'suppressed');
  const legacy = fixture(); legacy.state.consent = false;
  legacy.bridge.request = { consent: (() => undefined) as any };
  assert.equal(await legacy.controller.requestConsent(), 'unavailable');
  const switched = fixture(); switched.state.consent = false;
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
  const f = fixture(); f.state.consent = false;
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
test('successful manual save requests once, consumes its ticket, and persists a 600-second account cooldown', () => {
  const f = fixture(); f.controller.setPlacement('a', 'setup');
  const ticket = f.controller.beginManualSave('a');
  assert.equal(f.controller.completeManualSave(ticket, { persisted: true, queued: false, editing: false }), 'requested');
  assert.equal(f.controller.completeManualSave(ticket, { persisted: true, queued: false, editing: false }), 'suppressed');
  assert.equal(complete(f), 'suppressed');
  const reloaded = fixture(f.storage);
  assert.equal(complete(reloaded), 'suppressed');
  reloaded.state.now += native.INTERSTITIAL_COOLDOWN_MS - 1;
  assert.equal(complete(reloaded), 'suppressed');
  reloaded.state.now++;
  assert.equal(complete(reloaded), 'requested');
  assert.equal(reloaded.calls.filter(c => c === 'interstitial').length, 1);
  reloaded.controller.setUser('b');
  const b = reloaded.controller.beginManualSave('b');
  assert.equal(reloaded.controller.completeManualSave(b, { persisted: true, queued: false, editing: false }), 'requested');
});
test('failed/queued/no-write saves and active editing cannot request ads', () => {
  for (const outcome of [{ persisted: false }, { queued: true }, { editing: true }]) {
    const f = fixture(); assert.equal(complete(f, outcome), 'suppressed'); assert.equal(f.storage.size, 0);
  }
});
test('intervening input, navigation, suspension, account changes and loss of eligibility cancel save opportunities', () => {
  for (const cancel of [
    (f: ReturnType<typeof fixture>) => f.controller.noteActivity(),
    (f: ReturnType<typeof fixture>) => f.controller.setPlacement('a', 'setup'),
    (f: ReturnType<typeof fixture>) => f.controller.suspend(),
    (f: ReturnType<typeof fixture>) => f.controller.setUser('b'),
    (f: ReturnType<typeof fixture>) => { f.state.eligible = false; },
  ]) {
    const f = fixture(); const ticket = f.controller.beginManualSave('a'); cancel(f);
    assert.equal(f.controller.completeManualSave(ticket, { persisted: true, queued: false, editing: false }), 'suppressed');
    assert.equal(f.storage.size, 0);
  }
});
test('overlapping saves and reentrant bridge callbacks cannot dispatch duplicate requests', () => {
  const f = fixture(); const first = f.controller.beginManualSave('a');
  const second = f.controller.beginManualSave('a');
  assert.equal(f.controller.completeManualSave(first, { persisted: true, queued: false, editing: false }), 'suppressed');
  f.bridge.showInterstitialIfReady = () => { f.calls.push('interstitial'); assert.equal(complete(f), 'suppressed'); };
  assert.equal(f.controller.completeManualSave(second, { persisted: true, queued: false, editing: false }), 'requested');
  assert.equal(f.calls.filter(c => c === 'interstitial').length, 1);
});
test('bridge exceptions/no-fill and unusable storage never fall back to an immediate house modal', () => {
  const f = fixture();
  f.bridge.showInterstitialIfReady = () => { throw Error('native unavailable'); };
  assert.equal(complete(f), 'suppressed');
  assert.equal(complete(f), 'suppressed');
  const noFill = fixture(); assert.equal(complete(noFill), 'requested'); // void means requested, not displayed.
  for (const raw of ['bad', '', '-10', String(2_000_000)]) {
    const invalid = fixture(new Map([['onlyfast_admob_interstitial_v1:a', raw]]));
    assert.equal(complete(invalid), 'suppressed');
  }
  const storage = new Map<string, string>(); storage.set = () => { throw Error('storage denied'); };
  assert.equal(complete(fixture(storage)), 'suppressed');
});

test('lifecycle handles late bridge injection, preserves readiness callbacks, background/resume and cleanup', async () => {
  const f = fixture(); f.host.bridge = undefined; f.controller.refresh();
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
    host.median_library_ready(); assert.equal(callbacks, 1); assert.equal(f.calls.at(-1), 'enable');
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
  const f = fixture(new Map(), true);
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
    const f = fixture(); f.controller.setPlacement('a', 'setup');
    if (mode === 'browser') f.state.ua = 'Chrome';
    if (mode === 'flag-off') f.state.enabled = false;
    if (mode === 'consent') f.state.consent = false;
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
