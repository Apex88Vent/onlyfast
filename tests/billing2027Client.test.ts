import assert from 'node:assert/strict';
import test from 'node:test';
import { Billing2027RequestGuard,billing2027ClaimAvailable,billing2027TierAt,verifyBilling2027Status,type Billing2027Status } from '../src/lib/billing2027State.ts';
import { clearTrustedMembership,getTrustedMembership,setTrustedAuthorization,getMembershipExpiration } from '../src/lib/trustedMembership.ts';
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const status:Billing2027Status={version:1,user_id:uid,server_now:'2027-01-01T08:00:00Z',tier:'rookie',valid_until:'2027-01-31T08:00:00Z',provider:null,store:null,interval:null,status:null,expires_at:null,trial_ends_at:null,will_renew:null,
  promo_claimed_at:null,promo_expires_at:null,claim_window_start:'2027-01-01T08:00:00Z',claim_window_end:'2027-01-31T08:00:00Z',claim_eligible:true,grandfathered:false,protection_status:null,protection_ends_at:null};
test('client display uses authenticated own-account server dates, half-open claim boundary and account request generations',()=>{
  assert.equal(verifyBilling2027Status(uid,status).tier,'rookie');
  assert.throws(()=>verifyBilling2027Status('other',status),/account/);
  assert.throws(()=>verifyBilling2027Status(uid,{...status,valid_until:'bad'}),/dates/);
  const end=Date.parse(status.claim_window_end);
  assert.equal(billing2027ClaimAvailable(status,end-1),true);assert.equal(billing2027ClaimAvailable(status,end),false);
  assert.equal(billing2027ClaimAvailable({...status,tier:'pro'},end-1),false);
  assert.equal(billing2027TierAt({...status,tier:'pro'},end),'unsubscribed');
  const guard=new Billing2027RequestGuard(),old=guard.begin(uid);guard.begin('other');assert.equal(guard.current(uid,old),false);
  const next=guard.begin(uid);assert.equal(guard.current(uid,next),true);guard.begin(null);assert.equal(guard.current(uid,next),false);
});
test('shared trusted membership keeps legacy behavior, expires canonical server grants and clears cross-account state',()=>{
  clearTrustedMembership();setTrustedAuthorization(uid,null,{},null,null,{...status,tier:'sportsman',server_now:new Date().toISOString(),valid_until:new Date(Date.now()+100000).toISOString()});
  assert.equal(getTrustedMembership(uid)?.membership_tier,'sportsman');assert(getMembershipExpiration()!>Date.now());
  assert.equal(getTrustedMembership('other'),null);
  setTrustedAuthorization(uid,null,{},null,null,{...status,tier:'pro',server_now:new Date().toISOString(),valid_until:new Date(Date.now()-1000).toISOString()});
  assert.equal(getTrustedMembership(uid)?.membership_tier,'unsubscribed');
  clearTrustedMembership('other');assert.equal(getTrustedMembership(uid),null);
  clearTrustedMembership();
});
