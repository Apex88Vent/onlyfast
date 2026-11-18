import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { identifyAnalyticsUser, trackScreen } from '@/lib/analytics';

export default function AnalyticsLifecycle() {
  const { pathname } = useLocation();
  useEffect(() => {
    let active = true;
    let revision = 0;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      revision++; identifyAnalyticsUser(session?.user.id ?? null);
    });
    const initial = revision;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && initial === revision) identifyAnalyticsUser(data.session?.user.id ?? null);
    }).catch(() => {});
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (['/upgrade', '/pricing', '/checkout'].includes(pathname)) trackScreen('Subscription');
    else if (pathname === '/account') trackScreen('Settings');
    else if (pathname === '/track-trace') trackScreen('Track Trace');
  }, [pathname]);
  return null;
}
