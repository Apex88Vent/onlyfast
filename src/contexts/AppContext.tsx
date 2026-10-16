import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { syncMembershipFromSubscription } from '@/lib/subscription';
import { clearTrustedMembership } from '@/lib/trustedMembership';
import { watchNativePurchases } from '@/lib/nativePurchases';

interface AppContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const defaultAppContext: AppContextType = {
  sidebarOpen: false,
  toggleSidebar: () => {},
};

const AppContext = createContext<AppContextType>(defaultAppContext);

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  useEffect(() => watchNativePurchases(), []);

  // Keep the app's paid access in sync with public.user_subscriptions so the
  // account reflects Stripe (and removes Pro/Teams access once a subscription
  // is no longer active/trialing). Admin override and active promos are
  // preserved inside syncMembershipFromSubscription.
  useEffect(() => {
    const sync = () => {
      syncMembershipFromSubscription().catch(() => {/* non-fatal */});
    };

    sync();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      clearTrustedMembership(session?.user.id || null);
      // Profile-only changes do not alter subscription authorization.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(sync, 0);
      }
    });

    const onSubUpdated = () => sync();
    window.addEventListener('subscription-updated', onSubUpdated);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('subscription-updated', onSubUpdated);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
