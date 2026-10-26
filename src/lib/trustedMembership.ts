import type { MembershipState } from './membership';

type Subscription = { plan: string | null; status: string | null; subscription_source?: string | null; revenuecat_expires_at?: string | null };
type Grants = Record<string, unknown>;
const empty: MembershipState = { membership_tier: 'rookie', promo_code_used: null, promo_access_level: null,
  promo_access_started_at: null, promo_access_expires_at: null, has_admin_full_access: false };

// Inputs must come from an authenticated database read and auth.getUser().app_metadata.
// Neither browser storage nor user_metadata participates in permission decisions.
export function resolveAuthorizedMembership(row: Subscription | null, grants: Grants = {}, now = Date.now()): MembershipState {
  if (grants.has_admin_full_access === true) return { ...empty, membership_tier: 'team', has_admin_full_access: true };
  const nativeActive = row?.subscription_source !== 'revenuecat' ||
    (typeof row.revenuecat_expires_at === 'string' && Date.parse(row.revenuecat_expires_at) > now);
  const paid = nativeActive && ['active', 'trialing'].includes(row?.status?.toLowerCase() || '');
  const paidTier = paid && ['teams', 'team'].includes(row?.plan?.toLowerCase() || '') ? 'team' : paid && row?.plan?.toLowerCase() === 'pro' ? 'pro' : 'rookie';
  const expiration = typeof grants.promo_access_expires_at === 'string' && grants.promo_access_expires_at ? grants.promo_access_expires_at : null;
  const level = !expiration || Date.parse(expiration) > now ? String(grants.promo_access_level || '').toLowerCase() : '';
  const grantTier = ['team', 'teams', 'admin', 'admin_full_access'].includes(level) ? 'team' : level === 'pro' ? 'pro' : 'rookie';
  const grantWins = grantTier === 'team' && paidTier !== 'team' || grantTier === 'pro' && paidTier === 'rookie';
  return grantWins ? { ...empty, membership_tier: grantTier, promo_access_level: level, promo_access_expires_at: expiration } :
    { ...empty, membership_tier: paidTier };
}

let activeUser: string | null = null;
let authorization: { row: Subscription | null; grants: Grants } | null = null;
// Advertising may fail closed without changing subscription entitlement behavior.
export const AD_AUTHORIZATION_MAX_AGE_MS = 5 * 60 * 1000;
let advertisingVerifiedAt: number | null = null;
let revision = 0;
export function getMembershipRevision() { return revision; }
// Publish a time-based change even when a renewal lookup is offline. Every
// reader recomputes expiration from the original server-authorized records.
export function notifyMembershipExpiration() { changed(); }
function changed() {
  revision++;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('membership-updated'));
}
export function clearTrustedMembership(userId: string | null = null) {
  if (activeUser === userId && userId !== null) return;
  activeUser = userId;
  authorization = null;
  advertisingVerifiedAt = null;
  changed();
}
export function setTrustedAuthorization(userId: string, row: Subscription | null, grants: Grants) {
  activeUser = userId;
  authorization = { row: row ? { ...row } : null, grants: { ...grants } };
  advertisingVerifiedAt = Date.now();
  changed();
}
export function getTrustedMembership(): MembershipState | null {
  return authorization ? resolveAuthorizedMembership(authorization.row, authorization.grants) : null;
}

/** Invalidate only advertising evidence while a membership refresh is pending. */
export function invalidateAdvertisingMembership(userId: string | null) {
  if (activeUser !== userId || advertisingVerifiedAt === null) return;
  advertisingVerifiedAt = null;
  changed();
}

export function getAdvertisingAuthorizationExpiry(): number | null {
  return advertisingVerifiedAt === null ? null : advertisingVerifiedAt + AD_AUTHORIZATION_MAX_AGE_MS;
}

/** Never substitute the default Rookie tier for missing, stale or another user's evidence. */
export function getTrustedAdvertisingMembership(userId: string, now = Date.now()): MembershipState | null {
  if (!userId || activeUser !== userId || !authorization || advertisingVerifiedAt === null ||
      now < advertisingVerifiedAt || now >= advertisingVerifiedAt + AD_AUTHORIZATION_MAX_AGE_MS) return null;
  // Preserve every server-authorized promotional exemption, including ambassador
  // grants that do not confer a subscription tier. Never consult user_metadata.
  if (authorization.grants.promo_access_level) return null;
  if (authorization.row && !['free', 'rookie', 'pro', 'team', 'teams'].includes(
    authorization.row.plan?.toLowerCase() || '')) return null;
  return resolveAuthorizedMembership(authorization.row, authorization.grants, now);
}

export function getMembershipExpiration(): number | null {
  if (!authorization) return null;
  const values = [authorization.row?.subscription_source === 'revenuecat' ? authorization.row.revenuecat_expires_at : null,
    authorization.grants.promo_access_expires_at];
  const future = values.filter((value): value is string => typeof value === 'string')
    .map(Date.parse).filter(value => Number.isFinite(value) && value > Date.now());
  return future.length ? Math.min(...future) : null;
}
