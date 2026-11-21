import { trackEvent } from '@/lib/analytics';
import { useMembershipRevision } from '@/hooks/useMembershipRevision';
import { CustomCarGate } from './CustomCarSheet';
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { nativeAds } from '@/lib/nativeAds';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { AnnouncerProvider } from './AccessibleAnnouncer';
import SkipLink from './SkipLink';
import SplashScreen from './SplashScreen';
import OnboardingFlow from './OnboardingFlow';
import HowOnlyFastWorks from './HowOnlyFastWorks';
import Header from './Header';
import SetupDashboard from './SetupDashboard';
import { HouseBottomBanner, HouseInterstitialDialog } from './HouseAdPlacement';
import RookieAdSlot from './RookieAdSlot';
import { shouldShowAds } from '@/lib/ads';
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
import { failedRead, isRejectedSession, isTransientStartupError, logStartupFailure, restoreStartupSession, startupRead, watchStartupResume } from '@/lib/startupRecovery';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

function DashboardLoadError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="p-4" style={{ minHeight: '12rem' }}>
      <p>Your dashboard could not load. Please try again.</p>
      <button type="button" className="underline" onClick={retry}>Try again</button>
    </div>
  );
}

class DashboardRenderBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { logStartupFailure('dashboard-render', error); }
  render() {
    return this.state.failed
      ? <DashboardLoadError retry={() => this.setState({ failed: false })} />
      : this.props.children;
  }
}

function DashboardWithHouseAds({ user, children }: { user: User | null; children: React.ReactNode }) {
  const ads = useSyncExternalStore(nativeAds.subscribeHouseAds, nativeAds.getHouseAds);
  useMembershipRevision();
  const eligible = shouldShowAds(user);
  const banner = eligible && ads.bannerUser === user?.id;
  const interstitial = eligible && ads.interstitialUser === user?.id;
  const bannerSpace = banner ? 'calc(3rem + env(safe-area-inset-bottom))' : '0px';

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col"
      style={{ '--house-banner-space': bannerSpace, paddingBottom: bannerSpace } as React.CSSProperties}>
      {children}
      {banner && <HouseBottomBanner />}
      {interstitial && (
        <HouseInterstitialDialog title="OnlyFast Pro upgrade" onClose={nativeAds.closeHouseInterstitial}>
          <RookieAdSlot placement="after_save_interstitial" user={user} onContinue={nativeAds.closeHouseInterstitial} />
        </HouseInterstitialDialog>
      )}
    </div>
  );
}

// Intro navigation only: a confirmation link may open a second tab. Neither
// marker authorizes access or completes discipline, class or plan selection.
const guestTutorialKey = 'onlyfast_guest_tutorial_seen';
const guestTutorialExpiryKey = 'onlyfast_guest_tutorial_expires_at';
function hasSeenGuestTutorial() {
  try { if (sessionStorage.getItem(guestTutorialKey) === 'true') return true; } catch { /* Optional navigation state. */ }
  try { return Number(localStorage.getItem(guestTutorialExpiryKey)) > Date.now(); } catch { return false; }
}
function rememberGuestTutorial(seen: boolean) {
  try { if (seen) sessionStorage.setItem(guestTutorialKey, 'true'); else sessionStorage.removeItem(guestTutorialKey); } catch { /* Optional navigation state. */ }
  try {
    if (seen) localStorage.setItem(guestTutorialExpiryKey, String(Date.now() + 24 * 60 * 60 * 1000));
    else localStorage.removeItem(guestTutorialExpiryKey);
  } catch { /* Optional navigation state. */ }
}

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
  const [sessionError, setSessionError] = useState(false);
  const restoreSessionRef = useRef(() => {});
  const [profileError, setProfileError] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const retryProfile = useCallback(() => {
    setProfileError(false);
    setIsLoadingSavedCar(true);
    setProfileAttempt(attempt => attempt + 1);
  }, []);
  const [guestTutorialFinished, setGuestTutorialFinished] = useState(hasSeenGuestTutorial);
  const authenticatedUserId = user?.id ?? null;
  useEffect(() => profileError ? watchStartupResume(retryProfile) : undefined, [profileError, retryProfile]);
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
    if (tutorialPending.current) return;
    if (!user) {
      rememberGuestTutorial(true);
      setGuestTutorialFinished(true);
      setShowHowOnlyFastWorks(false);
      setHasCheckedHowOnlyFastWorks(true);
      return;
    }
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
    if (!user) { void markHowOnlyFastWorksComplete(); return; }
    onboardingLoginEscapeRef.current = true;
    setAuthModalOpen(true);
  }, [user, markHowOnlyFastWorksComplete]);

  const returnToGuestTutorial = useCallback(() => {
    rememberGuestTutorial(false);
    setGuestTutorialFinished(false);
    setShowHowOnlyFastWorks(true);
    setHasCheckedHowOnlyFastWorks(true);
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
    if (!authenticatedUserId || classSelectionUserId !== authenticatedUserId) return;
    const controller = new AbortController();
    let pending = false;
    const refreshAllowance = async () => {
      if (pending) return;
      pending = true;
      try {
        const session = await restoreStartupSession(supabase.auth, controller.signal);
        if (controller.signal.aborted || session?.user.id !== authenticatedUserId) return;
        const state = await startupRead('racing-profile', getActiveClassState, controller.signal);
        if (!controller.signal.aborted && authUserIdRef.current === authenticatedUserId) setUnlimitedClasses(state.unlimited);
      } catch { /* Existing server-side class authorization remains authoritative. */ }
      finally { pending = false; }
    };
    window.addEventListener('membership-updated', refreshAllowance);
    return () => { controller.abort(); window.removeEventListener('membership-updated', refreshAllowance); };
  }, [authenticatedUserId, classSelectionUserId]);

  useEffect(() => {
    if (!authChecked) return;
    setSelectedCar('');
    setIsOnboarded(false);
    setClassSelectionError('');
    setOnboardingState(null);
    setLandingRequest(0);
    setUnlimitedClasses(null);
    setProfileError(false);
    if (!authenticatedUserId) {
      setClassSelectionUserId(null);
      setIsLoadingSavedCar(false);
      return;
    }

    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && authUserIdRef.current === authenticatedUserId;
    setIsLoadingSavedCar(true);
    (async () => {
      let classLookupError: unknown;
      try {
        try {
          let state = await startupRead('racing-profile', getActiveClassState, controller.signal);
          if (!isCurrent()) return;
          // Transfer only the introductory step after authentication. An
          // existing complete/vehicle/plan state always takes precedence.
          if (guestTutorialFinished && state.onboarding_step === 'tutorial') {
            setOnboardingState(state);
            try {
              state = await saveOnboardingProgress('discipline', undefined, undefined, authenticatedUserId);
            } catch {
              if (isCurrent()) setClassSelectionError('Your tutorial progress could not be saved. Please try again.');
              return;
            }
          }
          if (!isCurrent()) return;
          setUnlimitedClasses(state.unlimited);
          setOnboardingState(state);
          // A persisted draft must finish plan selection before opening the app.
          if (state.onboarding_step && state.onboarding_step !== 'complete') return;
          if (state.active_class) {
            applySelectedCar(state.active_class);
            return;
          }
        } catch (error) {
          if (!isCurrent()) return;
          classLookupError = error;
          // Compatibility fallback until the active-class migration is deployed.
        }
        try {
          // Recover an existing user's class from their own saved setups only.
          // A device-wide guest/previous-account selection cannot initialize it.
          const data = await startupRead('saved-class', async signal => {
            const { data, error, status } = await supabase
              .from('race_setups')
              .select('race_class')
              .eq('user_id', authenticatedUserId)
              .not('race_class', 'is', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .retry(false)
              .abortSignal(signal);
            if (error) throw failedRead(error, status);
            return data;
          }, controller.signal);
          if (!isCurrent()) return;
          const savedCar = (data?.[0]?.race_class || '').trim();
          if (savedCar) applySelectedCar(savedCar);
          else if (isTransientStartupError(classLookupError) || isRejectedSession(classLookupError)) setProfileError(true);
        } catch {
          if (!isCurrent()) return;
          // Network fallback can use only this user's own previous selection.
          // A successful server lookup with no active class remains authoritative.
          if (classLookupError) {
            try {
              const savedCar = localStorage.getItem(`onlyfast_car_${authenticatedUserId}`);
              if (savedCar) { applySelectedCar(savedCar); return; }
            } catch { /* The next attempt can still recover the server profile. */ }
          }
          setProfileError(true);
        }
      } finally {
        if (isCurrent()) {
          setClassSelectionUserId(authenticatedUserId);
          setIsLoadingSavedCar(false);
        }
      }
    })();

    return () => controller.abort();
  }, [authChecked, authenticatedUserId, applySelectedCar, guestTutorialFinished, profileAttempt]);

  // Auth state listener
  useEffect(() => {
    let active = true;
    let revision = 0;
    let restoring = false;
    let retryNeeded = false;
    let expiresAt: number | undefined;
    const controller = new AbortController();
    const applySession = (event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      revision++;
      retryNeeded = false;
      expiresAt = session?.expires_at;
      setSessionError(false);
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
      if (event === 'SIGNED_OUT') {
        rememberGuestTutorial(false);
        setGuestTutorialFinished(false);
        setAuthModalOpen(false);
        setIsReplayingHowOnlyFastWorks(false);
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

    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION' || session) applySession(event, session);
    });

    const restore = () => {
      if (!active || restoring) return;
      const initial = revision;
      restoring = true;
      setSessionError(false);
      void restoreStartupSession(supabase.auth, controller.signal).then(session => {
        if (active && revision === initial) applySession('INITIAL_SESSION', session);
      }).catch(error => {
        if (!active || revision !== initial) return;
        if (isRejectedSession(error)) applySession('INITIAL_SESSION', null);
        else {
          retryNeeded = true;
          // A temporary auth outage cannot discard an already mounted editor.
          if (!authUserIdRef.current) setSessionError(true);
        }
      }).finally(() => { restoring = false; });
    };
    restoreSessionRef.current = restore;
    const stopResume = watchStartupResume(() => {
      if (retryNeeded || (expiresAt !== undefined && expiresAt * 1000 <= Date.now() + 30_000)) restore();
    });
    restore();
    return () => {
      active = false;
      controller.abort();
      stopResume();
      restoreSessionRef.current = () => {};
      subscription.unsubscribe();
    };
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

    if (!user) {
      setShowHowOnlyFastWorks(!guestTutorialFinished);
      setHasCheckedHowOnlyFastWorks(true);
      return;
    }

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
  }, [authChecked, user, selectedCar, showSplash, isReplayingHowOnlyFastWorks, classSelectionUserId, authenticatedUserId, isLoadingSavedCar, onboardingState, guestTutorialFinished]);

  const handleCarSelect = async (car: string) => {
    setClassSelectionError('');
    if (!canAccessSetupClass(car, betaAccess)) return;
    if (!user) return;
    try {
      const state = await completeRacingOnboarding(user.id);
      if (authUserIdRef.current !== user.id) return;
      setOnboardingState(state);
      setUnlimitedClasses(state.unlimited);
      trackEvent('onboarding_step_completed', { step: '4' }, 'onboarding-plan:' + user.id);
      trackEvent('onboarding_complete', { car_class: state.active_class || car }, 'onboarding-complete:' + user.id);
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
  useLayoutEffect(() => {
    if (authModalOpen || classChangeOpen || legalModal !== null) return nativeAds.suspend();
  }, [authModalOpen, classChangeOpen, legalModal]);
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

  if (sessionError || profileError) {
    return <DashboardLoadError retry={sessionError ? () => restoreSessionRef.current() : retryProfile} />;
  }

  if (!authChecked || isLoadingSavedCar || classSelectionUserId !== authenticatedUserId) {
    return <div className="min-h-screen bg-[#F5F5F7]" role="status" aria-label="Loading your racing profile" />;
  }

  if (!user && guestTutorialFinished) {
    return (
      <AnnouncerProvider>
        <div className="min-h-screen bg-[#F5F5F7]">
          <AuthModal isOpen onClose={returnToGuestTutorial} />
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

  if (!user || (betaAccess.loading && (!isOnboarded || !canAccessSetupClass(selectedCar, betaAccess)))) {
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
      <DashboardWithHouseAds user={user}>
        <SkipLink />
        <Header
          user={user}
          onSignInClick={() => setAuthModalOpen(true)}
          selectedCar={selectedCar}
          onBackToCarSelect={openClassChange}
          onOpenHowOnlyFastWorks={handleOpenHowOnlyFastWorks}
        />
        <main id="main-content" data-native-banner-layout tabIndex={-1} className="flex-1">
          <h1 className="sr-only">OnlyFast Setup Assist - Dirt Track Racing Setup Tracker</h1>
          <CustomCarGate user={user} selectedCar={selectedCar}>
          <DashboardRenderBoundary key={user.id}>
          <SetupDashboard
            key={user?.id || 'guest'}
            user={user}
            selectedCar={selectedCar}
            landingRequest={landingRequest}
            onSignInClick={() => setAuthModalOpen(true)}
            onChangeClass={openClassChange}
            classLocksEnabled={!(unlimitedClasses ?? ((effectiveTier === 'team' || effectiveTier === 'factory')))}
            onUpgrade={openTeamsUpgrade}
          />
          </DashboardRenderBoundary>
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
      </DashboardWithHouseAds>
    </AnnouncerProvider>
  );
};

export default AppLayout;
