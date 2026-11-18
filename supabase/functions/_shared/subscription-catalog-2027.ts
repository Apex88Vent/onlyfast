// Server-only catalog contracts. Prices and display labels never authorize access.
import { SANDBOX_PRO_TRIALS_2027, validateSandboxTrial2027, type SandboxTrialEvidence2027 } from './revenuecat-sandbox-2027.ts';
export const TESTING_BILLING_URL = 'https://mfzajhnfonrfuiwxgvhe.supabase.co';
export const LAUNCH_2027 = '2027-01-01T08:00:00Z';
export const ROOKIE_CLAIM_END = '2027-01-31T08:00:00Z';
export const PROTECTION_END = '2028-01-01T08:00:00Z';
export const DAY_MS = 86_400_000;
export type BillingTier = 'sportsman' | 'pro' | 'factory';
export type RegistryProduct = {
  id: string; provider: 'revenuecat' | 'stripe'; environment: 'sandbox' | 'production';
  app_id: string; store: 'app_store' | 'play_store' | 'stripe'; product_id: string;
  base_plan: string; interval: 'month' | 'year'; tier: BillingTier; entitlement: string | null;
  legacy: boolean; enabled: boolean; intro_days: number; duration_verified: boolean;
};
export const ACQUISITION_2027 = [
  { key: 'sportsman_monthly', tier: 'sportsman', interval: 'month', usd: 4.99, intro_days: 0 },
  { key: 'pro_monthly', tier: 'pro', interval: 'month', usd: 7.99, intro_days: 14 },
  { key: 'pro_annual', tier: 'pro', interval: 'year', usd: 60, intro_days: 14 },
  { key: 'factory_monthly', tier: 'factory', interval: 'month', usd: 14.99, intro_days: 0 },
] as const;

export function assertTestingBilling(env: (name: string) => string | undefined) {
  if (env('SUPABASE_URL') !== TESTING_BILLING_URL || env('ONLYFAST_2027_BILLING_ENABLED') !== 'true' ||
      env('BILLING_2027_ENVIRONMENT') !== 'sandbox') throw new Error('TESTING_BILLING_NOT_ENABLED');
}

export function registryProduct(rows: RegistryProduct[], input: {
  provider: string; environment: string; app_id: string; store: string; product_id: string; base_plan?: string;
}) {
  const matches = rows.filter(p => p.enabled && p.provider === input.provider && p.environment === input.environment &&
    p.app_id === input.app_id && p.store === input.store && p.product_id === input.product_id &&
    p.base_plan === (input.base_plan || ''));
  if (matches.length !== 1) throw new Error('UNKNOWN_OR_AMBIGUOUS_BILLING_PRODUCT');
  const p = matches[0];
  if (!p.duration_verified || !['sportsman','pro','factory'].includes(p.tier) ||
      !['month','year'].includes(p.interval) || p.interval === 'year' && p.tier !== 'pro' ||
      p.provider === 'revenuecat' && p.tier === 'sportsman' && ['OnlyFast Pro','OnlyFast Teams'].includes(p.entitlement || '') ||
      p.intro_days !== (p.legacy ? 0 : p.tier === 'pro' ? 14 : 0)) throw new Error('UNVERIFIED_BILLING_PRODUCT_TERMS');
  return p;
}

export type VerifiedSubscription = {
  registry_id: string; provider_key: string; lineage_id: string | null; transaction_id: string | null;
  status: 'active' | 'trialing' | 'grace' | 'expired' | 'refunded'; expires_at: string;
  started_at: string; trial_ends_at: string | null; will_renew: boolean | null;
  price_amount: number | null; price_unit: 'major' | 'minor'; currency: string | null;
};
export type VerifiedSnapshot = {
  provider: 'revenuecat' | 'stripe'; environment: 'sandbox'; observed_at: string;
  subscriptions: VerifiedSubscription[];
};
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown) => {
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) throw new Error('INVALID_PROVIDER_DATE');
  return new Date(v).toISOString();
};

// Input is fetched by server secret for ONE authenticated UUID. Never a request body.
// A full native snapshot replaces this user's native stream atomically in SQL.
export function mapRevenueCat2027(body: any, rows: RegistryProduct[], now = Date.now(),
  trialContext: { user_id: string; evidence: SandboxTrialEvidence2027[] } | null = null): VerifiedSnapshot {
  if (!record(body?.subscriber?.entitlements) || !record(body?.subscriber?.subscriptions) ||
      !Number.isSafeInteger(body.request_date_ms) || Math.abs(body.request_date_ms - now) > 300_000) {
    throw new Error('INVALID_REVENUECAT_SNAPSHOT');
  }
  const subscriptions: VerifiedSubscription[] = [];
  for (const [key, raw] of Object.entries(body.subscriber.subscriptions)) {
    if (!record(raw) || !['app_store','play_store'].includes(raw.store)) continue;
    if (raw.is_sandbox !== true) throw new Error('WRONG_BILLING_ENVIRONMENT');
    const store = raw.store;
    const app_id = store === 'app_store' ? 'app82192c9834' : 'appd348665a60';
    // REST v1 may omit the plan suffix from the dictionary key. A conflicting
    // suffix/explicit plan must never select a different registry row.
    const suffix = key.split(':')[1] || '';
    if (raw.product_plan_identifier != null && (typeof raw.product_plan_identifier !== 'string' ||
      suffix && raw.product_plan_identifier !== suffix)) throw new Error('MISMATCHED_PRODUCT_PLAN');
    const base_plan = store === 'play_store' ? raw.product_plan_identifier || suffix : '';
    const sku = store === 'play_store' && base_plan ? key.split(':')[0] + ':' + base_plan : key;
    const p = registryProduct(rows, { provider:'revenuecat', environment:'sandbox', app_id, store, product_id:sku, base_plan });
    const entitlement = body.subscriber.entitlements[p.entitlement || ''];
    const matched = record(entitlement) && [key,sku].includes(entitlement.product_identifier) &&
      (entitlement.product_plan_identifier == null || entitlement.product_plan_identifier === base_plan);
    const expiration = date(raw.expires_date);
    const started_at = date(raw.original_purchase_date || raw.purchase_date);
    const lastPurchase = date(raw.purchase_date);
    const grace = raw.grace_period_expires_date ? date(raw.grace_period_expires_date) : null;
    const end = matched && entitlement.grace_period_expires_date ? date(entitlement.grace_period_expires_date) : null;
    const expires_at = new Date(Math.max(Date.parse(expiration), ...[grace,end].filter(Boolean).map(x=>Date.parse(x!)))).toISOString();
    const period = String(raw.period_type).toLowerCase();
    if (!['normal','trial','intro'].includes(period) || Date.parse(expiration) <= Date.parse(lastPurchase) ||
      Date.parse(started_at) > Date.parse(lastPurchase) || Date.parse(lastPurchase) > now + 300000 ||
      !p.legacy && period === 'intro') throw new Error('INVALID_PROVIDER_PURCHASE_STATE');
    const trial = period === 'trial';
    if (trial && !p.legacy) {
      if (p.tier !== 'pro') throw new Error('UNEXPECTED_INTRODUCTORY_TRIAL_TERMS');
      if (SANDBOX_PRO_TRIALS_2027[sku]) {
        validateSandboxTrial2027(sku,raw,trialContext?.user_id,trialContext?.evidence || [],now);
      } else if (Date.parse(expiration)-Date.parse(lastPurchase) !== 14*DAY_MS) {
        throw new Error('UNEXPECTED_INTRODUCTORY_TRIAL_TERMS');
      }
    }
    const active = matched && Date.parse(expires_at) > now;
    subscriptions.push({ registry_id:p.id, provider_key:store+':'+sku,
      // REST v1 does not guarantee original transaction lineage. Never fabricate it
      // from a renewal transaction or user UUID; grandfather evidence stays pending.
      lineage_id:null, transaction_id:raw.store_transaction_id ? String(raw.store_transaction_id) : null,
      status:raw.refunded_at ? 'refunded' : !active ? 'expired' : Date.parse(expiration)<=now ? 'grace' : trial ? 'trialing' : 'active',
      expires_at, started_at, trial_ends_at:trial ? expiration : null,
      will_renew:raw.unsubscribe_detected_at ? false : raw.billing_issues_detected_at ? null : true,
      price_amount:null, price_unit:'major', currency:null });
  }
  return { provider:'revenuecat', environment:'sandbox', observed_at:new Date(body.request_date_ms).toISOString(), subscriptions };
}

export function stripeInvoiceSubscription(invoice: any): string | null {
  const value = invoice?.parent?.type === 'subscription_details' ? invoice.parent.subscription_details?.subscription : invoice?.subscription;
  return typeof value === 'string' ? value : typeof value?.id === 'string' ? value.id : null;
}

export function mapStripe2027(s: any, rows: RegistryProduct[], app_id: string, now = Date.now()): VerifiedSubscription {
  if (!s || s.livemode !== false || typeof s.id !== 'string' || !s.id.startsWith('sub_')) throw new Error('WRONG_STRIPE_SUBSCRIPTION');
  if (!Array.isArray(s.items?.data) || s.items.data.length !== 1) throw new Error('SINGLE_SUBSCRIPTION_ITEM_REQUIRED');
  const item = s.items.data[0];
  const p = registryProduct(rows,{provider:'stripe',environment:'sandbox',app_id,store:'stripe',product_id:item.price?.id});
  if (item.price?.recurring?.interval !== p.interval || item.price?.recurring?.interval_count !== 1) throw new Error('WRONG_STRIPE_INTERVAL');
  const seconds = s.status === 'trialing' ? s.trial_end : item.current_period_end ?? s.current_period_end;
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || !Number.isSafeInteger(s.start_date)) throw new Error('INVALID_STRIPE_EXPIRATION');
  const expires_at = new Date(seconds*1000).toISOString();
  const trial = s.status === 'trialing';
  if (trial && (!Number.isSafeInteger(s.trial_start) || !p.legacy && (p.tier !== 'pro' || seconds-s.trial_start !== 14*86400))) {
    throw new Error('UNEXPECTED_INTRODUCTORY_TRIAL_TERMS');
  }
  return {registry_id:p.id,provider_key:s.id,lineage_id:s.id,transaction_id:null,
    status:!['active','trialing','canceled','past_due','unpaid','incomplete','incomplete_expired','paused'].includes(s.status)
      ? (()=>{throw new Error('UNKNOWN_STRIPE_STATUS');})() : Date.parse(expires_at)>now && ['active','trialing'].includes(s.status) ? s.status : 'expired',
    started_at:new Date(s.start_date*1000).toISOString(), expires_at, trial_ends_at:trial ? expires_at : null,
    will_renew:!s.cancel_at_period_end && !s.cancel_at,
    price_amount:Number.isFinite(item.price.unit_amount) ? item.price.unit_amount : null,price_unit:'minor',
    currency:typeof item.price.currency === 'string' ? item.price.currency.toUpperCase() : null};
}

export async function verifyStripe2027Signature(body: string, header: string, secret: string, now = Date.now()) {
  const parts = header.split(',').map(x=>x.trim());
  const times = parts.filter(x=>x.startsWith('t='));
  if (!secret || times.length !== 1 || !/^t=\d+$/.test(times[0])) return false;
  const t = Number(times[0].slice(2));
  if (!Number.isSafeInteger(t) || Math.abs(now/1000-t)>300) return false;
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+body));
  const expected = [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return parts.filter(x=>/^v1=[a-f0-9]{64}$/.test(x)).some(x=>{
    const actual=x.slice(3); let difference=0; for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^actual.charCodeAt(i);
    return difference===0;
  });
}
