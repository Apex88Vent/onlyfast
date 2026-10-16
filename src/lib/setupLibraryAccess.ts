import { BETA_FEATURES, getCachedBetaAccess, type BetaAccessSnapshot } from './betaFeatures.ts';
import { EXPANDED_CAR_CLASSES, EXPANDED_CLASS_CONFIGS, isDevelopmentClass, type SetupCategory } from './setupLibrary.ts';
import { ROAD_RACING_CLASSES } from './roadRacingSetupSchemas.ts';
import { CAR_CLASSES } from './classConfigs.ts';

// Reuses the existing experimental test-account authorization, including its
// fail-closed cache and provider. Paid tier, admin status and DEV are irrelevant.
export function canAccessSetupLibrary(access: BetaAccessSnapshot = getCachedBetaAccess()): boolean {
  return access.isBetaTester && access.betaFeaturesEnabled && access.testerKind === 'experimental'
    && access.enabledFeatures.includes(BETA_FEATURES.testAccountFullAccess);
}
export function canAccessSetupClass(name: string, access: BetaAccessSnapshot = getCachedBetaAccess()): boolean {
  // The existing class sheets are now available across all five disciplines.
  // Beta access still controls experimental account privileges, not sheet access.
  void access;
  // Keep legacy names readable; new selections are validated by the server RPC.
  return !isDevelopmentClass(name) || EXPANDED_CAR_CLASSES.includes(name);
}
export function getSelectableSetupClasses(access: BetaAccessSnapshot = getCachedBetaAccess()): string[] {
  void access;
  return [...CAR_CLASSES, ...EXPANDED_CAR_CLASSES];
}
export function getDisciplineSetupClasses(category: SetupCategory, access: BetaAccessSnapshot = getCachedBetaAccess()): string[] {
  void access;
  if (category === 'road_course') return [...ROAD_RACING_CLASSES];
  return [...(category === 'dirt_oval' ? CAR_CLASSES : []),
    ...EXPANDED_CAR_CLASSES.filter(c => EXPANDED_CLASS_CONFIGS[c].category === category)];
}
