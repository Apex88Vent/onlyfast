import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

export const FIREBASE_PUBLIC_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_MEASUREMENT_ID',
];

/** January checklist guard: does not build, publish, contact Firebase or change flags. */
export function verifyAnalyticsEnvironment(env, release = false) {
  if (release) assert.equal(env.VITE_ANALYTICS_ENABLED, 'true', 'January analytics release requires VITE_ANALYTICS_ENABLED=true; consent is still required.');
  if (env.VITE_ANALYTICS_ENABLED !== 'true') return;
  for (const key of FIREBASE_PUBLIC_ENV_KEYS) assert.ok(typeof env[key] === 'string' && env[key].trim(), 'Missing public Firebase configuration: ' + key);
  assert.match(env.VITE_FIREBASE_MEASUREMENT_ID, /^G-[A-Z0-9]+$/, 'Expected a GA4 web measurement ID.');
}

export async function verifyAnalyticsSources(root) {
  const read = file => readFile(path.join(root, file), 'utf8');
  const [pkg, entry, app, service, native] = await Promise.all([
    read('package.json'), read('src/main.tsx'), read('src/App.tsx'), read('src/lib/analytics.ts'), read('src/lib/analyticsNative.ts'),
  ]);
  assert.ok(JSON.parse(pkg).dependencies?.firebase, 'Firebase dependency is missing from this iteration.');
  const startup = entry.indexOf('startAnalytics();');
  const split = entry.indexOf('if (import.meta.env.ONLYFAST_2027_PREVIEW');
  assert.ok(startup >= 0 && split > startup, 'Analytics startup must remain shared by current and 2027 app entries.');
  assert.match(app, /<AnalyticsLifecycle\s*\/>/, 'The mounted app must observe auth/screens.');
  for (const key of FIREBASE_PUBLIC_ENV_KEYS) assert.ok(service.includes(key), 'Firebase configuration wiring missing: ' + key);
  assert.ok(service.includes('median_library_ready'), 'Median readiness integration is missing.');
  assert.ok(native.includes('setConsent') && native.includes('collection'), 'Native consent controls are missing.');
  await Promise.all(['analyticsController.ts', 'analyticsWeb.ts'].map(file => read('src/lib/' + file)));
  await read('src/components/AnalyticsPrivacyControl.tsx');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const release = process.argv.includes('--release');
  await verifyAnalyticsSources(root);
  verifyAnalyticsEnvironment({ ...loadEnv('production', root, ''), ...process.env }, release);
  console.log(release ? 'Analytics release configuration checked locally; consent, Median device tests and authorized deployment still required.' : 'Analytics source carryover verified; no deployment or collection enabled.');
}
