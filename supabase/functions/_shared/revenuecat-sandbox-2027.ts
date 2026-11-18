// Server-only evidence, obtained from an authenticated RevenueCat webhook and
// corroborated by a fresh subscriber fetch. Never populate this from SDK bodies.
export type SandboxTrialEvidence2027 = {
  user_id: string; event_id: string; app_id: string; product_id: string;
  store: string; environment: string; transaction_id: string;
  purchased_at_ms: number; expiration_at_ms: number; event_timestamp_ms: number;
  period_type: string; type: string; entitlement_ids: string[];
  price: number; is_family_share: boolean; offer_code: string | null;
  presented_offering_id: string | null;
};
export const SANDBOX_PRO_TRIALS_2027: Record<string, { app_id: string; store: string; offer: string | null }> = {
  'app.onlyfast.2027.pro_monthly': { app_id: 'app82192c9834', store: 'app_store', offer: null },
  'app.onlyfast.2027.pro_annual': { app_id: 'app82192c9834', store: 'app_store', offer: null },
  'onlyfast2027promonthly:monthly': { app_id: 'appd348665a60', store: 'play_store', offer: 'pro14day2027' },
  'onlyfast2027proannual:annual': { app_id: 'appd348665a60', store: 'play_store', offer: 'pro14day2027' },
};
export function sandboxTrialEvidence2027(event: any, user_id: string): SandboxTrialEvidence2027 {
  return { user_id, event_id: event.id, app_id: event.app_id, product_id: event.product_id,
    store: event.store, environment: event.environment, transaction_id: event.transaction_id,
    purchased_at_ms: event.purchased_at_ms, expiration_at_ms: event.expiration_at_ms,
    event_timestamp_ms: event.event_timestamp_ms, period_type: event.period_type, type: event.type,
    entitlement_ids: event.entitlement_ids, price: event.price, is_family_share: event.is_family_share,
    offer_code: event.offer_code ?? null, presented_offering_id: event.presented_offering_id ?? null };
}
export function validateSandboxTrial2027(sku: string, raw: any, user_id: string | undefined,
  evidence: SandboxTrialEvidence2027[], now: number): SandboxTrialEvidence2027 {
  const policy = SANDBOX_PRO_TRIALS_2027[sku];
  const purchased = Date.parse(raw.purchase_date), expires = Date.parse(raw.expires_date);
  const transaction = typeof raw.store_transaction_id === 'number' && Number.isSafeInteger(raw.store_transaction_id)
    ? String(raw.store_transaction_id) : raw.store_transaction_id;
  if (!policy || !user_id || raw.is_sandbox !== true || raw.store !== policy.store ||
      raw.ownership_type !== 'PURCHASED' || String(raw.period_type).toLowerCase() !== 'trial' ||
      typeof transaction !== 'string' || !transaction || !Number.isFinite(purchased) || !Number.isFinite(expires) ||
      expires <= purchased || expires - purchased > 14 * 86400000 || purchased > now + 300000) {
    throw new Error('UNVERIFIED_SANDBOX_TRIAL');
  }
  // Apple automatic introductory trials have no developer offer identifier.
  // Require the audited SKU, TRIAL state and no promotional/offer code instead
  // of inventing an Apple identifier. Google requires the exact audited offer.
  const match = evidence.find(e => e?.user_id === user_id && e.app_id === policy.app_id && e.product_id === sku &&
    e.environment === 'SANDBOX' && e.store === (policy.store === 'app_store' ? 'APP_STORE' : 'PLAY_STORE') &&
    e.type === 'INITIAL_PURCHASE' && e.period_type === 'TRIAL' && e.transaction_id === transaction &&
    e.purchased_at_ms === purchased && e.expiration_at_ms === expires &&
    Number.isSafeInteger(e.event_timestamp_ms) && e.event_timestamp_ms >= purchased && e.event_timestamp_ms <= now + 300000 &&
    typeof e.event_id === 'string' && !!e.event_id && e.price === 0 && e.is_family_share === false &&
    Array.isArray(e.entitlement_ids) && e.entitlement_ids.includes('OnlyFast Pro') &&
    e.offer_code === policy.offer && e.presented_offering_id === 'onlyfast_2027_v1');
  if (!match) throw new Error('SANDBOX_TRIAL_EVIDENCE_REQUIRED');
  return match;
}
