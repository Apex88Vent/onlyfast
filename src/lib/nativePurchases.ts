import { supabase } from './supabase';
import { hideExternalPayments } from './paymentVisibility';
import { NATIVE_PURCHASES_READY } from './nativePurchaseController';
import { ReleaseNativePurchaseController } from './releaseNativeBilling';
import { getReleaseBillingBridge } from './releaseNativeTransport';
import { watchMembershipLifecycle } from './membershipLifecycle';
import { clearTrustedMembership, getMembershipExpiration, notifyMembershipExpiration } from './trustedMembership';
import { syncMembershipFromSubscription } from './subscription';

// A build flag alone must not release purchasing. Both wrapper packaging and
// transaction approval are still required; see docs/NATIVE_RELEASE_PREPARATION.md.
export const nativePurchasesEnabled = NATIVE_PURCHASES_READY && hideExternalPayments && import.meta.env.VITE_REVENUECAT_ENABLED === 'true';

export const nativePurchases = new ReleaseNativePurchaseController(getReleaseBillingBridge, async () => {
  const { data, error } = await supabase.auth.getSession();
  return error || !data.session ? null : { userId: data.session.user.id, accessToken: data.session.access_token };
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
      if (hideExternalPayments && (status?.row?.subscription_source === 'revenuecat' ||
          (nativePurchasesEnabled && status && !status.isPaid))) {
        try { await syncNativeSubscription(id, false); }
        finally { await syncMembershipFromSubscription(); }
      }
    },
    expiresAt: getMembershipExpiration,
    onExpiration: notifyMembershipExpiration,
  }, window, document);
}
