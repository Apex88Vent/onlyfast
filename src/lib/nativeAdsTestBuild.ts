// Included only by Vite's explicit admob-test build alias, never ordinary builds.
// This authorizes Google demo-ad testing, not tracking or advertising consent.
export const ADMOB_TEST_ORIGIN = 'https://onlyfast-admob-test-apex88vents-projects.vercel.app';
export const nativeAdsBuild = {
  permissionReady: (_verified: boolean, origin: string): boolean => origin === ADMOB_TEST_ORIGIN,
  iosEnabled: (origin: string): boolean => origin === ADMOB_TEST_ORIGIN,
};
