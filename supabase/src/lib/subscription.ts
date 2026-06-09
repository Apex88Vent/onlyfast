// Subscription state derived from public.user_subscriptions (Stripe-backed).
// Single source of truth for paid access EXCEPT the admin override, which
// always unlocks everything regardless of Stripe status.

import { supabase } from '@/lib/supabase';
// TEST-ACCOUNT BYPASS (remove before production): grants test@test.com full access.
import { isCurrentUserTestAccount } from '@/lib/testAccount';
import {
  readMembership,
  saveMembership,
  DEFAULT_MEMBERSHIP,
  type MembershipTier,
} from '@/lib/membership';

export type SubscriptionPlan = 'free' | 'pro' | 'teams';

export interface UserSubscriptionRow {
  user_id: string;
  plan: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_checkout_session_id: string | null;
}

export interface AccountStatus {
  /** Display label for the account. */
  label: 'Free' | 'Pro' | 'Teams' | 'Admin';
  /** Normalized plan from Stripe (ignores admin override). */
  plan: SubscriptionPlan;
  /** Whether the user effectively has paid access (admin override included). */
  isPaid: boolean;
  /** True when the admin full-access override applies. */
  isAdmin: boolean;
  /** The raw row from user_subscriptions, if any. */
  row: UserSubscriptionRow | null;
}

const ACTIVE_STATUSES = ['active', 'trialing'];

/** Does the (plan,status) pair represent an active paid subscription? */
export function isActivePaidRow(row: UserSubscriptionRow | null): boolean {
  if (!row) return false;
  const plan = (row.plan || '').toLowerCase();
  const status = (row.status || '').toLowerCase();
  const isPaidPlan = plan === 'pro' || plan === 'teams';
  return isPaidPlan && ACTIVE_STATUSES.includes(status);
}

/** True when the RaeRae2020!!! admin override has been applied for this user. */
export function hasAdminOverride(metadata?: Record<string, any> | null): boolean {
  const m = readMembership(metadata);
  return m.has_admin_full_access === true;
}

/** Fetch the current user's subscription row (or null if none/not logged in). */
export async function fetchUserSubscription(
  userId?: string | null
): Promise<UserSubscriptionRow | null> {
  let uid = userId ?? null;
  if (!uid) {
    const { data } = await supabase.auth.getSession();
    uid = data?.session?.user?.id ?? null;
  }
  if (!uid) return null;

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_checkout_session_id')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[subscription] fetch error:', error.message);
    return null;
  }
  return (data as UserSubscriptionRow) ?? null;
}

/** Resolve the full account status for the logged-in user. */
export async function getAccountStatus(
  userId?: string | null,
  metadata?: Record<string, any> | null
): Promise<AccountStatus> {
  const row = await fetchUserSubscription(userId);
  return deriveAccountStatus(row, metadata);
}

/** Pure helper: map a row + metadata into an AccountStatus. */
export function deriveAccountStatus(
  row: UserSubscriptionRow | null,
  metadata?: Record<string, any> | null
): AccountStatus {
  // TEST-ACCOUNT BYPASS (remove before production): the dedicated demo account
  // (test@test.com) is treated as fully paid so every gate that checks `isPaid`
  // (e.g. the save → /pricing redirect) passes through. This does NOT create or
  // modify any Stripe/subscription record — it's a pure in-memory override that
  // only ever applies to test@test.com. Real users are completely unaffected.
  if (isCurrentUserTestAccount()) {
    return { label: 'Teams', plan: 'teams', isPaid: true, isAdmin: false, row };
  }

  const isAdmin = hasAdminOverride(metadata);

  if (isAdmin) {
    return { label: 'Admin', plan: 'teams', isPaid: true, isAdmin: true, row };
  }


  if (isActivePaidRow(row)) {
    const plan = (row!.plan || '').toLowerCase() === 'teams' ? 'teams' : 'pro';
    return {
      label: plan === 'teams' ? 'Teams' : 'Pro',
      plan,
      isPaid: true,
      isAdmin: false,
      row,
    };
  }

  return { label: 'Free', plan: 'free', isPaid: false, isAdmin: false, row };
}

/**
 * Bridge the Stripe subscription (public.user_subscriptions) into the existing
 * membership tier the rest of the app gates on, so paid access reflects Stripe.
 *
 * Rules (kept intentionally narrow to avoid disturbing other app logic):
 *   - Admin override (RaeRae2020!!!) is never touched — admin keeps everything.
 *   - An unexpired promo grant is preserved — Stripe inactivity won't remove it.
 *   - Otherwise the tier mirrors Stripe: pro/teams when active/trialing, else rookie.
 *
 * Returns the resolved AccountStatus (reflecting Stripe, ignoring promo bridge).
 */
export async function syncMembershipFromSubscription(): Promise<AccountStatus | null> {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return null;

  const meta = (user.user_metadata || {}) as Record<string, any>;
  const current = readMembership(meta);

  const row = await fetchUserSubscription(user.id);
  const status = deriveAccountStatus(row, meta);

  // Never override admin access.
  if (current.has_admin_full_access) return status;

  // Preserve an active (unexpired) promo grant.
  const promoActive =
    !!current.promo_access_level &&
    (!current.promo_access_expires_at ||
      new Date(current.promo_access_expires_at) > new Date());
  if (promoActive) return status;

  // Mirror Stripe into the membership tier when it differs.
  const desiredTier: MembershipTier = isActivePaidRow(row)
    ? (status.plan === 'teams' ? 'team' : 'pro')
    : 'rookie';

  if (current.membership_tier !== desiredTier) {
    await saveMembership({
      ...DEFAULT_MEMBERSHIP,
      membership_tier: desiredTier,
    });
  }

  return status;
}
