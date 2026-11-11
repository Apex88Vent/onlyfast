import { supabase, supabaseUrl, supabaseKey } from './supabase';
import { syncMembershipFromSubscription, invalidatePendingMembershipRefresh, testTierServiceError } from './subscription';
import type { MembershipTier } from './membership';

export async function selectTestTier(userId: string, tier: MembershipTier): Promise<MembershipTier> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session?.user.id !== userId) throw new Error('Your account changed. Please sign in again.');
  // Pin the mutation to this account's token across any intervening auth change.
  // The RPC accepts no identity or authorization from the browser.
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/set_onlyfast_test_tier`, {
    method: 'POST',
    headers: { apikey: supabaseKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_tier: tier }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw testTierServiceError(result);
  if (result !== tier) throw new Error('The server did not confirm the requested test tier. Please refresh and retry.');
  invalidatePendingMembershipRefresh();
  const current = await supabase.auth.getSession();
  if (current.data.session?.user.id !== userId) throw new Error('Your account changed. Please sign in again.');
  const status = await syncMembershipFromSubscription();
  if (status?.testTier !== tier) throw new Error('Test tier could not be confirmed. Refresh to retry.');
  return status.testTier;
}
