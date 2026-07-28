export const BETA_FEATURES = {
  testAccountFullAccess: 'test_account_full_access',
  testAccountReset: 'test_account_reset',
  onboardingPreviewRoute: 'onboarding_preview_route',
  rookieAdSlotPreviewRoute: 'rookie_ad_slot_preview_route',
} as const;

export type BetaFeatureKey = (typeof BETA_FEATURES)[keyof typeof BETA_FEATURES];
export type BetaTesterKind = 'experimental' | 'personal';

export interface BetaTesterAccountRow {
  user_id: string;
  is_test_account: boolean;
  beta_features_enabled: boolean;
  tester_kind: BetaTesterKind;
}

export interface UserFeatureFlagRow {
  feature_key: string;
  enabled: boolean;
}

export interface BetaAccessSnapshot {
  isBetaTester: boolean;
  betaFeaturesEnabled: boolean;
  testerKind: BetaTesterKind | null;
  enabledFeatures: readonly string[];
}

export const CLOSED_BETA_ACCESS: BetaAccessSnapshot = Object.freeze({
  isBetaTester: false,
  betaFeaturesEnabled: false,
  testerKind: null,
  enabledFeatures: Object.freeze([] as string[]),
});

let cachedBetaAccess: BetaAccessSnapshot = CLOSED_BETA_ACCESS;

export function buildBetaAccessSnapshot(
  account: BetaTesterAccountRow | null | undefined,
  flags: readonly UserFeatureFlagRow[] | null | undefined,
): BetaAccessSnapshot {
  const isBetaTester = account?.is_test_account === true;
  const betaFeaturesEnabled =
    isBetaTester && account?.beta_features_enabled === true;
  const testerKind =
    isBetaTester &&
    (account?.tester_kind === 'experimental' || account?.tester_kind === 'personal')
      ? account.tester_kind
      : null;

  if (!betaFeaturesEnabled || !testerKind) {
    return Object.freeze({
      isBetaTester,
      betaFeaturesEnabled: false,
      testerKind,
      enabledFeatures: Object.freeze([] as string[]),
    });
  }

  const enabledFeatures = Array.from(
    new Set(
      (flags || [])
        .filter((flag) => flag?.enabled === true && typeof flag.feature_key === 'string')
        .map((flag) => flag.feature_key.trim())
        .filter(Boolean),
    ),
  ).sort();

  return Object.freeze({
    isBetaTester: true,
    betaFeaturesEnabled: true,
    testerKind,
    enabledFeatures: Object.freeze(enabledFeatures),
  });
}

export function setCachedBetaAccess(snapshot: BetaAccessSnapshot): void {
  cachedBetaAccess = snapshot;
}

export function clearCachedBetaAccess(): void {
  cachedBetaAccess = CLOSED_BETA_ACCESS;
}

export function getCachedBetaAccess(): BetaAccessSnapshot {
  return cachedBetaAccess;
}

export function hasCachedBetaFeature(featureName: string): boolean {
  if (!featureName || !cachedBetaAccess.betaFeaturesEnabled) return false;
  return cachedBetaAccess.enabledFeatures.includes(featureName);
}

export function hasCachedExperimentalBetaFeature(featureName: string): boolean {
  return (
    cachedBetaAccess.testerKind === 'experimental' &&
    hasCachedBetaFeature(featureName)
  );
}
