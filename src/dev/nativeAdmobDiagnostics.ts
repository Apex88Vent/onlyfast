import { nativeAds } from '@/lib/nativeAds';

/** Loaded only by Vite DEV. Does not set test mode in Google's native SDK. */
export function installNativeAdmobDiagnostics(host: Window) {
  if (!import.meta.env.DEV) return () => {};
  const tools = Object.freeze({
    status: () => nativeAds.getDiagnostics(),
    consent: () => nativeAds.requestConsent(),
    banner: () => nativeAds.runDevelopmentTest('banner'),
    hideBanner: () => nativeAds.runDevelopmentTest('hide-banner'),
    automatic: () => nativeAds.runDevelopmentTest('automatic'),
    interstitial: () => nativeAds.runDevelopmentTest('interstitial'),
  });
  Object.defineProperty(host, 'onlyfastAdmobTest', { configurable: true, value: tools });
  return () => { Reflect.deleteProperty(host, 'onlyfastAdmobTest'); };
}
