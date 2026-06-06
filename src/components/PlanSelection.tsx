import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  PLANS,
  applyPromoCode,
  saveMembership,
  setPendingPlan,
  type MembershipTier,
  type MembershipState,
  type CheckoutPlan,
  DEFAULT_MEMBERSHIP,
} from '@/lib/membership';

interface PlanSelectionProps {
  onComplete: (state: MembershipState) => void;
  onBack?: () => void;
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Map internal tier values to the Stripe checkout plan values.
const TIER_TO_CHECKOUT_PLAN: Record<MembershipTier, CheckoutPlan> = {
  rookie: 'free',
  pro: 'pro',
  team: 'teams',
};


const PlanSelection: React.FC<PlanSelectionProps> = ({ onComplete, onBack }) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<MembershipTier>('rookie');
  const [promoInput, setPromoInput] = useState('');
  const [promoState, setPromoState] = useState<MembershipState | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleApplyPromo = () => {
    const result = applyPromoCode(promoInput);
    if (result.ok && result.state) {
      setPromoState(result.state);
      setSelected(result.state.membership_tier);
      setPromoMsg({ ok: true, text: result.message });
    } else {
      setPromoState(null);
      setPromoMsg({ ok: false, text: result.message });
    }
  };

  // Free plan -> normal registration. Pro/Teams -> Stripe Buy Button flow:
  // save pending_plan, then route to /upgrade (logged in) or to login if not.
  const handlePlanClick = async (tier: MembershipTier) => {
    const checkoutPlan = TIER_TO_CHECKOUT_PLAN[tier];

    if (checkoutPlan === 'free') {
      handleContinue(tier);
      return;
    }

    setPendingPlan(checkoutPlan);
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      // Already logged in -> go straight to the logged-in checkout page.
      navigate('/upgrade', { state: { plan: checkoutPlan } });
    } else {
      // Not authenticated -> /upgrade requires auth and will prompt sign in,
      // never sending an unauthenticated user directly to Stripe.
      navigate('/upgrade', { state: { plan: checkoutPlan } });
    }
  };

  const handleContinue = async (tier: MembershipTier) => {
    setSaving(true);
    let state: MembershipState;
    // A successfully applied promo overrides the plain plan selection
    if (promoState && (promoState.membership_tier === tier || promoState.has_admin_full_access)) {
      state = promoState;
    } else {
      state = { ...DEFAULT_MEMBERSHIP, membership_tier: tier };
    }
    await saveMembership(state);
    setSaving(false);
    onComplete(state);
  };


  return (
    <section aria-labelledby="plan-heading">
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="text-[#6B7280] hover:text-[#00A8E8] transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#00A8E8]"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div>
          <h2 id="plan-heading" className="text-2xl font-bold text-[#1A1B23]">Choose Your Plan</h2>
          <p className="text-[#6B7280] text-sm">Pick the membership that fits your racing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 items-stretch">
        {PLANS.map((plan) => {
          const isRecommended = plan.recommended;
          const isSelected = selected === plan.tier;
          return (
            <div
              key={plan.tier}
              className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all bg-white ${
                isRecommended
                  ? 'border-[#00A8E8] shadow-xl shadow-[#00A8E8]/15 md:-mt-2 md:mb-2 ring-1 ring-[#00A8E8]/30'
                  : isSelected
                  ? 'border-[#00A8E8] shadow-md'
                  : 'border-[#E5E7EB] shadow-sm'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00A8E8] text-white text-xs font-bold uppercase tracking-wide px-4 py-1 rounded-full shadow">
                  {plan.badge}
                </div>
              )}

              {plan.tier === 'pro' && (
                <div className="flex justify-center mb-1 mt-1">
                  <span className="inline-flex items-center gap-1.5 bg-[#1A1B23] text-white text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    7 day free trial
                  </span>
                </div>
              )}

              <div className="text-center mb-4 mt-1">
                <h3 className={`text-xl font-bold ${isRecommended ? 'text-[#00A8E8]' : 'text-[#1A1B23]'}`}>
                  {plan.displayName}
                </h3>
                <p className="text-3xl font-extrabold text-[#1A1B23] mt-2">
                  {plan.priceDisplay === 'Free' ? 'Free' : plan.priceDisplay.split('/')[0]}
                  {plan.priceDisplay !== 'Free' && (
                    <span className="text-base font-medium text-[#6B7280]">/mo</span>
                  )}
                </p>
              </div>

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

              <button
                onClick={() => handlePlanClick(plan.tier)}
                disabled={saving}
                className={`w-full py-3 rounded-xl font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 disabled:opacity-50 ${
                  isRecommended
                    ? 'bg-[#00A8E8] hover:bg-[#0090c7] text-white'
                    : 'bg-[#F5F5F7] hover:bg-[#E5E7EB] text-[#1A1B23] border border-[#E5E7EB]'
                }`}
              >
                {plan.buttonText}
              </button>

            </div>
          );
        })}
      </div>

      {/* Promo code box */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm max-w-xl mx-auto">
        <label htmlFor="promo-code" className="block text-sm font-semibold text-[#1A1B23] mb-2">
          Have a promo code?
        </label>
        <div className="flex gap-2">
          <input
            id="promo-code"
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } }}
            placeholder="Enter promo code"
            className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#00A8E8] focus:border-[#00A8E8] outline-none transition-all text-[#1A1B23] bg-[#F9FAFB] placeholder-[#9CA3AF]"
          />
          <button
            type="button"
            onClick={handleApplyPromo}
            className="px-5 py-2.5 bg-[#1A1B23] hover:bg-black text-white rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
          >
            Apply
          </button>
        </div>
        {promoMsg && (
          <p
            role="status"
            className={`mt-3 text-sm font-medium flex items-center gap-2 ${
              promoMsg.ok ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {promoMsg.ok ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            )}
            {promoMsg.text}
          </p>
        )}
        {promoState && (
          <button
            onClick={() => handleContinue(promoState.membership_tier)}
            disabled={saving}
            className="mt-4 w-full py-3 rounded-xl font-semibold bg-[#00A8E8] hover:bg-[#0090c7] text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2 disabled:opacity-50"
          >
            Continue with promo access
          </button>
        )}
      </div>

      <p className="text-center text-xs text-[#9CA3AF] mt-4">
        New accounts default to Rookie if no plan or promo code is selected.
      </p>
    </section>
  );
};

export default PlanSelection;
