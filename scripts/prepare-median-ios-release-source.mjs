// Reproducible edits in a NEW copy; never modifies the verified vendor export.
import assert from 'node:assert/strict';
import { access, cp, mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inspectMedianIosSource } from './inspect-median-ios-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
function once(text, pattern, replacement) {
  assert.equal([...text.matchAll(new RegExp(pattern.source, 'gm'))].length, 1, `Vendor anchor changed: ${pattern}`);
  return text.replace(pattern, replacement);
}

export async function prepareMedianIosReleaseSource(sourcePath, outputPath) {
  const source = await realpath(path.resolve(sourcePath));
  const requested = path.resolve(outputPath);
  const output = path.join(await realpath(path.dirname(requested)), path.basename(requested));
  const lower = value => value.toLowerCase();
  assert.ok(lower(source) !== lower(output) && !lower(output).startsWith(lower(source) + path.sep) &&
    !lower(source).startsWith(lower(output) + path.sep), 'Source/output must not overlap.');
  await assert.rejects(access(output), { code: 'ENOENT' });
  const inspection = await inspectMedianIosSource(source);
  assert.ok(inspection.sourceInspectionPassed, 'Source intake failed: ' + inspection.blockers.join(' '));
  assert.equal(inspection.appConfig.configurationVersion, 16, 'Review a changed Median revision before applying hooks.');
  assert.ok(inspection.resolvedPackages.some(pin => pin.identity === 'median.revenue-cat-plugin' && pin.version === '1.1.2'));
  assert.ok(inspection.resolvedPackages.some(pin => pin.identity === 'purchases-ios-spm' && pin.version === '5.96.0'));
  assert.equal(inspection.projects.length, 1);
  const projectPath = path.join(inspection.projects[0], 'project.pbxproj');
  const paths = ['LeanIOS/LEANUtilities.m', 'LeanIOS/LEANWebViewController.m', projectPath];
  const original = await Promise.all(paths.map(file => readFile(path.join(source, file), 'utf8')));
  const adapter = await readFile(path.join(root, 'native/ios/OnlyFastBilling.swift'), 'utf8');
  assert.match(adapter, /transactionsEnabled = false/);
  assert.ok(original.every(text => !text.includes('OnlyFastBilling')), 'Do not apply twice to an already modified export.');
  const utility = once(original[0], /(\+\(void\)configureWebView:\(UIView\*\)wv[\s\S]*?WKWebView \*webview = \(WKWebView\*\)wv;)/,
    '$1\n        [OnlyFastBilling attachToWebView:webview]; // Before navigation, including pooled views.');
  assert.ok(utility.includes('#import "GonativeIO-Swift.h"'));
  const controller = once(original[1], /(- \(void\)addScriptMessageHandlersInWebView:\(WKWebView\*\)wkWebview \{)/,
    '$1\n    [OnlyFastBilling attachToWebView:wkWebview]; // Idempotent across restore/adoption.');
  const fileID = digest('onlyfast.billing.ios.file').slice(0, 24).toUpperCase();
  const buildID = digest('onlyfast.billing.ios.build').slice(0, 24).toUpperCase();
  let project = original[2];
  assert.ok(!project.includes(fileID) && !project.includes(buildID));
  project = once(project, /\/\* End PBXBuildFile section \*\//,
    `\t\t${buildID} /* OnlyFastBilling.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${fileID} /* OnlyFastBilling.swift */; };\n$&`);
  project = once(project, /\/\* End PBXFileReference section \*\//,
    `\t\t${fileID} /* OnlyFastBilling.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LeanIOS/OnlyFastBilling.swift; sourceTree = SOURCE_ROOT; };\n$&`);
  project = once(project, /^(\s*[A-F0-9]+ \/\* LEANUtilities\.m \*\/,)$/m,
    `$1\n\t\t\t\t${fileID} /* OnlyFastBilling.swift */,`);
  project = once(project, /^(\s*[A-F0-9]+ \/\* LEANUtilities\.m in Sources \*\/,)$/m,
    `$1\n\t\t\t\t${buildID} /* OnlyFastBilling.swift in Sources */,`);
  // No signing, bundle-ID, SDK package, lockfile or vendor delegate edits.
  await mkdir(output);
  await cp(source, output, { recursive: true, filter: entry => {
    const parts = path.relative(source, entry).split(path.sep);
    return !parts.some(part => ['.git', '.build', 'build', 'DerivedData'].includes(part)) &&
      !/^(?:\.env(?:\.|$))|\.(?:p8|p12|mobileprovision|keystore|jks)$/.test(path.basename(entry));
  } });
  const changed = [utility, controller, project];
  await Promise.all(paths.map((file, i) => writeFile(path.join(output, file), changed[i])));
  await writeFile(path.join(output, 'LeanIOS/OnlyFastBilling.swift'), adapter);
  const manifest = { source, output, protocol: 1, sourceRevision: 16, sdk: '5.96.0', medianPlugin: '1.1.2',
    transactionsEnabled: false, sourceUntouched: true, sdkDependenciesUnchanged: true, signingUnchanged: true,
    changedNativeFiles: [...paths, 'LeanIOS/OnlyFastBilling.swift'],
    originals: Object.fromEntries(paths.map((file, i) => [file, digest(original[i])])), adapterSha256: digest(adapter),
    compiled: false, runtimeVerified: false };
  await writeFile(path.join(output, 'ONLYFAST_IOS_PREPARATION.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.equal(args.length, 4, 'Usage: --source <verified-ios-dir> --output <NEW-output-dir>');
  assert.equal(args[0], '--source'); assert.equal(args[2], '--output');
  console.log(JSON.stringify(await prepareMedianIosReleaseSource(args[1], args[3]), null, 2));
}
