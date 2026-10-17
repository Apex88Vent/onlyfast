import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeBack } from '@/lib/safeBack';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { clearPendingPlan, selectRookie } from '@/lib/membership';
import { hideExternalPayments } from '@/lib/paymentVisibility';
import PlanSelection from '@/components/PlanSelection';
import AuthModal from '@/components/AuthModal';
import NativeSubscriptionControls from '@/components/NativeSubscriptionControls';

const Upgrade: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  useEffect(() => {
    let active = true;
    let revision = 0;
    clearPendingPlan();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      revision++;
      setUser(session?.user ?? null); setLoadingAuth(false);
      if (session?.user) setAuthModalOpen(false);
    });
    const initial = revision;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && initial === revision) { setUser(data.session?.user ?? null); setLoadingAuth(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Preference only: never overwrite billing, promo or admin authorization.
  const continueFree = async () => {
    if (!user) return;
    if (await selectRookie(user.id)) navigate('/', { replace: true });
  };

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">Loading…</div>;
  if (!user) return <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] px-4 text-center">
    <img src="/onlyfast-logo.png" alt="OnlyFast" className="h-12 mb-5" />
    <h1 className="text-2xl font-bold text-[#1A1B23]">Sign in to choose your plan</h1>
    <p className="text-[#6B7280] my-4">Choose Rookie for free, Pro, or Teams.</p>
    <button onClick={() => setAuthModalOpen(true)} className="bg-[#00A8E8] text-white px-6 py-3 rounded-xl font-semibold">Sign in / Register</button>
    <button onClick={() => safeBack(navigate)} className="mt-4 text-[#6B7280]">Back to app</button>
    <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
  </div>;

  return <main className="min-h-screen bg-[#F5F5F7] py-10 px-4">
    <div className="max-w-6xl mx-auto">
      <img src="/onlyfast-logo.png" alt="OnlyFast" className="h-16 mx-auto mb-8" />
      <PlanSelection key={user.id} userId={user.id} allowWebCheckout onComplete={continueFree} onPaidComplete={() => navigate('/', { replace: true })} onBack={() => safeBack(navigate)} />
      {hideExternalPayments && <div className="max-w-xl mx-auto mt-6 rounded-xl bg-white border p-4">
        <NativeSubscriptionControls key={user.id} userId={user.id} hidePurchase />
      </div>}
    </div>
  </main>;
};
export default Upgrade;
