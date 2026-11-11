// Local browser previews of existing app routes. Every external request is intercepted.
// Run after npm run dev; ONLYFAST_PLAYWRIGHT_MODULE can point to the bundled Playwright install.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.ONLYFAST_PLAYWRIGHT_MODULE ? pathToFileURL(path.resolve(process.env.ONLYFAST_PLAYWRIGHT_MODULE)).href : 'playwright');
const origin=process.env.ONLYFAST_LAYOUT_URL || 'http://127.0.0.1:8080';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname), 'Local review only');
const output=path.resolve(process.env.ONLYFAST_LAYOUT_OUTPUT || 'tmp/subscription-review'); await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
async function fixture({width=390,height=844,tier='rookie',onboarding=false,ua,testTier=null,guest=false}={}) {
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',...(ua?{userAgent:ua,hasTouch:true}: {})});
 const user={id:'00000000-0000-4000-8000-000000000088',aud:'authenticated',role:'authenticated',email:'preview@example.invalid',app_metadata:{},user_metadata:{nickname:'Preview Racer',onboarding_completed:!onboarding,how_onlyfast_works_completed:true}};
 const jwt=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.local-fixture`;
 const session={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'local-only',user};
 const state={active_class:onboarding?null:'Dwarf Cars',tier,can_change:true,unlimited:tier==='team',active_discipline:onboarding?null:'dirt_oval',onboarding_step:onboarding?'plan':'complete',onboarding_discipline:'dirt_oval',onboarding_race_class:'Dwarf Cars'};
 const native=!!ua?.includes('Median');
 const row=tier==='rookie'?null:{user_id:user.id,plan:tier==='team'?'teams':'pro',status:'active',stripe_customer_id:native?null:'cus_fixture',subscription_source:native?'revenuecat':'stripe',revenuecat_store:ua?.includes('iPhone')?'app_store':'play_store',revenuecat_expires_at:new Date(Date.now()+86400000).toISOString()};
 const requests=[];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin) return route.continue();
  requests.push({method:request.method(),path:url.pathname});
  // All external services are intercepted. No preview request leaves this browser.
  if(!url.hostname.endsWith('.supabase.co')) return route.abort();
  let data=[];
  if(url.pathname.includes('/auth/v1/user')) data=user;
  else if(url.pathname.includes('/auth/v1/token')) data=session;
  else if(url.pathname.endsWith('/user_subscriptions')) data=row?[row]:[];
  else if(url.pathname.endsWith('/get_onlyfast_test_tier')) data=testTier;
  else if(url.pathname.includes('/rpc/')) {
   const rpc=url.pathname.split('/').pop();
   if(rpc==='save_racing_onboarding_progress') {const args=request.postDataJSON();Object.assign(state,{onboarding_step:args.p_step,onboarding_discipline:args.p_discipline,onboarding_race_class:args.p_class});}
   else if(rpc==='complete_racing_onboarding') Object.assign(state,{active_class:state.onboarding_race_class,active_discipline:state.onboarding_discipline,onboarding_step:'complete'});
   data=['get_active_race_class_state','save_racing_onboarding_progress','complete_racing_onboarding'].includes(rpc)?state:[];
  }
  else if(request.headers().accept?.includes('vnd.pgrst.object')) data=null;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await context.addInitScript(({session,guest})=>{
  localStorage.setItem('onlyfast_cookie_consent','declined');
  if(!guest) localStorage.setItem('sb-thpyjvwtfvfxiufchrxn-auth-token',JSON.stringify(session));
 },{session,guest});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 return {context,page,state,requests,errors};
}
async function plans(page) {
 await page.getByRole('heading',{name:'Choose Your OnlyFast Plan',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('[data-plan]').length===3 && !document.body.textContent.includes('Checking membership…'));
 await page.evaluate(()=>document.fonts.ready);
}
async function goto(page,url) { await page.goto(origin+url,{waitUntil:'domcontentloaded',timeout:45000}); }
async function snap(page,name) {
 await page.locator('img[src="/onlyfast-logo.png"]').first().evaluate(el=>el.decode());
 await page.evaluate(()=>scrollTo(0,0)); await page.mouse.move(0,0);
 await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
}
async function layout(page,{horizontal=false}={}) {
 const metrics=await page.evaluate(()=>({
  overflow:document.documentElement.scrollWidth-innerWidth,
  cards:[...document.querySelectorAll('[data-plan]')].map(el=>{
   const r=el.getBoundingClientRect(),cta=el.querySelector('[data-plan-action]')?.getBoundingClientRect();
   return {tier:el.dataset.plan,x:r.x,y:r.y,height:r.height,bottom:r.bottom,ctaBottom:cta?.bottom,nestedScroll:el.scrollHeight>el.clientHeight+2};
  })
 }));
 if(metrics.overflow>1) console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,70),width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,25)));
 assert(metrics.overflow<=1, 'No horizontal overflow: '+JSON.stringify(metrics));
 assert.deepEqual(metrics.cards.map(c=>c.tier),['team','pro','rookie']);
 assert(metrics.cards.every(c=>!c.nestedScroll),'No nested card scrolling');
 if(horizontal) {
  assert(metrics.cards.every(c=>Math.abs(c.y-metrics.cards[0].y)<1),'Cards align at top');
  assert(metrics.cards.every(c=>Math.abs(c.bottom-metrics.cards[0].bottom)<1),'Cards have equal heights');
  assert(metrics.cards.every(c=>Math.abs(c.ctaBottom-metrics.cards[0].ctaBottom)<1),'CTAs align');
 } else assert(metrics.cards[0].y<metrics.cards[1].y && metrics.cards[1].y<metrics.cards[2].y,'Vertical card order');
 return metrics;
}
async function finish(f,name,checks) {
 assert.deepEqual(f.errors,[],name+' browser errors');
 results.push({name,checks,requests:f.requests,errors:f.errors});
 console.log('PASS '+name);
 await writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
 await f.context.close();
}
try {
 {
  const f=await fixture(); await goto(f.page,'/pricing'); await plans(f.page);
  await f.page.getByRole('button',{name:'Unlock Pro',exact:true}).waitFor({state:'visible'});
  await snap(f.page,'mobile');
  const sizes=[];
  for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,1024],[844,390],[1024,768],[1440,900]]) {
   await f.page.setViewportSize({width,height}); sizes.push({width,height,...await layout(f.page,{horizontal:width>=1024})});
  }
  await snap(f.page,'desktop');
  assert.equal(await f.page.locator('details').getAttribute('open'),null);
  await f.page.locator('summary').focus(); await f.page.keyboard.press('Enter');
  await f.page.getByRole('table').waitFor({state:'visible'});
  assert.equal(await f.page.getByRole('row').count(),13);
  await snap(f.page,'comparison-expanded');
  await f.page.setViewportSize({width:390,height:844}); await layout(f.page);await snap(f.page,'comparison-mobile');
  await f.page.setViewportSize({width:768,height:1024}); await snap(f.page,'tablet');
  await f.page.setViewportSize({width:320,height:568});
  await f.page.addStyleTag({content:'html {font-size:200% !important}'});await layout(f.page);await snap(f.page,'text-scaling-200');
  for(const action of await f.page.locator('[data-plan-action]').all()) {await action.scrollIntoViewIfNeeded(); const box=await action.boundingBox();assert(box.y>=0 && box.y+box.height<=568,'Scaled action stays reachable');}
  await finish(f,'Responsive Rookie selection, comparison keyboard expansion and 200% text',sizes);
 }
 {
  const f=await fixture({onboarding:true});await goto(f.page,'/app');await plans(f.page);await snap(f.page,'onboarding');
  await f.page.getByRole('button',{name:'Go back',exact:true}).click();await f.page.getByRole('heading',{name:'Select Your Car',exact:true}).waitFor();
  await f.page.getByRole('button',{name:/^Dwarf Cars -/}).click();await plans(f.page);
  await f.page.getByRole('button',{name:'Continue Free',exact:true}).click();
  await f.page.getByRole('button',{name:'Continue Saved Setup',exact:true}).waitFor();
  assert.equal(f.state.active_class,'Dwarf Cars');assert.equal(f.state.onboarding_step,'complete');
  assert.equal(f.requests.filter(r=>r.path.endsWith('/complete_racing_onboarding')).length,1);
  await finish(f,'Actual onboarding plan → Back → car → plan → Continue Free',['Same onboarding progression, no Stripe checkout or store purchase']);
 }
 {
  const f=await fixture();await goto(f.page,'/app');
  await f.page.getByRole('button',{name:/Preview Racer/}).click();
  await f.page.getByRole('menuitem',{name:'Settings',exact:true}).click();
  await f.page.getByText('You are on the free Rookie plan.',{exact:true}).waitFor();await snap(f.page,'account-settings');
  await f.page.getByRole('link',{name:'View Plans and included features',exact:true}).click();await plans(f.page);
  assert.equal(new URL(f.page.url()).pathname,'/pricing');await snap(f.page,'account-upgrade');
  await f.page.getByRole('button',{name:'Go back',exact:true}).click();await f.page.getByRole('button',{name:/Preview Racer/}).waitFor();
  await f.page.getByRole('button',{name:/Preview Racer/}).click();await f.page.getByRole('menuitem',{name:'Upgrade to Pro',exact:true}).click();await plans(f.page);
  await finish(f,'Settings and username upgrade entry points',['Existing /pricing destination and back navigation']);
 }
 for(const tier of ['pro','team']) {
  const f=await fixture({width:1440,height:900,tier});await goto(f.page,'/upgrade');await plans(f.page);
  await f.page.getByText(`Current plan: ${tier==='team'?'Teams':'Pro'}. Your membership is active.`,{exact:false}).waitFor();
  assert.equal(await f.page.getByRole('button',{name:/^(Unlock Pro|Go Unlimited)$/}).count(),0);
  await snap(f.page,'existing-'+tier);
  await finish(f,'Existing '+tier+' web subscription',['Active plan recognized; paid actions use existing provider-management instructions']);
 }
 for(const [name,ua] of [
  ['android','Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 MedianAndroid/1.0'],
  ['ios','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MedianIOS/1.0']]) {
  for(const tier of ['rookie','pro','team']) {
   const f=await fixture({tier,ua});await goto(f.page,'/pricing');await plans(f.page);await layout(f.page);
   assert.equal(await f.page.locator('stripe-buy-button').count(),0);
   if(tier==='rookie') {
    assert.equal(await f.page.getByRole('button',{name:'Subscription unavailable',exact:true}).count(),2);
    assert.equal(await f.page.getByRole('button',{name:'Subscription unavailable',exact:true}).first().isDisabled(),true);
   } else {
    const link=f.page.getByRole('link',{name:'Manage store subscription',exact:true}).first();await link.waitFor();
    assert.equal(await link.getAttribute('href'),name==='ios'?'https://apps.apple.com/account/subscriptions':'https://play.google.com/store/account/subscriptions');
    assert.equal(await f.page.getByRole('button',{name:/^(Unlock Pro|Go Unlimited)$/}).count(),0);
   }
   await snap(f.page,name+'-'+tier);
   await finish(f,name+' wrapper simulation — '+tier,['Chromium wrapper UA, existing purchase hold, no Stripe, original store management routing']);
  }
 }
 for(const route of ['/upgrade','/checkout']) {
  const f=await fixture();await goto(f.page,route);await plans(f.page);await layout(f.page);
  const tier=route==='/upgrade'?'pro':'team';
  await f.page.getByRole('button',{name:tier==='pro'?'Unlock Pro':'Go Unlimited',exact:true}).click();
  const buy=f.page.locator(`[data-plan="${tier}"] stripe-buy-button`);await buy.waitFor({state:'attached'});
  assert.equal(await buy.getAttribute('client-reference-id'),'00000000-0000-4000-8000-000000000088');
  assert.equal(await buy.getAttribute('buy-button-id'),tier==='pro'?'buy_btn_1TdzjMGEWZrPYXmKqblFVGCp':'buy_btn_1TjNSYGEWZrPYXmKdJbu6VSP');
  await finish(f,'Route alias '+route,['Same shared selector; existing '+tier+' checkout mapping and authenticated reference; Stripe network blocked']);
 }
 {
  const f=await fixture({width:1440,height:1000,guest:true});await goto(f.page,'/');await f.page.locator('#pricing').waitFor();
  await f.page.locator('#pricing').scrollIntoViewIfNeeded();await f.page.locator('#pricing').screenshot({path:path.join(output,'public-plans.png')});
  assert.deepEqual(await f.page.locator('[data-plan]').evaluateAll(els=>els.map(el=>el.dataset.plan)),['team','pro','rookie']);
  assert.equal(await f.page.locator('[data-plan="team"] a').getAttribute('href'),'/upgrade');
  assert.equal(await f.page.locator('[data-plan="rookie"] a').getAttribute('href'),'/app');
  await finish(f,'Public homepage plan summary',['Shared content; original navigation destinations']);
 }
} finally {await writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));await browser.close();}
