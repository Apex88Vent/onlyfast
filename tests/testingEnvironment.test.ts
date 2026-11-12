import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTestingConnection, verifyTestingConnection } from '../src/lib/testingEnvironment.ts';

const input = { deployment: 'preview', branch: 'develop/onlyfast-2027', url: 'https://mfzajhnfonrfuiwxgvhe.supabase.co', publishableKey: 'sb_publishable_synthetic_test_only' };
test('functional testing connection checks exact provenance, actual endpoint and public key before any request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response('{}'); };
  for (const replacement of [
    { deployment: 'production' }, { branch: 'main' }, { branch: 'other-preview' },
    { url: 'https://thpyjvwtfvfxiufchrxn.supabase.co' },
    { url: input.url + '.evil.invalid' }, { url: input.url + '/rest/v1' },
    { url: 'https://mfzajhnfonrfuiwxgvhe.supabase.co@evil.invalid' },
    { url: '' }, { publishableKey: 'sb_secret_do_not_expose' }, { publishableKey: 'eyJ.legacy.jwt' },
  ]) await assert.rejects(verifyTestingConnection({ ...input, ...replacement }, fetcher), /2027_/);
  assert.equal(calls, 0);
  assert.match(validateTestingConnection(input).storageKey, /mfzajhnfonrfuiwxgvhe/);
});
test('functional testing activation requires the testing backend schema marker and fails closed', async () => {
  for (const body of [null, {}, { project_ref: 'thpyjvwtfvfxiufchrxn', schema_version: 'phase1b-v1' },
    { project_ref: 'mfzajhnfonrfuiwxgvhe', schema_version: 'old' }]) {
    await assert.rejects(verifyTestingConnection(input, async () => new Response(JSON.stringify(body))), /IDENTITY_OR_SCHEMA_MISMATCH/);
  }
  await assert.rejects(verifyTestingConnection(input, async () => new Response('{}', { status: 403 })), /VERIFICATION_FAILED/);
  const result = await verifyTestingConnection(input, async (url, options) => {
    assert.equal(url, input.url + '/rest/v1/rpc/get_onlyfast_2027_environment');
    assert.equal(new Headers(options?.headers).get('apikey'), input.publishableKey);
    return new Response(JSON.stringify({ project_ref: 'mfzajhnfonrfuiwxgvhe', schema_version: 'phase1b-v1' }));
  });
  assert.equal(result.url, input.url);
});
