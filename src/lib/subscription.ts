// Subscription state derives from server-owned subscription rows and grants.

import { supabase } from '@/lib/supabase';
import { setTrustedAuthorization, clearTrustedMembership } from './trustedMembership';
// The disposable experimental account can retain its legacy full-access mode
// through an explicit account-level feature flag.
import { isCurrentUserTestAccount } from '@/lib/testAccount';
import {
  readMembership,
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
  subscription_source?: string | null;
  revenuecat_expires_at?: string | null;
  revenuecat_store?: string | null;
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
  const expiredNative = row.subscription_source === 'revenuecat' && (!row.revenuecat_expires_at || Date.parse(row.revenuecat_expires_at) <= Date.now() || !Number.isFinite(Date.parse(row.revenuecat_expires_at)));
  return isPaidPlan && ACTIVE_STATUSES.includes(status) && !expiredNative;
}

/** True only for a server-approved administrator grant. */
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
    .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_checkout_session_id, subscription_source, revenuecat_expires_at, revenuecat_store')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[subscription] fetch error:', error.message);
    throw error;
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
  // The explicitly flagged experimental account is treated as fully paid so
  // every gate that checks `isPaid`
  // (e.g. the save → /pricing redirect) passes through. This does NOT create or
  // modify any Stripe/subscription record — it's a pure in-memory override that
  // only applies to that stored Auth user ID. Other users are unaffected.
  if (isCurrentUserTestAccount()) {
    return { label: 'Teams', plan: 'teams', isPaid: true, isAdmin: false, row };
  }

  const access = readMembership();
  const isAdmin = access.has_admin_full_access;

  if (isAdmin) {
    return { label: 'Admin', plan: 'teams', isPaid: true, isAdmin: true, row };
  }


  const promoActive = !!access.promo_access_level && (!access.promo_access_expires_at || Date.parse(access.promo_access_expires_at) > Date.now());
  if (promoActive && (access.membership_tier === 'pro' || access.membership_tier === 'team')) {
    const team = access.membership_tier === 'team';
    return { label: team ? 'Teams' : 'Pro', plan: team ? 'teams' : 'pro', isPaid: true, isAdmin: false, row };
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

/** Refresh the UI from server-owned subscription and grant records. */
export async function syncMembershipFromSubscription(): Promise<AccountStatus | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) { clearTrustedMembership(); return null; }
  clearTrustedMembership(user.id);
  const [row, verified] = await Promise.all([
    fetchUserSubscription(user.id),
    supabase.auth.getUser(),
  ]);
  const { data: latest } = await supabase.auth.getSession();
  if (latest.session?.user.id !== user.id) return null;
  if (verified.error || verified.data.user?.id !== user.id) throw new Error('Could not verify membership identity');
  setTrustedAuthorization(user.id, row, verified.data.user.app_metadata || {});
  return deriveAccountStatus(row);
}
