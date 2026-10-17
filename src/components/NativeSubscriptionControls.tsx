import React, { useEffect, useRef, useState } from 'react';
import { fetchUserSubscription, deriveAccountStatus, syncMembershipFromSubscription, type AccountStatus } from '@/lib/subscription';
import { nativePurchases, nativePurchasesEnabled, syncNativeSubscription } from '@/lib/nativePurchases';
import { NativePurchaseError } from '@/lib/nativePurchaseController';
import { supabase } from '@/lib/supabase';
import type { StoreCatalog, StorePlan } from '@/lib/releaseNativeBilling';

async function loadStatus(userId: string) {
  const initial = await supabase.auth.getSession();
  if (initial.data.session?.user.id !== userId) throw new Error('Your account changed. Please try again.');
  const status = await syncMembershipFromSubscription();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== userId || !status) throw new Error('Your account changed. Please try again.');
  return status;
}

export default function NativeSubscriptionControls({ userId, purchaseOnly = false, hidePurchase = false, purchaseLabel = 'View Pro and Teams subscriptions', purchasePlan, catalog, onVerified }: {
  userId: string; purchaseOnly?: boolean; hidePurchase?: boolean; purchaseLabel?: string; onVerified?: () => void | Promise<void>;
  purchasePlan?: StorePlan; catalog?: StoreCatalog;
}) {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const revision = ++generation.current;
    const generationRef = generation;
    setAccount(null); setMessage(''); setBusy(false); setLoadError(false);
    const refresh = async () => {
      try {
        const status = await loadStatus(userId);
        if (generation.current === revision) { setAccount(status); setLoadError(false); }
      } catch { if (generation.current === revision) setLoadError(true); }
    };
    void refresh();
    window.addEventListener('subscription-updated', refresh);
    window.addEventListener('membership-updated', refreshDisplay);
    function refreshDisplay() {
      // The lifecycle has already refreshed trusted membership. Reading it again
      // through loadStatus would publish another event and recurse indefinitely.
      void supabase.auth.getSession().then(({ data }) => {
        if (generation.current === revision && data.session?.user.id === userId) {
          setAccount(current => current ? deriveAccountStatus(current.row) : null);
          void fetchUserSubscription(userId).then(async row => {
            const current = await supabase.auth.getSession();
            if (generation.current === revision && current.data.session?.user.id === userId) setAccount(deriveAccountStatus(row));
          }).catch(() => {});
        } else if (generation.current === revision) setAccount(null);
      }).catch(() => {});
    }
    return () => { generationRef.current++; window.removeEventListener('subscription-updated', refresh); window.removeEventListener('membership-updated', refreshDisplay); };
  }, [userId]);

  const run = async (action: 'purchase' | 'restore' | 'refresh') => {
    if (action !== 'refresh' && !nativePurchasesEnabled) return;
    if (pending.current) return;
    pending.current = true;
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
        await nativePurchases.run(userId, action, purchasePlan, catalog);
      }
      if (nativePurchasesEnabled || account?.row?.subscription_source === 'revenuecat') await syncNativeSubscription(userId);
      const status = await loadStatus(userId);
      if (generation.current !== revision) return;
      setAccount(status); setLoadError(false);
      if (status.isPaid && action !== 'refresh') await onVerified?.();
      setMessage(status.isPaid ? 'Your subscription is active.' : action === 'restore' ?
        'No active store subscription was found for this account. Check your store account and OnlyFast login.' :
        'No active subscription is confirmed yet. If you purchased, refresh in a moment.');
    } catch (error) {
      if (generation.current === revision) setMessage(error instanceof NativePurchaseError && error.cancelled ?
        'Purchase cancelled.' : error instanceof Error ? error.message : 'Unable to complete the request. Please try again.');
    } finally { pending.current = false; if (generation.current === revision) setBusy(false); }
  };

  return <div className="space-y-3 text-center" aria-busy={busy}>
    {!purchaseOnly && <p className="text-sm font-semibold text-[#1A1B23]">
      {account ? `Current plan: ${account.label === 'Free' ? 'Rookie' : account.label}` :
        loadError ? 'Could not load your subscription.' : 'Loading subscription…'}
    </p>}
    {!purchaseOnly && account && <p className="text-xs text-[#6B7280]">
      {account.isPaid ? account.row?.subscription_source === 'revenuecat' && account.row.revenuecat_expires_at && Date.parse(account.row.revenuecat_expires_at) > Date.now()
        ? `Store access confirmed until ${new Date(account.row.revenuecat_expires_at).toLocaleString()}.`
        : 'Your existing membership is active.' : 'Rookie is free. No subscription or payment is required.'}
    </p>}
    {!nativePurchasesEnabled && purchaseOnly ? <button disabled className="w-full rounded-xl bg-[#00A8E8] px-4 py-3 font-semibold text-white opacity-60">Coming Soon</button> : <>
      {account?.isPaid ? <p className="text-xs text-[#6B7280]">
        {account.row?.subscription_source === 'revenuecat' ?
          'Manage or cancel your plan in Apple Settings → Subscriptions or Google Play → Payments & subscriptions, using the store where you purchased.' :
          'Your existing membership is available in this app. No additional purchase is needed. Contact admin@onlyfast.app for account support.'}
      </p> : !hidePurchase && <button disabled={!nativePurchasesEnabled || busy || !account || loadError || !purchasePlan || !catalog} onClick={() => void run('purchase')}
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
      {!purchaseOnly && !nativePurchasesEnabled && <p className="text-xs text-[#6B7280]">New store purchases and restoration are unavailable in this build. Existing memberships still work; refresh to check your access.</p>}
    </>}
    {message && <p role="status" className="text-sm text-[#374151]">{message}</p>}
  </div>;
}
