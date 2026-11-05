// Reuse the existing actual-code, mounted-component and database harnesses.
export const smokeTests = ['tests/qaAutomation.test.ts','tests/offlineQueueSecurity.test.ts',
  'tests/usageAuthorization.test.ts','tests/subscriptionServerAuthorization.test.ts','tests/setupAssistOnlyLapsIntegration.test.ts',
  'tests/timingData.test.ts','tests/scheduleSelection.test.ts','tests/scheduleFinishingPosition.test.ts'];
export const mountedTests = ['tests/onboardingNavigation.mjs','tests/setupAssistTrackUpdates.mjs',
  'tests/nativeSubscriptionControls.mjs','tests/nativeBridgeDiagnostics.mjs','tests/nativeAdSettings.mjs'];
export const databaseTests = ['tests/phase1Database.mjs','tests/subscriptionAuthorizationDatabase.mjs',
  'tests/revenuecatDatabase.mjs','tests/racingOnboardingDatabase.mjs','tests/setupLibraryDatabase.mjs','tests/stagingDatabase.mjs'];
export const coverage = {
  auth:['qaAutomation','subscriptionAccountSwitch','racingSelectionAccountSwitch','membershipLifecycle','offlineQueueSecurity'],
  onboarding:['onboardingNavigation','membershipSelection','racingOnboardingDatabase','racingVehicleAccess'],
  setups:['setupLibrary','setupLibraryDatabase','raceWeekendSessions','setupNavigation','phase1Database','offlineQueueSecurity'],
  schedule:['scheduleSelection','scheduleFinishingPosition','performanceSummary'],
  sharing:['qaAutomation','phase1Database','setupLibraryDatabase'],
  assist:['usageAuthorization','setupAssistTrackUpdates','setupAssistOnlyLapsIntegration','phase1Database','phase1Postgres'],
  timing:['timingData','performanceSummary','usageAuthorization','phase1Database'],
  onlylaps:['onlylapsSessionLinking','onlylapsSessionCardIsolation','onlylapsSetupContext','setupAssistOnlyLapsIntegration'],
  subscription:['subscriptionAuthorizationDatabase','membershipAuthorization','revenuecatDatabase','nativeSubscriptionControls','nativeAds'],
  application:['onboardingNavigation','setupNavigation','nativeAdSettings','functionalReviewPreview'],
};
