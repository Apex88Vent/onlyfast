import { supabase } from '@/lib/supabase';
import {
  BETA_FEATURES,
  hasCachedExperimentalBetaFeature,
} from '@/lib/betaFeatures';

// =============================================================================
// DEVELOPMENT TEST-ACCOUNT BEHAVIOR
// -----------------------------------------------------------------------------
// The legacy synchronous membership helpers still need a synchronous answer,
// so BetaFeaturesProvider maintains a fail-closed cache in betaFeatures.ts.
// Identity and permission come from Supabase Auth user_id-backed tables; this
// module never checks an email address.
// =============================================================================

/**
 * Preserves the existing disposable test account's production-feature access.
 * This is separate from individual unfinished-feature flags and is assigned
 * only to an account whose stored tester_kind is "experimental".
 */
export function isCurrentUserTestAccount(): boolean {
  return hasCachedExperimentalBetaFeature(BETA_FEATURES.testAccountFullAccess);
}

export function canResetCurrentTestAccount(): boolean {
  return hasCachedExperimentalBetaFeature(BETA_FEATURES.testAccountReset);
}

/**
 * Calls the secure `reset-test-account` Edge Function for the currently
 * signed-in session. Safe to call from logout OR from a reset-on-login
 * fallback (covers the case where logout never ran because the browser was
 * closed or the session expired).
 *
 * The frontend never decides what gets reset. The Edge Function independently
 * verifies the JWT, authenticated user ID, experimental tester kind, and
 * test_account_reset feature flag before deleting any app data.
 *
 * Returns true on success, false on failure (logout should proceed either way).
 */
export async function resetTestAccountData(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      console.warn('[test-account] no active session; skipping reset');
      return false;
    }
    const { error } = await supabase.functions.invoke('reset-test-account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) {
      console.warn('[test-account] reset-test-account failed:', error.message || error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[test-account] reset-test-account threw:', err);
    return false;
  }
}
