import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNativeAdsMode, nativeAdsAccountEnabled } from '../src/lib/nativeAdsMode.ts';

const production = { enabled: 'true', mode: 'production', productionBuild: true, deployment: 'production', origin: 'https://onlyfast.app' };
test('live ads require an explicit production mode, production build provenance and the canonical production origin', () => {
  assert.equal(resolveNativeAdsMode(production), 'production');
  for (const change of [{ enabled: 'false' }, { enabled: true }, { productionBuild: false }, { deployment: 'preview' },
    { deployment: 'development' }, { deployment: 'local' }, { deployment: undefined }, { origin: 'http://localhost:8080' },
    { origin: 'https://onlyfast-preview.vercel.app' }, { mode: 'unknown' }]) {
    assert.equal(resolveNativeAdsMode({ ...production, ...change }), 'off', JSON.stringify(change));
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
