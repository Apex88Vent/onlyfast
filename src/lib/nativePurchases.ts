import { supabase } from './supabase';
import { hideExternalPayments } from './paymentVisibility';
import { nativePlatform } from './nativeEnvironment';
import { NativePurchaseController, type RevenueCatBridge } from './nativePurchaseController';

export const nativePurchasesEnabled = hideExternalPayments && import.meta.env.VITE_REVENUECAT_ENABLED === 'true';

async function getBridge(): Promise<RevenueCatBridge> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const host = window as unknown as { median?: { revenueCat?: RevenueCatBridge }; gonative?: { revenueCat?: RevenueCatBridge } };
    const bridge = host.median?.revenueCat || host.gonative?.revenueCat;
    if (bridge) {
      if (!['configure', 'isInitialized', 'login', 'logout', 'getOfferings', 'presentPaywall', 'restorePurchases']
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
  const platform = nativePlatform(navigator.userAgent);
  return platform === 'ios' ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '' :
    platform === 'android' ? import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY || '' : '';
});

export async function syncNativeSubscription(userId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  if (session.session?.user.id !== userId) throw new Error('Your account changed. Please sign in again.');
  const { error } = await supabase.functions.invoke('sync-revenuecat-subscription', { body: {} });
  if (error) throw new Error('Your store request finished, but OnlyFast could not confirm access yet. Use Refresh subscription in a moment.');
  const { data: current } = await supabase.auth.getSession();
  if (current.session?.user.id !== userId) throw new Error('Your account changed. Please sign in again.');
  window.dispatchEvent(new CustomEvent('subscription-updated'));
}

// App-wide lifecycle: runs outside Supabase's auth callback to avoid auth locks.
export function watchNativePurchases(): () => void {
  if (!nativePurchasesEnabled) return () => {};
  let active = true;
  let currentUser: string | null = null;
  let authRevision = 0;
  const update = (id: string | null) => {
    currentUser = id;
    void nativePurchases.setUser(id).catch(() => { /* Controls surface actionable errors. */ });
    if (id) setTimeout(() => {
      if (active && currentUser === id) void syncNativeSubscription(id).catch(() => {});
    }, 0);
  };
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'USER_UPDATED') return;
    authRevision++;
    if (session?.user.id !== currentUser) update(session?.user.id ?? null);
  });
  const initialRevision = authRevision;
  void supabase.auth.getSession().then(({ data }) => {
    if (active && authRevision === initialRevision) update(data.session?.user.id ?? null);
  });
  const resume = () => {
    if (document.visibilityState === 'visible' && currentUser) {
      void syncNativeSubscription(currentUser).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  return () => {
    active = false;
    listener.subscription.unsubscribe();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('focus', resume);
  };
}
