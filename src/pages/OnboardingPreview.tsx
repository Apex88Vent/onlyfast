import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import HowOnlyFastWorks from '@/components/HowOnlyFastWorks';

const OnboardingPreview = () => {
  const [complete, setComplete] = useState(false);
  const [loginClicked, setLoginClicked] = useState(false);

  return (
    <div className="min-h-screen bg-slate-200 px-0 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[390px] overflow-hidden bg-[#F5F5F7] shadow-2xl sm:rounded-[2rem] sm:ring-8 sm:ring-slate-900">
        {complete ? (
          <main className="min-h-screen flex items-center justify-center p-6 text-center">
            <div className="w-full rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-xl shadow-slate-900/5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="h-8 w-8" aria-hidden="true" />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold text-[#1A1B23]">
                {loginClicked ? 'Login link clicked' : 'Onboarding complete'}
              </h1>
              <p className="mt-2 text-[#6B7280]">
                {loginClicked
                  ? 'In the app, this opens the existing standard login screen without completing onboarding.'
                  : 'First-time users would be sent to membership selection, then continue into the normal discipline/class/setup flow.'}
              </p>
              <button
                type="button"
                onClick={() => { setComplete(false); setLoginClicked(false); }}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00A8E8] px-5 py-3.5 font-bold text-white hover:bg-[#0096D1] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Preview again
              </button>
            </div>
          </main>
        ) : (
          <HowOnlyFastWorks
            onComplete={() => setComplete(true)}
            onSkip={() => setComplete(true)}
            onLogin={() => { setLoginClicked(true); setComplete(true); }}
          />
        )}
      </div>
    </div>
  );
};

export default OnboardingPreview;
