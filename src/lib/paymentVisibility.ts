import { isMedianIOS, isMedianUserAgent, isNativeAppContext } from './nativeEnvironment';

// Require Median evidence as well as iOS: Safari must keep the web UI.
export const isMedianIOSApp = typeof navigator !== 'undefined' &&
  isMedianIOS(navigator.userAgent, navigator.maxTouchPoints);

const HIDE_EXTERNAL_PAYMENTS_STORAGE_KEY = 'onlyfast_hide_external_payments';

const hideExternalPaymentsBuildFlag =
  import.meta.env.VITE_HIDE_EXTERNAL_PAYMENTS === 'true';

const host = typeof window === 'undefined' ? undefined : window as Window & {
  median?: object;
  gonative?: object;
};
const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const hasNativeEvidence = isMedianUserAgent(userAgent) ||
  Boolean(host && (host.median || host.gonative));

// Evaluate before query cleanup. Never use the legacy localStorage flag as
// evidence: it outlives both browser sessions and visits to native test URLs.
export const isNativeApp = isNativeAppContext(
  host?.location.search ?? '', userAgent, hasNativeEvidence,
);

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

const recordNativeLaunchContext = () => {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    const nativeApp = params.get('nativeApp');

    if (nativeApp === 'true') {
      try {
        window.localStorage.setItem(HIDE_EXTERNAL_PAYMENTS_STORAGE_KEY, 'true');
        // Real wrappers identify themselves on subsequent documents. With only
        // an explicit launch URL, retain it so a reload keeps that launch context.
        if (hasNativeEvidence) cleanNativeAppQueryParam();
      } catch {
        // Some embedded browsers restrict storage; the URL flag still applies for this load.
      }
      return;
    }

    if (nativeApp === 'false') {
      try {
        window.localStorage.removeItem(HIDE_EXTERNAL_PAYMENTS_STORAGE_KEY);
      } catch {
        // Storage reset is best-effort for testing.
      }
      cleanNativeAppQueryParam();
      return;
    }

  } catch {
    // Restricted URL/storage access must not interrupt the app.
  }
};

recordNativeLaunchContext();
// The build preference affects payment UI only. Wrapper evidence/launch context
// preserves native billing; a stale browser flag affects neither routing nor it.
export const hideExternalPayments = hideExternalPaymentsBuildFlag || isNativeApp;

export const nativeUpgradeMessage =
  'View Pro and Team subscriptions in the app. Prices and available offers are shown before purchase.';

export const nativeBillingMessage =
  'Manage your subscription through the store where you purchased it. Contact admin@onlyfast.app for account support.';
