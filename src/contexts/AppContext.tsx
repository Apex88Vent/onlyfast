import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { syncMembershipFromSubscription } from '@/lib/subscription';
import {
  appendMedianPickerTrace,
  registerMedianPickerAuthSubscription,
} from '@/lib/medianPickerTrace';

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

  // Keep the app's paid access in sync with public.user_subscriptions so the
  // account reflects Stripe (and removes Pro/Teams access once a subscription
  // is no longer active/trialing). Admin override and active promos are
  // preserved inside syncMembershipFromSubscription.
  useEffect(() => {
    const unregisterTraceSubscription = registerMedianPickerAuthSubscription('AppContext');
    const sync = () => {
      syncMembershipFromSubscription().catch(() => {/* non-fatal */});
    };

    sync();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      appendMedianPickerTrace('auth_event', {
        source: 'AppContext',
        eventType: event,
      });
      // USER_UPDATED can be emitted by saveMembership itself. Re-running the
      // subscription bridge for that event feeds its own metadata write back
      // into the bridge even though the Stripe-backed row did not change.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        sync();
      }
    });

    const onSubUpdated = () => sync();
    window.addEventListener('subscription-updated', onSubUpdated);

    return () => {
      unregisterTraceSubscription();
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
