// Membership tier logic, limits, promo codes, and persistence helpers.
// Single source of truth for OnlyFast membership/plan gating.

import { supabase, supabaseUrl, supabaseKey } from '@/lib/supabase';
import { getTrustedMembership } from './trustedMembership';
// The disposable experimental account can retain its legacy full-access mode
// through an explicit account-level feature flag.
import { isCurrentUserTestAccount } from '@/lib/testAccount';

export type MembershipTier = 'rookie' | 'pro' | 'team';

export type LimitValue = number | 'unlimited';

export interface TierLimits {
  adsEnabled: boolean;
  maxCars: LimitValue;
  maxBaseSetups: LimitValue;
  maxRaceWeekendSetups: LimitValue;
  raceWeekendSetupLockHours: number | null;
  timingUploadsPerMonth: LimitValue;
  // Number of OnlyFast Setup Assists allowed PER race weekend save (not monthly).
  // Rookie = 1 per race weekend; Pro/Team = 'unlimited'.
  setupAssistsPerRaceWeekend: LimitValue;
  setupExport: boolean;
  leaderboardUpload: boolean;
  leaderboardBadges: boolean;
  advancedProfile: boolean;
}

export const tierLimits: Record<MembershipTier, TierLimits> = {
  rookie: {
    adsEnabled: true,
    maxCars: 1,
    maxBaseSetups: 1,
    maxRaceWeekendSetups: 2,
    raceWeekendSetupLockHours: 48,
    timingUploadsPerMonth: 2,
    setupAssistsPerRaceWeekend: 1,
    setupExport: false,
    leaderboardUpload: false,
    leaderboardBadges: false,
    advancedProfile: false,
  },
  pro: {
    adsEnabled: false,
    maxCars: 1,
    maxBaseSetups: 'unlimited',
    maxRaceWeekendSetups: 'unlimited',
    raceWeekendSetupLockHours: null,
    timingUploadsPerMonth: 'unlimited',
    setupAssistsPerRaceWeekend: 'unlimited',
    setupExport: true,
    leaderboardUpload: true,
    leaderboardBadges: true,
    advancedProfile: true,
  },
  team: {
    adsEnabled: false,
    maxCars: 'unlimited',
    maxBaseSetups: 'unlimited',
    maxRaceWeekendSetups: 'unlimited',
    raceWeekendSetupLockHours: null,
    timingUploadsPerMonth: 'unlimited',
    setupAssistsPerRaceWeekend: 'unlimited',
    setupExport: true,
    leaderboardUpload: true,
    leaderboardBadges: true,
    advancedProfile: true,
  },
};

export interface PlanMeta {
  tier: MembershipTier;
  displayName: string;
  priceDisplay: string;
  badge?: string;
  buttonText: string;
  recommended?: boolean;
  description: string;
  synopsis: string[];
}

export const PLANS: PlanMeta[] = [
  {
    tier: 'rookie',
    displayName: 'Rookie',
    priceDisplay: 'FREE',
    badge: 'Free Forever',
    buttonText: 'Continue Free',
    description: 'Everything you need to get started with OnlyFast and track your race weekends.',
    synopsis: [
      '1 car, 1 base setup',
      '2 race weekend setups (lock after 48h)',
      '2 timing uploads / month; 1 Setup Assist / race weekend',
      'View leaderboards (ads enabled)',
    ],
  },
  {
    tier: 'pro',
    displayName: 'Pro',
    priceDisplay: '$5/month',
    badge: 'Most Popular',
    buttonText: 'Choose Pro',
    recommended: true,
    description: 'Unlock the full OnlyFast experience for your race car.',
    synopsis: [
      'No ads — built for one car',
      'Unlimited base & race weekend setups',
      'Unlimited timing uploads & setup assists',
      'No 48-hour editing lock; setup exports',
      'Leaderboard uploads, badges & advanced profile',
    ],
  },
  {
    tier: 'team',
    displayName: 'Teams',
    priceDisplay: '$8/month',
    buttonText: 'Choose Teams',
    description: 'Everything in Pro, with the freedom to manage unlimited cars and classes.',
    synopsis: [
      'Everything in Pro, no ads',
      'Unlimited cars & classes',
      'Unlimited tracking across all cars/classes',
      'Full leaderboard participation everywhere',
    ],
  },
];

// ---------------------------------------------------------------------------
// Stripe Buy Button configuration + pending-plan flow helpers
// ---------------------------------------------------------------------------

// Plan values used by the Stripe Buy Button checkout flow.
export type CheckoutPlan = 'free' | 'pro' | 'teams';

export const STRIPE_PUBLISHABLE_KEY =
  'pk_live_51TZK26GEWZrPYXmKEZ7VlR6El2wY9QbiexR4Jolw4UMfUBfp4adAIisTk2p5MG0tO7rsF0IP4zZMFQyeTGqLWkzI00vVsLbR23';

export const STRIPE_BUY_BUTTONS: Record<'pro' | 'teams', string> = {
  pro: 'buy_btn_1TdzjMGEWZrPYXmKqblFVGCp',
  teams: 'buy_btn_1TjNSYGEWZrPYXmKdJbu6VSP',
};

const PENDING_PLAN_KEY = 'pending_plan';

export function setPendingPlan(plan: CheckoutPlan): void {
  try {
    localStorage.setItem(PENDING_PLAN_KEY, plan);
  } catch {
    /* ignore */
  }
}

export function getPendingPlan(): CheckoutPlan | null {
  try {
    const v = localStorage.getItem(PENDING_PLAN_KEY);
    if (v === 'pro' || v === 'teams' || v === 'free') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearPendingPlan(): void {
  try {
    localStorage.removeItem(PENDING_PLAN_KEY);
  } catch {
    /* ignore */
  }
}

// A free selection is a preference, never an authorization or billing change.
export async function selectRookie(userId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== userId) return false;
  try {
    localStorage.setItem(`onlyfast_plan_selection_${userId}`, 'rookie');
    await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { onlyfast_plan_selection: 'rookie' } }),
    });
  } catch { /* Free access does not depend on saving an optional preference. */ }
  const { data: current } = await supabase.auth.getSession();
  return current.session?.user.id === userId;
}


// ---------------------------------------------------------------------------
// User access shape stored in localStorage + Supabase user_metadata
// ---------------------------------------------------------------------------

export interface MembershipState {
  membership_tier: MembershipTier;
  promo_code_used: string | null;
  promo_access_level: string | null;
  promo_access_started_at: string | null;
  promo_access_expires_at: string | null; // null = never expires
  has_admin_full_access: boolean;
}

export const DEFAULT_MEMBERSHIP: MembershipState = {
  membership_tier: 'rookie',
  promo_code_used: null,
  promo_access_level: null,
  promo_access_started_at: null,
  promo_access_expires_at: null,
  has_admin_full_access: false,
};

const STORAGE_KEY = 'onlyfast_membership';

export function readMembership(_metadata?: Record<string, any> | null): MembershipState {
  // The argument is retained for existing callers, but is not trusted.
  return getTrustedMembership() || { ...DEFAULT_MEMBERSHIP };
}

export async function saveMembership(state: MembershipState, expectedUserId?: string): Promise<void> {
  if (expectedUserId) {
    let sameAccount = true;
    const { data: watcher } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== expectedUserId) sameAccount = false;
    });
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!sameAccount || session?.user.id !== expectedUserId) return;
      // Bind delayed subscription writes to the captured account's JWT. Calling
      // updateUser after an await could otherwise use a newly signed-in user's JWT.
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: state }),
      });
      if (!response.ok) throw new Error('Could not synchronize membership');
      const { data: current } = await supabase.auth.getSession();
      if (!sameAccount || current.session?.user.id !== expectedUserId) return;
      // Refresh only the currently signed-in session; never restore an old session.
      const refreshed = await supabase.auth.refreshSession();
      if (!sameAccount || refreshed.error || refreshed.data.session?.user.id !== expectedUserId) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* optional cache */ }
      return;
    } finally { watcher.subscription.unsubscribe(); }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  // If signed in, persist to user_metadata so it survives logout/login & devices
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user && (!expectedUserId || data.session.user.id === expectedUserId)) {
      await supabase.auth.updateUser({
        data: {
          ...(data.session.user.user_metadata || {}),
          ...state,
        },
      });
    }
  } catch {
    /* non-fatal — localStorage still holds the value */
  }
}

// ---------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------

export interface PromoResult {
  ok: boolean;
  message: string;
  state?: MembershipState;
}

// Promo/admin grants must be approved on the server, never minted by a public code.
export function applyPromoCode(_rawInput: string): PromoResult {
  return { ok: false, message: 'Redeem promotions through the supported checkout or contact OnlyFast support.' };
}

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------

export interface UserAccess {
  tier: MembershipTier;
  hasAdminFullAccess: boolean;
  promoAccessExpiresAt: string | null;
  limits: TierLimits;
}

// Resolve effective tier accounting for promo expiration.
export function getEffectiveTier(state: MembershipState): MembershipTier {
  // The explicitly flagged experimental account gets the top tier so existing
  // production feature/limit checks remain testable. Other users are unaffected.
  if (isCurrentUserTestAccount()) return 'team';
  if (state.has_admin_full_access) return 'team';
  if (
    state.promo_access_expires_at &&
    new Date(state.promo_access_expires_at) <= new Date()
  ) {
    // Promo lapsed — fall back to rookie
    return 'rookie';
  }
  return state.membership_tier || 'rookie';
}


export function getUserAccess(state: MembershipState): UserAccess {
  const tier = getEffectiveTier(state);
  return {
    tier,
    hasAdminFullAccess: state.has_admin_full_access === true,
    promoAccessExpiresAt: state.promo_access_expires_at,
    limits: tierLimits[tier],
  };
}

export function hasFeatureAccess(
  state: MembershipState,
  featureName: keyof TierLimits
): boolean {
  // Preserve the legacy full-access behavior only for the account explicitly
  // assigned test_account_full_access. Other users keep normal restrictions.
  if (isCurrentUserTestAccount()) return true;
  if (state.has_admin_full_access) return true;

  const access = getUserAccess(state);
  const value = access.limits[featureName];
  if (typeof value === 'boolean') return value;
  if (value === 'unlimited') return true;
  // numeric limits: presence of a positive limit means feature is available
  return typeof value === 'number' ? value > 0 : false;
}


// ---------------------------------------------------------------------------
// Centralized SAVE-PERMISSION helper
// ---------------------------------------------------------------------------
// Single place that decides whether a save is allowed for the user's tier,
// using the existing `tierLimits` values (no new limit numbers introduced).
//
// NOTE: pass the EFFECTIVE tier (from getEffectiveTier). Because the explicitly
// flagged experimental account and admin both resolve to 'team', this helper lets them
// bypass every restriction below — no special-casing required here.

export type SaveKind = 'race_weekend' | 'base_template';

export interface SavePermissionContext {
  /** Server-confirmed active class. Historical classes do not consume maxCars. */
  activeCarType?: string;
  /** Effective tier (already resolved via getEffectiveTier). */
  tier: MembershipTier;
  /** Which kind of save is being attempted. */
  kind: SaveKind;
  /** True when updating a save that already exists (not creating a new one). */
  isExistingSave: boolean;
  /** Distinct race-weekend saves already stored for this user. */
  existingRaceWeekendCount: number;
  /** Base-template setups already stored for this user. */
  existingBaseSetupCount: number;
  /** Distinct car types (race_class) already saved by this user. */
  existingCarTypes: string[];
  /** The car type (race_class) being saved now. */
  newCarType: string;
}

export interface SavePermission {
  allowed: boolean;
  reason: string;
  /** Upgrade-prompt copy to surface when blocked (empty when allowed). */
  upgradeText: string;
}

const ALLOWED: SavePermission = { allowed: true, reason: '', upgradeText: '' };

const normCar = (v: string) => (v || '').trim().toLowerCase();

/**
 * Decide whether the current save is permitted. Pure + synchronous so it is
 * easy to unit test and call from the real save flow.
 */
export function checkSavePermission(ctx: SavePermissionContext): SavePermission {
  const limits = tierLimits[ctx.tier];

  // --- Car-type lock (applies to every tier with a finite maxCars) ----------
  // This runs for BOTH new saves AND edits. We do NOT skip it on edits, because
  // an edit can switch an existing save to a *different* car type — which must
  // still be blocked once the account is locked to its first car type.
  //
  // Allowed when the new car type is one the user has already saved (same car,
  // any number of base/race-weekend saves) OR when there is still room under
  // the tier's maxCars. Comparison is normalized (trim + lowercase) so display
  // labels like "Dwarf Car" and "dwarf car" map to the same locked car type.
  if (typeof limits.maxCars === 'number') {
    const newCar = normCar(ctx.newCarType);
    if (ctx.activeCarType && newCar !== normCar(ctx.activeCarType)) {
      return { allowed: false, reason: 'car_type_locked', upgradeText: 'Locked — Switch back to this vehicle to access this setup.' };
    }
    const known = ctx.activeCarType ? [normCar(ctx.activeCarType)] : ctx.existingCarTypes.map(normCar).filter(Boolean);
    const distinct = new Set(known);
    const introducesNewCar = newCar !== '' && !distinct.has(newCar);
    if (introducesNewCar && distinct.size >= limits.maxCars) {
      if (ctx.tier === 'pro') {
        return {
          allowed: false,
          reason: 'car_type_locked',
          upgradeText:
            'Multiple car classes require Teams. Upgrade to Teams to manage unlimited cars and racing disciplines.',
        };
      }
      return {
        allowed: false,
        reason: 'car_type_locked',
        upgradeText:
          'Rookie accounts can only use 1 car type. Upgrade to Pro for unlimited setups, or Teams for multiple car types.',
      };
    }
  }


  // --- Count limits (only on NEW saves) -------------------------------------
  if (!ctx.isExistingSave) {
    if (ctx.kind === 'base_template' && typeof limits.maxBaseSetups === 'number') {
      if (ctx.existingBaseSetupCount >= limits.maxBaseSetups) {
        return {
          allowed: false,
          reason: 'base_setup_limit',
          upgradeText: `Rookie accounts can save ${limits.maxBaseSetups} base setup. Upgrade to Pro for unlimited base setups.`,
        };
      }
    }
    if (ctx.kind === 'race_weekend' && typeof limits.maxRaceWeekendSetups === 'number') {
      if (ctx.existingRaceWeekendCount >= limits.maxRaceWeekendSetups) {
        return {
          allowed: false,
          reason: 'race_weekend_limit',
          upgradeText: `Rookie accounts can keep ${limits.maxRaceWeekendSetups} race weekend saves. Upgrade to Pro for unlimited race weekends.`,
        };
      }
    }
  }

  return ALLOWED;
}

/**
 * Race-weekend EDIT lock. Rookie saves become uneditable after the tier's
 * `raceWeekendSetupLockHours` window, but remain viewable + deletable. Returns
 * true when the row may NOT be edited any longer.
 *
 * Pass the EFFECTIVE tier — pro/team have no lock window (null) so this always
 * returns false for them (and for test/admin which resolve to 'team').
 */
export function isRaceWeekendEditLocked(
  tier: MembershipTier,
  createdAtIso: string | null | undefined
): boolean {
  const lockHours = tierLimits[tier].raceWeekendSetupLockHours;
  if (lockHours == null) return false; // no lock for this tier
  if (!createdAtIso) return false;
  const created = new Date(createdAtIso).getTime();
  if (Number.isNaN(created)) return false;
  const ageHours = (Date.now() - created) / (1000 * 60 * 60);
  return ageHours >= lockHours;
}

// ---------------------------------------------------------------------------
// Centralized SETUP-ASSIST permission helper
// ---------------------------------------------------------------------------
// Decides whether the user may run another OnlyFast Setup Assist for the
// CURRENT race weekend, using the existing `setupAssistsPerRaceWeekend` tier
// limit. Pure + synchronous so it is easy to test and call from the AI flow.
//
// Pass the EFFECTIVE tier (from getEffectiveTier). Because the explicitly flagged
// experimental account and admin resolve to 'team' (which is 'unlimited'), they bypass this check
// automatically — no special-casing required. Pro is also 'unlimited'.

export interface SetupAssistPermission {
  allowed: boolean;
  reason: string;
  /** Upgrade-prompt copy to surface when blocked (empty when allowed). */
  upgradeText: string;
}

/**
 * @param tier       Effective tier (resolved via getEffectiveTier).
 * @param usedCount  How many Setup Assists this race weekend has already used.
 */
export function checkSetupAssistPermission(
  tier: MembershipTier,
  usedCount: number
): SetupAssistPermission {
  const limit = tierLimits[tier].setupAssistsPerRaceWeekend;

  // Unlimited tiers (Pro / Team / test / admin) are never blocked.
  if (limit === 'unlimited') {
    return { allowed: true, reason: '', upgradeText: '' };
  }

  const used = Number.isFinite(usedCount) && usedCount > 0 ? usedCount : 0;
  if (used >= limit) {
    return {
      allowed: false,
      reason: 'setup_assist_limit',
      upgradeText:
        'Rookie accounts include 1 OnlyFast Setup Assist per race weekend. Upgrade to Pro for unlimited Setup Assists.',
    };
  }

  return { allowed: true, reason: '', upgradeText: '' };
}
