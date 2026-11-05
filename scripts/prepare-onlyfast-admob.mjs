import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

// Run against a fresh extraction. The original archives and vendor binaries are read-only.
const [platform, directory, option] = process.argv.slice(2);
if (!['android', 'ios'].includes(platform) || !directory ||
    (option !== undefined && (platform !== 'android' || !['--qa', '--release'].includes(option)))) {
  throw new Error('Usage: node scripts/prepare-onlyfast-admob.mjs android|ios EXTRACTED_PROJECT [--qa|--release]');
}
const root = resolve(directory);
const input = path => readFileSync(join(root, path), 'utf8').replaceAll('\r\n', '\n');
const source = path => new URL(`../native/${platform}/${path}`, import.meta.url);
const configPath = platform === 'android' ? 'app/src/main/assets/appConfig.json' : 'LeanIOS/appConfig.json';
const config = JSON.parse(input(configPath));
const units = config.services?.admob?.[platform === 'android' ? 'admobAndroid' : 'admobIos'];
const deps = JSON.parse(input('dependencies.json'));
if (new URL(config.general.initialUrl).origin !== 'https://onlyfast.app' ||
    !/^ca-app-pub-\d+~\d+$/.test(units?.applicationId ?? '') ||
    ![units.bannerAdUnitId, units.interstitialAdUnitId].every(value => /^ca-app-pub-\d+\/\d+$/.test(value))) {
  throw new Error('Expected the original OnlyFast export with its approved AdMob configuration');
}
const files = new Map();
const copies = new Map();
function edit(path, find, replacement) {
  const original = files.get(path) ?? input(path);
  if (original.split(find).length !== 2) throw new Error(`Unexpected Median source anchor in ${path}: ${find}`);
  files.set(path, original.replace(find, () => replacement));
}

if (platform === 'android') {
  const gradle = 'app/build.gradle';
  const host = 'app/src/main/java/co/median/android/MainActivity.java';
  const navigation = 'app/src/normal/java/co/median/android/GoNativeWebviewClient.java';
  if (!input(gradle).includes('applicationId "app.onlyfast"') ||
      deps.plugins?.admob !== '2.0.0-alpha' || !deps.plugins?.revenuecat) throw new Error('Unexpected Android export');
  delete deps.plugins.admob;
  edit(gradle, '    /**** Google Android and Play Services dependencies ****/', `    /**** Google Android and Play Services dependencies ****/
    implementation 'com.google.android.gms:play-services-ads:24.7.0'
    implementation 'com.google.android.ump:user-messaging-platform:3.2.0'
    implementation 'com.google.ads.mediation:facebook:6.20.0.2'
    implementation 'com.facebook.infer.annotation:infer-annotation:0.18.0'`);
  edit(gradle, '    defaultConfig {', `    defaultConfig {
        buildConfigField 'boolean', 'ONLYFAST_TEST_ADS', 'false'
        buildConfigField 'boolean', 'ONLYFAST_RELEASE_ADS', 'false'
        buildConfigField 'String', 'ONLYFAST_BANNER_UNIT', '"${units.bannerAdUnitId}"'
        buildConfigField 'String', 'ONLYFAST_INTERSTITIAL_UNIT', '"${units.interstitialAdUnitId}"'`);
  edit(gradle, 'applicationIdSuffix ".debug"', `applicationIdSuffix ".debug"
            buildConfigField 'boolean', 'ONLYFAST_TEST_ADS', 'true'
            manifestPlaceholders.admob_app_id = "ca-app-pub-3940256099942544~3347511713"`);
  if (option === '--release') {
    edit(gradle, '        versionCode 63', '        versionCode 64');
    // Produce an unsigned bundle for the existing Play upload key. Keep debug isolated.
    edit(gradle, '            signingConfig signingConfigs.release',
      "            buildConfigField 'boolean', 'ONLYFAST_RELEASE_ADS', 'true'");
    edit(gradle, '            signingConfig signingConfigs.upload',
      "            buildConfigField 'boolean', 'ONLYFAST_RELEASE_ADS', 'true'\n            signingConfig signingConfigs.upload");
  }
  const manifest = 'app/src/main/AndroidManifest.xml';
  const appTag = input(manifest).match(/<application\b[^>]*>/)?.[0];
  if (!appTag || input(manifest).includes('com.google.android.gms.ads.APPLICATION_ID')) throw new Error('Unexpected manifest');
  edit(manifest, appTag, `${appTag}
        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="\${admob_app_id}" />
        <meta-data android:name="com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT" android:value="true" />`);
  edit(host, '        this.mWebview = this.mWebviewContainer.getWebview();', `        this.mWebview = this.mWebviewContainer.getWebview();
        onlyFastAdMob = new OnlyFastAdMob(this);
        onlyFastAdMob.attach((android.webkit.WebView) this.mWebview);`);
  edit(host, '        this.mWebview = newWebview;', `        this.mWebview = newWebview;
        if (onlyFastAdMob != null) onlyFastAdMob.attach((android.webkit.WebView) newWebview);`);
  edit(host, '        if (newWebview != prev) {', '        if (newWebview != prev) {\n            if (onlyFastAdMob != null) onlyFastAdMob.detach();');
  edit(host, '        super.onResume();', '        super.onResume();\n        if (onlyFastAdMob != null) onlyFastAdMob.resume();');
  edit(host, '        super.onPause();', '        if (onlyFastAdMob != null) onlyFastAdMob.pause();\n        super.onPause();');
  edit(host, '        super.onDestroy();', '        if (onlyFastAdMob != null) onlyFastAdMob.detach();\n        super.onDestroy();');
  edit(host, '    public LeanWebView getLeanWebView() {', `    private OnlyFastAdMob onlyFastAdMob;

    void onlyFastAdsNavigationStarted(android.webkit.WebView view) {
        if (onlyFastAdMob != null) onlyFastAdMob.navigationStarted(view);
    }

    public LeanWebView getLeanWebView() {`);
  const client = input(navigation);
  const owner = client.match(/private final MainActivity (\w+);/)?.[1];
  if (!owner) throw new Error('Expected MainActivity in normal WebView client');
  edit(navigation, '        super.onPageStarted(view, url, favicon);',
    `        super.onPageStarted(view, url, favicon);\n        ${owner}.onlyFastAdsNavigationStarted(view);`);
  copies.set('app/src/main/java/co/median/android/OnlyFastAdMob.java', source('admob/OnlyFastAdMob.java'));
  if (option === '--qa') {
    config.general.initialUrl = 'http://10.0.2.2:4179/';
    files.set('app/src/debug/assets/appConfig.json', JSON.stringify(config, null, 2));
    files.set('app/src/debug/AndroidManifest.xml', `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:usesCleartextTraffic="true" />
</manifest>
`);
  }
} else {
  const project = 'OnlyFast.xcodeproj/project.pbxproj';
  if (!input(project).includes('PRODUCT_BUNDLE_IDENTIFIER = app.onlyfast;') ||
      deps.plugins?.['ad-mob-plugin'] !== '2.0.0-alpha.1' || !deps.plugins?.['revenue-cat-plugin']) {
    throw new Error('Unexpected iOS export');
  }
  delete deps.plugins['ad-mob-plugin'];
  const packages = [
    ['GoogleMobileAds', 'https://github.com/googleads/swift-package-manager-google-mobile-ads', '11.13.0'],
    ['GoogleUserMessagingPlatform', 'https://github.com/googleads/swift-package-manager-google-user-messaging-platform', '2.7.0'],
    ['MetaAdapterTarget', 'https://github.com/googleads/googleads-mobile-ios-mediation-meta', '6.20.100'],
  ];
  edit('Project.swift', '        .remote(url: "median.ad-mob-plugin", requirement: .exact("2.0.0-alpha.1")),',
    packages.map(([, url, version]) => `        .remote(url: "${url}", requirement: .exact("${version}")),`).join('\n'));
  edit('Project.swift', '        .package(product: "AdMobPlugin"),',
    packages.map(([product]) => `        .package(product: "${product}"),`).join('\n'));
  const plist = 'LeanIOS/MedianIOS-Info.plist';
  const sk = readFileSync(source('AdMob-SKAdNetwork.plist'), 'utf8').match(/<key>SKAdNetworkItems<\/key>\s*<array>[\s\S]+?<\/array>/)?.[0];
  if (!sk || input(plist).includes('<key>SKAdNetworkItems</key>')) throw new Error('Unexpected SKAdNetwork input');
  edit(plist, '<key>GADApplicationIdentifier</key>', `${sk}
    <key>GADDelayAppMeasurementInit</key>
    <true/>
    <key>OnlyFastBannerUnit</key>
    <string>${units.bannerAdUnitId}</string>
    <key>OnlyFastInterstitialUnit</key>
    <string>${units.interstitialAdUnitId}</string>
    <key>GADApplicationIdentifier</key>`);
  const host = 'LeanIOS/LEANWebViewController.m';
  edit(host, '@property MCKMPWebViewBridge *medianBridge;', `@property MCKMPWebViewBridge *medianBridge;
@property OnlyFastAdMob *onlyFastAdMob;`);
  edit(host, '    [self removeScriptMessageHandlersInWebView:wkWebview];', `    [self removeScriptMessageHandlersInWebView:wkWebview];
    self.onlyFastAdMob = [[OnlyFastAdMob alloc] initWithHost:self webView:wkWebview
        slot:self.pluginView boundary:self.pluginViewTopWebviewBottomConstraint];
    [self.onlyFastAdMob attach];`);
  edit(host, '    [wkWebview.configuration.userContentController removeScriptMessageHandlerForName:@"JSBridge"];', `    [self.onlyFastAdMob detach];
    [wkWebview.configuration.userContentController removeScriptMessageHandlerForName:@"JSBridge"];`);
  edit(host, '    [super viewWillDisappear:animated];', '    [self.onlyFastAdMob reset];\n    [super viewWillDisappear:animated];');
  edit(host, '- (void)webView:(WKWebView *)webView didCommitNavigation:(WKNavigation *)navigation', `- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation
{
    [self.onlyFastAdMob reset];
}

- (void)webView:(WKWebView *)webView didCommitNavigation:(WKNavigation *)navigation`);
  const bridgeHeader = input(host).match(/#import "[^"]*GonativeIO-Swift\.h"/)?.[0];
  if (!bridgeHeader) throw new Error('Expected app Swift bridge header');
  edit(host, bridgeHeader, `${bridgeHeader}\n#import "OnlyFastAdMob.h"`);
  // Preserve the exported identity when regenerating the workspace on macOS.
  for (const [key, original, replacement] of [
    ['projectName', 'MedianIOS', 'OnlyFast'], ['targetName', 'Median', 'OnlyFast'],
    ['bundleId', 'io.gonative.ios.dev', 'app.onlyfast'], ['appName', 'Median', 'OnlyFast'],
  ]) edit('Project.swift', `Environment.${key}.getString(default: "${original}")`,
    `Environment.${key}.getString(default: "${replacement}")`);
  const xcode = input(project);
  for (const [envKey, buildKey, original] of [
    ['marketingVersion', 'MARKETING_VERSION', '1.0'], ['projectVersion', 'CURRENT_PROJECT_VERSION', '2'],
  ]) {
    const version = xcode.match(new RegExp(`\\b${buildKey} = "?([0-9.]+)"?;`))?.[1];
    if (!version) throw new Error(`Missing exported ${buildKey}`);
    edit('Project.swift', `Environment.${envKey}.getString(default: "${original}")`,
      `Environment.${envKey}.getString(default: "${version}")`);
  }
  const debugSDK = '<key>GADApplicationIdentifier</key>';
  edit(plist, `${debugSDK}\n    <string>${units.applicationId}</string>`,
    `${debugSDK}\n    <string>$(ONLYFAST_ADMOB_APP_ID)</string>`);
  edit('Project.swift', '"SWIFT_VERSION": "5.0",', `"SWIFT_VERSION": "5.0",
                    "ONLYFAST_ADMOB_APP_ID": "${units.applicationId}",`);
  edit('Project.swift', '"SWIFT_OPTIMIZATION_LEVEL": "-Onone",', `"SWIFT_OPTIMIZATION_LEVEL": "-Onone",
                        "GCC_PREPROCESSOR_DEFINITIONS": ["$(inherited)", "DEBUG=1"],
                        "ONLYFAST_ADMOB_APP_ID": "ca-app-pub-3940256099942544~1458002511",`);
  // Update the exported workspace as well, so opening it directly cannot link stock AdMob.
  const objectId = key => createHash('sha256').update(`OnlyFastAdMob:${key}`).digest('hex').slice(0, 24).toUpperCase();
  const packageObjects = packages.map(([product, url, version]) => ({
    product, url, version, reference: objectId(`package:${product}`),
    dependency: objectId(`product:${product}`), framework: objectId(`framework:${product}`),
  }));
  const rows = (pattern, replacement) => {
    const anchor = xcode.match(pattern)?.[0];
    if (!anchor) throw new Error(`Missing exported Xcode anchor: ${pattern}`);
    edit(project, anchor, replacement(anchor));
  };
  rows(/^\t\t\w+ \/\* AdMobPlugin in Frameworks \*\/ = .*;$/m, () =>
    packageObjects.map(p => `\t\t${p.framework} /* ${p.product} in Frameworks */ = {isa = PBXBuildFile; productRef = ${p.dependency}; };`).join('\n'));
  rows(/^\t{4}\w+ \/\* AdMobPlugin in Frameworks \*\/,$/m, () =>
    packageObjects.map(p => `\t\t\t\t${p.framework} /* ${p.product} in Frameworks */,`).join('\n'));
  rows(/^\t{4}\w+ \/\* AdMobPlugin \*\/,$/m, () =>
    packageObjects.map(p => `\t\t\t\t${p.dependency} /* ${p.product} */,`).join('\n'));
  rows(/^\t{4}\w+ \/\* XCRemoteSwiftPackageReference "median\.ad-mob-plugin" \*\/,$/m, () =>
    packageObjects.map(p => `\t\t\t\t${p.reference} /* ${p.product} package */,`).join('\n'));
  rows(/^\t\t\w+ \/\* XCRemoteSwiftPackageReference "median\.ad-mob-plugin" \*\/ = \{[\s\S]*?^\t\t\};/m, () =>
    packageObjects.map(p => `\t\t${p.reference} /* ${p.product} package */ = {
\t\t\tisa = XCRemoteSwiftPackageReference;
\t\t\trepositoryURL = "${p.url}";
\t\t\trequirement = {kind = exactVersion; version = ${p.version}; };
\t\t};`).join('\n'));
  rows(/^\t\t\w+ \/\* AdMobPlugin \*\/ = \{[\s\S]*?^\t\t\};/m, () =>
    packageObjects.map(p => `\t\t${p.dependency} /* ${p.product} */ = {
\t\t\tisa = XCSwiftPackageProductDependency;
\t\t\tpackage = ${p.reference};
\t\t\tproductName = ${p.product};
\t\t};`).join('\n'));
  const objc = objectId('objc');
  const header = objectId('header');
  const sources = objectId('sources');
  rows(/^\t\t\w+ \/\* LEANWebViewController\.m in Sources \*\/ = .*;$/m,
    row => `${row}\n\t\t${sources} /* OnlyFastAdMob.m in Sources */ = {isa = PBXBuildFile; fileRef = ${objc}; };`);
  rows(/^\t{4}\w+ \/\* LEANWebViewController\.m in Sources \*\/,$/m,
    row => `${row}\n\t\t\t\t${sources} /* OnlyFastAdMob.m in Sources */,`);
  rows(/^\t\t\w+ \/\* LEANWebViewController\.m \*\/ = .*;$/m,
    row => `${row}
\t\t${objc} /* OnlyFastAdMob.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = OnlyFastAdMob.m; sourceTree = "<group>"; };
\t\t${header} /* OnlyFastAdMob.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = OnlyFastAdMob.h; sourceTree = "<group>"; };`);
  rows(/^\t{4}\w+ \/\* LEANWebViewController\.m \*\/,$/m,
    row => `${row}\n\t\t\t\t${objc} /* OnlyFastAdMob.m */,\n\t\t\t\t${header} /* OnlyFastAdMob.h */,`);
  for (const [optimization, appId] of [['-O', units.applicationId], ['-Onone', 'ca-app-pub-3940256099942544~1458002511']]) {
    const anchor = `\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "${optimization}";\n\t\t\t\tSWIFT_VERSION = 5.0;`;
    edit(project, anchor, `${anchor}\n\t\t\t\tONLYFAST_ADMOB_APP_ID = "${appId}";`);
  }
  for (const lock of ['.package.resolved', 'OnlyFast.xcworkspace/xcshareddata/swiftpm/Package.resolved']) {
    const state = JSON.parse(input(lock));
    state.pins = state.pins.filter(pin => pin.identity !== 'median.ad-mob-plugin');
    files.set(lock, JSON.stringify(state, null, 2) + '\n');
  }
  copies.set('LeanIOS/OnlyFastAdMob.h', source('OnlyFastAdMob.h'));
  copies.set('LeanIOS/OnlyFastAdMob.m', source('OnlyFastAdMob.m'));
}
files.set('dependencies.json', JSON.stringify(deps, null, 2) + '\n');
for (const path of copies.keys()) if (existsSync(join(root, path))) throw new Error(`Refusing to overwrite ${path}`);
for (const [path, content] of files) {
  mkdirSync(resolve(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
}
for (const [path, original] of copies) copyFileSync(original, join(root, path));
console.log(`Prepared ${platform} replacement source at ${root}`);
