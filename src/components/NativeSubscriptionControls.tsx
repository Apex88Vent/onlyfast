import React from 'react';
import { useNativeSubscription } from '@/hooks/useNativeSubscription';
import { nativePurchasesEnabled } from '@/lib/nativePurchases';

export default function NativeSubscriptionControls({ userId, purchaseOnly = false, hidePurchase = false, purchaseLabel = 'View Pro and Teams subscriptions', onVerified }: {
  userId: string; purchaseOnly?: boolean; hidePurchase?: boolean; purchaseLabel?: string; onVerified?: () => void | Promise<void>;
}) {
  const { account, busy, message, loadError, run } = useNativeSubscription(userId, { onVerified });

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
      {!purchaseOnly && !nativePurchasesEnabled && <p className="text-xs text-[#6B7280]">New store purchases and restoration are unavailable in this build. Existing memberships still work; refresh to check your access.</p>}
    </>}
    {message && <p role="status" className="text-sm text-[#374151]">{message}</p>}
  </div>;
}
