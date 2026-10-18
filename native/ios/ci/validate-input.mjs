// Local/CI source verification only. Does not execute Xcode or contact services.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectMedianIosSource } from '../../../scripts/inspect-median-ios-source.mjs';

export async function validateCompileInput(source, snapshot) {
  const inspection = await inspectMedianIosSource(source);
  assert.ok(inspection.sourceInspectionPassed, inspection.blockers.join(' '));
  assert.equal(inspection.appConfig.configurationVersion, 16);
  const prepared = JSON.parse(await readFile(path.join(source, 'ONLYFAST_IOS_PREPARATION.json'), 'utf8'));
  assert.equal(prepared.transactionsEnabled, false);
  assert.equal(prepared.sdk, '5.96.0');
  assert.equal(prepared.medianPlugin, '1.1.2');
  const swift = await readFile(path.join(source, 'LeanIOS/OnlyFastBilling.swift'));
  assert.equal(createHash('sha256').update(swift).digest('hex'), prepared.adapterSha256);
  assert.match(swift.toString(), /transactionsEnabled = false/);
  const scheme = await readFile(path.join(source, 'OnlyFast.xcodeproj/xcshareddata/xcschemes/OnlyFast.xcscheme'), 'utf8');
  assert.match(scheme, /BlueprintName = "OnlyFast"/);
  const registry = JSON.parse(await readFile(path.join(source, 'OnlyFast.xcworkspace/xcshareddata/swiftpm/configuration/registries.json'), 'utf8'));
  assert.equal(registry.registries['[default]'].url, 'https://packages.median.co');
  assert.deepEqual(registry.authentication, {});
  const locks = {};
  for (const file of ['.package.resolved', 'OnlyFast.xcworkspace/xcshareddata/swiftpm/Package.resolved']) {
    const lock = JSON.parse(await readFile(path.join(source, file), 'utf8'));
    locks[file] = lock;
    const pins = Object.fromEntries(lock.pins.map(pin => [pin.identity, pin.state.version]));
    for (const [id, version] of Object.entries({ 'median.go-native-core': '3.0.17', 'median.median-icons': '1.2.0',
      'median.revenue-cat-plugin': '1.1.2', 'purchases-ios-spm': '5.96.0', ziparchive: '2.6.0' })) {
      assert.equal(pins[id], version, `Unexpected dependency pin: ${id}`);
    }
  }
  let saved;
  try { saved = JSON.parse(await readFile(snapshot, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (saved) assert.deepEqual(locks, saved, 'Dependency lock changed; stop before compilation/review.');
  else await writeFile(snapshot, JSON.stringify(locks, null, 2), { flag: 'wx' });
  return { verified: true, sdk: '5.96.0', transactionsEnabled: false, compiled: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 4, 'Usage: validate-input.mjs <prepared-ios> <lock-snapshot.json>');
  console.log(JSON.stringify(await validateCompileInput(path.resolve(process.argv[2]), path.resolve(process.argv[3]))));
}
