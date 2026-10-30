// Builds and inspects the actual production module graph. Never deploys or changes flags.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, loadEnv } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const forbiddenModules = /\/(?:qa|native)\/|\/src\/(?:lib\/(?:releaseNativeBilling|releaseNativeTransport|nativeCatalogDiagnostic)|pages\/(?:NativeSubscriptionTest|OnboardingPreview|RookieAdSlotPreview))\.[cm]?[jt]sx?$/;
const qaContent = /(?:127\.0\.0\.1|localhost):(?:54321|54322|8086)|ngrok-free\.dev|trycloudflare\.com|ONLYFAST_QA_|5ea2a2af-876a-42bb-84cc-4e4319a90a7e|998ee471-0dab-412c-b196-4731c0c46278/;

export function verifyReleaseOutput(output) {
  const files = [];
  for (const entry of output) {
    if (entry.type === 'chunk') {
      for (const id of Object.keys(entry.modules)) {
        assert.ok(!forbiddenModules.test(id.replaceAll('\\', '/')), `Non-release module: ${path.basename(id)}`);
      }
    }
    const bytes = entry.type === 'chunk' ? entry.code : entry.source;
    const text = typeof bytes === 'string' ? bytes : Buffer.from(bytes).toString('utf8');
    assert.ok(!qaContent.test(text), `QA endpoint or identity in ${entry.fileName}`);
    assert.ok(!entry.fileName.endsWith('.map'), 'Do not publish release source maps');
    files.push({ file: entry.fileName, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return files;
}

export function verifyReleaseEnvironment(env) {
  for (const key of ['VITE_SUPABASE_URL', 'VITE_database_URL']) {
    assert.ok(!env[key] || env[key] === 'https://thpyjvwtfvfxiufchrxn.supabase.co', `${key} must target production OnlyFast`);
  }
  assert.ok(!env.VITE_MEDIAN_ADMOB_MODE || ['test', 'production'].includes(env.VITE_MEDIAN_ADMOB_MODE), 'Unknown AdMob mode');
  assert.notEqual(env.VITE_MEDIAN_ADMOB_DIAGNOSTICS, 'true', 'Disable release diagnostic logging');
  if (env.VITE_MEDIAN_ADMOB_ENABLED === 'true' && env.VITE_MEDIAN_ADMOB_MODE === 'production') {
    assert.equal(env.VERCEL_ENV, 'production', 'Live ads require production build provenance');
  }
  if (env.VITE_REVENUECAT_ENABLED === 'true') {
    assert.match(env.VITE_REVENUECAT_ANDROID_API_KEY || '', /^goog_[A-Za-z0-9]+$/, 'Android requires its Play public SDK key');
    assert.match(env.VITE_REVENUECAT_IOS_API_KEY || '', /^appl_[A-Za-z0-9]+$/, 'iOS requires its Apple public SDK key');
  }
}

async function inspectStaticFiles(directory, base = directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, item.name);
    if (item.isDirectory()) { files.push(...await inspectStaticFiles(target, base)); continue; }
    assert.ok(item.isFile(), 'Release files must not be symbolic links');
    const file = path.relative(base, target).replaceAll('\\', '/');
    assert.ok(!/preview|\.map$|\.env|\.(?:p8|p12|pem|key)$/i.test(file), `Non-release file: ${file}`);
    const bytes = await readFile(target);
    if (/\.(?:js|html|json|txt)$/i.test(file)) assert.ok(!qaContent.test(bytes.toString('utf8')), `QA content in ${file}`);
    files.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyReleaseEnvironment({ ...loadEnv('production', root, ''), ...process.env });
  await build({ root, mode: 'production', plugins: [{
    name: 'onlyfast-production-release-check',
    generateBundle(_options, bundle) { verifyReleaseOutput(Object.values(bundle)); },
  }] });
  const files = await inspectStaticFiles(path.join(root, 'dist'));
  const directory = path.join(root, 'tmp/final-production-release');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'web-build-manifest.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), mode: 'production', files,
    note: 'Local build verification only. Store artifacts, native privacy and deployment configuration require separate evidence.',
  }, null, 2) + '\n');
  console.log(`Release output verified: ${files.length} files; manifest: tmp/final-production-release/web-build-manifest.json`);
}
