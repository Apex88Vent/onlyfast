import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { isMedianIOS, isMedianUserAgent } from '../src/lib/nativeEnvironment.ts';

const environments = [
  { name: 'Median iPhone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Median/1.0', touch: 5, ios: true, native: true },
  { name: 'Median iPad', ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Median/1.0', touch: 5, ios: true, native: true },
  { name: 'Median desktop-mode iPad', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Median/1.0', touch: 5, ios: true, native: true },
  { name: 'Median iOS marker', ua: 'MedianIOS/1.0', touch: 0, ios: true, native: true },
  { name: 'legacy GoNative iOS', ua: 'GoNativeIOS/1.0', touch: 0, ios: true, native: true },
  { name: 'Median Android', ua: 'Mozilla/5.0 (Linux; Android 15) MedianAndroid/1.0', touch: 5, ios: false, native: true },
  { name: 'legacy GoNative Android', ua: 'GoNativeAndroid/1.0', touch: 5, ios: false, native: true },
  { name: 'iPhone Safari', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1', touch: 5, ios: false, native: false },
  { name: 'iPad Safari', ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1', touch: 5, ios: false, native: false },
  { name: 'desktop-mode iPad Safari', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1', touch: 5, ios: false, native: false },
  { name: 'desktop browser', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', touch: 0, ios: false, native: false },
  { name: 'Android browser', ua: 'Mozilla/5.0 (Linux; Android 15) Chrome/130.0', touch: 5, ios: false, native: false },
  { name: 'Mac with Median marker is not iPad', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Median/1.0', touch: 0, ios: false, native: true },
];

const require = createRequire(import.meta.url);
const user = { id: 'test-user', email: 'test@example.com', user_metadata: {} };

// Render the actual components with resolved auth/subscription state. Network and
// lifecycle effects are isolated; assertions check the resulting user-facing HTML.
function renderUI(file: string, states: unknown[], environment: typeof environments[number], props = {}) {
  let stateIndex = 0;
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const module = { exports: {} as { default: React.ComponentType<any> } };
  const localRequire = (id: string) => {
    if (id === 'react') return {
      ...React,
      useState: (initial: unknown) => [stateIndex < states.length ? states[stateIndex++] : initial, () => {}],
      useEffect: () => {},
      useLayoutEffect: () => {},
    };
    if (id === '@/lib/paymentVisibility') return {
      isMedianIOSApp: isMedianIOS(environment.ua, environment.touch),
      hideExternalPayments: isMedianUserAgent(environment.ua),
      nativeBillingMessage: 'Existing Android billing message',
      nativeUpgradeMessage: 'Existing Android upgrade message',
    };
    if (id === '@/lib/nativeAds') return { nativeAds: {
      canRequestConsent: () => isMedianUserAgent(environment.ua) && /android/i.test(environment.ua),
      requestConsent: async () => 'unverified',
    } };
    if (id === 'react-router-dom') return {
      useNavigate: () => () => {}, useLocation: () => ({}),
      Link: ({ to, children }: { to: string; children: React.ReactNode }) => React.createElement('a', { href: to }, children),
    };
    if (id === '@/hooks/useBetaFeatures') return { useBetaFeatures: () => ({ hasBetaFeature: () => false }) };
    if (id === '@/lib/betaFeatures') return { BETA_FEATURES: {} };
    if (id === '@/components/NativeSubscriptionControls') return {
      __esModule: true, default: () => React.createElement('button', {}, 'Existing native subscription controls'),
    };
    if (id === '@/components/PlanSelection') return { __esModule: true, default: () => React.createElement('section', {}, 'Choose Your OnlyFast Plan Rookie Pro Teams Continue Free') };
    if (id === '@/components/StripeBuyButton') return {
      __esModule: true, default: () => React.createElement('button', {}, 'Existing Stripe checkout'),
    };
    if (id.startsWith('@/')) return {};
    return require(id);
  };
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.default, props));
}

for (const environment of environments) {
  test(`${environment.name}: native iOS detection`, () => {
    assert.equal(isMedianIOS(environment.ua, environment.touch), environment.ios);
    assert.equal(isMedianUserAgent(environment.ua), environment.native);
  });

  test(`${environment.name}: support and deletion wording`, () => {
    const support = renderUI('pages/Support.tsx', [], environment);
    const settings = renderUI('components/SettingsModal.tsx',
      ['', '', false, '', { label: 'Pro', row: {} }, false, '', false, false, true, '', '', false],
      environment, { isOpen: true, onClose: () => {}, user });
    assert.match(settings, /href="\/support"[^>]*>Contact Support/);
    assert.match(settings, /Delete Account/);
    if (isMedianUserAgent(environment.ua) && /android/i.test(environment.ua)) {
      assert.match(settings, /Request advertising privacy choices/);
    } else assert.doesNotMatch(settings, /Request advertising privacy choices/);
    assert.match(settings, /Type DELETE to confirm/);
    assert.match(support, /Technical issue/);
    assert.match(support, /Privacy or data request/);
    assert.match(support, /Continue to email/);
    assert.match(support, /href="mailto:admin@onlyfast.app"/);
    if (environment.ios) {
      assert.match(settings, /For technical support, privacy, or data requests\./);
      assert.match(settings, /Permanently delete your OnlyFast account and app data\.</);
      assert.doesNotMatch(settings, /billing|does not cancel an active subscription/i);
      assert.match(support, /Account deletion/);
      assert.doesNotMatch(support, /billing|subscription|stripe|pricing|upgrade|downgrade|purchase/i);
    } else {
      assert.match(settings, /For account, billing, privacy, or data requests\./);
      assert.match(settings, /This does not cancel any active Stripe, Apple, or Google subscription/);
      assert.match(settings, /Deleting your account does not cancel an active Stripe, Apple, or Google subscription/);
      assert.match(support, /Account help/);
      assert.match(support, /Billing or subscription/);
    }
  });

  for (const label of ['Free', 'Pro', 'Teams', 'Admin']) {
    test(`${environment.name}: ${label} subscription UI`, () => {
      const account = { label, row: { stripe_customer_id: label === 'Free' ? null : 'customer' } };
      const settings = renderUI('components/SettingsModal.tsx',
        ['', '', false, '', account, false, '', false, false, false, '', '', false],
        environment, { isOpen: true, onClose: () => {}, user });
      const subscription = settings.match(/<section><h3[^>]*>Subscription<\/h3>(.*?)<\/section>/s)?.[1];
      assert.ok(subscription);
      assert.ok(subscription.includes(label));
      const upgrade = renderUI('pages/Upgrade.tsx', [user, false, false, null, false, account], environment);

      assert.match(subscription, /Current plan/);
      assert.match(subscription, /View Plans and included features/);
      assert.match(upgrade, /Choose Your OnlyFast Plan Rookie Pro Teams Continue Free/);
      if (label !== 'Admin') {
        assert.match(subscription, environment.native ? /Existing native subscription controls/ : /Upgrade Subscription/);
      }
      if (environment.native) assert.doesNotMatch(upgrade, /Existing Stripe checkout/);

    });
  }
}
