import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyReleaseEnvironment, verifyReleaseOutput } from '../scripts/verify-production-release.mjs';

const chunk = (module: string, code = 'production code') => ({ type: 'chunk', fileName: 'app.js', modules: { [module]: {} }, code });

test('production artifact check rejects reachable custom bridges, QA controls and tester endpoints', () => {
  for (const name of ['releaseNativeBilling', 'releaseNativeTransport', 'nativeCatalogDiagnostic']) {
    assert.throws(() => verifyReleaseOutput([chunk(`C:/onlyfast/src/lib/${name}.ts`)]), /Non-release module/);
  }
  for (const name of ['NativeSubscriptionTest', 'OnboardingPreview', 'RookieAdSlotPreview']) {
    assert.throws(() => verifyReleaseOutput([chunk(`C:/onlyfast/src/pages/${name}.tsx`)]), /Non-release module/);
  }
  for (const code of ['http://127.0.0.1:54321', 'https://synthesis-small-pastime.ngrok-free.dev', 'ONLYFAST_QA_IOS_KEY']) {
    assert.throws(() => verifyReleaseOutput([chunk('src/App.tsx', code)]), /QA endpoint or identity/);
  }
  assert.equal(verifyReleaseOutput([chunk('C:/onlyfast/src/lib/nativePurchaseController.ts')])[0].sha256.length, 64);
});

test('release environment rejects QA backend, diagnostic logging and missing or wrong-store SDK keys', () => {
  assert.doesNotThrow(() => verifyReleaseEnvironment({}));
  assert.throws(() => verifyReleaseEnvironment({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }), /production OnlyFast/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_MEDIAN_ADMOB_DIAGNOSTICS: 'true' }), /diagnostic/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_MEDIAN_ADMOB_ENABLED: 'true', VITE_MEDIAN_ADMOB_MODE: 'production', VERCEL_ENV: 'preview' }), /provenance/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_REVENUECAT_ENABLED: 'true' }), /Android/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_REVENUECAT_ENABLED: 'true', VITE_REVENUECAT_ANDROID_API_KEY: 'goog_example', VITE_REVENUECAT_IOS_API_KEY: 'test_example' }), /iOS/);
});
