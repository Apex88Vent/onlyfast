// Real Preview + testing Supabase, existing synthetic accounts only. No provider requests.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ONLYFAST_PLAYWRIGHT_MODULE||process.cwd()+'/tmp/public-home-browser/node_modules/playwright');
const ref='mfzajhnfonrfuiwxgvhe',api='https://'+ref+'.supabase.co';
const origin=process.env.ONLYFAST_PHASE3B_PREVIEW;assert(origin&&new URL(origin).hostname.endsWith('-apex88vents-projects.vercel.app'));
const config=JSON.parse(await readFile('tmp/phase3b-public-config.json','utf8'));
assert.equal(config.VITE_ONLYFAST_2027_SUPABASE_URL,api);
const key=config.VITE_ONLYFAST_2027_SUPABASE_PUBLISHABLE_KEY;assert(/^sb_publishable_/.test(key));
const credentials=JSON.parse(await readFile(process.env.ONLYFAST_2027_CREDENTIALS,'utf8'));assert.equal(credentials.projectRef,ref);
const access=JSON.parse(await readFile(process.env.ONLYFAST_PHASE3B_ACCESS,'utf8'));
const secret=Object.keys(access.result.protectionBypass)[0];assert(secret);
const out='tmp/phase3b-hosted-browser';await mkdir(out,{recursive:true});
const report={preview:origin,project:ref,checks:[],pageErrors:[],unexpectedRequests:[],requests:[],status:'running'};
const identities=[];let browser;
const safe=e=>String(e?.stack||e).replaceAll(secret,'[redacted]');
const record=async(name,fn)=>{await fn();report.checks.push({name,status:'passed'});console.log('PASS: '+name);};
const rpc=async(a,name,args={})=>{const r=await a.client.rpc(name,args);if(r.error)throw Error(name+': '+r.error.message);return r.data;};
async function pageFor(a,width=1440,billingFixture=null,claimFixture=null){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());
    if([origin,api].includes(u.origin)){report.requests.push({origin:u.origin,path:u.pathname,method:route.request().method()});return route.continue();}
    if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return route.abort();
    report.unexpectedRequests.push(u.origin+u.pathname);return route.abort();});
  if(billingFixture)await context.route('**/rest/v1/rpc/get_onlyfast_2027_billing_status',route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(billingFixture())}));
  if(claimFixture)await context.route('**/functions/v1/claim-2027-sportsman-trial',async route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(await claimFixture())}));
  await context.addInitScript(({ref,session})=>{if(!sessionStorage.getItem('phase3b-session-injected')){
    localStorage.setItem('onlyfast-2027-'+ref+'-auth',JSON.stringify(session));sessionStorage.setItem('phase3b-session-injected','true');
  }},{ref,session:a.session});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.pageErrors.push(safe(e)));
  await page.goto(origin+'/?_vercel_share='+encodeURIComponent(secret),{waitUntil:'domcontentloaded'});
  await page.goto(origin+'/upgrade',{waitUntil:'domcontentloaded'});
  await page.getByRole('region',{name:'2027 subscription plans',exact:true}).waitFor();
  if(await page.getByRole('button',{name:'Accept Essential',exact:true}).count())await page.getByRole('button',{name:'Accept Essential',exact:true}).click();
  return {page,context};
}
try {
  for(const account of credentials.accounts){
    const client=createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const r=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!r.error,'Synthetic account login failed');assert.equal(r.data.user.id,account.id);
    identities.push({account,client,session:r.data.session});
  }
  await record('Four existing synthetic logins and own-account billing projections',async()=>{
    for(const a of identities){const s=await rpc(a,'get_onlyfast_2027_billing_status');assert.equal(s.user_id,a.account.id);assert.equal(s.version,1);a.status=s;
      assert.equal(s.tier,a.account.tier==='unprivileged'?'unsubscribed':a.account.tier);}
  });
  const normal=identities.find(a=>a.account.tier==='unprivileged'),pro=identities.find(a=>a.account.tier==='pro');
  await record('Current calendar: promotion hidden and direct claim denied without creating a grant',async()=>{
    assert.equal(normal.status.claim_eligible,false);assert(Date.parse(normal.status.server_now)<Date.parse(normal.status.claim_window_start));
    const direct=await normal.client.rpc('claim_onlyfast_2027_sportsman');assert(direct.error&&/CLAIM_WINDOW_CLOSED/.test(direct.error.message));
    const endpoint=await normal.client.functions.invoke('claim-2027-sportsman-trial',{body:{user_id:pro.account.id,eligible:true,expires_at:'2099-01-01'}});
    assert(endpoint.error);assert.equal(endpoint.error.context.status,409);
    assert.equal((await rpc(normal,'get_onlyfast_2027_billing_status')).promo_claimed_at,null);
  });
  await record('Hosted claim endpoint rejects missing and forged authentication',async()=>{
    for(const authorization of [null,'Bearer forged']){
      const h={apikey:key,'Content-Type':'application/json'};if(authorization)h.Authorization=authorization;
      const r=await fetch(api+'/functions/v1/claim-2027-sportsman-trial',{method:'POST',headers:h,body:'{}'});assert.equal(r.status,401);
    }
  });
  await record('Private ledgers and provider grant RPCs deny browser manufacture and cross-account reads',async()=>{
    assert((await normal.client.rpc('billing2027_registry')).error);
    assert((await normal.client.rpc('billing2027_apply_snapshot',{p_uid:normal.account.id,p_snapshot:{provider:'revenuecat',environment:'sandbox',subscriptions:[]},p_event_id:'forged',p_event_type:'FORGED'})).error);
    assert((await normal.client.schema('onlyfast_private').from('billing2027_protection').select('*')).error);
    assert((await normal.client.rpc('onlyfast_subscription_tier',{p_user_id:pro.account.id})).error);
    assert((await normal.client.rpc('set_onlyfast_test_tier',{p_tier:'factory'})).error);
  });
  browser=await chromium.launch({headless:true,channel:'chrome'});
  for(const width of [1440,390])await record('Actual Preview '+width+'px: prices, featured Pro, annual interval and disabled purchases',async()=>{
    const {page,context}=await pageFor(pro,width);
    for(const b of await page.getByRole('button',{name:'Purchases disabled',exact:true}).all())assert(await b.isDisabled());
    assert.equal(await page.getByRole('button',{name:'Purchases disabled',exact:true}).count(),3);
    const card=page.getByRole('article',{name:'pro plan',exact:true});assert((await card.innerText()).includes('$7.99/month'));
    await page.getByRole('button',{name:'Pro annual — $60/year',exact:true}).click();assert((await card.innerText()).includes('$60/year'));assert((await card.innerText()).includes('Selected interval: Annual'));
    assert((await card.innerText()).includes('14 days free for eligible new subscribers'));
    assert.equal(await page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true}).count(),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:out+'/plans-'+width+'.png',fullPage:true});await context.close();
  });
  await record('Actual Preview account switch: Pro sign-out then unprivileged sign-in clears paid display',async()=>{
    const {page,context}=await pageFor(pro);
    await page.goto(origin+'/app',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:/^Account menu for /}).click();await page.getByRole('menuitem',{name:'Sign Out',exact:true}).click();
    await page.goto(origin+'/login',{waitUntil:'domcontentloaded'});
    await page.locator('input[type="email"]').fill(normal.account.email);await page.locator('input[type="password"]').fill(normal.account.password);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.getByRole('button',{name:'Setup Library',exact:true}).waitFor();
    await page.goto(origin+'/upgrade',{waitUntil:'domcontentloaded'});await page.getByText('Historical read-only',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true}).count(),0);await context.close();
  });
  // These DISPLAY cases replay sanitized snapshots returned by the real hosted
  // rollback test. They are not a claim of live store verification or a real-date
  // successful promotional claim. All user authentication remains real.
  const fixtures=JSON.parse(await readFile('tmp/phase3b-hosted-transactions.json','utf8'));
  assert.equal(fixtures.fixtures_rolled_back,true);
  for(const [name,expected] of [
    ['pro_monthly_trial','Provider-authorized introductory trial'],['pro_annual_trial','Provider-authorized introductory trial'],
    ['canceled_pro_trial','Renewal is canceled'],['expired_pro_trial','Historical read-only'],
    ['legacy_teams_factory','Factory'],['grandfathered_pro','renewal terms are protected'],['paid_after_protection','Pro'],
  ])await record('Hosted Preview display fixture: '+name,async()=>{
    const s=fixtures.snapshots[name],identity=identities.find(a=>a.account.id===s.user_id);assert(identity);
    // Refresh after account-switch sign-out, without altering provider/billing state.
    const login=await identity.client.auth.signInWithPassword({email:identity.account.email,password:identity.account.password});assert(!login.error);identity.session=login.data.session;
    const {page,context}=await pageFor(identity,1440,()=>s);
    const management=page.getByRole('region',{name:'2027 subscription management',exact:true});
    await management.getByText(new RegExp(expected)).first().waitFor();
    if(name==='pro_annual_trial')assert((await management.innerText()).includes('Annual'));
    if(name==='pro_monthly_trial')assert((await management.innerText()).includes('Monthly'));
    if(name==='paid_after_protection')assert(!(await management.innerText()).includes('renewal terms are protected'));
    assert.equal(await page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true}).count(),0);
    await page.screenshot({path:out+'/fixture-'+name+'.png',fullPage:true});await context.close();
  });
  await record('Hosted Preview display fixture: Rookie claim and duplicate-click suppression',async()=>{
    let s=fixtures.snapshots.rookie,calls=0;
    const {page,context}=await pageFor(normal,390,()=>s,()=>{calls++;s=fixtures.snapshots.sportsman_promotion;return {claim:{claimed_at:s.promo_claimed_at,expires_at:s.promo_expires_at}};});
    const claim=page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true});await claim.waitFor();
    await claim.evaluate(el=>{el.click();el.click();});
    await page.getByText('30-day Sportsman promotion — no automatic billing',{exact:true}).waitFor();assert.equal(calls,1);
    assert.equal(await page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true}).count(),0);
    await page.screenshot({path:out+'/fixture-sportsman-promotion-mobile.png',fullPage:true});await context.close();
  });
  report.displayFixtures='Sanitized hosted SQL rollback snapshots replayed at the billing-status response; not live store or real-date successful claim verification';
  assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.unexpectedRequests,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=safe(e);console.error(report.failure);process.exitCode=1;}
finally{
  if(browser)await browser.close();for(const a of identities)await a.client.auth.signOut({scope:'local'});
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,passed:report.checks.length,report:out+'/report.json'}));
}
