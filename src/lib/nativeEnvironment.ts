export function isMedianUserAgent(userAgent: string): boolean {
  return /median|gonative/i.test(userAgent);
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
