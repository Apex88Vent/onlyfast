export type NativeAdsMode = 'off' | 'test' | 'production';

/** Build provenance and the canonical origin are both required for live traffic. */
export function resolveNativeAdsMode(config: {
  enabled: unknown; mode: unknown; productionBuild: boolean; deployment: unknown; origin: string;
}): NativeAdsMode {
  if (config.enabled !== 'true') return 'off';
  if (config.mode === 'production') {
    return config.productionBuild && config.deployment === 'production' && config.origin === 'https://onlyfast.app'
      ? 'production' : 'off';
  }
  // Preserve the existing registered-device rollout until explicitly activated.
  return config.mode === undefined || config.mode === '' || config.mode === 'test' ? 'test' : 'off';
}

export function nativeAdsAccountEnabled(mode: NativeAdsMode, userId: string | null, testUserId: string): boolean {
  return !!userId && (mode === 'production' || mode === 'test' && userId === testUserId);
}
