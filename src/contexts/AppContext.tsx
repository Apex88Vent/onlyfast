import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react';
import { watchNativePurchases } from '@/lib/nativePurchases';
import { nativeAds, watchNativeAds } from '@/lib/nativeAds';
import { watchNativeBannerSafety } from '@/lib/nativeBannerSafety';
import { supabase } from '@/lib/supabase';
import { useLocation } from 'react-router-dom';

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
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  useEffect(() => {
    const stopAds = watchNativeAds(nativeAds, {
      session: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
      onAuthChange: listener => {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session?.user.id ?? null));
        return () => data.subscription.unsubscribe();
      },
    }, window, document);
    const stopBannerSafety = watchNativeBannerSafety(nativeAds, window, document);
    return () => { stopBannerSafety(); stopAds(); };
  }, []);
  useEffect(() => watchNativePurchases(), []);

  useLayoutEffect(() => {
    nativeAds.setRouteSupported(pathname === '/');
    return () => nativeAds.setRouteSupported(false);
  }, [pathname]);

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
