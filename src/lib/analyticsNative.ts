import type { AnalyticsSink } from './analyticsController.ts';

export interface MedianAnalyticsEvents {
  logEvent?: (args: { event: string; data: Record<string, unknown> }) => void;
  logScreen?: (args: { screen: string }) => void;
  setUser?: (args: { ID: string }) => void;
  setUserProperty?: (args: { key: string; value: string }) => void;
  defaultEventParameters?: (args: { platform: string }) => void;
  setConsent?: (args: { adStorage: boolean; analyticsStorage: boolean; adUserData: boolean; adPersonalization: boolean }) => void;
  collection?: (args: { enabled: boolean }) => void;
}

/** Median documents no identity reset. Native UUID identification is deliberately
 * disabled; anonymous event/property analytics cannot retain a previous account ID.
 * Never invent an empty/null ID reset or rely on clearable browser storage.
 */
export function createNativeAnalyticsSink(api: MedianAnalyticsEvents, storage: Storage,
  platform: 'android' | 'ios', manualScreens: boolean): AnalyticsSink {
  let identitySafe = false;
  let collecting = false;
  const disable = () => { collecting = false; api.collection?.({ enabled: false }); };
  disable();
  return {
    collection(enabled) {
      collecting = false;
      if (!api.collection || !api.setConsent) return;
      disable();
      // Advertising permission is never inferred from analytics permission.
      api.setConsent({ adStorage: false, analyticsStorage: enabled && identitySafe, adUserData: false, adPersonalization: false });
      collecting = enabled && identitySafe;
      api.collection({ enabled: collecting });
    },
    identity(id, properties) {
      disable(); identitySafe = false;
      try {
        // ID is used only by web Firebase until Median supports a reviewed reset.
        // Keep native collection off while signed out after authentication.
        if (storage.getItem('onlyfast_analytics_native_signed_in_v1') && !id) return;
        if (id) storage.setItem('onlyfast_analytics_native_signed_in_v1', 'true');
        for (const key of ['subscription_tier', 'racing_discipline', 'car_class']) {
          // Empty string is documented string input; no unsupported null reset.
          api.setUserProperty?.({ key, value: properties[key] || '' });
        }
        api.defaultEventParameters?.({ platform });
        identitySafe = true;
      } catch { identitySafe = false; }
    },
    event(name, params) { if (collecting) api.logEvent?.({ event: name, data: params }); },
    screen(name) { if (collecting && manualScreens) api.logScreen?.({ screen: name }); },
  };
}
