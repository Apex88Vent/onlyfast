// Read-only source intake on Windows/macOS. No build, dependency resolution,
// network request, signing, source rewrite or private credential output.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function optional(file) {
  try { return await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function inspectMedianIosSource(directory) {
  const source = path.resolve(directory);
  const entries = await readdir(source, { withFileTypes: true });
  const workspaces = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.xcworkspace')).map(entry => entry.name);
  const projects = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.xcodeproj')).map(entry => entry.name);
  const configText = await optional(path.join(source, 'LeanIOS/appConfig.json'));
  const config = configText ? JSON.parse(configText) : null;
  const dependencyText = await optional(path.join(source, 'dependencies.json'));
  const dependencies = dependencyText ? JSON.parse(dependencyText) : {};
  const manifest = await optional(path.join(source, 'Project.swift')) || '';
  const projectTexts = await Promise.all(projects.map(project => optional(path.join(source, project, 'project.pbxproj'))));
  const pbx = projectTexts.filter(Boolean).join('\n');
  const lockPaths = ['.package.resolved', ...workspaces.map(workspace => path.join(workspace, 'xcshareddata/swiftpm/Package.resolved'))];
  const pins = [];
  for (const file of lockPaths) {
    const text = await optional(path.join(source, file));
    if (text) for (const pin of JSON.parse(text).pins || []) {
      if (!pins.some(item => item.identity === pin.identity && item.version === pin.state?.version)) {
        pins.push({ identity: pin.identity, version: pin.state?.version || null });
      }
    }
  }
  const bundleCandidates = [...new Set([...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?([^";\s]+)"?;/g)]
    .map(match => match[1]).filter(value => !/Tests$/.test(value)))];
  const linkedProducts = [...new Set([...pbx.matchAll(/productName\s*=\s*"?([^";\s]+)"?;/g)].map(match => match[1]))];
  const revenueCatPins = pins.filter(pin => /revenue.?cat|purchases-ios/i.test(pin.identity));
  const revenueCatLinkage = linkedProducts.some(name => /revenue.?cat|purchases/i.test(name)) ||
    /(?:package|product|url)[^\n]*?(?:revenue.?cat|purchases-ios)/i.test(manifest + '\n' + pbx);
  const controller = await optional(path.join(source, 'LeanIOS/LEANWebViewController.m')) || '';
  const bundledBridge = await optional(path.join(source, 'LeanIOS/GoNativeJSBridgeLibrary.js')) || '';
  const infoPlist = await optional(path.join(source, 'LeanIOS/MedianIOS-Info.plist')) || '';
  const templateBundleId = manifest.match(/Environment\.bundleId\.getString\(default:\s*"([^"]+)"\)/)?.[1] || null;
  const blockers = [];
  if (!workspaces.length || !projects.length) blockers.push('Median Xcode workspace/project is missing.');
  if (config?.general?.iosBundleId !== 'app.onlyfast') blockers.push('Export appConfig iOS bundle ID does not match registered app.onlyfast.');
  if (!bundleCandidates.includes('app.onlyfast')) blockers.push('Generated Xcode app bundle ID does not match registered app.onlyfast.');
  if (config?.services?.revenueCat?.active !== true) blockers.push('Export does not confirm RevenueCat plugin enabled.');
  if (!revenueCatLinkage) blockers.push('Generated project/manifests do not show RevenueCat native linkage.');
  if (!revenueCatPins.length || revenueCatPins.some(pin => !pin.version)) blockers.push('Installed RevenueCat iOS SDK/plugin version cannot be established from resolved dependencies.');
  const warnings = [];
  const core = pins.find(pin => pin.identity === 'median.go-native-core');
  if (dependencies.core && core?.version && dependencies.core !== core.version) warnings.push('dependencies.json core metadata differs from resolved GoNativeCore version.');
  if (/default:\s*"io\.gonative\.ios\.dev"/.test(manifest)) warnings.push('Tuist template defaults to a development bundle ID: preserve reviewed builder environment when regenerating.');
  warnings.push('Source inspection does not verify signing, In-App Purchase provisioning, compilation, runtime or StoreKit transactions.');
  return { source, expectedBundleId: 'app.onlyfast', workspaces, projects,
    appConfig: { iosBundleId: config?.general?.iosBundleId || null, initialUrl: config?.general?.initialUrl || null,
      configurationVersion: config?.general?.version ?? null,
      injectMedianJS: config?.general?.injectMedianJS === true, revenueCatActive: config?.services?.revenueCat?.active === true },
    generationEvidence: { templateBundleId, builderEnvironmentDocumented: /builder sets these/.test(manifest),
      exportedIdDiffersFromTemplateDefault: !!config?.general?.iosBundleId && !!templateBundleId && config.general.iosBundleId !== templateBundleId,
      plistUsesBuildSetting: /<key>CFBundleIdentifier<\/key>\s*<string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/.test(infoPlist),
      pluginInjectionMarkersPresent: manifest.includes('MARK: BUILDER_PLUGINS') && manifest.includes('MARK: BUILDER_PLUGIN_DEPENDENCIES'),
      bundledRevenueCatJavaScriptPresent: /revenuecat/i.test(bundledBridge),
      liveMedianConfigurationVerified: false },
    bundleCandidates, buildSystem: manifest ? 'Tuist / Swift Package Manager' : 'Inspect workspace dependencies',
    dependencyMetadataCore: dependencies.core || null, pluginMetadataNames: Object.keys(dependencies.plugins || {}),
    resolvedPackages: pins, revenueCatLinkage, linkedProducts,
    lifecycleAnchors: ['initializeWebview', 'addScriptMessageHandlersInWebView:', 'switchToWebView:']
      .filter(anchor => controller.includes(anchor)),
    sourceInspectionPassed: blockers.length === 0, blockers, warnings, nativeBuildExecuted: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error('Usage: node scripts/inspect-median-ios-source.mjs <extracted-ios-directory>');
  const result = await inspectMedianIosSource(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.sourceInspectionPassed ? 0 : 2;
}
