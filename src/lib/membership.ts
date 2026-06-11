// Membership tier logic, limits, promo codes, and persistence helpers.
// Single source of truth for OnlyFast membership/plan gating.

import { supabase } from '@/lib/supabase';
// TEST-ACCOUNT BYPASS (remove before production): grants test@test.com full access.
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
  synopsis: string[];
}

export const PLANS: PlanMeta[] = [
  {
    tier: 'rookie',
    displayName: 'Rookie',
    priceDisplay: 'Free',
    buttonText: 'Start Free',
    synopsis: [
      '1 car, 1 base setup',
      '2 race weekend setups (lock after 48h)',
      '2 timing uploads & 2 setup assists / month',
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
    synopsis: [
      'No ads — built for one car',
      'Unlimited base & race weekend setups',
      'Unlimited timing uploads & setup assists',
      'Setup export, full history & leaderboard badges',
    ],
  },
  {
    tier: 'team',
    displayName: 'Team',
    priceDisplay: '$8/month',
    buttonText: 'Choose Team',
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
  teams: 'buy_btn_1TdzxeGEWZrPYXmKRORftUys',
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

export function readMembership(metadata?: Record<string, any> | null): MembershipState {
  // Prefer Supabase user_metadata when provided (authoritative across devices)
  if (metadata && (metadata.membership_tier || metadata.has_admin_full_access)) {
    return {
      membership_tier: (metadata.membership_tier as MembershipTier) || 'rookie',
      promo_code_used: metadata.promo_code_used ?? null,
      promo_access_level: metadata.promo_access_level ?? null,
      promo_access_started_at: metadata.promo_access_started_at ?? null,
      promo_access_expires_at: metadata.promo_access_expires_at ?? null,
      has_admin_full_access: metadata.has_admin_full_access === true,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_MEMBERSHIP, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_MEMBERSHIP };
}

export async function saveMembership(state: MembershipState): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  // If signed in, persist to user_metadata so it survives logout/login & devices
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
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

interface PromoDef {
  // normalized (lowercase, trimmed) match key
  match: string;
  caseSensitive?: boolean;
  apply: () => MembershipState;
  success: string;
}

function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

const PROMO_DEFS: PromoDef[] = [
  {
    match: 'launch26',
    apply: () => ({
      membership_tier: 'pro',
      promo_code_used: 'Launch26',
      promo_access_level: 'pro',
      promo_access_started_at: new Date().toISOString(),
      promo_access_expires_at: monthsFromNow(3),
      has_admin_full_access: false,
    }),
    success: 'Launch promo accepted. Pro unlocked for 3 months.',
  },
  {
    match: 'ambassador2026',
    apply: () => ({
      membership_tier: 'pro',
      promo_code_used: 'Ambassador2026',
      promo_access_level: 'pro',
      promo_access_started_at: new Date().toISOString(),
      promo_access_expires_at: monthsFromNow(12),
      has_admin_full_access: false,
    }),
    success: 'Ambassador promo accepted. Pro unlocked for 12 months.',
  },
  {
    // Admin / full-access code — kept case-sensitive for security
    match: 'RaeRae2020!!!',
    caseSensitive: true,
    apply: () => ({
      membership_tier: 'team',
      promo_code_used: 'RaeRae2020!!!',
      promo_access_level: 'admin_full_access',
      promo_access_started_at: new Date().toISOString(),
      promo_access_expires_at: null,
      has_admin_full_access: true,
    }),
    success: 'Admin access unlocked.',
  },
];

export function applyPromoCode(rawInput: string): PromoResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return { ok: false, message: 'That promo code is not valid.' };
  }
  const lower = trimmed.toLowerCase();

  const def = PROMO_DEFS.find((p) =>
    p.caseSensitive ? p.match === trimmed : p.match === lower
  );

  if (!def) {
    return { ok: false, message: 'That promo code is not valid.' };
  }

  const state = def.apply();

  // Expiration check (codes are time-based — verify not already expired)
  if (state.promo_access_expires_at && new Date(state.promo_access_expires_at) <= new Date()) {
    return { ok: false, message: 'That promo code has expired.' };
  }

  return { ok: true, message: def.success, state };
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
  // TEST-ACCOUNT BYPASS (remove before production): test@test.com always gets
  // the top tier so every feature/limit is unlocked. Real users unaffected.
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
  // TEST-ACCOUNT BYPASS (remove before production): unlock every feature flag
  // for test@test.com only. Real users keep their normal restrictions.
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
// NOTE: pass the EFFECTIVE tier (from getEffectiveTier). Because test@test.com
// and admin both resolve to 'team' there, this helper automatically lets them
// bypass every restriction below — no special-casing required here.

export type SaveKind = 'race_weekend' | 'base_template';

export interface SavePermissionContext {
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
    const known = ctx.existingCarTypes.map(normCar).filter(Boolean);
    const distinct = new Set(known);
    const introducesNewCar = newCar !== '' && !distinct.has(newCar);
    if (introducesNewCar && distinct.size >= limits.maxCars) {
      if (ctx.tier === 'pro') {
        return {
          allowed: false,
          reason: 'car_type_locked',
          upgradeText:
            'Pro accounts are limited to one racecar type. Upgrade to Teams to save setups for multiple car types.',
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
// Pass the EFFECTIVE tier (from getEffectiveTier). Because test@test.com and
// admin both resolve to 'team' (which is 'unlimited'), they bypass this check
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