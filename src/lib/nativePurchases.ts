import { supabase } from './supabase';
import { hideExternalPayments } from './paymentVisibility';
import { nativePlatform } from './nativeEnvironment';
import { NATIVE_PURCHASES_READY, NativePurchaseController, type RevenueCatBridge } from './nativePurchaseController';
import { watchMembershipLifecycle } from './membershipLifecycle';
import { clearTrustedMembership, getMembershipExpiration, notifyMembershipExpiration } from './trustedMembership';
import { syncMembershipFromSubscription } from './subscription';

// Store approval and readiness can differ. Require an explicit platform rollout
// as well as the authorized source and master gates; unknown platforms stay off.
const purchasePlatform = nativePlatform(navigator.userAgent, navigator.maxTouchPoints);
const platformPurchasesEnabled = purchasePlatform === 'android'
  ? import.meta.env.VITE_REVENUECAT_ANDROID_ENABLED === 'true'
  : purchasePlatform === 'ios' && import.meta.env.VITE_REVENUECAT_IOS_ENABLED === 'true';
export const nativePurchasesEnabled = NATIVE_PURCHASES_READY && hideExternalPayments &&
  import.meta.env.VITE_REVENUECAT_ENABLED === 'true' && platformPurchasesEnabled;

async function getBridge(): Promise<RevenueCatBridge> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const host = window as unknown as { median?: { revenueCat?: RevenueCatBridge }; gonative?: { revenueCat?: RevenueCatBridge } };
    const bridge = host.median?.revenueCat || host.gonative?.revenueCat;
    if (bridge) {
      if (!['configure', 'isInitialized', 'login', 'logout', 'presentPaywall', 'restorePurchases']
        .every(key => typeof bridge[key as keyof RevenueCatBridge] === 'function')) {
        throw new Error('Please update OnlyFast to use in-app subscriptions.');
      }
      return bridge;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('In-app subscriptions are unavailable in this version. Please update OnlyFast.');
}

export const nativePurchases = new NativePurchaseController(getBridge, () => {
  const platform = nativePlatform(navigator.userAgent, navigator.maxTouchPoints);
  return platform === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '' :
    platform === 'android' ? import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY || '' : '';
}, () => nativePurchasesEnabled);

export async function syncNativeSubscription(userId: string, notify = true): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (session.session?.user.id !== userId) throw new Error('Your account changed. Please sign in again.');
  const { data, error } = await supabase.functions.invoke('sync-revenuecat-subscription', {
    body: {}, headers: { Authorization: `Bearer ${session.session.access_token}` },
  });
  if (error || data?.error) throw new Error('OnlyFast could not confirm store access yet. Use Refresh subscription in a moment.');
  const { data: current } = await supabase.auth.getSession();
  if (current.session?.user.id !== userId) throw new Error('Your account changed. Please sign in again.');
  if (notify) window.dispatchEvent(new CustomEvent('subscription-updated'));
}

// App-wide lifecycle: runs outside Supabase's auth callback to avoid auth locks.
export function watchNativePurchases(): () => void {
  return watchMembershipLifecycle({
    session: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
    onAuthChange: listener => {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session?.user.id ?? null));
      return () => data.subscription.unsubscribe();
    },
    clear: id => {
      clearTrustedMembership(id);
      if (nativePurchasesEnabled) void nativePurchases.setUser(id).catch(() => {});
    },
    refresh: async id => {
      const status = await syncMembershipFromSubscription();
      if ((await supabase.auth.getSession()).data.session?.user.id !== id) return;
      // Existing native subscribers can refresh while new purchases are held.
      // Stripe, Rookie and promotional memberships never trigger native billing.
      if (hideExternalPayments && status?.row?.subscription_source === 'revenuecat') {
        try { await syncNativeSubscription(id, false); }
        finally { await syncMembershipFromSubscription(); }
      }
    },
    expiresAt: getMembershipExpiration,
    onExpiration: notifyMembershipExpiration,
  }, window, document);
}
