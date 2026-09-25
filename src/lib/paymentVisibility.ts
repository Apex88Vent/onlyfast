import { isMedianIOS, isMedianUserAgent } from './nativeEnvironment';

// Require Median evidence as well as iOS: Safari must keep the web UI.
export const isMedianIOSApp = typeof navigator !== 'undefined' &&
  isMedianIOS(navigator.userAgent, navigator.maxTouchPoints);

const HIDE_EXTERNAL_PAYMENTS_STORAGE_KEY = 'onlyfast_hide_external_payments';

const hideExternalPaymentsBuildFlag =
  import.meta.env.VITE_HIDE_EXTERNAL_PAYMENTS === 'true';

const cleanNativeAppQueryParam = () => {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('nativeApp')) return;

    url.searchParams.delete('nativeApp');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  } catch {
    // URL cleanup is best-effort and should never block payment visibility.
  }
};

const readRuntimeHideExternalPayments = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const nativeApp = params.get('nativeApp');

    if (nativeApp === 'true') {
      try {
        window.localStorage.setItem(HIDE_EXTERNAL_PAYMENTS_STORAGE_KEY, 'true');
      } catch {
        // Some embedded browsers restrict storage; the URL flag still applies for this load.
      }
      cleanNativeAppQueryParam();
      return true;
    }

    if (nativeApp === 'false') {
      try {
        window.localStorage.removeItem(HIDE_EXTERNAL_PAYMENTS_STORAGE_KEY);
      } catch {
        // Storage reset is best-effort for testing.
      }
      cleanNativeAppQueryParam();
      return false;
    }

    try {
      return window.localStorage.getItem(HIDE_EXTERNAL_PAYMENTS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  } catch {
    return false;
  }
};

const runtimeHideExternalPayments = readRuntimeHideExternalPayments();
export const hideExternalPayments = hideExternalPaymentsBuildFlag || runtimeHideExternalPayments ||
  (typeof navigator !== 'undefined' && isMedianUserAgent(navigator.userAgent));

export const nativeUpgradeMessage =
  'View Pro and Team subscriptions in the app. Prices and available offers are shown before purchase.';

export const nativeBillingMessage =
  'Manage your subscription through the store where you purchased it. Contact admin@onlyfast.app for account support.';
