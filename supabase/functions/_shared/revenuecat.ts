// RevenueCat REST v1 subscriber snapshots. No client-supplied entitlement data.
export type RevenueCatConfig = {
  apiKey: string;
  proEntitlement: string;
  teamEntitlement: string;
  allowSandbox: boolean;
  allowAppleSandbox?: boolean;
};

type Entitlement = { product_identifier: string; expires_date: string | null; grace_period_expires_date?: string | null };
type StoreSubscription = {
  store: string; is_sandbox: boolean; refunded_at?: string | null;
  expires_date: string | null; grace_period_expires_date?: string | null;
  store_transaction_id?: string | number | null;
};
export type SubscriberResponse = {
  request_date_ms: number;
  subscriber: { entitlements: Record<string, Entitlement>; subscriptions: Record<string, StoreSubscription> };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const appleProducts: Record<string, string> = {
  pro: 'app.onlyfast.pro.monthly', teams: 'app.onlyfast.teams.monthly',
};

function isVerifiedAppleSandboxProduct(product: string, plan: string, subscription: StoreSubscription): boolean {
  const transaction = subscription.store_transaction_id;
  const matchesPlan = appleProducts[plan] === product || (plan === 'pro' && product === appleProducts.teams);
  return subscription.store === 'app_store' && subscription.is_sandbox === true && matchesPlan &&
    ((typeof transaction === 'string' && transaction.trim().length > 0) ||
     (typeof transaction === 'number' && Number.isSafeInteger(transaction) && transaction > 0));
}

export function mapRevenueCatSnapshot(body: SubscriberResponse, config: RevenueCatConfig, now = Date.now()) {
  if (!isRecord(body?.subscriber?.entitlements) || !isRecord(body.subscriber.subscriptions) ||
      !Number.isSafeInteger(body.request_date_ms) || body.request_date_ms < 0 || body.request_date_ms > now + 300_000) {
    throw new Error('Invalid RevenueCat subscriber response');
  }
  const candidates = [
    { id: config.teamEntitlement, plan: 'teams' },
    { id: config.proEntitlement, plan: 'pro' },
  ];
  const active: Array<{ id: string; sandbox: boolean; plan: string; status: string; product_id: string; store: string; expires_at: string; observed_at: string }> = [];
  for (const candidate of candidates) {
    const entitlement = body.subscriber.entitlements[candidate.id];
    if (entitlement === undefined) continue;
    if (!isRecord(entitlement) || typeof entitlement.product_identifier !== 'string') {
      throw new Error('Invalid RevenueCat entitlement');
    }
    const subscription = body.subscriber.subscriptions[entitlement.product_identifier];
    if (!subscription || !['app_store', 'play_store'].includes(subscription.store)) continue;
    if (typeof subscription.is_sandbox !== 'boolean') throw new Error('Invalid RevenueCat store environment');
    if (subscription.is_sandbox && !config.allowSandbox &&
        !(config.allowAppleSandbox && isVerifiedAppleSandboxProduct(entitlement.product_identifier, candidate.plan, subscription))) continue;
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
    active.push({
      id: candidate.id, sandbox: subscription.is_sandbox,
      plan: candidate.plan, status: 'active', product_id: entitlement.product_identifier,
      store: subscription.store,
      expires_at: new Date(expires).toISOString(),
      observed_at: new Date(body.request_date_ms).toISOString(),
    });
  }
  // An existing live subscription always takes precedence over sandbox access.
  // Within either environment, Teams retains its existing precedence over Pro.
  const production = active.filter(item => !item.sandbox);
  const grants = production.length ? production : active;
  if (grants.length) {
    const { id: _id, sandbox: _sandbox, ...selected } = grants[0];
    return { ...selected, entitlement_ids: grants.map(item => item.id) };
  }
  return { plan: 'free', status: 'expired', product_id: null, entitlement_ids: [],
    store: null, expires_at: null, observed_at: new Date(body.request_date_ms).toISOString() };
}

export function revenueCatConfig(env: (key: string) => string | undefined): RevenueCatConfig {
  const apiKey = env('REVENUECAT_SECRET_API_KEY');
  const proEntitlement = env('REVENUECAT_PRO_ENTITLEMENT_ID') || 'OnlyFast Pro';
  const teamEntitlement = env('REVENUECAT_TEAM_ENTITLEMENT_ID') || 'OnlyFast Teams';
  if (!apiKey || proEntitlement === teamEntitlement) throw new Error('RevenueCat configuration missing or invalid');
  // App Review uses genuine Apple sandbox purchases. Only the exact products
  // above, fetched with the server secret from RevenueCat, qualify for this path.
  // The broad sandbox switch remains separate; Google Play behavior is unchanged.
  return { apiKey, proEntitlement, teamEntitlement, allowSandbox: env('REVENUECAT_ALLOW_SANDBOX') === 'true', allowAppleSandbox: true };
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
