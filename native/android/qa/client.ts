// Internal Vite serve-only module, not imported by any production entry point.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, supabaseUrl } from '../../../src/lib/supabase';
import { NATIVE_PURCHASES_READY } from '../../../src/lib/nativePurchaseController';
import { nativePurchasesEnabled } from '../../../src/lib/nativePurchases';
import { ReleaseNativePurchaseController, type BillingReply, type BillingRequest, type StoreCatalog } from '../../../src/lib/releaseNativeBilling';
import { getReleaseBillingBridge } from '../../../src/lib/releaseNativeTransport';
import PlanSelection from '../../../src/components/PlanSelection';
import NativeSubscriptionControls from '../../../src/components/NativeSubscriptionControls';

const host = window as unknown as { __onlyFastQaNonce: string };
const panel = document.createElement('section');
panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#f5f5f7;color:#111;padding:16px;font:14px sans-serif';
panel.innerHTML = '<h1>OnlyFast — release bridge internal QA</h1><p>No purchases or restores. Local synthetic accounts only.</p><pre id="qa-status" style="white-space:pre-wrap"></pre><div id="qa-plans"></div><div id="qa-controls"></div>';
document.body.append(panel);
const report: { passed: boolean; startedAt: string; steps: { name: string; result: unknown }[]; errors: string[]; catalogs: Record<string, StoreCatalog>; observations: unknown } = {
  passed: false, startedAt: new Date().toISOString(), steps: [], errors: [], catalogs: {}, observations: {},
};
let navigationCount = 0;
window.addEventListener('popstate', () => navigationCount++);
const expectedOrigin = location.origin;
function expect(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
async function operator(operation: string, extra: object = {}) {
  const response = await fetch('/__release_bridge_qa', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OnlyFast-QA': host.__onlyFastQaNonce }, body: JSON.stringify({ operation, ...extra }) });
  expect(response.ok, 'Local QA server rejected request'); return response.status === 204 ? null : response.json();
}
async function archive() {
  panel.querySelector('#qa-status')!.textContent = JSON.stringify(report, null, 2);
  await operator('report', { report });
}
function step(name: string, result: unknown = true) {
  report.steps.push({ name, result });
  panel.querySelector('#qa-status')!.textContent = JSON.stringify(report, null, 2);
}
async function authorize() {
  const { data, error } = await supabase.auth.getUser();
  expect(!error && data.user?.email?.endsWith('@example.invalid'), 'Verified synthetic local sign-in required');
  const id = data.user.id;
  const [accounts, flags] = await Promise.all([
    supabase.from('beta_tester_accounts').select('is_test_account,beta_features_enabled,tester_kind').eq('user_id', id),
    supabase.from('user_feature_flags').select('feature_key,enabled').eq('user_id', id),
  ]);
  const account = accounts.data?.[0];
  expect(!accounts.error && account?.is_test_account && account.beta_features_enabled && account.tester_kind === 'experimental', 'Server-managed experimental tester required');
  expect(!flags.error && flags.data?.some(f => f.feature_key === 'native_subscription_testing' && f.enabled) &&
    !flags.data?.some(f => f.feature_key === 'test_account_full_access' && f.enabled), 'Trusted tester flags required; no paid-access overrides');
  return id;
}
async function login(account: 'a' | 'b') {
  const value = await operator('login', { account });
  const { data, error } = await supabase.auth.signInWithPassword({ email: value.email, password: value.password });
  expect(!error && data.user?.id === value.userId, 'Local Supabase sign-in failed');
  expect(await authorize() === value.userId, 'Local tester authorization failed');
  return value.userId as string;
}
async function main() {
  expect(import.meta.env.MODE === 'native-sandbox' && supabaseUrl === 'http://127.0.0.1:54321' && location.origin === 'http://127.0.0.1:8086', 'QA requires fixed local configuration');
  expect(!NATIVE_PURCHASES_READY && !nativePurchasesEnabled, 'Public purchase hold must stay false');
  const nativeBridge = await getReleaseBillingBridge();
  const operations: string[] = [];
  const bridge = { request(request: BillingRequest) {
    expect(!['purchase', 'restore'].includes(request.operation), 'Transactions are forbidden in this QA harness');
    operations.push(request.operation);
    return nativeBridge.request(request);
  } };
  const capabilities = await bridge.request({ operation: 'capabilities', protocolVersion: 1 });
  expect(capabilities.protocolVersion === 1 && capabilities.platform === 'android' && capabilities.transactionsEnabled === false, 'Expected held Android release bridge');
  step('native bridge capabilities', capabilities);
  let delayed = false;
  let started: () => void = () => {};
  let release: () => void = () => {};
  const controller = new ReleaseNativePurchaseController(async () => ({ request: async (request: BillingRequest) => {
    expect(!['purchase', 'restore'].includes(request.operation), 'Transactions are forbidden in this QA harness');
    if (request.operation === 'catalog' && delayed) {
      delayed = false;
      const actual = await bridge.request(request);
      started(); await new Promise<void>(resolve => { release = resolve; });
      return actual;
    }
    return bridge.request(request);
  } }), async () => {
    const id = await authorize(); const { data } = await supabase.auth.getSession();
    return data.session?.user.id === id ? { userId: id, accessToken: data.session.access_token } : null;
  }, () => true); // Private catalog harness only; production readiness constant is untouched.

  const a = await login('a');
  await controller.setUser(a);
  step('release bridge identified authenticated local UUID', { uuid: a });
  report.catalogs.a = await controller.getCatalog(a);
  step('native RevenueCat initialization and named Pro/Teams catalog A validated');

  // Wrong UUID + valid token must be rejected by native Auth, not just web code.
  const sessionA = (await supabase.auth.getSession()).data.session!;
  const mismatch: BillingReply = await bridge.request({ operation: 'identify', protocolVersion: 1,
    expectedUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accessToken: sessionA.access_token });
  expect(mismatch.status === 'error' && mismatch.code === 'AUTH', 'Native accepted a mismatched UUID');
  step('native rejected mismatched authenticated UUID', { status: mismatch.status, code: mismatch.code });
  const anonymous = await bridge.request({ operation: 'identify', protocolVersion: 1, expectedUserId: a, accessToken: 'invalid-synthetic-token' });
  expect(anonymous.status === 'error' && anonymous.code === 'AUTH', 'Native accepted an invalid session');
  step('native rejected invalid session', { status: anonymous.status, code: anonymous.code });

  // A real native catalog reply is deliberately delayed in the web transport
  // to reproduce a late result after an actual local account switch.
  delayed = true;
  const opened = new Promise<void>(resolve => { started = resolve; });
  const stale = controller.getCatalog(a).then(() => false, () => true);
  await opened;
  const b = await login('b'); expect(a !== b, 'Switch test requires distinct synthetic UUIDs');
  const switching = controller.setUser(b);
  release(); expect(await stale, 'A stale account catalog was exposed');
  await switching;
  report.catalogs.b = await controller.getCatalog(b);
  step('A → B authenticated account switch; delayed A result rejected', { a, b });
  await supabase.auth.signOut(); await controller.setUser(null);
  await controller.getCatalog(b).then(() => { throw Error('Logged-out catalog was exposed'); }, () => step('logged-out catalog rejected'));
  const again = await login('a'); expect(again === a, 'Original tester was not restored');
  await controller.setUser(a); report.catalogs.aAfterSwitch = await controller.getCatalog(a);
  step('B → logout → A retains correct authenticated identity');

  createRoot(panel.querySelector('#qa-plans')!).render(React.createElement(PlanSelection, { userId: a, onComplete: () => {} }));
  createRoot(panel.querySelector('#qa-controls')!).render(React.createElement(NativeSubscriptionControls, { userId: a }));
  await new Promise(resolve => setTimeout(resolve, 2500));
  const buttons = [...panel.querySelectorAll('button')];
  const comingSoon = buttons.filter(button => button.textContent?.trim() === 'Coming Soon');
  const restore = buttons.find(button => button.textContent?.trim() === 'Restore Purchases');
  expect(comingSoon.length >= 2 && comingSoon.every(button => button.disabled), 'Public plan controls were not held');
  expect(restore?.disabled, 'Restore was not held');
  expect(buttons.some(button => button.textContent?.trim() === 'Continue Free' && !button.disabled), 'Free Rookie continuation was unavailable');
  step('actual PlanSelection and NativeSubscriptionControls remain publicly held; Rookie free');
  expect(location.origin === expectedOrigin && (await supabase.auth.getSession()).data.session?.user.id === a, 'Unexpected navigation or authentication reset');
  report.observations = { origin: location.origin, path: location.pathname, navigationCount, publicPurchasesReady: NATIVE_PURCHASES_READY,
    nativeTransactionsEnabled: capabilities.transactionsEnabled,
    purchasesInvoked: operations.filter(value => value === 'purchase').length,
    restoresInvoked: operations.filter(value => value === 'restore').length,
    operationCounts: Object.fromEntries([...new Set(operations)].map(operation => [operation, operations.filter(value => value === operation).length])),
    completedAt: new Date().toISOString() };
  report.passed = true;
  let checkingResume = false;
  const resumed = async () => {
    if (!report.passed || checkingResume || document.visibilityState !== 'visible') return;
    checkingResume = true;
    try {
      expect((await supabase.auth.getSession()).data.session?.user.id === a, 'Authentication reset during native resume');
      report.catalogs.afterResume = await controller.getCatalog(a);
      step('native background/resume preserved authentication and refreshed named catalog');
    } catch (error) { report.passed = false; report.errors.push(error instanceof Error ? error.message : 'Resume failed'); }
    finally { checkingResume = false; await archive(); }
  };
  window.addEventListener('focus', () => void resumed());
  document.addEventListener('visibilitychange', () => void resumed());
}
void main().catch(error => { report.errors.push(error instanceof Error ? error.message : 'QA failed'); }).finally(archive);
