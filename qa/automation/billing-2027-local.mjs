// Actual React components, synthetic state, localhost only. No hosted auth or provider operations.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const root=process.cwd(),out=path.resolve('tmp/phase3b-browser');await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ONLYFAST_PLAYWRIGHT_MODULE||path.resolve('tmp/public-home-browser/node_modules/playwright'));
const modules={
  '@/lib/subscription2027Billing':`export const readBilling2027=async()=>window.billingFixture.state;export const claimSportsman2027=async()=>{window.billingFixture.claims++;window.billingFixture.state={...window.billingFixture.state,tier:'sportsman',claim_eligible:false,promo_claimed_at:'2027-01-25T20:00:00Z',promo_expires_at:'2027-02-24T20:00:00Z',valid_until:'2027-02-24T20:00:00Z'};return window.billingFixture.state;};`,
  '@/lib/subscription':`export const syncMembershipFromSubscription=async()=>null;`,
  '@/lib/supabase':`export const supabase={},supabaseUrl='https://onlyfast-2027.invalid',supabaseKey='synthetic';`,
};
const result=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import Subscription2027Plans from'./src/components/Subscription2027Plans';function App(){const[n,setN]=React.useState(0);React.useEffect(()=>{window.billingFixture.refresh=()=>setN(x=>x+1)},[]);return <main className="mx-auto max-w-6xl p-4"><Subscription2027Plans key={n} userId={window.billingFixture.state.user_id}/></main>}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},define:{'import.meta.env.ONLYFAST_2027_PREVIEW':'true'},
  plugins:[{name:'synthetic-billing-only',setup(b){b.onResolve({filter:/.*/},a=>a.path in modules?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:modules[a.path],loader:'js',resolveDir:root}));}}],logLevel:'silent'});
await writeFile(path.join(out,'fixture.js'),result.outputFiles[0].contents);
const assets=path.resolve('tmp/phase3b-build/assets');
const css=(await Promise.all((await readdir(assets)).filter(x=>x.endsWith('.css')).map(x=>readFile(path.join(assets,x),'utf8')))).join('\n').replace(/@import\s*(?:url\()?["'][^"']*["']\)?[^;]*;/g,'');
const initial={version:1,user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',server_now:'2027-01-25T20:00:00Z',tier:'rookie',valid_until:'2027-01-31T08:00:00Z',provider:null,store:null,interval:null,status:null,expires_at:null,trial_ends_at:null,will_renew:null,promo_claimed_at:null,promo_expires_at:null,claim_window_start:'2027-01-01T08:00:00Z',claim_window_end:'2027-01-31T08:00:00Z',claim_eligible:true,grandfathered:false,protection_status:null,protection_ends_at:null};
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>window.billingFixture={state:${JSON.stringify(initial)},claims:0};</script><script src="/fixture.js"></script></body></html>`;
const server=createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?await readFile(path.join(out,'fixture.js')):html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const reports=[];let blocked=0;
try {
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const context=await browser.newContext({viewport});
    await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():(blocked++,r.abort()));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);await page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true}).waitFor();
    assert.equal(await page.getByRole('article',{name:'pro plan',exact:true}).evaluate(e=>getComputedStyle(e.parentElement).display),'grid','Actual built styles must load');
    assert.equal(await page.getByRole('button',{name:'Purchases disabled',exact:true}).count(),3);
    for(const b of await page.getByRole('button',{name:'Purchases disabled',exact:true}).all())assert(await b.isDisabled());
    await page.getByRole('button',{name:'Pro annual — $60/year',exact:true}).click();
    assert((await page.getByRole('article',{name:'pro plan',exact:true}).innerText()).includes('$60/year'));
    assert((await page.getByRole('article',{name:'pro plan',exact:true}).innerText()).includes('14 days free for eligible'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,viewport.width>1000?'desktop.png':'mobile.png'),fullPage:true});
    await page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true}).click();
    await page.getByText('30-day Sportsman promotion — no automatic billing',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.billingFixture.claims),1);
    assert.equal(await page.getByRole('button',{name:'Claim your 30 days of Sportsman',exact:true}).count(),0);
    await page.evaluate(()=>{window.billingFixture.state={...window.billingFixture.state,tier:'pro',provider:'revenuecat',store:'app_store',interval:'year',status:'trialing',will_renew:false,trial_ends_at:'2027-02-08T20:00:00Z',expires_at:'2027-02-08T20:00:00Z',valid_until:'2027-02-08T20:00:00Z',promo_expires_at:null};window.billingFixture.refresh();});
    await page.getByText('Provider-authorized introductory trial',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Manage or cancel in your original store'}).getAttribute('href'),'https://apps.apple.com/account/subscriptions');
    assert((await page.getByRole('region',{name:'2027 subscription management'}).innerText()).includes('Renewal is canceled'));
    await page.evaluate(()=>{window.billingFixture.state={...window.billingFixture.state,tier:'unsubscribed',provider:null,store:null,interval:null,status:null,trial_ends_at:null,expires_at:null,valid_until:null};window.billingFixture.refresh();});
    await page.getByText('Historical read-only',{exact:true}).waitFor();
    assert.equal(errors.length,0,errors.join('\n'));reports.push({viewport,passed:true});await context.close();
  }
  assert.equal(blocked,0,'No remote requests should be attempted');
  await writeFile(path.join(out,'results.json'),JSON.stringify({fixture:'local synthetic; not hosted/store acceptance',reports,remoteRequests:blocked},null,2));
  console.log(JSON.stringify({reports,remoteRequests:blocked,output:out}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
