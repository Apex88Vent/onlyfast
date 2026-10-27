import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectMedianIosSource } from '../scripts/inspect-median-ios-source.mjs';

test('iOS source intake detects wrong identity and missing native plugin without exposing configuration secrets', async () => {
  const root = fileURLToPath(new URL('../tmp/', import.meta.url));
  await mkdir(root, { recursive: true });
  const source = await mkdtemp(path.join(root, 'ios-intake-test-'));
  await mkdir(path.join(source, 'LeanIOS'));
  await mkdir(path.join(source, 'OnlyFast.xcodeproj'));
  await mkdir(path.join(source, 'OnlyFast.xcworkspace'));
  await writeFile(path.join(source, 'LeanIOS/appConfig.json'), JSON.stringify({ general: { iosBundleId: 'co.median.test', publicKey: 'synthetic-private-config-marker' }, services: {} }));
  await writeFile(path.join(source, 'OnlyFast.xcodeproj/project.pbxproj'), 'PRODUCT_BUNDLE_IDENTIFIER = co.median.test; productName = GoNativeCore;');
  await writeFile(path.join(source, 'Project.swift'), '// The builder sets these.\nlet bundleId = Environment.bundleId.getString(default: "io.gonative.ios.dev")\n// MARK: BUILDER_PLUGINS\n// MARK: BUILDER_PLUGIN_DEPENDENCIES');
  await writeFile(path.join(source, 'LeanIOS/MedianIOS-Info.plist'), '<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>');
  const result = await inspectMedianIosSource(source);
  assert.equal(result.sourceInspectionPassed, false);
  assert.equal(result.nativeBuildExecuted, false);
  assert.ok(result.blockers.some(message => message.includes('appConfig')));
  assert.ok(result.blockers.some(message => message.includes('linkage')));
  assert.doesNotMatch(JSON.stringify(result), /synthetic-private-config-marker/);
  assert.equal(result.generationEvidence.templateBundleId, 'io.gonative.ios.dev');
  assert.equal(result.generationEvidence.exportedIdDiffersFromTemplateDefault, true);
  assert.equal(result.generationEvidence.plistUsesBuildSetting, true);
  assert.equal(result.generationEvidence.pluginInjectionMarkersPresent, true);
  assert.equal(result.generationEvidence.liveMedianConfigurationVerified, false);
  assert.equal(result.generationEvidence.bundledRevenueCatJavaScriptPresent, false);

  // Synthetic file fixture, not evidence of an installed/compiled iOS SDK.
  await writeFile(path.join(source, 'LeanIOS/appConfig.json'), JSON.stringify({ general: { iosBundleId: 'app.onlyfast' }, services: { revenueCat: { active: true } } }));
  await writeFile(path.join(source, 'OnlyFast.xcodeproj/project.pbxproj'), 'PRODUCT_BUNDLE_IDENTIFIER = app.onlyfast; PRODUCT_BUNDLE_IDENTIFIER = app.onlyfastTests; productName = RevenueCat;');
  await writeFile(path.join(source, '.package.resolved'), JSON.stringify({ pins: [{ identity: 'purchases-ios', state: { version: '5.0.0' } }] }));
  const ready = await inspectMedianIosSource(source);
  assert.equal(ready.sourceInspectionPassed, true);
  assert.equal(ready.nativeBuildExecuted, false);
  assert.ok(ready.warnings.some(message => message.includes('does not verify signing')));
});
