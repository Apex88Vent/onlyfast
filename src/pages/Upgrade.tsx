import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { getPendingPlan, clearPendingPlan, type CheckoutPlan } from '@/lib/membership';
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

const PlanCard: React.FC<{
  title: string;
  price: string;
  highlight?: boolean;
  trial?: boolean;
  userId?: string | null;
  plan: 'pro' | 'teams';
}> = ({ title, price, highlight, trial, userId, plan }) => (
  <div
    className={`flex flex-col items-center rounded-2xl border-2 p-6 bg-white ${
      highlight ? 'border-[#00A8E8] shadow-xl shadow-[#00A8E8]/15 ring-1 ring-[#00A8E8]/30' : 'border-[#E5E7EB] shadow-sm'
    }`}
  >
    {trial && <FreeTrialBadge />}
    <h3 className={`text-2xl font-bold ${highlight ? 'text-[#00A8E8]' : 'text-[#1A1B23]'}`}>{title}</h3>
    <p className="text-3xl font-extrabold text-[#1A1B23] mt-1 mb-5">
      {price}
      <span className="text-base font-medium text-[#6B7280]">/mo</span>
    </p>
    <StripeBuyButton plan={plan} clientReferenceId={userId} />
    <p className="text-xs text-[#9CA3AF] mt-3 text-center">
      Have a promo code? Enter it on the Stripe checkout screen.
    </p>
  </div>
);

const Upgrade: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<CheckoutPlan | null>(null);

  // Resolve the requested plan from route state first, then localStorage.
  useEffect(() => {
    const fromState = (location.state as { plan?: CheckoutPlan } | null)?.plan;
    const plan = fromState || getPendingPlan();
    setPendingPlan(plan && plan !== 'free' ? plan : null);
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
        <h1 className="text-2xl font-bold text-[#1A1B23] mb-2">Sign in to continue checkout</h1>
        <p className="text-[#6B7280] mb-5">You need an account to upgrade your membership.</p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Sign in / Register
        </button>
        <button
          onClick={() => navigate('/')}
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
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <img
            src="https://d64gsuwffb70l.cloudfront.net/688263e7085fd34dcdf7f46a_1775752881652_48fe46d9.png"
            alt="OnlyFast"
            className="h-12 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-[#1A1B23]">Upgrade your membership</h1>
          <p className="text-[#6B7280] mt-2">
            {pendingPlan === 'pro'
              ? 'Start your Pro membership with a 7 day free trial.'
              : pendingPlan === 'teams'
              ? 'Unlock Team access for unlimited cars and classes.'
              : 'Choose the plan that fits your racing.'}
          </p>
        </div>

        <div
          className={`grid gap-6 ${
            pendingPlan ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'
          }`}
        >
          {(!pendingPlan || pendingPlan === 'pro') && (
            <PlanCard title="Pro" price="$5" highlight trial userId={user.id} plan="pro" />
          )}
          {(!pendingPlan || pendingPlan === 'teams') && (
            <PlanCard title="Team" price="$8" userId={user.id} plan="teams" />
          )}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/')}
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
