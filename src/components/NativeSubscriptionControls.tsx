import React, { useEffect, useRef, useState } from 'react';
import { fetchUserSubscription, deriveAccountStatus, syncMembershipFromSubscription, type AccountStatus } from '@/lib/subscription';
import { nativePurchases, nativePurchasesEnabled, syncNativeSubscription } from '@/lib/nativePurchases';
import { NativePurchaseError } from '@/lib/nativePurchaseController';
import { supabase } from '@/lib/supabase';

async function loadStatus(userId: string) {
  await syncMembershipFromSubscription();
  const row = await fetchUserSubscription(userId);
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== userId) throw new Error('Your account changed. Please try again.');
  // Never derive this account's admin/promo state from another user's local cache.
  return deriveAccountStatus(row, { membership_tier: 'rookie', ...data.session.user.user_metadata });
}

export default function NativeSubscriptionControls({ userId, purchaseOnly = false, hidePurchase = false, purchaseLabel = 'View Pro and Teams subscriptions', onVerified }: {
  userId: string; purchaseOnly?: boolean; hidePurchase?: boolean; purchaseLabel?: string; onVerified?: () => void | Promise<void>;
}) {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const revision = ++generation.current;
    const generationRef = generation;
    setAccount(null); setMessage(''); setBusy(false);
    const refresh = async () => {
      try {
        const status = await loadStatus(userId);
        if (generation.current === revision) { setAccount(status); setLoadError(false); }
      } catch { if (generation.current === revision) setLoadError(true); }
    };
    void refresh();
    window.addEventListener('subscription-updated', refresh);
    return () => { generationRef.current++; window.removeEventListener('subscription-updated', refresh); };
  }, [userId]);

  const run = async (action: 'purchase' | 'restore' | 'refresh') => {
    if (action !== 'refresh' && !nativePurchasesEnabled) return;
    const revision = generation.current;
    setBusy(true); setMessage('');
    try {
      if (action !== 'refresh') {
        // Recheck the database immediately before presenting a paid offer.
        const existing = await loadStatus(userId);
        const { data: session } = await supabase.auth.getSession();
        if (generation.current !== revision || session.session?.user.id !== userId) return;
        if (action === 'purchase' && existing.isPaid) {
          setAccount(existing);
          setMessage('Your paid membership is already active. Manage changes through your current subscription provider.');
          return;
        }
        await nativePurchases.setUser(userId);
        if (generation.current !== revision) return;
        await nativePurchases.run(userId, action);
      }
      if (nativePurchasesEnabled) await syncNativeSubscription(userId);
      else await syncMembershipFromSubscription();
      const status = await loadStatus(userId);
      if (generation.current !== revision) return;
      setAccount(status); setLoadError(false);
      if (status.isPaid && action === 'purchase') await onVerified?.();
      setMessage(status.isPaid ? 'Your subscription is active.' : action === 'restore' ?
        'No active store subscription was found for this account. Check your store account and OnlyFast login.' :
        'No active subscription is confirmed yet. If you purchased, refresh in a moment.');
    } catch (error) {
      if (generation.current === revision) setMessage(error instanceof NativePurchaseError && error.cancelled ?
        'Purchase cancelled.' : error instanceof Error ? error.message : 'Unable to complete the request. Please try again.');
    } finally { if (generation.current === revision) setBusy(false); }
  };

  return <div className="space-y-3 text-center">
    {!purchaseOnly && <p className="text-sm font-semibold text-[#1A1B23]">
      {account ? `Current plan: ${account.label === 'Free' ? 'Rookie' : account.label}` :
        loadError ? 'Could not load your subscription.' : 'Loading subscription…'}
    </p>}
    {!nativePurchasesEnabled && purchaseOnly ? <button disabled className="w-full rounded-xl bg-[#00A8E8] px-4 py-3 font-semibold text-white opacity-60">Coming Soon</button> : <>
      {account?.isPaid ? <p className="text-xs text-[#6B7280]">
        {account.row?.subscription_source === 'revenuecat' ?
          'Manage or cancel your plan in Apple Settings → Subscriptions or Google Play → Payments & subscriptions, using the store where you purchased.' :
          'Your existing membership is available in this app. No additional purchase is needed. Contact admin@onlyfast.app for account support.'}
      </p> : !hidePurchase && <button disabled={!nativePurchasesEnabled || busy || !account || loadError} onClick={() => void run('purchase')}
        className="w-full rounded-xl bg-[#00A8E8] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Please wait…' : nativePurchasesEnabled ? purchaseLabel : 'Coming Soon'}
      </button>}
      {!purchaseOnly && account?.row?.subscription_source === 'revenuecat' && ['app_store', 'play_store'].includes(account.row.revenuecat_store || '') && <a
        href={account.row.revenuecat_store === 'app_store' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions'}
        target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-[#00A8E8] underline">
        Manage store subscription
      </a>}
      {!purchaseOnly && <div className="flex flex-wrap justify-center gap-4">
        <button disabled={!nativePurchasesEnabled || busy} onClick={() => void run('restore')} className="text-sm font-semibold text-[#00A8E8] underline disabled:opacity-50">Restore Purchases</button>
        <button disabled={busy} onClick={() => void run('refresh')} className="text-sm text-[#6B7280] underline disabled:opacity-50">Refresh subscription</button>
      </div>}
    </>}
    {message && <p role="status" className="text-sm text-[#374151]">{message}</p>}
  </div>;
}
