import React, { useEffect, useRef, useState } from 'react';
import { syncMembershipFromSubscription } from '@/lib/subscription';
import { selectTestTier } from '@/lib/testSubscription';
import { PLANS, type MembershipTier } from '@/lib/membership';
import { supabase } from '@/lib/supabase';
import { getTrustedTestTier } from '@/lib/trustedMembership';
import { useMembershipRevision } from '@/hooks/useMembershipRevision';
import MembershipComparison from './MembershipComparison';
import MembershipPlanCard from './MembershipPlanCard';
import { PLANS_2027 } from '@/lib/subscription2027Catalog';

// Mount checkout controls only after the server has resolved this account.
export default function TestSubscriptionGate({ userId, onContinue, onBack, children, showBrand = true }: {
  userId?: string; onContinue: () => void | Promise<void>; onBack?: () => void; children: React.ReactNode; showBrand?: boolean;
}) {
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [isTester, setIsTester] = useState(false);
  useMembershipRevision();
  const tier = userId ? getTrustedTestTier(userId) : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const generationRef = generation;
    const revision = ++generationRef.current;
    setLoadedUser(null); setIsTester(false); setError('');
    if (userId) void syncMembershipFromSubscription().then(async status => {
      const current = await supabase.auth.getSession();
      if (generation.current !== revision || current.data.session?.user.id !== userId) return;
      if (!status) throw new Error('Membership unavailable');
      setIsTester(!!status.testTier); setLoadedUser(userId);
    }).catch(e => {
      if (generation.current === revision) setError(e instanceof Error ? e.message : 'Could not load your membership. Please retry.');
    });
    return () => { generationRef.current++; };
  }, [userId, retry]);

  const run = async (next?: MembershipTier) => {
    if (!userId || pending.current) return;
    const revision = generation.current;
    pending.current = true; setBusy(true); setError('');
    try {
      if (next) await selectTestTier(userId, next);
      else await onContinue();
    } catch (e) {
      if (generation.current === revision) setError(e instanceof Error ? e.message : 'Could not save your test tier.');
    } finally {
      pending.current = false;
      if (generation.current === revision) setBusy(false);
    }
  };

  const testing = import.meta.env.ONLYFAST_2027_PREVIEW;
  const plans = testing ? PLANS_2027 : PLANS;
  const tierName = plans.find(plan => plan.tier === tier)?.displayName || tier;
  const noOverride = <div className="space-y-4 p-6 text-center">
    <p>Purchases are disabled in testing. Subscription switching requires an authorized synthetic test account.</p>
    <button className="rounded-xl bg-[#00A8E8] px-6 py-3 font-semibold text-white" onClick={() => void run()}>Continue</button>
  </div>;
  if (!userId) return testing ? noOverride : <>{children}</>;
  if (loadedUser !== userId || (isTester && !tier)) return <div role="status" className="text-center p-6">
    {error || (isTester ? 'Your test tier could not be confirmed. Please retry.' : 'Checking membership…')}
    {(error || isTester) && <button className="block mx-auto mt-3 underline" onClick={() => setRetry(value => value + 1)}>Retry</button>}
  </div>;
  if (!tier) return testing ? noOverride : <>{children}</>;

  return <section aria-label="Test subscription selection" className="space-y-5">
    {showBrand && <div className="membership-brand"><img src="/onlyfast-logo.png" alt="OnlyFast" width="1250" height="455" /><p>Race Smarter. Finish Faster.</p></div>}
    {onBack && <button onClick={onBack} disabled={busy} className="text-[#6B7280] underline">Back</button>}
    <h2 className="text-2xl font-bold text-[#1A1B23]">Test subscription</h2>
    <p className="text-[#6B7280]">Choose a tier for this authorized test account. No payment required. Your selection stays saved when you sign out.</p>
    <p role="status" className="font-semibold">Current test tier: {testing ? tierName : tier === 'team' ? 'Team' : tier === 'pro' ? 'Pro' : 'Rookie'}</p>
    <div className="membership-plans" aria-busy={busy}>
      {plans.map(plan => <MembershipPlanCard key={plan.tier} plan={testing ? { ...plan, priceDisplay: 'Testing — no charge', supportingText: 'Synthetic subscription. Real billing is disabled.' } : plan}>
        <button data-plan-action disabled={busy} aria-pressed={tier === plan.tier}
          onClick={() => void run(plan.tier)}>
          {plan.displayName}{tier === plan.tier ? ' — Selected' : ' — Select test tier'}
        </button>
      </MembershipPlanCard>)}
    </div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <button onClick={() => void run()} disabled={busy} className="rounded-xl bg-[#00A8E8] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Continue'}</button>
    {!testing && <MembershipComparison />}
  </section>;
}
