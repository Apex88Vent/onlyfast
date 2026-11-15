import { supabase, supabaseUrl } from './supabase';
import { verifyBilling2027Status } from './billing2027State';
export { type Billing2027Status } from './billing2027State';
export function requireTestingBillingClient() {
  if(import.meta.env.ONLYFAST_2027_PREVIEW!==true||supabaseUrl!=='https://mfzajhnfonrfuiwxgvhe.supabase.co')throw new Error('Subscription preparation requires the isolated testing project.');
}
async function verifySession(uid:string) {
  const r=await supabase.auth.getUser();
  if(r.error||r.data.user?.id!==uid)throw new Error('Your account changed. Please refresh.');
}
export async function readBilling2027(uid:string) {
  requireTestingBillingClient();await verifySession(uid);
  const r=await supabase.rpc('get_onlyfast_2027_billing_status');
  await verifySession(uid);
  if(r.error)throw new Error('Subscription infrastructure is awaiting installation and verification.');
  return verifyBilling2027Status(uid,r.data);
}
export async function claimSportsman2027(uid:string) {
  requireTestingBillingClient();await verifySession(uid);
  // No UID, plan, clock, receipt, eligibility or payment data is sent in the body.
  const r=await supabase.functions.invoke('claim-2027-sportsman-trial',{body:{}});
  await verifySession(uid);
  if(r.error)throw new Error('The Sportsman promotion could not be confirmed. Refresh before retrying.');
  return readBilling2027(uid);
}
export async function reconcileNative2027(uid:string) {
  requireTestingBillingClient();await verifySession(uid);
  const r=await supabase.functions.invoke('billing-2027-sync',{body:{}});
  await verifySession(uid);
  if(r.error)throw new Error('The store subscription could not be verified. No new access was confirmed.');
  return verifyBilling2027Status(uid,r.data?.subscription);
}
