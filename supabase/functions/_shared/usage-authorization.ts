// The service client is created only after verifying the request JWT.
export interface AuthorizationClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export type MembershipTier = 'rookie' | 'pro' | 'team' | 'sportsman' | 'factory';

export async function resolveServerMembership(admin: AuthorizationClient, user: { id: string; email?: string }): Promise<MembershipTier> {
  const { data, error } = await admin.rpc('onlyfast_membership_for_user', { p_user_id: user.id });
  if (error) throw new Error('Membership verification is unavailable. Please try again.');
  if (!['rookie', 'pro', 'team', 'sportsman', 'factory', 'admin'].includes(String(data))) throw new Error('Invalid membership authorization');
  // Preserve the existing server-configured endpoint administrator exemption.
  return data === 'admin' || endpointAdmin(user) ? 'team' : data as MembershipTier;
}

function endpointAdmin(user: { email?: string }): boolean {
  const email = (user.email || '').trim().toLowerCase();
  return !!email && (Deno.env.get('ONLYFAST_ADMIN_EMAILS') || '').split(',')
    .some(value => value.trim().toLowerCase() === email);
}

export interface UsageReservation {
  admin: AuthorizationClient;
  userId: string;
  feature: 'assist' | 'timing';
  requestId: string;
  token: string;
  finished: boolean;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export async function reserveUsage(admin: AuthorizationClient, user: { id: string; email?: string },
  feature: 'assist' | 'timing', body: Record<string, unknown>): Promise<{ reservation?: UsageReservation; response?: Record<string, unknown>; status: string }> {
  const requestId = body.request_id === undefined ? crypto.randomUUID() : String(body.request_id);
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId)) throw new Error('Invalid request ID');
  const payload = { ...body };
  delete payload.request_id;
  delete payload.race_weekend_key;
  delete payload.raceWeekendKey;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(payload))));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const { data, error } = await admin.rpc('onlyfast_reserve_usage', {
    p_user_id: user.id, p_feature: feature, p_request_id: requestId, p_fingerprint: fingerprint,
    p_setup_id: feature === 'assist' ? body.onlyfast_session_id || body.onlyfastSessionId || null : null,
    p_admin_override: endpointAdmin(user),
  });
  if (error) throw new Error('Could not authorize this saved session or usage. Please try again.');
  const result = data as { status?: string; token?: string; response?: unknown } | null;
  if (result?.status === 'reserved' && typeof result.token === 'string') {
    return { status: 'reserved', reservation: { admin, userId: user.id, feature, requestId, token: result.token, finished: false } };
  }
  if (result && ['complete', 'limit', 'pending', 'conflict'].includes(result.status || '')) {
    if (result.status === 'complete' && (!result.response || typeof result.response !== 'object' || Array.isArray(result.response))) {
      throw new Error('Invalid saved usage response');
    }
    return { status: result.status!, response: result.response as Record<string, unknown> | undefined };
  }
  throw new Error('Invalid usage authorization response');
}

export async function finishUsage(reservation: UsageReservation, response: unknown): Promise<void> {
  const { data, error } = await reservation.admin.rpc('onlyfast_finish_usage', {
    p_user_id: reservation.userId, p_feature: reservation.feature, p_request_id: reservation.requestId,
    p_token: reservation.token, p_response: response,
  });
  if (error || data !== true) throw new Error('Could not finalize this request. Retry the same request.');
  reservation.finished = true;
}

export async function releaseUsage(reservation: UsageReservation | null): Promise<void> {
  if (!reservation || reservation.finished) return;
  try {
    await finishUsage(reservation, null);
  } catch {
    // A crashed/partitioned worker cannot hold a slot beyond the database lease.
    console.error('[usage] reservation release unavailable');
  }
}
