// This is a build mode, never a URL/localStorage switch. Purchases remain held
// until Median can supply a named offering and localized, eligible store terms.
export { NATIVE_PURCHASES_READY } from './nativePurchaseController.ts';
export const NATIVE_TEST_FEATURE = 'native_subscription_testing';

export function assertLocalSandboxConfiguration(mode: string, url?: string, key?: string): void {
  if (mode !== 'native-sandbox') throw new Error('Use the isolated native-sandbox build.');
  if (!url || !key) throw new Error('Explicit local Supabase URL and public key are required.');
  const endpoint = new URL(url);
  const host = endpoint.hostname;
  const octets = host.split('.').map(Number);
  const privateIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host) &&
    octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  if (!['http:', 'https:'].includes(endpoint.protocol) ||
      !(['localhost', '127.0.0.1', '[::1]'].includes(host) || privateIPv4) ||
      endpoint.port !== '54321' || endpoint.pathname !== '/' || endpoint.search || endpoint.hash ||
      endpoint.username || endpoint.password) {
    throw new Error('Sandbox builds require local Supabase on port 54321; cloud endpoints are refused.');
  }
  let publicKey = key.startsWith('sb_publishable_');
  try {
    const payload = key.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    publicKey ||= JSON.parse(atob(payload)).role === 'anon';
  } catch { /* Unknown or secret keys fail closed. */ }
  if (!publicKey) throw new Error('Use a local anonymous/public key, never a service-role key.');
}

type TesterAccount = { is_test_account: boolean; beta_features_enabled: boolean; tester_kind: string };
type Flag = { feature_key: string; enabled: boolean };
export interface SandboxAuthorizationSource {
  user(): Promise<string | null>;
  account(userId: string): Promise<TesterAccount | null>;
  flags(userId: string): Promise<Flag[]>;
}

// The caller reads these records through authenticated own-row RLS. Only the
// server/operator can write tester assignments; metadata and local caches are unused.
export async function authorizeSandboxTester(source: SandboxAuthorizationSource): Promise<string> {
  const userId = await source.user();
  if (!userId) throw new Error('Sign in with a synthetic local tester account first.');
  const [account, flags] = await Promise.all([source.account(userId), source.flags(userId)]);
  if (account?.is_test_account !== true || account.beta_features_enabled !== true ||
      account.tester_kind !== 'experimental' ||
      !flags.some(f => f.feature_key === NATIVE_TEST_FEATURE && f.enabled === true) ||
      flags.some(f => f.feature_key === 'test_account_full_access' && f.enabled === true)) {
    throw new Error('An explicitly authorized experimental tester without full-access overrides is required.');
  }
  if (await source.user() !== userId) throw new Error('Your account changed. Check again.');
  return userId;
}

const BRIDGE_METHODS = ['configure', 'isInitialized', 'login', 'logout', 'getOfferings',
  'purchase', 'restorePurchases', 'presentPaywall'] as const;

export const DIAGNOSTIC_OFFERING = 'onlyfast_monthly_v1';
export type BridgeCallDiagnostic = {
  method: 'isInitialized' | 'getOfferings';
  status: 'returned' | 'rejected' | 'timed_out' | 'missing';
  durationMs: number;
  response?: unknown;
  error?: unknown;
};
export type CatalogEvidence = {
  identifiers: { path: string; value: unknown }[];
  packages: { path: string; value: unknown }[];
  products: { path: string; value: unknown }[];
  pricesAndTerms: { path: string; value: unknown }[];
  requestedIdentifierLocations: string[];
};
export type MedianBridgeDiagnostic = {
  capturedAt: string;
  initialized: boolean | null;
  methods: string[];
  calls: BridgeCallDiagnostic[];
  catalog: CatalogEvidence;
  requestedOffering: string;
  selectionSupport: 'not_exposed_by_documented_interface';
};

// Preserve unknown native response shapes rather than forcing an SDK schema.
// Hide credential/identity fields when the operator copies a diagnostic report.
export function diagnosticValue(input: unknown): unknown {
  const seen = new WeakSet<object>();
  return JSON.parse(JSON.stringify(input, (key, value) => {
    if (/^(api_?key|authorization|access_?token|refresh_?token|receipt|app_?user_?id)$/i.test(key)) return '[redacted]';
    if (value instanceof Error) return { ...value, name: value.name, message: value.message };
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'undefined') return '[undefined]';
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[circular/shared reference]';
      seen.add(value);
    }
    return value;
  }));
}

export function catalogEvidence(response: unknown): CatalogEvidence {
  const evidence: CatalogEvidence = { identifiers: [], packages: [], products: [], pricesAndTerms: [], requestedIdentifierLocations: [] };
  const visit = (value: unknown, path: string) => {
    if (value === DIAGNOSTIC_OFFERING) evidence.requestedIdentifierLocations.push(path);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}[${JSON.stringify(key)}]`;
      if (key === DIAGNOSTIC_OFFERING) evidence.requestedIdentifierLocations.push(childPath);
      if (/^(identifier|identifiers|offeringIdentifier|offering_identifier|offerings|lookup_key|lookupKey)$/i.test(key)) evidence.identifiers.push({ path: childPath, value: child });
      if (/^(packages|availablePackages|package|packageIdentifier|package_identifier)$/i.test(key)) evidence.packages.push({ path: childPath, value: child });
      if (/^(products|product|storeProduct|storeProducts|productIdentifier|product_identifier)$/i.test(key)) evidence.products.push({ path: childPath, value: child });
      if (/price|currency|trial|introductory|billingPeriod|subscriptionPeriod|subscription_period|offerToken/i.test(key)) evidence.pricesAndTerms.push({ path: childPath, value: child });
      visit(child, childPath);
    }
  };
  visit(response, '$');
  return evidence;
}

// Diagnostic only. These are the two documented, zero-argument read methods.
// Never configure/login/logout, purchase, restore, present a paywall or grant
// membership. The caller must revalidate local tester authorization per call.
export async function inspectMedianBridge(bridge: unknown, beforeCall: () => Promise<void>): Promise<MedianBridgeDiagnostic> {
  if (!bridge || typeof bridge !== 'object') throw new Error('Median RevenueCat bridge is absent.');
  const api = bridge as Record<string, unknown>;
  const methods = [...new Set([...BRIDGE_METHODS, ...Object.keys(api)])]
    .filter(method => typeof api[method] === 'function').sort();
  const calls: BridgeCallDiagnostic[] = [];
  for (const method of ['isInitialized', 'getOfferings'] as const) {
    // An authorization failure stops the sequence, including after an earlier
    // native response. It is not misreported as a store/bridge error.
    await beforeCall();
    if (typeof api[method] !== 'function') {
      calls.push({ method, status: 'missing', durationMs: 0 });
      continue;
    }
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let timedOut = false;
    try {
      const response = await Promise.race([
        Promise.resolve().then(() => (api[method] as () => unknown).call(bridge)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { timedOut = true; reject(new Error(`${method} did not respond.`)); }, method === 'getOfferings' ? 20_000 : 8000);
        }),
      ]);
      calls.push({ method, status: 'returned', durationMs: Date.now() - started, response: diagnosticValue(response) });
    } catch (error) {
      calls.push({ method, status: timedOut ? 'timed_out' : 'rejected', durationMs: Date.now() - started, error: diagnosticValue(error) });
    } finally { clearTimeout(timer!); }
  }
  const state = calls.find(call => call.method === 'isInitialized')?.response;
  const initialized = state && typeof state === 'object' && 'initialized' in state && typeof state.initialized === 'boolean' ? state.initialized : null;
  return {
    capturedAt: new Date().toISOString(), initialized, methods, calls,
    catalog: catalogEvidence(calls.find(call => call.method === 'getOfferings')?.response),
    requestedOffering: DIAGNOSTIC_OFFERING, selectionSupport: 'not_exposed_by_documented_interface',
  };
}
