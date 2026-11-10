export type NativeAdsMode = 'off' | 'test' | 'android-test' | 'production';

/** Build provenance and the canonical origin are both required for live traffic. */
export function resolveNativeAdsMode(config: {
  enabled: unknown; mode: unknown; productionBuild: boolean; deployment: unknown; origin: string;
}): NativeAdsMode {
  if (config.enabled !== 'true') return 'off';
  if (config.mode === 'production' || config.mode === 'android-test') {
    return config.productionBuild &&
      config.deployment === 'production' && config.origin === 'https://onlyfast.app'
      ? config.mode : 'off';
  }
  // Preserve the existing registered-device rollout until explicitly activated.
  return config.mode === undefined || config.mode === '' || config.mode === 'test' ? 'test' : 'off';
}

export function nativeAdsAccountEnabled(mode: NativeAdsMode, userId: string | null, testUserId: string,
  platform: 'android' | 'ios' | null = null): boolean {
  return !!userId && (mode === 'production' ||
    (mode === 'test' || mode === 'android-test' && platform === 'android') && userId === testUserId);
}
