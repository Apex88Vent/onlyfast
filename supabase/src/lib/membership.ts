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
  setupAssistsPerMonth: LimitValue;
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
    setupAssistsPerMonth: 2,
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
    setupAssistsPerMonth: 'unlimited',
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
    setupAssistsPerMonth: 'unlimited',
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
