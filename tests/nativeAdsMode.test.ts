import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNativeAdsMode, nativeAdsAccountEnabled } from '../src/lib/nativeAdsMode.ts';
import { GET } from '../api/admob-region.js';

const production = { enabled: 'true', mode: 'production', productionBuild: true, deployment: 'production', origin: 'https://onlyfast.app' };
test('production configuration requires explicit production mode, build provenance and canonical origin', () => {
  assert.equal(resolveNativeAdsMode(production), 'production');
  for (const change of [{ enabled: 'false' }, { enabled: true }, { productionBuild: false }, { deployment: 'preview' },
    { deployment: 'development' }, { deployment: 'local' }, { deployment: undefined }, { origin: 'http://localhost:8080' },
    { origin: 'https://onlyfast-preview.vercel.app' }, { mode: 'unknown' }]) {
    assert.equal(resolveNativeAdsMode({ ...production, ...change }), 'off', JSON.stringify(change));
  }
});

test('only the US production region is approved and responses cannot be cached', async () => {
  const before = process.env.VERCEL_ENV;
  try {
    for (const [deployment, country, expected] of [
      ['production', 'US', 'US'], ['production', 'GB', 'excluded'], ['production', 'DE', 'excluded'],
      ['production', 'CH', 'excluded'], ['production', undefined, 'unknown'], ['production', 'US, GB', 'unknown'],
      ['preview', 'US', 'unknown'],
    ] as const) {
      process.env.VERCEL_ENV = deployment;
      const response = GET(new Request('https://onlyfast.app/api/admob-region?country=US', {
        headers: country ? { 'x-vercel-ip-country': country } : {},
      }));
      assert.deepEqual(await response.json(), { region: expected });
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    }
  } finally {
    if (before === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = before;
  }
});
test('test mode stays explicitly restricted to the existing tester and never grants production-wide access', () => {
  for (const mode of [undefined, '', 'test']) {
    assert.equal(resolveNativeAdsMode({ ...production, mode }), 'test');
  }
  assert.equal(nativeAdsAccountEnabled('test', 'tester', 'tester'), true);
  for (const id of [null, 'other-rookie', 'rookie@test.com']) assert.equal(nativeAdsAccountEnabled('test', id, 'tester'), false);
  assert.equal(nativeAdsAccountEnabled('production', 'any-authenticated-user', 'tester'), true);
  assert.equal(nativeAdsAccountEnabled('production', null, 'tester'), false);
  assert.equal(nativeAdsAccountEnabled('off', 'tester', 'tester'), false);
});

test('controlled Android test rollout requires a canonical production build and never authorizes another account or iOS', () => {
  const config = { ...production, mode: 'android-test' };
  assert.equal(resolveNativeAdsMode(config), 'android-test');
  for (const change of [{ enabled: 'false' }, { enabled: undefined }, { productionBuild: false }, { deployment: 'preview' },
    { deployment: 'development' }, { deployment: 'local' }, { origin: 'https://onlyfast-preview.vercel.app' },
    { origin: 'http://localhost:8080' }]) assert.equal(resolveNativeAdsMode({ ...config, ...change }), 'off');
  assert.equal(nativeAdsAccountEnabled('android-test', 'tester', 'tester', 'android'), true);
  for (const platform of ['android', 'ios', null] as const) {
    for (const id of [null, 'another-rookie', 'rookie@test.com']) {
      assert.equal(nativeAdsAccountEnabled('android-test', id, 'tester', platform), false);
    }
  }
  assert.equal(nativeAdsAccountEnabled('android-test', 'tester', 'tester', 'ios'), false);
  assert.equal(nativeAdsAccountEnabled('android-test', 'tester', 'tester', null), false);
  assert.equal(resolveNativeAdsMode({ ...config, mode: 'off' }), 'off');
});
