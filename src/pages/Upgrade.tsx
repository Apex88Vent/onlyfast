import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeBack } from '@/lib/safeBack';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import {
  getPendingPlan,
  clearPendingPlan,
  saveMembership,
  DEFAULT_MEMBERSHIP,
  type CheckoutPlan,
} from '@/lib/membership';
import { hideExternalPayments, nativeUpgradeMessage } from '@/lib/paymentVisibility';
import { deriveAccountStatus, fetchUserSubscription, type AccountStatus } from '@/lib/subscription';
import StripeBuyButton from '@/components/StripeBuyButton';
import AuthModal from '@/components/AuthModal';

const FreeTrialBadge: React.FC = () => (
  <div className="inline-flex items-center gap-2 bg-[#00A8E8] text-white text-sm font-bold uppercase tracking-wide px-4 py-1.5 rounded-full shadow mb-3">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
    7 day free trial
  </div>
);

const FeatureList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2 w-full mt-4 mb-5 text-left">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2 text-sm text-[#374151]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#00A8E8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-0.5 flex-shrink-0"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const NativePaymentNotice: React.FC<{ planName: string }> = ({ planName }) => (
  <div className="w-full rounded-xl border border-[#D7EEF8] bg-[#F3FBFE] px-4 py-3 text-center">
    <p className="text-sm font-semibold text-[#1A1B23]">{planName} is available on the web.</p>
    <p className="text-xs text-[#4B5563] mt-1">{nativeUpgradeMessage}</p>
  </div>
);

const Upgrade: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingPlan, setPendingPlanState] = useState<CheckoutPlan | null>(null);
  const [choosingRookie, setChoosingRookie] = useState(false);
  const [account, setAccount] = useState<AccountStatus | null>(null);

  // Resolve the requested plan from route state first, then localStorage.
  useEffect(() => {
    const fromState = (location.state as { plan?: CheckoutPlan } | null)?.plan;
    const plan = fromState || getPendingPlan();
    setPendingPlanState(plan && plan !== 'free' ? plan : null);
    // Clear pending_plan once the checkout page has loaded.
    clearPendingPlan();
  }, [location.state]);

  // Auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setAuthModalOpen(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false);
      if (!session?.user) setAuthModalOpen(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hideExternalPayments || !user) {
      setAccount(null);
      return;
    }

    let cancelled = false;
    const meta = user.user_metadata || {};
    fetchUserSubscription(user.id)
      .then((row) => { if (!cancelled) setAccount(deriveAccountStatus(row, meta)); })
      .catch(() => { if (!cancelled) setAccount(deriveAccountStatus(null, meta)); });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Rookie / Free: keep the user on the free tier and send them into the app.
  // This does NOT touch Stripe — it only sets the existing membership tier.
  const handleChooseRookie = async () => {
    setChoosingRookie(true);
    try {
      await saveMembership({ ...DEFAULT_MEMBERSHIP, membership_tier: 'rookie' });
    } catch {
      /* non-fatal — localStorage default already keeps them on rookie */
    }
    safeBack(navigate);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] text-[#6B7280]">
        Loading…
      </div>
    );
  }

  // Require authentication — never send unauthenticated users to Stripe.
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] px-4 text-center">
        <img
          src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
          alt="OnlyFast"
          className="h-12 mb-5"
        />
        <h1 className="text-2xl font-bold text-[#1A1B23] mb-2">Sign in to choose your plan</h1>
        <p className="text-[#6B7280] mb-5">You need an account to pick Rookie, Pro, or Team.</p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Sign in / Register
        </button>
        <button
          onClick={() => safeBack(navigate)}
          className="mt-3 text-sm text-[#6B7280] hover:text-[#00A8E8] transition-colors"
        >
          Back to app
        </button>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <img
            src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
            alt="OnlyFast"
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-[#1A1B23]">Choose how you want to use OnlyFast.</h1>
          <p className="text-[#6B7280] mt-2">
            Pro is the best fit for most individual racers, but Rookie stays free and Team is ready for multi-car programs.
          </p>
          {hideExternalPayments && (
            <div className="mx-auto mt-4 max-w-xl rounded-xl border border-[#D7EEF8] bg-white px-4 py-3 text-sm text-[#374151] shadow-sm">
              <p className="font-semibold text-[#1A1B23]">{nativeUpgradeMessage}</p>
              {account && (
                <p className="mt-1 text-xs text-[#6B7280]">
                  Current plan: {account.label === 'Teams' ? 'Team' : account.label}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-3 items-start">
          {/* ── ROOKIE (Free) ───────────────────────────────────────────── */}
          <div className="flex flex-col items-center rounded-2xl border-2 border-[#E5E7EB] p-6 bg-white shadow-sm">
            <h3 className="text-2xl font-bold text-[#1A1B23]">Rookie</h3>
            <p className="text-3xl font-extrabold text-[#1A1B23] mt-1 mb-1">Free</p>
            <p className="text-xs text-[#6B7280] text-center">
              Free, ad-supported, with limited saves. Good for trying OnlyFast.
            </p>
            <FeatureList
              items={[
                '1 type of racecar',
                '1 base setup',
                '2 race weekend saves',
                'Saves lock after 48 hours but are always viewable',
                '1 OnlyFast Setup Assist per weekend',
              ]}
            />
            <button
              onClick={handleChooseRookie}
              disabled={choosingRookie}
              className="w-full bg-[#1A1B23] hover:bg-black text-white px-5 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              {choosingRookie ? 'Starting…' : 'Start Free with Rookie'}
            </button>
            <p className="text-[11px] text-[#9CA3AF] mt-3 text-center">
              No payment required — jump straight into the app.
            </p>
          </div>

          {/* ── PRO ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center rounded-2xl border-2 border-[#00A8E8] p-6 bg-white shadow-xl shadow-[#00A8E8]/15 ring-1 ring-[#00A8E8]/30">
            <div className="inline-flex items-center gap-2 bg-[#1A1B23] text-white text-xs font-bold uppercase tracking-wide px-4 py-1.5 rounded-full shadow mb-2">
              Recommended
            </div>
            <FreeTrialBadge />
            <h3 className="text-2xl font-bold text-[#00A8E8]">Pro</h3>
            <p className="text-3xl font-extrabold text-[#1A1B23] mt-1 mb-1">
              $5<span className="text-base font-medium text-[#6B7280]">/mo</span>
            </p>
            <p className="text-xs text-[#6B7280] text-center mt-1">
              Best for most individual racers. Unlock the full individual racer workflow, more saves, exports, Ask OnlyFast, timing tools, and fewer limits.
            </p>
            <FeatureList
              items={[
                '1 type of racecar',
                'Unlimited base setups',
                'Unlimited race weekends',
                'No 48 hour lock',
                'Unlimited OnlyFast Setup Assists',
              ]}
            />
            {hideExternalPayments ? (
              <NativePaymentNotice planName="Pro" />
            ) : (
              <>
                <StripeBuyButton plan="pro" clientReferenceId={user.id} />
                <p className="text-xs text-[#9CA3AF] mt-3 text-center">
                  Have a promo code? Enter it on the Stripe checkout screen.
                </p>
              </>
            )}
          </div>

          {/* ── TEAM ────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center rounded-2xl border-2 border-[#E5E7EB] p-6 bg-white shadow-sm">
            <h3 className="text-2xl font-bold text-[#1A1B23]">Team</h3>
            <p className="text-3xl font-extrabold text-[#1A1B23] mt-1 mb-1">
              $8<span className="text-base font-medium text-[#6B7280]">/mo</span>
            </p>
            <p className="text-xs font-semibold text-[#00A8E8] text-center">Everything in Pro, plus:</p>
            <p className="text-xs text-[#6B7280] text-center mt-1">
              For teams, families, or racers managing multiple cars/classes.
            </p>
            <FeatureList
              items={[
                'Unlimited types of cars',
                'Have a RC car? Sports car? Motorcycle? All types of racing vehicles supported by OnlyFast — and more coming constantly — are available to use!',
              ]}
            />
            {hideExternalPayments ? (
              <NativePaymentNotice planName="Team" />
            ) : (
              <>
                <StripeBuyButton plan="teams" clientReferenceId={user.id} />
                <p className="text-xs text-[#9CA3AF] mt-3 text-center">
                  Have a promo code? Enter it on the Stripe checkout screen.
                </p>
              </>
            )}
          </div>
        </div>

        {/* OnlyFast Setup Assist explainer */}
        <div className="max-w-3xl mx-auto mt-8 bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-[#1A1B23] mb-1">What is OnlyFast Setup Assist?</h4>
          <p className="text-sm text-[#6B7280]">
            OnlyFast Setup Assist compares your REAL setup relative to track conditions and your
            feel of the car to give you accurate and specific setup advice.
          </p>
        </div>

        {pendingPlan && (
          <p className="text-center text-xs text-[#9CA3AF] mt-6">
            {pendingPlan === 'pro'
              ? 'Pro includes a 7 day free trial.'
              : 'Team unlocks unlimited cars and classes.'}
          </p>
        )}

        <div className="text-center mt-8">
          <button
            onClick={() => safeBack(navigate)}
            className="text-sm text-[#6B7280] hover:text-[#00A8E8] transition-colors"
          >
            ← Back to app
          </button>
        </div>
      </div>
    </div>
  );
};

export default Upgrade;
