// ---------------------------------------------------------------------------
// Ad visibility logic — single source of truth for "should we show ads?"
//
// RULES (per product requirements):
//   - Never show ads to public/logged-out visitors.
//   - Only show ads to users whose effective account tier is exactly "rookie".
//   - Never show ads to pro, team(s), admin, ambassador, or any comp/unlocked
//     (promo / free-forever / admin override) accounts.
//   - If the tier cannot be determined, DEFAULT TO HIDING ADS.
//
// The publisher client + placeholder slot ids live here so they are easy to
// find and replace later.
// ---------------------------------------------------------------------------

import type { User } from '@supabase/supabase-js';
import { readMembership, getEffectiveTier } from '@/lib/membership';

// Google AdSense publisher (client) id — used by every <AdsenseAd />.
export const ADSENSE_CLIENT = 'ca-pub-9431443509195212';

// ---------------------------------------------------------------------------
// Placeholder ad slot ids — REPLACE THESE with real AdSense slot ids later.
// (Create the ad units in your AdSense dashboard, then paste the numeric
//  slot ids here. Search the codebase for "SLOT_REPLACE_ME" to find usages.)
// ---------------------------------------------------------------------------
export const AD_SLOTS = {
  // REPLACE_ME: bottom-of-setup/input page ad
  input_bottom_ad: 'SLOT_REPLACE_ME_INPUT_BOTTOM',
  // REPLACE_ME: full-page interstitial-style ad shown after a successful save
  post_save_full_page_ad: 'SLOT_REPLACE_ME_POST_SAVE',
  // REPLACE_ME: rookie dashboard ad (below summary cards)
  dashboard_rookie_ad: 'SLOT_REPLACE_ME_DASHBOARD',
  // REPLACE_ME: setup history ad (after every 6 saved setup cards)
  setup_history_rookie_ad: 'SLOT_REPLACE_ME_SETUP_HISTORY',
  // REPLACE_ME: timing results ad (below the session summary)
  timing_results_rookie_ad: 'SLOT_REPLACE_ME_TIMING_RESULTS',
} as const;

/**
 * Returns true ONLY when ads should be shown to this user.
 *
 * true requires ALL of:
 *   - the user is logged in
 *   - their effective tier resolves to exactly "rookie"
 *   - they are NOT pro, NOT team(s)
 *   - they are NOT admin / ambassador / comp / promo-unlocked / free-forever
 *
 * Anything ambiguous → false (hide ads).
 */
export function shouldShowAds(user: User | null | undefined): boolean {
  // Rule 1 & 2: must be a logged-in account.
  if (!user) return false;

  try {
    const metadata = (user.user_metadata || {}) as Record<string, any>;
    const membership = readMembership(metadata);

    // Admin / full-access override → never ads.
    if (membership.has_admin_full_access === true) return false;

    // Ambassador / comp / any promo-unlocked access → never ads.
    // (promo codes that grant elevated access set promo_access_level.)
    if (membership.promo_access_level) return false;

    // Resolve the effective tier (accounts for expired promos, admin, test acct).
    const tier = getEffectiveTier(membership);

    // Rule 3-7: only the rookie tier sees ads; anything else (pro/team) hides.
    return tier === 'rookie';
  } catch {
    // Rule 7: if we cannot determine the tier, default to hiding ads.
    return false;
  }
}
