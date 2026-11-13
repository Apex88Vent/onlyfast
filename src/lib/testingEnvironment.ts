// The testing application must verify these guards before mounting providers.
export const ONLYFAST_TEST_PROJECT = 'mfzajhnfonrfuiwxgvhe';
export const ONLYFAST_TEST_ORGANIZATION = 'wxswxtsewczfijycqnwi';
export const ONLYFAST_TEST_SCHEMA = 'phase1b-v1';

export function testingConnectionInput(env: Record<string, unknown>) {
  return {
    deployment: String(env.ONLYFAST_DEPLOYMENT_TARGET || ''),
    branch: String(env.ONLYFAST_DEPLOYMENT_BRANCH || ''),
    url: String(env.VITE_ONLYFAST_2027_SUPABASE_URL || ''),
    publishableKey: String(env.VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY || ''),
  };
}

export function testingFetch(origin: string, fetcher: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== origin) throw new Error('2027_REQUEST_OUTSIDE_TEST_PROJECT_DENIED');
    return fetcher(input, init);
  };
}

export function validateTestingConnection(input: {
  deployment: string; branch: string; url: string; publishableKey: string;
}) {
  if (input.deployment !== 'preview' || input.branch !== 'develop/onlyfast-2027') {
    throw new Error('2027_BACKEND_REQUIRES_EXACT_PREVIEW_BRANCH');
  }
  const expected = 'https://' + ONLYFAST_TEST_PROJECT + '.supabase.co';
  if (input.url !== expected || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(input.publishableKey)) {
    throw new Error('2027_EXACT_TEST_PROJECT_AND_PUBLISHABLE_KEY_REQUIRED');
  }
  return { url: expected, publishableKey: input.publishableKey, storageKey: 'onlyfast-2027-' + ONLYFAST_TEST_PROJECT + '-auth' };
}

export async function verifyTestingConnection(input: Parameters<typeof validateTestingConnection>[0], fetcher: typeof fetch = fetch) {
  const config = validateTestingConnection(input);
  const response = await fetcher(config.url + '/rest/v1/rpc/get_onlyfast_2027_environment', {
    method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, body: '{}',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('2027_TEST_BACKEND_VERIFICATION_FAILED');
  const evidence = await response.json();
  if (evidence?.project_ref !== ONLYFAST_TEST_PROJECT || evidence?.schema_version !== ONLYFAST_TEST_SCHEMA) {
    throw new Error('2027_TEST_BACKEND_IDENTITY_OR_SCHEMA_MISMATCH');
  }
  return config;
}
