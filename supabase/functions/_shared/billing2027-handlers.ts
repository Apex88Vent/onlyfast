import { assertTestingBilling, mapRevenueCat2027, mapStripe2027, stripeInvoiceSubscription,
  verifyStripe2027Signature, type RegistryProduct, type VerifiedSnapshot } from './subscription-catalog-2027.ts';
import { authorizationMatches, webhookUserIds } from './revenuecat.ts';
import { SANDBOX_PRO_TRIALS_2027, sandboxTrialEvidence2027, type SandboxTrialEvidence2027 } from './revenuecat-sandbox-2027.ts';

type Env = (name: string) => string | undefined;
type ClientFactory = (url: string, key: string, options?: any) => any;
const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json = (value: unknown, status=200) => new Response(JSON.stringify(value),{status,headers});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function billing2027Handler(action:'claim'|'sync'|'reconcile'|'revenuecat-webhook'|'stripe-webhook', env:Env, createClient:ClientFactory, fetcher:typeof fetch=fetch) {
  return async (req:Request):Promise<Response> => {
    // Guard before authentication, database construction OR any provider request.
    try { assertTestingBilling(env); } catch { return json({error:'Testing billing infrastructure is not enabled.'},503); }
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    // An operator attestation is required AFTER independently verified routing
    // isolation. This flag alone is not proof that production routing is safe.
    if(action!=='claim' && env('BILLING2027_SANDBOX_ISOLATION_CONFIRMED')!=='true')
      return json({error:'Sandbox provider routing isolation has not been verified.'},503);
    const testers=(env('BILLING2027_TEST_USER_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean);
    const requireTester=(uid:string)=>{if(!uuid.test(uid)||!testers.includes(uid))throw new Error('APPROVED_SYNTHETIC_ACCOUNT_REQUIRED');};
    const url=env('SUPABASE_URL')!, key=env('SUPABASE_SERVICE_ROLE_KEY');
    if(!key)return json({error:'Testing service not configured'},503);
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const rpc=async(name:string,args:any={})=>{
      const r=await client.rpc(name,args); if(r.error)throw new Error('BILLING_DATABASE_REJECTED'); return r.data;
    };
    const registry=async():Promise<RegistryProduct[]>=>{
      const rows=await rpc('billing2027_registry'); if(!Array.isArray(rows))throw new Error('INVALID_REGISTRY'); return rows;
    };
    const native=async(uid:string,rows:RegistryProduct[],event?:any)=>{
      requireTester(uid);
      const secret=env('BILLING2027_REVENUECAT_SECRET_API_KEY');
      if(!secret)throw new Error('TESTING_REVENUECAT_NOT_CONFIGURED');
      const previous=await rpc('billing2027_trial_evidence',{p_uid:uid});
      if(!Array.isArray(previous))throw new Error('INVALID_TRIAL_EVIDENCE');
      const candidate=event?.type==='INITIAL_PURCHASE'&&event.period_type==='TRIAL'&&SANDBOX_PRO_TRIALS_2027[event.product_id]
        ? sandboxTrialEvidence2027(event,uid):null;
      const response=await fetcher('https://api.revenuecat.com/v1/subscribers/'+encodeURIComponent(uid),{
        headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('PROVIDER_UNAVAILABLE');
      const body=await response.json(),original=body?.subscriber?.original_app_user_id;
      if(typeof original==='string'&&uuid.test(original)&&original!==uid)throw new Error('CROSS_ACCOUNT_NATIVE_ALIAS_REVIEW_REQUIRED');
      const snapshot=mapRevenueCat2027(body,rows,Date.now(),{user_id:uid,evidence:[...previous,...(candidate?[candidate]:[])]});
      const trials:SandboxTrialEvidence2027[]=candidate&&snapshot.subscriptions.some(s=>s.transaction_id===candidate.transaction_id &&
        rows.some(p=>p.id===s.registry_id&&p.product_id===candidate.product_id)&&s.trial_ends_at!==null)?[candidate]:[];
      return {snapshot,trials};
    };
    const apply=async(uid:string,snapshot:VerifiedSnapshot,id:string,type:string)=>rpc('billing2027_apply_snapshot',{
      p_uid:uid,p_snapshot:snapshot,p_event_id:id,p_event_type:type});
    const applyNative=async(uid:string,nativeResult:Awaited<ReturnType<typeof native>>,id:string,type:string)=>
      rpc('billing2027_apply_native_snapshot',{p_uid:uid,p_snapshot:nativeResult.snapshot,p_event_id:id,p_event_type:type,p_trials:nativeResult.trials});
    let stripeAccountVerified=false;
    const stripeGet=async(path:string)=>{
      const secret=env('BILLING2027_STRIPE_SECRET_KEY');
      if(!/^(sk|rk)_test_/.test(secret||'')||!env('BILLING2027_STRIPE_ACCOUNT_ID'))throw new Error('STRIPE_SANDBOX_NOT_CONFIGURED');
      const request={headers:{Authorization:'Bearer '+secret,'Stripe-Version':'2026-10-28.endive'},signal:AbortSignal.timeout(12000)};
      if(!stripeAccountVerified){
        const account=await fetcher('https://api.stripe.com/v1/account',request);
        if(!account.ok||(await account.json()).id!==env('BILLING2027_STRIPE_ACCOUNT_ID'))throw new Error('WRONG_STRIPE_ACCOUNT');
        stripeAccountVerified=true;
      }
      const r=await fetcher('https://api.stripe.com/v1/'+path,{...request,signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw new Error('PROVIDER_UNAVAILABLE');return r.json();
    };
    const stripeOwner=async(s:any)=>{
      const bound=await rpc('billing2027_stripe_owner',{p_subscription_id:s.id});
      const metadata=s.metadata?.supabase_user_id||s.metadata?.user_id;
      if(bound&&metadata&&bound!==metadata)throw new Error('SUBSCRIPTION_ACCOUNT_CONFLICT');
      const uid=bound||metadata;
      requireTester(uid);return uid as string;
    };
    try {
      if(action==='claim'||action==='sync') {
        const bearer=req.headers.get('Authorization')||'';
        if(!bearer.startsWith('Bearer '))return json({error:'Authentication required'},401);
        const verified=await client.auth.getUser(bearer.slice(7));
        const uid=verified.data?.user?.id;
        if(verified.error||!uuid.test(uid||''))return json({error:'Invalid session'},401);
        // Body purchase responses, user IDs, tier, dates and eligibility are ignored.
        const actor=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:bearer}}});
        if(action==='claim') {
          const r=await actor.rpc('claim_onlyfast_2027_sportsman');
          if(r.error)return json({error:'Sportsman promotion is unavailable or this account is ineligible.'},409);
          return json({claim:r.data});
        }
        requireTester(uid);
        await applyNative(uid,await native(uid,await registry()),'sync:'+crypto.randomUUID(),'AUTHENTICATED_SYNC');
        const state=await actor.rpc('get_onlyfast_2027_billing_status');
        if(state.error||state.data?.user_id!==uid)throw new Error('STATUS_UNAVAILABLE');
        return json({subscription:state.data});
      }
      if(action==='reconcile') {
        const secret=env('BILLING2027_RECONCILE_AUTHORIZATION');
        if(!authorizationMatches(req.headers.get('Authorization')||'',secret||''))return json({error:'Unauthorized'},401);
        const body=await req.json();
        if(!uuid.test(body.user_id||''))return json({error:'Explicit reconciliation account required'},400);
        requireTester(body.user_id);
        if(body.provider==='revenuecat')await applyNative(body.user_id,await native(body.user_id,await registry()),'reconcile:'+crypto.randomUUID(),'RECONCILE');
        else if(body.provider==='stripe'&&typeof body.subscription_id==='string'&&body.subscription_id.startsWith('sub_')) {
          const s=await stripeGet('subscriptions/'+encodeURIComponent(body.subscription_id));
          if(s.id!==body.subscription_id||await stripeOwner(s)!==body.user_id)throw new Error('WRONG_SUBSCRIPTION_ACCOUNT');
          await apply(body.user_id,{provider:'stripe',environment:'sandbox',observed_at:new Date().toISOString(),
            subscriptions:[mapStripe2027(s,await registry(),env('BILLING2027_STRIPE_ACCOUNT_ID')!)]},'reconcile:'+crypto.randomUUID(),'RECONCILE');
        } else return json({error:'Supported provider and subscription reference required'},400);
        return json({reconciled:true});
      }
      if(action==='revenuecat-webhook') {
        if(!authorizationMatches(req.headers.get('Authorization')||'',env('BILLING2027_REVENUECAT_WEBHOOK_AUTHORIZATION')||''))return json({error:'Unauthorized'},401);
        const body=await req.json(), event=body.event;
        if(body.api_version!=='1.0'||typeof event?.id!=='string'||!event.id||typeof event.type!=='string'||
            !Number.isSafeInteger(event.event_timestamp_ms)||event.event_timestamp_ms<0||event.event_timestamp_ms>Date.now()+300000) return json({error:'Invalid event'},400);
        if(event.type==='TEST')return json({received:true});
        const rows=await registry();
        if(event.environment!=='SANDBOX'||!rows.some(p=>p.enabled&&p.provider==='revenuecat'&&p.environment==='sandbox'&&p.app_id===event.app_id))return json({error:'Wrong app or environment'},422);
        const ids=webhookUserIds(event);
        // Cross-account aliases/transfer ownership are quarantined, never copied.
        // Reconcile both UUIDs through the explicit transfer procedure before retry.
        if(ids.length!==1||event.type==='TRANSFER')return json({error:'Account transfer requires verified ownership review'},409);
        requireTester(ids[0]);
        if(!['INITIAL_PURCHASE','RENEWAL','CANCELLATION','UNCANCELLATION','EXPIRATION','BILLING_ISSUE','PRODUCT_CHANGE','SUBSCRIPTION_PAUSED','SUBSCRIPTION_EXTENDED'].includes(event.type))
          return json({received:true,ignored:'unsupported-event'});
        const store=event.store==='APP_STORE'?'app_store':event.store==='PLAY_STORE'?'play_store':null;
        if(!rows.some(p=>p.enabled&&p.environment==='sandbox'&&p.provider==='revenuecat'&&p.app_id===event.app_id&&p.store===store&&p.product_id===event.product_id))
          return json({error:'Unregistered store product'},422);
        const verifiedNative=await native(ids[0],rows,event),snapshot=verifiedNative.snapshot;
        // An authenticated event can supplement lineage/price evidence only when its
        // transaction matches the freshly fetched server subscription. Access
        // status and expiry always come from the fresh snapshot, never the event.
        for(const s of snapshot.subscriptions) {
          const product=rows.find(p=>p.id===s.registry_id);
          if(product && product.app_id===event.app_id && product.store===(event.store==='APP_STORE'?'app_store':event.store==='PLAY_STORE'?'play_store':null) &&
            product.product_id===event.product_id && s.transaction_id && s.transaction_id===String(event.transaction_id)) {
            if(typeof event.original_transaction_id==='string'&&event.original_transaction_id)s.lineage_id=event.original_transaction_id;
            if(Number.isFinite(event.price_in_purchased_currency)&&event.price_in_purchased_currency>=0&&/^[A-Z]{3}$/.test(event.currency||'')) {
              s.price_amount=event.price_in_purchased_currency;s.currency=event.currency;s.price_unit='major';
            }
          }
        }
        await applyNative(ids[0],verifiedNative,event.id,event.type);
        return json({received:true});
      }
      const body=await req.text();
      if(!await verifyStripe2027Signature(body,req.headers.get('stripe-signature')||'',env('BILLING2027_STRIPE_WEBHOOK_SECRET')||''))return json({error:'Invalid or stale signature'},401);
      const event=JSON.parse(body);
      if(event.livemode!==false||typeof event.id!=='string'||!event.id.startsWith('evt_'))return json({error:'Sandbox event required'},422);
      const account=env('BILLING2027_STRIPE_ACCOUNT_ID');
      if(event.account!=null&&event.account!==account)return json({error:'Wrong sandbox Stripe account'},422);
      let id:string|null=null;
      const obj=event.data?.object;
      if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))id=obj?.id;
      else if(['invoice.payment_failed','invoice.payment_succeeded','invoice.paid'].includes(event.type))id=stripeInvoiceSubscription(obj);
      else if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) {
        // Refetch even checkout ownership; never take a body user ID as authorization.
        const session=await stripeGet('checkout/sessions/'+encodeURIComponent(String(obj?.id)));
        if(session.livemode!==false||session.mode!=='subscription')throw new Error('INVALID_CHECKOUT');
        id=typeof session.subscription==='string'?session.subscription:session.subscription?.id;
      } else if(['charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'].includes(event.type)) {
        return json({error:'Stripe risk-event policy requires review; no entitlement or billing mutation performed.'},409);
      } else return json({received:true,ignored:'unsupported-event'});
      if(typeof id!=='string'||!id.startsWith('sub_'))return json({error:'Subscription reference required'},422);
      const s=await stripeGet('subscriptions/'+encodeURIComponent(id));
      if(s.id!==id)throw new Error('WRONG_PROVIDER_SUBSCRIPTION');
      // Existing server-owned subscription bindings remain valid without new
      // metadata. Conflicts with fetched metadata fail closed, never transfer.
      const uid=await stripeOwner(s);
      const verified=mapStripe2027(s,await registry(),account!);
      await apply(uid,{provider:'stripe',environment:'sandbox',observed_at:new Date().toISOString(),subscriptions:[verified]},event.id,event.type);
      return json({received:true});
    } catch { return json({error:'Subscription verification failed; retry or contact support. No access was confirmed.'},502); }
  };
}
