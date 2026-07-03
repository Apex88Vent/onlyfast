import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { fetchUserSubscription, isActivePaidRow } from '@/lib/subscription';

const LOGO = '/onlyfast-logo.png';

const MAX_RETRIES = 6; // ~ a few seconds total, webhook may still be processing
const RETRY_DELAY_MS = 2000;

type Phase = 'auth' | 'checking' | 'success' | 'pending';

const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('auth');
  const [planLabel, setPlanLabel] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Require login.
      const { data } = await supabase.auth.getSession();
      const user: User | null = data?.session?.user ?? null;
      if (!user) {
        navigate('/upgrade', { replace: true });
        return;
      }

      if (cancelled) return;
      setPhase('checking');

      // Retry the query a few times — the Stripe webhook may still be
      // upserting into user_subscriptions. We only trust that table.
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const row = await fetchUserSubscription(user.id);
        if (cancelled) return;

        if (isActivePaidRow(row)) {
          setPlanLabel((row!.plan || '').toLowerCase() === 'teams' ? 'Team' : 'Pro');
          setPhase('success');

          // Tell the rest of the app to refresh its subscription state.
          try {
            window.dispatchEvent(new CustomEvent('subscription-updated'));
          } catch {/* non-fatal */}

          // Route to the dashboard/account after a brief confirmation.
          setTimeout(() => {
            if (!cancelled) navigate('/', { replace: true });
          }, 2200);
          return;
        }

        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      // No active subscription found yet — webhook likely still processing.
      if (!cancelled) setPhase('pending');
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] px-4 text-center">
      <img src={LOGO} alt="OnlyFast" className="h-[72px] mb-6" />


      {(phase === 'auth' || phase === 'checking') && (
        <>
          <div
            className="h-10 w-10 rounded-full border-4 border-[#00A8E8]/30 border-t-[#00A8E8] animate-spin mb-4"
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold text-[#1A1B23]">Checking your subscription…</h1>
          <p className="text-[#6B7280] mt-2 max-w-sm">
            Confirming your payment with our system. This only takes a moment.
          </p>
        </>
      )}

      {phase === 'success' && (
        <>
          <div className="h-14 w-14 rounded-full bg-[#00A8E8] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1B23]">You're all set!</h1>
          <p className="text-[#6B7280] mt-2">
            Your {planLabel} membership is active. Taking you to the app…
          </p>
        </>
      )}

      {phase === 'pending' && (
        <>
          <h1 className="text-xl font-bold text-[#1A1B23]">Almost there</h1>
          <p className="text-[#6B7280] mt-2 max-w-sm">
            Your payment was received, but your subscription is still finalizing.
            It usually activates within a minute. You can continue to the app and
            it will update automatically.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="mt-5 bg-[#00A8E8] hover:bg-[#0090c7] text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Go to app
          </button>
        </>
      )}
    </div>
  );
};

export default SubscriptionSuccess;
