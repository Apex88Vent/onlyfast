import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Server-side beta authorization. Call this only after verifying the request
// JWT and always pass the user ID derived from that verified token.
export async function hasBetaFeatureForUser(
  admin: SupabaseClient,
  userId: string,
  featureKey: string,
  requiredTesterKind?: 'experimental' | 'personal',
): Promise<boolean> {
  if (!userId || !featureKey) return false;

  try {
    const { data: account, error: accountError } = await admin
      .from('beta_tester_accounts')
      .select('is_test_account, beta_features_enabled, tester_kind')
      .eq('user_id', userId)
      .maybeSingle();

    if (accountError) {
      console.error('[beta-features] account lookup failed:', accountError.message);
      return false;
    }
    if (
      account?.is_test_account !== true ||
      account?.beta_features_enabled !== true ||
      (requiredTesterKind && account?.tester_kind !== requiredTesterKind)
    ) {
      return false;
    }

    const { data: flag, error: flagError } = await admin
      .from('user_feature_flags')
      .select('enabled')
      .eq('user_id', userId)
      .eq('feature_key', featureKey)
      .maybeSingle();

    if (flagError) {
      console.error('[beta-features] feature lookup failed:', flagError.message);
      return false;
    }

    return flag?.enabled === true;
  } catch (error) {
    console.error('[beta-features] authorization lookup threw:', error);
    return false;
  }
}
