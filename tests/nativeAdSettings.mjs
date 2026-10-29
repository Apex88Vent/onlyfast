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
  let view;
  const calls = [];
  const bridge = {
    banner: { enable: () => calls.push('enable'), disable: () => calls.push('disable') },
    request: { consent: async () => ({ result: true }) },
  };
  const controller = new native.NativeAdsController({
    enabled: uid => uid === id, eligible: uid => uid === currentId && eligible,
    userAgent: () => 'MedianAndroid/1.0', bridge: () => bridge,
    storage: () => ({ getItem: () => null, setItem: () => {} }), now: Date.now,
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
    await act(async () => { view.update(React.createElement(Settings, props)); });
    assert.equal(value('Banner request sent'), 'Yes');
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
