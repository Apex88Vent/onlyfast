import React from 'react';
import { useNativeSubscription } from '@/hooks/useNativeSubscription';
import { nativePurchasesEnabled } from '@/lib/nativePurchases';
import { nativePlatform, nativeSubscriptionManagementUrl } from '@/lib/nativeEnvironment';

export default function NativeSubscriptionControls({ userId, purchaseOnly = false, hidePurchase = false, purchaseLabel = 'View Pro and Teams subscriptions', onVerified, onboardingTier, planTier }: {
  userId: string; purchaseOnly?: boolean; hidePurchase?: boolean; purchaseLabel?: string; onVerified?: () => void | Promise<void>; onboardingTier?: 'pro' | 'team'; planTier?: 'pro' | 'team';
}) {
  const { account, busy, message, loadError, run, offering, offeringError, retryOffering } = useNativeSubscription(userId, { onVerified, onboardingTier, planTier });
  const platform = nativePlatform(navigator.userAgent, navigator.maxTouchPoints);
  const managementUrl = nativeSubscriptionManagementUrl(platform);
  const otherStore = (platform === 'android' && account?.row?.revenuecat_store === 'app_store') ||
    (platform === 'ios' && account?.row?.revenuecat_store === 'play_store');
  const management = managementUrl ? <a data-plan-action={account?.isPaid ? true : undefined}
    href={managementUrl} target="_blank" rel="noopener noreferrer"
    className="inline-block text-sm font-semibold text-[#00A8E8] underline">Manage store subscription</a> :
    <p role="status" className="text-xs text-[#6B7280]">Could not identify this device's store. Reopen OnlyFast, or open subscription management in your store app.</p>;

  if (account?.testTier) return <div className="space-y-3 text-center">
    <p className="text-sm font-semibold">Current test tier: {account.testTier === 'team' ? 'Team' : account.testTier === 'pro' ? 'Pro' : 'Rookie'}</p>
    <a href="/pricing" className="text-sm font-semibold text-[#00A8E8] underline">Choose test subscription — no payment</a>
  </div>;

  if (onboardingTier) return <div className="space-y-3 text-center" aria-busy={busy || (!account && !loadError) || (account && !account.isPaid && offering === 'loading')}>
    {account?.isPaid ? <>
      <p className="text-sm text-[#6B7280]">Your {account.label} membership is active. No additional purchase is needed.</p>
      <button data-plan-action disabled={busy} onClick={() => void run('continue')} className="w-full rounded-xl bg-[#00A8E8] px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? 'Please wait…' : 'Continue with current membership'}
      </button>
    </> : <>
      <button data-plan-action disabled={!nativePurchasesEnabled || busy || !account || loadError || offering !== 'ready'} onClick={() => void run('purchase')}
        className="w-full rounded-xl bg-[#00A8E8] px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? 'Please wait…' : !account ? loadError ? 'Subscription unavailable' : 'Checking membership…' : offering === 'loading' ? 'Loading store plans…' : offering === 'ready' ? purchaseLabel : 'Subscription unavailable'}
      </button>
      {offering === 'ready' && <p className="text-xs text-[#6B7280]">Choose {onboardingTier === 'pro' ? 'Pro' : 'Teams'} on the store paywall. Confirm its localized price and monthly renewal terms before subscribing.</p>}
      {offeringError && <p role="status" className="text-sm text-[#6B7280]">{offeringError}</p>}
      {offering === 'unavailable' && <button disabled={busy} onClick={retryOffering} className="text-sm font-semibold text-[#00A8E8] underline disabled:opacity-50">Retry loading plans</button>}
    </>}
    <div className="flex flex-wrap justify-center gap-4">
      <button disabled={!nativePurchasesEnabled || busy || !account || loadError} onClick={() => void run('restore')} className="text-sm font-semibold text-[#00A8E8] underline disabled:opacity-50">Restore Purchases</button>
      <button disabled={busy} onClick={() => void run('refresh')} className="text-sm text-[#6B7280] underline disabled:opacity-50">Refresh subscription</button>
    </div>
    {loadError && <p role="status" className="text-sm text-[#6B7280]">Could not load your membership. Refresh subscription to retry.</p>}
    {message && <p role="status" className="text-sm text-[#374151]">{message}</p>}
  </div>;

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
    <>
      {account?.isPaid ? <p className="text-xs text-[#6B7280]">
        {account.row?.subscription_source === 'revenuecat' ?
          'Manage or cancel your plan in Apple Settings → Subscriptions or Google Play → Payments & subscriptions, using the store where you purchased.' :
          'Your existing membership is available in this app. No additional purchase is needed. Contact admin@onlyfast.app for account support.'}
      </p> : !hidePurchase && <button data-plan-action disabled={!nativePurchasesEnabled || busy || !account || loadError || (!!planTier && offering !== 'ready')} onClick={() => void run('purchase')}
        className="w-full rounded-xl bg-[#00A8E8] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Please wait…' : !account && !loadError ? 'Checking membership…' : !nativePurchasesEnabled || loadError || (planTier && offering === 'unavailable') ? 'Subscription unavailable' : planTier && offering === 'loading' ? 'Loading store plans…' : purchaseLabel}
      </button>}
      {planTier && !account?.isPaid && offeringError && <p role="status" className="text-sm text-[#6B7280]">{offeringError}</p>}
      {planTier && !account?.isPaid && offering === 'unavailable' && <button disabled={busy} onClick={retryOffering} className="text-sm font-semibold text-[#00A8E8] underline disabled:opacity-50">Retry loading plans</button>}
      {(!purchaseOnly || (account?.isPaid && account.row?.subscription_source === 'revenuecat')) && management}
      {otherStore && <p className="text-xs text-[#6B7280]">Your recorded subscription was purchased through {account?.row?.revenuecat_store === 'app_store' ? 'Apple' : 'Google Play'}. This device opens {platform === 'android' ? 'Google Play' : 'Apple'} subscriptions. To change the recorded subscription, use the original store account. Your OnlyFast access is unchanged.</p>}
      {!purchaseOnly && <div className="flex flex-wrap justify-center gap-4">
        <button disabled={!nativePurchasesEnabled || busy} onClick={() => void run('restore')} className="text-sm font-semibold text-[#00A8E8] underline disabled:opacity-50">Restore Purchases</button>
        <button disabled={busy} onClick={() => void run('refresh')} className="text-sm text-[#6B7280] underline disabled:opacity-50">Refresh subscription</button>
      </div>}
      {!purchaseOnly && !nativePurchasesEnabled && <p className="text-xs text-[#6B7280]">New store purchases and restoration are unavailable in this build. Existing memberships still work; refresh to check your access.</p>}
    </>
    {loadError && <p role="status" className="text-sm text-[#6B7280]">Could not load your membership. Refresh subscription to retry.</p>}
    {message && <p role="status" className="text-sm text-[#374151]">{message}</p>}
  </div>;
}
