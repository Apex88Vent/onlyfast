import { useMembershipRevision } from '@/hooks/useMembershipRevision';
import { CustomCarGate } from './CustomCarSheet';
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
import { getActiveClassState, saveOnboardingProgress, completeRacingOnboarding, type ActiveClassState } from '@/lib/activeClass';
import { resetTestAccountData } from '@/lib/testAccount';
import { useBetaFeatures } from '@/hooks/useBetaFeatures';
import { BETA_FEATURES } from '@/lib/betaFeatures';
import { isOnlyFastFilePickerOpen } from '@/lib/filePickerState';
import { resolveAuthUiTransition } from '@/lib/authUiTransition';
import { canAccessSetupClass } from '@/lib/setupLibraryAccess';

const AppLayout: React.FC = () => {
  useMembershipRevision();
  const navigate = useNavigate();
  const betaAccess = useBetaFeatures();
  const { hasBetaFeature, testerKind } = betaAccess;
  const [user, setUser] = useState<User | null>(null);
  const [selectedCar, setSelectedCar] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [classChangeOpen, setClassChangeOpen] = useState(false);
  const [unlimitedClasses, setUnlimitedClasses] = useState<boolean | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [showHowOnlyFastWorks, setShowHowOnlyFastWorks] = useState(false);
  const [hasCheckedHowOnlyFastWorks, setHasCheckedHowOnlyFastWorks] = useState(false);
  const [isReplayingHowOnlyFastWorks, setIsReplayingHowOnlyFastWorks] = useState(false);
  const [isLoadingSavedCar, setIsLoadingSavedCar] = useState(false);
  const [classSelectionUserId, setClassSelectionUserId] = useState<string | null | undefined>(undefined);
  const [classSelectionError, setClassSelectionError] = useState('');
  const [onboardingState, setOnboardingState] = useState<ActiveClassState | null>(null);
  const [landingRequest, setLandingRequest] = useState(0);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [showSplash, setShowSplash] = useState(() => !isOnlyFastFilePickerOpen());
  const [authChecked, setAuthChecked] = useState(false);
  const authenticatedUserId = user?.id ?? null;
  const onboardingLoginEscapeRef = useRef(false);
  const authUserIdRef = useRef<string | null>(null);
  const tutorialPending = useRef(false);
  const [savingTutorial, setSavingTutorial] = useState(false);

  const howOnlyFastWorksStorageKey = (userId?: string | null) =>
    userId ? `onlyfast_onboarding_completed_${userId}` : 'onlyfast_onboarding_completed_guest';

  const closeHowOnlyFastWorksReplay = useCallback(() => {
    setShowHowOnlyFastWorks(false);
    setIsReplayingHowOnlyFastWorks(false);
    setHasCheckedHowOnlyFastWorks(true);
  }, []);

  const markHowOnlyFastWorksComplete = useCallback(async () => {
    if (!user || tutorialPending.current) return;
    tutorialPending.current = true;
    setSavingTutorial(true);
    setClassSelectionError('');
    try {
      const state = await saveOnboardingProgress('discipline', undefined, undefined, user.id);
      if (authUserIdRef.current !== user.id) return;
      setOnboardingState(state);
    } catch {
      setClassSelectionError('Your tutorial progress could not be saved. Please try again.');
      return;
    } finally { tutorialPending.current = false; setSavingTutorial(false); }
    setShowHowOnlyFastWorks(false);
    setIsReplayingHowOnlyFastWorks(false);
    setHasCheckedHowOnlyFastWorks(true);
    // Finishing first-run guidance always leads to discipline selection.
    // Replaying help uses closeHowOnlyFastWorksReplay instead.
    setIsOnboarded(false);
  }, [user]);

  const handleHowOnlyFastWorksLogin = useCallback(() => {
    onboardingLoginEscapeRef.current = true;
    setAuthModalOpen(true);
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    if (!showSplash || !isOnlyFastFilePickerOpen()) return;
    setShowSplash(false);
  }, [showSplash]);


  const applySelectedCar = useCallback((car: string) => {
    setSelectedCar(car);
    setIsOnboarded(true);
    try {
      localStorage.setItem(authenticatedUserId ? `onlyfast_car_${authenticatedUserId}` : 'onlyfast_car', car);
    } catch {/* ignore */}
  }, [authenticatedUserId]);

  const completeClassSelection = useCallback((car: string) => {
    applySelectedCar(car);
    setLandingRequest(request => request + 1);
  }, [applySelectedCar]);

  // Membership can change while the app is open. Re-read the server's class
  // allowance without resetting the chosen vehicle, editor or onboarding.
  useEffect(() => {
    if (!authenticatedUserId) return;
    let active = true;
    let revision = 0;
    const refreshAllowance = async () => {
      const request = ++revision;
      try {
        const { data } = await supabase.auth.getSession();
        if (!active || request !== revision || data.session?.user.id !== authenticatedUserId) return;
        const state = await getActiveClassState();
        if (active && request === revision && authUserIdRef.current === authenticatedUserId) setUnlimitedClasses(state.unlimited);
      } catch { /* Existing server-side class authorization remains authoritative. */ }
    };
    window.addEventListener('membership-updated', refreshAllowance);
    return () => { active = false; window.removeEventListener('membership-updated', refreshAllowance); };
  }, [authenticatedUserId]);

  useEffect(() => {
    if (!authChecked) return;
    setSelectedCar('');
    setIsOnboarded(false);
    setClassSelectionError('');
    setOnboardingState(null);
    setLandingRequest(0);
    setUnlimitedClasses(null);
    if (!authenticatedUserId) {
      setClassSelectionUserId(null);
      setIsLoadingSavedCar(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSavedCar(true);
    (async () => {
      let classLookupFailed = false;
      try {
        try {
          const state = await getActiveClassState();
          if (!cancelled) {
            setUnlimitedClasses(state.unlimited);
            setOnboardingState(state);
          }
          // A persisted draft must finish plan selection before opening the app.
          if (state.onboarding_step && state.onboarding_step !== 'complete') return;
          if (!cancelled && state.active_class) {
            applySelectedCar(state.active_class);
            return;
          }
        } catch {
          classLookupFailed = true;
          // Compatibility fallback until the active-class migration is deployed.
        }
        try {
          // Recover an existing user's class from their own saved setups only.
          // A device-wide guest/previous-account selection cannot initialize it.
          const { data, error } = await supabase
            .from('race_setups')
            .select('race_class')
            .eq('user_id', authenticatedUserId)
            .not('race_class', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);
          if (error) throw error;
          const savedCar = (data?.[0]?.race_class || '').trim();
          if (!cancelled && savedCar) applySelectedCar(savedCar);
        } catch {
          // Network fallback can use only this user's own previous selection.
          // A successful server lookup with no active class remains authoritative.
          if (classLookupFailed) {
            try {
              const savedCar = localStorage.getItem(`onlyfast_car_${authenticatedUserId}`);
              if (!cancelled && savedCar) applySelectedCar(savedCar);
            } catch {/* Unconfigured users continue to discipline selection. */}
          }
        }
      } finally {
        if (!cancelled) {
          setClassSelectionUserId(authenticatedUserId);
          setIsLoadingSavedCar(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authChecked, authenticatedUserId, applySelectedCar]);

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
      if (authTransition.identityChanged) {
        setSelectedCar('');
        setIsOnboarded(false);
        setClassSelectionUserId(undefined);
        setIsLoadingSavedCar(Boolean(session?.user));
      }
      if (authTransition.shouldMarkOnboardingChecked) {
        setHasCheckedHowOnlyFastWorks(true);
      } else if (authTransition.shouldRecheckOnboarding) {
        setHasCheckedHowOnlyFastWorks(false);
      }

      if (!session?.user) {
        setUnlimitedClasses(null);
      }

      if (event === 'SIGNED_IN') {
        if (isOnboardingLoginEscape) {
          onboardingLoginEscapeRef.current = false;
          setShowHowOnlyFastWorks(false);
          setIsReplayingHowOnlyFastWorks(false);
          setHasCheckedHowOnlyFastWorks(false);
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
    if (classSelectionUserId !== authenticatedUserId || isLoadingSavedCar) return;

    if (isOnlyFastFilePickerOpen()) {
      setShowHowOnlyFastWorks(false);
      setHasCheckedHowOnlyFastWorks(true);
      return;
    }

    if (selectedCar) {
      setShowHowOnlyFastWorks(false);
      setHasCheckedHowOnlyFastWorks(true);
      return;
    }

    if (onboardingState?.onboarding_step && onboardingState.onboarding_step !== 'tutorial') {
      setShowHowOnlyFastWorks(false);
      setHasCheckedHowOnlyFastWorks(true);
      return;
    }

    const completedInMetadata = Boolean(user?.user_metadata?.onboarding_completed);
    let completedLocally = false;
    try {
      completedLocally = localStorage.getItem(howOnlyFastWorksStorageKey(user?.id)) === 'true';
    } catch {/* ignore */}

    const completed = onboardingState?.onboarding_step === 'tutorial' ? false : completedInMetadata || completedLocally;
    setShowHowOnlyFastWorks(!completed);
    setHasCheckedHowOnlyFastWorks(true);
  }, [authChecked, user, selectedCar, showSplash, isReplayingHowOnlyFastWorks, classSelectionUserId, authenticatedUserId, isLoadingSavedCar, onboardingState]);

  const handleCarSelect = async (car: string) => {
    setClassSelectionError('');
    if (!canAccessSetupClass(car, betaAccess)) return;
    if (!user) return;
    try {
      const state = await completeRacingOnboarding(user.id);
      if (authUserIdRef.current !== user.id) return;
      setOnboardingState(state);
      setUnlimitedClasses(state.unlimited);
      completeClassSelection(state.active_class || car);
    } catch {
      setClassSelectionError('Onboarding could not be completed. Please try again.');
    }
  };

  const handleOnboardingProgress = async (step: 'discipline' | 'vehicle' | 'plan', discipline?: string, car?: string) => {
    if (!user) throw new Error('Sign in to save your selection');
    const state = await saveOnboardingProgress(step, discipline, car, user.id);
    if (authUserIdRef.current !== user.id) throw new Error('Account changed');
    setOnboardingState(state);
    setClassSelectionError('');
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

  if (!authChecked || isLoadingSavedCar || classSelectionUserId !== authenticatedUserId) {
    return <div className="min-h-screen bg-[#F5F5F7]" role="status" aria-label="Loading your racing profile" />;
  }

  if (!user) {
    return (
      <AnnouncerProvider>
        <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
          <main className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xl">
            <img src="/onlyfast-logo.png" alt="OnlyFast" className="h-28 w-auto mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-[#1A1B23]">Welcome to OnlyFast</h1>
            <p className="mt-3 text-[#6B7280]">Create an account or sign in to choose your discipline, vehicle and plan.</p>
            <button onClick={() => setAuthModalOpen(true)} className="mt-6 w-full rounded-xl bg-[#00A8E8] px-5 py-3 font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#00A8E8] focus:ring-offset-2">Create Account / Sign In</button>
          </main>
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
          <CookieConsent />
        </div>
      </AnnouncerProvider>
    );
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
            pending={savingTutorial}
          />
        )}
        {classSelectionError && <p className="p-4 text-center text-sm text-red-600" role="alert">{classSelectionError}</p>}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
        <CookieConsent />
      </AnnouncerProvider>
    );
  }

  if (betaAccess.loading && (!isOnboarded || !canAccessSetupClass(selectedCar, betaAccess))) {
    return (
      <AnnouncerProvider>
        <SkipLink />
        <div className="min-h-screen bg-[#F5F5F7]" />
        <CookieConsent />
      </AnnouncerProvider>
    );
  }

  // Show discipline/class selection when no working class has been chosen yet.
  if (!isOnboarded || !canAccessSetupClass(selectedCar, betaAccess)) {
    return (
      <AnnouncerProvider>
        <SkipLink />
        <OnboardingFlow key={user.id} userId={user.id} onComplete={handleCarSelect} error={classSelectionError}
          initialStep={onboardingState?.onboarding_step === 'vehicle' || onboardingState?.onboarding_step === 'plan' ? onboardingState.onboarding_step : 'discipline'}
          initialDiscipline={onboardingState?.onboarding_discipline}
          initialClass={onboardingState?.onboarding_race_class}
          onProgress={handleOnboardingProgress} />
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
          <CustomCarGate user={user} selectedCar={selectedCar}>
          <SetupDashboard
            user={user}
            selectedCar={selectedCar}
            landingRequest={landingRequest}
            onSignInClick={() => setAuthModalOpen(true)}
            onChangeClass={openClassChange}
            classLocksEnabled={!(unlimitedClasses ?? (effectiveTier === 'team'))}
            onUpgrade={openTeamsUpgrade}
          />
          </CustomCarGate>
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
          onChanged={completeClassSelection}
          onUpgrade={openTeamsUpgrade}
        />
        <CookieConsent />
      </div>
    </AnnouncerProvider>
  );
};

export default AppLayout;
