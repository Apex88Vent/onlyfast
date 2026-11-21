import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyReleaseEnvironment, verifyReleaseOutput, verifyRetainedWebAssets } from '../scripts/verify-production-release.mjs';

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
  assert.throws(() => verifyReleaseOutput([chunk('src/lib/nativeAds.ts', 'onlyfast-admob-v1-android-release')]), /Experimental AdMob bridge/);
  assert.throws(() => verifyReleaseOutput([chunk('src/App.tsx', 'get_onlyfast_2027_environment')]), /2027 preview code/);
  assert.equal(verifyReleaseOutput([chunk('C:/onlyfast/src/lib/nativePurchaseController.ts')])[0].sha256.length, 64);
});

test('production sources contain both archived dashboard graphs with their original bytes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../scripts/retained-web-assets.json', import.meta.url), 'utf8'));
  assert(manifest.deployments.every(deployment => deployment.assets.some(asset => asset.startsWith('SetupDashboard-'))));
  assert.equal(await verifyRetainedWebAssets(fileURLToPath(new URL('../public', import.meta.url)), manifest), Object.keys(manifest.files).length);
});

test('the build gate rejects a missing or overwritten retained asset', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'onlyfast-retained-'));
  try {
    const asset = 'SetupDashboard-12345678.js';
    const bytes = 'export default function Dashboard() {}';
    const manifest = { deployments: [{ assets: [asset] }], files: { [asset]: createHash('sha256').update(bytes).digest('hex') } };
    await mkdir(join(directory, 'assets'));
    await assert.rejects(verifyRetainedWebAssets(directory, manifest), { code: 'ENOENT' });
    await writeFile(join(directory, 'assets', asset), bytes);
    assert.equal(await verifyRetainedWebAssets(directory, manifest), 1);
    await writeFile(join(directory, 'assets', asset), '<!DOCTYPE html>');
    await assert.rejects(verifyRetainedWebAssets(directory, manifest), /Retained asset changed/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('release environment rejects QA backend, diagnostic logging and missing or wrong-store SDK keys', () => {
  assert.doesNotThrow(() => verifyReleaseEnvironment({}));
  assert.throws(() => verifyReleaseEnvironment({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }), /production OnlyFast/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_MEDIAN_ADMOB_DIAGNOSTICS: 'true' }), /diagnostic/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_MEDIAN_ADMOB_ENABLED: 'true', VITE_MEDIAN_ADMOB_MODE: 'production', VERCEL_ENV: 'preview' }), /provenance/);
  assert.doesNotThrow(() => verifyReleaseEnvironment({ VITE_MEDIAN_ADMOB_ENABLED: 'true', VITE_MEDIAN_ADMOB_MODE: 'android-test', VITE_MEDIAN_ADMOB_DIAGNOSTICS: 'false', VERCEL_ENV: 'production' }));
  assert.throws(() => verifyReleaseEnvironment({ VITE_MEDIAN_ADMOB_ENABLED: 'true', VITE_MEDIAN_ADMOB_MODE: 'android-test', VERCEL_ENV: 'preview' }), /provenance/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_MEDIAN_ADMOB_MODE: 'unrestricted-test' }), /Unknown AdMob mode/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_REVENUECAT_ENABLED: 'true' }), /Android/);
  assert.throws(() => verifyReleaseEnvironment({ VITE_REVENUECAT_ENABLED: 'true', VITE_REVENUECAT_ANDROID_API_KEY: 'goog_example', VITE_REVENUECAT_IOS_API_KEY: 'test_example' }), /iOS/);
});
