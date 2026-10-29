// Mounted Settings test using the existing external React QA renderer. No native ads/network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const qaRequire = createRequire(process.env.REACT_TEST_RENDERER_MODULE);
const React = qaRequire('react');
const { create, act } = qaRequire(process.env.REACT_TEST_RENDERER_MODULE);
const text = node => node == null ? '' : typeof node === 'string' ? node :
  Array.isArray(node) ? node.map(text).join(' ') : (node.children || []).map(text).join(' ');
function compile(file, modules) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').replaceAll('import.meta.env', '({})');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in modules) return modules[name];
    if (name === 'react' || name.startsWith('react/')) return qaRequire(name);
    throw Error(`Unstubbed Settings dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const native = compile('lib/nativeAds.ts', {
  './ads': { shouldShowAds: () => false },
  './nativeEnvironment': { isMedianUserAgent: ua => /Median/.test(ua), nativePlatform: () => 'android' },
  './trustedMembership': {},
  './supabase': { supabase: {} },
});

test('actual Settings status stays live, reveals no IDs, remains suspended, and disappears on account switching', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const id = native.NATIVE_ADS_ROLLOUT_USER_ID;
  let currentId = id;
  let eligible = true;
  let device = false;
  let deviceStatus = 'advertising-id-unavailable';
  const cooldownStorage = new Map();
  let now = 1_000_000;
  let view;
  const calls = [];
  const bridge = {
    banner: { enable: () => calls.push('enable'), disable: () => calls.push('disable') },
    showInterstitialIfReady: () => calls.push('interstitial'),
    request: { consent: async () => ({ result: true }) },
  };
  const controller = new native.NativeAdsController({
    enabled: uid => uid === id, eligible: uid => uid === currentId && eligible,
    userAgent: () => 'MedianAndroid/1.0', bridge: () => bridge,
    storage: () => ({ getItem: key => cooldownStorage.get(key) ?? null, setItem: (key, value) => cooldownStorage.set(key, value) }), now: () => now,
    deviceAllowed: () => device, deviceStatus: () => deviceStatus,
  });
  const user = { id, email: 'rookie@test.com', user_metadata: {} };
  const Settings = compile('components/SettingsModal.tsx', {
    '@/lib/nativeAds': { nativeAds: controller, NATIVE_ADS_ROLLOUT_USER_ID: id },
    '@/components/NativeSubscriptionControls': { __esModule: true, default: () => null },
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: currentId } } } }) } } },
    '@/lib/subscription': { fetchUserSubscription: async () => null, deriveAccountStatus: () => ({ label: 'Free', row: null }) },
    '@/lib/paymentVisibility': { hideExternalPayments: true, isMedianIOSApp: false },
    '@/hooks/useBetaFeatures': { useBetaFeatures: () => ({ hasBetaFeature: () => false }) },
    '@/lib/betaFeatures': { BETA_FEATURES: {} },
    'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
  }).default;
  const props = { isOpen: true, user, onClose: () => {} };
  const status = () => view.root.findAllByProps({ 'aria-label': 'AdMob test status' });
  const value = label => {
    const section = status()[0];
    const index = section.findAllByType('dt').findIndex(node => text(node) === label);
    assert.ok(index >= 0); return text(section.findAllByType('dd')[index]);
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    body: { style: {} }, addEventListener() {}, removeEventListener() {},
  } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  try {
    controller.setUser(id); controller.setForeground(true); controller.setRouteSupported(true); controller.setPlacement(id, 'home');
    await controller.requestConsent();
    await act(async () => { view = create(React.createElement(Settings, props)); });
    assert.equal(value('Advertising enabled'), 'Yes'); assert.equal(value('Rookie eligible'), 'Yes');
    assert.equal(value('Median bridge available'), 'Yes'); assert.equal(value('Device verification'), 'advertising-id-unavailable');
    assert.equal(value('Native consent'), 'Completed (permission unverified)'); assert.equal(value('Banner request sent'), 'No');
    assert.match(text(status()[0]), /Settings pauses native banners/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()), /gaid|idfa|installationId|58a1db2f|b852c516|result/);
    await act(async () => { device = true; deviceStatus = 'matched'; controller.refresh(); });
    assert.equal(value('Device verification'), 'matched'); assert.equal(value('Banner request sent'), 'No');
    assert.ok(!calls.includes('enable'), 'Settings must continue suspending native banners');
    await act(async () => { view.update(React.createElement(Settings, { ...props, isOpen: false })); });
    assert.ok(calls.includes('enable'));
    controller.completeManualSave(controller.beginManualSave(id), { persisted: true, queued: false, editing: false });
    await act(async () => { view.update(React.createElement(Settings, props)); });
    assert.equal(value('Banner request sent'), 'Yes');
    assert.equal(value('Last interstitial trigger'), 'manual-save');
    assert.equal(value('Interstitial request sent'), 'Yes');
    assert.equal(value('Interstitial suppression'), 'None');
    assert.equal(value('Shared cooldown remaining'), '600 seconds');
    await act(async () => { now += 1000; controller.refresh(); });
    assert.equal(value('Shared cooldown remaining'), '599 seconds');
    assert.match(text(status()[0]), /Google ad display is not confirmed/);
    await act(async () => { eligible = false; controller.refresh(); });
    assert.equal(value('Rookie eligible'), 'No');
    assert.match(text(status()[0]), /membership-not-verified-rookie/);
    await act(async () => { currentId = 'other-rookie'; controller.setUser(currentId); });
    assert.equal(status().length, 0, 'stale Settings props cannot expose another account snapshot');
    await act(async () => { view.update(React.createElement(Settings, { ...props, user: { ...user, id: currentId } })); });
    assert.equal(status().length, 0, 'a matching email does not authorize diagnostics');
  } finally {
    if (view) await act(async () => view.unmount());
    controller.stop();
    for (const [name, previous] of [['window', oldWindow], ['document', oldDocument], ['localStorage', oldStorage]]) {
      if (previous) Object.defineProperty(globalThis, name, previous); else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test('mounted house tiles yield only to the confirmed native session and return when its native experience becomes unavailable', async () => {
  const id = native.NATIVE_ADS_ROLLOUT_USER_ID;
  let enabled = true;
  let eligible = true;
  let device = 'matched';
  const bridge = { banner: { enable() {}, disable() {} }, request: { consent: async () => ({ result: true }) } };
  let availableBridge = bridge;
  const controller = new native.NativeAdsController({
    enabled: uid => enabled && uid === id, eligible: () => eligible,
    userAgent: () => 'MedianAndroid/1.0', bridge: () => availableBridge,
    storage: () => ({ getItem: () => null, setItem() {} }), now: Date.now,
    deviceAllowed: () => true, deviceStatus: () => device,
  });
  controller.setUser(id); controller.setForeground(true); controller.setRouteSupported(true);
  controller.setPlacement(id, 'home'); await controller.requestConsent();
  const Slot = compile('components/RookieAdSlot.tsx', {
    '@/lib/ads': { shouldShowAds: user => !!user && eligible },
    '@/lib/paymentVisibility': { isMedianIOSApp: false },
    '@/hooks/useMembershipRevision': { useMembershipRevision() {} },
    '@/lib/nativeAds': { nativeAds: controller },
    './RookieHouseAdContent': { __esModule: true, default: () => React.createElement('aside', {}, 'House ad') },
  }).default;
  let view;
  let props = { placement: 'home_middle', user: { id } };
  const houses = () => view.root.findAllByType('aside').length;
  try {
    await act(async () => { view = create(React.createElement(Slot, props)); });
    assert.equal(controller.getDiagnostics().bannerCommandDispatched, true);
    assert.equal(houses(), 1); // A command/GAID match alone does not replace house content.
    await act(async () => { device = 'registered-phone-session'; controller.refresh(); });
    assert.equal(houses(), 0);
    for (const placement of ['home_middle', 'home_bottom', 'schedule_bottom', 'setup_dashboard_bottom']) {
      await act(async () => { props = { ...props, placement }; view.update(React.createElement(Slot, props)); });
      assert.equal(houses(), 0);
    }
    await act(async () => { props = { ...props, placement: 'after_save_interstitial' }; view.update(React.createElement(Slot, props)); });
    assert.equal(houses(), 1); // Existing separate post-save fallback is preserved.
    await act(async () => { props = { ...props, placement: 'home_middle' }; view.update(React.createElement(Slot, props)); });
    let resume;
    await act(async () => { resume = controller.suspend(); }); assert.equal(houses(), 1);
    await act(async () => { resume(); }); assert.equal(houses(), 0);
    await act(async () => { enabled = false; controller.refresh(); }); assert.equal(houses(), 1);
    await act(async () => { enabled = true; controller.refresh(); }); assert.equal(houses(), 0);
    await act(async () => { availableBridge = undefined; controller.refresh(); }); assert.equal(houses(), 1);
    await act(async () => { controller.setUser('other-rookie'); props = { ...props, user: { id: 'other-rookie' } }; view.update(React.createElement(Slot, props)); });
    assert.equal(houses(), 1);
    await act(async () => { eligible = false; controller.refresh(); view.update(React.createElement(Slot, props)); });
    assert.equal(houses(), 0);
    await act(async () => { props = { ...props, user: null }; view.update(React.createElement(Slot, props)); }); assert.equal(houses(), 0);
  } finally { await act(async () => { view?.unmount(); }); controller.stop(); }
});

test('real Assist answers remain readable before dismissal; generation, failures, usage limits and changed owners cannot produce ads', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  const id = native.NATIVE_ADS_ROLLOUT_USER_ID;
  const storage = new Map();
  let view;
  let requests = 0;
  let used = 0;
  let mode = 'success';
  let resolveResponse;
  let ads = 0;
  const bridge = { banner: { enable() {}, disable() {} }, request: { consent: async () => ({ result: true }) },
    showInterstitialIfReady() {
      // The real result is already removed from the committed component tree.
      assert.equal(view.root.findAllByProps({ 'aria-label': 'AI setup suggestions' }).length, 0);
      ads++;
    },
  };
  const controller = new native.NativeAdsController({
    enabled: uid => uid === id, eligible: uid => uid === id,
    userAgent: () => 'MedianAndroid/1.0', bridge: () => bridge,
    storage: () => ({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }), now: () => 1_000_000,
    deviceAllowed: () => true, deviceStatus: () => 'registered-phone-session',
  });
  controller.setUser(id); controller.setForeground(true); controller.setRouteSupported(true);
  controller.setPlacement(id, 'setup'); await controller.requestConsent();
  const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { used_count: used } }) };
  const Feedback = compile('components/HandlingFeedback.tsx', {
    '@/lib/nativeAds': { nativeAds: controller },
    '@/lib/supabase': { supabase: {
      from: () => query, auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) },
      functions: { invoke: async () => { requests++; return mode === 'delay' ? new Promise(resolve => { resolveResponse = resolve; }) :
        mode === 'success' ? { data: { suggestion: 'Useful completed answer' }, error: null } : { data: null, error: null }; } },
    } },
    '@/lib/membership': { readMembership: () => ({}), getEffectiveTier: () => 'rookie',
      checkSetupAssistPermission: (_tier, count) => ({ allowed: count < 1, upgradeText: 'Existing usage limit' }) },
    '@/hooks/useMembershipRevision': { useMembershipRevision() {} },
    '@/lib/onlylapsSessionScope': { ONLYLAPS_SESSION_LINK_CHANGED_EVENT: 'fixture-link' },
    '@/lib/setupLibrary': { EXPANDED_CLASS_CONFIGS: {} },
    '@/lib/roadTrackFeedback': {},
    './LockedFeatureNotice': { __esModule: true, default: ({ message }) => React.createElement('p', {}, message) },
  }).default;
  let props = { user: { id }, raceWeekendKey: 'Saved Weekend', onlyfastSessionId: 'saved-row',
    setupData: {}, raceClass: 'dirt', entryHandling: 'loose', midHandling: '', exitHandling: '' };
  const buttons = () => view.root.findAllByType('button');
  const suggest = () => buttons().find(button => text(button).includes('Get Setup Suggestions'));
  const dismiss = () => buttons().find(button => text(button) === 'Dismiss result');
  try {
    await act(async () => { view = create(React.createElement(Feedback, props)); });
    mode = 'delay'; let pending;
    await act(async () => { pending = suggest().props.onClick(); });
    assert.equal(dismiss(), undefined); assert.equal(ads, 0);
    assert.equal(controller.getDiagnostics().overlayOpen, true, 'native ads suspended throughout generation');
    await act(async () => { resolveResponse({ data: { suggestion: 'Useful completed answer' }, error: null }); await pending; });
    assert.match(text(view.toJSON()), /Useful completed answer/); assert.equal(ads, 0);
    controller.noteActivity(); // The real pointer-down on Dismiss precedes creation of its ticket.
    await act(async () => { dismiss().props.onClick(); });
    assert.equal(ads, 1); assert.equal(controller.getDiagnostics().lastInterstitialTrigger, 'setup-assist');
    assert.equal(controller.getDiagnostics().interstitialCooldownRemainingMs, 600_000);
    mode = 'success';
    await act(async () => { buttons().find(button => text(button).trim() === 'What If?').props.onClick(); });
    await act(async () => { view.root.findByProps({ placeholder: 'What if I changed the right rear spring to 200 lbs?' }).props.onChange({ target: { value: 'Change spring?' } }); });
    await act(async () => { await buttons().find(button => text(button).trim() === 'Ask').props.onClick(); });
    assert.match(text(view.toJSON()), /Useful completed answer/); assert.equal(ads, 1);
    await act(async () => { dismiss().props.onClick(); });
    assert.equal(ads, 1); assert.equal(controller.getDiagnostics().lastInterstitialSuppression, 'cooldown');
    mode = 'empty'; await act(async () => { await suggest().props.onClick(); });
    assert.equal(dismiss(), undefined); assert.equal(ads, 1);
    const previousRequests = requests; used = 1;
    await act(async () => { await suggest().props.onClick(); });
    assert.equal(requests, previousRequests); assert.match(text(view.toJSON()), /Existing usage limit/);
    used = 0; mode = 'delay';
    await act(async () => { pending = suggest().props.onClick(); });
    await act(async () => { controller.setUser('other'); props = { ...props, user: { id: 'other' } }; view.update(React.createElement(Feedback, props)); });
    await act(async () => { resolveResponse({ data: { suggestion: 'Late previous-owner answer' }, error: null }); await pending; });
    await act(async () => { dismiss().props.onClick(); });
    assert.equal(ads, 1, 'late result must never authorize an ad for the replacement account');
  } finally {
    await act(async () => { view?.unmount(); }); controller.stop();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
