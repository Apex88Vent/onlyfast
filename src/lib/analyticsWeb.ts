import type { AnalyticsSink } from './analyticsController';

export async function createWebAnalyticsSink(config: Record<string, string>, debug: boolean,
  canInitialize: () => boolean = () => true): Promise<AnalyticsSink | null> {
  if (typeof window === 'undefined' || !['apiKey', 'authDomain', 'projectId', 'storageBucket',
    'messagingSenderId', 'appId', 'measurementId'].every(key => Boolean(config[key]))) return null;
  const [appSdk, sdk] = await Promise.all([import('firebase/app'), import('firebase/analytics')]);
  if (!canInitialize() || !await sdk.isSupported() || !canInitialize()) return null;
  sdk.setConsent({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  const app = appSdk.getApps().find(app => app.name === 'onlyfast-analytics') || appSdk.initializeApp(config, 'onlyfast-analytics');
  const analytics = sdk.initializeAnalytics(app, { config: {
    send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
    // Never send auth/reset/share query parameters or user-entered document titles.
    page_location: window.location.origin + '/', page_referrer: '', page_title: 'OnlyFast',
    ...(debug ? { debug_mode: true } : {}),
  } });
  return {
    collection(enabled) {
      sdk.setConsent({ analytics_storage: enabled ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      sdk.setAnalyticsCollectionEnabled(analytics, enabled);
    },
    identity(id, properties) {
      sdk.setUserId(analytics, id);
      sdk.setUserProperties(analytics, { subscription_tier: null, racing_discipline: null, car_class: null, ...properties });
    },
    event(name, params) { sdk.logEvent(analytics, name, params); },
    screen(name) { sdk.logEvent(analytics, 'screen_view', { firebase_screen: name, firebase_screen_class: 'OnlyFast' }); },
  };
}
