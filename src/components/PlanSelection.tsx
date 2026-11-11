import React, { useEffect, useRef, useState } from 'react';
import { PLANS } from '@/lib/membership';
import MembershipComparison from './MembershipComparison';
import MembershipPlanCard from './MembershipPlanCard';
import MembershipPaidAction from './MembershipPaidAction';
import { hideExternalPayments } from '@/lib/paymentVisibility';
import TestSubscriptionGate from './TestSubscriptionGate';

interface PlanSelectionProps {
  onComplete: () => void | Promise<void>;
  onBack?: () => void;
  userId?: string;
  onPaidComplete?: () => void | Promise<void>;
  /** Only the existing web upgrade page may open Stripe checkout. */
  allowWebCheckout?: boolean;
  onboarding?: boolean;
}

const PlanSelection: React.FC<PlanSelectionProps> = ({ onComplete, onBack, userId, onPaidComplete, allowWebCheckout = false, onboarding = false }) => {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [checkoutTier, setCheckoutTier] = useState<'pro' | 'team' | null>(null);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  const handleContinue = async (paid = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveError('');
    try { await (paid ? onPaidComplete || onComplete : onComplete)(); }
    catch (error) { setSaveError('Your selection could not be saved. Please try again.'); if (paid) throw error; }
    finally { submitting.current = false; setSaving(false); }
  };


  return (
    <section className="membership-selection" aria-labelledby="plan-heading">
      <div className={`membership-selection__header${onboarding ? ' membership-selection__header--onboarding' : ''}`}>
        {onBack && <button onClick={onBack} disabled={saving} className="membership-back" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>}
        {!onboarding && <div className="membership-brand">
          <img src="/onlyfast-logo.png" alt="OnlyFast" width="1250" height="455" />
          <p>Race Smarter. Finish Faster.</p>
        </div>}
        <h2 id="plan-heading" ref={headingRef} tabIndex={-1} className="sr-only">Choose Your OnlyFast Plan</h2>
      </div>
      <div className="membership-plans">
        {PLANS.map(plan => <MembershipPlanCard key={plan.tier} plan={plan}
          onClick={hideExternalPayments && plan.tier !== 'rookie' ? event => {
            if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
            event.currentTarget.querySelector<HTMLButtonElement | HTMLAnchorElement>('[data-plan-action]')?.click();
          } : undefined}>
          {plan.tier !== 'rookie' && userId ? <MembershipPaidAction key={`${userId}:${plan.tier}`} userId={userId} tier={plan.tier} onboarding={onboarding} allowWebCheckout={allowWebCheckout} onVerified={() => handleContinue(true)} checkoutSelected={checkoutTier === plan.tier} onSelect={() => setCheckoutTier(plan.tier as 'pro' | 'team')} /> : <button
            data-plan-action onClick={plan.tier === 'rookie' ? () => void handleContinue() : undefined}
            disabled={saving || plan.tier !== 'rookie'} className="membership-cta">
            {saving ? 'Saving…' : plan.tier !== 'rookie' ? 'Sign in to choose this plan' : plan.buttonText}
          </button>}
        </MembershipPlanCard>)}
      </div>
      {saveError && <p role="alert" className="my-4 text-sm text-red-600">{saveError}</p>}
      <MembershipComparison />
      <div className="membership-disclosures">
        <p>Monthly membership prices shown in USD. Localized store prices, subscription terms and any eligible introductory offer will be shown before purchase. The $3 difference is based on USD pricing.</p>
        {hideExternalPayments && <p>Tap a paid plan to view your localized price and choose Pro or Teams in the store paywall. Existing subscribers can manage changes through their store.</p>}
      </div>
      {onboarding && <div className="text-center text-xs text-[#6B7280] mt-4 space-y-2">
        {hideExternalPayments && <p>The store paywall shows your actual localized price and billing terms. Subscriptions renew monthly unless canceled through your store account.</p>}
        <p><a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>{' · '}<a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="underline">Terms of Use</a></p>
      </div>}
      <p className="text-center text-xs text-[#6B7280] mt-4">
        Rookie is free forever. Existing paid memberships keep their current access.
      </p>
    </section>
  );
};

export default function AuthorizedPlanSelection(props: PlanSelectionProps) {
  return <TestSubscriptionGate key={props.userId} userId={props.userId} onContinue={props.onComplete} onBack={props.onBack} showBrand={!props.onboarding}>
    <PlanSelection {...props} />
  </TestSubscriptionGate>;
}
