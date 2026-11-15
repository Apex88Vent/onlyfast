// Sanitized own-account server contract. No payment tokens or product lineage.
export type Billing2027Tier = 'rookie'|'sportsman'|'pro'|'factory'|'team'|'admin'|'unsubscribed';
export type Billing2027Status = {
  version:1; user_id:string; server_now:string; tier:Billing2027Tier; valid_until:string|null;
  provider:'revenuecat'|'stripe'|null; store:'app_store'|'play_store'|'stripe'|null;
  interval:'month'|'year'|null; status:string|null; expires_at:string|null; trial_ends_at:string|null; will_renew:boolean|null;
  promo_claimed_at:string|null; promo_expires_at:string|null; claim_window_start:string; claim_window_end:string;
  claim_eligible:boolean; grandfathered:boolean; protection_status:string|null; protection_ends_at:string|null;
};
const validDate=(s:unknown)=>typeof s==='string'&&Number.isFinite(Date.parse(s));
export function verifyBilling2027Status(uid:string,value:unknown):Billing2027Status {
  const s=value as Billing2027Status;
  if(!s||s.version!==1||s.user_id!==uid||!validDate(s.server_now)||
    !['rookie','sportsman','pro','factory','team','admin','unsubscribed'].includes(s.tier)||
    ![null,'stripe','revenuecat'].includes(s.provider)||![null,'month','year'].includes(s.interval)||
    typeof s.claim_eligible!=='boolean'||typeof s.grandfathered!=='boolean'||
    !validDate(s.claim_window_start)||!validDate(s.claim_window_end)||
    ['valid_until','expires_at','trial_ends_at','promo_claimed_at','promo_expires_at','protection_ends_at'].some(k=>s[k]!==null&&!validDate(s[k]))) {
    throw new Error('Could not verify the subscription account or dates.');
  }
  return s;
}
export function billing2027TierAt(s:Billing2027Status,serverNow:number):Billing2027Tier {
  return s.valid_until&&Date.parse(s.valid_until)<=serverNow ? 'unsubscribed' : s.tier;
}
export function billing2027ClaimAvailable(s:Billing2027Status,serverNow:number) {
  return s.claim_eligible&&s.tier==='rookie'&&!s.promo_claimed_at&&serverNow>=Date.parse(s.claim_window_start)&&serverNow<Date.parse(s.claim_window_end);
}
/** Reject late results after sign-out, same-account refresh or account switching. */
export class Billing2027RequestGuard {
  private revision=0;
  private uid:string|null=null;
  begin(uid:string|null) {this.uid=uid;return ++this.revision;}
  current(uid:string,revision:number) {return this.uid===uid&&this.revision===revision;}
}
