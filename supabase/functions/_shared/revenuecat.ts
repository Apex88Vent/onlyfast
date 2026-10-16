// RevenueCat REST v1 subscriber snapshots. No client-supplied entitlement data.
export type RevenueCatConfig = {
  apiKey: string;
  proEntitlement: string;
  teamEntitlement: string;
  allowSandbox: boolean;
};

type Entitlement = { product_identifier: string; expires_date: string | null; grace_period_expires_date?: string | null };
type StoreSubscription = {
  store: string; is_sandbox: boolean; refunded_at?: string | null;
  expires_date: string | null; grace_period_expires_date?: string | null;
};
export type SubscriberResponse = {
  request_date_ms: number;
  subscriber: { entitlements: Record<string, Entitlement>; subscriptions: Record<string, StoreSubscription> };
};

export function mapRevenueCatSnapshot(body: SubscriberResponse, config: RevenueCatConfig, now = Date.now()) {
  if (!body?.subscriber?.entitlements || !body.subscriber.subscriptions ||
      !Number.isFinite(body.request_date_ms) || body.request_date_ms > now + 300_000) {
    throw new Error('Invalid RevenueCat subscriber response');
  }
  const candidates = [
    { id: config.teamEntitlement, plan: 'teams' },
    { id: config.proEntitlement, plan: 'pro' },
  ];
  const activeEntitlementIds: string[] = [];
  let selected: { plan: string; status: string; product_id: string; store: string; expires_at: string; observed_at: string } | null = null;
  for (const candidate of candidates) {
    const entitlement = body.subscriber.entitlements[candidate.id];
    if (!entitlement) continue;
    const subscription = body.subscriber.subscriptions[entitlement.product_identifier];
    if (!subscription || !['app_store', 'play_store'].includes(subscription.store)) continue;
    if (subscription.is_sandbox !== false && !config.allowSandbox) continue;
    if (subscription.refunded_at) continue;
    // Only recurring store subscriptions are supported. Missing/null expiration
    // never becomes a lifetime grant. Grace keeps access until its actual end.
    const dates = [entitlement.expires_date, entitlement.grace_period_expires_date,
      subscription.grace_period_expires_date].filter((v): v is string => !!v);
    if (!dates.length || dates.some(date => !Number.isFinite(Date.parse(date)))) {
      throw new Error('Invalid subscription expiration');
    }
    const expires = Math.max(...dates.map(Date.parse));
    if (expires <= now) continue;
    activeEntitlementIds.push(candidate.id);
    selected ??= {
      plan: candidate.plan, status: 'active', product_id: entitlement.product_identifier,
      store: subscription.store,
      expires_at: new Date(expires).toISOString(),
      observed_at: new Date(body.request_date_ms).toISOString(),
    };
  }
  if (selected) return { ...selected, entitlement_ids: activeEntitlementIds };
  return { plan: 'free', status: 'expired', product_id: null, entitlement_ids: [],
    store: null, expires_at: null, observed_at: new Date(body.request_date_ms).toISOString() };
}

export function revenueCatConfig(env: (key: string) => string | undefined): RevenueCatConfig {
  const apiKey = env('REVENUECAT_SECRET_API_KEY');
  const proEntitlement = env('REVENUECAT_PRO_ENTITLEMENT_ID') || 'OnlyFast Pro';
  const teamEntitlement = env('REVENUECAT_TEAM_ENTITLEMENT_ID') || 'OnlyFast Teams';
  if (!apiKey || proEntitlement === teamEntitlement) throw new Error('RevenueCat configuration missing or invalid');
  return { apiKey, proEntitlement, teamEntitlement, allowSandbox: env('REVENUECAT_ALLOW_SANDBOX') === 'true' };
}

export async function fetchRevenueCatSnapshot(userId: string, config: RevenueCatConfig) {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${config.apiKey}` }, signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`RevenueCat returned ${response.status}`);
  return mapRevenueCatSnapshot(await response.json(), config);
}

export function webhookUserIds(event: Record<string, unknown>): string[] {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Transfer events reconcile BOTH accounts. Never grant a single event's plan
  // to all aliases: every UUID is fetched independently from RevenueCat.
  const values = event.type === 'TRANSFER'
    ? [...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
       ...(Array.isArray(event.transferred_to) ? event.transferred_to : [])]
    : [event.app_user_id, event.original_app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : [])];
  const ids = [...new Set(values.filter((value): value is string => typeof value === 'string' && uuid.test(value)))].sort();
  if (event.type !== 'TRANSFER' && ids.length > 1) {
    throw new Error('Multiple OnlyFast accounts are aliased in RevenueCat; resolve identity before retrying');
  }
  return ids;
}

export function authorizationMatches(actual: string, expected: string): boolean {
  if (!expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
