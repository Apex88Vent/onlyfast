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

export interface ExplicitQAReset {
  action: 'reset_qa_fixtures';
  confirmation: 'RESET-ONLYFAST-QA-FIXTURES';
  records: ReadonlyArray<{ table: string; id: string; key: string }>;
}

// Legacy no-argument login/logout callers deliberately do nothing. Explicit
// operator tooling supplies a bounded fixture allowlist, never a whole account.
// The prepared server implementation independently repeats authorization.
export async function resetTestAccountData(request?: ExplicitQAReset): Promise<boolean> {
  if (request?.action !== 'reset_qa_fixtures' || request.confirmation !== 'RESET-ONLYFAST-QA-FIXTURES' ||
      !Array.isArray(request.records) || !request.records.length || request.records.length > 24) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      console.warn('[test-account] no active session; skipping reset');
      return false;
    }
    const { data: verified, error: verificationError } = await supabase.auth.getUser();
    if (verificationError || verified.user?.id !== sessionData.session?.user.id || !canResetCurrentTestAccount()) return false;
    const { error } = await supabase.functions.invoke('reset-test-account', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: request,
    });
    if (error) {
      console.warn('[test-account] explicit fixture reset failed');
      return false;
    }
    return true;
  } catch {
    console.warn('[test-account] explicit fixture reset unavailable');
    return false;
  }
}
