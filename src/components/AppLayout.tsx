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
import { getActiveClassState, initializeActiveClass } from '@/lib/activeClass';
import { resetTestAccountData } from '@/lib/testAccount';
import { useBetaFeatures } from '@/hooks/useBetaFeatures';
import { BETA_FEATURES } from '@/lib/betaFeatures';
import { isOnlyFastFilePickerOpen } from '@/lib/filePickerState';
import { resolveAuthUiTransition } from '@/lib/authUiTransition';
import { canAccessSetupClass } from '@/lib/setupLibraryAccess';
import { isDevelopmentClass } from '@/lib/setupLibrary';

const AppLayout: React.FC = () => {
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
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [showSplash, setShowSplash] = useState(() => !isOnlyFastFilePickerOpen());
  const [authChecked, setAuthChecked] = useState(false);
  const authenticatedUserId = user?.id ?? null;
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

  useEffect(() => {
    if (!authChecked) return;
    setSelectedCar('');
    setIsOnboarded(false);
    setClassSelectionError('');
    setUnlimitedClasses(null);
    if (!authenticatedUserId) {
      try {
        const saved = localStorage.getItem('onlyfast_car');
        if (saved) applySelectedCar(saved);
      } catch {/* Storage can be unavailable in restricted WebViews. */}
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
          if (!cancelled) setUnlimitedClasses(state.unlimited);
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

    const completedInMetadata = Boolean(user?.user_metadata?.onboarding_completed);
    let completedLocally = false;
    try {
      completedLocally = localStorage.getItem(howOnlyFastWorksStorageKey(user?.id)) === 'true';
    } catch {/* ignore */}

    const completed = completedInMetadata || completedLocally;
    setShowHowOnlyFastWorks(!completed);
    setHasCheckedHowOnlyFastWorks(true);
  }, [authChecked, user, selectedCar, showSplash, isReplayingHowOnlyFastWorks, classSelectionUserId, authenticatedUserId, isLoadingSavedCar]);

  const handleCarSelect = async (car: string) => {
    setClassSelectionError('');
    if (!canAccessSetupClass(car, betaAccess)) return;
    if (!user) {
      applySelectedCar(car);
      return;
    }
    try {
      const state = await initializeActiveClass(car);
      setUnlimitedClasses(state.unlimited);
      applySelectedCar(state.active_class || car);
    } catch {
      setClassSelectionError(isDevelopmentClass(car)
        ? 'Your class could not be saved. This development class requires the setup-library database migration. Please try again after it is applied.'
        : 'Your class could not be saved. Please try again.');
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

  if (!authChecked || isLoadingSavedCar || classSelectionUserId !== authenticatedUserId) {
    return <div className="min-h-screen bg-[#F5F5F7]" role="status" aria-label="Loading your racing profile" />;
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
        <OnboardingFlow onComplete={handleCarSelect} error={classSelectionError} />
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
          onChanged={applySelectedCar}
          onUpgrade={openTeamsUpgrade}
        />
        <CookieConsent />
      </div>
    </AnnouncerProvider>
  );
};

export default AppLayout;
