import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BETA_FEATURES,
  buildBetaAccessSnapshot,
  clearCachedBetaAccess,
  getCachedBetaAccess,
  hasCachedBetaFeature,
  hasCachedExperimentalBetaFeature,
  setCachedBetaAccess,
} from '../src/lib/betaFeatures.ts';

test('normal users and missing account rows fail closed', () => {
  const snapshot = buildBetaAccessSnapshot(null, [
    { feature_key: BETA_FEATURES.onboardingPreviewRoute, enabled: true },
  ]);

  assert.equal(snapshot.isBetaTester, false);
  assert.equal(snapshot.betaFeaturesEnabled, false);
  assert.deepEqual(snapshot.enabledFeatures, []);
});

test('the account master switch overrides enabled flag rows', () => {
  const snapshot = buildBetaAccessSnapshot(
    {
      user_id: 'user-1',
      is_test_account: true,
      beta_features_enabled: false,
      tester_kind: 'experimental',
    },
    [{ feature_key: BETA_FEATURES.testAccountReset, enabled: true }],
  );

  assert.equal(snapshot.isBetaTester, true);
  assert.equal(snapshot.betaFeaturesEnabled, false);
  assert.deepEqual(snapshot.enabledFeatures, []);
});

test('only explicitly enabled per-user features are returned', () => {
  const snapshot = buildBetaAccessSnapshot(
    {
      user_id: 'user-1',
      is_test_account: true,
      beta_features_enabled: true,
      tester_kind: 'experimental',
    },
    [
      { feature_key: BETA_FEATURES.onboardingPreviewRoute, enabled: true },
      { feature_key: BETA_FEATURES.rookieAdSlotPreviewRoute, enabled: false },
      { feature_key: BETA_FEATURES.onboardingPreviewRoute, enabled: true },
    ],
  );

  assert.deepEqual(snapshot.enabledFeatures, [
    BETA_FEATURES.onboardingPreviewRoute,
  ]);
});

test('the synchronous legacy test-account bridge requires experimental role and flag', () => {
  const personalSnapshot = buildBetaAccessSnapshot(
    {
      user_id: 'personal-user',
      is_test_account: true,
      beta_features_enabled: true,
      tester_kind: 'personal',
    },
    [{ feature_key: BETA_FEATURES.testAccountFullAccess, enabled: true }],
  );
  setCachedBetaAccess(personalSnapshot);
  assert.equal(hasCachedBetaFeature(BETA_FEATURES.testAccountFullAccess), true);
  assert.equal(
    hasCachedExperimentalBetaFeature(BETA_FEATURES.testAccountFullAccess),
    false,
  );

  const experimentalSnapshot = buildBetaAccessSnapshot(
    {
      user_id: 'experimental-user',
      is_test_account: true,
      beta_features_enabled: true,
      tester_kind: 'experimental',
    },
    [{ feature_key: BETA_FEATURES.testAccountFullAccess, enabled: true }],
  );
  setCachedBetaAccess(experimentalSnapshot);
  assert.equal(
    hasCachedExperimentalBetaFeature(BETA_FEATURES.testAccountFullAccess),
    true,
  );

  clearCachedBetaAccess();
  assert.equal(hasCachedBetaFeature(BETA_FEATURES.testAccountFullAccess), false);
  assert.equal(getCachedBetaAccess().isBetaTester, false);
});
