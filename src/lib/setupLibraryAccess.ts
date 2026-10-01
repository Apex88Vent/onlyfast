import { BETA_FEATURES, getCachedBetaAccess, type BetaAccessSnapshot } from './betaFeatures.ts';
import { EXPANDED_CAR_CLASSES, EXPANDED_CLASS_CONFIGS, isDevelopmentClass, type SetupCategory } from './setupLibrary.ts';
import { AVAILABLE_CAR_CLASSES, CAR_CLASSES } from './classConfigs.ts';

// Reuses the existing experimental test-account authorization, including its
// fail-closed cache and provider. Paid tier, admin status and DEV are irrelevant.
export function canAccessSetupLibrary(access: BetaAccessSnapshot = getCachedBetaAccess()): boolean {
  return access.isBetaTester && access.betaFeaturesEnabled && access.testerKind === 'experimental'
    && access.enabledFeatures.includes(BETA_FEATURES.testAccountFullAccess);
}
export function canAccessSetupClass(name: string, access: BetaAccessSnapshot = getCachedBetaAccess()): boolean {
  return !isDevelopmentClass(name) || canAccessSetupLibrary(access);
}
export function getSelectableSetupClasses(access: BetaAccessSnapshot = getCachedBetaAccess()): string[] {
  return canAccessSetupLibrary(access) ? [...CAR_CLASSES, ...EXPANDED_CAR_CLASSES] : [...AVAILABLE_CAR_CLASSES];
}
export function getDisciplineSetupClasses(category: SetupCategory, access: BetaAccessSnapshot = getCachedBetaAccess()): string[] {
  // Production onboarding keeps its original Coming Soon cards.
  const existing = category === 'dirt_oval' || !canAccessSetupLibrary(access) ? CAR_CLASSES : [];
  return [...existing, ...(canAccessSetupLibrary(access) ? EXPANDED_CAR_CLASSES.filter(c => EXPANDED_CLASS_CONFIGS[c].category === category) : [])];
}
