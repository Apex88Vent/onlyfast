// Subscription state derives from server-owned subscription rows and grants.

import { supabase } from '@/lib/supabase';
import { setTrustedAuthorization, clearTrustedMembership, invalidateAdvertisingMembership, getTrustedTestTier } from './trustedMembership';
import type { MembershipTier } from './membership';
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
  testTier?: MembershipTier | null;
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

export const TEST_TIER_SETUP_REQUIRED = 'Test subscription switching is unavailable because the required server update has not been applied. No change was confirmed. Please contact OnlyFast support.';

export function testTierServiceError(error: { code?: string; message?: string } | null): Error {
  if (['PGRST202', '42883', '42703'].includes(error?.code || '')) return new Error(TEST_TIER_SETUP_REQUIRED);
  if (error?.code === '42501') return new Error('This account is not authorized to select a test subscription. No tier was saved.');
  return new Error('Test tier could not be saved or confirmed. Please refresh and retry.');
}

/** Does the (plan,status) pair represent an active paid subscription? */
export function isActivePaidRow(row: UserSubscriptionRow | null): boolean {
  if (!row) return false;
  const plan = (row.plan || '').toLowerCase();
  const status = (row.status || '').toLowerCase();
  const isPaidPlan = plan === 'pro' || plan === 'teams' || plan === 'team';
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
  const testTier = getTrustedTestTier(row?.user_id);
  if (testTier) {
    return {
      label: testTier === 'rookie' ? 'Free' : testTier === 'pro' ? 'Pro' : 'Teams',
      plan: testTier === 'rookie' ? 'free' : testTier === 'team' ? 'teams' : 'pro',
      isPaid: testTier !== 'rookie', isAdmin: false, row, testTier,
    };
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
    const plan = ['team', 'teams'].includes((row!.plan || '').toLowerCase()) ? 'teams' : 'pro';
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

let refreshRevision = 0;
// A completed tier mutation invalidates older reads of the same account.
export function invalidatePendingMembershipRefresh() { refreshRevision++; }
/** Refresh the UI from server-owned subscription and grant records. */
export async function syncMembershipFromSubscription(): Promise<AccountStatus | null> {
  const revision = refreshRevision;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) { clearTrustedMembership(); return null; }
  clearTrustedMembership(user.id);
  invalidateAdvertisingMembership(user.id);
  const [row, verified, testOverride] = await Promise.all([
    fetchUserSubscription(user.id),
    supabase.auth.getUser(),
    supabase.rpc('get_onlyfast_test_tier'),
  ]);
  const { data: latest } = await supabase.auth.getSession();
  if (latest.session?.user.id !== user.id) return null;
  if (revision !== refreshRevision) return syncMembershipFromSubscription();
  if (verified.error || verified.data.user?.id !== user.id) throw new Error('Could not verify membership identity');
  if (testOverride.error) {
    if (['PGRST202', '42883', '42703'].includes(testOverride.error.code)) {
      // A server without the required schema cannot confirm a cached test tier.
      if (getTrustedTestTier(user.id)) clearTrustedMembership();
      throw testTierServiceError(testOverride.error);
    }
    throw testOverride.error;
  }
  const testTier = testOverride.data;
  if (testTier !== null && !['rookie', 'pro', 'team'].includes(testTier)) throw new Error('Invalid test membership');
  setTrustedAuthorization(user.id, row, verified.data.user.app_metadata || {}, testTier);
  return deriveAccountStatus(row);
}
