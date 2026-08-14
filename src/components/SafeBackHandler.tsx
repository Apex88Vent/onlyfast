import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  armSafeBackGuard,
  recordSafeBackDashboardView,
  recordSafeBackRoute,
  safeBack,
} from '@/lib/safeBack';
import { isOnlyFastFilePickerOpen } from '@/lib/filePickerState';

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
      if (isOnlyFastFilePickerOpen()) {
        armSafeBackGuard();
        return;
      }
      window.setTimeout(() => {
        armSafeBackGuard();
        safeBack(navigate);
      }, 0);
    };

    const handleNativeBack = (event: Event) => {
      event.preventDefault();
      if (isOnlyFastFilePickerOpen()) return;
      safeBack(navigate);
    };

    window.addEventListener('onlyfast-view-changed', handleDashboardView);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('backbutton', handleNativeBack);

    return () => {
      window.removeEventListener('onlyfast-view-changed', handleDashboardView);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('backbutton', handleNativeBack);
    };
  }, [navigate]);

  return null;
};

export default SafeBackHandler;
