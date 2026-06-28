import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  armSafeBackGuard,
  recordSafeBackDashboardView,
  recordSafeBackRoute,
  safeBack,
} from '@/lib/safeBack';

const SafeBackHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    recordSafeBackRoute(path);
    armSafeBackGuard();
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const handleDashboardView = (event: Event) => {
      const view = (event as CustomEvent).detail?.view;
      if (typeof view === 'string') {
        recordSafeBackDashboardView(view);
      }
    };

    const handlePopState = () => {
      window.setTimeout(() => {
        armSafeBackGuard();
        safeBack(navigate);
      }, 0);
    };

    window.addEventListener('onlyfast-view-changed', handleDashboardView);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('onlyfast-view-changed', handleDashboardView);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  return null;
};

export default SafeBackHandler;
