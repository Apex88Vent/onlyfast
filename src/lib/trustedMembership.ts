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
let revision = 0;
export function getMembershipRevision() { return revision; }
function changed() {
  revision++;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('membership-updated'));
}
export function clearTrustedMembership(userId: string | null = null) {
  if (activeUser === userId && userId !== null) return;
  activeUser = userId;
  authorization = null;
  changed();
}
export function setTrustedAuthorization(userId: string, row: Subscription | null, grants: Grants) {
  activeUser = userId;
  authorization = { row: row ? { ...row } : null, grants: { ...grants } };
  changed();
}
export function getTrustedMembership(): MembershipState | null {
  return authorization ? resolveAuthorizedMembership(authorization.row, authorization.grants) : null;
}
