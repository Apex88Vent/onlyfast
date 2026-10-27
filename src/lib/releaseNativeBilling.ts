// Preserved custom-bridge development; production uses the stock Median paywall.
// See native/README.md before using or wiring this adapter into an application.
import { NativePurchaseError } from './nativePurchaseController.ts';

export const RELEASE_BILLING_PROTOCOL = 1;
export const ONLYFAST_OFFERING = 'onlyfast_monthly_v1';
export type StorePlan = 'pro' | 'teams';
export type BillingSession = { userId: string; accessToken: string };
export type StorePhase = { billingPeriod: string; billingCycleCount: number | null; recurrenceMode: string;
  price: { formatted: string; amountMicros: number; currencyCode: string } };
export type StorePackage = { plan: StorePlan; packageIdentifier: string; productIdentifier: string;
  formattedPrice: string; currencyCode: string; billingPeriod: string; optionIdentifier: string | null;
  pricingPhases: StorePhase[]; trialEligibility: 'unknown' | 'eligible' | 'ineligible'; eligibilityNote: string };
export type StoreCatalog = { offeringIdentifier: string; catalogToken: string; expiresAt: number; packages: StorePackage[] };
export type BillingRequest = { operation: 'capabilities' | 'identify' | 'catalog' | 'purchase' | 'restore' | 'clear' | 'invalidate';
  protocolVersion: number; expectedUserId?: string; accessToken?: string; offeringIdentifier?: string;
  plan?: StorePlan; packageIdentifier?: string; productIdentifier?: string; catalogToken?: string };
export type BillingReply = { protocolVersion: number; status: 'ok' | 'purchased' | 'restored' | 'cancelled' | 'pending' | 'error';
  appUserId?: string; platform?: 'android' | 'ios'; transactionsEnabled?: boolean; catalog?: StoreCatalog; code?: string; message?: string };
export interface ReleaseBillingBridge { request(request: BillingRequest): Promise<BillingReply> }
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const packages = { pro: '$rc_monthly', teams: '$rc_custom_teams_monthly' };
const products = { android: { pro: 'pro:pro', teams: 'teams:teams' }, ios: { pro: 'app.onlyfast.pro.monthly', teams: 'app.onlyfast.teams.monthly' } };

export function validateStoreCatalog(catalog: StoreCatalog | undefined, platform: 'android' | 'ios', now = Date.now()): StoreCatalog {
  if (!catalog || catalog.offeringIdentifier !== ONLYFAST_OFFERING || typeof catalog.catalogToken !== 'string' ||
      !catalog.catalogToken || !Number.isFinite(catalog.expiresAt) || catalog.expiresAt <= now || !Array.isArray(catalog.packages) || catalog.packages.length !== 2) {
    throw new Error('The named store catalog is missing or expired. Refresh plans.');
  }
  for (const plan of ['pro', 'teams'] as const) {
    const matches = catalog.packages.filter(item => item.plan === plan);
    const item = matches[0];
    if (matches.length !== 1 || item.packageIdentifier !== packages[plan] || item.productIdentifier !== products[platform][plan] ||
        !item.formattedPrice || !item.currencyCode || !item.billingPeriod || !item.eligibilityNote ||
        !['unknown', 'eligible', 'ineligible'].includes(item.trialEligibility) || !Array.isArray(item.pricingPhases) ||
        item.pricingPhases.some(phase => !phase.billingPeriod || !phase.price?.formatted || !phase.price.currencyCode ||
          !Number.isSafeInteger(phase.price.amountMicros) || phase.price.amountMicros < 0)) {
      throw new Error('The store did not return the expected Pro and Teams products and terms.');
    }
  }
  return catalog;
}

function checked(reply: BillingReply, allowed: BillingReply['status'][]): BillingReply {
  if (reply?.protocolVersion !== RELEASE_BILLING_PROTOCOL) throw new Error('Update the native OnlyFast billing extension.');
  if (allowed.includes(reply.status)) return reply;
  throw new NativePurchaseError(reply.status === 'cancelled' ? 'Purchase cancelled.' : reply.status === 'pending'
    ? 'Payment is pending store approval. Do not purchase again; access requires server confirmation.'
    : reply.message || 'The native store request failed.', reply.status === 'cancelled', reply.status === 'pending');
}

/** Versioned OnlyFast extension, never Median's generic/current-offering paywall. */
export class ReleaseNativePurchaseController {
  private desiredUser: string | null = null;
  private revision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private purchasing = false;
  private knownBridge: ReleaseBillingBridge | null = null;
  private bridge: () => Promise<ReleaseBillingBridge>;
  private session: () => Promise<BillingSession | null>;
  private enabled: () => boolean;
  constructor(bridge: () => Promise<ReleaseBillingBridge>, session: () => Promise<BillingSession | null>, enabled: () => boolean) {
    this.bridge = bridge; this.session = session; this.enabled = enabled;
  }
  private enqueue<T>(action: () => Promise<T>) { const result = this.queue.then(action); this.queue = result.catch(() => {}); return result; }
  private async auth(id: string, revision: number) {
    const session = await this.session();
    if (!uuid.test(id) || this.desiredUser !== id || revision !== this.revision || session?.userId !== id || !session.accessToken) {
      throw new Error('Your account changed. Sign in to the purchasing account.');
    }
    return session;
  }
  private async identify(id: string, revision: number) {
    if (!this.enabled()) throw new Error('In-app subscriptions are coming soon.');
    const auth = await this.auth(id, revision);
    const bridge = await this.bridge();
    this.knownBridge = bridge;
    const capabilities = checked(await bridge.request({ operation: 'capabilities', protocolVersion: 1 }), ['ok']);
    if (!['android', 'ios'].includes(capabilities.platform || '')) throw new Error('Unsupported native billing platform.');
    await this.auth(id, revision);
    const reply = checked(await bridge.request({ operation: 'identify', protocolVersion: 1, expectedUserId: id, accessToken: auth.accessToken }), ['ok']);
    await this.auth(id, revision);
    if (reply.appUserId !== id) throw new Error('Native billing identity does not match your signed-in account.');
    return { bridge, platform: capabilities.platform as 'android' | 'ios', transactionsEnabled: capabilities.transactionsEnabled === true };
  }
  setUser(id: string | null): Promise<void> {
    const changed = id !== this.desiredUser;
    this.desiredUser = id;
    const revision = ++this.revision; // Invalidate old callbacks before native code.
    if (changed && this.knownBridge) {
      // Native invalidation must not wait behind a store sheet/network request.
      try { void this.knownBridge.request({ operation: 'invalidate', protocolVersion: 1 }).catch(() => {}); }
      catch { /* Client revision still rejects every stale result. */ }
    }
    return this.enqueue(async () => {
      if (revision !== this.revision || !this.enabled()) return;
      if (id) { await this.identify(id, revision); return; }
      const bridge = await this.bridge();
      checked(await bridge.request({ operation: 'clear', protocolVersion: 1 }), ['ok']);
    });
  }
  private async readCatalog(id: string, revision: number, bridge: ReleaseBillingBridge, platform: 'android' | 'ios') {
    const session = await this.auth(id, revision);
    const reply = checked(await bridge.request({ operation: 'catalog', protocolVersion: 1, expectedUserId: id,
      accessToken: session.accessToken, offeringIdentifier: ONLYFAST_OFFERING }), ['ok']);
    await this.auth(id, revision);
    if (reply.appUserId !== id) throw new Error('Native catalog belongs to another account.');
    return validateStoreCatalog(reply.catalog, platform);
  }
  getCatalog(id: string): Promise<StoreCatalog> {
    const revision = this.revision;
    return this.enqueue(async () => { const { bridge, platform } = await this.identify(id, revision); return this.readCatalog(id, revision, bridge, platform); });
  }
  async run(id: string, action: 'purchase' | 'restore', plan?: StorePlan, selection?: StoreCatalog): Promise<void> {
    if (!this.enabled()) throw new Error('In-app subscriptions are coming soon.');
    if (action === 'purchase' && (!plan || !selection)) throw new Error('Select a store-priced Pro or Teams package first.');
    if (this.purchasing) throw new Error('A store request is already open.');
    this.purchasing = true;
    const revision = this.revision;
    try {
      await this.enqueue(async () => {
        const { bridge, platform, transactionsEnabled } = await this.identify(id, revision);
        if (!transactionsEnabled) throw new Error('Native transactions are not enabled in this binary.');
        const session = await this.auth(id, revision);
        const catalog = action === 'purchase' ? validateStoreCatalog(selection, platform) : undefined;
        const selected = catalog?.packages.find(item => item.plan === plan);
        const result = await bridge.request({ operation: action, protocolVersion: 1, expectedUserId: id,
          accessToken: session.accessToken, offeringIdentifier: ONLYFAST_OFFERING, plan,
          catalogToken: catalog?.catalogToken, packageIdentifier: selected?.packageIdentifier, productIdentifier: selected?.productIdentifier });
        await this.auth(id, revision);
        const reply = checked(result, [action === 'purchase' ? 'purchased' : 'restored']);
        if (reply.appUserId !== id) throw new Error('Store result belongs to another account.');
        // Caller must synchronize with Supabase. Native success grants no access.
      });
    } finally { this.purchasing = false; }
  }
}
