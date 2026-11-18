import { AnalyticsController, type AnalyticsEvent, type AnalyticsParams, type ConsentState } from './analyticsController';
import { createNativeAnalyticsSink, type MedianAnalyticsEvents } from './analyticsNative';
import { isNativeAppContext } from './nativeEnvironment';
import { getTrustedMembership } from './trustedMembership';
import { CLASS_CONFIGS } from './classConfigs';
import { EXPANDED_CLASS_CONFIGS } from './setupLibrary';

type AnalyticsHost = Window & {
  median?: { deviceInfo?: () => Promise<{ appId?: string; platform?: string }>; firebaseAnalytics?: { event?: MedianAnalyticsEvents } };
  gonative?: object;
  median_library_ready?: () => void;
};
export const analytics = new AnalyticsController();
const preview = import.meta.env.ONLYFAST_2027_PREVIEW === true || import.meta.env.ONLYFAST_DEPLOYMENT_TARGET === 'preview';
const consentKey = preview ? 'onlyfast_analytics_consent_preview_v1' : 'onlyfast_analytics_consent_v1';
// Preview has a restrictive CSP and synthetic users: inherited production config
// must never send its traffic to the live Firebase property.
const enabled = import.meta.env.VITE_ANALYTICS_ENABLED === 'true' && !preview;
let consent: ConsentState = 'unknown';
let userId: string | null = null;
let carProperties: Record<string, string> = {};
let initialized = false;
let webAttempted = false;
let nativeReady = false;
let nativeAttempted = false;
let stopped = false;
let nativeDetected = false;
let onboardingCompleted = false;
const host = () => typeof window === 'undefined' ? undefined : window as AnalyticsHost;
function isNative() {
  const w = host();
  return nativeDetected || Boolean(w && isNativeAppContext(w.location.search, navigator.userAgent, Boolean(w.median || w.gonative)));
}
function readConsent(): ConsentState {
  try {
    const saved = localStorage.getItem(consentKey);
    return saved === 'granted' || saved === 'denied' ? saved : 'unknown';
  } catch { return 'unknown'; }
}
function refreshIdentity() {
  const tier = userId ? getTrustedMembership(userId)?.membership_tier : null;
  analytics.identify(userId, { ...carProperties, subscription_tier: tier || null });
}
async function prepare() {
  const w = host();
  if (!w) return;
  if (isNative()) {
    nativeDetected = true;
    if (!nativeReady || nativeAttempted) return;
    nativeAttempted = true;
    try {
      // Establish app identity through Median's documented deviceInfo, not UA alone.
      const info = await w.median?.deviceInfo?.();
      const api = w.median?.firebaseAnalytics?.event;
      if (info?.appId !== 'app.onlyfast' || !['android', 'ios'].includes(info.platform || '') || !api) return;
      analytics.attach(createNativeAnalyticsSink(api, w.localStorage, info.platform as 'android' | 'ios',
        import.meta.env.VITE_ANALYTICS_NATIVE_MANUAL_SCREENS === 'true'));
    } catch { /* Missing native plugin/storage never falls back to web analytics. */ }
    return;
  }
  if (!analytics.allowed() || webAttempted) return;
  webAttempted = true;
  try {
    const { createWebAnalyticsSink } = await import('./analyticsWeb');
    // A bridge may have appeared while the lazy module loaded.
    if (isNative()) return;
    if (!analytics.allowed()) { webAttempted = false; return; }
    const sink = await createWebAnalyticsSink({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
    }, import.meta.env.DEV && import.meta.env.VITE_ANALYTICS_DEBUG === 'true', () => !isNative() && analytics.allowed());
    if (sink && !isNative()) analytics.attach(sink);
    else if (!analytics.allowed() && !isNative()) webAttempted = false;
  } catch { /* One initialization attempt per document, no retry loop. */ }
}

/** Call before React mounts so the existing chained Median callback sees readiness. */
export function startAnalytics() {
  const w = host();
  if (!w || initialized) return;
  initialized = true;
  consent = readConsent();
  analytics.configure(enabled, consent);
  const previous = w.median_library_ready;
  w.median_library_ready = () => {
    nativeReady = true; nativeDetected = true;
    try { previous?.call(w); } finally { void prepare(); }
  };
  w.addEventListener('storage', event => {
    if (event.key === consentKey || event.key === null) {
      consent = readConsent(); analytics.configure(enabled && !stopped, consent); void prepare();
      notifyConsent();
    }
  });
  w.addEventListener('membership-updated', refreshIdentity);
  void prepare();
}

/** CMP integration point. Essential-cookie acceptance never calls this function. */
export function setAnalyticsConsent(state: ConsentState) {
  consent = state;
  try { localStorage.setItem(consentKey, state); } catch { /* Session choice still applies. */ }
  analytics.configure(enabled && !stopped, state);
  refreshIdentity();
  void prepare();
  notifyConsent();
}
function notifyConsent() {
  try { host()?.dispatchEvent(new Event('onlyfast-analytics-consent')); } catch { /* Optional UI notification. */ }
}
export function getAnalyticsConsent(): ConsentState { return consent; }
export function analyticsEnabledInBuild() { return enabled && !stopped; }
export function subscribeAnalyticsConsent(listener: () => void) {
  const w = host();
  w?.addEventListener('onlyfast-analytics-consent', listener);
  return () => w?.removeEventListener('onlyfast-analytics-consent', listener);
}
export function disableAnalytics() { stopped = true; analytics.configure(false, consent); }
export function identifyAnalyticsUser(id: string | null) {
  if (id !== userId) carProperties = {};
  userId = id; refreshIdentity();
}
export function setAnalyticsRacingContext(carClass: string, discipline: string) {
  carProperties = sanitizeRacing(carClass, discipline); refreshIdentity();
}
function sanitizeRacing(carClass: string, discipline: string): Record<string, string> {
  return (Object.prototype.hasOwnProperty.call(CLASS_CONFIGS, carClass) || Object.prototype.hasOwnProperty.call(EXPANDED_CLASS_CONFIGS, carClass)) && ['dirt_oval', 'pavement_oval', 'road_course', 'motorcycle', 'rc'].includes(discipline)
    ? { car_class: carClass, racing_discipline: discipline } : {};
}
export function trackEvent(name: AnalyticsEvent, params: AnalyticsParams = {}, dedupeKey?: string) {
  if (name === 'onboarding_started') onboardingCompleted = false;
  if (name === 'onboarding_complete') onboardingCompleted = true;
  if (name === 'onboarding_abandoned' && onboardingCompleted) return;
  const tier = userId ? getTrustedMembership(userId)?.membership_tier : null;
  const clean = { ...params };
  if (typeof clean.car_class === 'string' && !Object.prototype.hasOwnProperty.call(CLASS_CONFIGS, clean.car_class) && !Object.prototype.hasOwnProperty.call(EXPANDED_CLASS_CONFIGS, clean.car_class)) delete clean.car_class;
  if (clean.racing_discipline && !['dirt_oval', 'pavement_oval', 'road_course', 'motorcycle', 'rc'].includes(String(clean.racing_discipline))) delete clean.racing_discipline;
  analytics.track(name, { ...carProperties, ...(tier ? { subscription_tier: tier } : {}), ...clean }, dedupeKey);
}
export function trackScreen(name: string) { analytics.screen(name); }
export function enterAnalyticsScreen(name: string) {
  const previous = analytics.screenName();
  trackScreen(name);
  return () => {
    if (previous && analytics.screenName() === name) trackScreen(previous);
  };
}
