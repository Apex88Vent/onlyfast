import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import ClassChangeModal from './ClassChangeModal';
import { useNavigate } from 'react-router-dom';
import { getEffectiveTier, readMembership } from '@/lib/membership';
import { getActiveClassState, initializeActiveClass } from '@/lib/activeClass';
import { resetTestAccountData } from '@/lib/testAccount';
import { useBetaFeatures } from '@/hooks/useBetaFeatures';
import { BETA_FEATURES } from '@/lib/betaFeatures';
import { isOnlyFastFilePickerOpen } from '@/lib/filePickerState';
import { resolveAuthUiTransition } from '@/lib/authUiTransition';

const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const { hasBetaFeature, testerKind } = useBetaFeatures();
  const [user, setUser] = useState<User | null>(null);
  const [selectedCar, setSelectedCar] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [classChangeOpen, setClassChangeOpen] = useState(false);
  const [unlimitedClasses, setUnlimitedClasses] = useState<boolean | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [showHowOnlyFastWorks, setShowHowOnlyFastWorks] = useState(false);
  const [hasCheckedHowOnlyFastWorks, setHasCheckedHowOnlyFastWorks] = useState(false);
  const [isReplayingHowOnlyFastWorks, setIsReplayingHowOnlyFastWorks] = useState(false);
  const [skipHowOnlyFastWorksAfterLogin, setSkipHowOnlyFastWorksAfterLogin] = useState(false);
  const [isLoadingSavedCar, setIsLoadingSavedCar] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [showSplash, setShowSplash] = useState(() => !isOnlyFastFilePickerOpen());
  const [authChecked, setAuthChecked] = useState(false);
  const onboardingLoginEscapeRef = useRef(false);
  const authUserIdRef = useRef<string | null>(null);

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
  }, [user]);

  const hasSelectedMembership = useCallback((signedInUser: User | null | undefined): boolean => {
    const metadata = (signedInUser?.user_metadata || {}) as Record<string, unknown>;
    if (
      metadata.membership_tier ||
      metadata.has_admin_full_access ||
      metadata.promo_access_level
    ) {
      return true;
    }

    try {
      const raw = localStorage.getItem('onlyfast_membership');
      if (!raw) return false;
      const saved = JSON.parse(raw) as { membership_tier?: unknown };
      return Boolean(saved?.membership_tier);
    } catch {
      return false;
    }
  }, []);

  const handleHowOnlyFastWorksLogin = useCallback(() => {
    onboardingLoginEscapeRef.current = true;
    setAuthModalOpen(true);
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if (!showSplash || !isOnlyFastFilePickerOpen()) return;
    devLog('route reset blocked', { source: 'splash' });
    setShowSplash(false);
  }, [showSplash]);


  // Check for persisted car selection
  useEffect(() => {
    try {
      const saved = localStorage.getItem('onlyfast_car');
      if (saved) {
        setSelectedCar(saved);
        setIsOnboarded(true);
      }
    } catch {/* Storage can be unavailable in restricted WebViews. */}
  }, []);

  const applySelectedCar = useCallback((car: string) => {
    setSelectedCar(car);
    setIsOnboarded(true);
    try { localStorage.setItem('onlyfast_car', car); } catch {/* ignore */}
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!user) {
      setIsLoadingSavedCar(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSavedCar(true);
    (async () => {
      try {
        let state = await getActiveClassState();
        if (!cancelled) setUnlimitedClasses(state.unlimited);
        if (!state.active_class && selectedCar) {
          state = await initializeActiveClass(selectedCar);
          if (!cancelled) setUnlimitedClasses(state.unlimited);
        }
        if (!cancelled && state.active_class) {
          applySelectedCar(state.active_class);
        }
      } catch {
        // Compatibility fallback until the migration is deployed.
        try {
          const { data } = await supabase
            .from('race_setups')
            .select('race_class')
            .eq('user_id', user.id)
            .not('race_class', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);
          const savedCar = (data?.[0]?.race_class || '').trim();
          if (!cancelled && savedCar) applySelectedCar(savedCar);
        } catch {/* Existing users without a saved class continue to onboarding. */}
      } finally {
        if (!cancelled) setIsLoadingSavedCar(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authChecked, user, selectedCar, applySelectedCar]);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const isOnboardingLoginEscape = event === 'SIGNED_IN' && onboardingLoginEscapeRef.current;
      const authTransition = resolveAuthUiTransition({
        previousUserId: authUserIdRef.current,
        nextUserId: session?.user?.id ?? null,
        event,
        onboardingLoginEscape: isOnboardingLoginEscape,
      });

      authUserIdRef.current = authTransition.nextUserId;

      setUser(session?.user ?? null);
      setAuthChecked(true);
      if (authTransition.shouldMarkOnboardingChecked) {
        setHasCheckedHowOnlyFastWorks(true);
      } else if (authTransition.shouldRecheckOnboarding) {
        setHasCheckedHowOnlyFastWorks(false);
      }

      if (!session?.user) {
        setSkipHowOnlyFastWorksAfterLogin(false);
        setUnlimitedClasses(null);
      }

      if (event === 'SIGNED_IN') {
        if (isOnboardingLoginEscape) {
          onboardingLoginEscapeRef.current = false;
          setSkipHowOnlyFastWorksAfterLogin(true);
          setShowHowOnlyFastWorks(false);
          setIsReplayingHowOnlyFastWorks(false);
          setHasCheckedHowOnlyFastWorks(true);
          setAuthModalOpen(false);
        }

        try {
          if (localStorage.getItem('pending_plan_redirect')) {
            localStorage.removeItem('pending_plan_redirect');
          }
        } catch {/* ignore */}
      }

    });

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      authUserIdRef.current = session?.user?.id ?? null;
      setUser(session?.user ?? null);
      setAuthChecked(true);
      setHasCheckedHowOnlyFastWorks(false);
    }).catch(() => {
      authUserIdRef.current = null;
      setAuthChecked(true);
      setHasCheckedHowOnlyFastWorks(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Reset-on-login fallback for the disposable experimental account. Waiting
  // for the account-specific flag lookup avoids any email-based authorization
  // and keeps a failed lookup on the production path.
  useEffect(() => {
    const canReset =
      testerKind === 'experimental' &&
      hasBetaFeature(BETA_FEATURES.testAccountReset);
    if (!user || !canReset) return;

    const marker = `test_reset_done_${user.id}`;
    let shouldReset = true;
    try {
      shouldReset = !sessionStorage.getItem(marker);
      if (shouldReset) sessionStorage.setItem(marker, '1');
    } catch {
      shouldReset = true;
    }
    if (shouldReset) void resetTestAccountData();
  }, [hasBetaFeature, testerKind, user]);

  useEffect(() => {
    if (showSplash || isReplayingHowOnlyFastWorks) return;
    if (!authChecked) return;

    if (isOnlyFastFilePickerOpen()) {
      devLog('route reset blocked', { source: 'howOnlyFastWorksGate' });
      setShowHowOnlyFastWorks(false);
      setHasCheckedHowOnlyFastWorks(true);
      return;
    }

    if (skipHowOnlyFastWorksAfterLogin || selectedCar || hasSelectedMembership(user)) {
      setShowHowOnlyFastWorks(false);
      setHasCheckedHowOnlyFastWorks(true);
      return;
    }

    const completedInMetadata = Boolean(user?.user_metadata?.onboarding_completed);
    let completedLocally = false;
    try {
      completedLocally = localStorage.getItem(howOnlyFastWorksStorageKey(user?.id)) === 'true';
    } catch {/* ignore */}

    const completed = completedInMetadata || completedLocally;
    setShowHowOnlyFastWorks(!completed);
    setHasCheckedHowOnlyFastWorks(true);
  }, [authChecked, user, selectedCar, showSplash, isReplayingHowOnlyFastWorks, skipHowOnlyFastWorksAfterLogin, hasSelectedMembership]);

  const handleCarSelect = async (car: string) => {
    if (!user) {
      applySelectedCar(car);
      return;
    }
    try {
      const state = await initializeActiveClass(car);
      setUnlimitedClasses(state.unlimited);
      applySelectedCar(state.active_class || car);
    } catch {
      applySelectedCar(car);
    }
  };

  const openClassChange = () => setClassChangeOpen(true);
  const effectiveTier = getEffectiveTier(readMembership(user?.user_metadata || {}));
  const openTeamsUpgrade = () => {
    setClassChangeOpen(false);
    navigate('/upgrade', { state: { plan: 'teams' } });
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
            onLogin={handleHowOnlyFastWorksLogin}
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

  if (!authChecked || isLoadingSavedCar) {
    return (
      <AnnouncerProvider>
        <SkipLink />
        <div className="min-h-screen bg-[#F5F5F7]" />
        <CookieConsent />
      </AnnouncerProvider>
    );
  }

  // Show discipline/class selection when no working class has been chosen yet.
  if (!isOnboarded) {
    return (
      <AnnouncerProvider>
        <SkipLink />
        <OnboardingFlow onComplete={handleCarSelect} />
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
          onBackToCarSelect={openClassChange}
          onOpenHowOnlyFastWorks={handleOpenHowOnlyFastWorks}
        />
        <main id="main-content" tabIndex={-1} className="flex-1">
          <h1 className="sr-only">OnlyFast Setup Assist - Dirt Track Racing Setup Tracker</h1>
          <SetupDashboard
            user={user}
            selectedCar={selectedCar}
            onSignInClick={() => setAuthModalOpen(true)}
            onChangeClass={openClassChange}
            classLocksEnabled={!(unlimitedClasses ?? (effectiveTier === 'team'))}
            onUpgrade={openTeamsUpgrade}
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
        <ClassChangeModal
          isOpen={classChangeOpen}
          user={user}
          tier={effectiveTier}
          currentClass={selectedCar}
          onClose={() => setClassChangeOpen(false)}
          onChanged={applySelectedCar}
          onUpgrade={openTeamsUpgrade}
        />
        <CookieConsent />
      </div>
    </AnnouncerProvider>
  );
};

export default AppLayout;
