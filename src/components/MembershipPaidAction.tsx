import React, { useEffect, useRef, useState } from 'react';
import { hideExternalPayments } from '@/lib/paymentVisibility';
import { supabase } from '@/lib/supabase';
import { fetchUserSubscription, deriveAccountStatus, syncMembershipFromSubscription, type AccountStatus } from '@/lib/subscription';
import NativeSubscriptionControls from './NativeSubscriptionControls';
import StripeBuyButton from './StripeBuyButton';

export default function MembershipPaidAction({ userId, tier, onVerified, checkoutSelected, onSelect, onboarding = false, allowWebCheckout = true }: {
  userId: string; tier: 'pro' | 'team'; onVerified: () => void | Promise<void>; checkoutSelected: boolean; onSelect: () => void; onboarding?: boolean; allowWebCheckout?: boolean;
}) {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    if (!hideExternalPayments) {
      void fetchUserSubscription(userId).then(row => {
        if (active.current) setAccount(deriveAccountStatus(row));
      }).catch(() => { if (active.current) setMessage('Could not load your subscription. Refresh to try again.'); });
    }
    return () => { active.current = false; };
  }, [userId]);

  if (hideExternalPayments) return <NativeSubscriptionControls userId={userId} purchaseOnly onVerified={onVerified}
    planTier={tier} onboardingTier={onboarding ? tier : undefined}
    purchaseLabel={tier === 'team' ? 'Go Unlimited' : 'Unlock Pro'} />;

  const choose = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setMessage('');
    try {
      await syncMembershipFromSubscription();
      const row = await fetchUserSubscription(userId);
      const { data } = await supabase.auth.getSession();
      if (!active.current || data.session?.user.id !== userId) return;
      const status = deriveAccountStatus(row);
      setAccount(status);
      if (status.isPaid && onboarding) await onVerified();
      else if (!status.isPaid) onSelect();
    } catch { if (active.current) setMessage(onboarding ? 'Could not confirm your subscription or finish onboarding. Please try again.' : 'Could not confirm your subscription. Please try again.'); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  };

  return <div className="space-y-3">
    {account?.isPaid ? <>
      <p className="text-sm text-[#6B7280]">{account.isAdmin ? 'Your admin access includes all features.' : account.plan === (tier === 'team' ? 'teams' : 'pro') ? `Current plan: ${account.label}. Your membership is active.` : account.plan === 'teams' ? 'Included in your active Teams membership.' : 'Your Pro membership is active. Teams adds unlimited cars and classes.'} Manage plan changes in Account Settings through your current provider.</p>
      {onboarding && <button disabled={busy} onClick={() => void choose()} className="w-full rounded-xl bg-[#00A8E8] text-white py-3 font-semibold disabled:opacity-50">{busy ? 'Please wait…' : 'Continue with current membership'}</button>}
    </> : checkoutSelected && !allowWebCheckout ? <p role="status" className="text-sm text-[#6B7280]">Store subscriptions are available in the OnlyFast Android and iOS apps. Continue with Rookie here, or open the mobile app to subscribe.</p> : checkoutSelected ?
      <StripeBuyButton plan={tier === 'team' ? 'teams' : 'pro'} clientReferenceId={userId} /> :
      <button data-plan-action disabled={busy || !account} onClick={() => void choose()} className="w-full rounded-xl bg-[#00A8E8] text-white py-3 font-semibold disabled:opacity-50">
        {tier === 'pro' ? 'Unlock Pro' : 'Go Unlimited'}
      </button>}
    {message && <p role="status" className="text-sm text-[#6B7280]">{message}</p>}
  </div>;
}
