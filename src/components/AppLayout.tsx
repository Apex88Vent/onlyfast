import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { AnnouncerProvider } from './AccessibleAnnouncer';
import SkipLink from './SkipLink';
import SplashScreen from './SplashScreen';
import OnboardingFlow from './OnboardingFlow';
import Header from './Header';
import SetupDashboard from './SetupDashboard';
import AuthModal from './AuthModal';
import CookieConsent from './CookieConsent';
import Footer from './Footer';
import LegalModal from './LegalModal';

const AppLayout: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedCar, setSelectedCar] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [showSplash, setShowSplash] = useState(true);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleCarSelect = (car: string) => {
    setSelectedCar(car);
    setIsOnboarded(true);
    localStorage.setItem('onlyfast_car', car);
  };

  const handleBackToCarSelect = () => {
    setIsOnboarded(false);
    setSelectedCar('');
    localStorage.removeItem('onlyfast_car');
  };

  // Show splash screen on first load
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Show onboarding if not completed
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
          onBackToCarSelect={handleBackToCarSelect}
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
