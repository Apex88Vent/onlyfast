import React, { useEffect, useRef, useState } from 'react';
import { SUBSCRIPTION_2027 } from '@/lib/subscription2027Catalog';
import { Billing2027RequestGuard, billing2027ClaimAvailable, billing2027TierAt, type Billing2027Status } from '@/lib/billing2027State';
import { readBilling2027, claimSportsman2027 } from '@/lib/subscription2027Billing';
import { syncMembershipFromSubscription } from '@/lib/subscription';

export function Subscription2027PlanCards({initialInterval='month'}:{initialInterval?:'month'|'year'}) {
  const [interval,setInterval]=useState(initialInterval);
  return <section aria-label="2027 subscription plans" className="space-y-5">
    <div className="text-center"><h2 className="text-2xl font-bold">Choose your 2027 plan</h2><p>Prices shown in USD. Purchases are disabled in this Preview.</p></div>
    <div className="flex justify-center gap-3" role="group" aria-label="Pro billing interval">
      <button type="button" aria-pressed={interval==='month'} onClick={()=>setInterval('month')} className={'rounded-lg border px-4 py-3'+(interval==='month'?' bg-[#007DAE] text-white':'')}>Pro monthly</button>
      <button type="button" aria-pressed={interval==='year'} onClick={()=>setInterval('year')} className={'rounded-lg border px-4 py-3'+(interval==='year'?' bg-[#007DAE] text-white':'')}>Pro annual — $60/year</button>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {(['sportsman','pro','factory'] as const).map(tier=>{
        const plan=SUBSCRIPTION_2027[tier],pro=tier==='pro';
        const price=pro&&interval==='year'?'$60/year':'$'+plan.monthlyPrice.toFixed(2)+'/month';
        return <article key={tier} aria-label={tier+' plan'} className={'rounded-2xl border bg-white p-5 text-[#1A1B23] '+(pro?'border-[#00A8E8] border-2 shadow-lg':'border-gray-200')}>
          {pro&&<p className="font-semibold text-[#007DAE]">Featured plan</p>}
          <h3 className="text-xl font-bold">{tier==='sportsman'?'Sportsman':pro?'Pro':'Factory'}</h3>
          <p className="my-3 text-2xl font-bold">{price}</p>
          {pro&&<p className="font-semibold">Selected interval: {interval==='year'?'Annual':'Monthly'}</p>}
          <p>{tier==='factory'?'Unlimited racing classes':'One racing car class'}</p>
          <p>{tier==='sportsman'?'2 active base setups · 5 active race setup slots':'Unlimited setups and timing scans'}</p>
          <p>{tier==='sportsman'?'48-hour race setup editing · 2 scans per race weekend · 1 Setup Assist per weekend':'Unlimited Setup Assist · Full OnlyFast Track Trace'}</p>
          <p>{tier==='sportsman'?'Unlimited permanent archives; upgrade to Pro or Factory to access or restore. Eligible historical telemetry remains viewable. No new Track Trace recording.':'Archive access and restoration'}</p>
          <p className="mt-2">No advertisements</p>
          {pro&&<p className="my-3 text-sm">14 days free for eligible new subscribers, then {price}. The {interval==='year'?'annual':'monthly'} subscription renews automatically unless canceled under provider terms. Store eligibility and the final authorization screen determine the offer. Your verified first billing date appears in subscription management when available.</p>}
          {!pro&&<p className="my-3 text-sm">Monthly only. Renews automatically unless canceled under provider terms.</p>}
          <button type="button" disabled className="mt-4 w-full rounded-xl bg-gray-200 px-4 py-3 font-semibold">Purchases disabled</button>
        </article>;
      })}
    </div>
    <p className="text-sm">No subscription is started by selecting an interval here. The stock store paywall will present localized prices, trial eligibility, billing dates and cancellation terms after release approval.</p>
  </section>;
}

export function Subscription2027Management({state,serverNow}:{state:Billing2027Status;serverNow:number}) {
  const currentTier=billing2027TierAt(state,serverNow);
  const promo=!!state.promo_expires_at&&Date.parse(state.promo_expires_at)>serverNow;
  const trial=!!state.trial_ends_at&&Date.parse(state.trial_ends_at)>serverNow;
  const management=state.store==='app_store'?'https://apps.apple.com/account/subscriptions':state.store==='play_store'?'https://play.google.com/store/account/subscriptions':null;
  return <section aria-label="2027 subscription management" className="rounded-2xl border bg-white p-5 space-y-2">
    <h2 className="text-xl font-bold">Subscription management</h2>
    <dl className="grid gap-2 sm:grid-cols-2">
      <div><dt>Current plan</dt><dd className="font-semibold">{currentTier==='unsubscribed'?'Historical read-only':currentTier==='team'?'Factory':currentTier[0].toUpperCase()+currentTier.slice(1)}</dd></div>
      <div><dt>Billing provider</dt><dd>{state.provider==='revenuecat'?state.store==='app_store'?'Apple App Store':'Google Play':state.provider==='stripe'?'Stripe web':'No verified paid subscription'}</dd></div>
      <div><dt>Billing interval</dt><dd>{state.interval==='year'?'Annual':state.interval==='month'?'Monthly':'Not applicable'}</dd></div>
      <div><dt>Access status</dt><dd>{promo?'30-day Sportsman promotion — no automatic billing':trial?'Provider-authorized introductory trial':state.status||'No active provider entitlement'}</dd></div>
    </dl>
    {trial&&<p>Expected first billing date: {new Date(state.trial_ends_at!).toLocaleString()}. {state.will_renew===false?'Renewal is canceled; verified trial access remains until expiration.':'Renewal follows the provider authorization and terms.'}</p>}
    {state.expires_at&&<p>Verified access through {new Date(state.expires_at).toLocaleString()}. {state.will_renew===false?'Renewal canceled.':''}</p>}
    {promo&&<p>Promotional access ends {new Date(state.promo_expires_at!).toLocaleString()}. No payment required; no automatic conversion.</p>}
    {state.grandfathered&&<p>Your existing renewal terms are protected through {new Date(state.protection_ends_at!).toLocaleString()}. No automatic price increase is scheduled.</p>}
    {state.protection_status==='candidate'&&<p>Legacy price-protection evidence is awaiting verification. Your billing subscription has not been changed.</p>}
    <p>Upgrade or downgrade through your original provider when available. Changes take effect on the provider’s verified date. Factory downgrades require one class selection; excess setups are preserved under the applicable write restrictions.</p>
    {management?<a className="inline-block underline py-2" href={management} target="_blank" rel="noopener noreferrer">Manage or cancel in your original store</a>:state.provider==='stripe'?<p>Manage your web subscription through the existing billing portal in browser Account Settings. External web checkout remains suppressed inside the native app.</p>:null}
    <p>After verified expiration, eligible racing records remain read-only. Expiration does not delete your data. Sportsman archives require Pro or Factory access.</p>
  </section>;
}

export default function Subscription2027Plans({userId}:{userId?:string}) {
  const [state,setState]=useState<Billing2027Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
  const guard=useRef(new Billing2027RequestGuard()),pending=useRef(false),clock=useRef(0);
  useEffect(()=>{
    const revision=guard.current.begin(userId||null);setState(null);setError('');setBusy(false);pending.current=false;
    if(userId)void readBilling2027(userId).then(s=>{if(guard.current.current(userId,revision)){clock.current=Date.parse(s.server_now)-Date.now();setNow(Date.now()+clock.current);setState(s);}})
      .catch(e=>{if(guard.current.current(userId,revision))setError(e.message);});
    const timer=setInterval(()=>setNow(Date.now()+clock.current),1000);
    return ()=>{guard.current.begin(null);clearInterval(timer);};
  },[userId]);
  const claim=async()=>{
    if(!userId||pending.current)return;pending.current=true;setBusy(true);setError('');
    const revision=guard.current.begin(userId);
    try {const s=await claimSportsman2027(userId);if(!guard.current.current(userId,revision))return;
      clock.current=Date.parse(s.server_now)-Date.now();setState(s);await syncMembershipFromSubscription();
    } catch(e) {if(guard.current.current(userId,revision))setError(e instanceof Error?e.message:'Claim unavailable.');}
    finally {if(guard.current.current(userId,revision)){pending.current=false;setBusy(false);}}
  };
  return <div className="space-y-6">
    <Subscription2027PlanCards />
    {error&&<p role="status" className="rounded-xl border p-4">{error}</p>}
    {state&&<Subscription2027Management state={state} serverNow={now}/>}
    {state&&billing2027ClaimAvailable(state,now)&&<section aria-label="Rookie transition" className="rounded-xl border p-5 space-y-3">
      <h2 className="text-xl font-bold">Your Rookie transition</h2>
      <p>Your current Rookie features remain available through January 30, 2027. Claim before January 31 at 12:00 AM Pacific.</p>
      <p>Claim window remaining: {Math.max(0,Math.ceil((Date.parse(state.claim_window_end)-now)/3600000))} hours.</p>
      <p>Claim 30 days of Sportsman from the time you claim. No payment required. No automatic billing.</p>
      <button disabled={busy} onClick={()=>void claim()} className="rounded-xl bg-[#007DAE] text-white px-5 py-3 font-semibold">{busy?'Confirming…':'Claim your 30 days of Sportsman'}</button>
    </section>}
  </div>;
}
