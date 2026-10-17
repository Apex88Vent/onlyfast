import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('Median source preparation preserves source, excludes debug/credentials, and refuses overwrites or unapproved URLs', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  await mkdir(path.join(root, 'tmp'), { recursive: true });
  const testRoot = await mkdtemp(path.join(root, 'tmp', 'median-preparation-test-'));
  const source = path.join(testRoot, 'vendor');
  const output = path.join(testRoot, 'prepared');
  const activity = 'app/src/main/java/co/median/android/MainActivity.java';
  const files = {
    [activity]: 'vendorWebViewSetup();\n        setupWebviewTheme(appTheme);\nloadInitialUrl();',
    'app/build.gradle': 'android { defaultConfig { applicationId "app.onlyfast" } }',
    'app/src/main/assets/appConfig.json': JSON.stringify({ general: { androidPackageName: 'app.onlyfast', initialUrl: 'https://onlyfast.app/' }, services: { revenueCat: { active: true } } }),
    'app/src/debug/DebugOnly.kt': 'synthetic debug code',
    'diagnostics/local.env': 'synthetic credential marker',
    '.env.local': 'synthetic credential marker',
    'app/release.jks': 'synthetic signing marker',
    'app/build/generated.txt': 'synthetic generated marker',
    'app/src/main/java/vendor/PhotoPicker.java': 'vendor picker marker',
  };
  for (const [name, value] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(source, name)), { recursive: true });
    await writeFile(path.join(source, name), value);
  }
  const run = (destination: string) => spawnSync(process.execPath, [path.join(root, 'scripts/prepare-median-release-source.mjs'), '--source', source, '--output', destination], { encoding: 'utf8' });
  assert.equal(run(output).status, 0);
  for (const [name, value] of Object.entries(files)) assert.equal(await readFile(path.join(source, name), 'utf8'), value);
  for (const excluded of ['app/src/debug', 'diagnostics', '.env.local', 'app/release.jks', 'app/build']) {
    await assert.rejects(access(path.join(output, excluded)), { code: 'ENOENT' });
  }
  const patched = await readFile(path.join(output, activity), 'utf8');
  assert.ok(patched.indexOf('OnlyFastBilling.attach') < patched.indexOf('setupWebviewTheme'));
  assert.ok(patched.indexOf('OnlyFastBilling.attach') > patched.indexOf('vendorWebViewSetup'));
  assert.equal(await readFile(path.join(output, 'app/src/main/java/vendor/PhotoPicker.java'), 'utf8'), 'vendor picker marker');
  assert.match(await readFile(path.join(output, 'app/src/main/java/app/onlyfast/billing/OnlyFastBilling.kt'), 'utf8'), /TRANSACTIONS_ENABLED = false/);
  assert.notEqual(run(output).status, 0);
  assert.notEqual(run(path.join(source, 'unsafe-nested-output')).status, 0);
  const configPath = path.join(source, 'app/src/main/assets/appConfig.json');
  const config = JSON.parse(files['app/src/main/assets/appConfig.json']);
  config.general.initialUrl = 'http://127.0.0.1:8086/';
  await writeFile(configPath, JSON.stringify(config));
  const rejected = path.join(testRoot, 'rejected');
  assert.notEqual(run(rejected).status, 0);
  await assert.rejects(access(rejected), { code: 'ENOENT' });
});
