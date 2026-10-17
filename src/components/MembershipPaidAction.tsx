import React, { useEffect, useRef, useState } from 'react';
import { hideExternalPayments } from '@/lib/paymentVisibility';
import { supabase } from '@/lib/supabase';
import { fetchUserSubscription, deriveAccountStatus, syncMembershipFromSubscription, type AccountStatus } from '@/lib/subscription';
import NativeSubscriptionControls from './NativeSubscriptionControls';
import StripeBuyButton from './StripeBuyButton';
import type { StoreCatalog } from '@/lib/releaseNativeBilling';

export default function MembershipPaidAction({ userId, tier, onVerified, checkoutSelected, onSelect, nativeCatalog }: {
  userId: string; tier: 'pro' | 'team'; onVerified: () => void | Promise<void>; checkoutSelected: boolean; onSelect: () => void;
  nativeCatalog?: StoreCatalog;
}) {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [message, setMessage] = useState('');
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

  if (hideExternalPayments) return <NativeSubscriptionControls userId={userId} purchaseOnly
    purchasePlan={tier === 'team' ? 'teams' : 'pro'} catalog={nativeCatalog}
    purchaseLabel={tier === 'pro' ? 'Choose Pro' : 'Choose Teams'} onVerified={onVerified} />;

  const choose = async () => {
    setMessage('');
    try {
      await syncMembershipFromSubscription();
      const row = await fetchUserSubscription(userId);
      const { data } = await supabase.auth.getSession();
      if (!active.current || data.session?.user.id !== userId) return;
      const status = deriveAccountStatus(row);
      setAccount(status);
      if (!status.isPaid) onSelect();
    } catch { if (active.current) setMessage('Could not confirm your subscription. Please try again.'); }
  };

  return <div className="space-y-3">
    {account?.isPaid ? <p className="text-sm text-[#6B7280]">Your membership already includes paid access. Manage plan changes in Account Settings through your current provider.</p> : checkoutSelected ?
      <StripeBuyButton plan={tier === 'team' ? 'teams' : 'pro'} clientReferenceId={userId} /> :
      <button disabled={!account} onClick={() => void choose()} className="w-full rounded-xl bg-[#00A8E8] text-white py-3 font-semibold disabled:opacity-50">
        {tier === 'pro' ? 'Choose Pro' : 'Choose Teams'}
      </button>}
    {message && <p role="status" className="text-sm text-[#6B7280]">{message}</p>}
  </div>;
}
