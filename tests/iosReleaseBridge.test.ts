import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMedianIosReleaseSource } from '../scripts/prepare-median-ios-release-source.mjs';
import { ReleaseNativePurchaseController, type BillingReply, type BillingRequest, type StoreCatalog } from '../src/lib/releaseNativeBilling.ts';
import { NATIVE_PURCHASES_READY } from '../src/lib/nativePurchaseController.ts';

const swift = readFileSync(new URL('../native/ios/OnlyFastBilling.swift', import.meta.url), 'utf8');
const bootstrap = swift.match(/private static let bootstrap = #"""([\s\S]*?)"""#/)![1];
function page(origin = 'https://onlyfast.app', iframe = false) {
  const sent: unknown[] = [];
  const host: Record<string, unknown> = { webkit: { messageHandlers: { onlyFastBillingNative: { postMessage: (value: unknown) => sent.push(value) } } } };
  host.top = iframe ? {} : host;
  vm.runInNewContext(bootstrap, { window: host, location: { origin }, crypto: { randomUUID: () => 'document-a' } });
  return { sent, host, channel: host.onlyFastBilling as { postMessage(value: unknown): void; _receive(id: string, value: string): void; onmessage: ((event: { data: string }) => void) | null } };
}
test('actual iOS document-start script gates origins and frames', () => {
  for (const origin of ['http://onlyfast.app', 'https://onlyfast.app.evil.invalid', 'http://127.0.0.1:8086', 'https://onlyfast.app:444']) {
    assert.equal(page(origin).channel, undefined);
  }
  assert.equal(page('https://onlyfast.app', true).channel, undefined);
  assert.ok(page('https://www.onlyfast.app').channel);
});
test('actual iOS transport preserves JSON envelope and rejects a response for another document', () => {
  const p = page(); const response: string[] = [];
  p.channel.onmessage = event => response.push(event.data);
  p.channel.postMessage('{"requestId":"test-1","operation":"capabilities","protocolVersion":1}');
  assert.equal((p.sent[0] as { documentId: string }).documentId, 'document-a');
  assert.equal(JSON.parse((p.sent[0] as { payload: string }).payload).operation, 'capabilities');
  p.channel._receive('old-document', 'stale'); assert.deepEqual(response, []);
  p.channel._receive('document-a', '{"requestId":"test-1","result":{"protocolVersion":1,"status":"ok"}}');
  assert.equal(JSON.parse(response[0]).requestId, 'test-1');
  assert.equal(Object.getOwnPropertyDescriptor(p.host, 'onlyFastBilling')?.writable, false);
  assert.throws(() => p.channel.postMessage({}));
  assert.throws(() => p.channel.postMessage('x'.repeat(65_537)));
});

test('Swift security/SDK boundary refuses foreign ownership, invalidates identity, and holds transactions before Auth/store calls', () => {
  assert.equal(NATIVE_PURCHASES_READY, false);
  assert.match(swift, /transactionsEnabled = false/);
  assert.ok(swift.indexOf('&& !Self.transactionsEnabled') < swift.indexOf('await execute('));
  assert.match(swift, /message\.frameInfo\.isMainFrame/);
  assert.match(swift, /user\["id"\] as\? String == id/);
  assert.match(swift, /completionHandler\(nil\)/);
  assert.match(swift, /guard !Purchases\.isConfigured else/);
  assert.match(swift, /Purchases\.configure\(withAPIKey: Self\.sdkKey, appUserID: id\)/);
  assert.match(swift, /Purchases\.shared\.offerings\(\)/);
  assert.match(swift, /offerings\.all\[Self\.offeringID\]/);
  assert.match(swift, /catalog\.generation == epoch/);
  assert.match(swift, /catalog\.token == request\["catalogToken"\]/);
  assert.match(swift, /let outcome = try await Purchases\.shared\.purchase\(package: package\)/);
  assert.match(swift, /paymentPendingError/);
  assert.match(swift, /customerInfoStream/);
  assert.doesNotMatch(swift, /Purchases\.shared\.delegate\s*=|getOfferings\(\)|offerings\.current|127\.0\.0\.1|service_role|sk_[a-zA-Z0-9]+/);
  assert.match(swift, /integral == scaled/);
  assert.match(swift, /if eligibility == \.eligible/);
});

async function fixture() {
  const root = fileURLToPath(new URL('../tmp/', import.meta.url)); await mkdir(root, { recursive: true });
  const parent = await mkdtemp(path.join(root, 'ios-release-test-')); const source = path.join(parent, 'source');
  await mkdir(path.join(source, 'LeanIOS'), { recursive: true });
  await mkdir(path.join(source, 'OnlyFast.xcodeproj')); await mkdir(path.join(source, 'OnlyFast.xcworkspace'));
  await writeFile(path.join(source, 'LeanIOS/appConfig.json'), JSON.stringify({ general: { iosBundleId: 'app.onlyfast', version: 16 }, services: { revenueCat: { active: true } } }));
  await writeFile(path.join(source, '.package.resolved'), JSON.stringify({ pins: [
    { identity: 'median.revenue-cat-plugin', state: { version: '1.1.2' } }, { identity: 'purchases-ios-spm', state: { version: '5.96.0' } },
  ] }));
  await writeFile(path.join(source, 'LeanIOS/LEANUtilities.m'), '#import "GonativeIO-Swift.h"\n+(void)configureWebView:(UIView*)wv\n{ WKWebView *webview = (WKWebView*)wv; }\n');
  await writeFile(path.join(source, 'LeanIOS/LEANWebViewController.m'), '- (void)addScriptMessageHandlersInWebView:(WKWebView*)wkWebview {\n [self removeScriptMessageHandlersInWebView:wkWebview]; }');
  await writeFile(path.join(source, 'OnlyFast.xcodeproj/project.pbxproj'), 'PRODUCT_BUNDLE_IDENTIFIER = app.onlyfast; productName = RevenueCatPlugin;\n/* End PBXBuildFile section */\n/* End PBXFileReference section */\n AAA /* LEANUtilities.m */,\n BBB /* LEANUtilities.m in Sources */,\n');
  return { source, output: path.join(parent, 'prepared') };
}
test('iOS preparer registers main source without changing vendor source, SDK locks, bundle or signing', async () => {
  const f = await fixture(); const original = await readFile(path.join(f.source, 'LeanIOS/LEANUtilities.m'), 'utf8');
  const manifest = await prepareMedianIosReleaseSource(f.source, f.output);
  assert.equal(await readFile(path.join(f.source, 'LeanIOS/LEANUtilities.m'), 'utf8'), original);
  assert.equal(manifest.compiled, false); assert.equal(manifest.transactionsEnabled, false); assert.equal(manifest.sdkDependenciesUnchanged, true);
  assert.equal(await readFile(path.join(f.output, '.package.resolved'), 'utf8'), await readFile(path.join(f.source, '.package.resolved'), 'utf8'));
  assert.match(await readFile(path.join(f.output, 'LeanIOS/LEANUtilities.m'), 'utf8'), /attachToWebView:webview/);
  assert.match(await readFile(path.join(f.output, 'OnlyFast.xcodeproj/project.pbxproj'), 'utf8'), /OnlyFastBilling.swift in Sources/);
  await assert.rejects(prepareMedianIosReleaseSource(f.source, f.output));
  await assert.rejects(prepareMedianIosReleaseSource(f.source, path.join(f.source, 'nested')));
});
test('iOS preparer rejects stale revision, SDK mismatch and changed lifecycle anchors before creating output', async () => {
  for (const which of ['revision', 'sdk', 'anchor']) {
    const f = await fixture();
    if (which === 'revision') {
      const file = path.join(f.source, 'LeanIOS/appConfig.json'); const config = JSON.parse(await readFile(file, 'utf8')); config.general.version = 12;
      await writeFile(file, JSON.stringify(config));
    } else if (which === 'sdk') {
      const file = path.join(f.source, '.package.resolved'); await writeFile(file, (await readFile(file, 'utf8')).replace('5.96.0', '5.0.0'));
    } else { await writeFile(path.join(f.source, 'LeanIOS/LEANUtilities.m'), 'changed vendor hook'); }
    await assert.rejects(prepareMedianIosReleaseSource(f.source, f.output));
    await assert.rejects(access(f.output), { code: 'ENOENT' });
  }
});

test('iOS purchase/restore contract uses exact Apple selection and rejects cancelled/pending/error outcomes (mock only)', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const catalog: StoreCatalog = { offeringIdentifier: 'onlyfast_monthly_v1', catalogToken: 'synthetic-catalog', expiresAt: Date.now() + 60_000,
    packages: (['pro', 'teams'] as const).map(plan => ({ plan, packageIdentifier: plan === 'pro' ? '$rc_monthly' : '$rc_custom_teams_monthly',
      productIdentifier: `app.onlyfast.${plan}.monthly`, formattedPrice: '€5.00', currencyCode: 'EUR', billingPeriod: 'P1M', optionIdentifier: null,
      pricingPhases: [], trialEligibility: 'unknown', eligibilityNote: 'Synthetic contract fixture; no eligibility claim.' })) };
  for (const status of ['purchased', 'cancelled', 'pending', 'error'] as const) {
    const calls: BillingRequest[] = [];
    const controller = new ReleaseNativePurchaseController(async () => ({ request: async request => {
      calls.push(request);
      if (request.operation === 'capabilities') return { protocolVersion: 1, status: 'ok', platform: 'ios', transactionsEnabled: true } as BillingReply;
      if (request.operation === 'catalog') return { protocolVersion: 1, status: 'ok', appUserId: id, catalog } as BillingReply;
      return { protocolVersion: 1, status: request.operation === 'purchase' ? status : request.operation === 'restore' ? 'restored' : 'ok', appUserId: id } as BillingReply;
    } }), async () => ({ userId: id, accessToken: 'synthetic' }), () => true);
    await controller.setUser(id); const shown = await controller.getCatalog(id);
    for (const plan of ['pro', 'teams'] as const) {
      const operation = controller.run(id, 'purchase', plan, shown);
      if (status === 'purchased') await operation; else await assert.rejects(operation);
      const request = calls.at(-1)!;
      assert.equal(request.productIdentifier, `app.onlyfast.${plan}.monthly`);
      assert.equal(request.packageIdentifier, plan === 'pro' ? '$rc_monthly' : '$rc_custom_teams_monthly');
      assert.equal(request.expectedUserId, id);
    }
    await controller.run(id, 'restore'); assert.equal(calls.at(-1)!.operation, 'restore');
  }
});
