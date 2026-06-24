import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { AnnouncerProvider } from './AccessibleAnnouncer';
import SkipLink from './SkipLink';
import SplashScreen from './SplashScreen';
import OnboardingFlow from './OnboardingFlow';
import HowOnlyFastWorks from './HowOnlyFastWorks';
import Header from './Header';
import SetupDashboard from './SetupDashboard';
import AuthModal from './AuthModal';
import CookieConsent from './CookieConsent';
import Footer from './Footer';
import LegalModal from './LegalModal';
// --- DEV/DEMO test-account reset (remove/disable before production) ---
import { isTestAccount, ENABLE_TEST_ACCOUNT_RESET, resetTestAccountData } from '@/lib/testAccount';

const AppLayout: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedCar, setSelectedCar] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingStartStep, setOnboardingStartStep] = useState<1 | 2>(1);
  const [showHowOnlyFastWorks, setShowHowOnlyFastWorks] = useState(false);
  const [hasCheckedHowOnlyFastWorks, setHasCheckedHowOnlyFastWorks] = useState(false);
  const [isReplayingHowOnlyFastWorks, setIsReplayingHowOnlyFastWorks] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  const howOnlyFastWorksStorageKey = (userId?: string | null) =>
    userId ? `onlyfast_onboarding_completed_${userId}` : 'onlyfast_onboarding_completed_guest';

  const closeHowOnlyFastWorksReplay = useCallback(() => {
    setShowHowOnlyFastWorks(false);
    setIsReplayingHowOnlyFastWorks(false);
    setHasCheckedHowOnlyFastWorks(true);
  }, []);

  const markHowOnlyFastWorksComplete = useCallback(async () => {
    try {
      localStorage.setItem(howOnlyFastWorksStorageKey(user?.id), 'true');
    } catch {/* ignore */}

    if (user) {
      try {
        await supabase.auth.updateUser({
          data: {
            ...(user.user_metadata || {}),
            onboarding_completed: true,
          },
        });
      } catch {
        // Non-fatal: local storage still prevents repeat prompts on this device.
      }
    }

    setShowHowOnlyFastWorks(false);
    setIsReplayingHowOnlyFastWorks(false);
    setHasCheckedHowOnlyFastWorks(true);
    window.location.href = '/pricing';
  }, [user]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);


  // Check for persisted car selection
  useEffect(() => {
    const saved = localStorage.getItem('onlyfast_car');
    if (saved) {
      setSelectedCar(saved);
      setIsOnboarded(true);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setHasCheckedHowOnlyFastWorks(false);

      // After an unregistered user registers (triggered from a first-save), send
      // them to the Rookie / Pro / Team selection page, then back to saving.
      if (event === 'SIGNED_IN') {
        try {
          if (localStorage.getItem('pending_plan_redirect')) {
            localStorage.removeItem('pending_plan_redirect');
            window.location.href = '/pricing';
            return;
          }
        } catch {/* ignore */}
      }

      // --- DEV/DEMO reset-on-login fallback -----------------------------
      // Logout normally resets the test account, but logout can't run if the
      // browser was closed or the session expired. As a safety net, when the
      // dedicated test account SIGNS IN, reset its data so it always starts
      // brand-new. Guarded by a per-session marker so it runs once per login
      // (not on every token refresh). Remove/disable before production via
      // ENABLE_TEST_ACCOUNT_RESET (see src/lib/testAccount.ts).
      if (
        ENABLE_TEST_ACCOUNT_RESET &&
        event === 'SIGNED_IN' &&
        isTestAccount(session?.user?.email)
      ) {
        const marker = `test_reset_done_${session?.user?.id ?? 'x'}`;
        if (!sessionStorage.getItem(marker)) {
          sessionStorage.setItem(marker, '1');
          // Fire-and-forget; failures are logged inside the helper.
          resetTestAccountData();
        }
      }
      // ------------------------------------------------------------------
    });

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setHasCheckedHowOnlyFastWorks(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (showSplash || isReplayingHowOnlyFastWorks) return;

    const completedInMetadata = Boolean(user?.user_metadata?.onboarding_completed);
    let completedLocally = false;
    try {
      completedLocally = localStorage.getItem(howOnlyFastWorksStorageKey(user?.id)) === 'true';
    } catch {/* ignore */}

    const completed = completedInMetadata || completedLocally;
    setShowHowOnlyFastWorks(!completed);
    setHasCheckedHowOnlyFastWorks(true);
  }, [user, showSplash, isReplayingHowOnlyFastWorks]);

  const handleCarSelect = (car: string) => {
    setSelectedCar(car);
    setIsOnboarded(true);
    localStorage.setItem('onlyfast_car', car);
  };

  const handleBackToCarSelect = () => {
    setOnboardingStartStep(2);
    setIsOnboarded(false);
    setSelectedCar('');
    localStorage.removeItem('onlyfast_car');
  };

  const handleOpenHowOnlyFastWorks = () => {
    setIsReplayingHowOnlyFastWorks(true);
    setShowHowOnlyFastWorks(true);
  };

  // Show splash screen on first load
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!hasCheckedHowOnlyFastWorks || showHowOnlyFastWorks) {
    return (
      <AnnouncerProvider>
        <SkipLink />
        {showHowOnlyFastWorks && (
          <HowOnlyFastWorks
            onComplete={isReplayingHowOnlyFastWorks ? closeHowOnlyFastWorksReplay : markHowOnlyFastWorksComplete}
            onSkip={isReplayingHowOnlyFastWorks ? closeHowOnlyFastWorksReplay : markHowOnlyFastWorksComplete}
            onLogin={() => setAuthModalOpen(true)}
            isReplay={isReplayingHowOnlyFastWorks}
          />
        )}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
        <CookieConsent />
      </AnnouncerProvider>
    );
  }

  // Show onboarding if not completed
  if (!isOnboarded) {
    return (
      <AnnouncerProvider>
        <SkipLink />
        <OnboardingFlow onComplete={handleCarSelect} initialStep={onboardingStartStep} />
        <CookieConsent />
      </AnnouncerProvider>
    );
  }


  return (
    <AnnouncerProvider>
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
        <SkipLink />
        <Header
          user={user}
          onSignInClick={() => setAuthModalOpen(true)}
          selectedCar={selectedCar}
          onBackToCarSelect={handleBackToCarSelect}
          onOpenHowOnlyFastWorks={handleOpenHowOnlyFastWorks}
        />
        <main id="main-content" tabIndex={-1} className="flex-1">
          <h1 className="sr-only">OnlyFast Setup Assist - Dirt Track Racing Setup Tracker</h1>
          <SetupDashboard
            user={user}
            selectedCar={selectedCar}
            onSignInClick={() => setAuthModalOpen(true)}
          />
        </main>
        <Footer
          onPrivacyClick={() => setLegalModal('privacy')}
          onTermsClick={() => setLegalModal('terms')}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
        <LegalModal
          isOpen={legalModal !== null}
          onClose={() => setLegalModal(null)}
          type={legalModal || 'privacy'}
        />
        <CookieConsent />
      </div>
    </AnnouncerProvider>
  );
};

export default AppLayout;
