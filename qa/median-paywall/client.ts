import { createClient } from '@supabase/supabase-js';
import { NativePurchaseController, NativePurchaseError, type RevenueCatBridge } from '../../src/lib/nativePurchaseController';
import { allowedOrigin, type QASettings } from './policy';
import { nativePlatform } from '../../src/lib/nativeEnvironment';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const settings: QASettings = JSON.parse(element('qa-settings').textContent || '{}');
// Public launch does not widen QA access: origin, local backend, exact tester and
// separately approved store actions remain enforced by the existing QA policy.
if (!allowedOrigin(location.origin, settings)) throw Error('QA origin check failed.');
const supabase = createClient(new URL('/local-supabase', location.origin).href, settings.anonKey,
  { auth: { persistSession: false, detectSessionInUrl: false, storageKey: 'onlyfast-stock-paywall-qa' } });
let verified = false;
let identified = false;
let busy = false;
let ownedBridge: RevenueCatBridge | undefined;
const show = (value: unknown) => { element('status').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
const buttons = () => {
  element<HTMLButtonElement>('identify').disabled = busy || !verified || !settings.storeActionsApproved;
  for (const id of ['paywall', 'restore']) element<HTMLButtonElement>(id).disabled = busy || !verified || !identified || !settings.storeActionsApproved;
  if (settings.presentationOnly) element<HTMLButtonElement>('restore').disabled = true;
  for (const id of ['refresh', 'logout']) element<HTMLButtonElement>(id).disabled = busy || !verified;
};
element('hold').textContent = settings.presentationOnly ? 'Paywall presentation only. Do not purchase or restore. Local membership reads only.' :
  settings.storeActionsApproved ? 'Operator-approved SANDBOX store actions; local backend only.' : 'Store actions DISABLED pending explicit operator approval.';
async function authorize() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== settings.testerId) throw Error('Local tester session required.');
  const response = await fetch('/__qa/authorize', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token } });
  if (!response.ok || (await response.json()).userId !== settings.testerId) throw Error('Server-managed tester authorization denied.');
  if ((await supabase.auth.getSession()).data.session?.user.id !== settings.testerId) throw Error('Account changed.');
  return data.session;
}
const controller = new NativePurchaseController(async () => {
  // Keep the authorized bridge for logout cleanup after local Auth signs out.
  // Every store action below still reauthorizes the tester before using it.
  if (ownedBridge) return ownedBridge;
  await authorize();
  const host = window as unknown as { median?: { revenueCat?: RevenueCatBridge }; gonative?: { revenueCat?: RevenueCatBridge } };
  const bridge = host.median?.revenueCat || host.gonative?.revenueCat;
  if (!bridge || !['configure', 'isInitialized', 'login', 'logout', 'presentPaywall', 'restorePurchases']
    .every(method => typeof bridge[method as keyof RevenueCatBridge] === 'function')) throw Error('Use a compatible stock Median test build.');
  ownedBridge = bridge; return bridge;
}, () => {
  const platform = nativePlatform(navigator.userAgent, navigator.maxTouchPoints);
  const key = platform === 'android' ? settings.androidKey : platform === 'ios' ? settings.iosKey : '';
  if (!key) throw Error('Set the existing platform public SDK key.');
  return key;
}, () => verified && settings.storeActionsApproved);
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user.id !== settings.testerId) {
    verified = false; identified = false; buttons();
    // Invalidate delayed native results immediately; native logout stays queued.
    if (settings.storeActionsApproved) void controller.setUser(null).catch(() => {});
  }
});
async function membership(sync: boolean) {
  const session = await authorize();
  if (sync) {
    const result = await supabase.functions.invoke('sync-revenuecat-subscription', { body: {},
      headers: { Authorization: 'Bearer ' + session.access_token } });
    if (result.error || result.data?.error) throw Error('Local server synchronization failed; no access confirmed.');
  }
  await authorize();
  const { data, error } = await supabase.rpc('get_onlyfast_membership');
  if (error) throw Error('Could not read local server-authoritative membership.');
  await authorize(); show({ userId: settings.testerId, serverMembership: data, synchronized: sync });
}
async function run(action: () => Promise<void>) {
  if (busy) return; busy = true; buttons();
  try { await action(); } catch (error) { show(error instanceof NativePurchaseError && error.cancelled ? 'Purchase cancelled; no access granted.' : error instanceof Error ? error.message : 'QA request failed.'); }
  finally { busy = false; buttons(); }
}
element('login').addEventListener('submit', event => {
  event.preventDefault(); void run(async () => {
    identified = false;
    const { error } = await supabase.auth.signInWithPassword({ email: element<HTMLInputElement>('email').value, password: element<HTMLInputElement>('password').value });
    element<HTMLInputElement>('password').value = '';
    if (error) throw Error('Local sign-in failed.');
    await authorize(); verified = true; await membership(false);
  });
});
element('identify').addEventListener('click', () => { void run(async () => {
  if (!settings.storeActionsApproved) throw Error('Native store actions have not been approved.');
  const session = await authorize(); await controller.setUser(session.user.id); await authorize();
  identified = true;
  show({ initializedFor: session.user.id,
    ...(session.user.id === '5ea2a2af-876a-42bb-84cc-4e4319a90a7e' ?
      { offeringApproval: 'onlyfast_monthly_v1 — already verified and approved by the operator for this isolated test.' } : {}),
    next: 'Tap Open native Pro / Teams paywall, then select Pro. Purchase and restore are manual; neither has been performed automatically.' });
}); });
for (const [id, action] of [['paywall', 'purchase'], ['restore', 'restore']] as const) {
  element(id).addEventListener('click', () => { void run(async () => {
    if (!settings.storeActionsApproved || !identified) throw Error('Approved native initialization is required first.');
    if (settings.presentationOnly && action === 'restore') throw Error('Restoration is not approved for this presentation-only session.');
    const session = await authorize();
    await controller.setUser(session.user.id);
    await authorize(); await controller.run(session.user.id, action);
    await membership(!settings.presentationOnly); // Native success alone never grants membership.
  }); });
}
element('refresh').addEventListener('click', () => { void run(() => membership(settings.storeActionsApproved && !settings.presentationOnly)); });
element('logout').addEventListener('click', () => { void run(async () => {
  verified = false; await supabase.auth.signOut(); show('Signed out; local membership unchanged.');
}); });
buttons();
