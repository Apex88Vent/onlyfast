import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as controller from '../src/lib/analyticsController.ts';
import * as native from '../src/lib/analyticsNative.ts';
import * as environment from '../src/lib/nativeEnvironment.ts';
import { componentFunction } from './setupLibraryHarness.ts';

function load<T>(file: string, dependencies: Record<string, unknown>, env = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8').replaceAll('import.meta.env', 'testEnv');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', 'testEnv', js)((name: string) => {
    assert.ok(name in dependencies, 'Unexpected analytics dependency: ' + name);
    return dependencies[name];
  }, exports, env);
  return exports as T;
}
function sinkFixture() {
  const events: unknown[] = []; const identities: unknown[] = []; const collection: boolean[] = [];
  const sink: controller.AnalyticsSink = {
    event: (name, params) => events.push([name, params]), screen: name => events.push(['screen', name]),
    identity: (id, properties) => identities.push([id, properties]), collection: enabled => collection.push(enabled),
  };
  return { sink, events, identities, collection };
}
test('unknown/denied consent and master switch never queue or log events', () => {
  for (const [enabled, consent] of [[true, 'unknown'], [true, 'denied'], [false, 'granted']] as const) {
    const service = new controller.AnalyticsController(); const f = sinkFixture();
    service.configure(enabled, consent); service.track('race_setup_saved'); service.attach(f.sink);
    assert.deepEqual(f.events, []); assert.equal(f.collection.at(-1), false);
  }
});
test('2027 membership tiers are valid coarse analytics values', () => {
  for (const tier of ['sportsman', 'pro', 'factory', 'unsubscribed']) {
    assert.deepEqual(controller.sanitizeAnalyticsParams({ subscription_tier: tier }), { subscription_tier: tier });
  }
  assert.deepEqual(controller.sanitizeAnalyticsParams({ subscription_tier: 'personal user name' }), {});
});
test('consent grant logs once per operation key, screens ignore rerenders but record revisits', () => {
  const service = new controller.AnalyticsController(); const f = sinkFixture();
  service.configure(true, 'granted'); service.attach(f.sink);
  for (let i = 0; i < 3; i++) { service.track('race_setup_saved', {}, 'save-1'); service.screen('Dashboard'); }
  service.screen('Settings'); service.screen('Dashboard'); service.track('race_setup_saved', {}, 'save-2');
  assert.equal(f.events.length, 5);
});
test('pending events are bounded and dropped across account changes or revoked consent', () => {
  const service = new controller.AnalyticsController(); const f = sinkFixture();
  service.configure(true, 'granted');
  for (let i = 0; i < 100; i++) service.track('race_setup_saved');
  service.attach(f.sink); assert.equal(f.events.length, 30);
  const second = new controller.AnalyticsController();
  second.configure(true, 'granted'); second.track('race_setup_saved'); second.identify('new-account'); second.attach(f.sink);
  assert.equal(f.events.length, 30);
  const third = new controller.AnalyticsController();
  third.configure(true, 'granted'); third.track('race_setup_saved'); third.configure(true, 'denied'); third.attach(f.sink);
  assert.equal(f.events.length, 30);
});
test('web identity is cleared on logout and tier changes are propagated', () => {
  const service = new controller.AnalyticsController(); const f = sinkFixture();
  service.configure(true, 'granted'); service.attach(f.sink);
  service.identify('uuid', { subscription_tier: 'rookie' }); service.identify('uuid', { subscription_tier: 'team' });
  assert.deepEqual(f.identities.at(-1), ['uuid', { subscription_tier: 'team' }]);
  service.identify(null); assert.deepEqual(f.identities.at(-1), [null, {}]);
});
test('SDK failures never escape feature handlers; private payload fields are dropped', () => {
  const service = new controller.AnalyticsController(); const f = sinkFixture();
  service.configure(true, 'granted'); service.attach(f.sink);
  service.track('race_setup_saved', { notes: 'private', email: 'private@example.com', token: 'secret', raw_gps: '1,2',
    prompt: 'private', racing_discipline: 'road_course', telemetry_available: true, number_of_images: 2 });
  assert.deepEqual(f.events[0], ['race_setup_saved', { racing_discipline: 'road_course', telemetry_available: true, number_of_images: 2 }]);
  service.attach({ event() { throw Error(); }, screen() { throw Error(); }, identity() { throw Error(); }, collection() { throw Error(); } });
  assert.doesNotThrow(() => { service.identify('uuid'); service.track('race_setup_saved'); service.screen('Settings'); service.configure(false, 'denied'); });
});
test('every registered feature event uses the same consent/filter boundary', () => {
  const service = new controller.AnalyticsController(); const f = sinkFixture();
  service.configure(true, 'granted'); service.attach(f.sink);
  for (const event of controller.ANALYTICS_EVENTS) service.track(event);
  assert.equal(f.events.length, controller.ANALYTICS_EVENTS.length);
  assert.ok(!controller.ANALYTICS_EVENTS.includes('subscription_activated' as controller.AnalyticsEvent));
  assert.ok(!controller.ANALYTICS_EVENTS.includes('ad_impression' as controller.AnalyticsEvent));
});
function nativeFixture(manual = false) {
  const f = sinkFixture(); const ids: unknown[] = []; const consent: unknown[] = []; const properties: unknown[] = [];
  const saved = new Map();
  const storage = { getItem: (key: string) => saved.get(key) || null, setItem: (key: string, value: string) => saved.set(key, value) } as Storage;
  const api: native.MedianAnalyticsEvents = {
    logEvent: args => f.events.push(args), logScreen: args => f.events.push(args), setUser: args => ids.push(args),
    collection: args => f.collection.push(args.enabled), setConsent: args => consent.push(args), setUserProperty: args => properties.push(args),
  };
  return { ...f, ids, consent, properties, api, storage, native: native.createNativeAnalyticsSink(api, storage, 'android', manual) };
}
test('native analytics omits UUID until a supported reset exists; logout disables collection', () => {
  const f = nativeFixture(); f.native.identity('user-a', { subscription_tier: 'pro' }); f.native.collection(true);
  f.native.event('race_setup_saved', {}); assert.equal(f.events.length, 1); assert.deepEqual(f.ids, []);
  f.native.identity(null, {}); f.native.collection(true); f.native.event('race_setup_saved', {});
  assert.equal(f.events.length, 1); assert.equal(f.collection.at(-1), false);
  f.native.identity('user-b', { subscription_tier: 'team' }); f.native.collection(true);
  f.native.event('race_setup_saved', {}); assert.equal(f.events.length, 2); assert.deepEqual(f.ids, []);
  assert.deepEqual(f.consent.at(-1), { adStorage: false, analyticsStorage: true, adUserData: false, adPersonalization: false });
});
test('native screen logging is held until automatic screen tracking is reviewed', () => {
  for (const manual of [false, true]) {
    const f = nativeFixture(manual); f.native.identity('user', {}); f.native.collection(true); f.native.screen('Dashboard');
    assert.equal(f.events.length, manual ? 1 : 0);
  }
});
test('missing native consent or collection methods cannot authorize event logging', () => {
  const f = nativeFixture(); delete f.api.setConsent;
  f.native.identity('user', {}); f.native.collection(true); f.native.event('race_setup_saved', {});
  assert.deepEqual(f.events, []);
});
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
for (const env of [{ ONLYFAST_2027_PREVIEW: true }, { ONLYFAST_DEPLOYMENT_TARGET: 'preview' }]) {
  test('isolated Preview denies inherited Firebase enablement and keeps consent separate from release', async () => {
    const original = { window: globalThis.window, localStorage: globalThis.localStorage };
    const f = nativeFixture(); let webCalls = 0;
    f.storage.setItem('onlyfast_analytics_consent_v1', 'granted');
    Object.assign(globalThis, { window: Object.assign(new EventTarget(), { location: { search: '' } }), localStorage: f.storage });
    try {
      const service = load<typeof import('../src/lib/analytics.ts')>('../src/lib/analytics.ts', {
        './analyticsController': controller, './analyticsNative': native, './nativeEnvironment': environment,
        './trustedMembership': { getTrustedMembership: () => ({ membership_tier: 'factory' }) },
        './classConfigs': { CLASS_CONFIGS: {} }, './setupLibrary': { EXPANDED_CLASS_CONFIGS: {} },
        './analyticsWeb': { createWebAnalyticsSink: async () => { webCalls++; return f.sink; } },
      }, { ...env, VITE_ANALYTICS_ENABLED: 'true' });
      service.startAnalytics(); assert.equal(service.getAnalyticsConsent(), 'unknown');
      service.setAnalyticsConsent('granted'); service.trackEvent('race_setup_saved'); await settle();
      assert.equal(service.analyticsEnabledInBuild(), false); assert.equal(webCalls, 0); assert.deepEqual(f.events, []);
      assert.equal(f.storage.getItem('onlyfast_analytics_consent_preview_v1'), 'granted');
    } finally { Object.assign(globalThis, original); }
  });
}
for (const platform of ['android', 'ios']) test(`Median ${platform} waits for callback, verifies deviceInfo and never loads web Firebase`, async () => {
  const original = { window: globalThis.window, localStorage: globalThis.localStorage };
  const f = nativeFixture(); let deviceCalls = 0; let previousCalls = 0; let webCalls = 0;
  const w = Object.assign(new EventTarget(), {
    location: { search: '', origin: 'https://onlyfast.app' }, localStorage: f.storage,
    median_library_ready: () => previousCalls++, median: {
      deviceInfo: async () => { deviceCalls++; return { appId: 'app.onlyfast', platform }; }, firebaseAnalytics: { event: f.api },
    },
  });
  Object.assign(globalThis, { window: w, localStorage: f.storage });
  try {
    const service = load<typeof import('../src/lib/analytics.ts')>('../src/lib/analytics.ts', {
      './analyticsController': controller, './analyticsNative': native, './nativeEnvironment': environment,
      './trustedMembership': { getTrustedMembership: () => ({ membership_tier: 'rookie' }) },
      './classConfigs': { CLASS_CONFIGS: {} }, './setupLibrary': { EXPANDED_CLASS_CONFIGS: {} },
      './analyticsWeb': { createWebAnalyticsSink: async () => { webCalls++; return f.sink; } },
    }, { VITE_ANALYTICS_ENABLED: 'true' });
    service.startAnalytics(); service.setAnalyticsConsent('granted'); assert.equal(deviceCalls, 0);
    w.median_library_ready(); await settle(); assert.equal(deviceCalls, 1); assert.equal(previousCalls, 1);
    service.trackEvent('race_setup_saved'); assert.equal(f.events.length, 1);
    service.setAnalyticsConsent('denied'); service.trackEvent('race_setup_saved'); assert.equal(f.events.length, 1);
    assert.equal(webCalls, 0);
  } finally { Object.assign(globalThis, original); }
});
test('browser service ignores essential-cookie acceptance, starts web once, and disables immediately on withdrawal', async () => {
  const original = { window: globalThis.window, localStorage: globalThis.localStorage };
  const f = nativeFixture(); f.storage.setItem('onlyfast_cookie_consent', 'accepted');
  const w = Object.assign(new EventTarget(), { location: { search: '', origin: 'https://onlyfast.app' } });
  Object.assign(globalThis, { window: w, localStorage: f.storage });
  let calls = 0;
  try {
    const service = load<typeof import('../src/lib/analytics.ts')>('../src/lib/analytics.ts', {
      './analyticsController': controller, './analyticsNative': native, './nativeEnvironment': environment,
      './trustedMembership': { getTrustedMembership: () => ({ membership_tier: 'pro' }) },
      './classConfigs': { CLASS_CONFIGS: {} }, './setupLibrary': { EXPANDED_CLASS_CONFIGS: {} },
      './analyticsWeb': { createWebAnalyticsSink: async () => { calls++; return f.sink; } },
    }, { VITE_ANALYTICS_ENABLED: 'true' });
    service.startAnalytics(); await settle(); assert.equal(calls, 0);
    service.setAnalyticsConsent('granted'); service.setAnalyticsConsent('granted'); await settle(); assert.equal(calls, 1);
    service.identifyAnalyticsUser('uuid'); service.trackEvent('race_setup_saved'); assert.equal(f.events.length, 1);
    service.setAnalyticsConsent('denied'); service.trackEvent('race_setup_saved'); assert.equal(f.events.length, 1);
    assert.equal(f.collection.at(-1), false);
    assert.deepEqual(f.identities.at(-1), [null, {}]);
    service.setAnalyticsConsent('granted'); await settle(); assert.equal(calls, 1);
    service.identifyAnalyticsUser(null); assert.deepEqual(f.identities.at(-1), [null, { subscription_tier: null }]);
    service.trackScreen('Dashboard');
    const restore = service.enterAnalyticsScreen('Settings');
    restore();
    assert.deepEqual(f.events.slice(-3), [['screen', 'Dashboard'], ['screen', 'Settings'], ['screen', 'Dashboard']]);
  } finally { Object.assign(globalThis, original); }
});
test('web SDK uses isSupported, initializes once, omits page URLs and implements null identity reset', async () => {
  const original = globalThis.window; globalThis.window = { location: { origin: 'https://onlyfast.app' } } as Window;
  const calls: unknown[][] = []; let supported = true;
  const sdk = {
    isSupported: async () => supported, setConsent: (...args: unknown[]) => calls.push(['consent', ...args]),
    initializeAnalytics: (...args: unknown[]) => { calls.push(['init', ...args]); return {}; },
    setAnalyticsCollectionEnabled: (...args: unknown[]) => calls.push(['collection', ...args]),
    setUserId: (...args: unknown[]) => calls.push(['id', ...args]), setUserProperties: (...args: unknown[]) => calls.push(['props', ...args]),
    logEvent: (...args: unknown[]) => calls.push(['event', ...args]),
  };
  const web = load<typeof import('../src/lib/analyticsWeb.ts')>('../src/lib/analyticsWeb.ts', {
    'firebase/app': { getApps: () => [], initializeApp: () => ({}) }, 'firebase/analytics': sdk,
  });
  const config = { apiKey: 'test', authDomain: 'test.firebaseapp.com', projectId: 'test', storageBucket: 'test',
    messagingSenderId: '1', appId: 'test', measurementId: 'G-TEST' };
  try {
    assert.equal(await web.createWebAnalyticsSink({ apiKey: '' }, false), null);
    assert.equal(await web.createWebAnalyticsSink({ ...config, measurementId: '' }, false), null);
    supported = false; assert.equal(await web.createWebAnalyticsSink(config, false), null);
    supported = true;
    assert.equal(await web.createWebAnalyticsSink(config, false, () => false), null);
    const sink = await web.createWebAnalyticsSink(config, true);
    assert.ok(sink); sink.identity('uuid', { subscription_tier: 'pro' }); sink.identity(null, {}); sink.collection(false);
    assert.deepEqual(calls.find(call => call[0] === 'init')?.[2], { config: { send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, page_location: 'https://onlyfast.app/', page_referrer: '', page_title: 'OnlyFast', debug_mode: true } });
    assert.equal(calls.filter(call => call[0] === 'init').length, 1);
    assert.equal(calls.filter(call => call[0] === 'id').at(-1)?.[2], null);
  } finally { globalThis.window = original; }
});
test('actual schedule handler only logs after a successful database operation', async () => {
  for (const fails of [false, true]) {
    const events: string[] = []; const noop = () => {};
    const save = componentFunction('RaceSchedule.tsx', 'handleSave', {
      supabase: { from: () => ({ insert: async () => ({ error: fails ? Error('offline') : null }) }) },
      readOnly: false, setSaving: noop, setFormError: noop, setFormOpen: noop, setEditing: noop, fetchRaces: async () => {},
      onScheduleChanged: noop, trackEvent: (name: string) => events.push(name),
    });
    await save({ race_date: '2026-11-11', track: 'Private Track' });
    assert.deepEqual(events, fails ? [] : ['race_schedule_added']);
  }
});

test('actual Setup Assist handlers distinguish success, server quota, empty response and network failure', async t => {
  t.mock.method(console, 'error', () => {});
  for (const handler of ['getSuggestions', 'askWhatIf']) for (const outcome of ['success', 'quota', 'empty', 'network']) {
    const events: string[] = []; const noop = () => {};
    const run = componentFunction('HandlingFeedback.tsx', handler, {
      assistAdScope: { current: { userId: 'fixture' } }, gateAssist: async () => ({ allowed: true }),
      whatIfQuestion: 'Private question', setLoading: noop, setSuggestions: noop, setSuggestionsReady: noop,
      setWhatIfLoading: noop, setWhatIfResponse: noop, setWhatIfReady: noop, setTelemetryRequestDebug: noop,
      completedAssistAds: { current: {} }, onlyLapsTelemetryEnabled: false, trackTraceTelemetryEnabled: false, onlyfastSessionId: 'private-session',
      requestIdentity: () => ({ request_key: 'private-key', request_id: 'private-request' }), pendingRequestIds: { current: new Map() },
      setupData: { notes: 'private notes' }, entryHandling: 'private', midHandling: 'private', exitHandling: 'private', raceClass: 'Dwarf Cars', discipline: 'dirt_oval',
      supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'secret' } } }) }, functions: { invoke: async () => {
        if (outcome === 'network') throw Error('offline');
        return { data: outcome === 'success' ? { suggestion: 'Private AI response' } : null, error: outcome === 'quota' ? Error('quota') : null };
      } } },
      trackEvent: (name: string, params: object) => { assert.deepEqual(params, { telemetry_available: false }); events.push(name); },
      assistAnalytics: () => ({ telemetry_available: false }), describeInvokeError: async () => ({ status: 429, detail: 'private error' }),
      setAssistNotice: noop, buildErrorMessage: () => 'Failed',
    });
    await run();
    assert.deepEqual(events, ['setup_assist_requested', outcome === 'success' ? 'setup_assist_completed' : 'setup_assist_failed', ...(outcome === 'quota' ? ['setup_assist_limit_reached'] : [])]);
  }
});
test('actual timing scan handler keeps success/failure separate and never sends image data', async () => {
  for (const failed of [false, true]) {
    const events: unknown[] = []; const noop = () => {};
    const scan = componentFunction('ScanTimingScreen.tsx', 'processBatchImage', {
      currentSetupType: 'heat', fileHasSupportedImageType: () => true, MAX_UPLOAD_BYTES: 100,
      MAX_IMAGE_WIDTH: 100, JPEG_QUALITY: 0.8, updateBatchImage: noop, setUploadStatus: noop, setPreviewUrl: noop,
      compressImage: async () => ({ dataUrl: 'private image', base64: 'private bytes', mimeType: 'image/jpeg' }),
      invokeWithTimeout: async () => { if (failed) throw Error('offline'); return {}; },
      handleInvokeResult: async () => ({ lap_times: [] }), devError: noop,
      trackEvent: (name: string, params: object) => events.push([name, params]),
    });
    const result = await scan({ id: 'private-id', sessionId: 'private-session', requestId: 'private-request', file: { name: 'private file', size: 10 } });
    assert.equal(result === null, failed);
    assert.deepEqual(events, [['timing_scan_started', { number_of_images: 1, scan_session_type: 'heat' }],
      [failed ? 'timing_scan_failed' : 'timing_scan_completed', { number_of_images: 1, scan_session_type: 'heat' }]]);
  }
});
test('actual onboarding advance only records selections after progress saves successfully', async () => {
  for (const failed of [false, true]) {
    const events: unknown[] = []; const noop = () => {};
    const advance = componentFunction('OnboardingFlow.tsx', 'advance', {
      pending: { current: false }, step: 2, selectedDiscipline: 'Dirt Track Oval', selectedClass: '',
      disciplines: [{ name: 'Dirt Track Oval', key: 'dirt_oval', enabled: true }], betaAccess: {},
      onProgress: async () => { if (failed) throw Error('offline'); },
      setSaving: noop, setProgressError: noop, setSelectedDiscipline: noop, setSelectedClass: noop, setStep: noop,
      analyticsAttempt: { current: 'attempt' }, trackEvent: (name: string) => events.push(name),
    });
    await advance(3);
    assert.deepEqual(events, failed ? [] : ['onboarding_step_completed', 'racing_discipline_selected']);
  }
});
