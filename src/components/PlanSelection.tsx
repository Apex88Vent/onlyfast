import React, { useEffect, useRef, useState } from 'react';
import { PLANS } from '@/lib/membership';
import MembershipComparison from './MembershipComparison';
import MembershipPaidAction from './MembershipPaidAction';
import { hideExternalPayments } from '@/lib/paymentVisibility';
import { nativePurchasesEnabled } from '@/lib/nativePurchases';

interface PlanSelectionProps {
  onComplete: () => void | Promise<void>;
  onBack?: () => void;
  userId?: string;
  onPaidComplete?: () => void | Promise<void>;
  /** Only the existing web upgrade page may open Stripe checkout. */
  allowWebCheckout?: boolean;
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlanSelection: React.FC<PlanSelectionProps> = ({ onComplete, onBack, userId, onPaidComplete, allowWebCheckout = false }) => {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [checkoutTier, setCheckoutTier] = useState<'pro' | 'team' | null>(null);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const handleContinue = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveError('');
    try { await onComplete(); }
    catch { setSaveError('Your selection could not be saved. Please try again.'); }
    finally { submitting.current = false; setSaving(false); }
  };


  return (
    <section aria-labelledby="plan-heading">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            disabled={saving}
            className="text-[#6B7280] hover:text-[#00A8E8] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div>
          <h2 id="plan-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-[#1A1B23] outline-none">Choose Your OnlyFast Plan</h2>
          <p className="text-[#6B7280] text-sm">Start racing for free, or unlock more features with Pro and Teams.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 items-stretch">
        {PLANS.map((plan) => {
          const isRecommended = plan.recommended;
          const comingSoon = plan.tier !== 'rookie' &&
            (hideExternalPayments ? !nativePurchasesEnabled : !allowWebCheckout);
          return (
            <div
              key={plan.tier}
              className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all bg-white ${
                isRecommended
                  ? 'border-[#00A8E8] shadow-xl shadow-[#00A8E8]/15 md:-mt-2 md:mb-2 ring-1 ring-[#00A8E8]/30'
                  : 'border-[#E5E7EB] shadow-sm'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00A8E8] text-white text-xs font-bold uppercase tracking-wide px-4 py-1 rounded-full shadow">
                  {plan.badge}
                </div>
              )}

              {comingSoon && (
                <div className="flex justify-center mb-1 mt-1">
                  <span className="inline-flex items-center gap-1.5 bg-[#1A1B23] text-white text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow">
                    Coming Soon
                  </span>
                </div>
              )}

              <div className="text-center mb-4 mt-1">
                <h3 className={`text-xl font-bold ${isRecommended ? 'text-[#00A8E8]' : 'text-[#1A1B23]'}`}>
                  {plan.tier === 'team' ? 'Teams' : plan.displayName}
                </h3>
                <p className="text-3xl font-extrabold text-[#1A1B23] mt-2">
                  {plan.priceDisplay === 'FREE' ? 'FREE' : plan.priceDisplay.split('/')[0]}
                  {plan.priceDisplay !== 'FREE' && (
                    <span className="text-base font-medium text-[#6B7280]"> / month</span>
                  )}
                </p>
              </div>

              <p className="text-sm text-[#6B7280] mb-4">{plan.description}</p>
              {plan.tier !== 'rookie' && <p className="text-xs text-[#6B7280] mb-3">Localized store prices, subscription terms and any eligible introductory offer will be shown before purchase.</p>}
              {plan.tier === 'rookie' && <p className="text-xs text-[#6B7280] mb-3">Setup export, leaderboard uploads and badges, and advanced profiles are locked. Pro or Teams unlocks them.</p>}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.synopsis.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#4B5563]">
                    <span className={isRecommended ? 'text-[#00A8E8]' : 'text-[#9CA3AF]'}>
                      <CheckIcon />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {plan.tier !== 'rookie' && userId && !comingSoon ? <MembershipPaidAction key={`${userId}:${plan.tier}`} userId={userId} tier={plan.tier} onVerified={onPaidComplete || onComplete} checkoutSelected={checkoutTier === plan.tier} onSelect={() => setCheckoutTier(plan.tier as 'pro' | 'team')} /> : <button
                onClick={plan.tier === 'rookie' ? handleContinue : undefined}
                disabled={saving || plan.tier !== 'rookie'}
                className={`w-full py-3 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 disabled:opacity-50 ${
                  isRecommended
                    ? 'bg-[#00A8E8] hover:bg-[#0090c7] text-white'
                    : 'bg-[#F5F5F7] hover:bg-[#E5E7EB] text-[#1A1B23] border border-[#E5E7EB]'
                }`}
              >
                {comingSoon ? 'Coming Soon' : saving ? 'Saving…' : plan.buttonText}
              </button>}
              {plan.tier === 'rookie' && <p className="mt-3 text-xs text-[#6B7280]">No payment information required. Saved setups remain viewable.</p>}

            </div>
          );
        })}
      </div>

      {saveError && <p role="alert" className="mb-4 text-sm text-red-600">{saveError}</p>}
      <MembershipComparison />
      <p className="text-center text-xs text-[#9CA3AF] mt-4">
        Rookie is free forever. Existing paid memberships keep their current access.
      </p>
    </section>
  );
};

export default PlanSelection;
