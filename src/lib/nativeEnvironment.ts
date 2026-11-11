export function isMedianUserAgent(userAgent: string): boolean {
  return /median|gonative/i.test(userAgent);
}

// Only current-document evidence identifies the wrapper. A persisted payment
// preference can also exist in a normal browser after opening a native test URL.
export function isNativeAppContext(search: string, userAgent: string, hasNativeBridge = false): boolean {
  return new URLSearchParams(search).get('nativeApp') === 'true' ||
    isMedianUserAgent(userAgent) || hasNativeBridge;
}

export function nativePlatform(userAgent: string, maxTouchPoints = 0): 'ios' | 'android' | null {
  if (/android/i.test(userAgent)) return 'android';
  if (/MedianIOS|GoNativeIOS|iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  // iPadOS can use a desktop-style Macintosh user agent.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  return null;
}

export function isMedianIOS(userAgent: string, maxTouchPoints = 0): boolean {
  return isMedianUserAgent(userAgent) && nativePlatform(userAgent, maxTouchPoints) === 'ios';
}

// A verified subscription belongs to its purchase store, including across devices.
// Without a recorded store, use the known platform; never guess for an unknown host.
export function nativeSubscriptionManagementUrl(platform: 'ios' | 'android' | null, recordedStore?: string | null): string | null {
  if (recordedStore === 'app_store') return 'https://apps.apple.com/account/subscriptions';
  if (recordedStore === 'play_store') return 'https://play.google.com/store/account/subscriptions';
  if (recordedStore) return null;
  if (platform === 'android') return 'https://play.google.com/store/account/subscriptions';
  if (platform === 'ios') return 'https://apps.apple.com/account/subscriptions';
  return null;
}
